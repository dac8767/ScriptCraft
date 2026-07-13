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

const renderDialog = (props: { onClose?: () => void; onOpenSaveLocations?: () => void } = {}) => {
  act(() => {
    root.render(
      <SaveAsDialog
        defaultFileName="Untitled Screenplay"
        onSaved={() => {}}
        onClose={props.onClose ?? (() => {})}
        onOpenSaveLocations={props.onOpenSaveLocations ?? (() => {})}
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
  useSettingsStore.setState({ localSaveFolder: '/Users/dcarl/Downloads/' });
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
      'Script Name',
      'Draft',
      'Version',
      'Location on this device:',
      'Additional locations:',
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

  it('the "Saves as:" row lives in the grid directly under Version', () => {
    const gridChildren = Array.from(container.querySelector('.fs-saveas-grid')!.children);
    const versionIdx = gridChildren.findIndex((el) => el.id === 'saveas-version');
    // version input, its toggle, then the preview row
    expect((gridChildren[versionIdx + 2] as HTMLElement).className).toContain('fs-saveas-rowlabel');
    expect((gridChildren[versionIdx + 3] as HTMLElement).className).toContain('save-as-preview');
    const locationIdx = gridChildren.findIndex((el) => el.textContent === 'Location on this device:');
    expect(versionIdx).toBeLessThan(locationIdx);
    expect(gridChildren.indexOf(container.querySelector('.save-as-preview')!)).toBeLessThan(locationIdx);
  });
});

describe('Include in Name toggles', () => {
  it('exactly two switches — Draft and Version. Script Name has none, ever.', () => {
    const switches = Array.from(container.querySelectorAll('[role="switch"]'));
    expect(switches.map((s) => s.getAttribute('aria-label'))).toEqual([
      'Include Draft in name',
      'Include Version in name',
    ]);
    expect(text('.fs-saveas-colhead')).toBe('Include');
  });

  it('both on by default: full "Name · Draft - Version" preview', () => {
    expect(text('.fs-saveas-rowlabel')).toBe('Saves as:');
    expect(text('.save-as-preview')).toBe(`Untitled Screenplay · First Draft - ${todayVersion}`);
  });

  it('Version off → "Name · Draft"', () => {
    clickSwitch('Include Version in name');
    expect(text('.save-as-preview')).toBe('Untitled Screenplay · First Draft');
  });

  it('both off → the name stands alone', () => {
    clickSwitch('Include Draft in name');
    clickSwitch('Include Version in name');
    expect(text('.save-as-preview')).toBe('Untitled Screenplay');
  });

  it('toggling back on restores the piece — the field value was never lost', () => {
    clickSwitch('Include Version in name');
    clickSwitch('Include Version in name');
    expect(text('.save-as-preview')).toBe(`Untitled Screenplay · First Draft - ${todayVersion}`);
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
    expect(text('.save-as-preview')).toBe('Blackwater · First Draft');

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
    expect(text('.save-as-preview')).toBe('Blackwater · First Draft');
  });
});
