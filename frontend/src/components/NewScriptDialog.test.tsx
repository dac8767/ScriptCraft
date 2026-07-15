// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import NewScriptDialog from './NewScriptDialog';
import { SYSTEM_TEMPLATE_LIST } from '../stores/formattingTemplateStore';
import { INDUSTRY_STANDARD_ID } from '../stores/formattingTypes';

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
    expect(onCreate).toHaveBeenCalledWith({
      name: 'Blackwater', draft: 'Shooting Draft', version: todayVersion,
      templateId: INDUSTRY_STANDARD_ID,   // the dropdown's default
    });
    act(() => root.unmount());
  });

  /* v1.88 — the format dropdown replaced the "Choose script format" window. */
  it('Format dropdown lists every built-in when preferences were never set, and hands the pick off', () => {
    const { container, root, onCreate } = renderOpen();
    const select = container.querySelector('#newscript-format') as HTMLSelectElement;
    expect(select).toBeTruthy();
    expect(Array.from(select.options).map((o) => o.textContent))
      .toEqual(SYSTEM_TEMPLATE_LIST.map((t) => t.name));
    expect(select.value).toBe(INDUSTRY_STANDARD_ID);

    const stagePlay = SYSTEM_TEMPLATE_LIST.find((t) => t.name === 'Stage Play')!;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')!.set!;
    act(() => {
      setter.call(select, stagePlay.id);
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    act(() => {
      (Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Create') as HTMLButtonElement).click();
    });
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ templateId: stagePlay.id }));
    act(() => root.unmount());
  });

  it('an empty name falls back to Untitled Script', () => {
    const { container, root, onCreate } = renderOpen();
    act(() => {
      (Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Create') as HTMLButtonElement).click();
    });
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'Untitled Script', draft: '1st Draft' }));
    act(() => root.unmount());
  });

  it('uses the Save dialog\'s field grid — one source for the field formatting', () => {
    const { container, root } = renderOpen();
    expect(container.querySelector('.fs-saveas-grid')).toBeTruthy();
    act(() => root.unmount());
  });
});
