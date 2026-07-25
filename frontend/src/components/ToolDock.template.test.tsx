// @vitest-environment jsdom
/**
 * v4.27, Derek's universal window template — the frame's two chrome rows.
 * Row 1 must be three zones (pop-in | centered title | actions) and the
 * TOOL_CHROME slots must land where the schematic puts them: TitleExtra
 * beside the title, WindowActions left of close, Tabs and the
 * Filter/Sort/View/Search cluster on row 2.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { ToolWindowFrame, ALL_TOOLS, TOOL_CHROME } from './ToolDock';

const todoDef = ALL_TOOLS.find((t) => t.id === 'todo')!;

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
  // tests inject registry entries for a tool that has none — always undo
  delete TOOL_CHROME.todo;
});

const renderFrame = () => act(() => {
  root.render(
    <ToolWindowFrame tool={todoDef} side="left" onClose={() => {}}>
      <div>body</div>
    </ToolWindowFrame>,
  );
});

describe('window template rows (v4.27)', () => {
  it('row 1 is three zones with the title in the centre zone and close on the right', () => {
    renderFrame();
    const header = host.querySelector('.tool-window-header')!;
    expect(header).toBeTruthy();
    const zones = Array.from(header.children).filter((c) => c.classList.contains('tool-window-zone'));
    expect(zones.length).toBe(3);
    expect(zones[0].classList.contains('tool-window-zone-l')).toBe(true);
    expect(zones[1].querySelector('.tool-window-title')?.textContent).toBe('To-Do');
    expect(zones[2].querySelector('.tool-window-close')).toBeTruthy();
    // no declared chrome and no legacy extra → no empty row 2 strip
    expect(host.querySelector('.tool-chrome-row2')).toBeNull();
  });

  it('TOOL_CHROME slots land in their zones: TitleExtra centre, WindowActions before close, tabs + controls on row 2', () => {
    TOOL_CHROME.todo = {
      TitleExtra: () => <span data-testid="tx">· 3</span>,
      WindowActions: () => <button data-testid="wa">fs</button>,
      Tabs: () => <span data-testid="tabs">tabs</span>,
      Controls: () => <span data-testid="ctl">ctl</span>,
    };
    renderFrame();
    expect(host.querySelector('.tool-window-zone-c [data-testid="tx"]')).toBeTruthy();
    const zr = host.querySelector('.tool-window-zone-r')!;
    const kids = Array.from(zr.children);
    const wa = zr.querySelector('[data-testid="wa"]')!;
    const close = zr.querySelector('.tool-window-close')!;
    expect(kids.indexOf(wa)).toBeGreaterThan(-1);
    expect(kids.indexOf(wa)).toBeLessThan(kids.indexOf(close));
    const row2 = host.querySelector('.tool-chrome-row2')!;
    expect(row2.querySelector('.tool-chrome-tabs [data-testid="tabs"]')).toBeTruthy();
    expect(row2.querySelector('.tool-chrome-controls [data-testid="ctl"]')).toBeTruthy();
  });

  it('a Controls-only tool gets row 2 with the cluster and no tab strip', () => {
    TOOL_CHROME.todo = { Controls: () => <span data-testid="ctl-only">ctl</span> };
    renderFrame();
    expect(host.querySelector('.tool-window-header [data-testid="ctl-only"]')).toBeNull();
    const row2 = host.querySelector('.tool-chrome-row2')!;
    expect(row2.classList.contains('tool-chrome-row2-tabbed')).toBe(false);
    expect(row2.querySelector('.tool-chrome-tabs')).toBeNull();
    expect(row2.querySelector('.tool-chrome-controls [data-testid="ctl-only"]')).toBeTruthy();
  });
});
