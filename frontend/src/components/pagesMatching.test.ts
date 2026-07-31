// @vitest-environment jsdom
/**
 * pagesMatching (v4.94) — the Pages window's header search.
 *
 * The question it answers is "which page is that line on?", so it reads each
 * page's own text. Two behaviours worth pinning: an empty query returns the
 * list UNCHANGED (identity, not a copy — the thumbnails re-render otherwise),
 * and page NUMBERS survive filtering. Renumbering the survivors 1..n would be
 * a lie about the script, and clicking a thumbnail jumps to that page.
 */
import { describe, it, expect } from 'vitest';
import { pagesMatching, customPagePosLabel } from './SceneNavigator';
import type { PageContentInfo } from '../editor/pagination';

const page = (n: number, lines: string[]): PageContentInfo => ({
  pageNumber: n,
  linesPerPage: 55,
  blocks: lines.map((text, i) => ({ typeName: 'action', text, docPos: i, line: i } as never)),
});

const PAGES: PageContentInfo[] = [
  page(1, ['INT. COFFEE SHOP - DAY', 'Rain streaks the window.']),
  page(2, ['MAYA', 'He is not coming.']),
  page(3, ['EXT. SPACE - BELKADAN', 'A ship drifts past.']),
];
const nums = (r: PageContentInfo[]) => r.map((p) => p.pageNumber);

describe('pagesMatching', () => {
  it('an empty query returns the very same array — no needless re-render', () => {
    expect(pagesMatching(PAGES, '')).toBe(PAGES);
    expect(pagesMatching(PAGES, '   ')).toBe(PAGES);
  });

  it('matches text anywhere on a page, case-insensitively', () => {
    expect(nums(pagesMatching(PAGES, 'rain'))).toEqual([1]);
    expect(nums(pagesMatching(PAGES, 'DRIFTS'))).toEqual([3]);
    expect(nums(pagesMatching(PAGES, 'not coming'))).toEqual([2]);
  });

  it('matches across pages and keeps their order', () => {
    expect(nums(pagesMatching(PAGES, 'a'))).toEqual([1, 2, 3]);
  });

  it('keeps real page numbers — a filtered list still says "Page 3"', () => {
    expect(nums(pagesMatching(PAGES, 'belkadan'))).toEqual([3]);
  });

  it('no match is an empty list, not the whole script', () => {
    expect(pagesMatching(PAGES, 'zzzz')).toEqual([]);
  });

  it('a page with no text at all never throws', () => {
    const blank = [{ pageNumber: 9, linesPerPage: 55, blocks: [] } as PageContentInfo];
    expect(pagesMatching(blank, 'x')).toEqual([]);
  });
});

describe('customPagePosLabel (v5.67, the Custom tab position note)', () => {
  const custom = (n: number): PageContentInfo => ({ ...page(n, ['a line']), isCustom: true, cpId: 'cp1' });

  it('a custom page carries the NEXT script page number → "before page N"', () => {
    expect(customPagePosLabel(custom(7), 11)).toBe('before page 7');
    expect(customPagePosLabel(custom(1), 11)).toBe('before page 1');   // leading
  });

  it('one past the last script page = the end of the script', () => {
    expect(customPagePosLabel(custom(12), 11)).toBe('end of script');
  });

  it('no script pages at all → no note', () => {
    expect(customPagePosLabel(custom(1), 0)).toBe('');
  });
});
