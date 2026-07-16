// @vitest-environment jsdom
/**
 * OutlineBar (v1.75) — pins the page-placement math and the data-link
 * contract: markers ARE the Outline tool's beats (same store objects), and
 * removing one from a lane never deletes it from the board.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import OutlineBar, { snapPage, markerGeometry, columnRanges, DEFAULT_COLUMN_PAGES } from './OutlineBar';
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
});

describe('data link with the Outline tool', () => {
  let host: HTMLElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    useEditorStore.setState({
      beats: [
        { id: 'b1', title: 'Inciting Incident', description: '', columnId: 'c1', position: 0, color: '#ef4444', imageUrl: '', cardWidth: 0, cardHeight: 0, x: 0, y: 0, imageHeight: 0, outlineLane: 0, outlinePage: 3, outlineSpan: 0.5 },
        { id: 'b2', title: 'Midpoint', description: '', columnId: 'c1', position: 1, color: '', imageUrl: '', cardWidth: 0, cardHeight: 0, x: 0, y: 0, imageHeight: 0 },
      ],
      pageCount: 10,
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    useEditorStore.setState({ beats: [], pageCount: 1 });
  });

  it('renders placed beats as markers and offers unplaced ones in Place…', () => {
    act(() => { root.render(<OutlineBar editor={null} />); });
    const marker = host.querySelector('.fs-ob-beat') as HTMLElement;
    expect(marker.textContent).toContain('Inciting Incident');
    expect(marker.style.left).toBe('20%');          // (3-1)/10
    const placeOptions = Array.from(host.querySelectorAll('select option')).map((o) => o.textContent);
    expect(placeOptions).toContain('Midpoint');
  });

  it('removing from a lane keeps the beat on the board', () => {
    act(() => { root.render(<OutlineBar editor={null} />); });
    const x = host.querySelector('.fs-ob-beat-x') as HTMLElement;
    act(() => { x.click(); });
    const beats = useEditorStore.getState().beats;
    expect(beats.find((b) => b.id === 'b1')).toBeTruthy();          // still exists
    expect(beats.find((b) => b.id === 'b1')!.outlineLane).toBeUndefined();
    expect(host.querySelectorAll('.fs-ob-beat').length).toBe(0);    // off the lane
  });
});
