// @vitest-environment jsdom
/**
 * ToolDock hook stability (v2.27) — regression for the crash Derek hit on
 * every launch: scrapbookSolo was `useNotebookStore(...) && useSettingsStore(...)`,
 * so the second hook short-circuited away while the Scrapbook was closed.
 * The moment notebookOpen flipped (opening the tool — or a saved layout
 * restoring it at BOOT), the hook count changed and React threw
 * "undefined is not an object (evaluating 'prevDeps.length')" behind the
 * "ScriptCraft failed to start" overlay. The dock must survive the flip,
 * in both directions, with the solo setting on and off.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import ToolDock from './ToolDock';
import { useNotebookStore } from '../stores/notebookStore';
import { useSettingsStore } from '../stores/settingsStore';

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
  act(() => { useNotebookStore.getState().setNotebookOpen(false); });
});

describe('ToolDock hook order', () => {
  it('survives the Scrapbook opening and closing (the v2.27 boot crash)', () => {
    for (const exclusive of [false, true]) {
      act(() => { useSettingsStore.getState().setScrapbookExclusive(exclusive); });
      act(() => { root.render(<ToolDock side="left" editor={null} scrollContainer={null} />); });
      // The flip that crashed pre-fix: closed → open → closed.
      expect(() => {
        act(() => { useNotebookStore.getState().setNotebookOpen(true); });
        act(() => { useNotebookStore.getState().setNotebookOpen(false); });
      }).not.toThrow();
    }
  });
});
