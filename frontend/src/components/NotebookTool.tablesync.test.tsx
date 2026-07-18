// @vitest-environment jsdom
/**
 * Scrapbook table cell sync (v3.84/v3.85) — Derek: "the table options are all
 * wrong." The Table menu's Insert/Delete row/column ops compute the right
 * indices relative to the active cell; the bug was in rendering.
 *
 * Cell <div>s are keyed by array index and are uncontrolled, so inserting or
 * deleting a row/column reuses a DOM node for a DIFFERENT logical cell. The
 * menu bar never blurs the cell, so the reused node stays focused — and v3.84's
 * "skip sync while focused" guard left that node showing its old text (insert
 * copied the active cell up; delete kept the value). v3.85 reconciles even the
 * focused cell.
 *
 * These render the real surface, FOCUS the active cell (as the app does), mutate
 * the page the way the menu does, and read the DOM back.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { NotebookSurface, tableInsertRow, tableDeleteRow, tableDeleteCol, boxAsTable } from './NotebookTool';
import { useNotebookStore, nbUid, type NbBox } from '../stores/notebookStore';

let host: HTMLElement;
let root: Root;
let pageId: string;

function addTable(rows: string[][]): NbBox {
  const box: NbBox = {
    id: nbUid(), type: 'table', x: 20, y: 20, w: 0, h: 0,
    rows, colWidths: rows[0].map(() => 90), rowHeights: rows.map(() => 32), align: 'left',
  };
  const page = useNotebookStore.getState().pages[pageId];
  useNotebookStore.getState().updatePage(pageId, { boxes: [...page.boxes, box] });
  return box;
}

function cells(): HTMLElement[] {
  return Array.from(host.querySelectorAll('.fs-nb-cell'));
}
function cellText(): string[] {
  return cells().map((c) => c.textContent || '');
}
/** Focus the cell at (ri, ci) in a rows×cols grid — mirrors clicking into it. */
function focusCell(ri: number, ci: number, cols: number) {
  act(() => { cells()[ri * cols + ci].focus(); });
}
function applyTable(box: NbBox, t: ReturnType<typeof boxAsTable>) {
  act(() => {
    useNotebookStore.getState().updatePage(pageId, {
      boxes: [{ ...box, rows: t.rows, rowHeights: t.rowHeights, colWidths: t.colWidths }],
    });
  });
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  pageId = useNotebookStore.getState().addPage();
  useNotebookStore.getState().selectPage(pageId);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('scrapbook table cell sync (focused cell)', () => {
  it('insert row above the FOCUSED cell does not copy it upward', () => {
    const box = addTable([['A', 'B'], ['C', 'D']]);
    act(() => root.render(<NotebookSurface />));
    expect(cellText()).toEqual(['A', 'B', 'C', 'D']);

    focusCell(1, 0, 2);                 // active cell = "C"
    expect(document.activeElement).toBe(cells()[2]);
    applyTable(box, tableInsertRow(boxAsTable(box), 1)); // Insert Row Above

    // Blank row lands ABOVE "C"; the active cell's value must not be duplicated.
    expect(cellText()).toEqual(['A', 'B', '', '', 'C', 'D']);
  });

  it('delete row removes the FOCUSED row and its value', () => {
    const box = addTable([['A', 'B'], ['C', 'D'], ['E', 'F']]);
    act(() => root.render(<NotebookSurface />));

    focusCell(1, 0, 2);                 // active cell = "C"
    applyTable(box, tableDeleteRow(boxAsTable(box), 1));
    expect(cellText()).toEqual(['A', 'B', 'E', 'F']);
  });

  it('delete column removes the FOCUSED column and its value', () => {
    const box = addTable([['A', 'B', 'C'], ['D', 'E', 'F']]);
    act(() => root.render(<NotebookSurface />));

    focusCell(0, 1, 3);                 // active cell = "B"
    expect(document.activeElement).toBe(cells()[1]);
    applyTable(box, tableDeleteCol(boxAsTable(box), 1));

    // Column "B/E" is gone — the value must not remain in the reused node.
    expect(cellText()).toEqual(['A', 'C', 'D', 'F']);
  });
});
