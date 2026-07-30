// @vitest-environment jsdom
/**
 * v5.60: the rewrite-target highlight — a decoration, so it stays painted
 * when the editor blurs into the Rewrite panel (the "my selected text gets
 * unselected" report). The range must survive edits elsewhere by mapping,
 * and clear on null.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Text from '@tiptap/extension-text';
import { Action } from '../../editor/extensions/Action';
import { RewriteTarget, setRewriteTargetHighlight } from './RewriteTarget';

let editor: Editor | null = null;
let host: HTMLElement | null = null;

function makeEditor(texts: string[]) {
  host = document.createElement('div');
  document.body.appendChild(host);
  editor = new Editor({
    element: host,
    extensions: [Document, Text, Action, RewriteTarget],
    content: {
      type: 'doc',
      content: texts.map((t) => ({ type: 'action', content: [{ type: 'text', text: t }] })),
    },
  });
  return editor;
}

const highlighted = () =>
  [...(host?.querySelectorAll('.rw-target-hl') ?? [])].map((el) => el.textContent).join('');

afterEach(() => {
  editor?.destroy();
  editor = null;
  host?.remove();
  host = null;
});

describe('RewriteTarget', () => {
  it('paints the target and clears on null', () => {
    const ed = makeEditor(['He rises.', 'He waits.']);
    // second block spans [11, 22): start 11, content 12..21
    setRewriteTargetHighlight(ed, { from: 11, to: 22 });
    expect(highlighted()).toBe('He waits.');
    setRewriteTargetHighlight(ed, null);
    expect(highlighted()).toBe('');
  });

  it('the range maps through edits made before it (blur-proof by design)', () => {
    const ed = makeEditor(['He rises.', 'He waits.']);
    setRewriteTargetHighlight(ed, { from: 11, to: 22 });
    ed.commands.insertContentAt(1, 'XX');   // typing above the target
    expect(highlighted()).toBe('He waits.');
  });

  it('a doc change that consumes the range drops the highlight cleanly', () => {
    const ed = makeEditor(['He rises.', 'He waits.']);
    setRewriteTargetHighlight(ed, { from: 11, to: 22 });
    ed.commands.setContent({
      type: 'doc',
      content: [{ type: 'action', content: [{ type: 'text', text: 'Gone.' }] }],
    });
    expect(highlighted()).toBe('');
  });
});
