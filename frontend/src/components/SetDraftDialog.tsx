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

const ORDINALS = [
  'First Draft', 'Second Draft', 'Third Draft', 'Fourth Draft', 'Fifth Draft',
  'Sixth Draft', 'Seventh Draft', 'Eighth Draft', 'Ninth Draft', 'Tenth Draft',
];
const CUSTOM = '__custom__';


/**
 * Set the draft label everywhere it lives: the editor store (persisted as
 * _draftLabel on save) and the Title Page draft line in place, preserving
 * its date suffix ("First Draft - 2026-07-10" → "Second Draft - 2026-07-10").
 * Shared by the Production dialog and the Settings mirror.
 */
export function applyDraftNumber(editor: Editor | null, finalLabel: string): void {
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
    showToast(updated
      ? `Draft set to "${finalLabel}" — title page updated`
      : `Draft set to "${finalLabel}"`, 'success');
  }
}

export default function SetDraftDialog({ open, onClose, editor }: {
  open: boolean; onClose: () => void; editor: Editor | null;
}) {
  const { draftLabel } = useEditorStore();
  const [choice, setChoice] = useState(draftLabel);
  const [customValue, setCustomValue] = useState('');
  const customRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      if (ORDINALS.includes(draftLabel)) {
        setChoice(draftLabel);
        setCustomValue('');
      } else {
        setChoice(CUSTOM);
        setCustomValue(draftLabel);
      }
    }
  }, [open, draftLabel]);

  useEffect(() => {
    if (choice === CUSTOM) setTimeout(() => customRef.current?.focus(), 0);
  }, [choice]);

  if (!open) return null;

  const finalLabel = (choice === CUSTOM ? customValue : choice).trim();

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
            <label htmlFor="draft-select">
              Used to autofill the Draft field when saving, and the draft line
              on the title page.
            </label>
            <select
              id="draft-select"
              value={choice}
              onChange={(e) => setChoice(e.target.value)}
            >
              {ORDINALS.map((o) => <option key={o} value={o}>{o}</option>)}
              <option value={CUSTOM}>Custom…</option>
            </select>
            {choice === CUSTOM && (
              <input
                ref={customRef}
                style={{ marginTop: 8 }}
                value={customValue}
                placeholder="e.g. Shooting Draft"
                maxLength={60}
                onChange={(e) => setCustomValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); apply(); }
                  if (e.key === 'Escape') { e.preventDefault(); onClose(); }
                }}
              />
            )}
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
