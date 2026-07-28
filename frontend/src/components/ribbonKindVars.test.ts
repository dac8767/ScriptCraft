/**
 * ribbonKindVars (v5.14 → v5.17) — the per-kind ribbon geometry.
 *
 * The invariant: at 100%/100% the two kinds' TOTAL heights (paddings
 * included since v5.17) are equal — that equality IS the alignment. And
 * contentH must cover the tallest kind so the bar grows instead of letting
 * padding push a section's title under the menu bar (Derek's v5.17 report).
 */
import { describe, it, expect } from 'vitest';
import { ribbonKindVars } from './toolbarBuiltins';

const DEFAULTS = { rowH: 28, anyTitle: true };
// defaults: band = 9.5 + 1.5 = 11, titleGap 5 → titled inner 11+5+56 = 72
const INNER_T = 72;
const INNER_U = 56;

describe('ribbonKindVars', () => {
  it('auto-fill: untitled total equals titled total at default scales', () => {
    const { kTitled, kUntitled } = ribbonKindVars(DEFAULTS);
    expect(kUntitled * INNER_U).toBeCloseTo(kTitled * INNER_T, 6);
    expect(kTitled).toBe(1);
  });

  it('a bar with NO titles gets no auto-fill — both factors 1', () => {
    const { kTitled, kUntitled, contentH } = ribbonKindVars({ rowH: 28, anyTitle: false });
    expect(kTitled).toBe(1);
    expect(kUntitled).toBe(1);
    expect(contentH).toBe(INNER_U);
  });

  it('the scale knobs multiply their kind and only their kind', () => {
    const r = ribbonKindVars({ ...DEFAULTS, scaleTitledPct: 150, scaleUntitledPct: 100 });
    expect(r.kTitled).toBe(1.5);
    expect(r.kUntitled).toBeCloseTo(INNER_T / INNER_U, 6);
    const r2 = ribbonKindVars({ ...DEFAULTS, scaleTitledPct: 100, scaleUntitledPct: 50 });
    expect(r2.kUntitled).toBeCloseTo(0.5 * (INNER_T / INNER_U), 6);
  });

  it('contentH is the taller kind, so the bar grows with whichever is scaled up', () => {
    const up = ribbonKindVars({ ...DEFAULTS, scaleTitledPct: 200 });
    expect(up.contentH).toBeCloseTo(2 * INNER_T, 6);
    const down = ribbonKindVars({ ...DEFAULTS, scaleTitledPct: 50, scaleUntitledPct: 50 });
    expect(down.contentH).toBeCloseTo(0.5 * INNER_T, 6);
  });

  it('the band follows the Design title vars, and the fill follows the band', () => {
    const r = ribbonKindVars({ ...DEFAULTS, titleFont: 12, titleGap: 4 });
    expect(r.kUntitled).toBeCloseTo((12 + 1.5 + 4 + 56) / 56, 6);
  });

  it('per-kind row gaps still equalize the two totals at 100%', () => {
    const r = ribbonKindVars({ ...DEFAULTS, rowGapTitled: 6, rowGapUntitled: -4 });
    expect(r.kUntitled * (56 - 4)).toBeCloseTo(r.kTitled * (72 + 6), 6);
  });

  /* v5.17, Derek: "increasing the section bottom padding can push the title
     behind the top bar. adjusting padding should never do this. the height
     of the bar should adjust instead." */
  it('padding grows contentH — the bar makes room instead of clipping', () => {
    const base = ribbonKindVars(DEFAULTS);
    const padded = ribbonKindVars({ ...DEFAULTS, padTopTitled: 4, padBottomTitled: 14 });
    expect(padded.contentH).toBeCloseTo(base.contentH + 18, 6);
  });

  it('padded kinds still level out at 100% — pads are part of the equality', () => {
    const r = ribbonKindVars({ ...DEFAULTS, padTopTitled: 4, padBottomTitled: 14, padTopUntitled: 2, padBottomUntitled: 2 });
    const titledTotal = 4 + 14 + r.kTitled * INNER_T;
    const untitledTotal = 2 + 2 + r.kUntitled * INNER_U;
    expect(untitledTotal).toBeCloseTo(titledTotal, 6);
  });

  it('a NEGATIVE title gap shrinks the titled total, and the fill follows down', () => {
    const r = ribbonKindVars({ ...DEFAULTS, titleGap: -6 });
    expect(r.kUntitled).toBeCloseTo((11 - 6 + 56) / 56, 6);
    expect(r.kUntitled).toBeLessThan(1.1);
  });

  it('the fill is floored — extreme negatives cannot invert the bar', () => {
    const r = ribbonKindVars({ ...DEFAULTS, rowGapTitled: -14, titleGap: -10, padTopUntitled: 0 });
    expect(r.kUntitled).toBeGreaterThanOrEqual(0.25);
  });
});
