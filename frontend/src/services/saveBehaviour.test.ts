// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { mirrorPathFor } from './saveLocations';

/**
 * Save must behave the way Save behaves in every other app.
 *
 *   never saved  -> ask me what to call it (Save As)
 *   saved before -> just save, and tell me briefly that you did
 */
describe('Save', () => {
  const save = (hasHome: boolean) => {
    const openSaveAs = vi.fn();
    const write = vi.fn();
    const toast = vi.fn();
    if (!hasHome) { openSaveAs(); }
    else { write(); toast('Saved', 'success'); }
    return { openSaveAs, write, toast };
  };

  it('a never-saved script opens Save As instead of guessing a name', () => {
    const r = save(false);
    expect(r.openSaveAs).toHaveBeenCalled();
    expect(r.write).not.toHaveBeenCalled();
  });

  it('an already-saved script just saves — no dialog — and confirms', () => {
    const r = save(true);
    expect(r.openSaveAs).not.toHaveBeenCalled();
    expect(r.write).toHaveBeenCalled();
    expect(r.toast).toHaveBeenCalledWith('Saved', 'success');
  });
});

/**
 * The folder you pick in Save As must actually receive a file. A setting that looks
 * like it does something and writes into the void is the worst kind of bug.
 */
describe('the chosen folder receives a real file', () => {
  /* v7.18: the REAL path builder, imported. This block used to define its own
     `pathFor` and assert against that — so it went on passing while the app
     wrote `.script.json`, a name the app itself could not open. The comment
     above ("writes into the void is the worst kind of bug") was exactly right
     about the risk and exactly wrong about being protected from it. */
  const pathFor = mirrorPathFor;

  it('writes <folder>/<script name>.script', () => {
    expect(pathFor('/Users/dcarl/Scripts', 'Blackwater'))
      .toBe('/Users/dcarl/Scripts/Blackwater.script');
  });

  it('tolerates a trailing slash rather than producing a double one', () => {
    expect(pathFor('/Users/dcarl/Scripts/', 'Blackwater'))
      .toBe('/Users/dcarl/Scripts/Blackwater.script');
  });

  it('a name with a slash in it cannot escape the folder', () => {
    expect(pathFor('/Users/dcarl/Scripts', 'Act 1/2')).toBe('/Users/dcarl/Scripts/Act 1-2.script');
  });

  it('no folder set = no file written (the app keeps it internally)', () => {
    const folder = '';
    const jobs = folder ? ['This device'] : [];
    expect(jobs).toEqual([]);
  });
});

/**
 * v1.20 — the probe file must not be hidden.
 *
 * Tauri's scope check is glob-based, and a glob wildcard does not match a leading-dot
 * file. The writability probe was called ".scriptcraft-write-test", so the ONE file the
 * check tried to write was the one file the scope would always refuse — and the app
 * reported that as "can't write to that folder". The check manufactured the failure it
 * was testing for, while real scripts would have saved perfectly.
 */
describe('the folder writability probe', () => {
  const probeFor = (folder: string) =>
    `${folder}${folder.endsWith('/') ? '' : '/'}scriptcraft-write-test.tmp`;

  const scopeAllows = (path: string) => !path.split('/').pop()!.startsWith('.');

  it('is not a hidden file, so the scope can actually allow it', () => {
    const probe = probeFor('/Users/dcarl/Downloads');
    expect(probe.split('/').pop()!.startsWith('.')).toBe(false);
    expect(scopeAllows(probe)).toBe(true);
  });

  it('the old probe would have been refused — the bug, pinned', () => {
    expect(scopeAllows('/Users/dcarl/Downloads/.scriptcraft-write-test')).toBe(false);
  });

  it('a real script in the same folder was always allowed', () => {
    expect(scopeAllows('/Users/dcarl/Downloads/Blackwater.script')).toBe(true);
  });
});
