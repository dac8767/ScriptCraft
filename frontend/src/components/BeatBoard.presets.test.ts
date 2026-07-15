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
  });

  it('3-Act Structure adds Act I / Act II / Act III in order', () => {
    applyOutlinePreset('3act');
    const cols = [...useEditorStore.getState().beatColumns].sort((a, b) => a.position - b.position);
    expect(cols.map((c) => c.title)).toEqual(['Act I', 'Act II', 'Act III']);
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
