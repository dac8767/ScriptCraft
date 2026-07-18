// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { closeSectionInModel } from './ribbonDrag';
import type { RibbonModel } from './toolbarBuiltins';

// Build a model whose sections each carry one identifiable token, so we can
// read back which section ended up where after a close.
const S = (id: string) => ({ top: [`b:${id}`], bottom: [], hasBreak: false, breakLine: false });
const model = (ids: string[], splitAt: number | null): RibbonModel => ({ sections: ids.map(S), splitAt });
const tokensOf = (m: RibbonModel, i: number) => m.sections[i].top;
const sides = (m: RibbonModel) => {
  const s = m.splitAt;
  if (s === null) return { left: m.sections, right: [] as typeof m.sections };
  return { left: m.sections.slice(0, s), right: m.sections.slice(s) };
};

describe('closeSectionInModel — a section is removed cleanly, split & far side intact', () => {
  it('removing a MIDDLE section deletes just it, leaving neighbours separate (no merged long section)', () => {
    // [A B | C D] — remove B. Neighbour A stays its own section; B does not
    // merge into anything, and no divider between kept sections is lost.
    const m = closeSectionInModel(model(['A', 'B', 'C', 'D'], 2), 1);
    expect(m.sections.map((s) => s.top)).toEqual([['b:A'], ['b:C'], ['b:D']]);
    expect(m.splitAt).toBe(1);                                   // A left; C, D right
    expect(sides(m).right.map((s) => s.top)).toEqual([['b:C'], ['b:D']]);
  });

  it('removing a LEFT section shifts the split down one and leaves the right run right-aligned', () => {
    const m = closeSectionInModel(model(['A', 'B', 'C', 'D'], 2), 0); // remove A
    expect(m.splitAt).toBe(1);
    expect(sides(m).right.map((s) => s.top)).toEqual([['b:C'], ['b:D']]);
    expect(sides(m).left.map((s) => s.top)).toEqual([['b:B']]);
  });

  it('removing a RIGHT section leaves the split (and the left run) exactly where they were', () => {
    const m = closeSectionInModel(model(['A', 'B', 'C', 'D'], 2), 2); // remove C
    expect(m.splitAt).toBe(2);
    expect(sides(m).left.map((s) => s.top)).toEqual([['b:A'], ['b:B']]);
    expect(sides(m).right.map((s) => s.top)).toEqual([['b:D']]);
  });

  it('removing the ONLY section on a side clears it to empty and preserves the split', () => {
    const m = closeSectionInModel(model(['A', 'B', 'C'], 1), 0); // A is the lone left section
    expect(m.splitAt).toBe(1);
    expect(tokensOf(m, 0)).toEqual([]);                          // cleared, not removed
    expect(sides(m).right.map((s) => s.top)).toEqual([['b:B'], ['b:C']]);
  });

  it('with no split, removing a middle section just deletes it', () => {
    const m = closeSectionInModel(model(['A', 'B', 'C'], null), 1);
    expect(m.splitAt).toBeNull();
    expect(m.sections.map((s) => s.top)).toEqual([['b:A'], ['b:C']]);
  });

  it('the last remaining section clears rather than vanishing', () => {
    const m = closeSectionInModel(model(['A'], null), 0);
    expect(m.sections).toHaveLength(1);
    expect(tokensOf(m, 0)).toEqual([]);
  });
});
