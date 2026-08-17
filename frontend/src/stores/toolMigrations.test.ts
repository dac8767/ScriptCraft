// @vitest-environment jsdom
/**
 * v5.21, Derek: "combine the notes and to-do tools" — the 'todo' tool id is
 * retired the way 'indexcards' was (v4.24): persisted layouts, workspace
 * snapshots and open calls carrying the old id all land on the merged tool.
 */
import { describe, it, expect } from 'vitest';
import { migrateToolOrder, migrateToolConfig, migrateToolId, useEditorStore } from './editorStore';

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
 *
 * Every retirement before this one MERGED a tool into a successor, so
 * "retired" and "has an heir" were the same fact. AI Writer has no heir — it
 * is simply gone — and the map could not say that. `RETIRED_TOOL_IDS[id] ?? id`
 * handed the dead id straight back, which is how a removed tool returns from
 * a saved layout: the panel list is rebuilt from persisted state, so deleting
 * the component is not the same as removing the tool.
 */
describe('v7.33: a dropped tool has no heir and does not come back', () => {
  it('toolOrder drops it instead of mapping it', () => {
    expect(migrateToolOrder(['sticky', 'aiwriter', 'goals'])).toEqual(['sticky', 'goals']);
    expect(migrateToolOrder(['aiwriter'])).toEqual([]);
  });

  it('toolConfig drops it with nothing inheriting its enabled flag', () => {
    expect(migrateToolConfig({
      aiwriter: { side: 'right', enabled: true },
      goals: { side: 'right', enabled: false },
    })).toEqual({ goals: { side: 'right', enabled: false } });
  });

  it('migrateToolId reports the drop, so every caller agrees', () => {
    expect(migrateToolId('aiwriter')).toBe(null);
    // a merge still returns its heir, and an ordinary id passes through
    expect(migrateToolId('todo')).toBe('sticky');
    expect(migrateToolId('goals')).toBe('goals');
    expect(migrateToolId(null)).toBe(null);
  });

  it('a saved layout that had it OPEN reopens with an empty slot', () => {
    useEditorStore.setState({
      workspaces: {
        old: {
          toolConfig: { aiwriter: { side: 'right', enabled: true } },
          toolOrder: ['aiwriter', 'goals'],
          activeToolRight: 'aiwriter',
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
    expect('aiwriter' in s.toolConfig).toBe(false);
  });

  it('the tool is gone from the registry the panel list is built from', async () => {
    const { ALL_TOOLS } = await import('../components/ToolDock');
    // `as string` because tsc now REFUSES the comparison — 'aiwriter' is no
    // longer a ToolId, which is half the proof on its own. The runtime check
    // stays for the other half: the registry is data, and a row can carry an
    // id the union never sees.
    expect(ALL_TOOLS.some((t) => (t.id as string) === 'aiwriter')).toBe(false);
    expect(ALL_TOOLS.some((t) => /AI Writer/i.test(t.label))).toBe(false);
  });
});
