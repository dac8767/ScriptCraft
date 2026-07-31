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

  /** v5.21 made the Title Page fullscreen-only; v5.67 retired the tool into
   *  the Pages window's Title Page TAB. The old id must still open SOMETHING
   *  sensible — Pages, not a takeover — even when a stale session remembered
   *  a mode for it. */
  it("the retired 'titlepage' id opens Pages (no takeover), whatever mode it remembered", () => {
    useEditorStore.setState({ toolMode: { titlepage: 'floating' }, pagesTab: 'script' });
    st().openTool('titlepage');
    expect(st().fullscreenTool).toBeNull();
    expect(st().activeTool).toBe('pages');
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

/** v5.37, Derek's queue item 2: "one popped-out-or-fullscreen window at a
 *  time — opening a second closes the first; docked panels unaffected."
 *  The fullscreen takeover joined the one-window rule in BOTH directions;
 *  Design stays exempt both ways (v5.32). */
describe('v5.37: fullscreen joins the one-window rule', () => {
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

  it('opening a floating slot window lowers the takeover', () => {
    st().enterToolFullscreen('scenes');
    expect(st().fullscreenTool).toBe('scenes');
    st().setToolMode('sticky', 'floating');
    st().openTool('sticky');
    expect(st().fullscreenTool).toBeNull();
    expect(st().activeToolRight).toBe('sticky');
  });

  it('opening a temp window lowers the takeover', () => {
    st().enterToolFullscreen('scenes');
    st().openTool('analytics');
    expect(st().fullscreenTool).toBeNull();
    expect(st().tempTool).toBe('analytics');
  });

  it('entering fullscreen closes floating windows', () => {
    st().openTool('analytics');
    expect(st().tempTool).toBe('analytics');
    st().enterToolFullscreen('scenes');
    expect(st().fullscreenTool).toBe('scenes');
    expect(st().tempTool).toBeNull();
  });

  it('the remembered-fullscreen open path closes floats too', () => {
    st().openTool('analytics');
    useEditorStore.setState({ toolMode: { scenes: 'fullscreen' } });
    st().openTool('scenes');
    expect(st().fullscreenTool).toBe('scenes');
    expect(st().tempTool).toBeNull();
  });

  it('a DOCKED open still leaves the takeover alone', () => {
    st().enterToolFullscreen('scenes');
    st().openTool('fragments');                 // docked right — not a window
    expect(st().fullscreenTool).toBe('scenes');
    expect(st().activeToolRight).toBe('fragments');
  });

  it('Design neither lowers the takeover nor is closed by it', () => {
    // v5.46: Design opens its OWN independent window (designPanelOpen) —
    // never a panel/temp slot — so nothing can steal its seat and it
    // disturbs nothing on its way in.
    st().enterToolFullscreen('scenes');
    st().openTool('design');
    expect(st().fullscreenTool).toBe('scenes'); // takeover survives
    expect(st().designPanelOpen).toBe(true);    // design is up…
    expect(st().activeTool).not.toBe('design'); // …and holds NO slot
    expect(st().activeToolRight).not.toBe('design');
    expect(st().tempTool).not.toBe('design');
    st().setFullscreenTool(null);
    st().enterToolFullscreen('scenes');         // re-entering fullscreen…
    expect(st().designPanelOpen).toBe(true);    // …keeps the Design window
    // the row/menu toggle contract rides isToolOpen/closeTool:
    expect(st().isToolOpen('design')).toBe(true);
    st().closeTool('design');
    expect(st().designPanelOpen).toBe(false);
  });
});
