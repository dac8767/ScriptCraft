// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { describeElement } from './devInspect';

/** Rebuild the app's real markup, class for class, and click into it. */
const mount = (html: string) => { document.body.innerHTML = html; };
const hit = (sel: string) => describeElement(document.querySelector(sel));

describe('devInspect — what does a click resolve to?', () => {
  it('a panel tool tab knows which panel it is in', () => {
    mount(`
      <div class="tool-dock-wrap tool-dock-right">
        <div class="tool-dock">
          <button class="tool-dock-item" title="Notes">
            <span class="tool-dock-icon"></span><span class="tool-dock-label">Notes</span>
          </button>
        </div>
      </div>`);
    const cap = hit('.tool-dock-label')!;
    console.log('  click Notes tab (right dock) ->', cap.name, '|', cap.kind);
    expect(cap.name).toBe('Notes — Right Panel');
    expect(cap.kind).toBe('tool id: sticky');       // resolved through ALL_TOOLS
  });

  it('the same tab on the left reads Left Panel', () => {
    mount(`
      <div class="tool-dock-wrap tool-dock-left">
        <div class="tool-dock">
          <button class="tool-dock-item" title="Navigator">
            <span class="tool-dock-label">Navigator</span>
          </button>
        </div>
      </div>`);
    const cap = hit('.tool-dock-item')!;
    console.log('  click Navigator tab (left)   ->', cap.name);
    expect(cap.name).toBe('Navigator — Left Panel');
  });

  it('a menu bar item', () => {
    mount(`<div class="menu-bar"><div class="menu-item"><span class="menu-label">Tools</span></div></div>`);
    const cap = hit('.menu-label')!;
    console.log('  click the Tools menu         ->', cap.name);
    expect(cap.name).toBe('Tools — Menu Bar');
  });

  it('a menu ROW names its parent menu', () => {
    mount(`
      <div class="menu-bar">
        <div class="menu-item active"><span class="menu-label">File</span></div>
        <div class="menu-dropdown">
          <div class="menu-dropdown-item" title="Preferences…">Preferences…</div>
        </div>
      </div>`);
    const cap = hit('.menu-dropdown-item')!;
    console.log('  click File > Preferences     ->', cap.name);
    expect(cap.name).toBe('File > Preferences…');
  });

  it('a toolbar button resolves to its registry key', () => {
    mount(`<div class="toolbar"><button class="toolbar-btn" title="Bold"></button></div>`);
    const cap = hit('.toolbar-btn')!;
    console.log('  click Bold in the toolbar    ->', cap.name, '|', cap.kind);
    expect(cap.name).toBe('Bold — Toolbar');
    expect(cap.kind).toBe('toolbar key: bold');
  });

  it('a control inside an open panel names both', () => {
    mount(`
      <div class="tool-dock-wrap tool-dock-right">
        <div class="tool-dock">
          <button class="tool-dock-item active" title="Notes"><span class="tool-dock-label">Notes</span></button>
          <div class="tool-inline">
            <div class="fs-list-toolbar">
              <button class="fs-addmenu-trigger">Sort: Manual</button>
            </div>
          </div>
        </div>
      </div>`);
    const cap = hit('.fs-addmenu-trigger')!;
    console.log('  click Sort inside Notes      ->', cap.name);
    expect(cap.name).toBe('Sort: Manual — Notes (Right Panel)');
  });

  it('a script element reports its type and a snippet', () => {
    mount(`<div class="page"><div class="screenplay-element action" data-type="action">She walks in.</div></div>`);
    const cap = hit('.screenplay-element')!;
    console.log('  click an action line         ->', cap.name);
    expect(cap.name).toContain('action element');
    expect(cap.name).toContain('She walks in.');
  });

  it('a Customize row names the row and the tab', () => {
    mount(`
      <div class="fs-customize-dialog">
        <div class="fs-customize-sidebar"><button class="active">Toolbar</button></div>
        <div class="fs-customize-body">
          <div class="fs-customize-row"><span class="fs-customize-tool">Bold</span></div>
        </div>
      </div>`);
    const cap = hit('.fs-customize-tool')!;
    console.log('  click a Customize row        ->', cap.name);
    expect(cap.name).toBe('"Bold" row — Customize > Toolbar');
  });

  it('never captures the picker\'s own UI', () => {
    mount(`<div class="dev-picker" data-dev-panel><button class="dev-picker-btn">Copy</button></div>`);
    expect(hit('.dev-picker-btn')).toBeNull();
  });
});
