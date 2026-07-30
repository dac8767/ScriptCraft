import { Extension, type Editor } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

/**
 * v5.60, Derek: "if I click into the context text field... my selected text
 * on screen gets unselected." The ProseMirror selection SURVIVES the blur —
 * WebKit just stops painting it once focus moves into the Rewrite panel, so
 * the writer can't see what the tool is about to rewrite.
 *
 * This paints the rewrite TARGET as a decoration, which renders whether or
 * not the editor has focus — and it shows the exact clamped range (whole
 * action paragraphs), which the native selection never did. The original
 * design handoff specified this ("highlight(resolved.target)"); it's the
 * piece that hadn't been built.
 *
 * Pure rendering: RewriteTool dispatches a metadata-only transaction with
 * the range (or null) — no doc change, so the pagination plugin correctly
 * ignores it — and the plugin maps the range through edits with the same
 * biases the panel uses for its own target (from assoc 1, to assoc -1).
 */

export const REWRITE_TARGET_META = 'rewriteTarget';

interface TargetRange {
  from: number;
  to: number;
}

const key = new PluginKey<TargetRange | null>('rewriteTarget');

export const RewriteTarget = Extension.create({
  name: 'rewriteTarget',

  addProseMirrorPlugins() {
    return [
      new Plugin<TargetRange | null>({
        key,
        state: {
          init: () => null,
          apply(tr, prev) {
            const meta = tr.getMeta(REWRITE_TARGET_META);
            if (meta !== undefined) return meta as TargetRange | null;
            if (!prev || !tr.docChanged) return prev;
            const from = tr.mapping.map(prev.from, 1);
            const to = tr.mapping.map(prev.to, -1);
            return from < to ? { from, to } : null;
          },
        },
        props: {
          decorations(state) {
            const range = key.getState(state);
            if (!range) return null;
            const to = Math.min(range.to, state.doc.content.size);
            if (range.from >= to) return null;
            return DecorationSet.create(state.doc, [
              Decoration.inline(range.from, to, { class: 'rw-target-hl' }),
            ]);
          },
        },
      }),
    ];
  },
});

/** The panel's one way to drive the highlight. Safe to call with the editor
 *  in any state; a null range clears it. Skips the dispatch when the value
 *  hasn't changed so the debounced resolve doesn't churn view updates. */
export function setRewriteTargetHighlight(
  editor: Editor | null,
  range: TargetRange | null,
): void {
  if (!editor || editor.isDestroyed) return;
  const current = key.getState(editor.view.state) ?? null;
  if (
    (current === null && range === null)
    || (current && range && current.from === range.from && current.to === range.to)
  ) return;
  editor.view.dispatch(editor.view.state.tr.setMeta(REWRITE_TARGET_META, range));
}
