// @vitest-environment jsdom
/**
 * v4.37, Derek: Apply in the theme color picker commits the hex AND closes
 * the popover — it's the "I'm done here" button. The preset swatches stay
 * open on purpose (live try-outs; outside-click or Apply ends the session).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import ColorPicker from './ColorPicker';

let host: HTMLElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

describe('ColorPicker', () => {
  it('Apply commits the current hex and closes the popover', () => {
    const onChange = vi.fn();
    const onClose = vi.fn();
    act(() => {
      root.render(<ColorPicker value="#123456" onChange={onChange} onClose={onClose} />);
    });
    act(() => { (host.querySelector('.color-picker-apply') as HTMLButtonElement).click(); });
    // v5.26: onChange carries the pick's source — Apply is the 'wheel'
    // (annotation pickers record ONLY wheel picks in their Recent row).
    expect(onChange).toHaveBeenCalledWith('#123456', 'wheel');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('a preset swatch commits but keeps the popover open for try-outs', () => {
    const onChange = vi.fn();
    const onClose = vi.fn();
    act(() => {
      root.render(<ColorPicker value="#123456" onChange={onChange} onClose={onClose} />);
    });
    act(() => { (host.querySelector('.color-picker-swatch') as HTMLButtonElement).click(); });
    expect(onChange).toHaveBeenCalledWith('#000000', 'preset');   // first preset
    expect(onClose).not.toHaveBeenCalled();
  });
});
