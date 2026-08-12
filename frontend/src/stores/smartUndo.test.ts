// @vitest-environment jsdom
/**
 * Smart undo routing (v2.36) — closing a beat then hitting Undo (toolbar,
 * Edit menu, or Cmd+Z) restores the beat; when the script was edited more
 * recently, the editor's own history runs instead.
 *
 * v6.77 adds the third lane: window actions (Reset helper text, the
 * Customize resets…) pushed via utils/majorChange. Derek: "using Undo
 * button or ctrl+Z / cmd+Z should undo changes made in windows as well."
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore, smartUndo, smartRedo } from './editorStore';
import { useWindowUndoStore } from './windowUndoStore';

const S = () => useEditorStore.getState();
const W = () => useWindowUndoStore.getState();

beforeEach(() => {
  S().setBeats([]);
  S().setBeatColumns([]);
  useEditorStore.setState({ _beatUndoStack: [], _beatRedoStack: [], canBeatUndo: false, canBeatRedo: false, lastBeatEditAt: 0, lastDocEditAt: 0, _beatSnapshotTime: 0 } as never);
  useWindowUndoStore.setState({ undoStack: [], redoStack: [] });
});

describe('smartUndo', () => {
  it('restores a just-deleted beat when the beat edit is the freshest change', () => {
    const col = S().addBeatColumn('Act I');
    const id = S().addBeat('Opening', col);
    S().deleteBeat(id);
    expect(S().beats).toHaveLength(0);
    expect(S().lastBeatEditAt).toBeGreaterThanOrEqual(S().lastDocEditAt);

    smartUndo(null);                                   // no editor needed
    expect(S().beats.map((b) => b.title)).toEqual(['Opening']);

    smartRedo(null);                                   // and forward again
    expect(S().beats).toHaveLength(0);
  });

  it('routes to the editor when the script was edited more recently', () => {
    const col = S().addBeatColumn('Act I');
    const id = S().addBeat('Opening', col);
    S().deleteBeat(id);
    S().noteDocEdit();                                 // script typed AFTER the delete
    let editorUndoRan = false;
    const fakeEditor = { chain: () => ({ focus: () => ({ undo: () => ({ run: () => { editorUndoRan = true; } }) }) }) };
    smartUndo(fakeEditor as never);
    expect(editorUndoRan).toBe(true);
    expect(S().beats).toHaveLength(0);                 // beats untouched
  });
});

describe('smartUndo — the window-action lane (v6.77)', () => {
  it('undoes a window action when it is the newest change, and redoes it', () => {
    let state = 'reset';                               // the "destroyed" state
    W().push('Reset helper text', () => { state = 'restored'; }, () => { state = 'reset'; });

    smartUndo(null);                                   // Derek's exact scenario: no editor focus
    expect(state).toBe('restored');
    expect(W().undoStack).toHaveLength(0);
    expect(W().redoStack).toHaveLength(1);

    smartRedo(null);
    expect(state).toBe('reset');
    expect(W().undoStack).toHaveLength(1);
  });

  it('routes to the editor when the script was edited after the window action', () => {
    let restored = false;
    W().push('Reset helper text', () => { restored = true; }, () => {});
    S().noteDocEdit();                                 // typing came AFTER the reset
    let editorUndoRan = false;
    const fakeEditor = { chain: () => ({ focus: () => ({ undo: () => ({ run: () => { editorUndoRan = true; } }) }) }) };
    smartUndo(fakeEditor as never);
    expect(editorUndoRan).toBe(true);
    expect(restored).toBe(false);                      // the window entry stays put
    expect(W().undoStack).toHaveLength(1);
  });

  it('a newer window action outranks an older beat edit', () => {
    const col = S().addBeatColumn('Act I');
    const id = S().addBeat('Opening', col);
    S().deleteBeat(id);                                // beat lane armed…
    let restored = false;
    W().push('Reset all design settings', () => { restored = true; }, () => {});
    useWindowUndoStore.setState((s) => ({              // …but the window act is NEWER
      undoStack: [{ ...s.undoStack[0], at: S().lastBeatEditAt + 1 }],
    }));
    smartUndo(null);
    expect(restored).toBe(true);
    expect(S().beats).toHaveLength(0);                 // the beat undo did NOT run
  });

  it('a fresh action clears the redo lane, like every editor', () => {
    W().push('A', () => {}, () => {});
    smartUndo(null);
    expect(W().redoStack).toHaveLength(1);
    W().push('B', () => {}, () => {});
    expect(W().redoStack).toHaveLength(0);
  });
});
