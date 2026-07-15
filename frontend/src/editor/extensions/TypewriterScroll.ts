/**
 * TypewriterScroll (v1.68, expanded v1.72) — the engine behind the Typewriter
 * tool. v1.72 ports the feature set of davisriedel/obsidian-typewriter-mode
 * (MIT, CodeMirror 6) to this app's ProseMirror editor. CM6 view-plugin code
 * can't run against ProseMirror, so this is a faithful reimplementation of its
 * behaviors rather than a copy: the typewriter offset + sizer padding + "only
 * maintain once reached" logic mirrors their typewriter-offset-calculator and
 * setPadding; the current-line element mirrors their ptm-current-line div;
 * paragraph dimming mirrors their dim-unfocused "paragraphs" mode (default
 * dimmed opacity 0.25, same as theirs).
 *
 * Behaviors:
 * - Typewriter scrolling: on typing (and optionally any caret move), the
 *   caret's line is pinned at a configurable fraction of the viewport
 *   (typewriterOffset, default 0.5 = center).
 * - Sizer padding: while scrolling is on, .page-sizer gets vertical padding
 *   of (viewport × offset) so the FIRST and LAST lines of the script can
 *   actually reach the typewriter line. With "only once reached" on, only
 *   the bottom is padded — the top of the doc scrolls naturally until the
 *   caret first arrives at the line (their
 *   isOnlyMaintainTypewriterOffsetWhenReached).
 * - Current-line highlight: a bar in the scroller tracking the caret's line.
 * - Dim others: every top-level element except the one being edited drops to
 *   --fs-dimmed-opacity via node decorations.
 *
 * The scroll container is found by walking to the first scrollable ancestor;
 * coordsAtPos is post-zoom-transform, so any zoom level holds. All DOM
 * touches are guarded — in jsdom (tests) coordsAtPos throws and we bail.
 */
import { Extension } from '@tiptap/core';
import type { Editor } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';
import { useEditorStore } from '../../stores/editorStore';

/** How far scrollTop must move to bring the caret to the typewriter line
 *  (a fraction of the container height from its top). Positive = caret is
 *  below the line, scroll down. Exported for the test. */
export function typewriterScrollDelta(
  caretTop: number,
  containerTop: number,
  containerHeight: number,
  offset = 0.5,
): number {
  return caretTop - (containerTop + containerHeight * offset);
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

const HIGHLIGHT_CLASS = 'fs-typewriter-line';

function caretRect(editor: Editor): { top: number; bottom: number } | null {
  try {
    return editor.view.coordsAtPos(editor.view.state.selection.head);
  } catch {
    return null; // position transiently invalid mid-edit (or jsdom)
  }
}

/** Their setPadding, on our sizer: pad .page-sizer so the doc's first/last
 *  lines can reach the typewriter line. Bottom-only in "once reached" mode. */
function applySizerPadding(scroller: HTMLElement): void {
  const sizer = scroller.querySelector('.page-sizer') as HTMLElement | null;
  if (!sizer) return;
  const s = useEditorStore.getState();
  if (!s.typewriterEnabled) {
    sizer.style.removeProperty('padding-top');
    sizer.style.removeProperty('padding-bottom');
    return;
  }
  const pad = Math.round(scroller.clientHeight * s.typewriterOffset);
  sizer.style.paddingBottom = `${pad}px`;
  if (s.typewriterOnlyWhenReached) {
    sizer.style.removeProperty('padding-top');
  } else {
    sizer.style.paddingTop = `${pad}px`;
  }
}

/** Their moveCurrentLine: keep a highlight bar glued to the caret's line.
 *  The bar lives INSIDE the scroller's content space, so it scrolls with the
 *  text for free — no wheel listeners or pause-while-scrolling workarounds. */
function updateHighlightBar(editor: Editor): void {
  const scroller = scrollParentOf(editor.view.dom as HTMLElement);
  if (!scroller) return;
  const wanted = useEditorStore.getState().typewriterHighlightLine;
  let bar = scroller.querySelector(`.${HIGHLIGHT_CLASS}`) as HTMLElement | null;
  if (!wanted) {
    bar?.remove();
    return;
  }
  const coords = caretRect(editor);
  if (!coords) return;
  if (!bar) {
    bar = scroller.ownerDocument.createElement('div');
    bar.className = HIGHLIGHT_CLASS;
    scroller.appendChild(bar);
  }
  const rect = scroller.getBoundingClientRect();
  bar.style.top = `${coords.top - rect.top + scroller.scrollTop}px`;
  bar.style.height = `${Math.max(4, coords.bottom - coords.top)}px`;
}

/** Center the caret's line at the typewriter offset (used on typing and by
 *  the tool when the mode is switched on). */
export function centerCaretLine(editor: Editor): void {
  if (editor.isDestroyed) return;
  const coords = caretRect(editor);
  const scroller = scrollParentOf(editor.view.dom as HTMLElement);
  if (!coords || !scroller) return;
  applySizerPadding(scroller);
  const rect = scroller.getBoundingClientRect();
  const delta = typewriterScrollDelta(
    coords.top, rect.top, rect.height, useEditorStore.getState().typewriterOffset,
  );
  if (Math.abs(delta) >= 2) scroller.scrollTop += delta;  // <2px: don't jitter
  updateHighlightBar(editor);
}

/** Tool-facing: re-apply padding + highlight after a setting flips, without
 *  scrolling (or removing them when their features turned off). */
export function refreshTypewriterChrome(editor: Editor): void {
  if (editor.isDestroyed) return;
  const scroller = scrollParentOf(editor.view.dom as HTMLElement);
  if (scroller) applySizerPadding(scroller);
  updateHighlightBar(editor);
}

/** Their dim-unfocused ("paragraphs" mode): every top-level element not
 *  touched by the selection gets .fs-dimmed. Runs off the CURRENT store
 *  value each state change, so the toggle is live. */
function dimDecorations(doc: PMNode, from: number, to: number): DecorationSet {
  const decos: Decoration[] = [];
  doc.forEach((node, pos) => {
    const end = pos + node.nodeSize;
    const touchesSelection = from < end && to > pos;
    if (!touchesSelection) {
      decos.push(Decoration.node(pos, end, { class: 'fs-dimmed' }));
    }
  });
  return DecorationSet.create(doc, decos);
}

const dimKey = new PluginKey('typewriterDim');

export const TypewriterScroll = Extension.create({
  name: 'typewriterScroll',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: dimKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, old, _oldState, newState) {
            if (!useEditorStore.getState().typewriterDimOthers) return DecorationSet.empty;
            if (!tr.docChanged && !tr.selectionSet && old !== DecorationSet.empty) {
              return old;
            }
            const { from, to } = newState.selection;
            return dimDecorations(newState.doc, from, to);
          },
        },
        props: {
          decorations(state) {
            return dimKey.getState(state) as DecorationSet;
          },
        },
      }),
    ];
  },

  onTransaction({ editor, transaction }) {
    const store = useEditorStore.getState();

    // The highlight bar tracks the caret on ANY caret move (their
    // "disallowed user event" path moves the line without recentering).
    if (store.typewriterHighlightLine && (transaction.selectionSet || transaction.docChanged)) {
      requestAnimationFrame(() => {
        if (!editor.isDestroyed) updateHighlightBar(editor);
      });
    }

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
