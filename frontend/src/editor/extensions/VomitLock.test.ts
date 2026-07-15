// @vitest-environment jsdom
/**
 * VomitLock (v1.62) — pins the sprint lock's transaction filtering.
 *
 * The contract: while a sprint runs, everything before the floor (pre-sprint
 * text, and any block you've moved on from) is immutable; the current block
 * stays workable; a rejected edit bumps blockedTick (never silent); a
 * setContent-style load (the 'preventUpdate' meta) ends the sprint instead of
 * being blocked, so Open/New/Import keep working mid-sprint.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import Bold from '@tiptap/extension-bold';
import { VomitLock, vomitFloorFor } from './VomitLock';
import { useVomitStore } from '../../stores/vomitStore';

let editor: Editor;
let host: HTMLElement;

function startSprint(minutes = 30) {
  useVomitStore.getState().start(
    Date.now() + minutes * 60000,
    vomitFloorFor(editor.state.doc),
  );
}

function docText(): string {
  return editor.state.doc.textContent;
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  editor = new Editor({
    element: host,
    extensions: [Document, Paragraph, Text, Bold, VomitLock],
    content: '<p>old text</p>',
  });
});

afterEach(() => {
  useVomitStore.getState().end();
  editor.destroy();
  host.remove();
});

describe('VomitLock — no sprint running', () => {
  it('leaves editing alone', () => {
    editor.commands.deleteRange({ from: 1, to: 4 });
    expect(docText()).toBe(' text');
  });
});

describe('VomitLock — sprint running', () => {
  it('locks pre-sprint text but allows appending', () => {
    startSprint();
    const before = useVomitStore.getState().blockedTick;

    editor.commands.insertContentAt(editor.state.doc.content.size - 1, ' and more');
    expect(docText()).toBe('old text and more');

    editor.commands.deleteRange({ from: 1, to: 4 });        // "old" — pre-sprint
    expect(docText()).toBe('old text and more');            // unchanged
    expect(useVomitStore.getState().blockedTick).toBe(before + 1);  // and announced
  });

  it('blocks typing INTO the middle of previous text', () => {
    startSprint();
    editor.commands.insertContentAt(2, 'X');
    expect(docText()).toBe('old text');
  });

  it('blocks marks on previous text (bold is a modification too)', () => {
    startSprint();
    editor.chain().setTextSelection({ from: 1, to: 4 }).setBold().run();
    expect(editor.state.doc.rangeHasMark(1, 4, editor.schema.marks.bold)).toBe(false);
  });

  it('the current block stays workable; a finished block locks', () => {
    startSprint();
    const end = editor.state.doc.content.size - 1;
    editor.chain().setTextSelection(end).splitBlock().run();   // Enter: new block
    editor.commands.insertContentAt(editor.state.selection.from, 'new stuf');
    expect(docText()).toBe('old textnew stuf');

    // fix the line you're on: allowed
    const tail = editor.state.doc.content.size - 1;
    editor.commands.deleteRange({ from: tail - 1, to: tail }); // drop the last 'f'
    expect(docText()).toBe('old textnew stu');

    // backspace-join into the previous block: blocked
    const secondBlockStart = editor.state.doc.content.size - editor.state.doc.lastChild!.nodeSize;
    editor.commands.deleteRange({ from: secondBlockStart - 1, to: secondBlockStart + 1 });
    expect(editor.state.doc.childCount).toBe(2);               // still two blocks

    // and the first block is locked outright
    editor.commands.deleteRange({ from: 1, to: 4 });
    expect(docText()).toBe('old textnew stu');
  });

  it('a setContent-style load ends the sprint and goes through', () => {
    startSprint();
    editor.commands.setContent('<p>a different script</p>');
    expect(docText()).toBe('a different script');
    expect(useVomitStore.getState().session).toBeNull();
  });

  it('an expired clock never keeps the lock alive', () => {
    useVomitStore.getState().start(Date.now() - 1000, vomitFloorFor(editor.state.doc));
    editor.commands.deleteRange({ from: 1, to: 4 });
    expect(docText()).toBe(' text');
  });

  it('ending the sprint restores full editing', () => {
    startSprint();
    useVomitStore.getState().end();
    editor.commands.deleteRange({ from: 1, to: 4 });
    expect(docText()).toBe(' text');
  });
});
