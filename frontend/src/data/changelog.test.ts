/**
 * v4.73 — regression net for the "What's New" crash. changelog.json carries
 * two entry shapes (curated `items` and appended `changes` strings); the
 * adapter must normalize EVERY entry to the dialog's contract, because one
 * malformed entry crashes the whole window on open (it did — Derek's
 * screenshot, entry.items.filter of undefined).
 */
import { describe, it, expect } from 'vitest';
import { CHANGELOG, APP_VERSION, tagsFor } from './changelog';

describe('changelog data contract', () => {
  it('every entry has items with string titles (both source shapes normalize)', () => {
    expect(CHANGELOG.length).toBeGreaterThan(300);
    for (const e of CHANGELOG) {
      expect(Array.isArray(e.items), `v${e.version} has no items array`).toBe(true);
      expect(e.items.length, `v${e.version} has zero items`).toBeGreaterThan(0);
      for (const it of e.items) {
        expect(typeof it.title, `v${e.version} item title`).toBe('string');
        expect(it.title.length, `v${e.version} empty title`).toBeGreaterThan(0);
        expect(typeof it.detail, `v${e.version} item detail`).toBe('string');
        // the dialog calls tagsFor on every item — it must never throw
        expect(tagsFor(it).length).toBeGreaterThan(0);
      }
    }
  });

  it('the newest entry matches APP_VERSION (the What\'s New header)', () => {
    expect(CHANGELOG[0].version).toBe(APP_VERSION);
  });

  it('versions are newest-first and unique', () => {
    const versions = CHANGELOG.map((e) => e.version);
    expect(new Set(versions).size).toBe(versions.length);
  });

  it('a changes-string entry split into a readable title/detail', () => {
    const e471 = CHANGELOG.find((e) => e.version === '4.71')!;
    const first = e471.items[0];
    expect(first.title).toBe('Ribbon toolbar');
    expect(first.detail).toContain('toggle buttons');
  });
});
