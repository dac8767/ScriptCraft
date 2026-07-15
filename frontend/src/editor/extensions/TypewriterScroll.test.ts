// @vitest-environment jsdom
/**
 * TypewriterScroll — pins the centering math's sign convention (the delta is
 * ADDED to scrollTop) and, since v1.72, the configurable typewriter offset
 * and the dim-others decorations ported from obsidian-typewriter-mode.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { TypewriterScroll, typewriterScrollDelta } from './TypewriterScroll';
import { useEditorStore } from '../../stores/editorStore';

describe('typewriterScrollDelta', () => {
  it('scrolls down when the caret is below the line', () => {
    // container spans 100..700 (center 400), caret at 600
    expect(typewriterScrollDelta(600, 100, 600)).toBe(200);
  });

  it('scrolls up when the caret is above the line', () => {
    expect(typewriterScrollDelta(200, 100, 600)).toBe(-200);
  });

  it('does nothing when the caret sits exactly on the line', () => {
    expect(typewriterScrollDelta(400, 100, 600)).toBe(0);
  });

  it('honors a non-center typewriter offset (v1.72)', () => {
    // line at 25% of a 100..700 container = 250; caret at 400 → scroll down 150
    expect(typewriterScrollDelta(400, 100, 600, 0.25)).toBe(150);
    // line at 75% = 550; caret at 400 → scroll up 150
    expect(typewriterScrollDelta(400, 100, 600, 0.75)).toBe(-150);
  });
});

describe('dim-others decorations (v1.72)', () => {
  let editor: Editor;
  let host: HTMLElement;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    editor = new Editor({
      element: host,
      extensions: [Document, Paragraph, Text, TypewriterScroll],
      content: '<p>one</p><p>two</p><p>three</p>',
    });
  });

  afterEach(() => {
    useEditorStore.getState().setTypewriterDimOthers(false);
    editor.destroy();
    host.remove();
  });

  it('dims every block except the one the cursor is in', () => {
    useEditorStore.getState().setTypewriterDimOthers(true);
    editor.commands.setTextSelection(2); // inside "one"
    const dimmed = editor.view.dom.querySelectorAll('.fs-dimmed');
    expect(dimmed.length).toBe(2);
    expect(Array.from(dimmed).map((el) => el.textContent)).toEqual(['two', 'three']);
  });

  it('follows the cursor to another block', () => {
    useEditorStore.getState().setTypewriterDimOthers(true);
    editor.commands.setTextSelection(2);
    editor.commands.setTextSelection(8); // inside "two"
    const dimmed = Array.from(editor.view.dom.querySelectorAll('.fs-dimmed'));
    expect(dimmed.map((el) => el.textContent)).toEqual(['one', 'three']);
  });

  it('dims nothing while the option is off', () => {
    editor.commands.setTextSelection(2);
    expect(editor.view.dom.querySelectorAll('.fs-dimmed').length).toBe(0);
  });
});
