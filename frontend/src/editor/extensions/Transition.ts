import { Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { isLeftTransition } from '../../utils/transitions';

/** v6.30, Derek: FADE IN: sits at the LEFT margin — it's the opening
 *  transition; every other transition stays right-aligned. A decoration
 *  (recomputed on every doc change) rather than renderHTML, because
 *  ProseMirror does NOT re-run renderHTML when only the text changes —
 *  typing "FADE IN:" must flip the alignment live. Same predicate the PDF
 *  exporter uses (utils/transitions), so screen and paper agree. */
const fadeInPlugin = new Plugin({
  key: new PluginKey('transitionFadeIn'),
  props: {
    decorations(state) {
      const decos: Decoration[] = [];
      state.doc.forEach((node, offset) => {
        if (node.type.name !== 'transition') return;
        if (isLeftTransition(node.textContent)) {
          decos.push(Decoration.node(offset, offset + node.nodeSize, { class: 'transition-left' }));
        }
      });
      return DecorationSet.create(state.doc, decos);
    },
  },
});

export const Transition = Node.create({
  name: 'transition',
  group: 'block',
  content: 'text*',
  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-type="transition"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'transition',
        class: 'screenplay-element transition',
      }),
      0,
    ];
  },

  addProseMirrorPlugins() {
    return [fadeInPlugin];
  },

  addKeyboardShortcuts() {
    return {};
  },
});
