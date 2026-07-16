// @vitest-environment jsdom
/**
 * Scrapbook image reselection (v2.65/v2.85) — Derek reported the Picture
 * options graying out after clicking away from a placed image and back.
 * The Picture menu enables off notebookStore.focusedBoxId, and startDrag
 * stops propagation — so clicking the image body must set the store focus
 * itself. Renders the real surface and pins the full chain.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { NotebookSurface } from './NotebookTool';
import { useNotebookStore } from '../stores/notebookStore';

let host: HTMLElement;
let root: Root;

const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  const id = useNotebookStore.getState().addPage();
  useNotebookStore.getState().selectPage(id);
  useNotebookStore.getState().updatePage(id, {
    boxes: [{ id: 'img1', type: 'image', x: 24, y: 24, w: 100, h: 80, src: PIXEL }],
  });
  useNotebookStore.getState().setFocusedBox(null);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('scrapbook image reselection', () => {
  it('clicking a placed image focuses it in the store (Picture menu enables)', () => {
    act(() => root.render(<NotebookSurface />));
    const img = host.querySelector('.fs-nb-imgbox img') as HTMLElement;
    expect(img).toBeTruthy();
    expect(useNotebookStore.getState().focusedBoxId).toBeNull();

    act(() => {
      img.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 50, clientY: 50 }));
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });
    expect(useNotebookStore.getState().focusedBoxId).toBe('img1');
  });

  it('clicking blank canvas afterwards clears the focus again', () => {
    act(() => root.render(<NotebookSurface />));
    const img = host.querySelector('.fs-nb-imgbox img') as HTMLElement;
    act(() => {
      img.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });
    const canvas = host.querySelector('.fs-nb-canvas') as HTMLElement;
    act(() => {
      canvas.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 300, clientY: 300 }));
    });
    expect(useNotebookStore.getState().focusedBoxId).toBeNull();
  });
});
