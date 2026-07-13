/**
 * ThinCaret (v1.58) — a constant-width caret at every zoom.
 *
 * The page zooms with transform: scale(), and WebKit draws the NATIVE caret
 * inside that scaled layer — at 130% zoom the caret is 130% fat, and CSS has
 * no caret-width to counter it. So the native caret is hidden (caret-color:
 * transparent on the editor) and this widget decoration draws one at the
 * cursor whose width divides by --zoom-scale, staying ~1px on screen.
 *
 * Side effects, both deliberate:
 *  - it keeps blinking when the editor is unfocused (Derek asked for an
 *    always-visible cursor, like a word processor);
 *  - it renders only for an EMPTY selection, so range selections keep the
 *    native highlight untouched.
 */
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const ThinCaret = Extension.create({
  name: 'thinCaret',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('thinCaret'),
        props: {
          decorations(state) {
            const { selection } = state;
            if (!selection.empty) return null;
            const el = document.createElement('span');
            el.className = 'fs-thin-caret';
            el.setAttribute('aria-hidden', 'true');
            return DecorationSet.create(state.doc, [
              Decoration.widget(selection.head, el, { side: 0, ignoreSelection: true }),
            ]);
          },
        },
      }),
    ];
  },
});

export default ThinCaret;
