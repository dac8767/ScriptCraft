// @vitest-environment jsdom
/**
 * Outline variation tabs (v2.30) — one shared pool of beats, many
 * arrangements. Pins the stash round-trip (switching tabs never loses an
 * arrangement or a beat), the Unsorted behavior on fresh tabs, and the
 * bar-routing helpers that edit a non-viewed tab.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from './editorStore';

const S = () => useEditorStore.getState();

beforeEach(() => {
  S().setBeats([]);
  S().setBeatColumns([]);
  S().resetOutlineTabs();
});

function seedThreeActs() {
  const a1 = S().addBeatColumn('Act I', 10);
  const a2 = S().addBeatColumn('Act II', 20);
  const b1 = S().addBeat('Opening', a1);
  const b2 = S().addBeat('Midpoint', a2);
  return { a1, a2, b1, b2 };
}

describe('outline tabs', () => {
  it('a new tab starts empty but keeps every beat (as Unsorted)', () => {
    const { b1, b2 } = seedThreeActs();
    S().addOutlineTab();
    expect(S().beatColumns).toHaveLength(0);                    // fresh arrangement
    expect(S().beats.map((b) => b.id).sort()).toEqual([b1, b2].sort());   // same pool
    expect(S().outlineTabs).toHaveLength(2);
    expect(S().viewedOutlineTab).toBe(S().outlineTabs[1].id);
  });

  it('switching tabs round-trips each arrangement exactly', () => {
    const { a1, b1, b2 } = seedThreeActs();
    const tab1 = S().viewedOutlineTab;
    const tab2 = S().addOutlineTab();

    // Arrange differently in tab 2: one section, both beats inside.
    const circle = S().addBeatColumn('You', 15);
    S().updateBeat(b1, { columnId: circle, position: 0 });
    S().updateBeat(b2, { columnId: circle, position: 1 });

    S().switchOutlineTab(tab1);
    expect(S().beatColumns.map((c) => c.title)).toEqual(['Act I', 'Act II']);
    expect(S().beats.find((b) => b.id === b1)!.columnId).toBe(a1);

    S().switchOutlineTab(tab2);
    expect(S().beatColumns.map((c) => c.title)).toEqual(['You']);
    expect(S().beats.find((b) => b.id === b2)!.columnId).toBe(circle);
  });

  it('a beat created in one tab shows up (unsorted) in the others', () => {
    seedThreeActs();
    const tab1 = S().viewedOutlineTab;
    S().addOutlineTab();
    const col = S().addBeatColumn('New Section', 5);
    const b3 = S().addBeat('Fresh Beat', col);
    S().switchOutlineTab(tab1);
    const beat = S().beats.find((b) => b.id === b3)!;
    expect(beat).toBeTruthy();
    // Its section belongs to the other tab → not among this tab's columns.
    expect(S().beatColumns.some((c) => c.id === beat.columnId)).toBe(false);
  });

  it('closing a tab keeps the beats and moves the bar pointer off it', () => {
    seedThreeActs();
    const tab1 = S().viewedOutlineTab;
    const tab2 = S().addOutlineTab();
    S().setOutlineBarTab(tab2);
    S().deleteOutlineTab(tab2);                                  // deletes the viewed tab
    expect(S().outlineTabs).toHaveLength(1);
    expect(S().viewedOutlineTab).toBe(tab1);
    expect(S().outlineBarTab).toBe(tab1);
    expect(S().beats).toHaveLength(2);                           // pool untouched
    expect(S().beatColumns.map((c) => c.title)).toEqual(['Act I', 'Act II']);
    // The last tab can't be closed.
    S().deleteOutlineTab(tab1);
    expect(S().outlineTabs).toHaveLength(1);
  });

  it('bar helpers edit the bar tab even while another tab is viewed', () => {
    const { b1 } = seedThreeActs();
    const tab1 = S().viewedOutlineTab;
    S().addOutlineTab();                                         // view tab 2
    S().setOutlineBarTab(tab1);                                  // bar shows tab 1

    // Resize an act + add a section + move a beat, all through the bar.
    const act1 = S().outlineStash[tab1].columns[0];
    S().barUpdateColumn(act1.id, { targetPages: 33 });
    const added = S().barAddColumn('Act III');
    S().barAssignBeat(b1, added, 0);

    const stash = S().outlineStash[tab1];
    expect(stash.columns.find((c) => c.id === act1.id)!.targetPages).toBe(33);
    expect(stash.columns.map((c) => c.title)).toContain('Act III');
    expect(stash.beatSlots[b1]).toEqual({ columnId: added, position: 0, span: 1 });

    // Back on tab 1, the bar edits are what loads.
    S().switchOutlineTab(tab1);
    expect(S().beatColumns.map((c) => c.title)).toEqual(['Act I', 'Act II', 'Act III']);
    expect(S().beats.find((b) => b.id === b1)!.columnId).toBe(added);
  });

  it('loadOutlineTabs falls back safely on bad pointers', () => {
    S().loadOutlineTabs([{ id: 'x', name: 'X' }], 'missing', 'also-missing', {});
    expect(S().viewedOutlineTab).toBe('x');
    expect(S().outlineBarTab).toBe('x');
  });
});

/* v2.60: hand-placed Outline Bar pins — stored per tab, cleared when the
   beat moves to a different section (a pin is an offset within a section,
   so it means nothing anywhere else). */
describe('bar pins (v2.60)', () => {
  it('barSetBeatOffsets pins beats on the viewed tab, un-pins with undefined', () => {
    const { b1 } = seedThreeActs();
    S().barSetBeatOffsets({ [b1]: 4 });
    expect(S().beats.find((b) => b.id === b1)!.barOffset).toBe(4);
    S().barSetBeatOffsets({ [b1]: undefined });
    expect(S().beats.find((b) => b.id === b1)!.barOffset).toBeUndefined();
  });

  it('a pin set through the bar on a non-viewed tab lands in that tab\'s stash', () => {
    const { b1 } = seedThreeActs();
    const tab1 = S().viewedOutlineTab;
    S().addOutlineTab();
    S().setOutlineBarTab(tab1);
    S().barSetBeatOffsets({ [b1]: 3 });
    expect(S().outlineStash[tab1].beatSlots[b1].barOffset).toBe(3);
    // Coming back to the tab restores the pin onto the live beat.
    S().switchOutlineTab(tab1);
    expect(S().beats.find((b) => b.id === b1)!.barOffset).toBe(3);
  });

  /* v6.59, Derek: "changing the estimated page length on one outline
     variation does not change it on other variations." The estimate is a
     property of the arrangement, not of the shared beat. */
  it('a page estimate set on one tab does not follow the beat to another', () => {
    const { b1 } = seedThreeActs();
    const tab1 = S().viewedOutlineTab;
    S().updateBeat(b1, { outlineSpan: 6 });
    const tab2 = S().addOutlineTab();
    // Tab 2 inherits the estimate the beat had, then goes its own way.
    expect(S().beats.find((b) => b.id === b1)!.outlineSpan).toBe(6);
    S().updateBeat(b1, { outlineSpan: 2 });

    S().switchOutlineTab(tab1);
    expect(S().beats.find((b) => b.id === b1)!.outlineSpan).toBe(6);
    S().switchOutlineTab(tab2);
    expect(S().beats.find((b) => b.id === b1)!.outlineSpan).toBe(2);
  });

  it('barSetBeatSpan writes the BAR\'s tab, viewed or not', () => {
    const { b1 } = seedThreeActs();
    const tab1 = S().viewedOutlineTab;
    S().barSetBeatSpan(b1, 5);                       // bar tab === viewed tab
    expect(S().beats.find((b) => b.id === b1)!.outlineSpan).toBe(5);

    const tab2 = S().addOutlineTab();
    S().setOutlineBarTab(tab1);
    S().barSetBeatSpan(b1, 9);                       // bar tab is parked
    expect(S().outlineStash[tab1].beatSlots[b1].span).toBe(9);
    // The tab being viewed is untouched…
    expect(S().beats.find((b) => b.id === b1)!.outlineSpan).toBe(5);
    // …and tab 1 loads its own estimate back.
    S().switchOutlineTab(tab1);
    expect(S().beats.find((b) => b.id === b1)!.outlineSpan).toBe(9);
    S().switchOutlineTab(tab2);
    expect(S().beats.find((b) => b.id === b1)!.outlineSpan).toBe(5);
  });

  /* An older save has no per-tab estimates at all — every tab must keep
     reading the shared one until it's edited, not reset to a single page. */
  it('a legacy slot with no span falls back to the beat\'s own estimate', () => {
    const { a1, b1 } = seedThreeActs();
    S().updateBeat(b1, { outlineSpan: 7 });
    S().loadOutlineTabs(
      [{ id: 'old-1', name: 'A' }, { id: 'old-2', name: 'B' }], 'old-2', 'old-2',
      { 'old-1': { columns: [{ id: a1, title: 'Act I', position: 0, width: 0, targetPages: 10 }], beatSlots: { [b1]: { columnId: a1, position: 0 } } } },
    );
    S().switchOutlineTab('old-1');
    expect(S().beats.find((b) => b.id === b1)!.outlineSpan).toBe(7);
  });

  it('moving a beat to another section drops its pin', () => {
    const { a2, b1 } = seedThreeActs();
    S().barSetBeatOffsets({ [b1]: 4 });
    S().updateBeat(b1, { columnId: a2, position: 5 });
    expect(S().beats.find((b) => b.id === b1)!.barOffset).toBeUndefined();
  });

  it('reordering within the same section keeps the pin', () => {
    const { b1 } = seedThreeActs();
    S().barSetBeatOffsets({ [b1]: 4 });
    S().updateBeat(b1, { position: 3 });
    expect(S().beats.find((b) => b.id === b1)!.barOffset).toBe(4);
  });

  it('barAssignBeat into a different section drops the pin too', () => {
    const { a2, b1 } = seedThreeActs();
    S().barSetBeatOffsets({ [b1]: 4 });
    S().barAssignBeat(b1, a2, 0);
    expect(S().beats.find((b) => b.id === b1)!.barOffset).toBeUndefined();
  });
});

/* v2.47, Derek: a tab is bound to the arrangement active when it was
   created, for life. The Arrangement toggle NAVIGATES between tabs
   (creating one when needed) instead of changing the current tab. */
describe('per-tab arrangement binding (v2.47)', () => {
  beforeEach(() => {
    S().setBeatArrangeMode('auto');
    S().resetOutlineTabs();
  });

  it('a new tab captures the active arrangement at creation', () => {
    S().setBeatArrangeMode('custom');
    const id = S().addOutlineTab();
    expect(S().outlineTabs.find((t) => t.id === id)?.arrangeMode).toBe('custom');
    expect(S().beatArrangeMode).toBe('custom');
  });

  it('an explicit mode wins over the active one', () => {
    const id = S().addOutlineTab('custom');
    expect(S().outlineTabs.find((t) => t.id === id)?.arrangeMode).toBe('custom');
    expect(S().beatArrangeMode).toBe('custom');
  });

  it('switching tabs restores each tab\'s own arrangement', () => {
    const tab1 = S().viewedOutlineTab;                 // auto
    const tab2 = S().addOutlineTab('custom');
    S().switchOutlineTab(tab1);
    expect(S().beatArrangeMode).toBe('auto');
    S().switchOutlineTab(tab2);
    expect(S().beatArrangeMode).toBe('custom');
  });

  it('goToArrangement jumps to an existing tab of that mode', () => {
    const tab1 = S().viewedOutlineTab;                 // auto
    S().addOutlineTab('custom');
    S().switchOutlineTab(tab1);
    S().goToArrangement('custom');
    expect(S().viewedOutlineTab).not.toBe(tab1);
    expect(S().beatArrangeMode).toBe('custom');
    expect(S().outlineTabs).toHaveLength(2);           // no new tab created
  });

  it('goToArrangement creates a tab when none has that mode', () => {
    S().goToArrangement('custom');
    expect(S().outlineTabs).toHaveLength(2);
    expect(S().beatArrangeMode).toBe('custom');
    expect(S().outlineTabs[1].arrangeMode).toBe('custom');
  });

  it('a legacy tab (no stored mode) is stamped with the mode it is shown in', () => {
    // Simulate an old save: tabs without arrangeMode.
    S().loadOutlineTabs([{ id: 'old-1', name: 'A' }, { id: 'old-2', name: 'B' }], 'old-1', 'old-1', {});
    S().switchOutlineTab('old-2');
    expect(S().outlineTabs.find((t) => t.id === 'old-2')?.arrangeMode).toBe('auto');
    expect(S().beatArrangeMode).toBe('auto');
  });

  it('deleting the viewed tab adopts the arrangement of the tab you land on', () => {
    const tab2 = S().addOutlineTab('custom');
    S().deleteOutlineTab(tab2);
    expect(S().beatArrangeMode).toBe('auto');
  });
});
