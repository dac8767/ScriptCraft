// @vitest-environment jsdom
/**
 * v7.43: the save guard, extracted from MenuBar.
 *
 * The only part of this worth a test is the part that decides whether to ASK
 * before throwing work away, because getting it wrong is silent and expensive:
 * too eager and every New Script nags, too lax and edits vanish.
 *
 * "Unsaved" is NOT "the document has text". On a script that has been saved it
 * means the 30-second autosave has not caught up — status unsaved, saving or
 * error — and resetting the editor inside that window discards real edits with
 * no prompt. On a script that has never been saved there is no status to read,
 * so the question becomes whether there is anything worth keeping at all.
 *
 * The hook reads the stores directly, so these drive it through a real render
 * rather than reasoning about the source.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { useSaveGuard } from './useSaveGuard';
import { useEditorStore } from '../stores/editorStore';
import { useProjectStore } from '../stores/projectStore';

/** The two things the guard reads off the editor. */
const fakeEditor = (text: string) => ({
  isDestroyed: false,
  state: { doc: { textContent: text } },
  getJSON: () => ({ type: 'doc', content: [] }),
}) as never;

/* A minimal renderHook. @testing-library/react is not a dependency here — the
   repo's other hook/component tests drive react-dom directly (see
   design/applyFlow.test.tsx), so this follows that. */
function renderHook<T>(run: () => T): { current: T } {
  const ref = { current: undefined as unknown as T };
  const Harness: React.FC = () => { ref.current = run(); return null; };
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => { root.render(React.createElement(Harness)); });
  return ref;
}

const saved = (id: string | null, project: unknown) =>
  useProjectStore.setState({ currentScriptId: id, currentProject: project } as never);

describe('useSaveGuard: when it asks before discarding', () => {
  beforeEach(() => {
    saved(null, null);
    useEditorStore.setState({ saveStatus: 'saved' } as never);
  });

  it('a never-saved EMPTY document just runs — nothing to lose', () => {
    const result = renderHook(() => useSaveGuard(fakeEditor('   ')));
    const action = vi.fn();
    act(() => { result.current.confirmOrRun(action); });
    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.discardConfirmOpen).toBe(false);
  });

  it('a never-saved document WITH text asks first', () => {
    const result = renderHook(() => useSaveGuard(fakeEditor('FADE IN:')));
    const action = vi.fn();
    act(() => { result.current.confirmOrRun(action); });
    expect(action).not.toHaveBeenCalled();
    expect(result.current.discardConfirmOpen).toBe(true);
  });

  /* THE WINDOW THAT MATTERS. The script is saved, so there is somewhere for
     the work to go — but autosave has not been there yet. Text content says
     nothing here; only the status does. */
  it.each(['unsaved', 'saving', 'error'] as const)(
    'a saved script asks while autosave is behind (status=%s)', (status) => {
      saved('s1', { id: 'p1', name: 'P' });
      useEditorStore.setState({ saveStatus: status } as never);
      const result = renderHook(() => useSaveGuard(fakeEditor('FADE IN:')));
      const action = vi.fn();
      act(() => { result.current.confirmOrRun(action); });
      expect(action).not.toHaveBeenCalled();
      expect(result.current.discardConfirmOpen).toBe(true);
    });

  it('…and does not ask once autosave has caught up', () => {
    saved('s1', { id: 'p1', name: 'P' });
    useEditorStore.setState({ saveStatus: 'saved' } as never);
    const result = renderHook(() => useSaveGuard(fakeEditor('FADE IN:')));
    const action = vi.fn();
    act(() => { result.current.confirmOrRun(action); });
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('with no editor at all there is nothing to lose', () => {
    const result = renderHook(() => useSaveGuard(null));
    const action = vi.fn();
    act(() => { result.current.confirmOrRun(action); });
    expect(action).toHaveBeenCalledTimes(1);
  });
});

describe('useSaveGuard: what the confirm buttons do', () => {
  beforeEach(() => {
    saved(null, null);
    useEditorStore.setState({ saveStatus: 'unsaved' } as never);
  });

  it('Discard runs the pending action and closes', () => {
    const result = renderHook(() => useSaveGuard(fakeEditor('FADE IN:')));
    const action = vi.fn();
    act(() => { result.current.confirmOrRun(action); });
    act(() => { result.current.handleDiscardConfirmDiscard(); });
    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.discardConfirmOpen).toBe(false);
  });

  it('Cancel closes and runs NOTHING — the action is dropped, not deferred', () => {
    const result = renderHook(() => useSaveGuard(fakeEditor('FADE IN:')));
    const action = vi.fn();
    act(() => { result.current.confirmOrRun(action); });
    act(() => { result.current.handleDiscardConfirmCancel(); });
    expect(action).not.toHaveBeenCalled();
    expect(result.current.discardConfirmOpen).toBe(false);
    // and it must not fire on a LATER confirm either
    act(() => { result.current.handleDiscardConfirmDiscard(); });
    expect(action).not.toHaveBeenCalled();
  });

  /* Save with nowhere to save TO cannot run the action inline — it has to
     survive the Save As dialog, which is what postSaveAction is for. Keeping
     it in local state here would drop it the moment the dialog took over. */
  it('Save with no script yet hands the action to the store and opens Save As', async () => {
    const result = renderHook(() => useSaveGuard(fakeEditor('FADE IN:')));
    const action = vi.fn();
    act(() => { result.current.confirmOrRun(action); });
    await act(async () => { await result.current.handleDiscardConfirmSave(); });
    expect(useEditorStore.getState().saveAsOpen).toBe(true);
    expect(typeof useEditorStore.getState().postSaveAction).toBe('function');
    expect(action).not.toHaveBeenCalled();   // it runs after the save, not now
  });
});
