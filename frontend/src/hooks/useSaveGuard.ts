/**
 * useSaveGuard — Save, Save As, and the question asked before work is thrown
 * away.
 *
 * v7.43: lifted out of MenuBar verbatim. It is one unit because the three
 * parts only make sense together: Save decides whether it can write or must
 * ask for a name, the guard decides whether a destructive action needs to ask
 * first, and the confirm's Save button routes back through Save — including
 * the case where there is nothing to save INTO yet, which is why the pending
 * action is handed to the store's postSaveAction rather than kept here.
 *
 * WHY IT READS THE STORE ITSELF. Every dependency except the editor comes from
 * the store, so passing them in would mean MenuBar subscribing to state only
 * to hand it straight back. `editor` is the one thing the store does not own.
 *
 * TWO PIECES OF HISTORY THAT MUST NOT BE RE-LEARNED, both preserved verbatim:
 *
 *  · buildSaveContent DELEGATES to composeSaveContent. It used to be a
 *    hand-forked partial copy of the extras list — no _shelf, no
 *    _outlineTabs/_outlineStash, no spell/grammar prefs — so a manual
 *    File ▸ Save stripped the Scrapbook and Outline tabs from the file until
 *    the next autosave healed it. The extras list lives in exactly one place.
 *  · "Unsaved" is not "the document has text". On a saved script it means the
 *    30-second autosave has not caught up (status unsaved/saving/error);
 *    resetting the editor inside that window silently discards real edits.
 */
import { useState, useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import { useEditorStore } from '../stores/editorStore';
import { useProjectStore } from '../stores/projectStore';
import { composeSaveContent } from '../utils/screenplaySaveContent';
import { scriptApi } from '../services/scriptApi';
import { flashSaved } from '../utils/saveFlash';
import { mirrorSave } from '../services/saveLocations';
import { reportSaveError } from '../stores/saveErrorStore';

export function useSaveGuard(editor: Editor | null) {
  // The open script lives in the PROJECT store, not the editor store — the
  // two are separate and Save needs both.
  const currentProject = useProjectStore((s) => s.currentProject);
  const currentScriptId = useProjectStore((s) => s.currentScriptId);
  const documentTitle = useEditorStore((s) => s.documentTitle);
  const setSaveAsOpen = useEditorStore((s) => s.setSaveAsOpen);
  const setPostSaveAction = useEditorStore((s) => s.setPostSaveAction);

  // Build a saveable content object: editor JSON + store metadata at top level.
  // v4.24: delegates to composeSaveContent — this used to be a hand-forked
  // PARTIAL copy of the extras list (no _shelf, no _outlineTabs/_outlineStash,
  // no spell/grammar prefs), so a manual File > Save stripped the Scrapbook
  // and Outline tabs from the file until the next autosave healed it. The
  // extras list lives in exactly one place now; never fork it again.
  const buildSaveContent = useCallback((): Record<string, unknown> | undefined => {
    if (!editor || editor.isDestroyed) return undefined;
    return composeSaveContent(editor.getJSON());
  }, [editor]);

  // ── Save current editor content to backend ──
  const handleSave = useCallback(async () => {
    if (!editor) return;
    /*
     * v1.16 — Save behaves the way Save behaves everywhere else.
     *
     * Never saved before  -> open Save As, so you can name it.
     * Saved before        -> just save, and say so briefly. No dialog, no questions.
     */
    if (!currentProject || !currentScriptId) {
      setSaveAsOpen(true);
      return;
    }
    const { setSaveStatus } = useEditorStore.getState();
    setSaveStatus('saving');
    try {
      const content = buildSaveContent();
      await scriptApi.saveScript(currentProject.id, currentScriptId, { content });
      // v7.61: 'manual' — this is the one path the writer asked for, and the
      // footer says so.
      useEditorStore.getState().markSaved('manual', currentScriptId);
      /* v7.14, Derek: this confirmation belongs beside the Save button, not in
         the bottom-right toast corner — utils/saveFlash puts it in the Quick
         Access bar. Failures still toast: those you DO need to read. */
      flashSaved();
      if (content) {
        void mirrorSave({
          projectId: currentProject.id,
          scriptId: currentScriptId,
          projectName: currentProject.name,
          title: documentTitle || 'Untitled',
          content,
        });
      }
    } catch (err) {
      console.error('Save failed:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setSaveStatus('error', msg);
      // AuthGate / QuotaExceededDialog already surfaced handled errors (401,
      // 402, 403 unverified) — reportSaveError skips them.  Other failures
      // get the blocking modal so the user can't miss them.
      reportSaveError(err, 'manual-save');
    }
  }, [editor, currentProject, currentScriptId, buildSaveContent, setSaveAsOpen, documentTitle]);

  /** Save As: always opens the destination/project/filename picker, even when
   *  the current document is already saved. Use this to fork a local script
   *  to cloud (or vice versa) or to write a copy under a different name. */
  const handleSaveAs = useCallback(() => {
    if (!editor) return;
    setSaveAsOpen(true);
  }, [editor, setSaveAsOpen]);

  // ── Unsaved-changes confirmation before New / Import ──
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  /** Returns true if the editor has unsaved changes worth prompting about.
   *  - If never saved to a project: true when editor has any meaningful text.
   *  - If saved to a project: true when auto-save hasn't caught up yet
   *    (saveStatus is 'unsaved', 'saving', or 'error'). The 30s auto-save
   *    interval leaves a window where edits exist only in memory; resetting
   *    the editor in that window would silently discard them. */
  const editorHasUnsavedChanges = useCallback((): boolean => {
    if (!editor) return false;
    if (currentProject && currentScriptId) {
      const status = useEditorStore.getState().saveStatus;
      return status === 'unsaved' || status === 'saving' || status === 'error';
    }
    // Never-saved document — prompt only if there's real content
    const text = editor.state.doc.textContent.trim();
    return text.length > 0;
  }, [editor, currentProject, currentScriptId]);

  const confirmOrRun = useCallback((action: () => void) => {
    if (editorHasUnsavedChanges()) {
      setPendingAction(() => action);
      setDiscardConfirmOpen(true);
    } else {
      action();
    }
  }, [editorHasUnsavedChanges]);

  const handleDiscardConfirmSave = useCallback(async () => {
    setDiscardConfirmOpen(false);
    if (!currentProject || !currentScriptId) {
      // No project yet — open save-as dialog; the pending action will run
      // after save-as completes (via postSaveAction in the store).
      if (pendingAction) setPostSaveAction(pendingAction);
      setPendingAction(null);
      setSaveAsOpen(true);
      return;
    }
    // Existing project — save inline, then run pending action
    await handleSave();
    pendingAction?.();
    setPendingAction(null);
  }, [handleSave, pendingAction, currentProject, currentScriptId, setSaveAsOpen, setPostSaveAction]);

  const handleDiscardConfirmDiscard = useCallback(() => {
    setDiscardConfirmOpen(false);
    pendingAction?.();
    setPendingAction(null);
  }, [pendingAction]);

  const handleDiscardConfirmCancel = useCallback(() => {
    setDiscardConfirmOpen(false);
    setPendingAction(null);
  }, []);

  return {
    buildSaveContent,
    handleSave,
    handleSaveAs,
    /** Run `action`, asking first if it would throw away unsaved work. */
    confirmOrRun,
    discardConfirmOpen,
    handleDiscardConfirmSave,
    handleDiscardConfirmDiscard,
    handleDiscardConfirmCancel,
  };
}
