// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore, DEFAULT_TOOL_CONFIG } from './editorStore';

/**
 * The menu and the sidebar must agree about where a tool lives.
 *
 * They didn't: ToolDock asked toolConfigFor() (which defaults unknown tools to the
 * right panel), while openTool did its own lookup and floated anything without a
 * DEFAULT_TOOL_CONFIG entry. So the Dev Picker sat in the right dock, opened INTO
 * the dock when you clicked its tab, and floated a centred window when you picked it
 * from the menu. Same tool, two answers.
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
    store().openTool('devpicker');
    expect(store().activeToolRight).toBe('devpicker');
    expect(store().tempTool).toBeNull();          // no floating window
    expect(store().shelfOpen).toBe(true);         // and the panel opens to show it
  });

  it('a tool docked LEFT opens in the left panel', () => {
    useEditorStore.setState({
      toolConfig: { ...store().toolConfig, devpicker: { side: 'left', enabled: true } },
    });
    store().openTool('devpicker');
    expect(store().activeTool).toBe('devpicker');
    expect(store().tempTool).toBeNull();
    expect(store().navigatorOpen).toBe(true);
  });

  it('...but a tool REMOVED from the sidebar floats a window, as Derek asked', () => {
    useEditorStore.setState({
      toolConfig: { ...store().toolConfig, devpicker: { side: 'right', enabled: false } },
    });
    store().openTool('devpicker');
    expect(store().tempTool).toBe('devpicker');   // centred window
    expect(store().activeToolRight).not.toBe('devpicker');
  });

  it('Analytics still always floats — it is too tall for a panel', () => {
    store().openTool('analytics');
    expect(store().tempTool).toBe('analytics');
  });

  it('the same verdict as the dock: openTool and toolConfigFor agree', async () => {
    const { toolConfigFor } = await import('./editorStore');
    const cfg = toolConfigFor(store().toolConfig, 'devpicker');
    store().openTool('devpicker');
    // If the dock says it's enabled on a side, the menu must dock it there.
    expect(cfg.enabled).toBe(true);
    expect(store().activeToolRight).toBe('devpicker');
  });
});
