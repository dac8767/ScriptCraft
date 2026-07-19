// @vitest-environment jsdom
/**
 * Scrapbook delete-key (v3.89) — Delete/Backspace removes the selected box,
 * but never while the caret is inside editable text (text box or table cell).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { NotebookSurface } from './NotebookTool';
import { useNotebookStore, nbUid, type NbBox } from '../stores/notebookStore';

let host: HTMLElement;
let root: Root;
let pageId: string;

function setBoxes(boxes: NbBox[]) {
  useNotebookStore.getState().updatePage(pageId, { boxes });
}
function boxIds(): string[] {
  return useNotebookStore.getState().pages[pageId].boxes.map((b) => b.id);
}
function pressDelete() {
  act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true })); });
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
  useNotebookStore.getState().setFocusedBox(null);
  useNotebookStore.getState().setFocusedCell(null);
});

describe('scrapbook delete key', () => {
  it('deletes the selected image box', () => {
    const img: NbBox = { id: nbUid(), type: 'image', x: 20, y: 20, w: 120, h: 90, src: 'data:,' };
    setBoxes([img]);
    act(() => root.render(<NotebookSurface />));
    act(() => { useNotebookStore.getState().setFocusedBox(img.id); });
    (document.activeElement as HTMLElement)?.blur?.(); // nothing editable focused

    pressDelete();
    expect(boxIds()).not.toContain(img.id);
  });

  it('does NOT delete while typing in a text box', () => {
    const text: NbBox = { id: nbUid(), type: 'text', x: 20, y: 20, w: 200, h: 100, html: 'hi' };
    setBoxes([text]);
    act(() => root.render(<NotebookSurface />));
    act(() => { useNotebookStore.getState().setFocusedBox(text.id); });
    const body = host.querySelector('.fs-nb-box-body') as HTMLElement;
    act(() => { body.focus(); });               // caret is in editable text
    expect(document.activeElement).toBe(body);

    pressDelete();
    expect(boxIds()).toContain(text.id);        // Delete edits text, not the box
  });
});
