import React, { useEffect, useRef, useState } from 'react';

/*
 * NewScriptDialog (v1.50) — File > New Script…
 *
 * The welcome-screen shell (hero card, from the original OpenDraft welcome)
 * around the Save dialog's field grid: Script Name, Draft, Version — the same
 * classes, so the fields are formatted by the same CSS the Save window uses.
 * Draft defaults to "1st Draft" (editable); Version autofills today's date.
 * What's entered here seeds the new document via the New Script flow.
 */

export interface NewScriptMeta {
  name: string;
  draft: string;
  version: string;
}

export default function NewScriptDialog({ open, onClose, onCreate }: {
  open: boolean;
  onClose: () => void;
  onCreate: (meta: NewScriptMeta) => void;
}) {
  const today = new Date();
  const todayVersion = [
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
    String(today.getFullYear()).slice(-2),
  ].join('/');

  const [name, setName] = useState('');
  const [draft, setDraft] = useState('1st Draft');
  const [version, setVersion] = useState(todayVersion);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setDraft('1st Draft');
      setVersion(todayVersion);
      setTimeout(() => nameRef.current?.focus(), 0);
    }
    // todayVersion is derived from the clock; recomputing it on open is the point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const create = () => {
    onCreate({
      name: name.trim() || 'Untitled Script',
      draft: draft.trim() || '1st Draft',
      version: version.trim(),
    });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); create(); }
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  return (
    <div
      className="dialog-overlay"
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
            placeholder="1st Draft"
          />

          <label htmlFor="newscript-version">Version:</label>
          <input
            id="newscript-version"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder={todayVersion}
          />
        </div>

        <div className="fs-newscript-actions">
          <button onClick={onClose}>Cancel</button>
          <button className="dialog-primary" onClick={create}>Create</button>
        </div>
      </div>
    </div>
  );
}
