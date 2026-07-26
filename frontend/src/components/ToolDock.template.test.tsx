// @vitest-environment jsdom
/**
 * v4.39, Derek's single-row window template. The frame's header is ONE row:
 *   left  — tool name · TitleExtra (count) · tabs
 *   right — Filter/Sort/View/Search cluster (+ WindowActions) · divider ·
 *           fullscreen · close
 * (Overflow wraps via CSS — flex-wrap isn't observable in jsdom, so these
 * pin the DOM order and slotting instead.) The pop-in/pop-out buttons are
 * gone: docking is a drag gesture now.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { ToolWindowFrame, ALL_TOOLS, TOOL_CHROME } from './ToolDock';

// v4.33: 'workspaces' is the chrome-less fixture — Notes/To-Do grew real
// TOOL_CHROME entries, so injecting fake chrome onto them would collide.
const wsDef = ALL_TOOLS.find((t) => t.id === 'workspaces')!;

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
  delete TOOL_CHROME.workspaces;
});

const renderFrame = () => act(() => {
  root.render(
    <ToolWindowFrame tool={wsDef} side="left" onClose={() => {}}>
      <div>body</div>
    </ToolWindowFrame>,
  );
});

describe('single-row window template (v4.39)', () => {
  it('one header row: title left, close at the far right, no second chrome row', () => {
    renderFrame();
    const header = host.querySelector('.tool-window-header')!;
    expect(header).toBeTruthy();
    expect(header.querySelector('.tool-header-title .tool-window-title')?.textContent).toBe('Workspaces');
    const right = header.querySelector('.tool-chrome-right')!;
    expect(right.lastElementChild?.classList.contains('tool-window-close')).toBe(true);
    // the old two-row template and its pop buttons are gone
    expect(host.querySelector('.tool-chrome-row2')).toBeNull();
    expect(host.querySelector('.tool-inline-header')).toBeNull();
    expect(host.querySelector('.tool-window-popin')).toBeNull();
    expect(host.querySelector('.tool-dock-popout')).toBeNull();
    // a chrome-less tool has no controls, so no dangling divider either
    expect(header.querySelector('.tool-chrome-sep')).toBeNull();
  });

  it('TOOL_CHROME slots land in the row: count beside the title, tabs next, cluster · fullscreen · close right', () => {
    TOOL_CHROME.workspaces = {
      TitleExtra: () => <span data-testid="tx">· 3</span>,
      WindowActions: () => <button data-testid="wa">eye</button>,
      useTabs: () => [
        { label: 'Alpha', active: true, onSelect: () => {} },
        { label: 'Beta', active: false, onSelect: () => {} },
      ],
      Controls: () => <span data-testid="ctl">ctl</span>,
    };
    renderFrame();
    const header = host.querySelector('.tool-window-header')!;
    // left: title span carries the count
    expect(header.querySelector('.tool-header-title [data-testid="tx"]')).toBeTruthy();
    // tabs render as the strip, between the title and the right cluster
    const kids = Array.from(header.children);
    const title = header.querySelector('.tool-header-title')!;
    const tabs = header.querySelector('.tool-chrome-tabs')!;
    const right = header.querySelector('.tool-chrome-right')!;
    expect(kids.indexOf(title)).toBeLessThan(kids.indexOf(tabs));
    expect(kids.indexOf(tabs)).toBeLessThan(kids.indexOf(right));
    const tabLabels = Array.from(tabs.querySelectorAll('.tool-chrome-tab')).map((b) => b.textContent);
    expect(tabLabels).toEqual(['Alpha', 'Beta']);
    expect(tabs.querySelector('.tool-chrome-tab.active')?.textContent).toBe('Alpha');
    // right cluster order (v4.69 — the divider is gone; fullscreen and
    // close are distinct bordered buttons): controls · fullscreen · close
    const rightKids = Array.from(right.children);
    const cluster = right.querySelector('.tool-chrome-controls')!;
    expect(cluster.querySelector('[data-testid="ctl"]')).toBeTruthy();
    expect(cluster.querySelector('[data-testid="wa"]')).toBeTruthy();
    expect(right.querySelector('.tool-chrome-sep')).toBeNull();
    const fs = right.querySelector('.char-profiles-fullscreen-btn')!;
    const close = right.querySelector('.tool-window-close')!;
    expect(rightKids.indexOf(cluster)).toBeLessThan(rightKids.indexOf(fs));
    expect(rightKids.indexOf(fs)).toBeLessThan(rightKids.indexOf(close));
  });

  it('a Controls-only tool gets the cluster, no divider anywhere, still one row', () => {
    TOOL_CHROME.workspaces = { Controls: () => <span data-testid="ctl-only">ctl</span> };
    renderFrame();
    const header = host.querySelector('.tool-window-header')!;
    expect(header.querySelector('.tool-chrome-right [data-testid="ctl-only"]')).toBeTruthy();
    expect(header.querySelector('.tool-chrome-sep')).toBeNull();
    expect(header.querySelector('.tool-chrome-tabs')).toBeNull();
    expect(host.querySelector('.tool-chrome-row2')).toBeNull();
  });
});
