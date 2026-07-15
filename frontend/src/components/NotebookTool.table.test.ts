// @vitest-environment jsdom
/**
 * Scrapbook Table menu (v2.13) — pins the positional table helpers the
 * menu drives (Word's model: operations relative to the focused cell).
 */
import { describe, it, expect } from 'vitest';
import {
  tableInsertRow, tableDeleteRow, tableInsertCol, tableDeleteCol, tableSort,
} from './NotebookTool';
import type { NbTable } from '../stores/notebookStore';

const t: NbTable = {
  id: 't1',
  rows: [['b', '2'], ['a', '1'], ['c', '3']],
  colWidths: [90, 60],
  rowHeights: [30, 31, 32],
  align: 'left',
};

describe('positional table helpers', () => {
  it('inserts a row above/below the focused row', () => {
    const above = tableInsertRow(t, 1);
    expect(above.rows).toEqual([['b', '2'], ['', ''], ['a', '1'], ['c', '3']]);
    expect(above.rowHeights).toEqual([30, 32, 31, 32]);
    const below = tableInsertRow(t, 2);
    expect(below.rows[2]).toEqual(['', '']);
  });

  it('inserts a column left/right of the focused column', () => {
    const left = tableInsertCol(t, 0);
    expect(left.rows[0]).toEqual(['', 'b', '2']);
    expect(left.colWidths).toEqual([90, 90, 60]);
    const right = tableInsertCol(t, 2);
    expect(right.rows[0]).toEqual(['b', '2', '']);
  });

  it('deletes the focused row/column but never the last one', () => {
    expect(tableDeleteRow(t, 1).rows).toEqual([['b', '2'], ['c', '3']]);
    expect(tableDeleteCol(t, 1).rows[0]).toEqual(['b']);
    const one: NbTable = { ...t, rows: [['only']], colWidths: [90], rowHeights: [30] };
    expect(tableDeleteRow(one, 0)).toBe(one);
    expect(tableDeleteCol(one, 0)).toBe(one);
  });

  it('sorts rows by a column, heights traveling with their rows', () => {
    const asc = tableSort(t, 0, 'asc');
    expect(asc.rows.map((r) => r[0])).toEqual(['a', 'b', 'c']);
    expect(asc.rowHeights).toEqual([31, 30, 32]);
    const desc = tableSort(t, 0, 'desc');
    expect(desc.rows.map((r) => r[0])).toEqual(['c', 'b', 'a']);
  });
});
