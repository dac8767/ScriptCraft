// @vitest-environment jsdom
/**
 * Scrapbook table interactions (v3.86):
 *  - clicking into a cell activates the box (bright border) — sets focusedBoxId
 *  - grid colour / thickness flow to CSS vars on the table wrap
 *  - right-click opens the Table context menu with the shared menu items
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { NotebookSurface } from './NotebookTool';
import { useNotebookStore, nbUid, type NbBox } from '../stores/notebookStore';

let host: HTMLElement;
let root: Root;
let pageId: string;

function addTable(rows: string[][], extra: Partial<NbBox> = {}): NbBox {
  const box: NbBox = {
    id: nbUid(), type: 'table', x: 20, y: 20, w: 0, h: 0,
    rows, colWidths: rows[0].map(() => 90), rowHeights: rows.map(() => 32), align: 'left', ...extra,
  };
  const page = useNotebookStore.getState().pages[pageId];
  useNotebookStore.getState().updatePage(pageId, { boxes: [...page.boxes, box] });
  return box;
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  pageId = useNotebookStore.getState().addPage();
  useNotebookStore.getState().selectPage(pageId);
  // The contextual menus (useScrapbookMenus) only exist while the tool is open,
  // exactly as when the panel is mounted alongside the surface in the app.
  useNotebookStore.getState().setNotebookOpen(true);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useNotebookStore.getState().setNotebookOpen(false);
  useNotebookStore.getState().setFocusedBox(null);
  useNotebookStore.getState().setFocusedCell(null);
});

describe('scrapbook table interactions', () => {
  it('focusing a cell activates the box (focusedBoxId)', () => {
    const box = addTable([['A', 'B'], ['C', 'D']]);
    act(() => root.render(<NotebookSurface />));
    expect(useNotebookStore.getState().focusedBoxId).not.toBe(box.id);

    const cell = host.querySelectorAll('.fs-nb-cell')[0] as HTMLElement;
    act(() => { cell.focus(); });
    expect(useNotebookStore.getState().focusedBoxId).toBe(box.id);
    expect(useNotebookStore.getState().focusedCell).toEqual({ boxId: box.id, ri: 0, ci: 0 });
  });

  it('grid colour and thickness become CSS vars on the table wrap', () => {
    addTable([['A']], { borderColor: '#3e9bff', borderW: 3 });
    act(() => root.render(<NotebookSurface />));
    const wrap = host.querySelector('.fs-nb-table-wrap') as HTMLElement;
    expect(wrap.style.getPropertyValue('--nb-grid-color')).toBe('#3e9bff');
    expect(wrap.style.getPropertyValue('--nb-grid-w')).toBe('3px');
  });

  it('right-clicking a table opens the Table context menu', () => {
    const box = addTable([['A', 'B'], ['C', 'D']]);
    act(() => root.render(<NotebookSurface />));

    const cell = host.querySelectorAll('.fs-nb-cell')[3] as HTMLElement; // bottom-right
    act(() => {
      cell.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 120, clientY: 90 }));
    });

    const menu = document.querySelector('.fs-nb-ctxmenu');
    expect(menu).toBeTruthy();
    // has-children rows carry a trailing ▸ arrow — strip it for comparison.
    const labels = Array.from(menu!.querySelectorAll('.menu-dropdown-item')).map((n) => (n.textContent || '').replace('▸', ''));
    expect(labels).toEqual(expect.arrayContaining(['Insert Row Above', 'Delete Table', 'Background Color', 'Grid Color', 'Grid Thickness']));
    // the right-clicked cell became active, so the row/col ops are enabled
    expect(useNotebookStore.getState().focusedCell).toEqual({ boxId: box.id, ri: 1, ci: 1 });
  });
});
