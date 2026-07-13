// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import NewScriptDialog from './NewScriptDialog';

/* v1.50 — File > New Script…: defaults and the Create handoff, pinned. */

const todayVersion = (() => {
  const t = new Date();
  return [
    String(t.getMonth() + 1).padStart(2, '0'),
    String(t.getDate()).padStart(2, '0'),
    String(t.getFullYear()).slice(-2),
  ].join('/');
})();

function renderOpen(onCreate = vi.fn(), onClose = vi.fn()) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<NewScriptDialog open onClose={onClose} onCreate={onCreate} />);
  });
  return { container, root, onCreate, onClose };
}

const typeInto = (input: HTMLInputElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

describe('New Script dialog', () => {
  it('defaults: empty name, "1st Draft", today\'s date — all editable fields', () => {
    const { container, root } = renderOpen();
    expect((container.querySelector('#newscript-name') as HTMLInputElement).value).toBe('');
    expect((container.querySelector('#newscript-draft') as HTMLInputElement).value).toBe('1st Draft');
    expect((container.querySelector('#newscript-version') as HTMLInputElement).value).toBe(todayVersion);
    act(() => root.unmount());
  });

  it('Create hands the typed values off', () => {
    const { container, root, onCreate } = renderOpen();
    typeInto(container.querySelector('#newscript-name') as HTMLInputElement, 'Blackwater');
    typeInto(container.querySelector('#newscript-draft') as HTMLInputElement, 'Shooting Draft');
    act(() => {
      (Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Create') as HTMLButtonElement).click();
    });
    expect(onCreate).toHaveBeenCalledWith({ name: 'Blackwater', draft: 'Shooting Draft', version: todayVersion });
    act(() => root.unmount());
  });

  it('an empty name falls back to Untitled Screenplay', () => {
    const { container, root, onCreate } = renderOpen();
    act(() => {
      (Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Create') as HTMLButtonElement).click();
    });
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'Untitled Screenplay', draft: '1st Draft' }));
    act(() => root.unmount());
  });

  it('uses the Save dialog\'s field grid — one source for the field formatting', () => {
    const { container, root } = renderOpen();
    expect(container.querySelector('.fs-saveas-grid')).toBeTruthy();
    act(() => root.unmount());
  });
});
