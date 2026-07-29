/**
 * v5.25: Markups — the shared creation/lookup logic every entry point uses
 * (ribbon button, context menu, tool-window button), modeled on
 * scriptNoteActions so the two systems age the same way.
 */
import type { Editor } from '@tiptap/react';
import { useEditorStore } from '../stores/editorStore';
import type { MarkupKind, ScriptMarkup } from '../stores/slices/markupsSlice';
import { uuid } from './uuid';

/** Create a markup at the current selection (range → mark; cursor → atom),
 *  register it in the store, and open its popover. Returns the id. */
export function createMarkupAtSelection(editor: Editor): string {
  const store = useEditorStore.getState();
  const { from, to, empty } = editor.state.selection;
  const id = uuid();
  const presets = store.markupPresets;
  const preset = presets[0] ?? { icon: 'flag', color: '#e05555' };

  if (empty) {
    const node = editor.state.schema.nodes.markupAnchor.create({ markupId: id });
    editor.view.dispatch(editor.state.tr.insert(from, node));
  } else {
    const markType = editor.state.schema.marks.scriptMarkup;
    editor.view.dispatch(editor.state.tr.addMark(from, to, markType.create({ markupId: id, highlight: null })));
  }

  const markup: ScriptMarkup = {
    id,
    content: null,
    icon: preset.icon,
    color: preset.color,
    highlight: null,
    anchor: empty ? 'point' : 'range',
    done: false,
    createdAt: new Date().toISOString(),
  };
  store.addMarkup(markup);
  store.setMarkupEditorId(id);
  // mark the doc dirty so autosave persists the anchor + _markups together
  editor.emit('update', { editor, transaction: editor.state.tr });
  return id;
}

/** Find a markup's doc position (mark start or anchor atom pos). */
export function findMarkupPos(editor: Editor, id: string): number | null {
  let found: number | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (found !== null) return false;
    if (node.type.name === 'markupAnchor' && node.attrs.markupId === id) { found = pos; return false; }
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

/** Remove a markup's anchor (mark span or atom) from the doc. */
export function removeMarkupFromDoc(editor: Editor, id: string) {
  const { doc, tr, schema } = editor.state;
  const markType = schema.marks.scriptMarkup;
  const atoms: { pos: number }[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === 'markupAnchor' && node.attrs.markupId === id) atoms.push({ pos });
    if (node.isText && node.marks.some((m) => m.type.name === 'scriptMarkup' && m.attrs.markupId === id)) {
      tr.removeMark(pos, pos + node.nodeSize, markType);
    }
    return true;
  });
  for (const a of atoms.reverse()) tr.delete(a.pos, a.pos + 1);
  if (tr.docChanged || tr.steps.length) editor.view.dispatch(tr);
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
