// @vitest-environment jsdom
/**
 * computePageBlocks + the title page (v4.95).
 *
 * Derek: "page 1 has strange spacing." The Pages tool renders these blocks as
 * a miniature of the page. In Page/Continuous view the editor HIDES the title
 * page and the paginator counts it as zero lines — but the blocks still
 * carried its text, so the preview laid the title out as ordinary elements
 * above page 1's script and nothing lined up with the real page.
 *
 * The rule: what the editor doesn't render, the preview doesn't render. The
 * doc here is a stub — computePageBlocks only reads type name, textContent,
 * nodeSize and attrs off each top-level node.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { computePageBlocks, setPaginationVisibility } from './pagination';
import { DEFAULT_PAGE_LAYOUT } from '../stores/editorStore';

type Stub = { type: { name: string }; textContent: string; nodeSize: number; attrs: Record<string, unknown> };

const node = (name: string, text: string, attrs: Record<string, unknown> = {}): Stub =>
  ({ type: { name }, textContent: text, nodeSize: text.length + 2, attrs });

/** Just enough PmNode surface for computePageBlocks / computeBreaks. */
const docOf = (nodes: Stub[]) => ({
  forEach(fn: (n: Stub, offset: number) => void) {
    let off = 0;
    for (const n of nodes) { fn(n, off); off += n.nodeSize; }
  },
}) as never;

const TITLE_AND_SCRIPT = [
  node('titlePage', 'STAR WARS - EPISODE 8', { field: 'title' }),
  node('titlePage', 'Written by Derek Carl', { field: 'credit' }),
  node('sceneHeading', 'EXT. SPACE - OPENING SCROLL'),
  node('action', 'The camera tilts down to reveal a mid-sized space carrier.'),
];

const texts = (page: { blocks: { text: string }[] }) => page.blocks.map((b) => b.text);

describe('computePageBlocks and the title page', () => {
  beforeEach(() => {
    setPaginationVisibility({ hideSections: false, hideTodos: false, doubleSpaceHeaders: false, hideTitlePage: false });
  });

  it('HIDDEN (Page / Continuous view): page 1 shows the script, not the title', () => {
    setPaginationVisibility({ hideTitlePage: true });
    const pages = computePageBlocks(docOf(TITLE_AND_SCRIPT), DEFAULT_PAGE_LAYOUT);
    expect(pages.length).toBeGreaterThan(0);
    expect(texts(pages[0])).toEqual([
      'EXT. SPACE - OPENING SCROLL',
      'The camera tilts down to reveal a mid-sized space carrier.',
    ]);
  });

  it('…and the first surviving block starts at the top of the page', () => {
    setPaginationVisibility({ hideTitlePage: true });
    const pages = computePageBlocks(docOf(TITLE_AND_SCRIPT), DEFAULT_PAGE_LAYOUT);
    // The strange spacing was the skipped title's leading gap pushing this
    // down: the first block on a page always starts at line 0.
    expect(pages[0].blocks[0].lineStart).toBe(0);
  });

  it('SHOWN (Preview): the title page keeps its own blocks', () => {
    setPaginationVisibility({ hideTitlePage: false });
    const pages = computePageBlocks(docOf(TITLE_AND_SCRIPT), DEFAULT_PAGE_LAYOUT);
    const all = pages.flatMap(texts);
    expect(all).toContain('STAR WARS - EPISODE 8');
    expect(all).toContain('EXT. SPACE - OPENING SCROLL');
  });

  it('a script with no title page is unaffected either way', () => {
    const plain = [node('sceneHeading', 'INT. COFFEE SHOP - DAY'), node('action', 'Rain.')];
    for (const hide of [true, false]) {
      setPaginationVisibility({ hideTitlePage: hide });
      expect(texts(computePageBlocks(docOf(plain), DEFAULT_PAGE_LAYOUT)[0]))
        .toEqual(['INT. COFFEE SHOP - DAY', 'Rain.']);
    }
  });

  it('a doc that is ONLY a hidden title page yields no blocks to draw', () => {
    setPaginationVisibility({ hideTitlePage: true });
    const pages = computePageBlocks(docOf([TITLE_AND_SCRIPT[0], TITLE_AND_SCRIPT[1]]), DEFAULT_PAGE_LAYOUT);
    expect(pages.flatMap(texts)).toEqual([]);
  });
});
