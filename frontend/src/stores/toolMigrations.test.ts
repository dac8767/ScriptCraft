// @vitest-environment jsdom
/**
 * v5.21, Derek: "combine the notes and to-do tools" — the 'todo' tool id is
 * retired the way 'indexcards' was (v4.24): persisted layouts, workspace
 * snapshots and open calls carrying the old id all land on the merged tool.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { migrateToolOrder, migrateToolConfig, migrateToolId, useEditorStore, RETIRED_TOOL_IDS } from './editorStore';

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

describe("v5.67: the retired titlepage id migrates onto pages (+ the tab)", () => {
  it('toolOrder maps titlepage → pages without duplicating', () => {
    expect(migrateToolOrder(['pages', 'titlepage', 'characters'])).toEqual(['pages', 'characters']);
    expect(migrateToolOrder(['titlepage', 'characters'])).toEqual(['pages', 'characters']);
  });

  it('toolConfig drops titlepage and hands its enabled flag to pages', () => {
    expect(migrateToolConfig({
      titlepage: { side: 'left', enabled: true },
      pages: { side: 'left', enabled: false },
    })).toEqual({ pages: { side: 'left', enabled: true } });
  });

  it("openTool('titlepage') opens Pages on the Title Page tab", async () => {
    useEditorStore.setState({
      toolMode: {}, activeTool: null, activeToolRight: null,
      tempTool: null, fullscreenTool: null, navigatorOpen: true, shelfOpen: true,
      pagesTab: 'script',
    });
    useEditorStore.getState().openTool('titlepage');
    // pages lives in the LEFT dock by default
    expect(useEditorStore.getState().activeTool).toBe('pages');
    // the tab lands via the remap's deferred set (the indexcards pattern)
    await new Promise((r) => setTimeout(r, 0));
    expect(useEditorStore.getState().pagesTab).toBe('title');
  });
});

/**
 * v7.33, Derek: "AI Writer is an option for the side panels… [it] was
 * supposed to be fully removed from the app."
 * v7.68, Derek: "readd the ai writer tool." So it is back, and these tests
 * are rewritten to the decision that now holds rather than deleted.
 *
 * THE MECHANISM THEY GUARD OUTLIVES THE TOOL. Every retirement before v7.33
 * MERGED a tool into a successor, so "retired" and "has an heir" were the same
 * fact, and `RETIRED_TOOL_IDS[id] ?? id` handed a dead id straight back —
 * which is how a removed tool returns from a saved layout. A null heir means
 * DROPPED. AI Writer was the only tool using it and no longer does, so the
 * drop path is exercised against a synthetic id here: a mechanism with no live
 * caller is exactly the one that rots unnoticed, and the next tool to be
 * deleted will lean on it.
 *
 * AND THE OTHER HALF: re-adding a tool has to REMOVE its null heir. Left in
 * place, migrateToolId keeps stripping the id out of every saved layout the
 * moment it loads, and the tool becomes un-keepable — addable from Customize,
 * gone again next launch. That is the assertion that fails if someone deletes
 * the tool later and forgets to put the entry back, or re-adds one and forgets
 * to take it out.
 */
describe('a dropped tool has no heir and does not come back', () => {
  const DROPPED = 'ghosttool';
  beforeEach(() => { RETIRED_TOOL_IDS[DROPPED] = null; });
  afterEach(() => { delete RETIRED_TOOL_IDS[DROPPED]; });

  it('toolOrder drops it instead of mapping it', () => {
    expect(migrateToolOrder(['sticky', DROPPED, 'goals'])).toEqual(['sticky', 'goals']);
    expect(migrateToolOrder([DROPPED])).toEqual([]);
  });

  it('toolConfig drops it with nothing inheriting its enabled flag', () => {
    expect(migrateToolConfig({
      [DROPPED]: { side: 'right', enabled: true },
      goals: { side: 'right', enabled: false },
    })).toEqual({ goals: { side: 'right', enabled: false } });
  });

  it('migrateToolId reports the drop, so every caller agrees', () => {
    expect(migrateToolId(DROPPED)).toBe(null);
    // a merge still returns its heir, and an ordinary id passes through
    expect(migrateToolId('todo')).toBe('sticky');
    expect(migrateToolId('goals')).toBe('goals');
    expect(migrateToolId(null)).toBe(null);
  });

  it('a saved layout that had it OPEN reopens with an empty slot', () => {
    useEditorStore.setState({
      workspaces: {
        old: {
          toolConfig: { [DROPPED]: { side: 'right', enabled: true } },
          toolOrder: [DROPPED, 'goals'],
          activeToolRight: DROPPED,
          toolbarHiddenItems: [], toolbarPinnedTools: [],
          navigatorOpen: true, shelfOpen: true, toolSizes: {},
        } as never,
      },
      activeToolRight: 'goals',
    });
    useEditorStore.getState().applyWorkspace('old');
    const s = useEditorStore.getState();
    expect(s.activeToolRight).toBe(null);
    expect(s.toolOrder).toEqual(['goals']);
    expect(DROPPED in s.toolConfig).toBe(false);
  });
});

describe('v7.68: AI Writer is back, and stays back', () => {
  it('is in the registry the panel list is built from', async () => {
    const { ALL_TOOLS } = await import('../components/ToolDock');
    expect(ALL_TOOLS.some((t) => t.id === 'aiwriter')).toBe(true);
    expect(ALL_TOOLS.some((t) => /AI Writer/i.test(t.label))).toBe(true);
  });

  /* THE ONE THAT MATTERS. A tool can be in the registry and still be
     un-keepable: the panel list is rebuilt from PERSISTED state, so a leftover
     null heir would strip it out again on every load. */
  it('survives a round trip through the migrations', () => {
    expect(migrateToolId('aiwriter')).toBe('aiwriter');
    expect(migrateToolOrder(['sticky', 'aiwriter'])).toEqual(['sticky', 'aiwriter']);
    expect(migrateToolConfig({ aiwriter: { side: 'right', enabled: true } }))
      .toEqual({ aiwriter: { side: 'right', enabled: true } });
  });

  it('and a saved layout that has it OPEN still opens it', () => {
    useEditorStore.setState({
      workspaces: {
        withAi: {
          toolConfig: { aiwriter: { side: 'right', enabled: true } },
          toolOrder: ['aiwriter', 'goals'],
          activeToolRight: 'aiwriter',
          toolbarHiddenItems: [], toolbarPinnedTools: [],
          navigatorOpen: true, shelfOpen: true, toolSizes: {},
        } as never,
      },
      activeToolRight: null,
    });
    useEditorStore.getState().applyWorkspace('withAi');
    expect(useEditorStore.getState().activeToolRight).toBe('aiwriter');
  });
});
