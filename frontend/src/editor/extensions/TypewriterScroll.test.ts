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
import { TypewriterScroll, typewriterScrollDelta, sentenceRanges, highlightRgba } from './TypewriterScroll';
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

describe('highlightRgba (v1.78)', () => {
  it('converts hex to translucent rgba', () => {
    expect(highlightRgba('#f5d90a')).toBe('rgba(245, 217, 10, 0.3)');
    expect(highlightRgba('34c759')).toBe('rgba(52, 199, 89, 0.3)');
  });

  it('falls back to the default blue on junk', () => {
    expect(highlightRgba('not-a-color')).toBe('rgba(74, 158, 255, 0.3)');
  });
});

describe('sentenceRanges (v1.74)', () => {
  it('splits on . ! ? and keeps trailing quotes with the sentence', () => {
    const text = 'One. Two! "Three?" Four';
    const parts = sentenceRanges(text).map(([s, e]) => text.slice(s, e));
    expect(parts).toEqual(['One. ', 'Two! ', '"Three?" ', 'Four']);
  });

  it('covers the whole text with no gaps', () => {
    const text = 'Hello there. General Kenobi!';
    const ranges = sentenceRanges(text);
    expect(ranges[0][0]).toBe(0);
    expect(ranges[ranges.length - 1][1]).toBe(text.length);
    for (let i = 1; i < ranges.length; i++) {
      expect(ranges[i][0]).toBe(ranges[i - 1][1]);
    }
  });
});

describe('dim-others decorations (v1.72)', () => {
  let editor: Editor;
  let host: HTMLElement;

  beforeEach(() => {
    /* v7.70: SET the master switch, don't inherit it. Every dim decoration is
       gated on typewriterMasterEnabled, which these tests used to get for free
       from a hardcoded default. The shipped defaults are Derek's preset now and
       his master switch is off, so three of these went silently green-to-red
       the moment that landed — for a reason that had nothing to do with what
       they test. */
    useEditorStore.getState().setTypewriterMasterEnabled(true);
    host = document.createElement('div');
    document.body.appendChild(host);
    editor = new Editor({
      element: host,
      extensions: [Document, Paragraph, Text, TypewriterScroll],
      content: '<p>one</p><p>two</p><p>three</p>',
    });
  });

  afterEach(() => {
    useEditorStore.getState().setTypewriterMasterEnabled(false);
    useEditorStore.getState().setTypewriterDimOthers(false);
    useEditorStore.getState().setTypewriterDimMode('elements');
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

  it('sentence mode also dims the other sentences of the active block (v1.74)', () => {
    editor.commands.setContent('<p>One. Two! Three?</p><p>other</p>');
    useEditorStore.getState().setTypewriterDimOthers(true);
    useEditorStore.getState().setTypewriterDimMode('sentences');
    editor.commands.setTextSelection(7); // inside "Two!"
    const dimmedTexts = Array.from(editor.view.dom.querySelectorAll('.fs-dimmed'))
      .map((el) => el.textContent?.trim());
    expect(dimmedTexts).toContain('other');    // the other block
    expect(dimmedTexts).toContain('One.');     // sentence before
    expect(dimmedTexts).toContain('Three?');   // sentence after
    // the sentence under the caret stays bright
    expect(dimmedTexts).not.toContain('Two!');
  });
});
