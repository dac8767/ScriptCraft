// @vitest-environment jsdom
/**
 * v5.25: the Markups pure helpers — content-kind sniffing (drives the tool
 * window's Filter), the plain-text preview (cards + Navigator rows), and the
 * page-for-position lookup shared with the Scene Navigator idiom.
 * (jsdom because markupActions imports the editor store, which reads
 * localStorage at module scope.)
 */
import { describe, it, expect } from 'vitest';
import { markupKinds, markupPreviewText, pageForPos, firstContentKind, markupNavLines, markupDocIsEmpty } from './markupActions';
import type { ScriptMarkup } from '../stores/slices/markupsSlice';

const markup = (content: unknown): ScriptMarkup => ({
  id: 'm1', content, icon: 'flag', color: '#e05555', highlight: null,
  anchor: 'point', done: false, createdAt: '2026-07-29T00:00:00.000Z',
});

const p = (t: string, marks?: { type: string }[]) =>
  ({ type: 'paragraph', content: [{ type: 'text', text: t, ...(marks ? { marks } : {}) }] });

describe('markupKinds', () => {
  it('empty content has no kinds', () => {
    expect(markupKinds(markup(null))).toEqual([]);
  });

  it('plain text is a note', () => {
    expect(markupKinds(markup({ type: 'doc', content: [p('remember this')] }))).toEqual(['note']);
  });

  it('detects each list flavor', () => {
    const list = (type: string) => ({ type: 'doc', content: [{ type, content: [{ type: 'listItem', content: [p('x')] }] }] });
    expect(markupKinds(markup(list('bulletList')))).toContain('bullets');
    expect(markupKinds(markup(list('orderedList')))).toContain('numbers');
    expect(markupKinds(markup(list('taskList')))).toContain('checklist');
  });

  it('detects links and images', () => {
    expect(markupKinds(markup({ type: 'doc', content: [p('see ref', [{ type: 'link' }])] }))).toContain('link');
    expect(markupKinds(markup({ type: 'doc', content: [{ type: 'image', attrs: { src: 'x.png' } }] }))).toContain('image');
  });
});

describe('markupPreviewText', () => {
  it('joins the text runs and trims', () => {
    const m = markup({ type: 'doc', content: [p('first line'), p('second')] });
    expect(markupPreviewText(m)).toBe('first line second');
  });

  it('is empty for image-only content', () => {
    const m = markup({ type: 'doc', content: [{ type: 'image', attrs: { src: 'x.png' } }] });
    expect(markupPreviewText(m)).toBe('');
  });
});

/** v5.33: ONE capper feeds the Navigator rows AND the edit window's
 *  "Displays as:" preview — a list stacks as lines, long lines ellipsize. */
describe('markupNavLines', () => {
  it('a 3-item checklist is 3 lines carrying LIVE checked state (v5.46)', () => {
    const item = (t: string, checked: boolean) =>
      ({ type: 'taskItem', attrs: { checked }, content: [p(t)] });
    const lines = markupNavLines({
      type: 'doc',
      content: [{ type: 'taskList', content: [item('one', false), item('two', false), item('three', true)] }],
    });
    expect(lines).toEqual([
      { text: 'one', marker: 'uncheck' },
      { text: 'two', marker: 'uncheck' },
      { text: 'three', marker: 'check' },
    ]);
  });

  it('numbered lists carry their 1-based number; bullets a bullet marker', () => {
    const li = (t: string) => ({ type: 'listItem', content: [p(t)] });
    const lines = markupNavLines({
      type: 'doc',
      content: [
        { type: 'orderedList', content: [li('a'), li('b')] },
        { type: 'bulletList', content: [li('c')] },
      ],
    });
    expect(lines).toEqual([
      { text: 'a', marker: 'number', n: 1 },
      { text: 'b', marker: 'number', n: 2 },
      { text: 'c', marker: 'bullet' },
    ]);
  });

  it('caps at 6 lines and 60 chars per line', () => {
    const many = Array.from({ length: 9 }, (_, i) => p(`line ${i + 1} ${'x'.repeat(80)}`));
    const lines = markupNavLines({ type: 'doc', content: many });
    expect(lines).toHaveLength(6);
    for (const l of lines) {
      expect(l.text.length).toBe(61);          // 60 kept + the ellipsis
      expect(l.text.endsWith('…')).toBe(true);
      expect(l.marker).toBeNull();
    }
  });

  it('empty content produces no lines (icon-only row)', () => {
    expect(markupNavLines(null)).toEqual([]);
  });

  it('a lone TEXTLESS checklist item keeps its marker line (v5.52)', () => {
    // Derek: "choosing checklist adds one checkbox" — before any typing the
    // item has no text; the row must show the ☐, not fall back to the icon.
    const lines = markupNavLines({
      type: 'doc',
      content: [{ type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph' }] }] }],
    });
    expect(lines).toEqual([{ text: '', marker: 'uncheck' }]);
  });
});

/** v5.52: the live mirror's empty test is STRUCTURAL — a textless list is
 *  content (storing null made the Navigator draw the big auto-check icon
 *  for a one-checkbox annotation until its first character was typed). */
describe('markupDocIsEmpty', () => {
  const doc = (...content: unknown[]) => ({ type: 'doc', content });
  it('null / no nodes / blank paragraphs are empty', () => {
    expect(markupDocIsEmpty(null)).toBe(true);
    expect(markupDocIsEmpty(doc())).toBe(true);
    expect(markupDocIsEmpty(doc({ type: 'paragraph' }, { type: 'paragraph' }))).toBe(true);
    expect(markupDocIsEmpty(doc({ type: 'paragraph', content: [{ type: 'text', text: '   ' }] }))).toBe(true);
  });
  it('a checklist with ONE textless item is NOT empty (the v5.52 bug)', () => {
    expect(markupDocIsEmpty(doc({
      type: 'taskList',
      content: [{ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph' }] }],
    }))).toBe(false);
  });
  it('bullet and numbered lists, images and text all count as content', () => {
    const li = { type: 'listItem', content: [{ type: 'paragraph' }] };
    expect(markupDocIsEmpty(doc({ type: 'bulletList', content: [li] }))).toBe(false);
    expect(markupDocIsEmpty(doc({ type: 'orderedList', content: [li] }))).toBe(false);
    expect(markupDocIsEmpty(doc({ type: 'image', attrs: { src: 'x.png' } }))).toBe(false);
    expect(markupDocIsEmpty(doc({ type: 'paragraph', content: [{ type: 'image', attrs: { src: 'x.png' } }] }))).toBe(false);
    expect(markupDocIsEmpty(doc({ type: 'paragraph', content: [{ type: 'text', text: 'words' }] }))).toBe(false);
  });
});

/** v5.26, Derek's auto-icon table — the FIRST item that maps decides. */
describe('firstContentKind (auto-icon)', () => {
  const doc = (...content: unknown[]) => ({ type: 'doc', content });
  const para = (t: string, marks?: { type: string }[]) =>
    ({ type: 'paragraph', content: [{ type: 'text', text: t, ...(marks ? { marks } : {}) }] });

  it('plain text first → note (speech bubble), even with a link later', () => {
    const d = doc({
      type: 'paragraph',
      content: [
        { type: 'text', text: 'a paragraph then ' },
        { type: 'text', text: 'a link', marks: [{ type: 'link' }] },
      ],
    });
    expect(firstContentKind(d)).toBe('note');
  });

  it('a pure link first → link', () => {
    expect(firstContentKind(doc(para('example.com', [{ type: 'link' }])))).toBe('link');
  });

  it('lists decide by their flavor', () => {
    const list = (type: string) => doc({ type, content: [{ type: 'listItem', content: [para('x')] }] });
    expect(firstContentKind(list('orderedList'))).toBe('numbers');
    expect(firstContentKind(list('taskList'))).toBe('checklist');
    expect(firstContentKind(list('bulletList'))).toBe('bullets');
  });

  it('an image block first → image; empty paragraphs are skipped', () => {
    expect(firstContentKind(doc({ type: 'image', attrs: { src: 'x.png' } }))).toBe('image');
    expect(firstContentKind(doc({ type: 'paragraph' }, para('later text')))).toBe('note');
  });

  it('the FIRST mapping item wins over later ones', () => {
    const d = doc(para('intro text'), { type: 'taskList', content: [] });
    expect(firstContentKind(d)).toBe('note');
  });

  it('nothing decisive → null (icon left alone)', () => {
    expect(firstContentKind(null)).toBeNull();
    expect(firstContentKind(doc({ type: 'paragraph' }))).toBeNull();
  });
});

describe('pageForPos', () => {
  const pages = [
    { pageNumber: 1, blocks: [{ docPos: 0 }, { docPos: 40 }] },
    { pageNumber: 2, blocks: [{ docPos: 100 }] },
    { pageNumber: 3, blocks: [{ docPos: 200 }] },
  ];
  it('maps a position to its page', () => {
    expect(pageForPos(pages, 5)).toBe(1);
    expect(pageForPos(pages, 150)).toBe(2);
    expect(pageForPos(pages, 200)).toBe(3);
  });
  it('defaults to page 1 before any block, and with no pages at all', () => {
    expect(pageForPos([], 50)).toBe(1);
  });
});
