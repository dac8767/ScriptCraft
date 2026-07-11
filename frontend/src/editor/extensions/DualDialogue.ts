import { Node, mergeAttributes } from '@tiptap/core';
import type { Node as PmNode } from '@tiptap/pm/model';
import { TextSelection, type Transaction } from '@tiptap/pm/state';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    dualDialogue: {
      toggleDualDialogue: () => ReturnType;
    };
  }
}

/**
 * Column wrapper inside a DualDialogue.
 */
export const DualDialogueColumn = Node.create({
  name: 'dualDialogueColumn',
  content: '(character | dialogue | parenthetical)+',
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: 'div[data-type="dual-dialogue-column"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'dual-dialogue-column',
        class: 'dual-dialogue-column',
      }),
      0,
    ];
  },
});

const DIALOGUE_NODE_TYPES = new Set(['character', 'dialogue', 'parenthetical']);

/**
 * DualDialogue container — two columns side by side.
 */
/**
 * Caret placement inside a freshly built dualDialogue node (v0.79).
 *
 * Structure: dualDialogue > dualDialogueColumn > [character, dialogue].
 * `at` is the position where the dualDialogue node starts. Offsets step over
 * each opening tag: +1 into the dual node, +1 into the column, +1 into the
 * character textblock.
 *
 * Wrapped in try/catch because a mapped position can be invalid if the document
 * shifted — a caret that fails to move is a cosmetic annoyance, but a thrown
 * error would lose the whole (otherwise correct) transaction.
 */
function placeCaretInFirstCharacter(tr: Transaction, at: number) {
  try {
    tr.setSelection(TextSelection.near(tr.doc.resolve(at + 3)));
  } catch { /* leave the caret where it was */ }
}

/** Caret into the SECOND column's character — used when we synthesized the
 *  second group, so the writer can immediately type the reply. */
function placeCaretInSecondCharacter(tr: Transaction, at: number) {
  try {
    const dual = tr.doc.nodeAt(at);
    if (!dual || dual.type.name !== 'dualDialogue' || dual.childCount < 2) return;
    // Skip the dual's opening tag (+1) and the whole first column.
    const secondColStart = at + 1 + dual.child(0).nodeSize;
    tr.setSelection(TextSelection.near(tr.doc.resolve(secondColStart + 2)));
  } catch { /* leave the caret where it was */ }
}

export const DualDialogue = Node.create({
  name: 'dualDialogue',
  group: 'block',
  content: 'dualDialogueColumn dualDialogueColumn',
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: 'div[data-type="dual-dialogue"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'dual-dialogue',
        class: 'screenplay-element dual-dialogue',
      }),
      0,
    ];
  },

  addCommands() {
    return {
      toggleDualDialogue: () => ({ editor, tr, dispatch }) => {
        const { state } = editor;
        const { $from } = state.selection;

        // If already inside a dualDialogue, unwrap it
        for (let d = $from.depth; d >= 0; d--) {
          const node = $from.node(d);
          if (node.type.name === 'dualDialogue') {
            if (!dispatch) return true;
            const start = $from.before(d);
            const end = $from.after(d);
            const children: PmNode[] = [];
            node.forEach((col: PmNode) => {
              col.forEach((child: PmNode) => {
                children.push(child);
              });
            });
            tr.replaceWith(start, end, children);
            dispatch(tr);
            return true;
          }
        }

        // Collect top-level blocks using doc.resolve to get correct positions
        const doc = state.doc;
        interface BlockInfo { pos: number; end: number; node: PmNode; }
        const blocks: BlockInfo[] = [];

        let scanPos = 1; // first child starts at position 1 (after doc open tag)
        for (let i = 0; i < doc.childCount; i++) {
          const child = doc.child(i);
          const resolved = doc.resolve(scanPos);
          const before = resolved.before(resolved.depth);
          const after = resolved.after(resolved.depth);
          blocks.push({ pos: before, end: after, node: child });
          scanPos = after + 1;
          // Safety: don't go past doc
          if (scanPos > doc.content.size) break;
        }

        // Find cursor block
        const cursorPos = $from.pos;
        let curIdx = -1;
        for (let i = 0; i < blocks.length; i++) {
          if (cursorPos >= blocks[i].pos && cursorPos <= blocks[i].end) {
            curIdx = i;
            break;
          }
        }

        // v0.79: the command no longer refuses when the cursor isn't already in
        // a dialogue group. Dual dialogue NEEDS a character-led group (and a
        // second one to pair with), so if either is missing we CREATE it —
        // pressing the shortcut anywhere now produces a usable, empty dual
        // dialogue with the caret in the first character, instead of a toast
        // telling you to go and set it up yourself.
        const { schema } = state;
        /** An empty character + dialogue pair to fill a column. */
        const emptyGroup = (): PmNode[] => [
          schema.nodes.character.create(null),
          schema.nodes.dialogue.create(null),
        ];

        if (curIdx < 0) {
          // Cursor isn't inside any top-level block we can anchor to — append a
          // complete dual dialogue at the end of the document.
          if (!dispatch) return true;
          const dual = schema.nodes.dualDialogue.create(null, [
            schema.nodes.dualDialogueColumn.create(null, emptyGroup()),
            schema.nodes.dualDialogueColumn.create(null, emptyGroup()),
          ]);
          const at = doc.content.size;
          tr.insert(at, dual);
          placeCaretInFirstCharacter(tr, at);
          dispatch(tr);
          return true;
        }

        // Find the dialogue group containing cursor (walk back to character)
        let g1Start = curIdx;
        while (g1Start > 0 && DIALOGUE_NODE_TYPES.has(blocks[g1Start - 1].node.type.name)) {
          g1Start--;
        }
        if (blocks[g1Start].node.type.name !== 'character') {
          for (let i = curIdx; i >= 0; i--) {
            if (blocks[i].node.type.name === 'character') { g1Start = i; break; }
            if (!DIALOGUE_NODE_TYPES.has(blocks[i].node.type.name)) break;
          }
        }

        // No character-led group at the cursor (e.g. sitting on an Action line):
        // build the whole thing here. An EMPTY block is replaced — the user is
        // on a blank line and clearly means "put it here" — while a block with
        // text is preserved and the dual dialogue is inserted after it, so we
        // never destroy anything they wrote.
        if (blocks[g1Start].node.type.name !== 'character') {
          if (!dispatch) return true;
          const cur = blocks[curIdx];
          const isEmptyBlock = cur.node.content.size === 0;
          const dual = schema.nodes.dualDialogue.create(null, [
            schema.nodes.dualDialogueColumn.create(null, emptyGroup()),
            schema.nodes.dualDialogueColumn.create(null, emptyGroup()),
          ]);
          let at: number;
          if (isEmptyBlock) {
            tr.replaceWith(cur.pos, cur.end, dual);
            at = cur.pos;
          } else {
            tr.insert(cur.end, dual);
            at = cur.end;
          }
          placeCaretInFirstCharacter(tr, at);
          dispatch(tr);
          return true;
        }

        // First group: character + following dialogue/parenthetical
        let g1End = g1Start;
        for (let i = g1Start + 1; i < blocks.length; i++) {
          const t = blocks[i].node.type.name;
          if (t === 'dialogue' || t === 'parenthetical') { g1End = i; }
          else break;
        }

        // Look for second group after first
        let g2Start = g1End + 1;
        let g2End = -1;
        if (g2Start < blocks.length && blocks[g2Start].node.type.name === 'character') {
          g2End = g2Start;
          for (let i = g2Start + 1; i < blocks.length; i++) {
            const t = blocks[i].node.type.name;
            if (t === 'dialogue' || t === 'parenthetical') { g2End = i; }
            else break;
          }
        }

        // If no second group after, maybe cursor is on the second group — look before
        if (g2End < 0) {
          let prevEnd = g1Start - 1;
          if (prevEnd >= 0 && DIALOGUE_NODE_TYPES.has(blocks[prevEnd].node.type.name)) {
            let prevStart = prevEnd;
            while (prevStart > 0 && DIALOGUE_NODE_TYPES.has(blocks[prevStart - 1].node.type.name)) {
              prevStart--;
            }
            if (blocks[prevStart].node.type.name === 'character') {
              // Previous group is first, current is second
              g2Start = g1Start;
              g2End = g1End;
              g1Start = prevStart;
              g1End = g2Start - 1;
              // Recalculate g1End
              for (let i = g1Start + 1; i < g2Start; i++) {
                const t = blocks[i].node.type.name;
                if (t === 'dialogue' || t === 'parenthetical') g1End = i;
                else break;
              }
            }
          }
        }

        if (!dispatch) return true;

        // Build the dual dialogue node
        const col1Nodes: PmNode[] = [];
        for (let i = g1Start; i <= g1End; i++) col1Nodes.push(blocks[i].node);

        // There IS a first group but no second one to pair with (the common
        // case: you've written one character's lines and now want a reply).
        // Create the empty second group instead of refusing.
        const col2Nodes: PmNode[] = g2End < 0
          ? emptyGroup()
          : (() => {
              const out: PmNode[] = [];
              for (let i = g2Start; i <= g2End; i++) out.push(blocks[i].node);
              return out;
            })();

        const col1 = schema.nodes.dualDialogueColumn.create(null, col1Nodes);
        const col2 = schema.nodes.dualDialogueColumn.create(null, col2Nodes);
        const dualNode = schema.nodes.dualDialogue.create(null, [col1, col2]);

        // Use the positions from doc.resolve which are correct absolute positions.
        // When the second group was synthesized, only the FIRST group's range is
        // consumed — otherwise we'd swallow whatever block happens to follow it.
        const from = blocks[g1Start].pos;
        const to = g2End < 0 ? blocks[g1End].end : blocks[g2End].end;

        tr.replaceWith(from, to, dualNode);
        // Caret goes to the empty second character when we made one, so you can
        // just start typing the reply.
        if (g2End < 0) placeCaretInSecondCharacter(tr, from);
        dispatch(tr);
        return true;
      },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-d': () => {
        return this.editor.commands.toggleDualDialogue();
      },
    };
  },
});
