import React, { useEffect, useRef, useState } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { SYSTEM_TEMPLATE_LIST } from '../stores/formattingTemplateStore';
import { formatAppDate } from '../utils/dateFormat';

/*
 * NewScriptDialog (v1.50) — File > New Script…
 *
 * The welcome-screen shell (hero card, from the original OpenDraft welcome)
 * around the Save dialog's field grid: Script Name, Draft, Version — the same
 * classes, so the fields are formatted by the same CSS the Save window uses.
 * Draft defaults to "1st Draft" (editable); Version autofills today's date.
 * What's entered here seeds the new document via the New Script flow.
 *
 * v1.88: the script format is a Format dropdown here — the separate
 * "Choose script format" window no longer appears after Create. The list
 * follows Format > Script Format Preferences; with nothing initialized (or
 * everything deselected) it falls back to all built-in formats.
 */

export interface NewScriptMeta {
  name: string;
  draft: string;
  version: string;
  /** v1.88: the chosen format — applied directly, no follow-up picker. */
  templateId: string;
}

/** The dropdown's options: enabled formats in canonical order, or every
 *  built-in when preferences were never set / were emptied. */
function formatOptions() {
  const s = useSettingsStore.getState();
  const enabled = s.formatPreferencesInitialized
    ? SYSTEM_TEMPLATE_LIST.filter((t) => s.enabledScriptFormats.includes(t.id))
    : SYSTEM_TEMPLATE_LIST;
  return enabled.length > 0 ? enabled : SYSTEM_TEMPLATE_LIST;
}

export default function NewScriptDialog({ open, onClose, onCreate, onOpenScript, onImport }: {
  open: boolean;
  onClose: () => void;
  onCreate: (meta: NewScriptMeta) => void;
  /** v1.54: escape hatches — the user came here but wants an existing script. */
  onOpenScript?: () => void;
  onImport?: () => void;
}) {
  // v1.59: the Version autofill follows Settings > General > Date format
  // (default Short = MM/DD/YY, the historical behavior).
  const todayVersion = formatAppDate(new Date(), useSettingsStore.getState().dateFormat);

  // v1.60: the Draft default comes from Settings > General.
  const defaultDraft = useSettingsStore.getState().defaultDraftLabel || '1st Draft';
  const [name, setName] = useState('');
  const [draft, setDraft] = useState(defaultDraft);
  const [version, setVersion] = useState(todayVersion);
  const options = formatOptions();
  const [templateId, setTemplateId] = useState(options[0].id);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setDraft(defaultDraft);
      setVersion(todayVersion);
      setTemplateId(formatOptions()[0].id);
      setTimeout(() => nameRef.current?.focus(), 0);
    }
    // todayVersion is derived from the clock; recomputing it on open is the point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const create = () => {
    onCreate({
      name: name.trim() || 'Untitled Script',
      draft: draft.trim() || defaultDraft,
      version: version.trim(),
      templateId,
    });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); create(); }
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  return (
    <div
      /* fs-overlay-center (v3.25, Derek): this hero card centers on the
         screen instead of the overlay's usual upper anchor. */
      className="dialog-overlay fs-overlay-center"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="welcome-card fs-newscript-card" onClick={(e) => e.stopPropagation()}>
        <div className="welcome-hero">
          <div className="welcome-logo">SC</div>
          <h1 className="welcome-title">New Script</h1>
          <p className="welcome-subtitle">Name it now — everything stays editable later.</p>
        </div>

        <div className="fs-saveas-grid fs-newscript-grid" onKeyDown={onKeyDown}>
          <label htmlFor="newscript-name">Script Name:</label>
          <input
            id="newscript-name"
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Untitled Script"
          />

          <label htmlFor="newscript-draft">Draft:</label>
          <input
            id="newscript-draft"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={defaultDraft}
          />

          <label htmlFor="newscript-version">Version:</label>
          <input
            id="newscript-version"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder={todayVersion}
          />

          <label htmlFor="newscript-format">Format:</label>
          <select
            id="newscript-format"
            className="fs-newscript-format"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            {options.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        <div className="fs-newscript-actions">
          {onOpenScript && (
            <button className="fs-newscript-alt" onClick={onOpenScript}>Open Script…</button>
          )}
          {onImport && (
            <button className="fs-newscript-alt" onClick={onImport}>Import File…</button>
          )}
          <span className="fs-newscript-actions-gap" aria-hidden="true" />
          <button onClick={onClose}>Cancel</button>
          <button className="dialog-primary" onClick={create}>Create</button>
        </div>
      </div>
    </div>
  );
}
