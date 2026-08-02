// @vitest-environment jsdom
/**
 * v5.80, Derek: "for all windows, put the header buttons in this order (if
 * they're present in that window): View, Filter, Sort, Search."
 *
 * A rule nobody can check is a rule that drifts — two windows already had.
 * So this renders EVERY window's real chrome cluster out of the TOOL_CHROME
 * registry and reads the order back from the DOM. A window added later is
 * covered the moment it registers, without anyone remembering to add it here.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { TOOL_CHROME } from './ToolDock';
import { CHROME_CONTROL_ORDER, chromeSlotOf } from './ToolControls';

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
});

const withControls = Object.entries(TOOL_CHROME).filter(([, c]) => c?.Controls);

describe('header control order — View · Filter · Sort · Search', () => {
  it('covers every window that has a control cluster', () => {
    expect(withControls.length).toBeGreaterThan(5);
  });

  it.each(withControls.map(([id]) => id))('%s puts its controls in the canonical order', (id) => {
    const Controls = TOOL_CHROME[id as keyof typeof TOOL_CHROME]!.Controls!;
    act(() => { root.render(<Controls />); });
    const slots = Array.from(host.querySelectorAll('[data-ctl]'))
      .map((el) => (el as HTMLElement).dataset.ctl!)
      .filter((s, i, a) => a.indexOf(s) === i);       // search button/field are one slot
    const rank = slots.map((s) => CHROME_CONTROL_ORDER.indexOf(s as never));
    expect(rank.every((r) => r >= 0)).toBe(true);
    expect(rank).toEqual([...rank].sort((a, b) => a - b));
  });
});

describe('chromeSlotOf', () => {
  it('reads the slot from the name the control already shows', () => {
    expect(chromeSlotOf('Filter')).toBe('filter');
    expect(chromeSlotOf('  Sort ')).toBe('sort');
    expect(chromeSlotOf('View')).toBe('view');
  });
  it('leaves a tool-specific control unstamped', () => {
    expect(chromeSlotOf('Replace map')).toBeUndefined();
    expect(chromeSlotOf(undefined)).toBeUndefined();
  });
});
