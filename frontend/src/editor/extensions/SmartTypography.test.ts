// @vitest-environment jsdom
/**
 * SmartTypography (v1.61) — pins the live-toggle mechanism.
 *
 * The extension relies on a specific tiptap contract: an InputRule handler
 * that leaves `state.tr` untouched is treated as "not handled", so the raw
 * character types normally. If a tiptap upgrade changes that, these tests
 * catch it — the OFF cases would start swallowing keystrokes (the silent
 * no-op failure mode this repo treats as the cardinal sin).
 *
 * Typing is simulated the way ProseMirror does it: the inputRules plugin
 * registers a `handleTextInput` prop; we invoke it via `view.someProp` and,
 * when no rule claims the input, insert the raw text ourselves (which is
 * exactly what the browser/ProseMirror does after the prop returns false).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { SmartTypography } from './SmartTypography';
import { useSettingsStore } from '../../stores/settingsStore';

let editor: Editor;
let host: HTMLElement;

function type(text: string) {
  for (const ch of text) {
    const { state, view } = editor;
    const { from, to } = state.selection;
    const deflt = () => state.tr.insertText(ch, from, to);
    const handled = view.someProp('handleTextInput', (f) =>
      f(view, from, to, ch, deflt),
    );
    if (!handled) {
      view.dispatch(deflt());
    }
  }
}

function docText(): string {
  return editor.state.doc.textContent;
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  editor = new Editor({
    element: host,
    extensions: [Document, Paragraph, Text, SmartTypography],
    content: '<p></p>',
  });
});

afterEach(() => {
  editor.destroy();
  host.remove();
  useSettingsStore.getState().setSmartTypography(true);
});

describe('SmartTypography — setting ON', () => {
  beforeEach(() => useSettingsStore.getState().setSmartTypography(true));

  it('curls double quotes: opening and closing', () => {
    type('"hi"');
    expect(docText()).toBe('“hi”');
  });

  it('curls single quotes and apostrophes', () => {
    type("'sup' it's");
    expect(docText()).toBe('‘sup’ it’s');
  });

  it('turns -- into an em dash', () => {
    type('wait--now');
    expect(docText()).toBe('wait—now');
  });

  it('leaves trailing dots alone (no ellipsis rule, by design)', () => {
    type('later...');
    expect(docText()).toBe('later...');
  });
});

describe('SmartTypography — setting OFF (live toggle, no editor rebuild)', () => {
  beforeEach(() => useSettingsStore.getState().setSmartTypography(false));

  it('types straight quotes verbatim — the keystroke must NOT be swallowed', () => {
    type('"hi" it\'s');
    expect(docText()).toBe('"hi" it\'s');
  });

  it('leaves -- as two hyphens', () => {
    type('wait--now');
    expect(docText()).toBe('wait--now');
  });

  it('flipping the setting mid-session changes behavior immediately', () => {
    type('"a');
    useSettingsStore.getState().setSmartTypography(true);
    type(' "b');
    expect(docText()).toBe('"a “b');
  });
});
