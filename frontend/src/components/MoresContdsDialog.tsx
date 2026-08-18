import React, { useState, useCallback } from 'react';
import { useEditorStore, resolveMoresContds, DEFAULT_MORES_CONTDS } from '../stores/editorStore';
import { Modal } from './Modal';

interface Props {
  onClose: () => void;
  /** Render only the content (no overlay/box) — used inside Preferences. */
  embedded?: boolean;
}

// Common industry presets; "Custom…" reveals a free-text override.
const CONTD_PRESETS = ["(CONT'D)", '(CONTINUED)', "(cont'd)", '(CONT.)'];
const MORE_PRESETS = ['(MORE)', '(MORE...)', '(more)'];
const CUSTOM = '__custom__';

/**
 * "Mores & Continueds" settings (per-document, like Final Draft). Controls the
 * two independent kinds of dialogue continuation and their marker text:
 *  - character (CONT'D): same character resumes after action, within a scene
 *  - dialogue page break: (MORE) / (CONT'D) when a speech splits across pages
 * The character (CONT'D) never carries across a scene heading — that is a fixed
 * industry rule, so there is no setting for it.
 */
const MoresContdsDialog: React.FC<Props> = ({ onClose, embedded = false }) => {
  const { pageLayout, setPageLayout } = useEditorStore();
  const initial = resolveMoresContds(pageLayout);

  const [characterContd, setCharacterContd] = useState(initial.characterContd);
  const [dialogueBreakContd, setDialogueBreakContd] = useState(initial.dialogueBreakContd);
  const [contdText, setContdText] = useState(initial.contdText);
  const [moreText, setMoreText] = useState(initial.moreText);
  // Custom-override mode for each dropdown (on when the value isn't a preset).
  const [contdCustom, setContdCustom] = useState(!CONTD_PRESETS.includes(initial.contdText));
  const [moreCustom, setMoreCustom] = useState(!MORE_PRESETS.includes(initial.moreText));

  const handleApply = useCallback(() => {
    setPageLayout({
      ...pageLayout,
      moresContds: {
        characterContd,
        dialogueBreakContd,
        contdText: contdText.trim() || DEFAULT_MORES_CONTDS.contdText,
        moreText: moreText.trim() || DEFAULT_MORES_CONTDS.moreText,
      },
    });
    onClose();
  }, [pageLayout, setPageLayout, characterContd, dialogueBreakContd, contdText, moreText, onClose]);

  // v4.65: an EXTERNAL reset (the tab's Reset section writes the store
  // directly) must show up in these staged fields. Each field only syncs when
  // the store value differs from what the field would COMMIT — so typing
  // (including a not-yet-trimmed trailing space) is never clobbered.
  React.useEffect(() => {
    if (!embedded) return;
    const cur = resolveMoresContds(pageLayout);
    if (cur.characterContd !== characterContd) setCharacterContd(cur.characterContd);
    if (cur.dialogueBreakContd !== dialogueBreakContd) setDialogueBreakContd(cur.dialogueBreakContd);
    if (cur.contdText !== (contdText.trim() || DEFAULT_MORES_CONTDS.contdText)) {
      setContdText(cur.contdText);
      setContdCustom(!CONTD_PRESETS.includes(cur.contdText));
    }
    if (cur.moreText !== (moreText.trim() || DEFAULT_MORES_CONTDS.moreText)) {
      setMoreText(cur.moreText);
      setMoreCustom(!MORE_PRESETS.includes(cur.moreText));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedded, pageLayout]);

  // v4.64, Derek: in Customize the Apply button is gone — every change
  // commits LIVE, like the rest of the Customize controls (Save just closes).
  // The guard keeps the mount from dispatching a no-op setPageLayout (which
  // would trigger a pointless repagination on opening the tab).
  React.useEffect(() => {
    if (!embedded) return;
    const cur = resolveMoresContds(pageLayout);
    const nextContd = contdText.trim() || DEFAULT_MORES_CONTDS.contdText;
    const nextMore = moreText.trim() || DEFAULT_MORES_CONTDS.moreText;
    if (
      cur.characterContd === characterContd
      && cur.dialogueBreakContd === dialogueBreakContd
      && cur.contdText === nextContd
      && cur.moreText === nextMore
    ) return;
    setPageLayout({
      ...pageLayout,
      moresContds: {
        characterContd,
        dialogueBreakContd,
        contdText: nextContd,
        moreText: nextMore,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedded, characterContd, dialogueBreakContd, contdText, moreText]);

  const handleReset = useCallback(() => {
    setCharacterContd(DEFAULT_MORES_CONTDS.characterContd);
    setDialogueBreakContd(DEFAULT_MORES_CONTDS.dialogueBreakContd);
    setContdText(DEFAULT_MORES_CONTDS.contdText);
    setMoreText(DEFAULT_MORES_CONTDS.moreText);
    setContdCustom(false);
    setMoreCustom(false);
  }, []);

  const checkboxRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 4 };
  const helpStyle: React.CSSProperties = { fontSize: 12, opacity: 0.7, margin: '0 0 16px 26px' };

  const body = (
    <>
        <div className="tp-editor-body" style={{ display: 'block', padding: embedded ? '4px 0 0' : 20 }}>

          <label style={checkboxRow}>
            <input type="checkbox" checked={characterContd} onChange={(e) => setCharacterContd(e.target.checked)} />
            <span>Automatic character {contdText.trim() || DEFAULT_MORES_CONTDS.contdText}</span>
          </label>
          <p style={helpStyle}>
            Adds the marker when a character speaks again after an action line within the
            same scene. It is never added across a scene heading.
          </p>

          <label style={checkboxRow}>
            <input type="checkbox" checked={dialogueBreakContd} onChange={(e) => setDialogueBreakContd(e.target.checked)} />
            <span>Show {moreText.trim() || DEFAULT_MORES_CONTDS.moreText} / {contdText.trim() || DEFAULT_MORES_CONTDS.contdText} when dialogue breaks across pages</span>
          </label>
          <p style={helpStyle}>
            When a single speech splits over a page break, shows {moreText.trim() || DEFAULT_MORES_CONTDS.moreText} at
            the bottom of the page and the character name with {contdText.trim() || DEFAULT_MORES_CONTDS.contdText} at
            the top of the next.
          </p>

          {/* v7.57, Derek: "make the[m] sit on the same row." Once v7.55
              capped these at their content width there was a panel of empty
              space beside each, and two short pickers stacked down the page
              read as two sections rather than one pair of related settings. */}
          <div className="fs-mores-row">
            <div className="props-field props-field-wide fs-mores-field">
              <label className="props-label">Continued text</label>
              <select
                className="props-input"
                value={contdCustom ? CUSTOM : contdText}
                onChange={(e) => {
                  if (e.target.value === CUSTOM) setContdCustom(true);
                  else { setContdCustom(false); setContdText(e.target.value); }
                }}
              >
                {CONTD_PRESETS.map((p) => <option key={p} value={p}>{p}</option>)}
                <option value={CUSTOM}>Custom…</option>
              </select>
              {contdCustom && (
                <input
                  className="props-input"
                  style={{ marginTop: 6 }}
                  value={contdText}
                  onChange={(e) => setContdText(e.target.value)}
                  placeholder="(CONT'D)"
                  autoFocus
                />
              )}
            </div>

            <div className="props-field props-field-wide fs-mores-field">
              <label className="props-label">More text</label>
              <select
                className="props-input"
                value={moreCustom ? CUSTOM : moreText}
                onChange={(e) => {
                  if (e.target.value === CUSTOM) setMoreCustom(true);
                  else { setMoreCustom(false); setMoreText(e.target.value); }
                }}
              >
                {MORE_PRESETS.map((p) => <option key={p} value={p}>{p}</option>)}
                <option value={CUSTOM}>Custom…</option>
              </select>
              {moreCustom && (
                <input
                  className="props-input"
                  style={{ marginTop: 6 }}
                  value={moreText}
                  onChange={(e) => setMoreText(e.target.value)}
                  placeholder="(MORE)"
                />
              )}
            </div>
          </div>
        </div>
        {/* v4.64: embedded changes apply live (no Apply); v4.65: its Reset
            moved to the tab's Reset section — the whole row is modal-only. */}
        {!embedded && (
          <div className="dialog-actions">
            <button onClick={handleReset} style={{ marginRight: 'auto' }}>Reset to defaults</button>
            <button onClick={onClose}>Cancel</button>
            <button className="dialog-btn dialog-btn-primary" onClick={handleApply}>Apply</button>
          </div>
        )}
    </>
  );

  if (embedded) return body;

  return (
    <Modal onClose={onClose} boxClass="tp-editor-dialog" boxStyle={{ maxWidth: 540 }}>
        <div className="dialog-header">Mores &amp; Continueds</div>
        {body}
    </Modal>
  );
};

export default MoresContdsDialog;
