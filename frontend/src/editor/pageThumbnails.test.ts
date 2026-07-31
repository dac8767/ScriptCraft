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

describe('v5.71: includeTitlePage — the All Pages tab opt-in', () => {
  beforeEach(() => {
    setPaginationVisibility({ hideSections: false, hideTodos: false, doubleSpaceHeaders: false, hideTitlePage: false });
  });

  for (const hidden of [true, false]) {
    const mode = hidden ? 'hidden (Page/Continuous)' : 'shown (Preview)';

    it(`the title region comes back as an UNNUMBERED first page, ${mode}`, () => {
      setPaginationVisibility({ hideTitlePage: hidden });
      const pages = computePageBlocks(docOf(TITLE_AND_SCRIPT), DEFAULT_PAGE_LAYOUT, { includeTitlePage: true });
      expect(pages[0].isTitle).toBe(true);
      expect(pages[0].pageNumber).toBe(0);
      expect(texts(pages[0])).toEqual(['STAR WARS - EPISODE 8', 'Written by Derek Carl']);
      // script numbering is untouched — page 1 is still page 1, still clean
      const script = pages.filter((p) => !p.isTitle);
      expect(script[0].pageNumber).toBe(1);
      expect(texts(script[0])).toEqual([
        'EXT. SPACE - OPENING SCROLL',
        'The camera tilts down to reveal a mid-sized space carrier.',
      ]);
      expect(script[0].blocks[0].lineStart).toBe(0);
    });
  }

  it('no title page in the doc → no title entry, flag or not', () => {
    const plain = [node('sceneHeading', 'INT. COFFEE SHOP - DAY'), node('action', 'Rain.')];
    const pages = computePageBlocks(docOf(plain), DEFAULT_PAGE_LAYOUT, { includeTitlePage: true });
    expect(pages.some((p) => p.isTitle)).toBe(false);
  });

  it('a doc that is ONLY a title page previews as just the title page', () => {
    const pages = computePageBlocks(docOf([TITLE_AND_SCRIPT[0], TITLE_AND_SCRIPT[1]]), DEFAULT_PAGE_LAYOUT, { includeTitlePage: true });
    expect(pages).toHaveLength(1);
    expect(pages[0].isTitle).toBe(true);
  });

  it('the DEFAULT call still emits no title entry (the v5.13 rule holds)', () => {
    const pages = computePageBlocks(docOf(TITLE_AND_SCRIPT), DEFAULT_PAGE_LAYOUT);
    expect(pages.some((p) => p.isTitle)).toBe(false);
  });
});

describe('v5.73: the blocks carry what a TRUE title-page preview needs', () => {
  beforeEach(() => {
    setPaginationVisibility({ hideSections: false, hideTodos: false, doubleSpaceHeaders: false, hideTitlePage: false });
  });

  const FULL_TITLE = [
    node('titlePage', 'BELKADAN RISING', { field: 'title', tpTitleFontSize: 24 }),
    // as titlePageBlockSpecs builds it: title2's size rides tpTitleFontSize
    node('titlePage', 'Invasion of the Vong', { field: 'title2', tpTitleFontSize: 18 }),
    node('titlePage', 'Written by Derek Carl', { field: 'author' }),
    node('titlePage', '1st Draft - 2026-07-17', { field: 'draft' }),
    node('sceneHeading', 'EXT. SPACE - OPENING SCROLL'),
  ];

  it('every title block reports its field, so per-field alignment is reproducible', () => {
    const [title] = computePageBlocks(docOf(FULL_TITLE), DEFAULT_PAGE_LAYOUT, { includeTitlePage: true });
    expect(title.blocks.map((b) => b.titleField)).toEqual(['title', 'title2', 'author', 'draft']);
  });

  /* v5.74: BOTH title kinds keep their size in tpTitleFontSize — that's what
     titlePageBlockSpecs writes onto a title2 node ({field:'title2',
     tpTitleFontSize: data.tpTitle2FontSize}) and what renderHTML, the line
     budget and the PDF read. The v5.73 fixture set tpTitle2FontSize on the
     node, which no real title2 node carries — so the test passed while the
     app previewed title2 at 12pt. Fixture now matches the builder. */
  it('title and title2 both report their size from tpTitleFontSize', () => {
    const [title] = computePageBlocks(docOf(FULL_TITLE), DEFAULT_PAGE_LAYOUT, { includeTitlePage: true });
    expect(title.blocks[0].fontSizePt).toBe(24);
    expect(title.blocks[1].fontSizePt).toBe(18);
    // a plain credit line has no size of its own
    expect(title.blocks[2].fontSizePt).toBeUndefined();
  });

  it('script blocks carry no title fields at all', () => {
    const pages = computePageBlocks(docOf(FULL_TITLE), DEFAULT_PAGE_LAYOUT, { includeTitlePage: true });
    const script = pages.find((p) => !p.isTitle)!;
    expect(script.blocks.every((b) => b.titleField === undefined)).toBe(true);
  });

  it('an image on the title page stays ON the title page, with its line budget', () => {
    const withLogo = [
      node('titlePage', 'BELKADAN RISING', { field: 'title' }),
      node('screenplayImage', '', { heightLines: 10 }),
      node('titlePage', 'Written by Derek Carl', { field: 'author' }),
      node('sceneHeading', 'EXT. SPACE - OPENING SCROLL'),
      node('action', 'A ship drifts.'),
    ];
    const pages = computePageBlocks(docOf(withLogo), DEFAULT_PAGE_LAYOUT, { includeTitlePage: true });
    const image = pages[0].blocks.find((b) => b.typeName === 'screenplayImage');
    expect(pages[0].isTitle).toBe(true);
    expect(image?.imageLines).toBe(10);
    // …and NOT on script page 1 — the editor draws it on the title page
    const script = pages.find((p) => !p.isTitle)!;
    expect(script.blocks.some((b) => b.typeName === 'screenplayImage')).toBe(false);
    expect(script.blocks[0].text).toBe('EXT. SPACE - OPENING SCROLL');
  });

  it('a leading image with NO title page is body content, left where it is', () => {
    const noTitle = [
      node('screenplayImage', '', { heightLines: 6 }),
      node('sceneHeading', 'INT. COFFEE SHOP - DAY'),
    ];
    const pages = computePageBlocks(docOf(noTitle), DEFAULT_PAGE_LAYOUT, { includeTitlePage: true });
    expect(pages.some((p) => p.isTitle)).toBe(false);
    expect(pages[0].blocks[0].typeName).toBe('screenplayImage');
  });
});
