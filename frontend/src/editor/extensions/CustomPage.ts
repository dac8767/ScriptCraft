/**
 * v5.40, Derek: CUSTOM PAGES — insertable non-script pages (lists, quotes,
 * anything) that the script flows AROUND. Modeled exactly like the title
 * page: one node per LINE, flat in the doc (this schema is text*-only
 * blocks — the v5.25 lesson), grouped into one page by a shared `cpId`.
 * The paginator gives each cpId run its own page and — Derek's ruling —
 * the run does NOT count in page numbering: the script page after it keeps
 * the number it would have had. Excluded from the Fountain export (no
 * representation there); prints and previews like any page.
 */
import { Node, Extension, mergeAttributes } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import type { Editor } from '@tiptap/core';
import type { Node as PmNode } from '@tiptap/pm/model';
import { uuid } from '../../utils/uuid';

export const CustomPage = Node.create({
  name: 'customPage',
  group: 'block',
  content: 'text*',
  defining: true,

  addAttributes() {
    return {
      // one page = a consecutive run of lines sharing this id
      cpId: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="custom-page"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-type': 'custom-page',
      'data-cp-id': (node.attrs.cpId as string) || '',
      class: 'screenplay-element custom-page-line',
    }), 0];
  },

});

/** Enter inside a custom page makes ANOTHER LINE of the same page. A
 *  separate high-priority Extension, NOT a Node shortcut — the screenplay-
 *  level EnterHandlerExtension consumes Enter before node keymaps run (the
 *  AvKeymap precedent, including its warning: never set priority on the
 *  NODE, or it becomes the schema's defaultType and clearNodes crashes). */
export const CustomPageKeymap = Extension.create({
  name: 'customPageKeymap',
  priority: 1100,
  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const { state } = editor;
        const { $from } = state.selection;
        if ($from.parent.type.name !== 'customPage') return false;
        // Build the next line by hand — splitBlock fails here (its end-of-
        // block path asks the schema for a default type and gives up), and
        // falling through hands Enter to the element cycler, which minted a
        // customElement. Same id, tail of the line carried, cursor on it.
        const cpId = $from.parent.attrs.cpId as string;
        const after = $from.after();
        const rest = $from.parent.textBetween($from.parentOffset, $from.parent.content.size);
        let tr = state.tr;
        if (rest) tr = tr.delete($from.pos, after - 1);
        const node = state.schema.nodes.customPage.create({ cpId }, rest ? state.schema.text(rest) : undefined);
        const insertAt = tr.mapping.map(after);
        tr = tr.insert(insertAt, node);
        tr = tr.setSelection(TextSelection.create(tr.doc, insertAt + 1));
        editor.view.dispatch(tr.scrollIntoView());
        return true;
      },
    };
  },
});

/** Insert a fresh one-line custom page AFTER the block the cursor is in and
 *  put the cursor on it. The three doors (Insert menu, ribbon button, Pages
 *  tool) all call this. */
export function insertCustomPage(editor: Editor): void {
  const { state } = editor;
  const { $from } = state.selection;
  const insertPos = $from.depth > 0 ? $from.after(1) : state.selection.from;
  insertCustomPageAt(editor, insertPos);
}

/** v5.44: insert a fresh one-line custom page at an exact top-level doc
 *  position — the Pages tool's "Add after page #" computes the boundary
 *  (the next page's first block) and hands it here. */
export function insertCustomPageAt(editor: Editor, pos: number): void {
  const { state } = editor;
  const node = state.schema.nodes.customPage.create({ cpId: uuid() });
  let tr = state.tr.insert(pos, node);
  tr = tr.setSelection(TextSelection.create(tr.doc, pos + 1));
  editor.view.dispatch(tr.scrollIntoView());
  editor.view.focus();
}

/** The doc range covering a custom page's whole run — every consecutive
 *  customPage line sharing this cpId. Null when the id is gone. */
export function customPageRunRange(doc: PmNode, cpId: string): { from: number; to: number } | null {
  let from = -1;
  let to = -1;
  doc.forEach((node, offset) => {
    if (node.type.name === 'customPage' && (node.attrs.cpId as string) === cpId) {
      if (from < 0) from = offset;
      to = offset + node.nodeSize;
    }
  });
  return from < 0 ? null : { from, to };
}

/** v5.44: relocate a custom page (its whole run) to a top-level position
 *  measured on the CURRENT doc — the delete is applied first and the target
 *  mapped through it. A target inside the run itself is a no-op. */
export function moveCustomPage(editor: Editor, cpId: string, pos: number): void {
  const range = customPageRunRange(editor.state.doc, cpId);
  if (!range) return;
  if (pos >= range.from && pos <= range.to) return;
  const run = editor.state.doc.slice(range.from, range.to);
  let tr = editor.state.tr.delete(range.from, range.to);
  tr = tr.insert(tr.mapping.map(pos), run.content);
  editor.view.dispatch(tr);
}

/** v5.44: delete a custom page's whole run (the Pages tool confirms first —
 *  this removes content from the script). */
export function deleteCustomPage(editor: Editor, cpId: string): void {
  const range = customPageRunRange(editor.state.doc, cpId);
  if (!range) return;
  editor.view.dispatch(editor.state.tr.delete(range.from, range.to));
}
