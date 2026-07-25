/**
 * scriptNoteActions (v4.33) — the ONE implementation of "make a note on this
 * bit of script" and "find a note's highlight", shared by the toolbar Note
 * button, the context menu's Add Note, and the Navigator. The toolbar and
 * context menu used to carry near-identical private copies of the create
 * flow; they were one palette-retune away from drifting apart.
 */
import type { Editor } from '@tiptap/react';
import { useEditorStore, NOTE_COLORS } from '../stores/editorStore';

/**
 * Create a script note anchored on the given range — or, with no range, on
 * the current selection (the whole current element when the selection is
 * empty). Returns the new note's id, or null when there is no text to anchor
 * to. The caller decides what to do next (usually open the highlight popover).
 */
export function createScriptNoteAtSelection(
  editor: Editor,
  range?: { from: number; to: number },
): string | null {
  const sel = editor.state.selection;
  const $from = sel.$from;
  const empty = range ? range.from === range.to : sel.empty;
  const selFrom = range ? (empty ? $from.start() : range.from) : (empty ? $from.start() : sel.from);
  const selTo = range ? (empty ? $from.end() : range.to) : (empty ? $from.end() : sel.to);
  const text = editor.state.doc.textBetween(selFrom, selTo, ' ');
  if (!text.trim()) return null;

  // Context label: the element's own text, except dialogue lines label
  // themselves with the character speaking them.
  const currentNodeType = $from.parent.type.name;
  const nodeText = $from.parent.textContent.trim();
  let contextLabel = nodeText.slice(0, 60);
  if (currentNodeType === 'character') {
    contextLabel = nodeText.replace(/\s*\([^)]*\)\s*/g, '').trim();
  } else if (currentNodeType === 'sceneHeading') {
    contextLabel = nodeText;
  } else if (currentNodeType === 'dialogue' || currentNodeType === 'parenthetical') {
    let charName = '';
    editor.state.doc.nodesBetween(0, selFrom, (node) => {
      if (node.type.name === 'character') {
        charName = node.textContent.trim().replace(/\s*\([^)]*\)\s*/g, '').trim();
      }
      return true;
    });
    if (charName) contextLabel = charName;
  }

  let sceneId: string | null = null;
  let sceneIdx = 0;
  editor.state.doc.nodesBetween(0, selFrom, (node) => {
    if (node.type.name === 'sceneHeading') { sceneId = `scene-${sceneIdx}`; sceneIdx++; }
    return true;
  });

  const defaultColor = NOTE_COLORS[0];
  const noteId = useEditorStore.getState().addNote({
    content: '',
    anchorText: text.slice(0, 120),
    elementType: currentNodeType,
    contextLabel,
    color: defaultColor.name,
    sceneId,
  });

  const markType = editor.schema.marks.scriptNote;
  if (markType) {
    const { tr } = editor.state;
    tr.addMark(selFrom, selTo, markType.create({ noteId, color: defaultColor.hex }));
    editor.view.dispatch(tr);
    editor.emit('update', { editor, transaction: tr });
  }
  return noteId;
}

/** Doc position of a note's highlight (its scriptNote mark), or null when the
 *  mark is gone (deleted text, stale id). */
export function findNotePos(editor: Editor, noteId: string): number | null {
  const markType = editor.state.schema.marks.scriptNote;
  if (!markType) return null;
  let found: number | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (found !== null) return false;
    if (!node.isText) return true;
    if (node.marks.some((m) => m.type === markType && m.attrs.noteId === noteId)) {
      found = pos;
      return false;
    }
    return true;
  });
  return found;
}
