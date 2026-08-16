// @vitest-environment jsdom
/**
 * v7.26, Derek: "dragging an image onto the asset manager glitches the app
 * heavily" — his screenshot showed the app replaced by a white page with the
 * dropped image on it. WebKit had navigated to the file; the app was unloaded.
 *
 * These assert on `defaultPrevented`, which is the only thing that decides
 * whether the engine navigates. A test that checked "the guard is installed"
 * would have passed against a guard that listened for the wrong event.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { installDropGuard } from './dropGuard';

let uninstall: (() => void) | null = null;
afterEach(() => { uninstall?.(); uninstall = null; document.body.innerHTML = ''; });

/** A drag event that bubbles, as a real one does. */
const fire = (el: EventTarget, type: string) => {
  const e = new Event(type, { bubbles: true, cancelable: true });
  el.dispatchEvent(e);
  return e;
};

describe('installDropGuard', () => {
  it('stops a drop on the page from navigating', () => {
    uninstall = installDropGuard();
    expect(fire(document.body, 'drop').defaultPrevented).toBe(true);
  });

  it('stops the dragover too — without it the drop is never dispatched at all', () => {
    // The half that is easy to omit and impossible to notice: leave dragover
    // alone and the engine takes the drop before any listener runs, so a drop
    // handler that never fires reads exactly like a working fix.
    uninstall = installDropGuard();
    expect(fire(document.body, 'dragover').defaultPrevented).toBe(true);
  });

  it('covers a drop that MISSES a drop zone by a few pixels — the real case', () => {
    uninstall = installDropGuard();
    const zone = document.createElement('div');
    const beside = document.createElement('div');
    document.body.append(zone, beside);
    zone.addEventListener('drop', (e) => e.preventDefault());
    // aimed at the Asset Manager, landed next to it
    expect(fire(beside, 'drop').defaultPrevented).toBe(true);
  });

  it('leaves a real drop zone\'s own handler working', () => {
    uninstall = installDropGuard();
    const zone = document.createElement('div');
    document.body.appendChild(zone);
    let handled = 0;
    zone.addEventListener('drop', () => { handled++; });
    fire(zone, 'drop');
    expect(handled).toBe(1);          // the guard suppresses the default, not the app
  });

  it('is removable, and really does stop guarding', () => {
    const off = installDropGuard();
    off();
    expect(fire(document.body, 'drop').defaultPrevented).toBe(false);
  });
});
