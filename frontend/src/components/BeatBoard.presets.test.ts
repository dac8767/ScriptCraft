// @vitest-environment jsdom
/**
 * Outline presets (v1.89) — the Presets dropdown appends a structure's
 * columns, titled and ordered, without disturbing existing ones.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  OUTLINE_PRESETS, applyOutlinePreset, splitPages, distributeBeats,
  presetReuseOrder, unsortedBeats,
} from './BeatBoard';
import { useEditorStore } from '../stores/editorStore';
import type { BeatInfo } from '../stores/editorStore';

describe('outline presets', () => {
  beforeEach(() => {
    useEditorStore.getState().setBeatColumns([]);
    useEditorStore.getState().setBeats([]);
    useEditorStore.getState().resetOutlineTabs();
  });

  /* v6.48, Derek: "when an outline preset is used … make the name of the
     tab = the preset name". The rename rides applyOutlinePreset itself, so
     every door (dropdown, override, custom presets) gets it. */
  it('applying a preset names the viewed tab after it', () => {
    applyOutlinePreset('3act');
    const s = useEditorStore.getState();
    expect(s.outlineTabs.find((t) => t.id === s.viewedOutlineTab)?.name).toBe('3-Act Structure');
    // override mode renames too
    applyOutlinePreset('storycircle', 'override');
    const s2 = useEditorStore.getState();
    expect(s2.outlineTabs.find((t) => t.id === s2.viewedOutlineTab)?.name).toBe('Story Circle (8 steps)');
  });

  /* v7.75, Derek: "the outline presets should just be sections, not beats."
     v6.57 had a preset deal out starter cards at ~2 pages a beat — 60 of them
     for the 3-act structure — and every one was blank, so applying a preset
     meant clearing them before you could write your own. The page BUDGETS
     stay: they are the structure, and they are what the outline bar measures
     against. */
  it('3-Act Structure adds Act I / Act II / Act III at 40 pages each, and no beats', () => {
    applyOutlinePreset('3act');
    const cols = [...useEditorStore.getState().beatColumns].sort((a, b) => a.position - b.position);
    expect(cols.map((c) => c.title)).toEqual(['Act I', 'Act II', 'Act III']);
    // v2.20, Derek: each act defaults to 40 pages.
    expect(cols.map((c) => c.targetPages)).toEqual([40, 40, 40]);
    expect(useEditorStore.getState().beats).toHaveLength(0);
  });

  it('EVERY preset lays down its sections with their page budgets, and nothing in them', () => {
    for (const p of OUTLINE_PRESETS) {
      useEditorStore.getState().setBeatColumns([]);
      useEditorStore.getState().setBeats([]);
      applyOutlinePreset(p.id);
      const cols = [...useEditorStore.getState().beatColumns].sort((a, b) => a.position - b.position);
      expect(cols.map((c) => c.title), p.id).toEqual(p.columns);
      cols.forEach((col, i) => {
        expect(col.targetPages, `${p.id} · ${col.title} budget`).toBe(p.pages[i]);
      });
      expect(useEditorStore.getState().beats, `${p.id} beats`).toHaveLength(0);
    }
  });

  it('the classic structures ship with their full SECTION lists', () => {
    const byId = Object.fromEntries(OUTLINE_PRESETS.map((p) => [p.id, p]));
    expect(byId.savethecat.columns).toHaveLength(15);   // Blake Snyder's 15
    expect(byId.herojourney.columns).toHaveLength(12);  // 12 stages
    expect(byId.storycircle.columns).toHaveLength(8);   // Harmon's 8 steps
    expect(byId.sequences.columns).toHaveLength(8);     // 8 sequences
    applyOutlinePreset('savethecat');
    expect(useEditorStore.getState().beatColumns).toHaveLength(15);
    expect(useEditorStore.getState().beats).toHaveLength(0);
    // The structure still adds up to Snyder's 110-page sheet.
    expect(useEditorStore.getState().beatColumns
      .reduce((a, c) => a + (c.targetPages ?? 0), 0)).toBe(110);
  });

  /* v2.20: every preset carries a page budget per section, never blank. */
  it('every preset has a page budget (≥1) for every section', () => {
    for (const p of OUTLINE_PRESETS) {
      expect(p.pages).toHaveLength(p.columns.length);
      for (const n of p.pages) expect(n).toBeGreaterThanOrEqual(1);
    }
    // Save the Cat tiles Snyder's 110-page beat sheet exactly.
    const stc = OUTLINE_PRESETS.find((p) => p.id === 'savethecat')!;
    expect(stc.pages.reduce((a, b) => a + b, 0)).toBe(110);
  });

  it('appends after existing columns instead of replacing them', () => {
    useEditorStore.getState().addBeatColumn('Ideas');
    applyOutlinePreset('3act');
    const cols = [...useEditorStore.getState().beatColumns].sort((a, b) => a.position - b.position);
    expect(cols.map((c) => c.title)).toEqual(['Ideas', 'Act I', 'Act II', 'Act III']);
    // v2.20: a plain new section defaults to a 1-page budget, not blank.
    expect(cols[0].targetPages).toBe(1);
  });

  /* v2.23: choosing a preset over an existing outline REPLACES the sections
     but never touches the beats. v6.59, Derek: "when a preset is used but
     beats already exist, it should use the existing beats instead of
     creating new ones" — so they are re-homed into the new sections and
     re-fitted, rather than dumped in Unsorted to be dragged one by
     one. */
  it('override re-homes the existing beats into the new sections', () => {
    /* v7.75: the beats are WRITTEN here rather than dealt out by a preset —
       presets lay down sections only now, so a preset can no longer be used to
       manufacture the fixture this test needs. Sixty cards, three acts, which
       is the board v6.57 used to produce. */
    applyOutlinePreset('3act');
    const cols0 = [...useEditorStore.getState().beatColumns].sort((a, b) => a.position - b.position);
    for (const col of cols0) for (let i = 0; i < 20; i++) useEditorStore.getState().addBeat('', col.id);
    const before = useEditorStore.getState().beats;
    const beatIdsBefore = before.map((b) => b.id).sort();
    expect(beatIdsBefore).toHaveLength(60);
    // Give one of them some writing, to prove re-homing preserves it.
    useEditorStore.getState().updateBeat(before[0].id, { title: 'Ordinary World', description: 'Draft', color: '#ef4444' });

    applyOutlinePreset('storycircle', 'override');
    const s = useEditorStore.getState();
    const cols = [...s.beatColumns].sort((a, b) => a.position - b.position);
    expect(cols.map((c) => c.title)).toEqual(
      ['You', 'Need', 'Go', 'Search', 'Find', 'Take', 'Return', 'Change'],
    );
    // Exactly the same beats — none deleted, none created.
    expect(s.beats.map((b) => b.id).sort()).toEqual(beatIdsBefore);
    expect(unsortedBeats(s.beats, s.beatColumns)).toHaveLength(0);
    // Every section is filled, and its beats add up to its page budget.
    for (const col of cols) {
      const inCol = s.beats.filter((b) => b.columnId === col.id);
      expect(inCol.length, col.title).toBeGreaterThan(0);
      expect(inCol.reduce((sum, b) => sum + (b.outlineSpan ?? 0), 0), col.title).toBe(col.targetPages);
    }
    // The writing rode along; only section/order/estimate were re-fitted.
    const kept = s.beats.find((b) => b.id === before[0].id)!;
    expect([kept.title, kept.description, kept.color]).toEqual(['Ordinary World', 'Draft', '#ef4444']);
  });

  /* Fewer beats than the preset has sections: nothing is invented to pad it
     out, and the beats there are land in the sections carrying the most
     story rather than all piling into the opening. */
  it('override with fewer beats than sections spreads them without creating any', () => {
    const col = useEditorStore.getState().addBeatColumn('Ideas');
    const ids = ['A', 'B', 'C'].map((t) => useEditorStore.getState().addBeat(t, col));
    applyOutlinePreset('savethecat', 'override');
    const s = useEditorStore.getState();
    expect(s.beats.map((b) => b.id).sort()).toEqual([...ids].sort());
    expect(s.beatColumns).toHaveLength(15);
    // Three sections hold one beat each; a filled section still sums right.
    const filled = s.beatColumns.filter((c) => s.beats.some((b) => b.columnId === c.id));
    expect(filled).toHaveLength(3);
    for (const c of filled) {
      const inCol = s.beats.filter((b) => b.columnId === c.id);
      expect(inCol.reduce((sum, b) => sum + (b.outlineSpan ?? 0), 0), c.title).toBe(c.targetPages);
    }
    // The three biggest beats of Snyder's sheet: Fun and Games, Finale,
    // Bad Guys Close In (25 / 23 / 19 pages).
    expect(filled.map((c) => c.title).sort()).toEqual(['Bad Guys Close In', 'Finale', 'Fun and Games']);
  });

  /* Loose beats (no section at all) are the append case: the preset lands
     on an empty board that already has cards on the freeform canvas. */
  it('a preset applied over loose beats uses them instead of adding starters', () => {
    const ids = ['A', 'B', 'C', 'D'].map((t) => useEditorStore.getState().addBeat(t, 'gone'));
    applyOutlinePreset('3act');
    const s = useEditorStore.getState();
    expect(s.beats.map((b) => b.id).sort()).toEqual([...ids].sort());
    expect(unsortedBeats(s.beats, s.beatColumns)).toHaveLength(0);
    // 4 beats over 3 equal 40-page acts.
    const cols = [...s.beatColumns].sort((a, b) => a.position - b.position);
    expect(cols.map((c) => s.beats.filter((b) => b.columnId === c.id).length)).toEqual([2, 1, 1]);
    for (const c of cols) {
      expect(s.beats.filter((b) => b.columnId === c.id).reduce((n, b) => n + (b.outlineSpan ?? 0), 0)).toBe(40);
    }
  });

  /* Append over a real outline must not rip beats out of the sections that
     are staying — only the loose ones are dealt into the new sections. */
  it('append leaves the beats of the sections it keeps alone', () => {
    const keep = useEditorStore.getState().addBeatColumn('Ideas', 6);
    const settled = useEditorStore.getState().addBeat('Settled', keep);
    const loose = useEditorStore.getState().addBeat('Loose', 'gone');
    applyOutlinePreset('storycircle');
    const s = useEditorStore.getState();
    expect(s.beats.find((b) => b.id === settled)!.columnId).toBe(keep);
    // The loose one was re-homed into the preset, so nothing is orphaned.
    expect(s.beats.find((b) => b.id === loose)!.columnId).not.toBe('gone');
    expect(unsortedBeats(s.beats, s.beatColumns)).toHaveLength(0);
    expect(s.beats.map((b) => b.id).sort()).toEqual([settled, loose].sort());
  });

  /* The whole point of one batched write (v6.57): a preset is ONE undo. */
  it('re-homing a preset undoes in a single step', () => {
    applyOutlinePreset('3act');
    const before = useEditorStore.getState().beats.map((b) => [b.id, b.columnId, b.outlineSpan]);
    applyOutlinePreset('storycircle', 'override');
    useEditorStore.getState().beatUndo();
    expect(useEditorStore.getState().beats.map((b) => [b.id, b.columnId, b.outlineSpan])).toEqual(before);
  });

  it('an unknown preset id is a no-op; every preset has columns', () => {
    applyOutlinePreset('nope');
    expect(useEditorStore.getState().beatColumns).toHaveLength(0);
    for (const p of OUTLINE_PRESETS) expect(p.columns.length).toBeGreaterThan(0);
  });
});

/* v6.59: the arithmetic behind re-homing. Kept pure so the invariants can be
   proved over every shape, not just the ones a preset happens to have. */
describe('preset re-fit math (v6.59)', () => {
  it('splitPages deals a budget out exactly, biggest shares first', () => {
    expect(splitPages(40, 20)).toEqual(Array(20).fill(2));
    expect(splitPages(15, 8)).toEqual([2, 2, 2, 2, 2, 2, 2, 1]);
    expect(splitPages(15, 7)).toEqual([3, 2, 2, 2, 2, 2, 2]);
    expect(splitPages(10, 0)).toEqual([]);
    // A beat is never shorter than a page — more beats than pages runs over.
    expect(splitPages(3, 5)).toEqual([1, 1, 1, 1, 1]);
    for (let pages = 1; pages <= 60; pages++) {
      for (let n = 1; n <= 60; n++) {
        const out = splitPages(pages, n);
        expect(out).toHaveLength(n);
        expect(out.every((x) => x >= 1), `${pages}/${n} floor`).toBe(true);
        expect(out.reduce((a, b) => a + b, 0), `${pages}/${n} sum`).toBe(Math.max(pages, n));
        // dealt in descending order, so the difference is never over 1
        expect(out[0] - out[out.length - 1]).toBeLessThanOrEqual(1);
      }
    }
  });

  it('distributeBeats fills every section it can, in proportion, and loses none', () => {
    expect(distributeBeats([40, 40, 40], 60)).toEqual([20, 20, 20]);
    expect(distributeBeats([40, 40, 40], 4)).toEqual([2, 1, 1]);
    expect(distributeBeats([15, 15, 15, 15, 15, 15, 15, 15], 60)).toEqual([8, 8, 8, 8, 7, 7, 7, 7]);
    // Short supply covers the biggest sections.
    expect(distributeBeats([1, 10, 1, 5], 2)).toEqual([0, 1, 0, 1]);
    expect(distributeBeats([2, 2, 2], 0)).toEqual([0, 0, 0]);
    expect(distributeBeats([], 5)).toEqual([]);
    // A one-page section can hold exactly one beat; the rest go elsewhere.
    expect(distributeBeats([1, 20], 6)).toEqual([1, 5]);
    // More beats than the whole structure has pages: nothing is dropped.
    expect(distributeBeats([2, 2], 9).reduce((a, b) => a + b, 0)).toBe(9);
    for (const pages of [[40, 40, 40], [1, 1, 8, 2, 13, 1, 4, 25, 1, 19, 1, 9, 1, 23, 1], [15, 15, 15, 15]]) {
      for (let n = 0; n <= 130; n++) {
        const out = distributeBeats(pages, n);
        expect(out.reduce((a, b) => a + b, 0), `${n} beats placed`).toBe(n);
        // no section is left empty while another has two, once supply allows
        if (n >= pages.length) expect(out.every((x) => x >= 1), `${n} fills every section`).toBe(true);
      }
    }
  });

  it('presetReuseOrder deals beats in reading order, orphans last', () => {
    const beat = (id: string, columnId: string, position: number) =>
      ({ id, columnId, position, title: '', description: '' }) as BeatInfo;
    const cols = [{ id: 'c2', position: 1 }, { id: 'c1', position: 0 }];
    const beats = [beat('x', 'gone', 0), beat('b', 'c1', 1), beat('c', 'c2', 0), beat('a', 'c1', 0)];
    expect(presetReuseOrder(beats, cols, 'override').map((b) => b.id)).toEqual(['a', 'b', 'c', 'x']);
    // append keeps the sections that are staying — only the orphan is dealt
    expect(presetReuseOrder(beats, cols, 'append').map((b) => b.id)).toEqual(['x']);
  });
});

/* v2.45 regression: dragging the LAST orphan out of Unsorted used to
   unmount the column mid-drag (dragOver reassigns columnId live), and
   dnd-kit's re-measuring of the vanished droppable looped setState into
   React's "Maximum update depth exceeded" crash. The column must stay
   mounted until the drag ends. */
describe('keepUnsortedMounted', () => {
  it('keeps the column through a drag that started with orphans, even at zero', async () => {
    const { keepUnsortedMounted } = await import('./BeatBoard');
    // Mid-drag, last orphan already reassigned by dragOver → stays mounted.
    expect(keepUnsortedMounted(0, true, true)).toBe(true);
    // Drag over: the column finally goes away.
    expect(keepUnsortedMounted(0, false, true)).toBe(false);
    // Orphans present → always mounted, dragging or not.
    expect(keepUnsortedMounted(2, false, false)).toBe(true);
    expect(keepUnsortedMounted(2, true, false)).toBe(true);
    // No orphans and none at drag start → never mounted.
    expect(keepUnsortedMounted(0, true, false)).toBe(false);
    expect(keepUnsortedMounted(0, false, false)).toBe(false);
  });
});

/* v6.60, Derek: "if an outline section is deleted and it had beats inside
   it, the beats should not be deleted. instead they should move to an
   Unsorted section (make it the furthest left column). no beats should ever
   be deleted unless they are individually deleted using the delete button on
   the beat itself." Before this, deleteBeatColumn filtered them out of the
   pool with one click and no warning. */
describe('deleting a section keeps its beats (v6.60)', () => {
  beforeEach(() => {
    useEditorStore.getState().setBeatColumns([]);
    useEditorStore.getState().setBeats([]);
    useEditorStore.getState().resetOutlineTabs();
  });
  const S = () => useEditorStore.getState();

  it('cuts the beats loose into Unsorted instead of deleting them', () => {
    const a = S().addBeatColumn('Act I', 10);
    const b = S().addBeatColumn('Act II', 20);
    const keep = S().addBeat('Stays', b);
    const one = S().addBeat('First', a);
    const two = S().addBeat('Second', a);
    S().updateBeat(one, { barOffset: 4 });          // a pin inside Act I

    S().deleteBeatColumn(a);
    const s = S();
    expect(s.beatColumns.map((c) => c.title)).toEqual(['Act II']);
    expect(s.beats.map((x) => x.id).sort()).toEqual([keep, one, two].sort());
    // the freed pair is unsorted, in the order they were in
    expect(unsortedBeats(s.beats, s.beatColumns).map((x) => x.title)).toEqual(['First', 'Second']);
    // the other section's beat is untouched
    expect(s.beats.find((x) => x.id === keep)!.columnId).toBe(b);
    // v2.60: a pin is an offset inside a section that no longer exists
    expect(s.beats.find((x) => x.id === one)!.barOffset).toBeUndefined();
  });

  it('appends after the beats already waiting, renumbering the pool', () => {
    const a = S().addBeatColumn('Act I', 10);
    const b = S().addBeatColumn('Act II', 10);
    const waiting = S().addBeat('Already loose', 'gone');
    const first = S().addBeat('A1', a);
    S().addBeat('B1', b);
    S().deleteBeatColumn(a);
    S().deleteBeatColumn(b);
    const s = S();
    expect(unsortedBeats(s.beats, s.beatColumns).map((x) => x.title)).toEqual(['Already loose', 'A1', 'B1']);
    // positions are a clean 0..n-1, so nothing collides in the column
    expect(unsortedBeats(s.beats, s.beatColumns).map((x) => x.position)).toEqual([0, 1, 2]);
    expect(s.beats.find((x) => x.id === waiting)!.position).toBe(0);
    expect(s.beats.find((x) => x.id === first)!.position).toBe(1);
  });

  it('is one undo step, and the individual delete button still deletes', () => {
    const a = S().addBeatColumn('Act I', 10);
    const one = S().addBeat('First', a);
    S().addBeat('Second', a);
    S().deleteBeatColumn(a);
    S().beatUndo();
    expect(S().beatColumns.map((c) => c.title)).toEqual(['Act I']);
    expect(S().beats.every((x) => x.columnId === a)).toBe(true);
    // the ONE door that removes a beat
    S().deleteBeat(one);
    expect(S().beats.map((x) => x.title)).toEqual(['Second']);
  });

  it('deleting a section on one variation leaves the others alone', () => {
    const a = S().addBeatColumn('Act I', 10);
    const beat = S().addBeat('Opening', a);
    const tab1 = S().viewedOutlineTab;
    const tab2 = S().addOutlineTab();
    const circle = S().addBeatColumn('You', 15);
    S().updateBeat(beat, { columnId: circle, position: 0 });

    S().deleteBeatColumn(circle);
    expect(unsortedBeats(S().beats, S().beatColumns)).toHaveLength(1);
    S().switchOutlineTab(tab1);
    // tab 1 still has its own section, with the beat in it
    expect(S().beatColumns.map((c) => c.title)).toEqual(['Act I']);
    expect(S().beats.find((x) => x.id === beat)!.columnId).toBe(a);
    S().switchOutlineTab(tab2);
    expect(S().beatColumns).toHaveLength(0);
  });
});
