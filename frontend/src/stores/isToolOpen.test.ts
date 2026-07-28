// @vitest-environment jsdom
/**
 * isToolOpen / closeTool — ONE answer to "is this tool open?" (v5.03).
 *
 * Derek: "clicking on the tool name in the side panel should close it,
 * including if it is in full screen mode. currently it will not close by
 * clicking the side panel item if it is in full screen."
 *
 * Root cause: enterToolFullscreen CLEARS the tool's panel slot and raises a
 * separate `fullscreenTool` field. The tool dock's own close test was
 * `activeId === t.id` — this side's panel slot — so a fullscreen tool read as
 * CLOSED. The click fell through to the open path, re-entered the fullscreen
 * it was already in, and nothing happened. A live-looking control writing into
 * the void, which is the one thing this codebase treats as unforgivable.
 *
 * The fix was to stop having two definitions. toggleTool already knew the
 * right one; it is lifted here so the dock row, the collapsed icon rail, the
 * ribbon and the menus all ask the same question. These tests pin the answer,
 * with the fullscreen case first because that is the one that was wrong.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from './editorStore';

const store = () => useEditorStore.getState();

beforeEach(() => {
  useEditorStore.setState({
    activeTool: null, activeToolRight: null, tempTool: null, fullscreenTool: null,
    navigatorOpen: true, shelfOpen: true,
  });
});

describe('isToolOpen', () => {
  it('a FULLSCREEN tool is open — the case the dock used to miss', () => {
    useEditorStore.setState({ fullscreenTool: 'scenes' });
    expect(store().isToolOpen('scenes')).toBe(true);
  });

  it('and enterToolFullscreen leaves it that way, with the panel slot cleared', () => {
    useEditorStore.setState({ activeTool: 'scenes' });
    store().enterToolFullscreen('scenes');
    // This pair is the whole bug: the slot the dock was checking is now null…
    expect(store().activeTool).toBeNull();
    // …while the tool is unmistakably on screen.
    expect(store().isToolOpen('scenes')).toBe(true);
  });

  it('is true for either panel slot, and for the temp (no-panel) slot', () => {
    useEditorStore.setState({ activeTool: 'scenes' });
    expect(store().isToolOpen('scenes')).toBe(true);
    useEditorStore.setState({ activeTool: null, activeToolRight: 'goals' });
    expect(store().isToolOpen('goals')).toBe(true);
    useEditorStore.setState({ activeToolRight: null, tempTool: 'goals' });
    expect(store().isToolOpen('goals')).toBe(true);
  });

  it('a tool sitting in a HIDDEN panel is NOT open (v4.86)', () => {
    useEditorStore.setState({ activeTool: 'scenes', navigatorOpen: false });
    expect(store().isToolOpen('scenes')).toBe(false);
    useEditorStore.setState({ activeTool: null, activeToolRight: 'goals', shelfOpen: false });
    expect(store().isToolOpen('goals')).toBe(false);
  });

  it('is false for a tool that is nowhere', () => {
    expect(store().isToolOpen('scenes')).toBe(false);
  });
});

describe('closeTool', () => {
  it('closes a FULLSCREEN tool', () => {
    useEditorStore.setState({ fullscreenTool: 'scenes' });
    store().closeTool('scenes');
    expect(store().fullscreenTool).toBeNull();
    expect(store().isToolOpen('scenes')).toBe(false);
  });

  it('clears every slot at once, so a tool cannot survive in a second one', () => {
    useEditorStore.setState({ activeTool: 'scenes', activeToolRight: 'scenes', tempTool: 'scenes', fullscreenTool: 'scenes' });
    store().closeTool('scenes');
    expect([store().activeTool, store().activeToolRight, store().tempTool, store().fullscreenTool])
      .toEqual([null, null, null, null]);
  });

  it('leaves other tools alone', () => {
    useEditorStore.setState({ activeTool: 'scenes', activeToolRight: 'goals' });
    store().closeTool('scenes');
    expect(store().activeToolRight).toBe('goals');
  });
});

describe('toggleTool still agrees with them', () => {
  it('toggling a fullscreen tool closes it rather than reopening it', () => {
    useEditorStore.setState({ fullscreenTool: 'scenes' });
    store().toggleTool('scenes');
    expect(store().isToolOpen('scenes')).toBe(false);
  });

  it('toggling a closed tool opens it', () => {
    store().toggleTool('scenes');
    expect(store().isToolOpen('scenes')).toBe(true);
  });
});
