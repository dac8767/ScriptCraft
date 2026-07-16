// @vitest-environment jsdom
/**
 * TableGridPicker (v2.62) — OneNote's insert-table grid. Pins: the grid is
 * 10×8, sweeping highlights the size and labels it cols×rows, clicking
 * reports (rows, cols), and newTable() actually builds that many cells.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { TableGridPicker, TABLE_GRID_COLS, TABLE_GRID_ROWS } from './NotebookTool';
import { newTable } from '../stores/notebookStore';

describe('TableGridPicker', () => {
  let host: HTMLElement;
  let root: Root;
  let picked: Array<[number, number]>;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    picked = [];
    act(() => {
      root.render(<TableGridPicker onPick={(r, c) => picked.push([r, c])} />);
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  const cells = () => Array.from(host.querySelectorAll('.fs-nb-tablegrid-cell')) as HTMLElement[];
  const cellAt = (ri: number, ci: number) => cells()[ri * TABLE_GRID_COLS + ci];

  it('renders the full 10×8 grid', () => {
    expect(cells()).toHaveLength(TABLE_GRID_COLS * TABLE_GRID_ROWS);
  });

  it('sweeping highlights the size and labels it cols×rows', () => {
    // Hover the cell at row 4, col 7 (0-indexed 3,6) — OneNote's "7x4 Table".
    act(() => { cellAt(3, 6).dispatchEvent(new MouseEvent('pointerover', { bubbles: true })); });
    expect(host.querySelector('.fs-nb-tablegrid-label')!.textContent).toBe('7×4 Table');
    expect(cells().filter((c) => c.classList.contains('on'))).toHaveLength(7 * 4);
    // The highlight is the top-left rectangle, not scattered cells.
    expect(cellAt(0, 0).classList.contains('on')).toBe(true);
    expect(cellAt(3, 6).classList.contains('on')).toBe(true);
    expect(cellAt(4, 0).classList.contains('on')).toBe(false);
    expect(cellAt(0, 7).classList.contains('on')).toBe(false);
  });

  it('clicking a cell picks (rows, cols)', () => {
    act(() => { cellAt(3, 6).dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(picked).toEqual([[4, 7]]);
  });
});

describe('newTable with dimensions', () => {
  it('builds the picked number of rows and columns', () => {
    const t = newTable(4, 7);
    expect(t.rows).toHaveLength(4);
    expect(t.rows.every((r) => r.length === 7)).toBe(true);
    expect(t.colWidths).toHaveLength(7);
    expect(t.rowHeights).toHaveLength(4);
  });

  it('keeps the legacy 2×2 default for bare calls', () => {
    const t = newTable();
    expect(t.rows).toHaveLength(2);
    expect(t.rows[0]).toHaveLength(2);
  });
});
