// @vitest-environment jsdom
/**
 * SceneNavigator window chrome (v3.54).
 *
 * The Scenes tool's count + filter render in the window HEADER and its search
 * in the FOOTER, driven by store state so they stay in sync with the tool
 * body. These pin that wiring: the header shows the published count, and the
 * footer's search reads/writes the store.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { SceneHeaderExtra, SceneFooter } from './SceneNavigator';
import { useEditorStore, EMPTY_SCENE_FILTERS, EMPTY_SCENE_NAV_DATA } from '../stores/editorStore';

// React tracks a controlled field's value and ignores a raw value assignment,
// so setting .value + dispatching doesn't fire onChange. Set via the native
// prototype setter (what a real keystroke does) so React sees the change.
function setNativeValue(el: HTMLInputElement | HTMLSelectElement, value: string) {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
}

let host: HTMLElement;
let root: Root;

beforeEach(() => {
  useEditorStore.setState({
    sceneSearch: '',
    sceneFilters: { ...EMPTY_SCENE_FILTERS },
    sceneNavData: { ...EMPTY_SCENE_NAV_DATA, total: 3, filtered: 3, prefixes: ['INT.', 'EXT.'] },
  });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('SceneHeaderExtra (window header)', () => {
  it('shows the total alone when nothing is filtered', () => {
    act(() => root.render(<SceneHeaderExtra />));
    expect(document.querySelector('.scene-count')!.textContent).toBe('3');
  });

  it('shows filtered/total when a search or filter is active', () => {
    act(() => { useEditorStore.setState({ sceneSearch: 'coffee', sceneNavData: { ...EMPTY_SCENE_NAV_DATA, total: 3, filtered: 1 } }); });
    act(() => root.render(<SceneHeaderExtra />));
    expect(document.querySelector('.scene-count')!.textContent).toBe('1/3');
  });

  it('opens a filter popover whose choices write into the store', () => {
    act(() => root.render(<SceneHeaderExtra />));
    act(() => { (document.querySelector('.fs-nav-filterbtn') as HTMLButtonElement).click(); });
    // selects: [0] Character, [1] Location, [2] INT/EXT prefix, [3] Time.
    const prefixSelect = document.querySelectorAll('.fs-scene-filterpop .scene-filter-select')[2] as HTMLSelectElement;
    expect(prefixSelect).toBeTruthy();
    act(() => { setNativeValue(prefixSelect, 'EXT.'); });
    expect(useEditorStore.getState().sceneFilters.prefix).toBe('EXT.');
  });
});

describe('SceneFooter (window footer search)', () => {
  it('reads the store and writes the search back', () => {
    act(() => { useEditorStore.setState({ sceneSearch: 'hello' }); });
    act(() => root.render(<SceneFooter />));
    const input = document.querySelector('.navigator-search--footer input') as HTMLInputElement;
    expect(input.value).toBe('hello');
    act(() => { setNativeValue(input, 'world'); });
    expect(useEditorStore.getState().sceneSearch).toBe('world');
  });
});
