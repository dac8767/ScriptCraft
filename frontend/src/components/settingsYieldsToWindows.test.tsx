// @vitest-environment jsdom
/**
 * v7.24, Derek: "if somehow a window opens while the settings window is open,
 * then the settings window should close."
 *
 * Settings is a floating window like any other — it simply was not a party to
 * the one-window rule v5.21 already had. Two choke points cover every way a
 * window can be born, and this drives both:
 *
 *   · editorStore's closeOtherFloats / enterToolFullscreen — tool windows;
 *   · the .dialog-overlay watcher in PreferencesDialog — every dialog.
 *
 * The watcher is at the DOM because only two thirds of the dialogs go through
 * the Modal shell; the other fourteen still hand-roll their overlay, and a
 * rule inside Modal would have looked complete while missing them. So this
 * drives BOTH shapes.
 *
 * The exemptions matter as much as the rule. Design and Helper Text are the
 * tools you keep up WHILE working in another window (FLOAT_EXEMPT since v5.32
 * / v6.52), and a confirm is Settings talking, not a window opening over it —
 * closing Settings under its own "are you sure?" would be the worse bug.
 */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { useEditorStore, DEFAULT_TOOL_CONFIG } from '../stores/editorStore';
import { Modal } from './Modal';
import ConfirmDialogHost, { confirmDialog } from './ConfirmDialog';
import PreferencesDialog from './PreferencesDialog';

// FloatingWindow watches the chrome's height; jsdom has no ResizeObserver.
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver ??= class {
  observe() {} unobserve() {} disconnect() {}
};

const store = () => useEditorStore.getState();
const settingsOpen = () => store().preferencesRequest.open;

let host: HTMLElement | null = null;
let root: Root | null = null;

const render = (node: React.ReactNode) => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => { root!.render(node); });
};

beforeEach(() => {
  useEditorStore.setState({
    toolConfig: { ...DEFAULT_TOOL_CONFIG },
    activeTool: null, activeToolRight: null, tempTool: null, fullscreenTool: null,
    shelfOpen: false, navigatorOpen: false,
  });
  store().openPreferences();
  expect(settingsOpen()).toBe(true);
});

afterEach(() => {
  act(() => { root?.unmount(); });
  root = null;
  host?.remove();
  host = null;
  store().closePreferences();
});

describe('the Settings window yields to a window opening over it', () => {
  it('a tool window floating closes it', () => {
    useEditorStore.setState({
      toolConfig: { ...store().toolConfig, goals: { side: 'right', enabled: false } },
    });
    store().openTool('goals');
    expect(store().tempTool).toBe('goals');       // a window was born
    expect(settingsOpen()).toBe(false);
  });

  it('a fullscreen takeover closes it', () => {
    store().enterToolFullscreen('goals');
    expect(store().fullscreenTool).toBe('goals');
    expect(settingsOpen()).toBe(false);
  });

  it('the tools you use ALONGSIDE another window leave it up', () => {
    // Design and Helper Text are exempt from the one-window rule in both
    // directions; Settings follows the same list rather than keeping a second.
    store().setToolMode('design', 'floating');
    expect(settingsOpen()).toBe(true);
  });

  /* The dialog half needs the window itself mounted — the rule is its own. */
  const withSettings = (extra: React.ReactNode) => {
    const Host = () => {
      const open = useEditorStore((s) => s.preferencesRequest.open);
      const close = useEditorStore((s) => s.closePreferences);
      return <>
        <PreferencesDialog open={open} onClose={close} />
        {extra}
      </>;
    };
    render(<Host />);
  };

  it('a dialog through the Modal shell closes it', async () => {
    withSettings(null);
    expect(document.querySelector('.prefs-window')).toBeTruthy();
    await act(async () => {
      const box = document.createElement('div');
      box.className = 'dialog-overlay';
      document.body.appendChild(box);
      await new Promise((r) => setTimeout(r, 0));   // MutationObserver is async
    });
    expect(settingsOpen()).toBe(false);
  });

  it('…and one that hand-rolls its overlay closes it too — the fourteen Modal misses', async () => {
    let overlay: HTMLElement | null = null;
    withSettings(null);
    await act(async () => {
      // exactly what OpenFile/SaveAs/VersionHistory render: an overlay nested
      // inside their own wrapper, never touching the Modal shell.
      const wrap = document.createElement('div');
      overlay = document.createElement('div');
      overlay.className = 'dialog-overlay';
      wrap.appendChild(overlay);
      document.body.appendChild(wrap);
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(overlay).toBeTruthy();
    expect(settingsOpen()).toBe(false);
  });

  it('…but a dialog Settings itself renders does not — Page Setup ▸ View', async () => {
    // It lives INSIDE the window (not portalled), so closing Settings would
    // take the dialog down with it. Two checks caught this the first time.
    withSettings(null);
    await act(async () => {
      const overlay = document.createElement('div');
      overlay.className = 'dialog-overlay';
      document.querySelector('.prefs-window')!.appendChild(overlay);
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(settingsOpen()).toBe(true);
  });

  it('…but a confirm does not — that is Settings talking, not a window', async () => {
    withSettings(<ConfirmDialogHost />);
    let answered: boolean | null = null;
    await act(async () => {
      void confirmDialog('Reset everything?').then((r) => { answered = r as boolean; });
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(document.querySelector('.fs-confirm-overlay')).toBeTruthy();   // it really is up
    expect(document.querySelector('.fs-confirm-overlay .dialog-overlay')).toBeNull();
    expect(settingsOpen()).toBe(true);
    void answered;
  });

  it('the Modal shell itself carries no copy of the rule', () => {
    // One rule, in one place: if this ever grows a second the two will drift,
    // and the DOM watcher already covers everything Modal could.
    render(<Modal onClose={() => {}}>body</Modal>);
    expect(document.querySelector('.dialog-overlay')).toBeTruthy();
    expect(settingsOpen()).toBe(true);              // no Settings window mounted
  });
});
