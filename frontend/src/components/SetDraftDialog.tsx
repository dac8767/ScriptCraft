import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { useEditorStore } from '../stores/editorStore';
import { useProjectStore } from '../stores/projectStore';
import { useSettingsStore } from '../stores/settingsStore';
import { writeTitlePageDraftLine } from '../utils/titlePageDraftLine';
import { api } from '../services/api';
import { composeSaveContent } from '../utils/screenplaySaveContent';
import { showToast } from './Toast';
import { Modal } from './Modal';

/* ─────────────────────────────────────────────────────────────────────────
   Set Draft Number (Edit → Set Draft Number…)

   Sets the document's draft label ("First Draft", "Second Draft", …). Feeds:
   - the Save As dialog's Draft autofill
   - the Title Page draft line (rebuilt in place, date and all)
   The label is saved inside the document (_draftLabel).
   ───────────────────────────────────────────────────────────────────────── */

/**
 * Set the draft label everywhere it lives: the editor store (persisted as
 * _draftLabel on save) and the Title Page draft line, rebuilt in place by the
 * one writer in utils/titlePageDraftLine ("First Draft - 2026-07-10" →
 * "Second Draft - 8/16/2026", the date in the Settings format).
 * Shared by the Production dialog and the Settings mirror.
 */
export function applyDraftNumber(
  editor: Editor | null,
  finalLabel: string,
  opts?: { toast?: boolean },   // v1.34: silent for background syncs (Save dialog)
): void {
  /* v6.80, Derek: "automatically create a snapshot when the draft number is
     changed. label it as the previous draft name." The payload is composed
     SYNCHRONOUSLY, before the label and the title page change below — the
     snapshot is the old draft exactly as it stood, its own name still on
     its title page. Persisting is async and must never block or fail the
     draft change itself. */
  const prevLabel = useEditorStore.getState().draftLabel.trim();
  if (prevLabel && prevLabel !== finalLabel && editor && !editor.isDestroyed) {
    const ps = useProjectStore.getState();
    const { currentProject, currentScriptId } = ps;
    if (currentProject && currentScriptId) {
      const content = composeSaveContent(editor.getJSON());
      void (async () => {
        try {
          await api.saveScript(currentProject.id, currentScriptId, { content });
          await api.checkin(currentProject.id, prevLabel);
          ps.bumpVersionsTick();   // an open Snapshots window shows it right away
          showToast(`Snapshot “${prevLabel}” saved`, 'success');
        } catch (err) {
          showToast(`Could not snapshot “${prevLabel}”: ${err instanceof Error ? err.message : 'unknown error'}`, 'error');
        }
      })();
    }
  }
  useEditorStore.getState().setDraftLabel(finalLabel);
  if (editor) {
    /* v7.24: the line is REBUILT from the structured fields — the label from
       here, the date from the title node's tpDraftDate rendered in the
       Settings format. Copying the old date suffix verbatim (what this did)
       is what carried an ISO date forward through every draft change after
       v7.11 taught the builders to format it. */
    const updated = writeTitlePageDraftLine(editor, {
      dateFormat: useSettingsStore.getState().dateFormat,
      label: finalLabel,
    });
    if (opts?.toast !== false) {
      showToast(updated
        ? `Draft set to "${finalLabel}" — title page updated`
        : `Draft set to "${finalLabel}"`, 'success');
    }
  }
}

export default function SetDraftDialog({ open, onClose, editor }: {
  open: boolean; onClose: () => void; editor: Editor | null;
}) {
  const { draftLabel } = useEditorStore();
  /* v1.39: one plain text field, matching the Draft field's other two homes
     (Title Page, Save Script). The ordinal dropdown + "Custom…" pairing was a
     second input model for the same value. */
  const [value, setValue] = useState(draftLabel);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue(draftLabel);
      setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 0);
    }
  }, [open, draftLabel]);

  if (!open) return null;

  const finalLabel = value.trim();

  const apply = () => {
    if (!finalLabel) return;
    applyDraftNumber(editor, finalLabel);
    onClose();
  };

  return (
    <Modal onClose={onClose} boxClassName="ws-dialog">
        <div className="dialog-header">Set Draft Number</div>
        <div className="dialog-body">
          <div className="dialog-row">
            <label htmlFor="draft-input">
              Used to autofill the Draft field when saving, and the draft line
              on the title page.
            </label>
            <input
              id="draft-input"
              ref={inputRef}
              value={value}
              placeholder="e.g. First Draft, Shooting Draft"
              maxLength={60}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); apply(); }
                if (e.key === 'Escape') { e.preventDefault(); onClose(); }
              }}
            />
          </div>
        </div>
        <div className="dialog-actions">
          <button onClick={onClose}>Cancel</button>
          <button className="dialog-btn dialog-btn-primary" onClick={apply} disabled={!finalLabel}>Apply</button>
        </div>
    </Modal>
  );
}
