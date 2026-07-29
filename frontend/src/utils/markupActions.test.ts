// @vitest-environment jsdom
/**
 * v5.25: the Markups pure helpers — content-kind sniffing (drives the tool
 * window's Filter), the plain-text preview (cards + Navigator rows), and the
 * page-for-position lookup shared with the Scene Navigator idiom.
 * (jsdom because markupActions imports the editor store, which reads
 * localStorage at module scope.)
 */
import { describe, it, expect } from 'vitest';
import { markupKinds, markupPreviewText, pageForPos, firstContentKind } from './markupActions';
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
