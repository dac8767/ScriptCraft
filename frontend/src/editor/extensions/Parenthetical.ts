import { Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { Mapping } from '@tiptap/pm/transform';

export const Parenthetical = Node.create({
  name: 'parenthetical',
  group: 'block',
  content: 'text*',
  defining: true,

  // v3.44, Derek: adding a parenthetical auto-fills "()" with the caret between
  // them. Fires the moment you ENTER an empty parenthetical (Tab from a
  // character/dialogue, the element selector, the menu, or clicking in) — but
  // NOT when you empty one you were already editing.
  //
  // v4.54, Derek: the parens are ALWAYS the first and last characters of the
  // row, and an empty caret is kept between them so typing can never land
  // outside.
  //
  // v4.55, Derek: DELETING an edge paren removes the whole parenthetical row
  // (it does not repair) — that's how you get rid of one. Repair-by-wrapping
  // still applies when the missing paren came from an INSERTION (converting a
  // text line to a parenthetical, replacing the selected row with typed
  // text), and a backspace that would JOIN the next line into the row is
  // normalized back — the row boundary is locked.
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
          const start = $from.start();
          const docChanged = trs.some((t) => t.docChanged);

          // What this row looked like BEFORE these transactions: map the row's
          // content start back through them and read the old node. null when
          // the row didn't exist yet (just converted/created).
          let oldText: string | null = null;
          let oldNextNode: import('@tiptap/pm/model').Node | null = null;
          if (docChanged) {
            const mapping = new Mapping();
            for (const t of trs) mapping.appendMapping(t.mapping);
            const oldPos = mapping.invert().map(start, 1);
            if (oldPos >= 0 && oldPos <= oldState.doc.content.size) {
              const $o = oldState.doc.resolve(oldPos);
              if ($o.parent.type.name === 'parenthetical') {
                oldText = $o.parent.textContent;
                const afterPos = $o.after();
                oldNextNode = afterPos < oldState.doc.content.size
                  ? oldState.doc.nodeAt(afterPos)
                  : null;
              }
            }
          }
          // Did any step INSERT content (typing, paste, an element conversion)?
          // Pure deletions (Backspace/Delete/cut/joins) have empty slices.
          const hasInsertion = trs.some((t) => t.steps.some((s) => {
            const slice = (s as unknown as { slice?: { content: { size: number } } }).slice;
            return !!slice && slice.content.size > 0;
          }));

          // Delete the whole row; null when the surrounding structure forbids
          // it (sole block in the doc or a dual-dialogue column) — callers
          // fall back rather than crash the dispatch.
          const removeRow = (bias: -1 | 1) => {
            try {
              const tr = newState.tr.delete($from.before(), $from.after());
              const at = Math.min($from.before(), tr.doc.content.size);
              tr.setSelection(TextSelection.near(tr.doc.resolve(at), bias));
              return tr;
            } catch {
              try {
                // Can't remove the block: clear it to an empty action instead.
                const action = newState.schema.nodes['action'];
                if (!action) return null;
                const from = $from.before();
                const to = $from.after();
                const tr = newState.tr;
                if (to - 1 > from + 1) tr.delete(from + 1, to - 1);
                tr.setNodeMarkup(from, action);
                tr.setSelection(TextSelection.create(tr.doc, from + 1));
                return tr;
              } catch {
                return null;
              }
            }
          };

          if ($from.parent.content.size === 0) {
            if (!sel.empty) return null;
            if (oldState.selection.$from.parent.type.name !== 'parenthetical') {
              // Just entered an empty parenthetical → seed "()".
              const tr = newState.tr.insertText('()', start);
              tr.setSelection(TextSelection.create(tr.doc, start + 1));
              tr.setMeta('addToHistory', false);
              return tr;
            }
            // v4.55: deleted everything including the parens → the row goes too.
            if (oldText && oldText.length > 0 && !hasInsertion) {
              const tr = removeRow(-1);
              if (tr) return tr;
            }
            return null;
          }

          const text = $from.parent.textContent;

          // A backspace at the start of the NEXT line joined it into this row,
          // stranding text after the ")". Split it back out and restore the
          // joined line's type — the row boundary reads as locked.
          if (
            oldText && oldText.endsWith(')') && !hasInsertion
            && text.length > oldText.length && text.startsWith(oldText)
            && oldNextNode && oldNextNode.isTextblock
          ) {
            const splitPos = start + oldText.length;
            const tr = newState.tr;
            tr.split(splitPos);
            tr.setNodeMarkup(splitPos + 1, oldNextNode.type, oldNextNode.attrs);
            tr.setSelection(TextSelection.create(tr.doc, splitPos + 2));
            return tr;
          }

          const needOpen = !text.startsWith('(');
          const needClose = !text.endsWith(')');
          if (needOpen || needClose) {
            // v4.55, Derek: an edge paren was DELETED → remove the whole row.
            const parenLost = !!oldText
              && ((needOpen && oldText.startsWith('(')) || (needClose && oldText.endsWith(')')));
            if (parenLost && !hasInsertion) {
              const tr = removeRow(needOpen ? -1 : 1);
              if (tr) return tr;
            }

            // Insertion path (conversion / replacement typing): wrap in parens.
            // No addToHistory meta — the repair joins the triggering
            // keystroke's undo step, so undo restores the row in one step.
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
