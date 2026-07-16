// @vitest-environment jsdom
/**
 * Outline presets (v1.89) — the Presets dropdown appends a structure's
 * columns, titled and ordered, without disturbing existing ones.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { OUTLINE_PRESETS, applyOutlinePreset, uncategorizedBeats } from './BeatBoard';
import { useEditorStore } from '../stores/editorStore';

describe('outline presets', () => {
  beforeEach(() => {
    useEditorStore.getState().setBeatColumns([]);
    useEditorStore.getState().setBeats([]);
  });

  it('3-Act Structure adds Act I / Act II / Act III in order, one blank beat each, 40 pages per act', () => {
    applyOutlinePreset('3act');
    const cols = [...useEditorStore.getState().beatColumns].sort((a, b) => a.position - b.position);
    expect(cols.map((c) => c.title)).toEqual(['Act I', 'Act II', 'Act III']);
    // v2.20, Derek: each act defaults to 40 pages.
    expect(cols.map((c) => c.targetPages)).toEqual([40, 40, 40]);
    // v2.18: every preset section starts with one blank beat.
    const beats = useEditorStore.getState().beats;
    expect(beats).toHaveLength(3);
    for (const col of cols) {
      expect(beats.filter((b) => b.columnId === col.id)).toHaveLength(1);
    }
    // v2.20: beats are never born blank — 1 page by default.
    for (const b of beats) expect(b.outlineSpan).toBe(1);
  });

  it('the classic structures ship with their full beat lists', () => {
    const byId = Object.fromEntries(OUTLINE_PRESETS.map((p) => [p.id, p]));
    expect(byId.savethecat.columns).toHaveLength(15);   // Blake Snyder's 15
    expect(byId.herojourney.columns).toHaveLength(12);  // 12 stages
    expect(byId.storycircle.columns).toHaveLength(8);   // Harmon's 8 steps
    expect(byId.sequences.columns).toHaveLength(8);     // 8 sequences
    applyOutlinePreset('savethecat');
    expect(useEditorStore.getState().beatColumns).toHaveLength(15);
    expect(useEditorStore.getState().beats).toHaveLength(15);
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
    expect(beatIdsBefore).toHaveLength(3);

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
    expect(uncategorizedBeats(after.beats, after.beatColumns)).toHaveLength(2);
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
