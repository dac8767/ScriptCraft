import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { useEditorStore } from '../stores/editorStore';
import { showToast } from './Toast';

/* ─────────────────────────────────────────────────────────────────────────
   Set Draft Number (Edit → Set Draft Number…)

   Sets the document's draft label ("First Draft", "Second Draft", …). Feeds:
   - the Save As dialog's Draft autofill
   - the Title Page draft line (updated in place when a title page exists,
     keeping its date suffix)
   The label is saved inside the document (_draftLabel).
   ───────────────────────────────────────────────────────────────────────── */

/**
 * Set the draft label everywhere it lives: the editor store (persisted as
 * _draftLabel on save) and the Title Page draft line in place, preserving
 * its date suffix ("First Draft - 2026-07-10" → "Second Draft - 2026-07-10").
 * Shared by the Production dialog and the Settings mirror.
 */
export function applyDraftNumber(
  editor: Editor | null,
  finalLabel: string,
  opts?: { toast?: boolean },   // v1.34: silent for background syncs (Save dialog)
): void {
  useEditorStore.getState().setDraftLabel(finalLabel);
  if (editor) {
    let updated = false;
    editor.state.doc.descendants((node, pos) => {
      if (updated) return false;
      if (node.type.name === 'titlePage' && node.attrs?.field === 'draft') {
        const oldText = node.textContent || '';
        const dateMatch = oldText.match(/\s*[-–—]\s*(.+)$/);
        const suffix = dateMatch ? ` - ${dateMatch[1]}` : '';
        const newText = `${finalLabel}${suffix}`;
        if (newText !== oldText) {
          const tr = editor.state.tr.replaceWith(
            pos + 1, pos + node.nodeSize - 1,
            newText ? editor.state.schema.text(newText) : [],
          );
          editor.view.dispatch(tr);
        }
        updated = true;
        return false;
      }
      return true;
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
    <div
      className="dialog-overlay"
      onMouseDown={(e) => {
        // Close only when the press STARTS on the overlay — a text-selection
        // drag that ends outside the box must not dismiss the dialog.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-box ws-dialog" onClick={(e) => e.stopPropagation()}>
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
          <button className="dialog-primary" onClick={apply} disabled={!finalLabel}>Apply</button>
        </div>
      </div>
    </div>
  );
}
