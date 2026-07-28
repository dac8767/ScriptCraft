/**
 * ribbonKindVars (v5.14) — the per-kind ribbon geometry.
 *
 * Derek: with titled and untitled sections mixed, untitled sections showed a
 * dead gap where the (invisible, reserved) title band sat. Option (a) of his
 * two: untitled sections' rows STRETCH so their total height equals a titled
 * section's rows + band — bases level, button tops level with the title's
 * top. The Design scale knobs then multiply each kind independently.
 *
 * The invariant that matters: at 100%/100%, kUntitled × untitledBase must
 * EQUAL kTitled × titledBase — that equality IS the alignment.
 */
import { describe, it, expect } from 'vitest';
import { ribbonKindVars } from './toolbarBuiltins';

const DEFAULTS = { rowH: 28, anyTitle: true };
// band at default vars (v5.15): 9.5 + 1.5 + titleGap 5 = 16 — the same 16 as
// before the ribTitlePad merge, by construction (3 + 2 folded into the gap).
const BAND = 16;

describe('ribbonKindVars', () => {
  it('auto-fill: untitled total equals titled total at default scales', () => {
    const { kTitled, kUntitled } = ribbonKindVars(DEFAULTS);
    const titledTotal = kTitled * (2 * 28 + BAND);
    const untitledTotal = kUntitled * (2 * 28);
    expect(untitledTotal).toBeCloseTo(titledTotal, 6);
    expect(kTitled).toBe(1);
    expect(kUntitled).toBeCloseTo((2 * 28 + BAND) / (2 * 28), 6);
  });

  it('a bar with NO titles gets no auto-fill — both factors 1', () => {
    const { kTitled, kUntitled, contentH } = ribbonKindVars({ rowH: 28, anyTitle: false });
    expect(kTitled).toBe(1);
    expect(kUntitled).toBe(1);
    expect(contentH).toBe(56);
  });

  it('the scale knobs multiply their kind and only their kind', () => {
    const r = ribbonKindVars({ ...DEFAULTS, scaleTitledPct: 150, scaleUntitledPct: 100 });
    expect(r.kTitled).toBe(1.5);
    expect(r.kUntitled).toBeCloseTo(72 / 56, 6);   // untouched auto-fill
    const r2 = ribbonKindVars({ ...DEFAULTS, scaleTitledPct: 100, scaleUntitledPct: 50 });
    expect(r2.kUntitled).toBeCloseTo(0.5 * (72 / 56), 6);
  });

  it('contentH is the taller kind, so the bar grows with whichever is scaled up', () => {
    const up = ribbonKindVars({ ...DEFAULTS, scaleTitledPct: 200 });
    expect(up.contentH).toBeCloseTo(2 * (2 * 28 + BAND), 6);
    const down = ribbonKindVars({ ...DEFAULTS, scaleTitledPct: 50, scaleUntitledPct: 50 });
    expect(down.contentH).toBeCloseTo(0.5 * (2 * 28 + BAND), 6);
  });

  it('the band follows the Design title vars, and the fill follows the band', () => {
    const r = ribbonKindVars({ ...DEFAULTS, titleFont: 12, titleGap: 4 });
    const band = 12 + 1.5 + 4;
    expect(r.kUntitled).toBeCloseTo((56 + band) / 56, 6);
  });

  it('per-kind row gaps (v5.15) still equalize the two totals at 100%', () => {
    const r = ribbonKindVars({ ...DEFAULTS, rowGapTitled: 6, rowGapUntitled: -4 });
    expect(r.kUntitled * (2 * 28 - 4)).toBeCloseTo(r.kTitled * (2 * 28 + 6 + BAND), 6);
  });
});
