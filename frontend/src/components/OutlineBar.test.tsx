// @vitest-environment jsdom
/**
 * OutlineBar (v1.75) — pins the page-placement math and the data-link
 * contract: markers ARE the Outline tool's beats (same store objects), and
 * removing one from a lane never deletes it from the board.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import OutlineBar, { snapPage, markerGeometry, columnRanges, navThumbGeometry, layoutBarBeats, planBeatDrop, DEFAULT_COLUMN_PAGES, type BarBeatItem } from './OutlineBar';
import { useEditorStore } from '../stores/editorStore';

describe('placement math', () => {
  /* v2.16, Derek: whole pages only — no decimals. */
  it('snaps to whole pages and clamps to the document', () => {
    expect(snapPage(2.3, 1, 10)).toBe(2);
    expect(snapPage(0.2, 1, 10)).toBe(1);          // never before page 1
    expect(snapPage(99, 1, 10)).toBe(10);          // last valid start: page 10
  });

  it('computes left/width as fractions of the page count', () => {
    const g = markerGeometry(6, 1, 10);
    expect(g.leftPct).toBe(50);
    expect(g.widthPct).toBe(10);
  });

  /* v2.11 — the acts row: columns pack from page 1 by their budgets. */
  it('columnRanges packs sections sequentially by target pages', () => {
    const ranges = columnRanges([
      { id: 'a2', title: 'Act II', position: 1, width: 0, targetPages: 45 },
      { id: 'a1', title: 'Act I', position: 0, width: 0, targetPages: 30 },
      { id: 'a3', title: 'Act III', position: 2, width: 0, targetPages: 40 },
    ]);
    expect(ranges.map((r) => [r.title, r.start, r.pages])).toEqual([
      ['Act I', 1, 30], ['Act II', 31, 45], ['Act III', 76, 40],
    ]);
    expect(ranges.reduce((s, r) => s + r.pages, 0)).toBe(115);   // Derek's example
  });

  it('a section without a budget gets the default block', () => {
    const [r] = columnRanges([{ id: 'c', title: 'C', position: 0, width: 0 }]);
    expect(r.pages).toBe(DEFAULT_COLUMN_PAGES);
  });

  /* v2.28: the navigator thumb — one bar scrolls and rescales. */
  it('navigator thumb spans the visible fraction and tracks the scroll', () => {
    // Everything visible → thumb fills the bar and can't move.
    const full = navThumbGeometry(0, 800, 800);
    expect(full.width).toBe(800);
    expect(full.left).toBe(0);
    expect(full.maxScroll).toBe(0);
    // Half visible → half-width thumb; scrolled to the end → thumb at the end.
    const half = navThumbGeometry(800, 800, 1600);
    expect(half.width).toBe(400);
    expect(half.left).toBe(400);          // maxThumbL, since scrollX = maxScroll
    // Tiny visible fraction still leaves a grabbable 24px thumb.
    expect(navThumbGeometry(0, 800, 100000).width).toBe(24);
  });
});

/* v2.30, Derek: the bar shows EVERY beat automatically — positions derive
   from section + board order + span. Nothing is "placed" by hand. */
describe('derived beat layout', () => {
  it('packs each section\'s beats from its start page, in board order', () => {
    const ranges = [
      { id: 'A', start: 1, pages: 10 },
      { id: 'B', start: 11, pages: 10 },
    ];
    const layout = layoutBarBeats(ranges, [
      { id: 'b2', columnId: 'A', position: 1, span: 3 },
      { id: 'b1', columnId: 'A', position: 0, span: 2 },
      { id: 'b3', columnId: 'B', position: 0, span: 1 },
    ]);
    expect(layout.get('b1')).toEqual({ page: 1, span: 2 });
    expect(layout.get('b2')).toEqual({ page: 3, span: 3 });     // after b1
    expect(layout.get('b3')).toEqual({ page: 11, span: 1 });    // section B's start
  });

  it('beats without a section on this tab pack after the last section', () => {
    const layout = layoutBarBeats(
      [{ id: 'A', start: 1, pages: 10 }],
      [
        { id: 'in', columnId: 'A', position: 0, span: 2 },
        { id: 'orphan', columnId: 'gone', position: 0, span: 3 },
      ],
    );
    expect(layout.get('orphan')).toEqual({ page: 11, span: 3 });
  });
});

/* v2.60, Derek: a beat doesn't snap to its section's start — it keeps the
   page it was dropped on, anywhere inside the section. The board is only
   written when the drop changes its section or its order among siblings. */
describe('hand-placed beats (v2.60)', () => {
  const A = { id: 'A', start: 1, pages: 10 };
  const B = { id: 'B', start: 11, pages: 10 };

  it('a pinned beat renders at its offset; the pack continues after it', () => {
    const layout = layoutBarBeats([A], [
      { id: 'b1', columnId: 'A', position: 0, span: 2 },
      { id: 'b2', columnId: 'A', position: 1, span: 3, offset: 5 },
      { id: 'b3', columnId: 'A', position: 2, span: 1 },
    ]);
    expect(layout.get('b1')).toEqual({ page: 1, span: 2 });
    expect(layout.get('b2')).toEqual({ page: 6, span: 3 });    // start + 5
    expect(layout.get('b3')).toEqual({ page: 9, span: 1 });    // after the pin, not on top of it
  });

  it('a pin clamps inside its section', () => {
    const layout = layoutBarBeats([A], [{ id: 'b', columnId: 'A', position: 0, span: 1, offset: 99 }]);
    expect(layout.get('b')!.page).toBe(10);                    // the section's last page
  });

  it('pins that contradict board order are stale — the section re-packs', () => {
    const layout = layoutBarBeats([A], [
      { id: 'first', columnId: 'A', position: 0, span: 1, offset: 5 },
      { id: 'second', columnId: 'A', position: 1, span: 1, offset: 2 },
    ]);
    expect(layout.get('first')).toEqual({ page: 1, span: 1 });
    expect(layout.get('second')).toEqual({ page: 2, span: 1 });
  });

  describe('planBeatDrop', () => {
    const ranges = [A, B];
    const items: BarBeatItem[] = [
      { id: 'b1', columnId: 'A', position: 0, span: 2 },
      { id: 'b2', columnId: 'A', position: 1, span: 2 },
      { id: 'b3', columnId: 'B', position: 0, span: 1 },
    ];
    const layout = layoutBarBeats(ranges, items);   // b1 p1, b2 p3, b3 p11

    it('a nudge within the section keeps board order — bar-only', () => {
      const plan = planBeatDrop(ranges, items, layout, 'b2', 7, 2)!;
      expect(plan.boardChanged).toBe(false);
      expect(plan.sectionId).toBe('A');
      expect(plan.offsets.b2).toBe(6);              // pinned at page 7
      expect(plan.offsets.b1).toBe(0);              // sibling frozen where it renders
      expect(plan.offsets.b3).toBeUndefined();      // other sections untouched
    });

    it('crossing a sibling changes the order — board committed', () => {
      const plan = planBeatDrop(ranges, items, layout, 'b1', 5, 2)!;   // past b2 (p3)
      expect(plan.boardChanged).toBe(true);
      expect(plan.index).toBe(1);
      expect(plan.offsets.b1).toBe(4);
    });

    it('landing in another section commits and freezes both sections', () => {
      const plan = planBeatDrop(ranges, items, layout, 'b1', 12, 2)!;
      expect(plan.boardChanged).toBe(true);
      expect(plan.sectionId).toBe('B');
      expect(plan.offsets.b1).toBe(1);              // 12 − section B's start
      expect(plan.offsets.b2).toBe(2);              // the section it left, frozen
      expect(plan.offsets.b3).toBe(0);              // the section it joined, frozen
    });
  });
});

describe('data link with the Outline tool', () => {
  let host: HTMLElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    useEditorStore.setState({
      beatColumns: [{ id: 'c1', title: 'Act I', position: 0, width: 0, targetPages: 10 }],
      beats: [
        { id: 'b1', title: 'Inciting Incident', description: '', columnId: 'c1', position: 0, color: '#ef4444', imageUrl: '', cardWidth: 0, cardHeight: 0, x: 0, y: 0, imageHeight: 0, outlineSpan: 2 },
        { id: 'b2', title: 'Midpoint', description: '', columnId: 'c1', position: 1, color: '', imageUrl: '', cardWidth: 0, cardHeight: 0, x: 0, y: 0, imageHeight: 0 },
      ],
      pageCount: 10,
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    useEditorStore.setState({ beats: [], beatColumns: [], pageCount: 1 });
    useEditorStore.getState().resetOutlineTabs();
  });

  it('renders EVERY beat, packed under its section — no placing required', () => {
    act(() => { root.render(<OutlineBar editor={null} />); });
    const markers = Array.from(host.querySelectorAll('.fs-ob-beat')) as HTMLElement[];
    expect(markers).toHaveLength(2);
    expect(markers[0].textContent).toContain('Inciting Incident');
    expect(markers[0].style.left).toBe('0%');       // Act I starts at page 1
    expect(markers[1].textContent).toContain('Midpoint');
    expect(markers[1].style.left).toBe('20%');      // after the 2-page opener: (3-1)/10
  });
});
