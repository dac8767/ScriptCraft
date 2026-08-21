// @vitest-environment jsdom
/**
 * v4.24 batch 7 (Derek): Scenes and Index Cards are ONE tool — 'scenes' with
 * a List/Cards view. The 'indexcards' id is retired but persists in old
 * viewState and workspace snapshots, so every entry point migrates it:
 * toolOrder/toolConfig/pinned lists, openTool('indexcards'), and workspace
 * apply. These tests pin the migration helpers and the legacy remap.
 */
import { describe, it, expect } from 'vitest';
import {
  useEditorStore, migrateToolOrder, migrateToolConfig,
  DEFAULT_TOOL_ORDER, DEFAULT_TOOL_CONFIG,
} from './editorStore';

const S = () => useEditorStore.getState();

describe('scenes / index-cards merge migration', () => {
  it('defaults no longer contain the retired id', () => {
    expect(DEFAULT_TOOL_ORDER).not.toContain('indexcards');
    expect(DEFAULT_TOOL_CONFIG).not.toHaveProperty('indexcards');
  });

  it('migrateToolOrder maps indexcards onto scenes without duplicating', () => {
    expect(migrateToolOrder(['navigator', 'indexcards', 'beatboard']))
      .toEqual(['navigator', 'scenes', 'beatboard']);
    // scenes already present earlier in the order — the retired id just drops
    expect(migrateToolOrder(['scenes', 'sticky', 'indexcards']))
      .toEqual(['scenes', 'sticky']);
    // divider tokens pass through untouched
    expect(migrateToolOrder(['div:abc', 'indexcards'])).toEqual(['div:abc', 'scenes']);
  });

  it('migrateToolConfig drops the retired key and carries "enabled" intent', () => {
    const migrated = migrateToolConfig({
      scenes: { side: 'left', enabled: false },
      indexcards: { side: 'right', enabled: true },
    });
    expect(migrated).not.toHaveProperty('indexcards');
    // the user's visible tool was Index Cards — the merged tool stays visible
    expect(migrated.scenes.enabled).toBe(true);
    expect(migrated.scenes.side).toBe('left');

    // untouched configs come back as-is
    const clean = { scenes: { side: 'left' as const, enabled: true } };
    expect(migrateToolConfig(clean)).toBe(clean);
  });

  it("openTool('indexcards') opens Scenes and flips the view to cards", async () => {
    S().setScenesViewMode('list');
    S().openTool('indexcards' as never);
    // the sub-state flip is deferred a tick (same pattern as 'scriptnotes')
    await new Promise((r) => setTimeout(r, 10));
    expect(S().scenesViewMode).toBe('cards');
    /* Any of the FOUR shapes a tool can open in — the fullscreen slot included.
       It was left out, and the shipped defaults (v7.70, Derek's preset) remember
       Scenes as fullscreen, so the tool opened exactly as asked and the
       assertion called it closed. What this test is about is the migration:
       'indexcards' opens Scenes, in Cards view. Not which slot it lands in. */
    expect(S().activeTool === 'scenes' || S().activeToolRight === 'scenes'
      || S().tempTool === 'scenes' || S().fullscreenTool === 'scenes').toBe(true);
  });

  it('scenesViewMode persists through viewState', () => {
    S().setScenesViewMode('cards');
    expect(JSON.parse(localStorage.getItem('opendraft:viewState') || '{}').scenesViewMode).toBe('cards');
    S().setScenesViewMode('list');
    expect(JSON.parse(localStorage.getItem('opendraft:viewState') || '{}').scenesViewMode).toBe('list');
  });
});
