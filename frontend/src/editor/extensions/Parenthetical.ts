import { Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';

export const Parenthetical = Node.create({
  name: 'parenthetical',
  group: 'block',
  content: 'text*',
  defining: true,

  // v3.44, Derek: adding a parenthetical auto-fills "()" with the caret between
  // them. Fires the moment you ENTER an empty parenthetical (Tab from a
  // character/dialogue, the element selector, the menu, or clicking in) — but
  // NOT when you empty one you were already editing, so it stays deletable.
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('parentheticalAutoParens'),
        appendTransaction: (trs, oldState, newState) => {
          if (!trs.some((t) => t.docChanged || t.selectionSet)) return null;
          const sel = newState.selection;
          if (!(sel instanceof TextSelection) || !sel.empty) return null;
          const $from = sel.$from;
          if ($from.parent.type.name !== 'parenthetical') return null;
          if ($from.parent.content.size !== 0) return null;                 // not empty
          if (oldState.selection.$from.parent.type.name === 'parenthetical') return null; // already inside one
          const pos = $from.start();
          const tr = newState.tr.insertText('()', pos);
          tr.setSelection(TextSelection.create(tr.doc, pos + 1));
          tr.setMeta('addToHistory', false);
          return tr;
        },
      }),
    ];
  },

  addAttributes() {
    return {
      lang: { default: null },
      dir: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="parenthetical"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const attrs: Record<string, string> = {
      'data-type': 'parenthetical',
      class: 'screenplay-element parenthetical',
    };
    if (node.attrs.lang) attrs.lang = node.attrs.lang;
    if (node.attrs.dir) attrs.dir = node.attrs.dir;
    return [
      'div',
      mergeAttributes(HTMLAttributes, attrs),
      0,
    ];
  },

  addKeyboardShortcuts() {
    return {
      Tab: ({ editor }) => {
        if (!editor.isActive('parenthetical')) return false;
        // Tab from parenthetical goes to dialogue
        return editor
          .chain()
          .splitBlock()
          .setNode('dialogue')
          .run();
      },
    };
  },
});
