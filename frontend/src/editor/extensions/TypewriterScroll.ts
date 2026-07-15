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
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { useEditorStore } from '../../stores/editorStore';
import { useProjectStore } from '../../stores/projectStore';

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

/** Sentence boundaries in a plain-text block, as [start, end) text offsets.
 *  Their delimiters: . ! ? plus trailing quotes/brackets. Exported for the
 *  test. */
export function sentenceRanges(text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const re = /[^.!?]*[.!?]+["”’')\]]*\s*|[^.!?]+$/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[0].length === 0) { re.lastIndex++; continue; }
    ranges.push([m.index, m.index + m[0].length]);
  }
  return ranges;
}

/** Their dim-unfocused: every top-level element not touched by the selection
 *  gets .fs-dimmed. In 'sentences' mode (v1.74), the ACTIVE textblock is also
 *  dimmed except the sentence under the caret. Runs off the CURRENT store
 *  values each state change, so the toggles are live. */
function dimDecorations(state: EditorState): DecorationSet {
  const { from, to, $head } = state.selection;
  const mode = useEditorStore.getState().typewriterDimMode;
  const decos: Decoration[] = [];
  state.doc.forEach((node, pos) => {
    const end = pos + node.nodeSize;
    const touchesSelection = from < end && to > pos;
    if (!touchesSelection) {
      decos.push(Decoration.node(pos, end, { class: 'fs-dimmed' }));
    }
  });
  if (mode === 'sentences' && $head.parent.isTextblock && state.selection.empty) {
    const blockStart = $head.start();
    const text = $head.parent.textContent;
    const headOffset = $head.pos - blockStart;
    for (const [s, e] of sentenceRanges(text)) {
      const active = headOffset >= s && headOffset <= e;
      if (!active && e > s) {
        decos.push(Decoration.inline(blockStart + s, blockStart + e, { class: 'fs-dimmed' }));
      }
    }
  }
  return DecorationSet.create(state.doc, decos);
}

/** Their keep-lines-above-and-below: a gentler alternative to typewriter
 *  scrolling — only scroll when the caret gets within N lines of the top or
 *  bottom of the viewport, and only far enough to restore the margin. */
function keepLinesAdjust(editor: Editor): void {
  if (editor.isDestroyed) return;
  const coords = caretRect(editor);
  const scroller = scrollParentOf(editor.view.dom as HTMLElement);
  if (!coords || !scroller) return;
  const n = useEditorStore.getState().typewriterKeepLinesCount;
  const lineH = Math.max(14, coords.bottom - coords.top);
  const rect = scroller.getBoundingClientRect();
  const lower = rect.top + lineH * n;
  const upper = rect.top + rect.height - lineH * (n + 1);
  if (coords.top < lower && scroller.scrollTop > 0) {
    scroller.scrollTop -= lower - coords.top;
  } else if (coords.top > upper) {
    scroller.scrollTop += coords.top - upper;
  }
}

/* ── Restore cursor position (v1.74, their restore-cursor-position) ──
   Saved per script (debounced) and re-applied right after a content load —
   tiptap's setContent stamps 'preventUpdate', the same choke point VomitLock
   uses to detect loads. */
const CURSOR_KEY = 'opendraft:cursorPositions';

function scriptKey(): string | null {
  const id = useProjectStore.getState().currentScriptId;
  if (id) return id;
  const title = useEditorStore.getState().documentTitle;
  return title ? `title:${title}` : null;
}

function loadCursorMap(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(CURSOR_KEY) || '{}'); }
  catch { return {}; }
}

let cursorSaveTimer: ReturnType<typeof setTimeout> | undefined;
function saveCursorDebounced(pos: number): void {
  clearTimeout(cursorSaveTimer);
  cursorSaveTimer = setTimeout(() => {
    const key = scriptKey();
    if (!key) return;
    try {
      let map = loadCursorMap();
      const keys = Object.keys(map);
      if (keys.length > 200) map = {};   // aged junk — start over
      map[key] = pos;
      localStorage.setItem(CURSOR_KEY, JSON.stringify(map));
    } catch { /* storage unavailable */ }
  }, 500);
}

function restoreCursor(editor: Editor): void {
  if (editor.isDestroyed) return;
  const key = scriptKey();
  if (!key) return;
  const saved = loadCursorMap()[key];
  if (typeof saved !== 'number') return;
  const pos = Math.max(1, Math.min(saved, editor.state.doc.content.size - 1));
  try {
    editor.chain().setTextSelection(pos).scrollIntoView().run();
  } catch { /* stale position for a reshaped doc — stay at the top */ }
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
            return dimDecorations(newState);
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

    // Restore-cursor (v1.74): a content load (setContent stamps
    // 'preventUpdate') re-applies the saved position; ordinary caret
    // movement keeps saving it, debounced.
    if (store.typewriterRestoreCursor) {
      if (transaction.getMeta('preventUpdate') !== undefined && transaction.docChanged) {
        requestAnimationFrame(() => restoreCursor(editor));
        return;   // don't let the load's selection overwrite the saved spot
      }
      if (transaction.selectionSet || transaction.docChanged) {
        saveCursorDebounced(editor.state.selection.head);
      }
    }

    // The highlight bar tracks the caret on ANY caret move (their
    // "disallowed user event" path moves the line without recentering).
    if (store.typewriterHighlightLine && (transaction.selectionSet || transaction.docChanged)) {
      requestAnimationFrame(() => {
        if (!editor.isDestroyed) updateHighlightBar(editor);
      });
    }

    if (!store.typewriterEnabled) {
      // Keep-lines (v1.74): the gentler mode, only when full typewriter
      // scrolling is off (scrolling wins when both are on, as in the plugin).
      if (store.typewriterKeepLinesEnabled
        && (transaction.docChanged || (transaction.selectionSet && editor.state.selection.empty))) {
        requestAnimationFrame(() => keepLinesAdjust(editor));
      }
      return;
    }
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
