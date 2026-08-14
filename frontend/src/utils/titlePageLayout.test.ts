// @vitest-environment jsdom
/**
 * titlePageLayout (v2.25) — pins the classic title-page layout builder as
 * pure data, so a constant tweak can't silently reshuffle every imported or
 * edited title page:
 *  - deriveTitleFields: how the structured fields collapse into the three
 *    rendered credit lines (byLine / draftLine / copyrightLine);
 *  - titlePageBlockSpecs: the exact block sequence and line budget — title
 *    ~1/3 down (TITLE_LINE=15), bottom block pushed toward PAGE_LINES=50,
 *    aboveLines/belowLines carving space for title-page images, the gap
 *    floor of 2, and enlarged titles shrinking the gap via
 *    titlePageBlockLines (the paginator's own accounting);
 *  - titlePageJsonNodes: the TipTap JSON shape the importers splice in
 *    (content omitted for empty text, structured attrs riding on `title`);
 *  - EMPTY_TITLE_PAGE: the blank-slate invariants every caller spreads.
 *
 * jsdom: the import chain reaches editor/pagination → stores/editorStore.
 * All expected numbers below are hand-computed from the source constants.
 */
import { describe, it, expect } from 'vitest';
import type { TitleBlockSpec, TitlePageData } from './titlePageLayout';
import {
  EMPTY_TITLE_PAGE,
  deriveTitleFields,
  titlePageBlockSpecs,
  titlePageJsonNodes,
  stackTitlePageBlocks,
} from './titlePageLayout';

/** Data constructor: blank slate + overrides, like the Title Page editor does. */
const tp = (o: Partial<TitlePageData> = {}): TitlePageData => ({ ...EMPTY_TITLE_PAGE, ...o });

const fieldsOf = (blocks: TitleBlockSpec[]) => blocks.map((b) => b.field);
const countBlanks = (blocks: TitleBlockSpec[]) => blocks.filter((b) => b.field === 'blank').length;

describe('EMPTY_TITLE_PAGE', () => {
  it('is a fully blank slate: every text field empty, both font sizes 12', () => {
    expect(EMPTY_TITLE_PAGE).toEqual({
      tpTitle: '',
      tpTitle2: '',
      tpTitle2FontSize: 12,
      tpWrittenBy: '',
      tpBasedOn: '',
      tpDraft: '',
      tpDraftDate: '',
      tpContact: '',
      tpCopyright: '',
      tpWgaRegistration: '',
      tpNotes: '',
      tpTitleFontSize: 12,
    });
  });
});

describe('deriveTitleFields', () => {
  it('returns three empty lines for a blank title page', () => {
    expect(deriveTitleFields(EMPTY_TITLE_PAGE)).toEqual({ byLine: '', draftLine: '', copyrightLine: '' });
  });

  it('builds the byLine from writtenBy, appending basedOn on its own line', () => {
    expect(deriveTitleFields(tp({ tpWrittenBy: 'Derek Carl' })).byLine).toBe('Written by Derek Carl');
    expect(deriveTitleFields(tp({ tpWrittenBy: 'Derek Carl', tpBasedOn: 'Based on a true story' })).byLine)
      .toBe('Written by Derek Carl\nBased on a true story');
  });

  it('a lone basedOn (no writtenBy) still reaches the page as the byLine', () => {
    expect(deriveTitleFields(tp({ tpBasedOn: 'Based on a true story' })).byLine).toBe('Based on a true story');
  });

  it('joins draft + date with " - ", and either alone stands by itself', () => {
    expect(deriveTitleFields(tp({ tpDraft: 'First Draft', tpDraftDate: 'July 2026' })).draftLine)
      .toBe('First Draft - July 2026');
    expect(deriveTitleFields(tp({ tpDraft: 'First Draft' })).draftLine).toBe('First Draft');
    expect(deriveTitleFields(tp({ tpDraftDate: 'July 2026' })).draftLine).toBe('July 2026');
  });

  it('stacks copyright and WGA registration on separate lines', () => {
    expect(deriveTitleFields(tp({ tpCopyright: 'Copyright 2026 Derek Carl', tpWgaRegistration: 'WGA #123456' })).copyrightLine)
      .toBe('Copyright 2026 Derek Carl\nWGA #123456');
    expect(deriveTitleFields(tp({ tpWgaRegistration: 'WGA #123456' })).copyrightLine).toBe('WGA #123456');
  });
});

describe('titlePageBlockSpecs', () => {
  it('blank data → 14 top spacers + one title block, no bottom section', () => {
    // topSpacers = max(2, TITLE_LINE(15) - 1 - 0) = 14; empty bottom and
    // belowLines=0 means no gap blanks are emitted at all.
    const blocks = titlePageBlockSpecs(EMPTY_TITLE_PAGE);
    expect(blocks).toHaveLength(15);
    expect(fieldsOf(blocks)).toEqual([...Array(14).fill('blank'), 'title']);
    expect(blocks[0]).toEqual({ field: 'blank', text: '', attrs: { field: 'blank' } });
    // The title block carries the FULL structured data in its attrs.
    expect(blocks[14].attrs).toEqual({ field: 'title', ...EMPTY_TITLE_PAGE });
  });

  it('full classic layout: title at line 15, credit after 2 blanks, bottom pushed to line ~50', () => {
    const data = tp({
      tpTitle: 'MY SCRIPT',
      tpWrittenBy: 'Derek Carl',
      tpBasedOn: 'Based on a true story',
      tpDraft: 'First Draft',
      tpDraftDate: 'July 2026',
      tpContact: 'derek@example.com',
      tpCopyright: 'Copyright 2026 Derek Carl',
      tpWgaRegistration: 'WGA #123456',
    });
    const blocks = titlePageBlockSpecs(data);
    // used = 14 spacers + 1 title line + 2 blanks + 2 author lines (the byLine
    // renders "Written by …" and the basedOn as TWO lines, and the budget now
    // counts them) = 19.
    // bottomLines = draft(1) + contact(1) + copyright(2) = 4.
    // gap = max(2, 50 - 19 - 4 - 0) = 27.
    expect(fieldsOf(blocks)).toEqual([
      ...Array(14).fill('blank'),
      'title',
      'blank', 'blank', 'author',
      ...Array(27).fill('blank'),
      'draft', 'contact', 'copyright',
    ]);
    expect(blocks).toHaveLength(48);
    expect(blocks[17].text).toBe('Written by Derek Carl\nBased on a true story');
    expect(blocks[45].text).toBe('First Draft - July 2026');
    expect(blocks[46].text).toBe('derek@example.com');
    expect(blocks[47].text).toBe('Copyright 2026 Derek Carl\nWGA #123456');
    // Non-title blocks carry only their field id.
    expect(blocks[17].attrs).toEqual({ field: 'author' });
    expect(blocks[45].attrs).toEqual({ field: 'draft' });
  });

  it('tpNotes lands in the bottom block under the field id "date"', () => {
    // KNOWN LIMITATION (naming quirk): notes are emitted as field 'date',
    // not 'notes' — renaming the id would orphan saved scripts, so pin it.
    const blocks = titlePageBlockSpecs(tp({ tpNotes: 'For your consideration' }));
    // used = 14 + 1 = 15; bottomLines = 1; gap = max(2, 50 - 15 - 1) = 34.
    expect(blocks).toHaveLength(50);
    const last = blocks[49];
    expect(last.field).toBe('date');
    expect(last.text).toBe('For your consideration');
    expect(last.attrs).toEqual({ field: 'date' });
  });

  it('title2 follows the title and reuses the tpTitleFontSize attr key for ITS OWN size', () => {
    const blocks = titlePageBlockSpecs(tp({
      tpTitle: 'T',
      tpTitle2: 'SUB',
      tpTitle2FontSize: 24,
      tpDraft: 'Draft',
    }));
    // title2 at 24pt costs 2 line slots (1 wrapped line x ceil(24/12)):
    // used = 14 + 1 + 2 = 17; gap = max(2, 50 - 17 - 1) = 32.
    expect(fieldsOf(blocks)).toEqual([
      ...Array(14).fill('blank'), 'title', 'title2', ...Array(32).fill('blank'), 'draft',
    ]);
    // Pinned: the title2 block stores its size under `tpTitleFontSize`
    // (the renderer reads that one key for every sized block).
    expect(blocks[15].attrs).toEqual({ field: 'title2', tpTitleFontSize: 24 });
  });

  it('an enlarged title eats into the gap so the bottom block stays on the page', () => {
    const at = (size: number) =>
      titlePageBlockSpecs(tp({ tpTitle: 'MY GREAT ADVENTURE', tpTitleFontSize: size, tpDraft: 'Draft' }));
    // 12pt: title costs 1 line → used 15 → gap = 50 - 15 - 1 = 34.
    // 72pt: cpl = max(8, floor(62*12/72)) = 10 → "MY GREAT ADVENTURE"
    // wraps to 2 lines x ceil(72/12)=6 slots = 12 → used 26 → gap 23.
    expect(countBlanks(at(12))).toBe(14 + 34);
    expect(countBlanks(at(72))).toBe(14 + 23);
    // Same block sequence either way, just a shorter gap.
    expect(fieldsOf(at(72)).filter((f) => f !== 'blank')).toEqual(['title', 'draft']);
  });

  it('aboveLines shrinks the top spacers, with a floor of 2', () => {
    expect(countBlanks(titlePageBlockSpecs(EMPTY_TITLE_PAGE, 5))).toBe(9);   // max(2, 14-5)
    expect(countBlanks(titlePageBlockSpecs(EMPTY_TITLE_PAGE, 50))).toBe(2);  // floored
  });

  it('belowLines alone forces the bottom gap (blanks) even with no bottom fields', () => {
    // used = 15; gap = max(2, 50 - 15 - 0 - 10) = 25 → 14 + 25 blanks + title.
    const blocks = titlePageBlockSpecs(EMPTY_TITLE_PAGE, 0, 10);
    expect(blocks).toHaveLength(40);
    expect(countBlanks(blocks)).toBe(39);
    // Oversized belowLines hits the gap floor of 2.
    expect(titlePageBlockSpecs(EMPTY_TITLE_PAGE, 0, 40)).toHaveLength(14 + 1 + 2);
  });

  it('aboveLines counts toward the budget, keeping the bottom block anchored', () => {
    // aboveLines=5: topSpacers = 9, used = 5 + 9 + 1 = 15 — the SAME used
    // as no images, so the gap before the draft line stays 34.
    const blocks = titlePageBlockSpecs(tp({ tpDraft: 'Draft' }), 5);
    expect(fieldsOf(blocks)).toEqual([
      ...Array(9).fill('blank'), 'title', ...Array(34).fill('blank'), 'draft',
    ]);
  });
});

describe('titlePageJsonNodes', () => {
  it('maps every spec to a titlePage node, omitting content for empty text', () => {
    const data = tp({ tpTitle: 'T', tpDraft: 'D' });
    const nodes = titlePageJsonNodes(data);
    expect(nodes).toHaveLength(titlePageBlockSpecs(data).length);
    expect(nodes.every((n) => n.type === 'titlePage')).toBe(true);
    // Spacers: no content key at all (not an empty array).
    expect(nodes[0]).toEqual({ type: 'titlePage', attrs: { field: 'blank' } });
    expect('content' in nodes[0]).toBe(false);
    // Text blocks: single text child.
    expect(nodes[14]).toEqual({
      type: 'titlePage',
      attrs: { field: 'title', ...data },
      content: [{ type: 'text', text: 'T' }],
    });
    expect(nodes[nodes.length - 1]).toEqual({
      type: 'titlePage',
      attrs: { field: 'draft' },
      content: [{ type: 'text', text: 'D' }],
    });
  });

  it('a blank title page yields a title node with attrs but no content', () => {
    const nodes = titlePageJsonNodes(EMPTY_TITLE_PAGE);
    expect(nodes).toHaveLength(15);
    // The empty-string title gets no text child either — same falsy-text
    // rule as the spacers — but keeps the full structured attrs.
    expect(nodes[14]).toEqual({ type: 'titlePage', attrs: { field: 'title', ...EMPTY_TITLE_PAGE } });
  });
});

/**
 * v7.09, Derek: "i exported a title page as a pdf and it did not export all of
 * the information." His page — 32pt title, subtitle, credit, draft, contact,
 * copyright + WGA, notes — went to PDF with everything below the credit line
 * missing. The exporter added 4pt after each of the ~45 blocks, drifted ~180pt
 * past the page and then silently skipped whatever no longer fit.
 *
 * These drive the stacker with US Letter's real numbers: 792pt tall, 72pt
 * margins ⇒ 648pt of usable height, 12pt lines.
 */
describe('stackTitlePageBlocks (v7.09)', () => {
  const LINE = 12;
  const AVAIL = 792 - 72 - 72;   // US Letter, 1in margins → 648pt = 54 lines

  /** Derek's title page, as the blocks the PDF exporter builds from it. */
  const derekBlocks = () => {
    const data = tp({
      tpTitle: 'SCRIPTCRAFT',
      tpTitleFontSize: 32,
      tpTitle2: '"The best screenwriting app in the world ... for free."',
      tpWrittenBy: 'You',
      tpDraft: '1st Draft',
      tpContact: 'Name\nAgency\nemail@example.com',
      tpCopyright: 'Copyright 2026 Author Name',
      tpWgaRegistration: 'WGAw #123456',
      tpNotes: 'No code? Join our newsletter for updates about a public release.',
    });
    const specs = titlePageBlockSpecs(data);
    const blocks = specs.map((s) => ({
      blank: !s.text.trim(),
      heightPt: Math.max(1, s.text.split('\n').length) * (s.field === 'title' ? 32 : LINE),
    }));
    return { specs, blocks };
  };

  it("keeps every line of Derek's title page on the page", () => {
    const { specs, blocks } = derekBlocks();
    const placed = stackTitlePageBlocks(blocks, AVAIL, LINE);
    const dropped = specs.filter((s, i) => placed[i].skipped && s.text.trim()).map((s) => s.field);
    expect(dropped).toEqual([]);
    for (let i = 0; i < specs.length; i++) {
      if (!specs[i].text.trim()) continue;
      expect(placed[i].y + blocks[i].heightPt, specs[i].field).toBeLessThanOrEqual(AVAIL);
    }
  });

  it('puts the title about a third down and the bottom block near the bottom', () => {
    const { specs, blocks } = derekBlocks();
    const placed = stackTitlePageBlocks(blocks, AVAIL, LINE);
    const yOf = (field: string) => placed[specs.findIndex((s) => s.field === field)].y;
    expect(yOf('title')).toBeGreaterThan(AVAIL * 0.2);
    expect(yOf('title')).toBeLessThan(AVAIL * 0.45);
    // draft / contact / copyright / notes all sit in the bottom third
    expect(yOf('draft')).toBeGreaterThan(AVAIL * 0.6);
    expect(yOf('date')).toBeGreaterThan(yOf('copyright'));
  });

  it('stacks on the grid with no per-block padding', () => {
    // Three 12pt lines land at 0, 12, 24 — the drift bug made them 0, 16, 32.
    const placed = stackTitlePageBlocks(
      [{ blank: false, heightPt: 12 }, { blank: false, heightPt: 12 }, { blank: false, heightPt: 12 }],
      AVAIL, LINE,
    );
    expect(placed.map((p) => p.y)).toEqual([0, 12, 24]);
  });

  it('trims blank lines — widest gap first — rather than dropping content', () => {
    // 4 lines of ink and 6 blanks into room for 8 lines: 2 blanks must go,
    // both from the 4-long run, and no inked line may be skipped.
    const blocks = [
      { blank: false, heightPt: 12 },
      { blank: true, heightPt: 12 }, { blank: true, heightPt: 12 },
      { blank: false, heightPt: 12 },
      { blank: true, heightPt: 12 }, { blank: true, heightPt: 12 },
      { blank: true, heightPt: 12 }, { blank: true, heightPt: 12 },
      { blank: false, heightPt: 12 }, { blank: false, heightPt: 12 },
    ];
    const placed = stackTitlePageBlocks(blocks, 8 * 12, LINE);
    expect(placed.filter((p, i) => p.skipped && !blocks[i].blank)).toEqual([]);
    expect(placed.filter((p) => p.skipped)).toHaveLength(2);
    expect([4, 5, 6, 7].filter((i) => placed[i].skipped)).toHaveLength(2);
    const lastInk = placed[9];
    expect(lastInk.y + 12).toBeLessThanOrEqual(8 * 12);
  });

  it('gives up trimming when only ink is left, instead of looping', () => {
    const blocks = Array.from({ length: 10 }, () => ({ blank: false, heightPt: 12 }));
    const placed = stackTitlePageBlocks(blocks, 24, LINE);
    expect(placed.filter((p) => p.skipped)).toHaveLength(0);   // nothing to trim
    expect(placed[9].y).toBe(108);
  });
});
