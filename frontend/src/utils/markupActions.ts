/**
 * v5.25: Markups — the shared creation/lookup logic every entry point uses
 * (ribbon button, context menu, tool-window button), modeled on
 * scriptNoteActions so the two systems age the same way.
 */
import type { Editor } from '@tiptap/react';
import { useEditorStore } from '../stores/editorStore';
import { DEFAULT_MARKUP_HIGHLIGHT, type MarkupKind, type ScriptMarkup } from '../stores/slices/markupsSlice';
import { uuid } from './uuid';

/** Create an annotation at the current selection and open its popover.
 *  A real selection → the scriptMarkup MARK over that range ('range' —
 *  highlight offered). A bare cursor → a BLOCK-ATTRIBUTE anchor on the
 *  current element ('point'), which works on an EMPTY line too — Derek:
 *  "It is not required to highlight text." (A mark can't anchor an empty
 *  element, and an inline node is invalid in this text*-only schema — the
 *  fitter drops it silently.) If the element already carries an annotation,
 *  that one is OPENED instead of stacking a duplicate. Returns the id.
 *  `range` overrides the live selection — the context menu passes its saved
 *  one, because opening the menu steals focus (the script-note model). */
export function createMarkupAtSelection(
  editor: Editor,
  range?: { from: number; to: number; empty: boolean },
): string {
  const store = useEditorStore.getState();
  const sel = range ?? editor.state.selection;
  const { from, to } = sel;
  const empty = sel.empty || !editor.state.doc.textBetween(from, to, ' ').trim();

  const id = uuid();
  const preset = store.markupPresets[0] ?? { icon: 'flag', color: '#e05555' };

  if (empty) {
    const $pos = editor.state.doc.resolve(from);
    const blockPos = $pos.before($pos.depth);
    const block = $pos.parent;
    const existing = block.attrs.markupId as string | null | undefined;
    if (existing && store.markups.some((m) => m.id === existing)) {
      store.setMarkupEditorId(existing);
      return existing;
    }
    editor.view.dispatch(
      editor.state.tr.setNodeMarkup(blockPos, undefined, { ...block.attrs, markupId: id }),
    );
  } else {
    // v5.26, Derek: a selection-made annotation highlights its text in
    // yellow IMMEDIATELY — the window offers "Hide highlights in script"
    // and the color swatch to change it.
    const markType = editor.state.schema.marks.scriptMarkup;
    editor.view.dispatch(editor.state.tr.addMark(
      from, to, markType.create({ markupId: id, highlight: DEFAULT_MARKUP_HIGHLIGHT }),
    ));
  }

  const markup: ScriptMarkup = {
    id,
    content: null,
    icon: preset.icon,
    color: preset.color,
    highlight: empty ? null : DEFAULT_MARKUP_HIGHLIGHT,
    anchor: empty ? 'point' : 'range',
    done: false,
    createdAt: new Date().toISOString(),
    iconManual: false,
  };
  store.addMarkup(markup);
  store.setMarkupEditorId(id);
  // mark the doc dirty so autosave persists the anchor + _markups together
  editor.emit('update', { editor, transaction: editor.state.tr });
  return id;
}

/** Find an annotation's doc position — the start of its marked text, or the
 *  element that carries its block anchor. */
export function findMarkupPos(editor: Editor, id: string): number | null {
  let found: number | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (found !== null) return false;
    if (!node.isText && node.attrs?.markupId === id) { found = pos; return false; }
    if (node.isText && node.marks.some((m) => m.type.name === 'scriptMarkup' && m.attrs.markupId === id)) {
      found = pos;
      return false;
    }
    return true;
  });
  return found;
}

/** Repaint a range markup's highlight color (null clears it) on its mark. */
export function setMarkupHighlight(editor: Editor, id: string, highlight: string | null) {
  const { doc, tr, schema } = editor.state;
  const markType = schema.marks.scriptMarkup;
  let touched = false;
  doc.descendants((node, pos) => {
    if (!node.isText) return true;
    const mark = node.marks.find((m) => m.type.name === 'scriptMarkup' && m.attrs.markupId === id);
    if (mark) {
      tr.removeMark(pos, pos + node.nodeSize, markType);
      tr.addMark(pos, pos + node.nodeSize, markType.create({ markupId: id, highlight }));
      touched = true;
    }
    return true;
  });
  if (touched) editor.view.dispatch(tr);
}

/** Remove an annotation's anchor from the doc — its mark span and/or its
 *  block attribute (the text itself is untouched). */
export function removeMarkupFromDoc(editor: Editor, id: string) {
  const { doc, tr, schema } = editor.state;
  const markType = schema.marks.scriptMarkup;
  doc.descendants((node, pos) => {
    if (!node.isText && node.attrs?.markupId === id) {
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, markupId: null });
    }
    if (node.isText && node.marks.some((m) => m.type.name === 'scriptMarkup' && m.attrs.markupId === id)) {
      tr.removeMark(pos, pos + node.nodeSize, markType);
    }
    return true;
  });
  if (tr.steps.length) editor.view.dispatch(tr);
}

/** The scene heading text preceding a position ('' when none yet). */
export function sceneHeadingBefore(editor: Editor, pos: number): string {
  let heading = '';
  editor.state.doc.nodesBetween(0, Math.min(pos, editor.state.doc.content.size), (node) => {
    if (node.type.name === 'sceneHeading') heading = node.textContent.toUpperCase();
    return true;
  });
  return heading;
}

/** Page number for a doc position, from computePageBlocks output — the
 *  SceneNavigator idiom, shared instead of re-inlined. */
export function pageForPos(
  pageContent: { pageNumber: number; blocks: { docPos: number }[] }[],
  pos: number,
): number {
  let page = 1;
  for (let i = pageContent.length - 1; i >= 0; i--) {
    if (pageContent[i].blocks.length > 0 && pageContent[i].blocks[0].docPos <= pos) {
      page = pageContent[i].pageNumber;
      break;
    }
  }
  return page;
}

/** What a markup's rich content contains — drives the Filter's kinds. */
export function markupKinds(m: ScriptMarkup): MarkupKind[] {
  const kinds = new Set<MarkupKind>();
  const walk = (n: unknown) => {
    if (!n || typeof n !== 'object') return;
    const node = n as { type?: string; text?: string; content?: unknown[]; marks?: { type: string }[] };
    if (node.type === 'bulletList') kinds.add('bullets');
    if (node.type === 'orderedList') kinds.add('numbers');
    if (node.type === 'taskList') kinds.add('checklist');
    if (node.type === 'image') kinds.add('image');
    if (node.marks?.some((mk) => mk.type === 'link')) kinds.add('link');
    if (node.type === 'text' && node.text?.trim()) kinds.add('note');
    node.content?.forEach(walk);
  };
  walk(m.content);
  return [...kinds];
}

/** v5.26, Derek's auto-icon rule: the FIRST top-level item that maps to a
 *  preset icon decides ('note'|'bullets'|'numbers'|'checklist'|'link'|
 *  'image' → AUTO_ICON in markupIcons). A paragraph is 'link' only when ALL
 *  its text sits under link marks — "write a paragraph and then add a link
 *  at the end" stays a note. Empty paragraphs are skipped. Returns the kind
 *  key, or null when nothing decides (caller leaves the icon alone). */
export function firstContentKind(content: unknown): MarkupKind | null {
  const doc = content as { content?: unknown[] } | null;
  if (!doc?.content) return null;
  for (const raw of doc.content) {
    const node = raw as { type?: string; content?: unknown[] };
    if (node.type === 'bulletList') return 'bullets';
    if (node.type === 'orderedList') return 'numbers';
    if (node.type === 'taskList') return 'checklist';
    if (node.type === 'image') return 'image';
    if (node.type === 'paragraph') {
      let text = 0, linked = 0, hasImage = false;
      for (const c of node.content ?? []) {
        const inline = c as { type?: string; text?: string; marks?: { type: string }[] };
        if (inline.type === 'image') hasImage = true;
        if (inline.type === 'text' && inline.text?.trim()) {
          text++;
          if (inline.marks?.some((m) => m.type === 'link')) linked++;
        }
      }
      if (text > 0) return linked === text ? 'link' : 'note';
      if (hasImage) return 'image';
      // empty paragraph — keep looking
    }
  }
  return null;
}

/** v5.30, Derek: the Navigator shows LIST annotations as a list. Lines from
 *  the content, in order: paragraph text as a line; list items as marker-
 *  prefixed lines (• / n. / ☐ ☑). Empty content → []. Capped by callers. */
export function markupContentLines(m: ScriptMarkup): string[] {
  const doc = m.content as { content?: unknown[] } | null;
  if (!doc?.content) return [];
  const lines: string[] = [];
  const textOf = (n: unknown): string => {
    const parts: string[] = [];
    const walk = (x: unknown) => {
      if (!x || typeof x !== 'object') return;
      const node = x as { type?: string; text?: string; content?: unknown[] };
      if (node.type === 'text' && node.text) parts.push(node.text);
      node.content?.forEach(walk);
    };
    walk(n);
    return parts.join(' ').trim();
  };
  for (const raw of doc.content) {
    const node = raw as { type?: string; attrs?: { checked?: boolean }; content?: unknown[] };
    if (node.type === 'paragraph') {
      const t = textOf(node);
      if (t) lines.push(t);
    } else if (node.type === 'bulletList' || node.type === 'orderedList' || node.type === 'taskList') {
      (node.content ?? []).forEach((item, i) => {
        const it = item as { type?: string; attrs?: { checked?: boolean } };
        const t = textOf(item);
        if (!t) return;
        const marker = node.type === 'orderedList' ? `${i + 1}.`
          : node.type === 'taskList' ? (it.attrs?.checked ? '☑' : '☐') : '•';
        lines.push(`${marker} ${t}`);
      });
    }
  }
  return lines;
}

/** Plain-text preview of a markup's content (cards + navigator rows). */
export function markupPreviewText(m: ScriptMarkup): string {
  const parts: string[] = [];
  const walk = (n: unknown) => {
    if (!n || typeof n !== 'object') return;
    const node = n as { type?: string; text?: string; content?: unknown[] };
    if (node.type === 'text' && node.text) parts.push(node.text);
    node.content?.forEach(walk);
  };
  walk(m.content);
  return parts.join(' ').trim();
}
