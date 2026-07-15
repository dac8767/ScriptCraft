/**
 * TypewriterScroll (v1.68) — the scrolling half of the Typewriter tool.
 *
 * While enabled, every doc-changing transaction re-centers the caret's line
 * in the editor's scroll container, so the line you're typing on stays put
 * and the page moves under it. Clicking around the script does NOT recenter
 * (only typing does) — jumping the view on every click would fight normal
 * navigation.
 *
 * The scroll container is found by walking up from the editor DOM to the
 * first scrollable ancestor, so this works in page and continuous view and
 * survives layout changes. coordsAtPos returns viewport coordinates, which
 * are post-zoom-transform, so the math holds at any zoom level.
 */
import { Extension } from '@tiptap/core';
import type { Editor } from '@tiptap/core';
import { useEditorStore } from '../../stores/editorStore';

/** How far scrollTop must move to bring the caret to the container's center.
 *  Positive = caret is below center, scroll down. Exported for the test. */
export function typewriterScrollDelta(
  caretTop: number,
  containerTop: number,
  containerHeight: number,
): number {
  return caretTop - (containerTop + containerHeight / 2);
}

function scrollParentOf(el: HTMLElement | null): HTMLElement | null {
  for (let node = el; node; node = node.parentElement) {
    if (node.scrollHeight > node.clientHeight) {
      const overflowY = getComputedStyle(node).overflowY;
      if (overflowY === 'auto' || overflowY === 'scroll') return node;
    }
  }
  return null;
}

/** Center the caret's line in the scroll container (used on typing and by
 *  the tool when the mode is switched on). */
export function centerCaretLine(editor: Editor): void {
  if (editor.isDestroyed) return;
  const { view } = editor;
  let coords: { top: number };
  try {
    coords = view.coordsAtPos(view.state.selection.head);
  } catch {
    return; // position transiently invalid mid-edit
  }
  const scroller = scrollParentOf(view.dom as HTMLElement);
  if (!scroller) return;
  const rect = scroller.getBoundingClientRect();
  const delta = typewriterScrollDelta(coords.top, rect.top, rect.height);
  if (Math.abs(delta) < 2) return;  // already centered — don't jitter
  scroller.scrollTop += delta;
}

export const TypewriterScroll = Extension.create({
  name: 'typewriterScroll',

  onTransaction({ editor, transaction }) {
    const store = useEditorStore.getState();
    if (!store.typewriterEnabled) return;
    // Typing always recenters. With follow-cursor on (v1.70), so does any
    // caret MOVE (click, arrow keys) — but never while a RANGE is being
    // selected: recentering mid-drag would move the text under the mouse
    // and mangle the selection.
    const follow = store.typewriterFollowCursor
      && transaction.selectionSet
      && editor.state.selection.empty;
    if (!transaction.docChanged && !follow) return;
    // After the DOM has painted the new content, so the caret coords are real.
    requestAnimationFrame(() => centerCaretLine(editor));
  },
});

export default TypewriterScroll;
