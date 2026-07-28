// @vitest-environment jsdom
/**
 * v5.21, Derek: "combine the notes and to-do tools" — the 'todo' tool id is
 * retired the way 'indexcards' was (v4.24): persisted layouts, workspace
 * snapshots and open calls carrying the old id all land on the merged tool.
 */
import { describe, it, expect } from 'vitest';
import { migrateToolOrder, migrateToolConfig, useEditorStore } from './editorStore';

describe('v5.21: the retired todo id migrates onto sticky', () => {
  it('toolOrder maps todo → sticky without duplicating', () => {
    expect(migrateToolOrder(['sticky', 'todo', 'fragments'])).toEqual(['sticky', 'fragments']);
    expect(migrateToolOrder(['todo', 'fragments'])).toEqual(['sticky', 'fragments']);
    // both retirements in one stored order:
    expect(migrateToolOrder(['indexcards', 'todo'])).toEqual(['scenes', 'sticky']);
  });

  it('toolConfig drops todo and hands its enabled flag to sticky', () => {
    expect(migrateToolConfig({
      todo: { side: 'right', enabled: true },
      sticky: { side: 'right', enabled: false },
    })).toEqual({ sticky: { side: 'right', enabled: true } });
    // a disabled todo must NOT re-enable a deliberately disabled sticky…
    expect(migrateToolConfig({
      todo: { side: 'right', enabled: false },
      sticky: { side: 'right', enabled: false },
    })).toEqual({ sticky: { side: 'right', enabled: false } });
  });

  it("openTool('todo') opens the merged Sticky Notes", () => {
    useEditorStore.setState({
      toolMode: {}, activeTool: null, activeToolRight: null,
      tempTool: null, fullscreenTool: null, navigatorOpen: true, shelfOpen: true,
    });
    useEditorStore.getState().openTool('todo');
    expect(useEditorStore.getState().activeToolRight).toBe('sticky');
  });
});
