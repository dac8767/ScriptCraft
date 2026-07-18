// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { buildRibbonPalette } from './ribbonPaletteData';

/**
 * v3.52, Derek: the ribbon "add item" palette listed the same feature more
 * than once — Title Page existed as a builtin, a command AND a tool, so it
 * showed three times. buildRibbonPalette now keeps one entry per label.
 */
const allOptions = (placed: (v: string) => boolean = () => false) =>
  buildRibbonPalette(placed).flatMap((c) => c.options);

describe('buildRibbonPalette — no duplicate labels', () => {
  it('lists every label at most once', () => {
    const labels = allOptions().map((o) => o.label.trim().toLowerCase());
    const dupes = labels.filter((l, i) => labels.indexOf(l) !== i);
    expect(dupes).toEqual([]);
  });

  it('lists Title Page exactly once', () => {
    const titlePages = allOptions().filter((o) => o.label === 'Title Page');
    expect(titlePages).toHaveLength(1);
  });

  it('drops an item from the palette once it is placed on the bar', () => {
    const survivor = allOptions().find((o) => o.label === 'Title Page')!.value;
    const withPlaced = allOptions((v) => v === survivor).filter((o) => o.label === 'Title Page');
    expect(withPlaced).toHaveLength(0);
  });
});
