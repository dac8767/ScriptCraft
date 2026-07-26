import { Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';

export const Dialogue = Node.create({
  name: 'dialogue',
  group: 'block',
  content: 'text*',
  defining: true,

  // v4.68, Derek: typing "(" while writing dialogue starts a parenthetical —
  // the mid-speech beat. At the END of a written line the parenthetical is
  // inserted on the next line; on an EMPTY dialogue line it converts in
  // place (inserting below would strand a blank dialogue row — the exact
  // bug v4.65 fixed for Tab). Mid-text "(" stays a literal character. The
  // consumed "(" is not lost: entering the empty parenthetical auto-seeds
  // "()" with the caret between (v3.44).
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('dialogueParenTrigger'),
        props: {
          handleTextInput: (view, _from, _to, text) => {
            if (text !== '(') return false;
            const { $from } = view.state.selection;
            if ($from.parent.type.name !== 'dialogue') return false;
            const paren = view.state.schema.nodes['parenthetical'];
            if (!paren) return false;
            if ($from.parent.content.size === 0) {
              const tr = view.state.tr.setNodeMarkup($from.before(), paren);
              view.dispatch(tr);
              return true;
            }
            if ($from.parentOffset !== $from.parent.content.size) return false; // mid-text: literal "("
            const after = $from.after();
            const tr = view.state.tr.insert(after, paren.create());
            tr.setSelection(TextSelection.create(tr.doc, after + 1));
            view.dispatch(tr);
            return true;
          },
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
    return [{ tag: 'div[data-type="dialogue"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const attrs: Record<string, string> = {
      'data-type': 'dialogue',
      class: 'screenplay-element dialogue',
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
        if (!editor.isActive('dialogue')) return false;
        // Tab from dialogue goes to parenthetical. (Fallback — the central
        // TabHandler with the template's nextOnTab usually runs first.)
        // v4.68: an empty line converts in place, same as the central rule.
        const { $from } = editor.state.selection;
        const chain = editor.chain();
        if ($from.parent.content.size > 0) chain.splitBlock();
        return chain.setNode('parenthetical').run();
      },
    };
  },
});
