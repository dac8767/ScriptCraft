// @vitest-environment jsdom
/**
 * Outline presets (v1.89) — the Presets dropdown appends a structure's
 * columns, titled and ordered, without disturbing existing ones.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { OUTLINE_PRESETS, applyOutlinePreset } from './BeatBoard';
import { useEditorStore } from '../stores/editorStore';

describe('outline presets', () => {
  beforeEach(() => {
    useEditorStore.getState().setBeatColumns([]);
    useEditorStore.getState().setBeats([]);
  });

  it('3-Act Structure adds Act I / Act II / Act III in order, one blank beat each', () => {
    applyOutlinePreset('3act');
    const cols = [...useEditorStore.getState().beatColumns].sort((a, b) => a.position - b.position);
    expect(cols.map((c) => c.title)).toEqual(['Act I', 'Act II', 'Act III']);
    // v2.18: every preset section starts with one blank beat.
    const beats = useEditorStore.getState().beats;
    expect(beats).toHaveLength(3);
    for (const col of cols) {
      expect(beats.filter((b) => b.columnId === col.id)).toHaveLength(1);
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
    expect(useEditorStore.getState().beats).toHaveLength(15);
  });

  it('appends after existing columns instead of replacing them', () => {
    useEditorStore.getState().addBeatColumn('Ideas');
    applyOutlinePreset('3act');
    const cols = [...useEditorStore.getState().beatColumns].sort((a, b) => a.position - b.position);
    expect(cols.map((c) => c.title)).toEqual(['Ideas', 'Act I', 'Act II', 'Act III']);
  });

  it('an unknown preset id is a no-op; every preset has columns', () => {
    applyOutlinePreset('nope');
    expect(useEditorStore.getState().beatColumns).toHaveLength(0);
    for (const p of OUTLINE_PRESETS) expect(p.columns.length).toBeGreaterThan(0);
  });
});
