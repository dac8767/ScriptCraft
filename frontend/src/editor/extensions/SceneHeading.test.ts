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
