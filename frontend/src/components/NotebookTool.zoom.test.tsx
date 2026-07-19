// @vitest-environment jsdom
/**
 * Scrapbook Page Zoom (v3.88) — the board scales with the toolbar's Page Zoom.
 * Verifies the zoom reaches the board layer; the coordinate math (drag/resize
 * dividing by the zoom) is exercised in the app.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { NotebookSurface } from './NotebookTool';
import { useNotebookStore, nbUid } from '../stores/notebookStore';
import { useEditorStore } from '../stores/editorStore';

let host: HTMLElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  const id = useNotebookStore.getState().addPage();
  useNotebookStore.getState().selectPage(id);
  useNotebookStore.getState().updatePage(id, {
    boxes: [{ id: nbUid(), type: 'text', x: 40, y: 40, w: 200, h: 100, html: 'hi' }],
  });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useEditorStore.getState().setZoomLevel(100);
});

describe('scrapbook page zoom', () => {
  it('scales the board layer by the Page Zoom', () => {
    act(() => { useEditorStore.getState().setZoomLevel(150); });
    act(() => root.render(<NotebookSurface />));
    const layer = host.querySelector('.fs-nb-canvas-content') as HTMLElement;
    expect(layer).toBeTruthy();
    expect(layer.style.zoom).toBe('1.5');
  });

  it('leaves the board unscaled at 100%', () => {
    act(() => { useEditorStore.getState().setZoomLevel(100); });
    act(() => root.render(<NotebookSurface />));
    const layer = host.querySelector('.fs-nb-canvas-content') as HTMLElement;
    expect(layer.style.zoom).toBe('');
  });
});
