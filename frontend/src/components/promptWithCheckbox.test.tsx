// @vitest-environment jsdom
/**
 * promptWithCheckbox (v4.88) — the prompt that also answers a yes/no question.
 *
 * Worth a real render: the checkbox state is read inside `answer`, a stable
 * useCallback, so it is mirrored into a ref. Read the state there instead and
 * the dialog resolves the value the checkbox had when the dialog OPENED —
 * which would look exactly like a working checkbox that quietly does nothing.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import ConfirmDialogHost, { promptWithCheckbox } from './ConfirmDialog';

let host: HTMLDivElement;
let root: Root;

const mount = async () => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(<ConfirmDialogHost />); });
};

afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove();
  document.body.innerHTML = '';
});

const box = () => document.querySelector('.fs-confirm-check input') as HTMLInputElement;
const text = () => document.querySelector('.fs-confirm-input') as HTMLInputElement;
const ok = () => document.querySelector('.fs-confirm-ok') as HTMLButtonElement;
const cancel = () => document.querySelector('.fs-confirm-cancel') as HTMLButtonElement;

describe('promptWithCheckbox', () => {
  it('resolves the typed text and the checkbox as ticked', async () => {
    await mount();
    let result: { value: string; checked: boolean } | null | undefined;
    await act(async () => {
      promptWithCheckbox('New field name:', '', { checkboxLabel: 'Apply to all characters?' })
        .then((r) => { result = r; });
    });
    expect(box()).toBeTruthy();
    expect(document.querySelector('.fs-confirm-check')?.textContent).toContain('Apply to all characters?');
    await act(async () => {
      text().value = 'Scar';
      box().click();
    });
    await act(async () => { ok().click(); });
    expect(result).toEqual({ value: 'Scar', checked: true });
  });

  it('an untouched checkbox resolves false — the per-character case', async () => {
    await mount();
    let result: { value: string; checked: boolean } | null | undefined;
    await act(async () => {
      promptWithCheckbox('New field name:', '', { checkboxLabel: 'Apply to all characters?' })
        .then((r) => { result = r; });
    });
    await act(async () => { text().value = 'Rank'; });
    await act(async () => { ok().click(); });
    expect(result).toEqual({ value: 'Rank', checked: false });
  });

  it('cancel resolves null — nothing is created', async () => {
    await mount();
    let result: { value: string; checked: boolean } | null | undefined;
    await act(async () => {
      promptWithCheckbox('New field name:', '', { checkboxLabel: 'Apply to all characters?' })
        .then((r) => { result = r; });
    });
    await act(async () => { box().click(); });
    await act(async () => { cancel().click(); });
    expect(result).toBeNull();
  });

  it('checkboxDefault starts it ticked', async () => {
    await mount();
    let result: { value: string; checked: boolean } | null | undefined;
    await act(async () => {
      promptWithCheckbox('x', 'seed', { checkboxLabel: 'All?', checkboxDefault: true })
        .then((r) => { result = r; });
    });
    expect(box().checked).toBe(true);
    await act(async () => { ok().click(); });
    expect(result).toEqual({ value: 'seed', checked: true });
  });

  it('an ordinary prompt has no checkbox and still resolves a bare string', async () => {
    const { promptDialog } = await import('./ConfirmDialog');
    await mount();
    let result: string | null | undefined;
    await act(async () => { promptDialog('Name?', 'Bob').then((r) => { result = r; }); });
    expect(document.querySelector('.fs-confirm-check')).toBeNull();
    await act(async () => { ok().click(); });
    expect(result).toBe('Bob');
  });
});
