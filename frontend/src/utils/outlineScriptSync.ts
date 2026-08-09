/**
 * v6.64 → v6.65, Derek — "Send to Script" puts each outline SECTION into the
 * script as a LIVE ANNOTATION.
 *
 *   "the 'send to script' button in the outline toolbar adds the section
 *    header as an annotation at the indicated page location. if section info
 *    changes, such as the name or the estimated page amount, the change
 *    should be indicated in the annotation as well"
 *   …then, on seeing v6.64: "it adds them to the script in the old section
 *    format instead of as an annotation like I requested"
 *
 * v6.64 read "annotation" as the `# …` section LINE. It meant the app's
 * Annotations (markupsSlice): a record in the store, anchored in the script
 * by the element's markupId block attribute. So a sent section is now a real
 * annotation, and the mirror is a plain store write — its text lives in the
 * annotation's content, not in the script's text, so keeping it current
 * never touches the document at all.
 *
 * Two rules the mirror does NOT break:
 *   • It never deletes the writer's work. A section deleted in the outline
 *     leaves its annotation exactly as it stands.
 *   • It never edits the script to stay current — only the annotation's own
 *     content, which is what the Annotations window shows.
 */
import type { Editor } from '@tiptap/react';
import { useEditorStore } from '../stores/editorStore';
import type { ScriptMarkup } from '../stores/slices/markupsSlice';
import { uuid } from './uuid';

/** Sent sections wear the shipped hashtag preset, so an annotation that
 *  maintains itself is recognisable among hand-made ones. */
const SECTION_ICON = 'hashtag';
const SECTION_COLOR = '#4a9eff';

/** A section as the mirror needs it. */
export interface OutlineSectionInfo {
  id: string;
  title: string;
  /** The section's page budget (BeatColumn.targetPages). */
  pages: number;
  /** The page the outline puts it on — where the annotation is anchored. */
  page?: number;
}

/** THE text a section's annotation carries. One builder, so what Send
 *  writes and what the mirror rewrites can never disagree. */
export function sectionAnnotationText(title: string, pages: number): string {
  const name = title.trim() || 'Untitled Section';
  const n = Math.max(1, Math.round(pages || 1));
  return `${name} — ${n} page${n === 1 ? '' : 's'}`;
}

/** That text as annotation content (the popover's mini-editor JSON). */
export function sectionAnnotationContent(title: string, pages: number): unknown {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: sectionAnnotationText(title, pages) }] }],
  };
}

/** The plain text of an annotation's first line — how the mirror decides
 *  whether anything actually needs rewriting. */
export function annotationFirstLine(content: unknown): string {
  const parts: string[] = [];
  const walk = (x: unknown) => {
    if (!x || typeof x !== 'object') return;
    const n = x as { type?: string; text?: string; content?: unknown[] };
    if (n.type === 'text' && n.text) parts.push(n.text);
    n.content?.forEach(walk);
  };
  walk(content);
  return parts.join('').trim();
}

/** Every section across EVERY outline variation, keyed by id — the viewed
 *  tab's live columns plus the parked ones. An annotation sent from one
 *  variation must keep mirroring after the writer switches to another. */
export function collectOutlineSections(
  beatColumns: Array<{ id: string; title: string; targetPages?: number }>,
  outlineStash: Record<string, { columns: Array<{ id: string; title: string; targetPages?: number }> }>,
): Map<string, OutlineSectionInfo> {
  const out = new Map<string, OutlineSectionInfo>();
  const add = (c: { id: string; title: string; targetPages?: number }) =>
    out.set(c.id, { id: c.id, title: c.title, pages: Math.max(1, Math.round(c.targetPages ?? 1)) });
  for (const tab of Object.values(outlineStash ?? {})) for (const c of tab?.columns ?? []) add(c);
  for (const c of beatColumns ?? []) add(c);        // viewed tab wins
  return out;
}

/** A compact stamp of everything the mirror cares about. Anything else about
 *  a section — its width, its order, its beats — must not wake the mirror,
 *  or a column-resize drag would rewrite annotations on every pointer move. */
export function outlineSectionSignature(sections: Map<string, OutlineSectionInfo>): string {
  return [...sections.values()]
    .map((s) => `${s.id} ${s.title} ${s.pages}`)
    .sort()
    .join('');
}

/** Rewrite every sent annotation whose text has fallen behind its section.
 *  Store-only — the script itself is never touched. Returns how many
 *  changed. */
export function syncSectionAnnotations(sections: Map<string, OutlineSectionInfo>): number {
  const st = useEditorStore.getState();
  let changed = 0;
  for (const m of st.markups) {
    const sec = m.outlineSectionId ? sections.get(m.outlineSectionId) : undefined;
    if (!sec) continue;                             // section gone — it stays
    const want = sectionAnnotationText(sec.title, sec.pages);
    if (annotationFirstLine(m.content) === want) continue;
    st.updateMarkup(m.id, { content: sectionAnnotationContent(sec.title, sec.pages) });
    changed++;
  }
  return changed;
}

/** Every element that can host a cursor-made annotation — the same list
 *  ScriptMarkup's block anchor allows. */
const ANNOTATABLE = new Set([
  'sceneHeading', 'action', 'character', 'dialogue', 'parenthetical',
  'transition', 'shot', 'general', 'lyrics', 'newAct', 'endOfAct',
  'showEpisode', 'castList', 'customElement',
]);

/** The first annotatable top-level element at or after `at` that isn't
 *  already carrying an anchor. Two sections can resolve to the same spot
 *  (pages the script hasn't reached yet), and one element can only hold one
 *  markupId — without this the second section would silently evict the
 *  first. `live` is the set of annotation ids that still EXIST: an element
 *  left stamped with a deleted annotation's id is free, not occupied for
 *  ever. Returns null when the script has nowhere left to put it. */
export function freeAnchorPos(editor: Editor, at: number, taken: Set<number>, live: Set<string>): number | null {
  const doc = editor.state.doc;
  let first: number | null = null;
  let after: number | null = null;
  doc.forEach((node, pos) => {
    const held = node.attrs?.markupId as string | null;
    if (!ANNOTATABLE.has(node.type.name) || (held && live.has(held)) || taken.has(pos)) return;
    if (first === null) first = pos;
    if (after === null && pos >= at) after = pos;
  });
  return after ?? first;
}

/** Send sections to the script as annotations: update the ones already
 *  there, anchor the ones that aren't. Pressing the button twice can't
 *  duplicate an annotation. `posForPage` maps an outline page to a document
 *  position (the Outline Bar already computes the script's page ranges). */
export function sendSectionsToScript(
  editor: Editor | null,
  sections: OutlineSectionInfo[],
  posForPage: (page: number) => number | null,
): { added: number; updated: number; skipped: number } {
  if (!editor || editor.isDestroyed) return { added: 0, updated: 0, skipped: 0 };
  const st = useEditorStore.getState();
  const updated = syncSectionAnnotations(new Map(sections.map((s) => [s.id, s])));

  const already = new Set(st.markups.map((m) => m.outlineSectionId).filter(Boolean));
  const missing = sections.filter((s) => !already.has(s.id));
  if (!missing.length) return { added: 0, updated, skipped: 0 };

  const tr = editor.state.tr;
  const taken = new Set<number>();
  const live = new Set(st.markups.map((m) => m.id));
  const made: ScriptMarkup[] = [];
  for (const sec of missing) {
    const want = (sec.page != null ? posForPage(sec.page) : null) ?? editor.state.doc.content.size;
    const at = freeAnchorPos(editor, want, taken, live);
    if (at === null) continue;                      // no element left to hold it
    taken.add(at);
    const node = editor.state.doc.nodeAt(at);
    if (!node) continue;
    const id = uuid();
    tr.setNodeMarkup(at, undefined, { ...node.attrs, markupId: id });
    made.push({
      id,
      content: sectionAnnotationContent(sec.title, sec.pages),
      icon: SECTION_ICON,
      color: SECTION_COLOR,
      highlight: null,                              // a point anchor paints nothing
      anchor: 'point',
      done: false,
      createdAt: new Date().toISOString(),
      iconManual: true,                             // never auto-swapped
      outlineSectionId: sec.id,
    });
  }
  if (tr.steps.length) editor.view.dispatch(tr);
  for (const m of made) st.addMarkup(m);
  // mark the doc dirty so autosave persists the anchors + _markups together
  if (made.length) editor.emit('update', { editor, transaction: editor.state.tr });
  return { added: made.length, updated, skipped: missing.length - made.length };
}

/** v6.65: clear the `# Section — n pages` lines v6.64 wrote. They were the
 *  app's own insert (the stamp proves it — the writer can't type one), and
 *  they are being replaced by the annotation, so leaving them would show
 *  every section twice. Nothing unstamped is ever touched. */
export function clearLegacySectionLines(editor: Editor | null): number {
  if (!editor || editor.isDestroyed) return 0;
  const hits: Array<{ pos: number; size: number }> = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'general' && node.attrs.outlineSectionId) hits.push({ pos, size: node.nodeSize });
    return false;
  });
  if (!hits.length) return 0;
  const tr = editor.state.tr;
  // bottom-up, so each delete leaves the earlier positions valid
  for (const h of hits.reverse()) tr.delete(h.pos, h.pos + h.size);
  editor.view.dispatch(tr);
  return hits.length;
}
