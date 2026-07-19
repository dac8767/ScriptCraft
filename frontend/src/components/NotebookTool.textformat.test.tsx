// @vitest-environment jsdom
/**
 * Scrapbook text-box formatting persistence (v3.86).
 *
 * The toolbar's B/I/U / font / size / colour controls run execCommand on the
 * focused box, then applyScrapbookTextFormat writes the resulting HTML back to
 * the store — before, formatting changes weren't saved. jsdom's execCommand is
 * a no-op, so we simulate the DOM change it makes and assert the store persists
 * it. (The execCommand behaviour itself is verified in the app.)
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { NotebookSurface, applyScrapbookTextFormat } from './NotebookTool';
import { useNotebookStore, nbUid, type NbBox } from '../stores/notebookStore';

let host: HTMLElement;
let root: Root;
let pageId: string;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  pageId = useNotebookStore.getState().addPage();
  useNotebookStore.getState().selectPage(pageId);
  // jsdom has no execCommand; the DOM edit it would make is simulated below.
  (document as unknown as { execCommand: () => boolean }).execCommand = () => true;
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('scrapbook text formatting persistence', () => {
  it('writes the box HTML back to the store after a format command', () => {
    const box: NbBox = { id: nbUid(), type: 'text', x: 20, y: 20, w: 220, h: 120, html: 'hello' };
    const page = useNotebookStore.getState().pages[pageId];
    useNotebookStore.getState().updatePage(pageId, { boxes: [...page.boxes, box] });
    act(() => root.render(<NotebookSurface />));

    const body = host.querySelector('.fs-nb-box-body') as HTMLElement;
    act(() => { body.focus(); });                 // registers the box as the format target
    body.innerHTML = '<b>hello</b>';              // what execCommand('bold') would produce

    act(() => { applyScrapbookTextFormat('bold'); });

    const saved = useNotebookStore.getState().pages[pageId].boxes.find((b) => b.id === box.id);
    expect(saved?.html).toBe('<b>hello</b>');
  });
});
