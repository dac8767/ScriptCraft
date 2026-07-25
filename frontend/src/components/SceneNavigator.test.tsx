// @vitest-environment jsdom
/**
 * SceneNavigator window chrome (v4.27, Derek's window template).
 *
 * The Scenes tool's count rides beside the window title (SceneTitleExtra) and
 * its Filter / View / Search live in the row-2 cluster (SceneControls), all
 * driven by store state so they stay in sync with the tool body. These pin
 * that wiring: the count reflects filtering, the Filter chip counts active
 * dimensions, the popover writes into the store, and cards view hides the
 * list-only controls instead of letting them no-op.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { SceneTitleExtra, SceneControls } from './SceneNavigator';
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
    scenesViewMode: 'list',
  });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('SceneTitleExtra (count beside the window title)', () => {
  it('shows the total alone when nothing is filtered', () => {
    act(() => root.render(<SceneTitleExtra />));
    expect(document.querySelector('.tool-title-count')!.textContent).toBe('· 3');
  });

  it('shows filtered/total when a search or filter is active', () => {
    act(() => { useEditorStore.setState({ sceneSearch: 'coffee', sceneNavData: { ...EMPTY_SCENE_NAV_DATA, total: 3, filtered: 1 } }); });
    act(() => root.render(<SceneTitleExtra />));
    expect(document.querySelector('.tool-title-count')!.textContent).toBe('· 1/3');
  });
});

describe('SceneControls (row-2 cluster)', () => {
  it('opens the Filter popover and its choices write into the store', () => {
    act(() => root.render(<SceneControls />));
    const filterBtn = Array.from(host.querySelectorAll('button.tool-ctl'))
      .find((b) => b.textContent?.includes('Filter')) as HTMLButtonElement;
    expect(filterBtn).toBeTruthy();
    act(() => { filterBtn.click(); });
    // selects: [0] Character, [1] Location, [2] INT/EXT prefix, [3] Time.
    const prefixSelect = document.querySelectorAll('.fs-scene-filterpop .scene-filter-select')[2] as HTMLSelectElement;
    expect(prefixSelect).toBeTruthy();
    act(() => { setNativeValue(prefixSelect, 'EXT.'); });
    expect(useEditorStore.getState().sceneFilters.prefix).toBe('EXT.');
  });

  it('shows a chip counting the active filter dimensions', () => {
    act(() => {
      useEditorStore.setState({
        sceneFilters: { ...EMPTY_SCENE_FILTERS, prefix: 'EXT.', characters: ['LOLA', 'MANNI'] },
      });
    });
    act(() => root.render(<SceneControls />));
    expect(host.querySelector('.tool-ctl-chip')!.textContent).toBe('3');
  });

  it('search writes the store; the View dropdown switches List/Cards', () => {
    act(() => { useEditorStore.setState({ sceneSearch: 'hello' }); });
    act(() => root.render(<SceneControls />));
    const input = host.querySelector('.tool-ctl-search-field input') as HTMLInputElement;
    expect(input.value).toBe('hello');
    act(() => { setNativeValue(input, 'world'); });
    expect(useEditorStore.getState().sceneSearch).toBe('world');

    // View: open the dropdown, pick Cards.
    const viewBtn = Array.from(host.querySelectorAll('button.tool-ctl'))
      .find((b) => b.textContent?.includes('List') || b.textContent?.includes('Cards')) as HTMLButtonElement;
    act(() => { viewBtn.click(); });
    const cardsItem = Array.from(document.querySelectorAll('.tool-ctl-menu-item'))
      .find((b) => b.textContent === 'Cards') as HTMLButtonElement;
    act(() => { cardsItem.click(); });
    expect(useEditorStore.getState().scenesViewMode).toBe('cards');
  });

  it('cards view offers the SAME cluster as list — Filter, Reorder, View, Search (v4.35 batch-v9 #2)', () => {
    act(() => { useEditorStore.setState({ scenesViewMode: 'cards' }); });
    act(() => root.render(<SceneControls />));
    const labels = Array.from(host.querySelectorAll('button.tool-ctl')).map((b) => b.textContent);
    expect(labels.some((t) => t?.includes('Filter'))).toBe(true);
    expect(labels.some((t) => t?.includes('Reorder'))).toBe(true);
    expect(host.querySelector('.tool-ctl-search-btn, .tool-ctl-search-field')).not.toBeNull();
    // View survives — it's how you get back to List.
    expect(labels.some((t) => t?.includes('Cards'))).toBe(true);
  });
});
