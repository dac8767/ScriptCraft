// @vitest-environment jsdom
/**
 * Scrapbook click-to-type (v2.13) — Derek reported "Click anywhere and start
 * typing" dead. Renders the real takeover surface, mousedowns blank canvas,
 * and expects the parked caret to appear and a typed character to become a
 * real text box.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { NotebookSurface } from './NotebookTool';
import { useNotebookStore } from '../stores/notebookStore';

let host: HTMLElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  const id = useNotebookStore.getState().addPage();
  useNotebookStore.getState().selectPage(id);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('scrapbook click-to-type', () => {
  it('mousedown on blank canvas parks the caret; typing creates a text box', () => {
    act(() => root.render(<NotebookSurface />));
    const canvas = host.querySelector('.fs-nb-canvas') as HTMLElement;
    expect(canvas).toBeTruthy();

    act(() => {
      canvas.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 60, clientY: 60 }));
    });
    const proto = host.querySelector('.fs-nb-protocaret') as HTMLElement;
    expect(proto).toBeTruthy();

    act(() => {
      proto.innerHTML = 'H';
      proto.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const page = useNotebookStore.getState().pages[useNotebookStore.getState().selectedPageId!];
    expect(page.boxes.some((b) => b.type === 'text' && b.html === 'H')).toBe(true);
    expect(host.querySelector('.fs-nb-protocaret')).toBeNull();
  });
});
