// @vitest-environment jsdom
/**
 * Scrapbook table cell sync (v3.84) — Derek: "the table options are all wrong."
 *
 * The Table menu's Insert/Delete row/column ops act relative to the active cell
 * and were computing the right indices all along. The bug was in rendering: the
 * cell <div>s are keyed by array index and set their contentEditable text ONCE,
 * so inserting/deleting a row shifted the data under reused DOM nodes while the
 * text stayed put — every op LOOKED like it hit the wrong cell.
 *
 * This renders the real surface with a table, mutates the page the way the menu
 * does, and reads the DOM back to prove the displayed cells follow the data.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { NotebookSurface, tableInsertRow, tableDeleteRow, boxAsTable } from './NotebookTool';
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

function cellText(): string[] {
  return Array.from(host.querySelectorAll('.fs-nb-cell')).map((c) => c.textContent || '');
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

describe('scrapbook table cell sync', () => {
  it('insert row above the active cell shifts the DISPLAYED text, not just the data', () => {
    const box = addTable([['A', 'B'], ['C', 'D']]);
    act(() => root.render(<NotebookSurface />));
    expect(cellText()).toEqual(['A', 'B', 'C', 'D']);

    // Insert a blank row above the second row (active cell ri = 1), exactly as
    // the Table menu's "Insert Row Above" does.
    act(() => {
      const t = tableInsertRow(boxAsTable(box), 1);
      useNotebookStore.getState().updatePage(pageId, {
        boxes: [{ ...box, rows: t.rows, rowHeights: t.rowHeights, colWidths: t.colWidths }],
      });
    });
    // A B / (blank) (blank) / C D — the reused DOM cells must reflect the shift.
    expect(cellText()).toEqual(['A', 'B', '', '', 'C', 'D']);
  });

  it('delete row removes the right row from the display', () => {
    const box = addTable([['A', 'B'], ['C', 'D'], ['E', 'F']]);
    act(() => root.render(<NotebookSurface />));
    expect(cellText()).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);

    act(() => {
      const t = tableDeleteRow(boxAsTable(box), 1); // delete the middle row
      useNotebookStore.getState().updatePage(pageId, {
        boxes: [{ ...box, rows: t.rows, rowHeights: t.rowHeights, colWidths: t.colWidths }],
      });
    });
    expect(cellText()).toEqual(['A', 'B', 'E', 'F']);
  });
});
