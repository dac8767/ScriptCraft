// @vitest-environment jsdom
/**
 * GapHandle — pins the drag DIRECTION per bar (v2.61). The Big Button
 * section is anchored at the toolbar's right edge with its grip on the LEFT,
 * so its spacing grows leftward — dragging the grip left (away from the
 * buttons) must WIDEN the gap. The menu/toolbar grips sit right of
 * left-anchored items, so there dragging right widens. The v2.61 bug: the
 * bigbtn grip used the same sign as the others and fought the mouse.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import GapHandle, { GAP_DRAG_DIR, sizeIndicatorT, BIGBTN_INSET_MAX } from './GapHandle';
import { useEditorStore } from '../stores/editorStore';
import { chromeMin, chromeMax } from './chromeSizes';

describe('GapHandle drag direction', () => {
  let host: HTMLElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    useEditorStore.setState({ uiResizeLocked: false });
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  const drag = (bar: 'toolbar' | 'bigbtn', fromX: number, toX: number) => {
    act(() => { root.render(<GapHandle bar={bar} />); });
    const grip = host.querySelector('.fs-gap-handle')!;
    const fire = (type: string, clientX: number) =>
      act(() => { grip.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX })); });
    fire('pointerdown', fromX);
    fire('pointermove', toX);
    fire('pointerup', toX);
  };

  it('menu/toolbar grow rightward, bigbtn grows leftward', () => {
    expect(GAP_DRAG_DIR.menu).toBe(1);
    expect(GAP_DRAG_DIR.toolbar).toBe(1);
    expect(GAP_DRAG_DIR.bigbtn).toBe(-1);
  });

  it('toolbar grip: dragging right widens the gap', () => {
    useEditorStore.getState().setChromeGap('toolbar', 10);
    drag('toolbar', 100, 110);
    expect(useEditorStore.getState().chromeGapPx.toolbar).toBe(20);
  });

  it('bigbtn grip: dragging LEFT (away from the buttons) widens the gap', () => {
    useEditorStore.getState().setChromeGap('bigbtn', 10);
    drag('bigbtn', 100, 90);
    expect(useEditorStore.getState().chromeGapPx.bigbtn).toBe(20);
  });

  it('bigbtn grip: dragging toward the buttons tightens the gap', () => {
    useEditorStore.getState().setChromeGap('bigbtn', 10);
    drag('bigbtn', 100, 108);
    expect(useEditorStore.getState().chromeGapPx.bigbtn).toBe(2);
  });

  /* v2.76: the vertical axis — drag up/down sizes the bar itself. */
  const dragXY = (bar: 'menu' | 'toolbar' | 'bigbtn', from: [number, number], to: [number, number]) => {
    act(() => { root.render(<GapHandle bar={bar} />); });
    const grip = host.querySelector('.fs-gap-handle')!;
    const fire = (type: string, [clientX, clientY]: [number, number]) =>
      act(() => { grip.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX, clientY })); });
    fire('pointerdown', from);
    fire('pointermove', to);
    fire('pointerup', to);
  };

  it('toolbar grip: dragging down makes the bar taller (custom mode)', () => {
    useEditorStore.setState({ toolbarMode: 'compact' });
    const before = 33;   // compact toolbar height
    dragXY('toolbar', [100, 50], [100, 60]);
    const s = useEditorStore.getState();
    expect(s.toolbarMode).toBe('custom');
    expect(s.chromeCustomPx.toolbar).toBe(before + 10);
  });

  it('a pure horizontal drag never flips the bar into custom mode', () => {
    useEditorStore.setState({ toolbarMode: 'compact' });
    dragXY('toolbar', [100, 50], [120, 51]);   // 1px of y — under the engage threshold
    expect(useEditorStore.getState().toolbarMode).toBe('compact');
  });

  it('bigbtn grip: dragging down grows the buttons (smaller inset)', () => {
    useEditorStore.getState().setBigBtnInset(16);
    dragXY('bigbtn', [100, 50], [100, 60]);
    expect(useEditorStore.getState().bigBtnInsetPx).toBe(6);
  });

  it('the size indicator maps range ends to 0 and 1', () => {
    expect(sizeIndicatorT('toolbar', chromeMin('toolbar'))).toBe(0);
    expect(sizeIndicatorT('toolbar', chromeMax('toolbar'))).toBe(1);
    expect(sizeIndicatorT('bigbtn', BIGBTN_INSET_MAX)).toBe(0);   // most inset = smallest
    expect(sizeIndicatorT('bigbtn', 0)).toBe(1);                  // no inset = biggest
  });
});
