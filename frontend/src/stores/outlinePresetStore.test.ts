// @vitest-environment jsdom
/**
 * Custom outline presets (v2.26) — save the board's structure under a name,
 * apply it like a built-in (custom:<id>), and export/import as JSON.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useOutlinePresetStore, isValidCustomPreset } from './outlinePresetStore';
import { applyOutlinePreset, resolveOutlinePreset } from '../components/BeatBoard';
import { useEditorStore } from './editorStore';

beforeEach(() => {
  localStorage.removeItem('opendraft:outlinePresets');
  useOutlinePresetStore.setState({ presets: [] });
  useEditorStore.getState().setBeatColumns([]);
  useEditorStore.getState().setBeats([]);
});

describe('outlinePresetStore', () => {
  it('saves, persists, and applies a custom preset', () => {
    const p = useOutlinePresetStore.getState().savePreset('Derek 4-Act', ['I', 'II', 'III', 'IV'], [25, 35, 30, 25]);
    expect(JSON.parse(localStorage.getItem('opendraft:outlinePresets')!)).toHaveLength(1);

    expect(resolveOutlinePreset(`custom:${p.id}`)?.columns).toEqual(['I', 'II', 'III', 'IV']);
    applyOutlinePreset(`custom:${p.id}`);
    const cols = [...useEditorStore.getState().beatColumns].sort((a, b) => a.position - b.position);
    expect(cols.map((c) => c.title)).toEqual(['I', 'II', 'III', 'IV']);
    expect(cols.map((c) => c.targetPages)).toEqual([25, 35, 30, 25]);
    expect(useEditorStore.getState().beats).toHaveLength(4);   // one blank beat each
  });

  it('page budgets are whole and at least 1 when saved', () => {
    const p = useOutlinePresetStore.getState().savePreset('X', ['A', 'B'], [2.6, 0]);
    expect(p.pages).toEqual([3, 1]);
  });

  it('export/import round-trips; duplicates and junk are skipped', () => {
    const s = useOutlinePresetStore.getState();
    s.savePreset('Mine', ['A', 'B'], [10, 20]);
    const json = useOutlinePresetStore.getState().exportJson();

    // Same-name preset is skipped on import; a fresh name lands.
    const r1 = useOutlinePresetStore.getState().importPresets(json);
    expect(r1).toEqual({ added: 0, skipped: 1 });
    const r2 = useOutlinePresetStore.getState().importPresets(
      JSON.stringify([{ name: 'Theirs', columns: ['X'], pages: [5] }, { nonsense: true }]),
    );
    expect(r2.added).toBe(1);
    expect(r2.skipped).toBe(1);
    expect(useOutlinePresetStore.getState().presets.map((p) => p.name)).toEqual(['Mine', 'Theirs']);

    expect(useOutlinePresetStore.getState().importPresets('not json').error).toBeTruthy();
    expect(useOutlinePresetStore.getState().importPresets('{"name":1}').error).toBeTruthy();
  });

  it('validator rejects mismatched or sub-1 page arrays', () => {
    expect(isValidCustomPreset({ name: 'A', columns: ['x'], pages: [1] })).toBe(true);
    expect(isValidCustomPreset({ name: 'A', columns: ['x'], pages: [] })).toBe(false);
    expect(isValidCustomPreset({ name: 'A', columns: ['x'], pages: [0] })).toBe(false);
    expect(isValidCustomPreset({ name: '', columns: ['x'], pages: [1] })).toBe(false);
  });

  it('deletePreset removes it and resolve fails gracefully', () => {
    const p = useOutlinePresetStore.getState().savePreset('Gone', ['A'], [1]);
    useOutlinePresetStore.getState().deletePreset(p.id);
    expect(resolveOutlinePreset(`custom:${p.id}`)).toBeUndefined();
    applyOutlinePreset(`custom:${p.id}`);                      // no-op, no throw
    expect(useEditorStore.getState().beatColumns).toHaveLength(0);
  });
});
