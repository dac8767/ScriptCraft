// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore, DEFAULT_TOOL_CONFIG } from './editorStore';

/**
 * The menu and the sidebar must agree about where a tool lives.
 *
 * They didn't: ToolDock asked toolConfigFor() (which defaults unknown tools to the
 * right panel), while openTool did its own lookup and floated anything without a
 * DEFAULT_TOOL_CONFIG entry. So the same tool sat in the right dock, opened INTO
 * the dock when you clicked its tab, and floated a centred window when you picked
 * it from the menu. Same tool, two answers.
 * (v3.25: the tests used the Dev Picker as their subject; it's gone — Goals
 * stands in, same default config: right side, enabled.)
 */
const store = () => useEditorStore.getState();

describe('openTool — the menu opens a tool where it actually lives', () => {
  beforeEach(() => {
    useEditorStore.setState({
      toolConfig: { ...DEFAULT_TOOL_CONFIG },
      activeTool: null, activeToolRight: null, tempTool: null,
      shelfOpen: false, navigatorOpen: false,
    });
  });

  it('a tool docked RIGHT opens in the right panel, not a window', () => {
    store().openTool('goals');
    expect(store().activeToolRight).toBe('goals');
    expect(store().tempTool).toBeNull();          // no floating window
    expect(store().shelfOpen).toBe(true);         // and the panel opens to show it
  });

  it('a tool docked LEFT opens in the left panel', () => {
    useEditorStore.setState({
      toolConfig: { ...store().toolConfig, goals: { side: 'left', enabled: true } },
    });
    store().openTool('goals');
    expect(store().activeTool).toBe('goals');
    expect(store().tempTool).toBeNull();
    expect(store().navigatorOpen).toBe(true);
  });

  it('...but a tool REMOVED from the sidebar floats a window, as Derek asked', () => {
    useEditorStore.setState({
      toolConfig: { ...store().toolConfig, goals: { side: 'right', enabled: false } },
    });
    store().openTool('goals');
    expect(store().tempTool).toBe('goals');       // centred window
    expect(store().activeToolRight).not.toBe('goals');
  });

  it('Analytics still always floats — it is too tall for a panel', () => {
    store().openTool('analytics');
    expect(store().tempTool).toBe('analytics');
  });

  it('the same verdict as the dock: openTool and toolConfigFor agree', async () => {
    const { toolConfigFor } = await import('./editorStore');
    const cfg = toolConfigFor(store().toolConfig, 'goals');
    store().openTool('goals');
    // If the dock says it's enabled on a side, the menu must dock it there.
    expect(cfg.enabled).toBe(true);
    expect(store().activeToolRight).toBe('goals');
  });
});

/**
 * v4.37, Derek: "I should not be able to have a window open twice."
 *
 * A tool lives in exactly ONE of: left slot, right slot, floating window,
 * fullscreen takeover. enterToolFullscreen already cleared the slots on the
 * way IN; these pin the other direction — no open path may create a second
 * instance while the takeover owns the tool, and an explicit slot placement
 * takes the tool OUT of fullscreen rather than duplicating it.
 */
describe('fullscreen ⇄ slots — a tool is never open twice', () => {
  beforeEach(() => {
    useEditorStore.setState({
      toolConfig: { ...DEFAULT_TOOL_CONFIG },
      activeTool: null, activeToolRight: null, tempTool: null,
      shelfOpen: false, navigatorOpen: false, fullscreenTool: null,
    });
  });

  it('opening the fullscreen tool again is satisfied by the takeover — no second copy', () => {
    useEditorStore.setState({ fullscreenTool: 'characters' });
    store().openTool('characters');
    expect(store().fullscreenTool).toBe('characters');
    expect(store().tempTool).toBeNull();
    expect(store().activeTool).toBeNull();
    expect(store().activeToolRight).toBeNull();
  });

  it('…including ALWAYS_FLOAT tools (Statistics), which bypass the dock lookup', () => {
    useEditorStore.setState({ fullscreenTool: 'analytics' });
    store().openTool('analytics');
    expect(store().tempTool).toBeNull();
    expect(store().fullscreenTool).toBe('analytics');
  });

  it('seating the fullscreen tool in a panel drops the takeover instead of duplicating', () => {
    useEditorStore.setState({ fullscreenTool: 'goals' });
    store().setActiveToolRight('goals');
    expect(store().activeToolRight).toBe('goals');
    expect(store().fullscreenTool).toBeNull();
  });

  it('floating the fullscreen tool as a window drops the takeover too', () => {
    useEditorStore.setState({ fullscreenTool: 'goals' });
    store().setTempTool('goals');
    expect(store().tempTool).toBe('goals');
    expect(store().fullscreenTool).toBeNull();
  });

  it('a different tool going fullscreen leaves other windows alone (single field)', () => {
    useEditorStore.setState({ activeToolRight: 'goals', fullscreenTool: null });
    store().enterToolFullscreen('characters');
    expect(store().fullscreenTool).toBe('characters');
    expect(store().activeToolRight).toBe('goals');   // unrelated window untouched
  });

  it('enterToolFullscreen clears every slot the tool itself held (the reverse direction)', () => {
    useEditorStore.setState({ activeToolRight: 'goals', tempTool: null });
    store().enterToolFullscreen('goals');
    expect(store().fullscreenTool).toBe('goals');
    expect(store().activeToolRight).toBeNull();
  });
});
