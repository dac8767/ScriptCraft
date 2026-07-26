// @vitest-environment jsdom
/**
 * Parenthetical paren lock (v4.54, Derek).
 *
 * The parens are ALWAYS the first and last characters of the row: deleting an
 * edge paren repairs in place, the caret is clamped between them so typing
 * can never land outside — and emptying the row entirely still works, so the
 * element stays deletable (the v3.44 auto-"()" seed is also covered here).
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

let editor: Editor | null = null;
let host: HTMLElement | null = null;

function makeEditor(content: object) {
  host = document.createElement('div');
  document.body.appendChild(host);
  editor = new Editor({
    element: host,
    extensions: [Document, Text, Dialogue, Parenthetical],
    content,
  });
  return editor;
}

const paren = (text: string) => ({
  type: 'doc',
  content: [{ type: 'parenthetical', content: text ? [{ type: 'text', text }] : [] }],
});

afterEach(() => {
  editor?.destroy();
  editor = null;
  host?.remove();
  host = null;
});

describe('parenthetical paren lock', () => {
  it('entering an empty parenthetical seeds "()" with the caret inside', () => {
    // The seed fires on moving INTO an empty parenthetical from elsewhere —
    // so start the caret in a dialogue sibling, then click into the row.
    const ed = makeEditor({
      type: 'doc',
      content: [
        { type: 'dialogue', content: [{ type: 'text', text: 'hi' }] },
        { type: 'parenthetical' },
      ],
    });
    const parenStart = 1 + 'hi'.length + 2;   // inside start of the parenthetical
    ed.view.dispatch(ed.state.tr.setSelection(TextSelection.create(ed.state.doc, parenStart)));
    expect(ed.state.doc.lastChild!.textContent).toBe('()');
    expect(ed.state.selection.from).toBe(parenStart + 1); // between the parens
  });

  it('deleting the closing paren repairs it (locked)', () => {
    const ed = makeEditor(paren('(beat)'));
    const end = 1 + '(beat)'.length;          // after ")"
    ed.view.dispatch(ed.state.tr.delete(end - 1, end)); // simulate Delete on ")"
    expect(ed.state.doc.firstChild!.textContent).toBe('(beat)');
  });

  it('deleting the opening paren repairs it and keeps the caret inside', () => {
    const ed = makeEditor(paren('(beat)'));
    ed.view.dispatch(ed.state.tr.delete(1, 2)); // simulate Backspace on "("
    expect(ed.state.doc.firstChild!.textContent).toBe('(beat)');
    const sel = ed.state.selection.from;
    expect(sel).toBeGreaterThanOrEqual(2);                  // inside the parens
    expect(sel).toBeLessThanOrEqual(1 + '(beat)'.length - 1);
  });

  it('replacing the whole row with typed text re-wraps it in parens', () => {
    const ed = makeEditor(paren('(beat)'));
    ed.view.dispatch(ed.state.tr.insertText('x', 1, 1 + '(beat)'.length));
    expect(ed.state.doc.firstChild!.textContent).toBe('(x)');
  });

  it('a caret placed before "(" is clamped inside', () => {
    const ed = makeEditor(paren('(beat)'));
    ed.view.dispatch(ed.state.tr.setSelection(TextSelection.create(ed.state.doc, 1)));
    expect(ed.state.selection.from).toBe(2);
  });

  it('a caret placed after ")" is clamped inside', () => {
    const ed = makeEditor(paren('(beat)'));
    const end = 1 + '(beat)'.length;
    ed.view.dispatch(ed.state.tr.setSelection(TextSelection.create(ed.state.doc, end)));
    expect(ed.state.selection.from).toBe(end - 1);
  });

  it('emptying the row entirely still works (stays deletable)', () => {
    const ed = makeEditor(paren('(beat)'));
    // Caret inside first (so the seed's "just entered" guard is not tripped)…
    ed.view.dispatch(ed.state.tr.setSelection(TextSelection.create(ed.state.doc, 3)));
    // …then delete ALL the text including both parens.
    ed.view.dispatch(ed.state.tr.delete(1, 1 + '(beat)'.length));
    expect(ed.state.doc.firstChild!.textContent).toBe('');
  });
});
