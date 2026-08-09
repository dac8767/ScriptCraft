// @vitest-environment jsdom
/**
 * Outline presets (v1.89) — the Presets dropdown appends a structure's
 * columns, titled and ordered, without disturbing existing ones.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { OUTLINE_PRESETS, applyOutlinePreset, presetBeatSpans, uncategorizedBeats } from './BeatBoard';
import { useEditorStore } from '../stores/editorStore';

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

  /* v6.57, Derek: "the preset for the [3] act structure should include 20
     beats in each act, each of which is 2 pages estimated length." */
  it('3-Act Structure adds Act I / Act II / Act III, 40 pages each, filled with 20 two-page beats', () => {
    applyOutlinePreset('3act');
    const cols = [...useEditorStore.getState().beatColumns].sort((a, b) => a.position - b.position);
    expect(cols.map((c) => c.title)).toEqual(['Act I', 'Act II', 'Act III']);
    // v2.20, Derek: each act defaults to 40 pages.
    expect(cols.map((c) => c.targetPages)).toEqual([40, 40, 40]);
    const beats = useEditorStore.getState().beats;
    expect(beats).toHaveLength(60);
    for (const col of cols) {
      const inCol = beats.filter((b) => b.columnId === col.id);
      expect(inCol).toHaveLength(20);
      for (const b of inCol) expect(b.outlineSpan).toBe(2);
      expect(inCol.reduce((sum, b) => sum + (b.outlineSpan ?? 0), 0)).toBe(col.targetPages);
    }
  });

  /* The rule Derek asked me to carry to the rest: ~2 pages a beat, with the
     spans adding up to the section EXACTLY. */
  it('presetBeatSpans: counts by the two-pages-a-beat ratio and always sums to the budget', () => {
    expect(presetBeatSpans(40)).toEqual(Array(20).fill(2));
    expect(presetBeatSpans(1)).toEqual([1]);
    expect(presetBeatSpans(2)).toEqual([2]);
    expect(presetBeatSpans(3)).toEqual([2, 1]);
    expect(presetBeatSpans(5)).toEqual([2, 2, 1]);
    expect(presetBeatSpans(15)).toEqual([2, 2, 2, 2, 2, 2, 2, 1]);
    for (let pages = 1; pages <= 120; pages++) {
      const spans = presetBeatSpans(pages);
      expect(spans.reduce((a, b) => a + b, 0), `sum for ${pages}`).toBe(pages);
      expect(spans.every((n) => n >= 1), `no empty beat at ${pages}`).toBe(true);
      // never more than a page off the intended ratio
      expect(Math.abs(spans.length - Math.round(pages / 2))).toBeLessThanOrEqual(1);
    }
  });

  it('EVERY preset fills each section with beats whose pages add up to that section', () => {
    for (const p of OUTLINE_PRESETS) {
      useEditorStore.getState().setBeatColumns([]);
      useEditorStore.getState().setBeats([]);
      applyOutlinePreset(p.id);
      const cols = [...useEditorStore.getState().beatColumns].sort((a, b) => a.position - b.position);
      const beats = useEditorStore.getState().beats;
      expect(cols, p.id).toHaveLength(p.columns.length);
      cols.forEach((col, i) => {
        const inCol = beats.filter((b) => b.columnId === col.id);
        const sum = inCol.reduce((acc, b) => acc + (b.outlineSpan ?? 0), 0);
        expect(inCol.length, `${p.id} · ${col.title} beat count`).toBe(presetBeatSpans(p.pages[i]).length);
        expect(sum, `${p.id} · ${col.title} pages`).toBe(p.pages[i]);
        expect(col.targetPages, `${p.id} · ${col.title} budget`).toBe(p.pages[i]);
      });
      // and the whole structure still adds up to the preset's page count
      expect(beats.reduce((acc, b) => acc + (b.outlineSpan ?? 0), 0), `${p.id} total`)
        .toBe(p.pages.reduce((a, b) => a + b, 0));
    }
  });

  it('the classic structures ship with their full beat lists', () => {
    const byId = Object.fromEntries(OUTLINE_PRESETS.map((p) => [p.id, p]));
    expect(byId.savethecat.columns).toHaveLength(15);   // Blake Snyder's 15
    expect(byId.herojourney.columns).toHaveLength(12);  // 12 stages
    expect(byId.storycircle.columns).toHaveLength(8);   // Harmon's 8 steps
    expect(byId.sequences.columns).toHaveLength(8);     // 8 sequences
    applyOutlinePreset('savethecat');
    expect(useEditorStore.getState().beatColumns).toHaveLength(15);
    // v6.57: each of Snyder's beats is filled at ~2 pages a card, so a
    // one-page beat gets a single card and Fun and Games (25pp) gets 13.
    const stcBeats = useEditorStore.getState().beats;
    expect(stcBeats).toHaveLength(byId.savethecat.pages.reduce((n, p) => n + presetBeatSpans(p).length, 0));
    expect(stcBeats.reduce((a, b) => a + (b.outlineSpan ?? 0), 0)).toBe(110);
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
     but never touches the beats — they become "uncategorized" (their section
     is gone) and wait in the temporary column until dragged into place. */
  it('override replaces sections but never deletes beats', () => {
    applyOutlinePreset('3act');
    const beatIdsBefore = useEditorStore.getState().beats.map((b) => b.id).sort();
    expect(beatIdsBefore).toHaveLength(60);   // v6.57: 20 beats an act

    applyOutlinePreset('storycircle', 'override');
    const s = useEditorStore.getState();
    expect(s.beatColumns.map((c) => c.title)).toEqual(
      ['You', 'Need', 'Go', 'Search', 'Find', 'Take', 'Return', 'Change'],
    );
    // Same beats — none deleted, and no blank starters piled on top.
    expect(s.beats.map((b) => b.id).sort()).toEqual(beatIdsBefore);
    // All of them now live in Uncategorized.
    expect(uncategorizedBeats(s.beats, s.beatColumns).map((b) => b.id).sort()).toEqual(beatIdsBefore);
    // Dragging one into a real section takes it out of Uncategorized.
    useEditorStore.getState().updateBeat(beatIdsBefore[0], { columnId: s.beatColumns[0].id });
    const after = useEditorStore.getState();
    expect(uncategorizedBeats(after.beats, after.beatColumns)).toHaveLength(beatIdsBefore.length - 1);
  });

  it('an unknown preset id is a no-op; every preset has columns', () => {
    applyOutlinePreset('nope');
    expect(useEditorStore.getState().beatColumns).toHaveLength(0);
    for (const p of OUTLINE_PRESETS) expect(p.columns.length).toBeGreaterThan(0);
  });
});

/* v2.45 regression: dragging the LAST orphan out of Uncategorized used to
   unmount the column mid-drag (dragOver reassigns columnId live), and
   dnd-kit's re-measuring of the vanished droppable looped setState into
   React's "Maximum update depth exceeded" crash. The column must stay
   mounted until the drag ends. */
describe('keepUncatMounted', () => {
  it('keeps the column through a drag that started with orphans, even at zero', async () => {
    const { keepUncatMounted } = await import('./BeatBoard');
    // Mid-drag, last orphan already reassigned by dragOver → stays mounted.
    expect(keepUncatMounted(0, true, true)).toBe(true);
    // Drag over: the column finally goes away.
    expect(keepUncatMounted(0, false, true)).toBe(false);
    // Orphans present → always mounted, dragging or not.
    expect(keepUncatMounted(2, false, false)).toBe(true);
    expect(keepUncatMounted(2, true, false)).toBe(true);
    // No orphans and none at drag start → never mounted.
    expect(keepUncatMounted(0, true, false)).toBe(false);
    expect(keepUncatMounted(0, false, false)).toBe(false);
  });
});
