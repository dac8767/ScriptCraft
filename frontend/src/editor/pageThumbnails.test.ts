// @vitest-environment jsdom
/**
 * computePageBlocks + the title page (v4.95 → v5.01 → v5.13).
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

  /* v5.13, Derek: "remove title page from the page tool" — reversing his
     v5.01 "show the title page in Pages tool". The preview shows SCRIPT
     pages only, in BOTH visibility modes. What must survive the reversal is
     the v5.01 splitting fix: title text never bleeds into page 1 (the v4.95
     "strange spacing"), and page 1 starts at line 0 as if the title run
     never existed. */
  for (const hidden of [true, false]) {
    const mode = hidden ? 'hidden (Page/Continuous)' : 'shown (Preview)';

    it(`no title page in the preview, ${mode}`, () => {
      setPaginationVisibility({ hideTitlePage: hidden });
      const pages = computePageBlocks(docOf(TITLE_AND_SCRIPT), DEFAULT_PAGE_LAYOUT);
      expect(pages.some((p) => p.pageNumber === 0)).toBe(false);
      expect(pages.flatMap(texts)).not.toContain('STAR WARS - EPISODE 8');
    });

    it(`script page 1 carries no title-page text and starts at line 0, ${mode}`, () => {
      setPaginationVisibility({ hideTitlePage: hidden });
      const pages = computePageBlocks(docOf(TITLE_AND_SCRIPT), DEFAULT_PAGE_LAYOUT);
      expect(texts(pages[0])).toEqual([
        'EXT. SPACE - OPENING SCROLL',
        'The camera tilts down to reveal a mid-sized space carrier.',
      ]);
      // The strange spacing was the skipped title's leading gap pushing this
      // down: the first block on a page always starts at line 0.
      expect(pages[0].blocks[0].lineStart).toBe(0);
    });
  }

  it('a script with NO title page is untouched by the trim', () => {
    const plain = [node('sceneHeading', 'INT. COFFEE SHOP - DAY'), node('action', 'Rain.')];
    for (const hide of [true, false]) {
      setPaginationVisibility({ hideTitlePage: hide });
      const pages = computePageBlocks(docOf(plain), DEFAULT_PAGE_LAYOUT);
      expect(pages.some((p) => p.pageNumber === 0)).toBe(false);
      expect(texts(pages[0])).toEqual(['INT. COFFEE SHOP - DAY', 'Rain.']);
    }
  });

  it('a doc that is ONLY a title page previews as no pages at all', () => {
    for (const hide of [true, false]) {
      setPaginationVisibility({ hideTitlePage: hide });
      const pages = computePageBlocks(docOf([TITLE_AND_SCRIPT[0], TITLE_AND_SCRIPT[1]]), DEFAULT_PAGE_LAYOUT);
      expect(pages).toHaveLength(0);   // the tool's own "No pages yet" empty state
    }
  });
});
