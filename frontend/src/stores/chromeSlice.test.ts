// @vitest-environment jsdom
/**
 * v7.37: the chrome-customization slice — the last editorStore extraction.
 *
 * A slice extraction is a refactor, and the only interesting question about a
 * refactor is whether anything MOVED that shouldn't have. Two things can go
 * wrong and neither shows up as a type error:
 *
 *   1. a field silently stops being persisted, because its setter's
 *      saveViewState call was left behind in the old file;
 *   2. the slice quietly imports its way into a runtime cycle — designTokens
 *      imports editorStore for the store-bound tokens' setters, so a slice
 *      that imports designTokens makes `createChromeSlice is not a function`
 *      on the store's first line. (v7.32 proved that one; designSlice carries
 *      the same test.)
 *
 * So this checks the round trip through real storage, not just that the
 * fields exist.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { useEditorStore } from './editorStore';

const VIEW_STATE_KEY = 'opendraft:viewState';
const stored = () => JSON.parse(localStorage.getItem(VIEW_STATE_KEY) || '{}');

describe('chromeSlice: every setter still persists', () => {
  beforeEach(() => { localStorage.removeItem(VIEW_STATE_KEY); });

  it('menu bar order and hidden set', () => {
    const s = useEditorStore.getState();
    s.setMenuBarOrder(['View', 'File']);
    s.setMenuBarHidden(['Tools']);
    expect(stored().menuBarOrder).toEqual(['View', 'File']);
    expect(stored().menuBarHidden).toEqual(['Tools']);
    expect(useEditorStore.getState().menuBarOrder).toEqual(['View', 'File']);
  });

  it('…and File can never be hidden, wherever the guard now lives', () => {
    useEditorStore.getState().setMenuBarHidden(['File', 'Tools']);
    expect(useEditorStore.getState().menuBarHidden).toEqual(['Tools']);
    expect(stored().menuBarHidden).toEqual(['Tools']);
  });

  it('toolbar zones', () => {
    useEditorStore.getState().setToolbarZones(['c:save'], ['t:notes']);
    expect(stored().toolbarLeft).toEqual(['c:save']);
    expect(stored().toolbarRight).toEqual(['t:notes']);
    // the flag that stops a user layout being mistaken for a fresh profile
    expect(stored().toolbarZonesSet).toBe(true);
  });

  it('context menu order and hidden set', () => {
    const s = useEditorStore.getState();
    s.setContextMenuOrder(['thesaurus', 'element']);
    s.setContextMenuHidden(['style']);
    expect(stored().contextMenuOrder).toEqual(['thesaurus', 'element']);
    expect(stored().contextMenuHidden).toEqual(['style']);
  });

  it('panel size mode, name case, item scale and dividers', () => {
    const s = useEditorStore.getState();
    s.setPanelSizeMode('left', 'icons');
    s.setPanelNameCase('upper');
    s.setPanelItemScale('right', 1.4);
    s.setPanelDividers([{ id: 'd1', label: 'Story', side: 'left' }]);
    expect(stored().panelSizeMode.left).toBe('icons');
    expect(stored().panelNameCase).toBe('upper');
    expect(stored().panelItemScale.right).toBe(1.4);
    expect(stored().panelDividers).toHaveLength(1);
    // the other side is untouched — these are per-side, not global
    expect(useEditorStore.getState().panelSizeMode.right).not.toBe('icons');
  });

  it('chrome sizes and gaps, clamped', () => {
    const s = useEditorStore.getState();
    s.setChromeCustomPx('menu', 44);
    s.setChromeGap('toolbar', 6);
    expect(stored().chromeCustomPx.menu).toBe(44);
    expect(stored().chromeGapPx.toolbar).toBe(6);
    // the clamp came across with the setter — a negative gap is not a layout
    s.setChromeGap('toolbar', -99);
    expect(useEditorStore.getState().chromeGapPx.toolbar).toBe(0);
  });

  it('menu and toolbar display modes', () => {
    const s = useEditorStore.getState();
    s.setMenuMode('comfortable');
    s.setToolbarMode('hidden');
    expect(stored().menuMode).toBe('comfortable');
    expect(stored().toolbarMode).toBe('hidden');
  });

  it('big-button inset', () => {
    useEditorStore.getState().setBigBtnInset(9);
    expect(stored().bigBtnInsetPx).toBe(9);
  });
});

describe('chromeSlice: what stayed behind, and why', () => {
  it('does not import the design tokens module (that closes a runtime cycle)', () => {
    const src = readFileSync(join(__dirname, 'slices', 'chromeSlice.ts'), 'utf8');
    const imports = [...src.matchAll(/^import\s[^;]*?from\s+'([^']+)'/gm)].map((m) => m[1]);
    // prove the scan sees the imports that ARE there before trusting an absence
    expect(imports).toContain('../viewState');
    expect(imports).not.toContain('../../design/designTokens');
  });

  it('leaves resetAllSettings on the store — it is cross-slice, not chrome', () => {
    const src = readFileSync(join(__dirname, 'slices', 'chromeSlice.ts'), 'utf8');
    expect(src).not.toContain('resetAllSettings:');
    // and it still works from the store, still reaching past the chrome
    expect(typeof useEditorStore.getState().resetAllSettings).toBe('function');
  });

  it('resetAllSettings still restores the chrome the slice now owns', () => {
    const s = useEditorStore.getState();
    s.setMenuBarHidden(['Tools']);
    s.setToolbarZones(['c:save'], []);
    s.setToolbarMode('hidden');
    useEditorStore.getState().resetAllSettings();
    const after = useEditorStore.getState();
    expect(after.menuBarHidden).toEqual([]);
    expect(after.toolbarMode).toBe('compact');
    expect(after.toolbarLeft.length).toBeGreaterThan(0);   // factory layout, not empty
  });
});
