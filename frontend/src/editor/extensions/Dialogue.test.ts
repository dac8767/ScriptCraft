// @vitest-environment jsdom
/**
 * Dialogue "(" trigger (v4.68, Derek): typing "(" while writing dialogue
 * starts a parenthetical — inserted on the next line at the end of a written
 * line, converted in place on an empty line, and a plain literal mid-text.
 * handleTextInput is a view prop, so the tests invoke it via someProp — the
 * same path a real keystroke takes through ProseMirror.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Text from '@tiptap/extension-text';
import { TextSelection } from '@tiptap/pm/state';
import { Dialogue } from './Dialogue';
import { Parenthetical } from './Parenthetical';

let editor: Editor | null = null;
let host: HTMLElement | null = null;

function makeEditor(text: string) {
  host = document.createElement('div');
  document.body.appendChild(host);
  editor = new Editor({
    element: host,
    extensions: [Document, Text, Dialogue, Parenthetical],
    content: {
      type: 'doc',
      content: [{ type: 'dialogue', content: text ? [{ type: 'text', text }] : [] }],
    },
  });
  return editor;
}

const typeParen = (ed: Editor) => {
  const { from, to } = ed.state.selection;
  const handled = ed.view.someProp('handleTextInput', (f) => f(ed.view, from, to, '('));
  if (!handled) ed.view.dispatch(ed.state.tr.insertText('(', from, to));
  return handled;
};

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

describe('typing "(" in dialogue', () => {
  it('at the end of a written line inserts a parenthetical on the next line', () => {
    const ed = makeEditor('We attack at dawn.');
    ed.view.dispatch(ed.state.tr.setSelection(
      TextSelection.create(ed.state.doc, 1 + 'We attack at dawn.'.length),
    ));
    expect(typeParen(ed)).toBe(true);
    expect(types(ed)).toEqual(['dialogue', 'parenthetical']);
    expect(ed.state.doc.child(0).textContent).toBe('We attack at dawn.');
    // the seed filled "()" and the caret is between the parens
    expect(ed.state.doc.child(1).textContent).toBe('()');
    expect(ed.state.selection.$from.parent.type.name).toBe('parenthetical');
  });

  it('on an empty dialogue line converts it in place (no stray blank row)', () => {
    const ed = makeEditor('');
    ed.view.dispatch(ed.state.tr.setSelection(TextSelection.create(ed.state.doc, 1)));
    expect(typeParen(ed)).toBe(true);
    expect(types(ed)).toEqual(['parenthetical']);
    expect(ed.state.doc.child(0).textContent).toBe('()');
  });

  it('mid-text stays a literal "("', () => {
    const ed = makeEditor('We attack at dawn.');
    ed.view.dispatch(ed.state.tr.setSelection(TextSelection.create(ed.state.doc, 4)));
    expect(typeParen(ed)).toBeFalsy();   // someProp yields undefined when unhandled
    expect(types(ed)).toEqual(['dialogue']);
    expect(ed.state.doc.child(0).textContent).toContain('(');
  });
});
