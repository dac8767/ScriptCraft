// @vitest-environment jsdom
/**
 * SceneHeading uppercase (v3.45; scoped to edits v3.54).
 *
 * Scene-heading text is stored in real caps so the Location tool, export and
 * search see caps — but ONLY as a result of a user edit. Opening a script
 * (setContent, which carries `preventUpdate`) must NOT rewrite headings, or a
 * freshly-opened file with old lowercase headings would be marked dirty.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Text from '@tiptap/extension-text';
import { TextSelection } from '@tiptap/pm/state';
import { SceneHeading } from './SceneHeading';

let editor: Editor | null = null;
let host: HTMLElement | null = null;

function makeEditor() {
  host = document.createElement('div');
  document.body.appendChild(host);
  editor = new Editor({ element: host, extensions: [Document, Text, SceneHeading], content: '' });
  return editor;
}

const lowerDoc = {
  type: 'doc',
  content: [{ type: 'sceneHeading', content: [{ type: 'text', text: 'int. space - rhommamool' }] }],
};

afterEach(() => {
  editor?.destroy();
  editor = null;
  host?.remove();
  host = null;
});

describe('SceneHeading uppercase — edits only', () => {
  it('loading a script (setContent) leaves lowercase headings untouched', () => {
    const ed = makeEditor();
    ed.commands.setContent(lowerDoc);          // emitUpdate=false ⇒ preventUpdate
    expect(ed.state.doc.textContent).toBe('int. space - rhommamool');
  });

  it('a user edit uppercases the heading text', () => {
    const ed = makeEditor();
    ed.commands.setContent(lowerDoc);
    // Simulate typing: dispatch a plain (non-preventUpdate) transaction.
    const end = ed.state.doc.content.size - 1;
    ed.view.dispatch(ed.state.tr.insertText('!', end));
    const text = ed.state.doc.textContent;
    expect(text).toBe(text.toUpperCase());
    expect(text.startsWith('INT. SPACE')).toBe(true);
  });
});

/** v5.65, Derek's repro: editing "EXT. SPACE CARRIER" mid-heading threw the
 *  caret to the END after every letter. The plugin replaced the WHOLE text
 *  node when any character differed, and a caret strictly inside a replaced
 *  range maps to the range end. Only the differing runs are replaced now. */
describe('mid-heading edits keep the caret (v5.65)', () => {
  /** One character, the way a keystroke lands: insert + mapped caret. */
  const typeAt = (ed: Editor, pos: number, ch: string) => {
    const tr = ed.state.tr;
    tr.setSelection(TextSelection.create(ed.state.doc, pos));
    tr.insertText(ch, pos);
    ed.view.dispatch(tr);
  };
  const seed = (ed: Editor, text: string) => {
    ed.commands.setContent({
      type: 'doc',
      content: [{ type: 'sceneHeading', content: [{ type: 'text', text }] }],
    });
  };
  const headingText = (ed: Editor) => ed.state.doc.firstChild?.textContent ?? '';

  it('typing lowercase MID-heading uppercases in place, caret advances by one', () => {
    const ed = makeEditor();
    seed(ed, 'EXT. SPACE C - BELKADIN');
    const at = 1 + 'EXT. SPACE C'.length;   // right after the C, mid-heading
    typeAt(ed, at, 'r');
    expect(headingText(ed)).toBe('EXT. SPACE CR - BELKADIN');
    expect(ed.state.selection.head).toBe(at + 1);
    typeAt(ed, at + 1, 'u');
    expect(headingText(ed)).toBe('EXT. SPACE CRU - BELKADIN');
    expect(ed.state.selection.head).toBe(at + 2);
  });

  it('a fully lowercase heading still self-heals on edit', () => {
    const ed = makeEditor();
    seed(ed, 'ext. space cruiser - belkadin');
    typeAt(ed, 1 + 'ext'.length, 'x');
    expect(headingText(ed)).toBe('EXTX. SPACE CRUISER - BELKADIN');
  });

  it('typing at the very end keeps behaving (the case that always worked)', () => {
    const ed = makeEditor();
    seed(ed, 'EXT. YARD - DAY');
    const end = 1 + 'EXT. YARD - DAY'.length;
    typeAt(ed, end, 's');
    expect(headingText(ed)).toBe('EXT. YARD - DAYS');
    expect(ed.state.selection.head).toBe(end + 1);
  });
});
