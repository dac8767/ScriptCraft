// @vitest-environment jsdom
/**
 * GapHandle — pins the drag DIRECTION per bar (v2.61). All three grips sit
 * right of left-anchored items, so dragging right widens the gap. (Until
 * v2.94 the Big Button grip sat LEFT of a right-anchored section and ran
 * inverted — Row 2 is left-anchored now.) Getting the sign wrong makes the
 * grip fight the mouse.
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

  it('all three bars grow rightward (Row 2 is left-anchored since v2.94)', () => {
    expect(GAP_DRAG_DIR.menu).toBe(1);
    expect(GAP_DRAG_DIR.toolbar).toBe(1);
    expect(GAP_DRAG_DIR.bigbtn).toBe(1);
  });

  it('toolbar grip: dragging right widens the gap', () => {
    useEditorStore.getState().setChromeGap('toolbar', 10);
    drag('toolbar', 100, 110);
    expect(useEditorStore.getState().chromeGapPx.toolbar).toBe(20);
  });

  it('bigbtn (Row 2) grip: dragging right widens the gap', () => {
    useEditorStore.getState().setChromeGap('bigbtn', 10);
    drag('bigbtn', 100, 110);
    expect(useEditorStore.getState().chromeGapPx.bigbtn).toBe(20);
  });

  it('bigbtn (Row 2) grip: dragging left tightens the gap', () => {
    useEditorStore.getState().setChromeGap('bigbtn', 10);
    drag('bigbtn', 100, 92);
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

  /* v2.91: the Big Button grip is spacing-only — vertical drags do nothing. */
  it('bigbtn grip: a vertical drag never touches the button size', () => {
    useEditorStore.getState().setBigBtnInset(16);
    dragXY('bigbtn', [100, 50], [100, 60]);
    expect(useEditorStore.getState().bigBtnInsetPx).toBe(16);
  });

  /* v2.88: one axis per drag — the first direction to move claims it. */
  it('a drag that starts vertical never touches the spacing', () => {
    useEditorStore.getState().setChromeGap('toolbar', 10);
    useEditorStore.setState({ toolbarMode: 'compact' });
    act(() => { root.render(<GapHandle bar="toolbar" />); });
    const grip = host.querySelector('.fs-gap-handle')!;
    const fire = (type: string, clientX: number, clientY: number) =>
      act(() => { grip.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX, clientY })); });
    fire('pointerdown', 100, 50);
    fire('pointermove', 100, 60);    // vertical claims the drag
    fire('pointermove', 140, 60);    // now yanked sideways — must be ignored
    fire('pointerup', 140, 60);
    expect(useEditorStore.getState().chromeGapPx.toolbar).toBe(10);   // spacing untouched
    expect(useEditorStore.getState().toolbarMode).toBe('custom');     // height drag took it
  });

  it('a drag that starts horizontal never touches the height', () => {
    useEditorStore.setState({ toolbarMode: 'compact' });
    useEditorStore.getState().setChromeGap('toolbar', 10);
    dragXY('toolbar', [100, 50], [120, 50]);
    act(() => {
      const grip = host.querySelector('.fs-gap-handle')!;
      grip.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 120, clientY: 90 }));
    });
    expect(useEditorStore.getState().toolbarMode).toBe('compact');    // height untouched
  });

  it('the size indicator maps range ends to 0 and 1', () => {
    expect(sizeIndicatorT('toolbar', chromeMin('toolbar'))).toBe(0);
    expect(sizeIndicatorT('toolbar', chromeMax('toolbar'))).toBe(1);
    expect(sizeIndicatorT('bigbtn', BIGBTN_INSET_MAX)).toBe(0);   // most inset = smallest
    expect(sizeIndicatorT('bigbtn', 0)).toBe(1);                  // no inset = biggest
  });
});
