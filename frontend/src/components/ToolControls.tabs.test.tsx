// @vitest-environment jsdom
/**
 * v6.48 — ChromeTabs' optional per-tab affordances (grown for the Outline's
 * variation tabs): a × that closes without selecting, and double-click
 * rename via an in-place input. Both are opt-in per tab — tabs without the
 * handlers render exactly as before.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { ChromeTabs, type ToolChromeTab } from './ToolControls';

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

function tab(overrides: Partial<ToolChromeTab> & { label: string }): ToolChromeTab {
  return { active: false, onSelect: () => {}, ...overrides };
}

describe('ChromeTabs close affordance', () => {
  it('renders × only for tabs that carry onClose, and × closes without selecting', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    act(() => {
      root.render(<ChromeTabs tabs={[
        tab({ label: 'Plain' }),
        tab({ label: 'Closable', onSelect, onClose, closeTitle: 'Delete this outline variation (beats are kept)' }),
      ]} />);
    });
    const xs = host.querySelectorAll('.tool-chrome-tab-x');
    expect(xs).toHaveLength(1);
    expect((xs[0] as HTMLElement).title).toContain('beats are kept');
    act(() => { (xs[0] as HTMLElement).click(); });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();   // stopPropagation held
  });
});

describe('ChromeTabs rename affordance', () => {
  it('double-click swaps the tab for an input; Enter commits the typed name', () => {
    const onRename = vi.fn();
    act(() => {
      root.render(<ChromeTabs tabs={[tab({ label: 'Outline 1', onRename })]} />);
    });
    const btn = host.querySelector('.tool-chrome-tab') as HTMLElement;
    act(() => { btn.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); });
    const input = host.querySelector('.tool-chrome-tab-rename') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.defaultValue).toBe('Outline 1');
    input.value = 'Act Map';
    // React 19 binds onBlur to the delegated focusout event.
    act(() => { input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); });
    expect(onRename).toHaveBeenCalledWith('Act Map');
    // the strip is back to a button
    expect(host.querySelector('.tool-chrome-tab-rename')).toBeNull();
    expect(host.querySelector('.tool-chrome-tab')).toBeTruthy();
  });

  it('a tab without onRename ignores double-click', () => {
    act(() => {
      root.render(<ChromeTabs tabs={[tab({ label: 'Fixed' })]} />);
    });
    const btn = host.querySelector('.tool-chrome-tab') as HTMLElement;
    act(() => { btn.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); });
    expect(host.querySelector('.tool-chrome-tab-rename')).toBeNull();
  });
});
