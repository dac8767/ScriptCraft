// @vitest-environment jsdom
/**
 * The resize edges, now that they are their own hook (v5.88). The clamps and
 * the OPPOSITE SIGNS are the whole behaviour: the right panel's grip is on
 * its left side, so dragging right widens the navigator and narrows the
 * panel. Getting that backwards is the bug this locks out.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import React from 'react';
import { usePanelResize } from './usePanelResize';

let root: Root | null = null;
let host: HTMLElement | null = null;
afterEach(() => { act(() => root?.unmount()); host?.remove(); root = null; host = null; });

/** Render the hook and return a live handle on its latest value. */
function mount(): { current: ReturnType<typeof usePanelResize> } {
  const ref = { current: null as unknown as ReturnType<typeof usePanelResize> };
  const Probe = () => { ref.current = usePanelResize(); return null; };
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(React.createElement(Probe)));
  return ref;
}

const drag = (h: { current: ReturnType<typeof usePanelResize> }, side: 'left' | 'right', dx: number) => {
  act(() => {
    h.current.onResizePointerDown(side, { preventDefault() {}, clientX: 100 } as unknown as React.PointerEvent);
  });
  act(() => {
    document.dispatchEvent(new MouseEvent('pointermove', { clientX: 100 + dx }));
  });
  act(() => { document.dispatchEvent(new MouseEvent('pointerup')); });
};

describe('usePanelResize', () => {
  it('starts at the panel widths the editor shipped with', () => {
    const h = mount();
    expect(h.current.navWidth).toBe(240);
    expect(h.current.rightPanelWidth).toBe(300);
  });

  it('dragging right WIDENS the navigator and NARROWS the right panel', () => {
    const h = mount();
    drag(h, 'left', 60);
    expect(h.current.navWidth).toBe(300);
    drag(h, 'right', 60);
    expect(h.current.rightPanelWidth).toBe(240);
  });

  it('clamps both edges', () => {
    const h = mount();
    drag(h, 'left', -1000);
    expect(h.current.navWidth).toBe(160);
    drag(h, 'left', 1000);
    expect(h.current.navWidth).toBe(500);
    drag(h, 'right', 1000);
    expect(h.current.rightPanelWidth).toBe(200);
    drag(h, 'right', -1000);
    expect(h.current.rightPanelWidth).toBe(600);
  });

  it('releases the body cursor and selection lock when the drag ends', () => {
    const h = mount();
    act(() => {
      h.current.onResizePointerDown('left', { preventDefault() {}, clientX: 0 } as unknown as React.PointerEvent);
    });
    expect(document.body.style.cursor).toBe('col-resize');
    act(() => { document.dispatchEvent(new MouseEvent('pointerup')); });
    expect(document.body.style.cursor).toBe('');
    expect(document.body.style.userSelect).toBe('');
  });
});
