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

// jsdom has no canvas: the dialog's path-measuring falls back to showing the
// full path (asserted below). Stub getContext quietly so jsdom doesn't spam
// "Not implemented" on every render.
HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;

let container: HTMLDivElement;
let root: Root;

const renderDialog = () => {
  act(() => {
    root.render(
      <SaveAsDialog
        defaultFileName="Untitled Screenplay"
        onSaved={() => {}}
        onClose={() => {}}
        onOpenSaveLocations={() => {}}
        buildContent={() => undefined}
      />,
    );
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

  it('the Clear button is gone; the locations button says "Update locations…"', () => {
    expect(container.querySelector('.fs-saveas-clear')).toBeNull();
    expect(text('.fs-saveas-change')).toBe('Update locations…');
  });
});

describe('Include in Name toggles', () => {
  it('exactly two switches — Draft and Version. Script Name has none, ever.', () => {
    const switches = Array.from(container.querySelectorAll('[role="switch"]'));
    expect(switches.map((s) => s.getAttribute('aria-label'))).toEqual([
      'Include Draft in name',
      'Include Version in name',
    ]);
    expect(text('.fs-saveas-colhead')).toBe('Include in Name');
  });

  it('both on by default: full "Name · Draft - Version" preview', () => {
    expect(text('.save-as-preview')).toBe(`Saves as: Untitled Screenplay · First Draft - ${todayVersion}`);
  });

  it('Version off → "Name · Draft"', () => {
    clickSwitch('Include Version in name');
    expect(text('.save-as-preview')).toBe('Saves as: Untitled Screenplay · First Draft');
  });

  it('both off → the name stands alone', () => {
    clickSwitch('Include Draft in name');
    clickSwitch('Include Version in name');
    expect(text('.save-as-preview')).toBe('Saves as: Untitled Screenplay');
  });

  it('toggling back on restores the piece — the field value was never lost', () => {
    clickSwitch('Include Version in name');
    clickSwitch('Include Version in name');
    expect(text('.save-as-preview')).toBe(`Saves as: Untitled Screenplay · First Draft - ${todayVersion}`);
  });
});
