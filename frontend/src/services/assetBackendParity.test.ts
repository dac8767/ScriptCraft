/**
 * Every storage backend implements the same asset surface (v7.27).
 *
 * There are FOUR: the HTTP api, Tauri SQLite (what Derek runs), the file
 * fallback, and the no-op fallback. They are structurally independent — no
 * shared interface, and each is spliced onto `api` with Object.assign at
 * runtime — so TypeScript cannot tell you when a method lands in one and not
 * the others. It just falls through to the HTTP version and fails on the
 * desktop, quietly, in whichever mode you were not testing.
 *
 * That is the shape of the bug that took v7.18, v7.19 and v7.20 to finish
 * (one save rule, six writers, found two at a time). This is the cheap guard:
 * add an asset method to one backend and the suite says which three are
 * missing it.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = __dirname;
const read = (f: string) => readFileSync(join(DIR, f), 'utf8');

/** The backends, and what each one's method definitions look like. */
const BACKENDS: Array<{ file: string; label: string }> = [
  { file: 'api.ts', label: 'HTTP api' },
  { file: 'local-storage.ts', label: 'Tauri SQLite' },
  { file: 'file-fallback-storage.ts', label: 'file fallback' },
  { file: 'fallback-storage.ts', label: 'no-op fallback' },
];

/* The surface. Adding a method here without adding it to all four backends is
   the failure this file exists to catch. */
const ASSET_METHODS = [
  'listAssets',
  'uploadAsset',
  'deleteAsset',
  'updateAssetTags',
  'renameAsset',
  'getAssetUrl',
  'getAssetBytes',
];

/** `name:` / `name =` / `async name(` — the three shapes these files use. */
const defines = (src: string, method: string) =>
  new RegExp(`(^|[\\s{,])(async\\s+)?${method}\\s*[:(]`, 'm').test(src);

describe('the asset surface is the same in every backend', () => {
  for (const { file, label } of BACKENDS) {
    it(`${label} (${file}) implements all of them`, () => {
      const src = read(file);
      const missing = ASSET_METHODS.filter((m) => !defines(src, m));
      expect(missing, `${label} is missing: ${missing.join(', ')}`).toEqual([]);
    });
  }

  it('renameAsset changes the DISPLAY name, never the file on disk', () => {
    /* `filename` is what getAssetUrl builds a path from and what a placed
       image resolves through. A rename that touched it would orphan the file
       and blank every picture already on a page. */
    const sql = read('local-storage.ts');
    expect(sql).toMatch(/UPDATE assets SET original_name = \$1/);
    expect(sql).not.toMatch(/UPDATE assets SET filename/);
    expect(read('file-fallback-storage.ts')).toMatch(/a\.original_name = name/);
  });
});
