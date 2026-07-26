// @vitest-environment jsdom
/**
 * v4.81, Derek: "opening any tool should open it in the mode that it was last
 * used: in side panel, popped out, or full screen." toolMode is that memory,
 * and openTool is where it has to be honored — these pin each shape, plus the
 * two invariants that keep a tool from being open twice.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from './editorStore';

const st = () => useEditorStore.getState();

describe('remembered window shape', () => {
  beforeEach(() => {
    useEditorStore.setState({
      toolMode: {},
      activeTool: null,
      activeToolRight: null,
      tempTool: null,
      fullscreenTool: null,
    });
  });

  it('a tool last used FULLSCREEN reopens fullscreen', () => {
    st().enterToolFullscreen('sticky');
    expect(st().toolMode.sticky).toBe('fullscreen');
    // leave it (close the takeover) — the SHAPE is remembered
    st().setFullscreenTool(null);
    st().openTool('sticky');
    expect(st().fullscreenTool).toBe('sticky');
  });

  it('reopening fullscreen clears the panel slots — never open twice', () => {
    useEditorStore.setState({ toolMode: { sticky: 'fullscreen' }, activeToolRight: 'sticky' });
    st().openTool('sticky');
    expect(st().fullscreenTool).toBe('sticky');
    expect(st().activeToolRight).toBeNull();
  });

  it('the shrink button path (floating) beats the old fullscreen memory', () => {
    st().enterToolFullscreen('sticky');
    // what ToolDock's onMinimize does:
    st().setFullscreenTool(null);
    st().setToolMode('sticky', 'floating');
    st().openTool('sticky');
    expect(st().fullscreenTool).toBeNull();
    expect(st().toolMode.sticky).toBe('floating');
  });

  it('a docked tool still opens docked', () => {
    st().setToolMode('sticky', 'docked');
    st().openTool('sticky');
    expect(st().fullscreenTool).toBeNull();
    expect(st().activeToolRight).toBe('sticky');
  });

  it('tools with no fullscreen (Scrapbook, Title Page) never take the fullscreen path', () => {
    useEditorStore.setState({ toolMode: { titlepage: 'fullscreen' } });
    st().openTool('titlepage');
    expect(st().fullscreenTool).toBeNull();
  });

  it('an already-fullscreen tool is not reopened on top of itself', () => {
    st().enterToolFullscreen('sticky');
    const before = { ...st() };
    st().openTool('sticky');
    expect(st().fullscreenTool).toBe('sticky');
    expect(st().activeToolRight).toBe(before.activeToolRight);
  });
});
