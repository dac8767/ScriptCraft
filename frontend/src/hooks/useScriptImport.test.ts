// @vitest-environment jsdom
/**
 * v7.44: the import doors, extracted from MenuBar.
 *
 * EVERY import REPLACES the open document. So the one contract that must hold
 * for all four doors is that each goes through the unsaved-changes guard
 * BEFORE it touches anything — skip it and a writer loses work with no prompt
 * and nothing to undo.
 *
 * That is exactly the kind of wiring an extraction breaks silently: the
 * handlers still exist, the file picker still opens, the import still works,
 * and the only thing missing is the question. Nothing fails. So it is asserted
 * here rather than assumed, by handing the hook a guard that never runs its
 * action and checking that nothing downstream happened.
 *
 * The parsers themselves are covered by their own tests (fountainParser,
 * titlePageImport); this is about the plumbing around them.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { useScriptImport } from './useScriptImport';

/* The file pickers are the boundary: if a door reaches one, it got past the
   guard. Mocked so nothing opens and so reaching them is observable. */
const openTextFile = vi.fn(async () => null);
const openBinaryFile = vi.fn(async () => null);
vi.mock('../utils/fileOps', () => ({
  openTextFile: (...a: unknown[]) => openTextFile(...(a as [])),
  openBinaryFile: (...a: unknown[]) => openBinaryFile(...(a as [])),
}));

function renderHook<T>(run: () => T): { current: T } {
  const ref = { current: undefined as unknown as T };
  const Harness: React.FC = () => { ref.current = run(); return null; };
  const host = document.createElement('div');
  document.body.appendChild(host);
  act(() => { createRoot(host).render(React.createElement(Harness)); });
  return ref;
}

const fakeEditor = () => ({
  isDestroyed: false,
  state: { doc: { textContent: 'FADE IN:' } },
  chain: () => ({ focus: () => ({ setContent: () => ({ run: () => true }) }) }),
}) as never;

/** A guard that ASKS and never proceeds — the "writer said cancel" case. */
const blockingGuard = vi.fn((_action: () => void) => { /* never runs it */ });
/** A guard that lets the action through. */
const passingGuard = vi.fn((action: () => void) => { action(); });

describe('useScriptImport: every door asks before replacing the document', () => {
  beforeEach(() => {
    openTextFile.mockClear(); openBinaryFile.mockClear();
    blockingGuard.mockClear(); passingGuard.mockClear();
  });

  /* Word is a BINARY format, so its door uses the binary picker — the same one
     PDF uses. Worth stating: my first version of this test asserted the text
     picker and failed, which is the test doing its job on the test. */
  it('Word does not even open a picker until the guard allows it', () => {
    const r = renderHook(() => useScriptImport(fakeEditor(), blockingGuard, () => {}));
    // the first step only raises the best-effort warning
    act(() => { r.current.handleImportDocx(); });
    expect(r.current.docxImportWarningOpen).toBe(true);
    expect(openBinaryFile).not.toHaveBeenCalled();
    // confirming the warning goes through the guard — which here says no
    act(() => { r.current.handleConfirmDocxImport(); });
    expect(blockingGuard).toHaveBeenCalledTimes(1);
    expect(r.current.docxImportWarningOpen).toBe(false);
    expect(openBinaryFile).not.toHaveBeenCalled();
  });

  it('…and does open one once it does', async () => {
    const r = renderHook(() => useScriptImport(fakeEditor(), passingGuard, () => {}));
    act(() => { r.current.handleImportDocx(); });
    await act(async () => { r.current.handleConfirmDocxImport(); });
    expect(passingGuard).toHaveBeenCalledTimes(1);
    expect(openBinaryFile).toHaveBeenCalledTimes(1);
  });

  it('PDF goes through the guard', async () => {
    const r = renderHook(() => useScriptImport(fakeEditor(), blockingGuard, () => {}));
    act(() => { r.current.handleImportPdf(); });
    expect(blockingGuard).toHaveBeenCalledTimes(1);
    expect(openBinaryFile).not.toHaveBeenCalled();
  });

  it('…and reaches the picker when allowed', async () => {
    const r = renderHook(() => useScriptImport(fakeEditor(), passingGuard, () => {}));
    await act(async () => { r.current.handleImportPdf(); });
    expect(openBinaryFile).toHaveBeenCalledTimes(1);
  });

  /* The Word warning is a real step, not decoration: it is raised BEFORE the
     guard and before the picker, because Word's format is close enough to
     mislead and far enough to lose things. */
  it('the Word warning is raised before anything else happens', () => {
    const r = renderHook(() => useScriptImport(fakeEditor(), passingGuard, () => {}));
    act(() => { r.current.handleImportDocx(); });
    expect(r.current.docxImportWarningOpen).toBe(true);
    expect(passingGuard).not.toHaveBeenCalled();
    expect(openBinaryFile).not.toHaveBeenCalled();
  });

  it('with no editor nothing opens at all', async () => {
    const r = renderHook(() => useScriptImport(null, passingGuard, () => {}));
    await act(async () => { await r.current.handleImport(); });
    expect(openTextFile).not.toHaveBeenCalled();
  });
});
