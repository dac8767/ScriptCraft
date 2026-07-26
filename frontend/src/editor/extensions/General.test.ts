// @vitest-environment jsdom
/**
 * General outline-line classes (v4.54).
 *
 * The ol-section / ol-marker / ol-todo classes used to be stamped in
 * renderHTML — which ProseMirror does NOT re-run when only the TEXT changes,
 * so a hand-typed "# " kept a stale (missing) class until the node happened
 * to re-render. They are now decorations recomputed on every doc change,
 * driven by the same utils/workingNotes classification the exporters and the
 * paginator use. These tests type into a live editor and read the DOM back.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Text from '@tiptap/extension-text';
import { General } from './General';
import { workingNoteKind } from '../../utils/workingNotes';

let editor: Editor | null = null;
let host: HTMLElement | null = null;

function makeEditor(text: string) {
  host = document.createElement('div');
  document.body.appendChild(host);
  editor = new Editor({
    element: host,
    extensions: [Document, Text, General],
    content: {
      type: 'doc',
      content: [{ type: 'general', content: text ? [{ type: 'text', text }] : [] }],
    },
  });
  return editor;
}

afterEach(() => {
  editor?.destroy();
  editor = null;
  host?.remove();
  host = null;
});

describe('workingNoteKind', () => {
  it('classifies each working-note token', () => {
    expect(workingNoteKind('# Act One')).toBe('section');
    expect(workingNoteKind('## Sub')).toBe('section');
    expect(workingNoteKind('⚑ check this')).toBe('marker');
    expect(workingNoteKind('[ ] fix pacing')).toBe('todo');
    expect(workingNoteKind('[x] done')).toBe('todo');
    expect(workingNoteKind('ordinary text')).toBe(null);
    expect(workingNoteKind('#hashtag (no space)')).toBe(null);
  });
});

describe('ol- classes track the text live', () => {
  it('a loaded section line carries ol-section', () => {
    makeEditor('# Act One');
    expect(host!.querySelector('.general')!.classList.contains('ol-section')).toBe(true);
  });

  it('typing a to-do token into a plain line adds ol-todo immediately', () => {
    const ed = makeEditor('fix pacing');
    expect(host!.querySelector('.general')!.classList.contains('ol-todo')).toBe(false);
    ed.view.dispatch(ed.state.tr.insertText('[ ] ', 1));   // hand-typed marker
    expect(host!.querySelector('.general')!.classList.contains('ol-todo')).toBe(true);
  });

  it('deleting the token removes the class again', () => {
    const ed = makeEditor('⚑ note');
    expect(host!.querySelector('.general')!.classList.contains('ol-marker')).toBe(true);
    ed.view.dispatch(ed.state.tr.delete(1, 3));            // strip "⚑ "
    expect(host!.querySelector('.general')!.classList.contains('ol-marker')).toBe(false);
  });
});
