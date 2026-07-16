// @vitest-environment jsdom
/**
 * Smart undo routing (v2.36) — closing a beat then hitting Undo (toolbar,
 * Edit menu, or Cmd+Z) restores the beat; when the script was edited more
 * recently, the editor's own history runs instead.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore, smartUndo, smartRedo } from './editorStore';

const S = () => useEditorStore.getState();

beforeEach(() => {
  S().setBeats([]);
  S().setBeatColumns([]);
  useEditorStore.setState({ _beatUndoStack: [], _beatRedoStack: [], canBeatUndo: false, canBeatRedo: false, lastBeatEditAt: 0, lastDocEditAt: 0, _beatSnapshotTime: 0 } as never);
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
