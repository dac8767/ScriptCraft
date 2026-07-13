// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

/*
 * v1.22 — the Save Script dialog, rendered and read back.
 *
 * The layout rework (Version on its own row, Include-in-Name toggles, renamed
 * labels, no Clear button) is exactly the kind of change that looks right in
 * the source and wrong on screen. So: render it, and assert on what's there.
 */

// The dialog imports the whole save stack; none of it should run in a layout test.
vi.mock('../services/api', () => ({ api: {} }));
vi.mock('../services/cloudApi', () => ({ cloudApi: {} }));
vi.mock('../services/scriptLibrary', () => ({
  getLibraryId: vi.fn(async () => 'lib-1'),
  LIBRARY_NAME: 'My Scripts',
}));
vi.mock('../services/saveLocations', () => ({ mirrorSave: vi.fn() }));
vi.mock('../services/platform', () => ({ isWeb: () => false })); // desktop: folder row renders

import SaveAsDialog from './SaveAsDialog';
import { useSettingsStore } from '../stores/settingsStore';
import { useEditorStore } from '../stores/editorStore';

// jsdom has no canvas: the dialog's path-measuring falls back to showing the
// full path (asserted below). Stub getContext quietly so jsdom doesn't spam
// "Not implemented" on every render.
HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;

let container: HTMLDivElement;
let root: Root;

const renderDialog = (props: { onClose?: () => void; onOpenSaveLocations?: () => void; onDraftCommitted?: (label: string) => void } = {}) => {
  act(() => {
    root.render(
      <SaveAsDialog
        defaultFileName="Untitled Screenplay"
        onSaved={() => {}}
        onClose={props.onClose ?? (() => {})}
        onOpenSaveLocations={props.onOpenSaveLocations ?? (() => {})}
        onDraftCommitted={props.onDraftCommitted}
        buildContent={() => undefined}
      />,
    );
  });
};

// Type into a controlled input the way a user would — through the native
// value setter, so React's onChange actually fires.
const typeInto = (input: HTMLInputElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

const text = (sel: string) => container.querySelector(sel)?.textContent ?? '';

// The Version field autofills from today's date — compute it the same way the
// dialog does, so this test passes on every day it's run, not just the day it
// was written.
const today = new Date();
const todayVersion = [
  String(today.getMonth() + 1).padStart(2, '0'),
  String(today.getDate()).padStart(2, '0'),
  String(today.getFullYear()).slice(-2),
].join('/');
const clickSwitch = (label: string) => {
  const btn = Array.from(container.querySelectorAll('[role="switch"]')).find(
    (b) => b.getAttribute('aria-label') === label,
  ) as HTMLButtonElement;
  expect(btn).toBeTruthy();
  act(() => { btn.click(); });
};

beforeEach(() => {
  document.body.innerHTML = '';
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  useSettingsStore.setState({
    localSaveFolder: '/Users/dcarl/Downloads/',
    saveToCloud: false,
    saveToGDrive: false,
    saveToOneDrive: false,
  });
  useEditorStore.setState({ preferencesRequest: { open: false } });
  renderDialog();
});

afterEach(() => {
  act(() => root.unmount());
});

describe('Save Script dialog layout (v1.22)', () => {
  it('is titled "Save Script", not "Save Screenplay"', () => {
    expect(text('.dialog-header')).toBe('Save Script');
  });

  it('is the wide variant of the dialog box', () => {
    expect(container.querySelector('.dialog-box')!.classList.contains('fs-saveas-dialog')).toBe(true);
  });

  it('Draft and Version each have their own labelled row', () => {
    const labels = Array.from(container.querySelectorAll('.fs-saveas-grid > label')).map(
      (l) => l.textContent,
    );
    expect(labels).toEqual([
      'Script Name:',
      'Draft:',
      'Version:',
      'Location on this device:',
      'Additional save locations:',
    ]);
    // Version is a direct grid child now, not tucked inside an inline sub-row.
    expect(container.querySelector('.fs-saveas-inline')).toBeNull();
    expect(container.querySelector('.fs-saveas-grid > #saveas-version')).toBeTruthy();
  });

  it('without a way to measure, the path shows in full — shortening never eats it', () => {
    expect(text('.fs-saveas-path')).toBe('/Users/dcarl/Downloads/');
  });

  it('the Clear button is gone; the locations button says "Update save locations…"', () => {
    expect(container.querySelector('.fs-saveas-clear')).toBeNull();
    expect(text('.fs-saveas-change')).toBe('Update save locations…');
  });

  it('Script Name, Draft and Version fields are all the same width (none spans the toggle column)', () => {
    for (const id of ['#saveas-name', '#saveas-draft', '#saveas-version']) {
      expect(container.querySelector(id)!.classList.contains('fs-saveas-span')).toBe(false);
    }
  });

  it('additional save locations stack one per line', () => {
    act(() => { useSettingsStore.setState({ saveToCloud: true, saveToGDrive: true }); });
    const items = Array.from(container.querySelectorAll('.fs-saveas-locations-list span'));
    expect(items.map((el) => el.textContent)).toEqual(['ScriptCraft Cloud', 'Google Drive']);
    act(() => { useSettingsStore.setState({ saveToCloud: false, saveToGDrive: false }); });
    expect(text('.fs-saveas-locations-list')).toBe('None');
  });

  it('the "Saves as:" line lives in the footer, before the buttons, with a spacer between (v1.30)', () => {
    const actions = container.querySelector('.dialog-actions')!;
    const kids = Array.from(actions.children).map((el) => el.className || el.tagName);
    expect(actions.querySelector('.fs-saveas-rowlabel')!.textContent).toBe('Saves as:');
    expect(actions.querySelector('.save-as-preview')).toBeTruthy();
    // order: label, preview, flexible gap, then the buttons
    expect(kids.indexOf('fs-saveas-actions-gap')).toBeGreaterThan(kids.indexOf('save-as-preview'));
    expect(kids.indexOf('fs-saveas-actions-gap')).toBeLessThan(kids.findIndex((k) => k === 'BUTTON'));
    // and it is GONE from the grid
    expect(container.querySelector('.fs-saveas-grid .save-as-preview')).toBeNull();
  });

  it('the active toggles explain themselves on hover; the locked one explains the lock', () => {
    const switches = Array.from(container.querySelectorAll('[role="switch"]'));
    expect(switches.map((el) => el.getAttribute('title'))).toEqual([
      'Script Name is always part of the saved name',
      'Include in save filename',
      'Include in save filename',
    ]);
  });
});

describe('Include in Name toggles', () => {
  it('three switches — Script Name locked, Draft and Version live', () => {
    const switches = Array.from(container.querySelectorAll('[role="switch"]'));
    expect(switches.map((s) => s.getAttribute('aria-label'))).toEqual([
      'Script Name is always included in the name',
      'Include Draft in name',
      'Include Version in name',
    ]);
    expect(text('.fs-saveas-colhead')).toBe('Include');
    // The header sits on its own row ABOVE the toggles: first grid child.
    expect(container.querySelector('.fs-saveas-grid')!.children[0].className).toContain('fs-saveas-colhead');
  });

  it("Script Name's switch is on, disabled, and clicking it changes nothing", () => {
    const lock = container.querySelector('.fs-toggle-locked') as HTMLButtonElement;
    expect(lock.disabled).toBe(true);
    expect(lock.getAttribute('aria-checked')).toBe('true');
    const before = text('.save-as-preview');
    act(() => { lock.click(); });
    expect(text('.save-as-preview')).toBe(before);
  });

  it('both on by default: full "Name · Draft - Version" preview', () => {
    expect(text('.fs-saveas-rowlabel')).toBe('Saves as:');
    expect(text('.save-as-preview')).toBe(`Untitled Screenplay - First Draft - ${todayVersion}`);
  });

  it('Version off → "Name · Draft"', () => {
    clickSwitch('Include Version in name');
    expect(text('.save-as-preview')).toBe('Untitled Screenplay - First Draft');
  });

  it('both off → the name stands alone', () => {
    clickSwitch('Include Draft in name');
    clickSwitch('Include Version in name');
    expect(text('.save-as-preview')).toBe('Untitled Screenplay');
  });

  it('toggling back on restores the piece — the field value was never lost', () => {
    clickSwitch('Include Version in name');
    clickSwitch('Include Version in name');
    expect(text('.save-as-preview')).toBe(`Untitled Screenplay - First Draft - ${todayVersion}`);
  });
});

describe('Draft is one shared value (v1.34)', () => {
  it('editing Draft here and leaving the field commits it to the shared value', () => {
    const onDraftCommitted = vi.fn();
    renderDialog({ onDraftCommitted });
    const input = container.querySelector('#saveas-draft') as HTMLInputElement;
    typeInto(input, 'Second Draft');
    act(() => { input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); });
    expect(onDraftCommitted).toHaveBeenCalledWith('Second Draft');
  });

  it('an unchanged Draft commits nothing — no gratuitous writes', () => {
    const onDraftCommitted = vi.fn();
    renderDialog({ onDraftCommitted });
    const input = container.querySelector('#saveas-draft') as HTMLInputElement;
    act(() => { input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); });
    expect(onDraftCommitted).not.toHaveBeenCalled();
  });
});

describe('the Settings round-trip keeps your entries (v1.23)', () => {
  it('Update save locations… opens Settings WITHOUT closing the dialog, and everything survives the trip', () => {
    const onClose = vi.fn();
    const onOpenSaveLocations = vi.fn(() => useEditorStore.getState().openPreferences('saveloc'));
    renderDialog({ onClose, onOpenSaveLocations });

    // Fill the form in, the way a user would before noticing the locations row.
    typeInto(container.querySelector('#saveas-name') as HTMLInputElement, 'Blackwater');
    clickSwitch('Include Version in name');
    expect(text('.save-as-preview')).toBe('Blackwater - First Draft');

    act(() => { (container.querySelector('.fs-saveas-change') as HTMLButtonElement).click(); });

    // The dialog did NOT unmount — it's hidden under Settings, state intact.
    expect(onOpenSaveLocations).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    const overlay = container.querySelector('.dialog-overlay') as HTMLElement;
    expect(overlay.style.display).toBe('none');

    // Settings closes -> the dialog is visible again with everything you typed.
    act(() => { useEditorStore.getState().closePreferences(); });
    expect(overlay.style.display).not.toBe('none');
    expect((container.querySelector('#saveas-name') as HTMLInputElement).value).toBe('Blackwater');
    expect(text('.save-as-preview')).toBe('Blackwater - First Draft');
  });
});
