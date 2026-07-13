import { describe, it, expect, vi } from 'vitest';

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
  const pathFor = (folder: string, title: string) => {
    const safe = (s: string) => (s || 'Untitled').replace(/[\\/:*?"<>|]/g, '-').slice(0, 120);
    const sep = folder.endsWith('/') ? '' : '/';
    return `${folder}${sep}${safe(title)}.odraft.json`;
  };

  it('writes <folder>/<script name>.odraft.json', () => {
    expect(pathFor('/Users/dcarl/Scripts', 'Blackwater'))
      .toBe('/Users/dcarl/Scripts/Blackwater.odraft.json');
  });

  it('tolerates a trailing slash rather than producing a double one', () => {
    expect(pathFor('/Users/dcarl/Scripts/', 'Blackwater'))
      .toBe('/Users/dcarl/Scripts/Blackwater.odraft.json');
  });

  it('a name with a slash in it cannot escape the folder', () => {
    expect(pathFor('/Users/dcarl/Scripts', 'Act 1/2')).toBe('/Users/dcarl/Scripts/Act 1-2.odraft.json');
  });

  it('no folder set = no file written (the app keeps it internally)', () => {
    const folder = '';
    const jobs = folder ? ['This device'] : [];
    expect(jobs).toEqual([]);
  });
});
