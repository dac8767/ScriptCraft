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

  it('tools with no fullscreen (Scrapbook) never take the fullscreen path', () => {
    useEditorStore.setState({ toolMode: { notebook: 'fullscreen' } });
    st().openTool('notebook');
    expect(st().fullscreenTool).toBeNull();
  });

  /** v5.21, Derek: "make the title page doc always in full screen" — every
   *  open routes to the takeover, whatever mode an old session remembered. */
  it('the Title Page ALWAYS opens fullscreen, ignoring any remembered mode', () => {
    useEditorStore.setState({ toolMode: { titlepage: 'floating' } });
    st().openTool('titlepage');
    expect(st().fullscreenTool).toBe('titlepage');
  });

  it('an already-fullscreen tool is not reopened on top of itself', () => {
    st().enterToolFullscreen('sticky');
    const before = { ...st() };
    st().openTool('sticky');
    expect(st().fullscreenTool).toBe('sticky');
    expect(st().activeToolRight).toBe(before.activeToolRight);
  });
});

/**
 * v4.84 REGRESSION — Derek: "when a window is closed and reopened, it always
 * appears inside the side panel... none of the windows are remembering."
 *
 * v4.81 wrote the memory correctly and then the dock-row handler overwrote it
 * with 'docked' on every open, so the commonest way to reopen a tool erased
 * the shape it was meant to restore. The row must READ the mode, never set it.
 * (ToolDock's openFromRow is the UI half; this pins the store contract it
 * depends on — nothing in an open path may write the mode.)
 */
describe('reopening never rewrites the remembered shape', () => {
  beforeEach(() => {
    useEditorStore.setState({
      toolMode: {}, activeTool: null, activeToolRight: null, tempTool: null, fullscreenTool: null,
    });
  });

  it('openTool leaves a floating tool floating', () => {
    st().setToolMode('sticky', 'floating');
    st().openTool('sticky');
    expect(st().toolMode.sticky).toBe('floating');
  });

  it('openTool leaves a fullscreen tool fullscreen', () => {
    st().setToolMode('sticky', 'fullscreen');
    st().openTool('sticky');
    expect(st().toolMode.sticky).toBe('fullscreen');
    expect(st().fullscreenTool).toBe('sticky');
  });

  it('closing a tool keeps its shape for next time', () => {
    st().setToolMode('sticky', 'floating');
    st().openTool('sticky');
    st().setActiveToolRight(null);            // the × on a floating window
    expect(st().toolMode.sticky).toBe('floating');
  });
});

/** v5.21, Derek: "show one tool window at a time. opening a second window
 *  closes the first." A window = the temp slot or a panel-slot tool in
 *  'floating' mode; docked tools and the fullscreen takeover are not
 *  windows. */
describe('v5.21: one floating window at a time', () => {
  beforeEach(() => {
    useEditorStore.setState({
      toolMode: {},
      activeTool: null,
      activeToolRight: null,
      tempTool: null,
      fullscreenTool: null,
      navigatorOpen: true,
      shelfOpen: true,
    });
  });

  it('opening a floating panel tool closes the temp window', () => {
    st().openTool('analytics');                 // ALWAYS_FLOAT → temp window
    expect(st().tempTool).toBe('analytics');
    st().setToolMode('sticky', 'floating');
    st().openTool('sticky');                    // slot window (right)
    expect(st().activeToolRight).toBe('sticky');
    expect(st().tempTool).toBeNull();           // analytics window closed
  });

  it('opening a temp window closes a floating slot window', () => {
    st().setToolMode('sticky', 'floating');
    st().openTool('sticky');
    expect(st().activeToolRight).toBe('sticky');
    st().openTool('analytics');
    expect(st().tempTool).toBe('analytics');
    expect(st().activeToolRight).toBeNull();    // sticky's window closed
  });

  it('drag-out (setToolMode floating on an open tool) closes the previous window', () => {
    st().openTool('fragments');                 // docked right — not a window
    st().openTool('analytics');                 // temp window
    expect(st().tempTool).toBe('analytics');
    st().setToolMode('fragments', 'floating');  // fragments becomes a window
    expect(st().tempTool).toBeNull();
    expect(st().activeToolRight).toBe('fragments');
  });

  /** v5.32, Derek: "opening the design window should not close any other
   *  window." Design is the tweak-alongside tool — exempt BOTH ways. */
  it('Design neither closes other windows nor is closed by them', () => {
    st().openTool('analytics');                 // temp window
    expect(st().tempTool).toBe('analytics');
    st().setToolMode('design', 'floating');
    st().openTool('design');                    // design opens…
    expect(st().tempTool).toBe('analytics');    // …and analytics survives
    st().setToolMode('sticky', 'floating');
    st().openTool('sticky');                    // another window opens…
    expect(st().activeToolRight).toBe('sticky');
    // …and the one-window rule still applies between NON-design floats
    expect(st().tempTool).toBeNull();
  });

  it('a DOCKED tool in the other panel is not a window and stays put', () => {
    st().openTool('fragments');                 // docked right
    st().setToolMode('sticky', 'floating');
    st().openTool('sticky');                    // window in the right slot
    expect(st().activeToolRight).toBe('sticky');
    // fragments lost its slot to sticky (same panel), but scenes docked left:
    st().openTool('scenes');
    expect(st().activeTool).toBe('scenes');
    expect(st().activeToolRight).toBe('sticky');  // the window survives a docked open
  });
});
