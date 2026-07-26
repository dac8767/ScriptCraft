// @vitest-environment jsdom
/**
 * v4.71, Derek: "open a window to last used tab, or just open to the first
 * tab" — the one hook every tabbed window uses. Pins the three behaviors:
 * restore-when-on, reset-to-first-when-off, and record-on-change (recorded
 * even while off, so turning the setting on later has real history).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { useWindowTabMemory } from './windowTabMemory';
import { useSettingsStore } from '../stores/settingsStore';

type Tab = 'a' | 'b' | 'c';
let setTabOutside: ((t: Tab) => void) | null = null;

function Probe({ win, open = true }: { win: string; open?: boolean }) {
  const [tab, setTab] = useState<Tab>('a');
  setTabOutside = setTab;
  useWindowTabMemory(win, tab, setTab, 'a', ['a', 'b', 'c'] as const, open);
  return <div data-probe-tab={tab} />;
}

let host: HTMLElement;
let root: Root;
const shownTab = () => host.querySelector('[data-probe-tab]')!.getAttribute('data-probe-tab');

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  useSettingsStore.setState({ openToLastTab: true, lastWindowTabs: {} });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  setTabOutside = null;
});

describe('useWindowTabMemory', () => {
  it('restores the remembered tab on open when the setting is on', () => {
    useSettingsStore.setState({ lastWindowTabs: { w1: 'c' } });
    act(() => root.render(<Probe win="w1" />));
    expect(shownTab()).toBe('c');
  });

  it('ignores a remembered tab that is no longer valid', () => {
    useSettingsStore.setState({ lastWindowTabs: { w2: 'zombie' } });
    act(() => root.render(<Probe win="w2" />));
    expect(shownTab()).toBe('a');
  });

  it('resets to the first tab on open when the setting is off', () => {
    useSettingsStore.setState({ openToLastTab: false, lastWindowTabs: { w3: 'b' } });
    act(() => root.render(<Probe win="w3" />));
    expect(shownTab()).toBe('a');
  });

  it('records tab changes (even with the setting off) for later', () => {
    useSettingsStore.setState({ openToLastTab: false });
    act(() => root.render(<Probe win="w4" />));
    act(() => setTabOutside!('b'));
    expect(useSettingsStore.getState().lastWindowTabs.w4).toBe('b');
  });

  it('acts on the open EDGE, not only on mount (dialogs pass their open prop)', () => {
    useSettingsStore.setState({ lastWindowTabs: { w5: 'b' } });
    act(() => root.render(<Probe win="w5" open={false} />));
    expect(shownTab()).toBe('a');            // closed: nothing restored
    act(() => root.render(<Probe win="w5" open />));
    expect(shownTab()).toBe('b');            // opening restores
  });
});
