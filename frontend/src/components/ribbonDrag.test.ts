// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { closeSectionInModel } from './ribbonDrag';
import type { RibbonModel } from './toolbarBuiltins';

// Build a model whose sections each carry one identifiable token, so we can
// read back which section ended up where after a close.
const S = (id: string) => ({ top: [`b:${id}`], bottom: [], hasBreak: false, breakLine: false });
const model = (ids: string[], splitAt: number | null): RibbonModel => ({ sections: ids.map(S), splitAt });
const tokensOf = (m: RibbonModel, i: number) => m.sections[i].top;
// The sections on each side of the split.
const sides = (m: RibbonModel) => {
  const s = m.splitAt;
  if (s === null) return { left: m.sections, right: [] as typeof m.sections };
  return { left: m.sections.slice(0, s), right: m.sections.slice(s) };
};

describe('closeSectionInModel — closing a section never crosses the align split', () => {
  it('closing the LAST left section keeps the right run right-aligned (the reported bug)', () => {
    // [A B | C D] — close B (last left). Old code merged B+C and nulled the
    // split, dragging C and D into the left run.
    const m = closeSectionInModel(model(['A', 'B', 'C', 'D'], 2), 1);
    const { left, right } = sides(m);
    expect(right.map((s) => s.top)).toEqual([['b:C'], ['b:D']]); // C, D still right
    expect(left.flatMap((s) => s.top)).toEqual(['b:A', 'b:B']);  // B merged back into A
    expect(m.sections).toHaveLength(3);
  });

  it('closing a left section merges within the left run and shifts the split down one', () => {
    const m = closeSectionInModel(model(['A', 'B', 'C', 'D'], 2), 0); // close A
    expect(m.splitAt).toBe(1);
    expect(sides(m).right.map((s) => s.top)).toEqual([['b:C'], ['b:D']]);
    expect(tokensOf(m, 0)).toEqual(['b:A', 'b:B']);
  });

  it('closing the FIRST right section stays on the right and leaves the split (and left) put', () => {
    const m = closeSectionInModel(model(['A', 'B', 'C', 'D'], 2), 2); // close C
    expect(m.splitAt).toBe(2);
    expect(sides(m).left.map((s) => s.top)).toEqual([['b:A'], ['b:B']]);
    expect(sides(m).right.map((s) => s.top)).toEqual([['b:C', 'b:D']]);
  });

  it('closing the LAST right section merges backward within the right run', () => {
    const m = closeSectionInModel(model(['A', 'B', 'C', 'D'], 2), 3); // close D
    expect(m.splitAt).toBe(2);
    expect(sides(m).right.map((s) => s.top)).toEqual([['b:C', 'b:D']]);
  });

  it('closing the ONLY left section clears it to empty and preserves the split', () => {
    const m = closeSectionInModel(model(['A', 'B', 'C'], 1), 0); // A is the lone left section
    expect(m.splitAt).toBe(1);
    expect(tokensOf(m, 0)).toEqual([]);                          // cleared, not removed
    expect(sides(m).right.map((s) => s.top)).toEqual([['b:B'], ['b:C']]);
  });

  it('with no split, closing still merges with a neighbour', () => {
    const m = closeSectionInModel(model(['A', 'B', 'C'], null), 1);
    expect(m.splitAt).toBeNull();
    expect(m.sections.map((s) => s.top)).toEqual([['b:A'], ['b:B', 'b:C']]);
  });
});
