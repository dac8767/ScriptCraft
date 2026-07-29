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
  assessment: 'improvable' | 'already_strong';
  variants: RewriteVariant[];
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

export const STRATEGY_LABELS: Record<RewriteStrategy, string> = {
  faithful: 'Faithful',
  compressed: 'Compressed',
  reimagined: 'Reimagined',
};

export const STRATEGY_BLURBS: Record<RewriteStrategy, string> = {
  faithful: 'Your beats, your order, cleaned up',
  compressed: 'The same moment in the fewest words',
  reimagined: 'Reshaped, reordered, same facts',
};

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
