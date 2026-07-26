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
  //
  // v4.54, Derek: the parens are ALWAYS the first and last characters of the
  // row. A missing edge paren is repaired in place (deleting one is a locked
  // no-op), and an empty caret is kept between them so typing can never land
  // outside. Emptying the row entirely still works, so it stays deletable.
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('parentheticalAutoParens'),
        appendTransaction: (trs, oldState, newState) => {
          if (!trs.some((t) => t.docChanged || t.selectionSet)) return null;
          const sel = newState.selection;
          if (!(sel instanceof TextSelection)) return null;
          const $from = sel.$from;
          if ($from.parent.type.name !== 'parenthetical') return null;

          if ($from.parent.content.size === 0) {
            if (!sel.empty) return null;
            if (oldState.selection.$from.parent.type.name === 'parenthetical') return null; // already inside one
            const pos = $from.start();
            const tr = newState.tr.insertText('()', pos);
            tr.setSelection(TextSelection.create(tr.doc, pos + 1));
            tr.setMeta('addToHistory', false);
            return tr;
          }

          // Repair: prepend "(" / append ")" when an edge paren is missing.
          // No addToHistory meta — the repair joins the triggering keystroke's
          // undo step, so undo restores the intact row instead of doubling.
          const text = $from.parent.textContent;
          const start = $from.start();
          const needOpen = !text.startsWith('(');
          const needClose = !text.endsWith(')');
          if (needOpen || needClose) {
            const tr = newState.tr;
            if (needOpen) tr.insertText('(', start);
            if (needClose) tr.insertText(')', start + (needOpen ? 1 : 0) + text.length);
            const len = text.length + (needOpen ? 1 : 0) + (needClose ? 1 : 0);
            const caret = Math.min(Math.max(tr.mapping.map(sel.from), start + 1), start + len - 1);
            tr.setSelection(TextSelection.create(tr.doc, caret));
            return tr;
          }

          // Clamp an empty caret inside the parens so typing stays between them.
          if (sel.empty) {
            const lo = start + 1;
            const hi = start + text.length - 1;
            if (sel.from < lo || sel.from > hi) {
              const tr = newState.tr;
              tr.setSelection(TextSelection.create(tr.doc, Math.min(Math.max(sel.from, lo), hi)));
              return tr;
            }
          }
          return null;
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
        // Tab from parenthetical goes to dialogue. v4.54: never by splitting —
        // the parens stay the first and last characters of the row; the
        // dialogue is inserted below with the caret in it.
        const { $from } = editor.state.selection;
        const after = $from.after($from.depth);
        return editor
          .chain()
          .insertContentAt(after, { type: 'dialogue' })
          .focus(after + 1)
          .run();
      },
    };
  },
});
