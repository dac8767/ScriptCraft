// @vitest-environment jsdom
/**
 * The shell exists because 44 dialogs had drifted. These lock the three
 * behaviours they were drifting on — including the two BUGS the shell fixes
 * for the dialogs that never had them.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import React from 'react';
import { Modal } from './Modal';

let root: Root | null = null;
let host: HTMLElement | null = null;
afterEach(() => { act(() => root?.unmount()); host?.remove(); root = null; host = null; });

const mount = (ui: React.ReactElement) => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(ui));
};
const press = (key: string) => act(() => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
});

describe('Modal', () => {
  it('closes on Escape — the thing three of five dialogs did not do', () => {
    const onClose = vi.fn();
    mount(<Modal onClose={onClose}>body</Modal>);
    press('Escape');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when the press STARTS on the backdrop', () => {
    const onClose = vi.fn();
    mount(<Modal onClose={onClose}>body</Modal>);
    const overlay = host!.querySelector('.dialog-overlay') as HTMLElement;
    act(() => { overlay.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT close when a drag STARTED inside the box — the selection bug', () => {
    const onClose = vi.fn();
    mount(<Modal onClose={onClose}>body</Modal>);
    const box = host!.querySelector('.dialog-box') as HTMLElement;
    // mousedown inside the box, bubbling out to the overlay
    act(() => { box.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Escape closes only the TOP dialog when two are open', () => {
    const outer = vi.fn(); const inner = vi.fn();
    mount(
      <>
        <Modal onClose={outer}>outer</Modal>
        <Modal onClose={inner}>inner</Modal>
      </>,
    );
    press('Escape');
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();
  });

  it('honours opting out of Escape', () => {
    const onClose = vi.fn();
    mount(<Modal onClose={onClose} closeOnEscape={false}>body</Modal>);
    press('Escape');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('carries the per-dialog box class through', () => {
    mount(<Modal onClose={() => {}} boxClassName="about-dialog">body</Modal>);
    expect(host!.querySelector('.dialog-box')!.className).toBe('dialog-box about-dialog');
  });
});
