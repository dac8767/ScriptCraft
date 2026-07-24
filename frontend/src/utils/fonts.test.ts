/**
 * Fonts registry — the FONT_REGISTRY / FONT_CATEGORIES pair that drives the
 * font picker, and getFontsByCategory which groups the registry for display.
 *
 * Two things are pinned here:
 *
 * 1. getFontsByCategory: one key per FONT_CATEGORIES entry (in that order),
 *    each holding the registry entries of that category in registry order,
 *    with every registry entry landing in exactly one group.
 *
 * 2. The CLAUDE.md §3 two-lists drift-guard: FONT_CATEGORIES and the
 *    `category` strings inside FONT_REGISTRY are two lists that must not
 *    drift. FontEntry.category is typed as plain `string`, so tsc does NOT
 *    catch a typo'd category — and getFontsByCategory silently DROPS any
 *    entry whose category is not in FONT_CATEGORIES (each group is a filter
 *    over the registry; unmatched entries appear in no group). This suite is
 *    the only guard.
 *
 * loadFont is DOM (appends a <link> to document.head) — deliberately not
 * covered here.
 */
import { describe, it, expect } from 'vitest';
import { FONT_CATEGORIES, FONT_REGISTRY, getFontsByCategory } from './fonts';

describe('FONT_REGISTRY / FONT_CATEGORIES drift-guard', () => {
  it('every registry entry uses a category from FONT_CATEGORIES', () => {
    const known: readonly string[] = FONT_CATEGORIES;
    for (const font of FONT_REGISTRY) {
      // A failure here means a typo'd/renamed category: getFontsByCategory
      // would silently drop the font from the picker (see header).
      expect(known, `"${font.name}" has unknown category "${font.category}"`).toContain(font.category);
    }
  });

  it('every category has at least one font (no dead group in the picker)', () => {
    const used = new Set(FONT_REGISTRY.map(f => f.category));
    for (const cat of FONT_CATEGORIES) {
      expect(used.has(cat), `category "${cat}" has no fonts`).toBe(true);
    }
  });

  it('font names are unique', () => {
    const names = FONT_REGISTRY.map(f => f.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('pins the exact category list and registry size', () => {
    expect(FONT_CATEGORIES).toEqual([
      'Script Standard',
      'Latin Extended',
      'Indian / Indic',
      'Arabic & Hebrew',
      'CJK',
      'Other',
    ]);
    expect(FONT_REGISTRY).toHaveLength(25);
  });
});

describe('getFontsByCategory', () => {
  const grouped = getFontsByCategory();

  it('has exactly one key per category, in FONT_CATEGORIES order', () => {
    expect(Object.keys(grouped)).toEqual([...FONT_CATEGORIES]);
  });

  it('groups the registry with hand-counted sizes per category', () => {
    expect(grouped['Script Standard']).toHaveLength(3);
    expect(grouped['Latin Extended']).toHaveLength(3);
    expect(grouped['Indian / Indic']).toHaveLength(9);
    expect(grouped['Arabic & Hebrew']).toHaveLength(3);
    expect(grouped['CJK']).toHaveLength(4);
    expect(grouped['Other']).toHaveLength(3);
  });

  it('keeps registry order within each group and loses no entry', () => {
    expect(grouped['Script Standard'].map(f => f.name)).toEqual([
      'Courier Prime',
      'Courier New',
      'Arial',
    ]);
    expect(grouped['Arabic & Hebrew'].map(f => f.name)).toEqual([
      'Noto Sans Arabic',
      'Noto Naskh Arabic',
      'Noto Sans Hebrew',
    ]);
    expect(grouped['CJK'].map(f => f.name)).toEqual([
      'Noto Sans JP',
      'Noto Sans SC',
      'Noto Sans TC',
      'Noto Sans KR',
    ]);
    // Flattening the groups in category order reproduces the registry
    // exactly — nothing dropped, nothing duplicated. This holds because the
    // registry is written in category order; entries out of that order would
    // still all be present, just resorted.
    const flattened = FONT_CATEGORIES.flatMap(cat => grouped[cat]);
    expect(flattened).toEqual(FONT_REGISTRY);
  });

  it('returns the registry entries themselves, not copies', () => {
    // Consumers get the same objects (cheap, but mutation would hit the
    // shared registry) — pinned as actual behavior.
    expect(grouped['Script Standard'][0]).toBe(FONT_REGISTRY[0]);
  });

  it('pins the exact shape of one entry per source kind', () => {
    expect(grouped['Script Standard'][0]).toEqual({
      name: 'Courier Prime',
      category: 'Script Standard',
      scripts: ['latin'],
      source: 'local',
      direction: 'ltr',
    });
    expect(grouped['Script Standard'][1]).toEqual({
      name: 'Courier New',
      category: 'Script Standard',
      scripts: ['latin'],
      source: 'system',
      direction: 'ltr',
    });
    expect(grouped['Arabic & Hebrew'][0]).toEqual({
      name: 'Noto Sans Arabic',
      category: 'Arabic & Hebrew',
      scripts: ['arabic'],
      source: 'google',
      direction: 'rtl',
    });
  });

  it('RTL is confined to the Arabic & Hebrew group', () => {
    for (const cat of FONT_CATEGORIES) {
      for (const font of grouped[cat]) {
        expect(font.direction).toBe(cat === 'Arabic & Hebrew' ? 'rtl' : 'ltr');
      }
    }
  });
});
