// @vitest-environment jsdom
/**
 * Parenthetical paren behavior (v4.54 lock, v4.55 delete-to-remove).
 *
 * The parens are ALWAYS the first and last characters of the row while it
 * exists, and the caret is clamped between them. DELETING an edge paren
 * removes the whole row (v4.55, Derek — that's how you get rid of one);
 * INSERTION-caused missing parens (converting a line, replacing the row's
 * text) still wrap; a backspace-join from the next line is normalized back.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Text from '@tiptap/extension-text';
import { TextSelection } from '@tiptap/pm/state';
import { Node } from '@tiptap/core';
import { Parenthetical } from './Parenthetical';

// Minimal siblings so the doc can hold more than one block type.
const Dialogue = Node.create({
  name: 'dialogue',
  group: 'block',
  content: 'text*',
  parseHTML: () => [{ tag: 'div[data-type="dialogue"]' }],
  renderHTML: () => ['div', { 'data-type': 'dialogue' }, 0],
});
const Action = Node.create({
  name: 'action',
  group: 'block',
  content: 'text*',
  parseHTML: () => [{ tag: 'div[data-type="action"]' }],
  renderHTML: () => ['div', { 'data-type': 'action' }, 0],
});

let editor: Editor | null = null;
let host: HTMLElement | null = null;

function makeEditor(content: object) {
  host = document.createElement('div');
  document.body.appendChild(host);
  editor = new Editor({
    element: host,
    extensions: [Document, Text, Dialogue, Action, Parenthetical],
    content,
  });
  return editor;
}

/** dialogue("hi") + parenthetical(text) + dialogue("bye") */
const sandwich = (text: string) => ({
  type: 'doc',
  content: [
    { type: 'dialogue', content: [{ type: 'text', text: 'hi' }] },
    { type: 'parenthetical', content: text ? [{ type: 'text', text }] : [] },
    { type: 'dialogue', content: [{ type: 'text', text: 'bye' }] },
  ],
});
const PAREN_START = 5;          // content start of the parenthetical ("hi" node is size 4)

const types = (ed: Editor) => {
  const out: string[] = [];
  ed.state.doc.forEach((n) => out.push(n.type.name));
  return out;
};

afterEach(() => {
  editor?.destroy();
  editor = null;
  host?.remove();
  host = null;
});

describe('parenthetical parens', () => {
  it('entering an empty parenthetical seeds "()" with the caret inside', () => {
    const ed = makeEditor(sandwich(''));
    ed.view.dispatch(ed.state.tr.setSelection(TextSelection.create(ed.state.doc, PAREN_START)));
    expect(ed.state.doc.child(1).textContent).toBe('()');
    expect(ed.state.selection.from).toBe(PAREN_START + 1);
  });

  it('deleting the closing paren removes the whole row', () => {
    const ed = makeEditor(sandwich('(beat)'));
    const end = PAREN_START + '(beat)'.length;
    // caret inside, then Delete on ")"
    ed.view.dispatch(ed.state.tr.setSelection(TextSelection.create(ed.state.doc, end - 1)));
    ed.view.dispatch(ed.state.tr.delete(end - 1, end));
    expect(types(ed)).toEqual(['dialogue', 'dialogue']);
  });

  it('deleting the opening paren removes the whole row, caret lands before it', () => {
    const ed = makeEditor(sandwich('(beat)'));
    ed.view.dispatch(ed.state.tr.setSelection(TextSelection.create(ed.state.doc, PAREN_START + 1)));
    ed.view.dispatch(ed.state.tr.delete(PAREN_START, PAREN_START + 1)); // Backspace on "("
    expect(types(ed)).toEqual(['dialogue', 'dialogue']);
    expect(ed.state.selection.from).toBeLessThanOrEqual(PAREN_START);
  });

  it('deleting ALL the text including parens removes the row', () => {
    const ed = makeEditor(sandwich('(beat)'));
    ed.view.dispatch(ed.state.tr.setSelection(TextSelection.create(ed.state.doc, PAREN_START + 2)));
    ed.view.dispatch(ed.state.tr.delete(PAREN_START, PAREN_START + '(beat)'.length));
    expect(types(ed)).toEqual(['dialogue', 'dialogue']);
  });

  it('replacing the whole row with typed text re-wraps it in parens (insertion)', () => {
    const ed = makeEditor(sandwich('(beat)'));
    const end = PAREN_START + '(beat)'.length;
    // select the row's text (as a user would), then type over it
    ed.view.dispatch(ed.state.tr.setSelection(TextSelection.create(ed.state.doc, PAREN_START, end)));
    ed.view.dispatch(ed.state.tr.insertText('x', PAREN_START, end));
    expect(ed.state.doc.child(1).textContent).toBe('(x)');
    expect(types(ed)).toEqual(['dialogue', 'parenthetical', 'dialogue']);
  });

  it('a backspace-join from the next line is split back out (boundary locked)', () => {
    const ed = makeEditor(sandwich('(beat)'));
    const parenNodeStart = PAREN_START - 1;
    const boundary = parenNodeStart + ed.state.doc.child(1).nodeSize;
    // caret at the start of "bye" (where Backspace fires), then the join it does
    ed.view.dispatch(ed.state.tr.setSelection(TextSelection.create(ed.state.doc, boundary + 1)));
    ed.view.dispatch(ed.state.tr.join(boundary));
    expect(types(ed)).toEqual(['dialogue', 'parenthetical', 'dialogue']);
    expect(ed.state.doc.child(1).textContent).toBe('(beat)');
    expect(ed.state.doc.child(2).textContent).toBe('bye');
    // caret back at the start of the (restored) next line — reads as a no-op
    expect(ed.state.selection.from).toBe(boundary + 1);
  });

  it('a caret placed before "(" or after ")" is clamped inside', () => {
    const ed = makeEditor(sandwich('(beat)'));
    ed.view.dispatch(ed.state.tr.setSelection(TextSelection.create(ed.state.doc, PAREN_START)));
    expect(ed.state.selection.from).toBe(PAREN_START + 1);
    const end = PAREN_START + '(beat)'.length;
    ed.view.dispatch(ed.state.tr.setSelection(TextSelection.create(ed.state.doc, end)));
    expect(ed.state.selection.from).toBe(end - 1);
  });

  it('deleting inner text only keeps the row (parens intact)', () => {
    const ed = makeEditor(sandwich('(beat)'));
    ed.view.dispatch(ed.state.tr.setSelection(TextSelection.create(ed.state.doc, PAREN_START + 2)));
    ed.view.dispatch(ed.state.tr.delete(PAREN_START + 1, PAREN_START + 5)); // "beat"
    expect(ed.state.doc.child(1).textContent).toBe('()');
    expect(types(ed)).toEqual(['dialogue', 'parenthetical', 'dialogue']);
  });
});
