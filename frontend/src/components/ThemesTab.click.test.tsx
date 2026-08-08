// @vitest-environment jsdom
/**
 * v6.48, Derek: "clicking on a theme in the customize window should make the
 * app change to that theme." The row itself applies; its buttons (Hide ×,
 * Edit, Delete) keep their own jobs via the closest('button') guard.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import ThemesTab from './ThemesTab';
import { useEditorStore } from '../stores/editorStore';
import { useThemeStore } from '../stores/themeStore';

let host: HTMLElement;
let root: Root;

beforeEach(() => {
  useEditorStore.getState().setTheme('dark');
  useThemeStore.setState({ customThemes: [], themeOrder: [], hiddenThemes: [] });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

function rowFor(label: string): HTMLElement {
  const row = [...host.querySelectorAll('.fs-theme-click')]
    .find((el) => (el.textContent || '').includes(label));
  expect(row, `row for ${label}`).toBeTruthy();
  return row as HTMLElement;
}

describe('ThemesTab click-to-apply', () => {
  it('clicking a Shown theme row switches the app to it', () => {
    act(() => { root.render(<ThemesTab />); });
    act(() => { rowFor('Sepia').click(); });
    expect(useEditorStore.getState().theme).toBe('sepia');
  });

  it("clicking a row's Hide × hides the theme WITHOUT switching to it", () => {
    act(() => { root.render(<ThemesTab />); });
    const nordRow = rowFor('Nord');
    const hideBtn = nordRow.querySelector('button[title="Hide this theme"]') as HTMLElement;
    act(() => { hideBtn.click(); });
    expect(useEditorStore.getState().theme).toBe('dark');            // unchanged
    expect(useThemeStore.getState().hiddenThemes).toContain('nord'); // hidden
  });

  it('clicking a Hidden theme applies it and moves it back to Shown', () => {
    useThemeStore.setState({ customThemes: [], themeOrder: [], hiddenThemes: ['sepia'] });
    act(() => { root.render(<ThemesTab />); });
    act(() => { rowFor('Sepia').click(); });
    expect(useEditorStore.getState().theme).toBe('sepia');
    expect(useThemeStore.getState().hiddenThemes).not.toContain('sepia');
  });
});
