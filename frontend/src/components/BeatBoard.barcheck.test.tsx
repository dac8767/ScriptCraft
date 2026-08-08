// @vitest-environment jsdom
/**
 * v6.48, Derek: the per-tab ◉ is gone — the "Show in Outline Bar" checkbox
 * (v6.49: at the right edge of the body's first row) says whether the
 * VIEWED tab feeds the Outline Bar. Exactly one tab always feeds the bar,
 * so the checked box is disabled (you move the bar by checking it on
 * another tab, never by unchecking).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { OutlineBarCheck } from './BeatBoard';
import { useEditorStore } from '../stores/editorStore';

let host: HTMLElement;
let root: Root;

beforeEach(() => {
  useEditorStore.getState().resetOutlineTabs();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

const box = () => host.querySelector('.beat-bar-check input') as HTMLInputElement;

describe('"Show in Outline Bar" checkbox', () => {
  it('is checked and locked on the tab the bar shows; checking it on another tab moves the bar', () => {
    act(() => { root.render(<OutlineBarCheck />); });
    // Single fresh tab: it IS the bar tab — checked, not uncheckable.
    expect(box().checked).toBe(true);
    expect(box().disabled).toBe(true);

    // A second tab becomes the viewed tab; the bar still shows the first.
    act(() => { useEditorStore.getState().addOutlineTab(); });
    expect(box().checked).toBe(false);
    expect(box().disabled).toBe(false);

    // Checking it here moves the bar to the viewed tab.
    act(() => { box().click(); });
    const s = useEditorStore.getState();
    expect(s.outlineBarTab).toBe(s.viewedOutlineTab);
    expect(box().checked).toBe(true);
    expect(box().disabled).toBe(true);
  });
});
