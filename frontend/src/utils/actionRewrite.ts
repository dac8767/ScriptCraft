/**
 * v5.54: the Action Rewrite tool's editor layer — integrated from Derek's
 * design handoff (docs/ACTION-REWRITE.md carries the rationale; the craft
 * prompt itself lives in src-tauri/prompts/action_line_rewrite.md and is
 * the product).
 *
 * The handoff was written against a flat ScriptElement[] model and said,
 * verbatim: if the editor is ProseMirror, replace resolveSelection's entry
 * point and applyVariant with position-based equivalents and KEEP the pure
 * context helpers. That is exactly this file: projectScript() flattens the
 * TipTap doc into elements that carry their PM spans, the context helpers
 * are the handoff's own (unchanged logic), and apply is an insertContentAt
 * over a validated range — undo rides the editor history.
 *
 * Deliberately separate from any formatting/rules module: those are pure
 * adjacency; this is context-sensitive by nature.
 */
import type { Editor } from '@tiptap/react';
import type { Node as PMNode } from '@tiptap/pm/model';
import { isTauri } from '../services/platform';

/** One block of the projected script, carrying its ProseMirror span.
 *  `type` uses the rewrite module's names ('scene_heading', 'action', …) —
 *  projectScript maps the editor's camelCase node names onto them. */
export interface ScriptElement {
  type: string;
  text: string;
  /** absolute PM position of the node's start (before its opening token) */
  from: number;
  /** absolute PM position just after the node's end token */
  to: number;
}

/** Editor selection, as element indices into the projected array. */
export interface EditorSelection {
  anchorIndex: number;
  focusIndex: number;
}

/**
 * Ceiling on the writer's note, for a character counter in the panel. Also
 * enforced in Rust, since the command is callable without the panel.
 */
export const MAX_WRITER_NOTE = 300;

export interface RewriteRequest {
  selection: string;
  sceneHeading?: string;
  preceding: string[];
  following: string[];
  characters: string[];
  /** Most recent dialogue beat before the selection, as "NAME: line". */
  precedingDialogue?: string;
  /** True if this location appeared in an earlier scene heading. */
  locationEstablished: boolean;
  /** Names in the selection making their first appearance in the script. */
  firstAppearances: string[];
  /**
   * Optional free-text direction: what the writer is going for in this moment,
   * or what must survive the rewrite. This replaced an enum of preset steers
   * (third handoff drop), which only asked the model to do what the craft
   * rules already require.
   *
   * Named writerNote rather than note to avoid colliding with
   * RewriteVariant.note, which travels in the opposite direction.
   */
  writerNote?: string;
}

/**
 * The three variants differ by how much license they take with the writer's
 * shape, not by which craft rule they apply. All three apply all the rules
 * (design revision, second handoff: cut/sharpen/restructure made `sharpen` a
 * deliberate under-application; the writer should never choose between a
 * correct rewrite and a half-correct one).
 */
export type RewriteStrategy = 'faithful' | 'compressed' | 'reimagined';

export interface RewriteVariant {
  strategy: RewriteStrategy;
  text: string;
  /** The model's one-line explanation of what it changed and why. */
  note: string;
}

export interface RewriteResponse {
  /**
   * Log correlation id. Hold this in panel state and pass it to
   * recordRewriteOutcome when the writer resolves the panel, otherwise the
   * suggestion is logged with no outcome and teaches nothing.
   */
  eventId: string;
  assessment: 'improvable' | 'already_strong';
  variants: RewriteVariant[];
}

/**
 * Panel slots. The three strategies come from the model; `custom` is the empty
 * slot the writer fills in, either by typing or by pulling beats out of the
 * other three.
 *
 * Kept distinct from RewriteStrategy so the model-response types stay honest:
 * the API never returns a `custom` variant.
 */
export const CUSTOM_SLOT = 'custom' as const;
export type DraftSlot = RewriteStrategy | typeof CUSTOM_SLOT;

/**
 * How far the writer's text departs from what the model offered.
 *
 * `composed` is its own category rather than a flavour of edit: text in the
 * custom slot was assembled or written by the writer, so there is no single
 * offered version to measure against. It is also the highest-value signal the
 * log collects, since it is entirely in the writer's voice.
 */
export type EditKind =
  | 'none'
  | 'punctuation'
  | 'minor'
  | 'substantive'
  | 'composed';

export interface RewriteOutcome {
  eventId: string;
  outcome: 'accepted' | 'dismissed';
  /** Required when accepted. `"custom"` when the writer used the blank slot. */
  chosenStrategy?: DraftSlot;
  /** The text as it went into the script. */
  finalText?: string;
  editKind?: EditKind;
  /**
   * Which model variants contributed beats to a composed draft. Empty means
   * the writer typed it from scratch. Answers whether the three slots are
   * carving the space usefully.
   */
  composedFrom?: RewriteStrategy[];
}

export interface RewriteLogStats {
  suggestions: number;
  accepted: number;
  dismissed: number;
  /** Accepts the writer changed in any way. */
  editedAfterAccept: number;
  /** Accepts with a substantive edit. */
  editedSubstantive: number;
  /** Accepts taken from the custom slot. */
  composed: number;
  /** How often each variant contributed a beat to a composed draft. */
  contributed: [string, number][];
  byStrategy: [string, number][];
  path: string;
  bytes: number;
}

/** Inclusive element index range that a chosen variant replaces. */
export interface TargetRange {
  start: number;
  end: number;
}

/** The PM range a chosen variant replaces, with the text it held at resolve
 *  time — apply validates against it so a stale range can never be written. */
export interface PmTarget {
  from: number;
  to: number;
  text: string;
}

export type Resolved =
  | {
      ok: true;
      request: RewriteRequest;
      /** element-index range (projection space) */
      target: TargetRange;
      /** the same range in PM positions — highlightable, appliable */
      pmTarget: PmTarget;
      /** how many action paragraphs the target covers */
      paragraphs: number;
      /** True when the resolved range differs from what the user selected. */
      adjusted: boolean;
      adjustedReason?: string;
    }
  | { ok: false; reason: string };

export const SLOT_LABELS: Record<DraftSlot, string> = {
  faithful: 'Faithful',
  compressed: 'Compressed',
  reimagined: 'Reimagined',
  custom: 'Yours',
};

export const SLOT_BLURBS: Record<DraftSlot, string> = {
  faithful: 'Your beats, your order, cleaned up',
  compressed: 'The same moment in the fewest words',
  reimagined: 'Reshaped, reordered, same facts',
  custom: 'Pull lines from the others, or write it yourself',
};

/** Display order: least license first, the writer's own slot last. */
export const SLOT_ORDER: DraftSlot[] = [
  'faithful',
  'compressed',
  'reimagined',
  'custom',
];

/** Retained for compatibility with earlier call sites. */
export const STRATEGY_LABELS = SLOT_LABELS;
export const STRATEGY_BLURBS = SLOT_BLURBS;

/** Neighbouring action paragraphs sent as context on each side. */
const CONTEXT_WINDOW = 3;

/** How far back to look for a dialogue beat the action might be reacting to. */
const DIALOGUE_LOOKBACK = 3;

// ---------------------------------------------------------------------------
// Projection: TipTap doc → flat elements with PM spans
// ---------------------------------------------------------------------------

/** Editor node name → the rewrite module's element type names. Unmapped
 *  names pass through — the helpers only test the five they know. */
const TYPE_MAP: Record<string, string> = { sceneHeading: 'scene_heading' };

/** Nested element kinds worth projecting out of a dualDialogue block —
 *  their cues and lines feed the context helpers like any others. */
const DUAL_CHILD_TYPES = new Set(['character', 'dialogue', 'parenthetical']);

export function projectScript(doc: PMNode): ScriptElement[] {
  const out: ScriptElement[] = [];
  doc.forEach((child, offset) => {
    if (child.type.name === 'dualDialogue') {
      child.descendants((node, rel) => {
        if (!DUAL_CHILD_TYPES.has(node.type.name)) return true;
        const from = offset + 1 + rel;
        out.push({
          type: node.type.name,
          text: node.textContent,
          from,
          to: from + node.nodeSize,
        });
        return false;
      });
      return;
    }
    out.push({
      type: TYPE_MAP[child.type.name] ?? child.type.name,
      text: child.textContent,
      from: offset,
      to: offset + child.nodeSize,
    });
  });
  return out;
}

/** The projected element a PM position falls in (or the nearest one after a
 *  structural gap, e.g. a dualDialogue wrapper token). */
export function indexForPos(elements: ScriptElement[], pos: number): number {
  for (let i = 0; i < elements.length; i++) {
    if (pos < elements[i].to) return i;
  }
  return elements.length - 1;
}

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

/**
 * Turns an element-index selection into a complete request. Resolves the
 * target range, walks the surrounding script for context, and reports
 * whether the range had to be adjusted. Pure over the projection — the
 * editor entry point below feeds it and adds PM positions.
 *
 * `writerNote` is optional free text. Resolving with an empty note is cheap
 * and safe, so the panel resolves on selection change for enablement, then
 * resolves again with the note when the writer submits.
 */
export function resolveSelection(
  elements: ScriptElement[],
  selection: EditorSelection,
  writerNote = '',
): Resolved {
  const lo = Math.min(selection.anchorIndex, selection.focusIndex);
  const hi = Math.max(selection.anchorIndex, selection.focusIndex);

  if (lo < 0 || hi >= elements.length) {
    return { ok: false, reason: 'Selection is outside the current script.' };
  }

  const range = resolveActionRange(elements, lo, hi);
  if (!range) {
    return {
      ok: false,
      reason: "Select action lines. This tool doesn't rewrite dialogue.",
    };
  }

  const { start, end, adjusted, adjustedReason } = range;
  const target = elements.slice(start, end + 1);
  const trimmedNote = writerNote.trim().slice(0, MAX_WRITER_NOTE);

  return {
    ok: true,
    target: { start, end },
    pmTarget: {
      from: elements[start].from,
      to: elements[end].to,
      text: target.map((el) => el.text).join('\n\n'),
    },
    paragraphs: end - start + 1,
    adjusted,
    adjustedReason,
    request: {
      selection: target.map((el) => el.text.trim()).join('\n\n'),
      sceneHeading: findSceneHeading(elements, start),
      preceding: nearbyAction(elements, start, 'before'),
      following: nearbyAction(elements, end, 'after'),
      characters: findSceneCharacters(elements, start),
      precedingDialogue: findPrecedingDialogue(elements, start),
      locationEstablished: isLocationEstablished(elements, start),
      firstAppearances: findFirstAppearances(elements, start, target),
      writerNote: trimmedNote || undefined,
    },
  };
}

/** The live entry point: current editor selection → Resolved. Synchronous,
 *  no network — safe on every (debounced) selection change. */
export function resolveEditorSelection(
  editor: Editor,
  writerNote = '',
): Resolved {
  const elements = projectScript(editor.state.doc);
  if (elements.length === 0) {
    return { ok: false, reason: 'The script is empty.' };
  }
  const sel = editor.state.selection;
  const anchorIndex = indexForPos(elements, sel.from);
  const focusIndex = indexForPos(elements, Math.max(sel.from, sel.to - 1));
  return resolveSelection(elements, { anchorIndex, focusIndex }, writerNote);
}

/** True while the doc still holds exactly the text the target was resolved
 *  over. Positions are remapped through edits by the panel; this is the
 *  last-line guard that makes a stale write impossible. */
export function targetIsCurrent(doc: PMNode, target: PmTarget): boolean {
  if (target.from < 0 || target.to > doc.content.size || target.from >= target.to) {
    return false;
  }
  return doc.textBetween(target.from, target.to, '\n\n') === target.text;
}

/** Blank-line-separated variant paragraphs → action nodes for insertion. */
export function buildVariantNodes(
  variantText: string,
): { type: string; content: { type: string; text: string }[] }[] {
  return variantText
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((text) => ({ type: 'action', content: [{ type: 'text', text }] }));
}

/**
 * Replaces the target range with a chosen variant via one transaction —
 * undo/redo come from the editor history. Returns the applied range (the
 * panel retargets onto it so a second variant can replace the first), or
 * null when the doc moved and the write was refused.
 */
export function applyVariantToEditor(
  editor: Editor,
  target: PmTarget,
  variantText: string,
): PmTarget | null {
  if (!targetIsCurrent(editor.state.doc, target)) return null;
  const nodes = buildVariantNodes(variantText);
  if (nodes.length === 0) return null;
  editor
    .chain()
    .focus()
    .insertContentAt({ from: target.from, to: target.to }, nodes)
    .run();
  const size = nodes.reduce((n, node) => n + node.content[0].text.length + 2, 0);
  const to = target.from + size;
  return {
    from: target.from,
    to,
    text: editor.state.doc.textBetween(target.from, to, '\n\n'),
  };
}

/**
 * Applies a draft and reports the outcome in one step, so the log can never
 * drift from what actually landed in the script (the fourth handoff's
 * acceptDraft, on ProseMirror targets).
 *
 * Handles the custom slot: with no offered text to compare against, the edit
 * is classified `composed` and the contributing variants are recorded.
 *
 * Returns the applied range (retargeted, like applyVariantToEditor), or null
 * when the target went stale or the draft is empty.
 */
export function acceptDraftInEditor(
  editor: Editor,
  target: PmTarget,
  eventId: string,
  draft: VariantDraft,
): PmTarget | null {
  const finalText = draft.draft.trim();
  if (!finalText) return null;
  const next = applyVariantToEditor(editor, target, finalText);
  if (!next) return null;
  void recordRewriteOutcome({
    eventId,
    outcome: 'accepted',
    chosenStrategy: draft.slot,
    finalText,
    editKind:
      draft.offered === null ? 'composed' : classifyEdit(draft.offered, finalText),
    composedFrom: draft.offered === null ? draft.composedFrom : undefined,
  });
  return next;
}

// ---------------------------------------------------------------------------
// Editable drafts (fourth handoff drop, logic unchanged)
// ---------------------------------------------------------------------------

/**
 * One slot plus the writer's working copy of it.
 *
 * The panel renders `draft` in an editable field and leaves `offered` alone.
 * Both are needed at apply time: `draft` goes into the script, and the pair is
 * what classifyEdit measures. `offered` is null for the custom slot, which has
 * nothing to compare against.
 */
export interface VariantDraft {
  slot: DraftSlot;
  /** Exactly what the model returned. Null for the custom slot. */
  offered: string | null;
  /** The writer's editable working copy. */
  draft: string;
  /** The model's craft note. Empty for the custom slot. */
  note: string;
  /** Variants that contributed beats, for the custom slot only. */
  composedFrom: RewriteStrategy[];
}

/** Initializes drafts from a response, plus an empty custom slot. */
export function prepareDrafts(response: RewriteResponse): VariantDraft[] {
  const fromModel: VariantDraft[] = response.variants.map((v) => ({
    slot: v.strategy,
    offered: v.text,
    draft: v.text,
    note: v.note,
    composedFrom: [],
  }));
  return [
    ...fromModel,
    { slot: CUSTOM_SLOT, offered: null, draft: '', note: '', composedFrom: [] },
  ];
}

/** Immutable draft update, for use in React state. */
export function updateDraft(
  drafts: VariantDraft[],
  slot: DraftSlot,
  draft: string,
): VariantDraft[] {
  return drafts.map((d) => (d.slot === slot ? { ...d, draft } : d));
}

/**
 * Discards the writer's changes to a slot. Clears the custom slot entirely,
 * including its composition history.
 */
export function revertDraft(
  drafts: VariantDraft[],
  slot: DraftSlot,
): VariantDraft[] {
  return drafts.map((d) => {
    if (d.slot !== slot) return d;
    return d.offered === null
      ? { ...d, draft: '', composedFrom: [] }
      : { ...d, draft: d.offered };
  });
}

export function isDirty(d: VariantDraft): boolean {
  if (d.offered === null) return d.draft.trim().length > 0;
  return normalizeWhitespace(d.draft) !== normalizeWhitespace(d.offered);
}

export function findDraft(
  drafts: VariantDraft[],
  slot: DraftSlot,
): VariantDraft | undefined {
  return drafts.find((d) => d.slot === slot);
}

// ---------------------------------------------------------------------------
// Composing the custom slot
// ---------------------------------------------------------------------------

/**
 * A single sentence-level beat from one of the suggestions, so the panel can
 * offer it as something to pull into the custom slot. Sentence granularity is
 * deliberate: in this form a beat is usually a sentence, which is the unit a
 * writer actually wants to borrow.
 */
export interface Beat {
  id: string;
  slot: DraftSlot;
  /** Index of the paragraph this beat came from. */
  paragraph: number;
  text: string;
}

/**
 * Splits a slot's text into beats. Sentence splitting is naive on purpose: it
 * breaks after . ! ? followed by whitespace. Action prose rarely contains
 * abbreviations, and a mis-split beat is a cosmetic annoyance the writer can
 * fix in the field, not a correctness problem.
 */
export function extractBeats(draft: VariantDraft): Beat[] {
  const source = draft.offered ?? draft.draft;
  const beats: Beat[] = [];
  source
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .forEach((para, pIndex) => {
      para
        .split(/(?<=[.!?])\s+/)
        .map((sentence) => sentence.trim())
        .filter(Boolean)
        .forEach((text, sIndex) => {
          beats.push({
            id: `${draft.slot}-${pIndex}-${sIndex}`,
            slot: draft.slot,
            paragraph: pIndex,
            text,
          });
        });
    });
  return beats;
}

/** All beats across the model's suggestions, for a pick list. */
export function allBeats(drafts: VariantDraft[]): Beat[] {
  return drafts
    .filter((d) => d.slot !== CUSTOM_SLOT)
    .flatMap((d) => extractBeats(d));
}

/**
 * Appends a beat to the custom slot, joined with a space so it continues the
 * current paragraph. Records which variant it came from.
 */
export function appendBeatToCustom(
  drafts: VariantDraft[],
  beat: Beat,
): VariantDraft[] {
  return drafts.map((d) => {
    if (d.slot !== CUSTOM_SLOT) return d;
    // A trailing blank line is an intentional paragraph break from
    // appendParagraphBreak, so it must survive. Only horizontal whitespace is
    // trimmed in that case.
    const endsWithBreak = /\n[ \t]*\n[ \t]*$/.test(d.draft);
    const existing = endsWithBreak
      ? d.draft.replace(/[ \t]+$/, '')
      : d.draft.replace(/\s+$/, '');
    let joined: string;
    if (!existing.trim()) joined = beat.text;
    else if (endsWithBreak) joined = `${existing}${beat.text}`;
    else joined = `${existing} ${beat.text}`;
    const from = new Set(d.composedFrom);
    if (beat.slot !== CUSTOM_SLOT) from.add(beat.slot as RewriteStrategy);
    return { ...d, draft: joined, composedFrom: [...from] };
  });
}

/** Starts a new paragraph in the custom slot. */
export function appendParagraphBreak(drafts: VariantDraft[]): VariantDraft[] {
  return drafts.map((d) => {
    if (d.slot !== CUSTOM_SLOT) return d;
    if (!d.draft.trim()) return d;
    return { ...d, draft: `${d.draft.replace(/\s+$/, '')}\n\n` };
  });
}

/**
 * Fills the custom slot from a starting point: the original passage, or any
 * suggestion. Overwrites whatever is there. The slot starts genuinely empty,
 * but starting from scratch on every rewrite is friction — this makes "start
 * from the original and borrow a line" one click.
 */
export function seedCustom(
  drafts: VariantDraft[],
  source: DraftSlot | 'original',
  originalText: string,
): VariantDraft[] {
  let text = '';
  let from: RewriteStrategy[] = [];
  if (source === 'original') {
    text = originalText.trim();
  } else {
    const src = findDraft(drafts, source);
    if (!src) return drafts;
    text = (src.offered ?? src.draft).trim();
    if (source !== CUSTOM_SLOT) from = [source];
  }
  return drafts.map((d) =>
    d.slot === CUSTOM_SLOT ? { ...d, draft: text, composedFrom: from } : d,
  );
}

// ---------------------------------------------------------------------------
// Edit classification
// ---------------------------------------------------------------------------

function normalizeWhitespace(s: string): string {
  return s.trim().replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');
}

function words(s: string): string[] {
  return s.trim().split(/\s+/).filter(Boolean);
}

/** Longest common subsequence length over token arrays. */
function lcsLength(a: string[], b: string[]): number {
  // Action passages are short. Cap defensively so a pathological paste can't
  // stall the UI thread.
  const CAP = 400;
  const x = a.slice(0, CAP);
  const y = b.slice(0, CAP);
  let prev = new Array(y.length + 1).fill(0);
  let cur = new Array(y.length + 1).fill(0);
  for (let i = 1; i <= x.length; i++) {
    for (let j = 1; j <= y.length; j++) {
      cur[j] =
        x[i - 1] === y[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    }
    [prev, cur] = [cur, prev];
    cur.fill(0);
  }
  return prev[y.length];
}

/**
 * Measures how far an edited draft departs from what the model offered.
 *
 * "punctuation" means only punctuation, casing, or whitespace changed. Those
 * are real preferences worth applying but they teach nothing, so the harvester
 * demotes them.
 */
export function classifyEdit(offered: string, edited: string): EditKind {
  const a = normalizeWhitespace(offered);
  const b = normalizeWhitespace(edited);
  if (a === b) return 'none';

  const strip = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  if (strip(a) === strip(b)) return 'punctuation';

  const wa = words(a);
  const wb = words(b);
  const common = lcsLength(wa, wb);
  const changed = Math.max(wa.length, wb.length) - common;
  const ratio = wb.length / Math.max(1, wa.length);

  if (changed <= 2 && ratio >= 0.85 && ratio <= 1.15) return 'minor';
  return 'substantive';
}

export const EDIT_KIND_LABELS: Record<EditKind, string> = {
  none: 'Unchanged',
  punctuation: 'Punctuation only',
  minor: 'Lightly edited',
  substantive: 'Rewritten',
  composed: 'Yours',
};

// ---------------------------------------------------------------------------
// Craft linter
// ---------------------------------------------------------------------------

export interface LintWarning {
  rule: string;
  message: string;
}

/** Approximate characters per line of action at standard screenplay margins. */
const CHARS_PER_LINE = 58;
const MAX_PARAGRAPH_LINES = 4;

/**
 * Checks text against the craft rules the system prompt enforces.
 *
 * The model's output is bound by those rules; a writer's hand edit is not, and
 * a draft assembled from beats can end up repetitive or over-capped even when
 * every part was clean. This closes that gap with no API call.
 *
 * Advisory only. Never block applying: the writer outranks the linter, and
 * this exists to catch slips, not to argue.
 */
export function lintActionText(text: string): LintWarning[] {
  const out: LintWarning[] = [];
  const t = text.trim();
  if (!t) return out;

  if (/[—–]|(?<!-)--(?!-)/.test(t)) {
    out.push({
      rule: 'no-em-dash',
      message: 'Em dash. Use a period, comma, or colon.',
    });
  }

  if (/\bwe\s+(see|hear|find|watch|notice)\b/i.test(t)) {
    out.push({
      rule: 'no-we-see',
      message: 'Cut "we see" or "we hear" and describe the thing.',
    });
  }

  const camera =
    /\b(CU|ECU|WS|MS|POV|ZOOM|PAN|DOLLY|CRANE|TRACKING|ANGLE ON|PUSH IN|PULL BACK|SMASH CUT)\b|the camera/i;
  if (camera.test(t)) {
    out.push({
      rule: 'no-camera',
      message: 'Camera direction. Describe the action instead.',
    });
  }

  if (
    /\b(remembers?|wonders?|realizes?|realises?|feels?|thinks?|knows?|hopes?|wants?|decides?)\b/i.test(
      t,
    )
  ) {
    out.push({
      rule: 'external-only',
      message: 'Reads as internal. Show it as behavior.',
    });
  }

  if (/\b(begins?|starts?|proceeds?)\s+to\b/i.test(t)) {
    out.push({
      rule: 'strong-verbs',
      message: '"Begins to" weakens the verb. Just do it.',
    });
  }

  if (/\b(is|are|was|were)\s+\w+ing\b/i.test(t)) {
    out.push({
      rule: 'strong-verbs',
      message: 'Progressive tense. A single active verb is stronger.',
    });
  }

  for (const para of t.split(/\n\s*\n/)) {
    const lines = Math.ceil(para.trim().length / CHARS_PER_LINE);
    if (lines > MAX_PARAGRAPH_LINES) {
      out.push({
        rule: 'short-paragraphs',
        message: `A paragraph runs about ${lines} lines. Break at ${MAX_PARAGRAPH_LINES}.`,
      });
      break;
    }
  }

  const capRuns = t.match(/\b[A-Z][A-Z' ]{3,}\b/g) || [];
  const meaningful = capRuns.filter((c) => c.trim().length > 3);
  if (meaningful.length > 2) {
    out.push({
      rule: 'caps-scalpel',
      message: `${meaningful.length} capped phrases. Emphasis flattens past one or two.`,
    });
  }

  // Assembling beats from different variants can duplicate an image that read
  // fine in isolation. Cheap check, and the failure is easy to miss by eye.
  const sentences = t
    .split(/(?<=[.!?])\s+/)
    .map((x) => x.trim().toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ''))
    .filter((x) => x.split(/\s+/).length >= 3);
  const seen = new Set<string>();
  for (const sentence of sentences) {
    if (seen.has(sentence)) {
      out.push({ rule: 'no-repeats', message: 'A beat appears twice. Cut one.' });
      break;
    }
    seen.add(sentence);
  }

  return out;
}

// ---------------------------------------------------------------------------
// Range resolution (handoff logic, unchanged)
// ---------------------------------------------------------------------------

interface ActionRange extends TargetRange {
  adjusted: boolean;
  adjustedReason?: string;
}

/**
 * Snaps the selection to whole action elements.
 *
 * Action paragraphs are the unit of rewriting — a variant has to be a
 * droppable replacement for something, and half a paragraph isn't. So a
 * single-element selection covers that whole paragraph, and a selection that
 * runs into dialogue clamps to the contiguous action run it started in.
 */
function resolveActionRange(
  elements: ScriptElement[],
  lo: number,
  hi: number,
): ActionRange | null {
  let first = -1;
  for (let i = lo; i <= hi; i++) {
    if (elements[i].type === 'action') {
      first = i;
      break;
    }
  }
  if (first === -1) return null;

  // Extend across the contiguous action run, but only within the selection.
  let start = first;
  let end = first;
  while (start - 1 >= lo && elements[start - 1].type === 'action') start--;
  while (end + 1 <= hi && elements[end + 1].type === 'action') end++;

  const clampedNonAction = start > lo || end < hi;

  return {
    start,
    end,
    adjusted: clampedNonAction,
    adjustedReason: clampedNonAction
      ? 'Trimmed to the action lines in your selection.'
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// Context extraction (handoff logic, unchanged)
// ---------------------------------------------------------------------------

function sceneStartIndex(elements: ScriptElement[], index: number): number {
  for (let i = Math.min(index, elements.length - 1); i >= 0; i--) {
    if (elements[i].type === 'scene_heading') return i;
  }
  return 0;
}

function findSceneHeading(
  elements: ScriptElement[],
  index: number,
): string | undefined {
  const i = sceneStartIndex(elements, index);
  return elements[i]?.type === 'scene_heading'
    ? elements[i].text.trim()
    : undefined;
}

/**
 * Action paragraphs adjacent to the target, stopping at the scene boundary —
 * description from a different scene is noise, not context.
 */
function nearbyAction(
  elements: ScriptElement[],
  index: number,
  direction: 'before' | 'after',
): string[] {
  const out: string[] = [];
  const step = direction === 'before' ? -1 : 1;

  for (
    let i = index + step;
    i >= 0 && i < elements.length && out.length < CONTEXT_WINDOW;
    i += step
  ) {
    if (elements[i].type === 'scene_heading') break;
    if (elements[i].type !== 'action') continue;
    const text = elements[i].text.trim();
    if (text) out.push(text);
  }

  return direction === 'before' ? out.reverse() : out;
}

/** Character cues from the top of the current scene up to the target. */
function findSceneCharacters(
  elements: ScriptElement[],
  index: number,
): string[] {
  const names = new Set<string>();
  for (const el of elements.slice(sceneStartIndex(elements, index), index)) {
    if (el.type !== 'character') continue;
    const name = cueName(el.text);
    if (name) names.add(name);
  }
  return [...names];
}

/** "SARAH (V.O.)" -> "SARAH" */
function cueName(text: string): string {
  return text.replace(/\s*\(.*?\)\s*$/g, '').trim();
}

/**
 * The line the action may be reacting to. A beat that follows dialogue reads
 * completely differently from one that opens a scene, and without this the
 * model tends to restate what was just said.
 */
function findPrecedingDialogue(
  elements: ScriptElement[],
  index: number,
): string | undefined {
  const floor = Math.max(0, index - DIALOGUE_LOOKBACK);

  for (let i = index - 1; i >= floor; i--) {
    if (elements[i].type === 'scene_heading') return undefined;
    if (elements[i].type !== 'dialogue') continue;

    let speaker = '';
    for (let j = i - 1; j >= 0 && j >= i - 3; j--) {
      if (elements[j].type === 'character') {
        speaker = cueName(elements[j].text);
        break;
      }
    }
    const line = elements[i].text.trim();
    return speaker ? `${speaker}: ${line}` : line;
  }

  return undefined;
}

/** Location key: "INT. PRISON CELL - NIGHT" -> "int. prison cell" */
function locationKey(heading: string): string {
  return heading
    .trim()
    .replace(/\s*[-–—]\s*[^-–—]*$/, '')
    .toLowerCase();
}

/**
 * If we've been here before, the writer shouldn't be re-establishing the
 * space — this is the single most common source of bloated action.
 */
function isLocationEstablished(
  elements: ScriptElement[],
  index: number,
): boolean {
  const start = sceneStartIndex(elements, index);
  const current = elements[start];
  if (current?.type !== 'scene_heading') return false;

  const key = locationKey(current.text);
  if (!key) return false;

  return elements
    .slice(0, start)
    .some((el) => el.type === 'scene_heading' && locationKey(el.text) === key);
}

/**
 * Names in the target appearing for the first time in the script. Drives
 * whether an intro should be capped — the model otherwise strips legitimate
 * introductions or caps names that were established forty pages ago.
 *
 * Scans the whole script; called on panel action, not per keystroke.
 */
function findFirstAppearances(
  elements: ScriptElement[],
  index: number,
  target: ScriptElement[],
): string[] {
  const cast = new Set<string>();
  for (const el of elements) {
    if (el.type !== 'character') continue;
    const name = cueName(el.text);
    if (name) cast.add(name);
  }
  if (cast.size === 0) return [];

  const targetText = target.map((el) => el.text).join('\n');
  const priorText = elements
    .slice(0, index)
    .map((el) => el.text)
    .join('\n');

  const firsts: string[] = [];
  for (const name of cast) {
    const pattern = new RegExp(
      `\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
      'i',
    );
    if (pattern.test(targetText) && !pattern.test(priorText)) {
      firsts.push(name);
    }
  }
  return firsts;
}

// ---------------------------------------------------------------------------
// Commands (Tauri bridge — the key and the API call stay Rust-side)
// ---------------------------------------------------------------------------

const DESKTOP_ONLY =
  'AI rewrites run in the desktop app — this build has no rewrite engine.';

async function invokeCmd<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) throw new Error(DESKTOP_ONLY);
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args);
}

export async function rewriteActionLines(
  req: RewriteRequest,
): Promise<RewriteResponse> {
  return invokeCmd<RewriteResponse>('rewrite_action_lines', { req });
}

/**
 * Records what the writer did. Fire and forget: a logging failure (or a
 * browser build with no Tauri at all) must never surface as an error in the
 * writing flow.
 */
export async function recordRewriteOutcome(
  outcome: RewriteOutcome,
): Promise<void> {
  try {
    await invokeCmd('record_rewrite_outcome', { outcome });
  } catch (e) {
    console.warn('rewrite outcome not logged:', e);
  }
}

export async function rewriteLogStats(): Promise<RewriteLogStats> {
  return invokeCmd<RewriteLogStats>('rewrite_log_stats');
}

export async function rewriteLogPath(): Promise<string> {
  return invokeCmd<string>('rewrite_log_path');
}

export async function clearRewriteLog(): Promise<void> {
  return invokeCmd('clear_rewrite_log');
}

export async function saveApiKey(key: string): Promise<void> {
  return invokeCmd('save_api_key', { key });
}

export async function hasApiKey(): Promise<boolean> {
  if (!isTauri()) return false;
  return invokeCmd<boolean>('has_api_key');
}

export async function clearApiKey(): Promise<void> {
  return invokeCmd('clear_api_key');
}
