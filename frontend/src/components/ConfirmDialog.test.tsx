// @vitest-environment jsdom
/**
 * ConfirmDialog (v2.23) — pins the contract that replaced window.confirm:
 * confirmDialog() resolves true/false from real button clicks, and fails
 * SAFE (false) when no host is mounted. window.confirm is a Tauri IPC shim
 * in the desktop app — always truthy, sometimes a crash — so nothing may
 * regress back to it.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import ConfirmDialogHost, { confirmDialog } from './ConfirmDialog';

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
});

describe('confirmDialog', () => {
  it('resolves true on the confirm button, false on cancel', async () => {
    act(() => { root.render(<ConfirmDialogHost />); });

    let p: Promise<boolean>;
    act(() => { p = confirmDialog('Replace everything?', { title: 'Sure?', confirmLabel: 'Replace', danger: true }); });
    const box = document.querySelector('.fs-confirm-box')!;
    expect(box.textContent).toContain('Replace everything?');
    expect(box.textContent).toContain('Sure?');
    act(() => { (document.querySelector('.fs-confirm-ok') as HTMLButtonElement).click(); });
    await expect(p!).resolves.toBe(true);

    act(() => { p = confirmDialog('Delete it?'); });
    act(() => { (document.querySelector('.fs-confirm-cancel') as HTMLButtonElement).click(); });
    await expect(p!).resolves.toBe(false);
    expect(document.querySelector('.fs-confirm-overlay')).toBeNull();
  });

  it('Escape cancels', async () => {
    act(() => { root.render(<ConfirmDialogHost />); });
    let p: Promise<boolean>;
    act(() => { p = confirmDialog('Careful now'); });
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    await expect(p!).resolves.toBe(false);
  });

  it('fails safe when no host is mounted: resolves false, never hangs', async () => {
    await expect(confirmDialog('Anyone there?')).resolves.toBe(false);
  });

  it('queues overlapping requests instead of dropping them', async () => {
    act(() => { root.render(<ConfirmDialogHost />); });
    let p1: Promise<boolean>; let p2: Promise<boolean>;
    act(() => { p1 = confirmDialog('First'); p2 = confirmDialog('Second'); });
    expect(document.querySelector('.fs-confirm-message')!.textContent).toBe('First');
    act(() => { (document.querySelector('.fs-confirm-ok') as HTMLButtonElement).click(); });
    await expect(p1!).resolves.toBe(true);
    expect(document.querySelector('.fs-confirm-message')!.textContent).toBe('Second');
    act(() => { (document.querySelector('.fs-confirm-cancel') as HTMLButtonElement).click(); });
    await expect(p2!).resolves.toBe(false);
  });
});
