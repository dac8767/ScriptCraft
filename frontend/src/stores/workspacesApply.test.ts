// @vitest-environment jsdom
/**
 * Workspace save → apply round-trip — the regression guard for the "apply
 * doesn't take" bug: save captured panelSizeMode / chromeCustomPx / theme but
 * apply silently dropped them (two hand-maintained field lists had drifted).
 * If save ever captures a field apply doesn't restore again, this fails.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from './editorStore';

const S = () => useEditorStore.getState();

beforeEach(() => {
  // Drop any workspace left by an earlier test run.
  for (const name of Object.keys(S().workspaces)) S().deleteWorkspace(name);
});

describe('applyWorkspace', () => {
  it('restores every captured field — including the ones that used to be dropped', () => {
    // Distinctive layout A.
    S().setToolbarMode('comfortable');
    S().setMenuMode('comfortable');
    S().setPanelSizeMode('left', 'icons');
    S().setChromeCustomPx('toolbar', 47);
    S().setTheme('light');
    S().saveWorkspace('A');

    // Mutate everything away from A.
    S().setToolbarMode('compact');
    S().setMenuMode('compact');
    S().setPanelSizeMode('left', 'comfortable');
    S().setChromeCustomPx('toolbar', 61);
    S().setTheme('dark');

    S().applyWorkspace('A');

    expect(S().toolbarMode).toBe('comfortable');
    expect(S().menuMode).toBe('comfortable');
    expect(S().panelSizeMode.left).toBe('icons');          // used to stay put
    expect(S().chromeCustomPx.toolbar).toBe(47);           // used to stay put
    expect(S().theme).toBe('light');                       // used to stay put
    expect(S().activeWorkspace).toBe('A');
    // Theme went through setTheme → its own persistence key updated too.
    expect(localStorage.getItem('opendraft:theme')).toBe('light');
  });

  it('save and apply agree on the snapshot field list (lockstep guard)', () => {
    S().saveWorkspace('B');
    const snap = S().workspaces['B'];
    // Mutate every scalar-ish captured field, apply, and check each came back.
    S().setToolbarMode(snap.toolbarMode === 'compact' ? 'comfortable' : 'compact');
    S().setMenuMode(snap.menuMode === 'compact' ? 'comfortable' : 'compact');
    S().setTheme(snap.theme === 'dark' ? 'light' : 'dark');
    S().applyWorkspace('B');
    expect(S().toolbarMode).toBe(snap.toolbarMode);
    expect(S().menuMode).toBe(snap.menuMode);
    expect(S().theme).toBe(snap.theme);
  });

  it('is a no-op for an unknown name', () => {
    const before = S().activeWorkspace;
    S().applyWorkspace('does-not-exist');
    expect(S().activeWorkspace).toBe(before);
  });
});
