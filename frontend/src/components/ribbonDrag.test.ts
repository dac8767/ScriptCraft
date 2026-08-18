// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { closeSectionInModel, moveSectionInModel, dropAsNewRowInModel, dropNewSectionInModel, ribAddSectionAtBoundary, ribQuickAdd, ribSetSpacerWidth, SPACER_MAX_PX, ribUndo, ribResetHistory } from './ribbonDrag';
import { parseRibbon, serializeRibbon, type RibbonModel } from './toolbarBuiltins';
import { useEditorStore } from '../stores/editorStore';

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

describe('ribQuickAdd lands double-clicked items in the section just created/updated', () => {
  it('adds to a freshly created LEFT section, not the right-aligned last one', () => {
    // [bold] [italic | underline] — underline is the right-aligned last section.
    useEditorStore.setState({
      toolbarLeft: ['b:bold', '2!d:sec-1', 'b:italic', 'a:split-2', 'b:underline'],
      toolbarRight: [],
    });
    ribAddSectionAtBoundary(1, false);           // new empty left section at index 1
    ribQuickAdd('b:strike');                     // double-click a palette item
    const m = parseRibbon(useEditorStore.getState().toolbarLeft);
    expect(m.sections[1].top).toContain('b:strike');      // landed in the new section
    const right = m.splitAt !== null ? m.sections.slice(m.splitAt) : [];
    expect(right.flatMap((s) => [...s.top, ...s.bottom])).not.toContain('b:strike');
  });
});

describe('ribSetSpacerWidth rewrites a spacer token width in place', () => {
  it('writes the width onto a width-less spacer and clamps to the max', () => {
    useEditorStore.setState({ toolbarLeft: ['b:bold', 's:99', 'b:italic'], toolbarRight: [] });
    ribSetSpacerWidth('s:99', 120);
    expect(useEditorStore.getState().toolbarLeft).toContain('s:99:120');
    ribSetSpacerWidth('s:99:120', 99999);   // over the max → clamped
    expect(useEditorStore.getState().toolbarLeft).toContain(`s:99:${SPACER_MAX_PX}`);
    // the neighbours are untouched
    expect(useEditorStore.getState().toolbarLeft.filter((t) => t.startsWith('b:'))).toEqual(['b:bold', 'b:italic']);
  });
});

describe('moveSectionInModel — only the moved section changes side of the split', () => {
  it('moving a LEFT section to the right does not push a right section left', () => {
    // [A B | C D] — move A to the far right; C and D must stay right.
    const m = moveSectionInModel(model(['A', 'B', 'C', 'D'], 2), 0, 4);
    expect(m.sections.map((s) => s.top)).toEqual([['b:B'], ['b:C'], ['b:D'], ['b:A']]);
    expect(m.splitAt).toBe(1);                 // left: B ; right: C, D, A
  });
  it('moving a section within the left run keeps it left', () => {
    const m = moveSectionInModel(model(['A', 'B', 'C', 'D'], 2), 0, 2); // A after B
    expect(m.splitAt).toBe(2);
    expect(m.sections.slice(0, 2).map((s) => s.top)).toEqual([['b:B'], ['b:A']]);
  });
  it('moving a RIGHT section to the left keeps the other right sections right', () => {
    const m = moveSectionInModel(model(['A', 'B', 'C', 'D'], 2), 3, 0); // D to front
    expect(m.sections.map((s) => s.top)).toEqual([['b:D'], ['b:A'], ['b:B'], ['b:C']]);
    expect(m.splitAt).toBe(3);                 // left: D, A, B ; right: C
  });
});

/* v4.25, Derek: rows emerge by DRAGGING — dropping above/below a one-row
   section's row splits it into two rows around the dragged item. */
describe('dropAsNewRowInModel — a drop above/below a one-row section grows a second row', () => {
  const oneRow = (toks: string[]): RibbonModel => ({
    sections: [{ top: toks, bottom: [], hasBreak: false, breakLine: false }],
    splitAt: null,
  });

  it('drop BELOW: existing items stay on top, the dragged item lands alone underneath', () => {
    const m = dropAsNewRowInModel(oneRow(['b:bold', 'b:italic']), 0, 'b:underline', 'below');
    expect(m.sections[0].top).toEqual(['b:bold', 'b:italic']);
    expect(m.sections[0].bottom).toEqual(['b:underline']);
    expect(m.sections[0].hasBreak).toBe(true);
  });

  it('drop ABOVE: the dragged item sits alone on top, existing items move to the bottom row', () => {
    const m = dropAsNewRowInModel(oneRow(['b:bold', 'b:italic']), 0, 'b:underline', 'above');
    expect(m.sections[0].top).toEqual(['b:underline']);
    expect(m.sections[0].bottom).toEqual(['b:bold', 'b:italic']);
    expect(m.sections[0].hasBreak).toBe(true);
  });

  it('an on-bar item MOVES — deduped from the section it came from', () => {
    const m: RibbonModel = {
      sections: [S('find'), { top: ['b:bold', 'b:italic'], bottom: [], hasBreak: false, breakLine: false }],
      splitAt: null,
    };
    const out = dropAsNewRowInModel(m, 1, 'b:find', 'below');
    expect(out.sections[0].top).toEqual([]);               // left its old section
    expect(out.sections[1].top).toEqual(['b:bold', 'b:italic']);
    expect(out.sections[1].bottom).toEqual(['b:find']);
  });

  it("dropping the section's ONLY item below itself stays one row — no phantom empty row", () => {
    const m = dropAsNewRowInModel(oneRow(['b:bold']), 0, 'b:bold', 'below');
    expect(m.sections[0].top).toEqual(['b:bold']);
    expect(m.sections[0].bottom).toEqual([]);
    expect(m.sections[0].hasBreak).toBe(false);
  });

  it('keeps the section title, and round-trips through serialize/parse as a real row break', () => {
    const src = oneRow(['b:bold', 'b:italic']);
    src.sections[0].title = 'Style';
    const rt = parseRibbon(serializeRibbon(dropAsNewRowInModel(src, 0, 'b:underline', 'below')));
    expect(rt.sections).toHaveLength(1);
    expect(rt.sections[0].top).toEqual(['b:bold', 'b:italic']);
    expect(rt.sections[0].bottom).toEqual(['b:underline']);
    expect(rt.sections[0].hasBreak).toBe(true);
    expect(rt.sections[0].title).toBe('Style');
  });
});

/* v4.25, Derek: dropping an item into BLANK ribbon space creates a new
   one-row section at that boundary (it used to be a dead drop). */
describe('dropNewSectionInModel — a blank-space drop makes a new one-row section', () => {
  it('creates a single-row section holding just the item at the boundary', () => {
    const m = dropNewSectionInModel(model(['A', 'B'], null), 1, 'b:find');
    expect(m.sections.map((s) => s.top)).toEqual([['b:A'], ['b:find'], ['b:B']]);
    expect(m.sections[1].bottom).toEqual([]);
    expect(m.sections[1].hasBreak).toBe(false);
  });

  it('dropping in the align gap joins the LEFT run — the split shifts, the right run stays right', () => {
    const m = dropNewSectionInModel(model(['A', 'B'], 1), 1, 'b:find'); // [A | B], drop between
    expect(m.splitAt).toBe(2);
    expect(sides(m).left.map((s) => s.top)).toEqual([['b:A'], ['b:find']]);
    expect(sides(m).right.map((s) => s.top)).toEqual([['b:B']]);
  });

  it('past the split, the split stays and the new section is right-aligned', () => {
    const m = dropNewSectionInModel(model(['A', 'B'], 1), 2, 'b:find'); // after B
    expect(m.splitAt).toBe(1);
    expect(sides(m).right.map((s) => s.top)).toEqual([['b:B'], ['b:find']]);
  });

  it('an on-bar item MOVES into its new section (deduped from the old one)', () => {
    const m = dropNewSectionInModel(model(['A', 'B'], null), 2, 'b:A');
    expect(m.sections.map((s) => s.top)).toEqual([[], ['b:B'], ['b:A']]);
  });

  it('round-trips through serialize/parse as an ordinary section boundary', () => {
    const rt = parseRibbon(serializeRibbon(dropNewSectionInModel(model(['A', 'B'], null), 2, 'b:find')));
    expect(rt.sections.map((s) => s.top)).toEqual([['b:A'], ['b:B'], ['b:find']]);
    expect(rt.sections.every((s) => !s.hasBreak)).toBe(true);
    expect(rt.splitAt).toBeNull();
  });
});

describe('ribUndo reverts the last ribbon edit', () => {
  it('restores the toolbar to its state before an add-section', () => {
    ribResetHistory();
    useEditorStore.setState({ toolbarLeft: ['b:bold', 'a:split-1', 'b:italic'], toolbarRight: [] });
    const before = [...useEditorStore.getState().toolbarLeft];
    ribAddSectionAtBoundary(1, false);
    expect(useEditorStore.getState().toolbarLeft).not.toEqual(before);
    ribUndo();
    expect(useEditorStore.getState().toolbarLeft).toEqual(before);
  });
});
