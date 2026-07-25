// @vitest-environment jsdom
/**
 * v4.27 — the shared Filter/Sort/View/Search primitives every tool window's
 * row-2 cluster is built from. The dropdown must portal its menu to <body>
 * (panels clip absolutely-positioned children) and must survive the opening
 * click's own scroll (the ImageSourceMenu lesson: focus scroll closed menus
 * the frame they opened). Search must expand from a magnifier and collapse
 * clean on Escape.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { ControlDropdown, ControlSearch } from './ToolControls';

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

describe('ControlDropdown', () => {
  it('opens a portalled menu; selecting an item fires and closes', () => {
    const onSelect = vi.fn();
    act(() => {
      root.render(<ControlDropdown label="Sort" items={[{ label: 'Name', active: true, onSelect }]} />);
    });
    act(() => { (host.querySelector('button.tool-ctl') as HTMLButtonElement).click(); });
    const menu = document.body.querySelector('.tool-ctl-menu');
    expect(menu).toBeTruthy();
    expect(menu!.parentElement).toBe(document.body); // portalled — panels clip children
    const item = menu!.querySelector('.tool-ctl-menu-item') as HTMLButtonElement;
    expect(item.classList.contains('active')).toBe(true);
    act(() => { item.click(); });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(document.body.querySelector('.tool-ctl-menu')).toBeNull();
  });

  it('survives the opening click’s own scroll (grace window) but closes on a later one', () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    act(() => {
      root.render(<ControlDropdown label="Filter" items={[{ label: 'A', onSelect: () => {} }]} />);
    });
    act(() => { (host.querySelector('button.tool-ctl') as HTMLButtonElement).click(); });
    expect(document.body.querySelector('.tool-ctl-menu')).toBeTruthy();
    // the opening click's focus-scroll arrives a frame later — must NOT close
    act(() => { document.body.dispatchEvent(new Event('scroll')); });
    expect(document.body.querySelector('.tool-ctl-menu')).toBeTruthy();
    now = 1400; // a genuine user scroll, past the grace window
    act(() => { document.body.dispatchEvent(new Event('scroll')); });
    expect(document.body.querySelector('.tool-ctl-menu')).toBeNull();
  });
});

describe('ControlSearch', () => {
  it('starts as a magnifier, expands on click, Escape clears and collapses', () => {
    const onChange = vi.fn();
    act(() => { root.render(<ControlSearch value="" onChange={onChange} />); });
    expect(host.querySelector('.tool-ctl-search-btn')).toBeTruthy();
    expect(host.querySelector('.tool-ctl-search-field')).toBeNull();
    act(() => { (host.querySelector('.tool-ctl-search-btn') as HTMLButtonElement).click(); });
    const input = host.querySelector('.tool-ctl-search-field input') as HTMLInputElement;
    expect(input).toBeTruthy();
    act(() => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(onChange).toHaveBeenCalledWith('');
    expect(host.querySelector('.tool-ctl-search-field')).toBeNull();
    expect(host.querySelector('.tool-ctl-search-btn')).toBeTruthy();
  });

  it('starts expanded when a query is already set', () => {
    act(() => { root.render(<ControlSearch value="lola" onChange={() => {}} />); });
    expect((host.querySelector('.tool-ctl-search-field input') as HTMLInputElement).value).toBe('lola');
  });
});
