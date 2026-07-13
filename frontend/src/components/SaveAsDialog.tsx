import React, { useState, useEffect, useRef } from 'react';
import { FaCloud, FaDesktop } from 'react-icons/fa';
import { api } from '../services/api';
import { cloudApi } from '../services/cloudApi';
import { getLibraryId, LIBRARY_NAME } from '../services/scriptLibrary';
import { isWeb } from '../services/platform';
import type { ProjectInfo } from '../services/api';
import { useSettingsStore } from '../stores/settingsStore';
import { useEditorStore } from '../stores/editorStore';
import { mirrorSave } from '../services/saveLocations';

export type SaveDestination = 'local' | 'cloud';


interface SaveAsDialogProps {
  defaultFileName: string;
  /** Pre-select the destination tab. Pass 'cloud' when the user came from a
   *  cloud project — otherwise the dialog defaults to 'local' and the
   *  cloud-only project name will not match anything in the local list,
   *  silently filing the new screenplay under a random local project. */
  defaultDestination?: SaveDestination;
  onSaved: (
    projectId: string,
    projectName: string,
    scriptId: string,
    scriptTitle: string,
    destination: SaveDestination,
    draftLabel?: string,
  ) => void;
  onClose: () => void;
  buildContent: () => Record<string, unknown> | undefined;
}

/** Web is always cloud-backed; the device/cloud toggle would be misleading. */
const WEB_ONLY_CLOUD = isWeb();

/** Banner shown when the user is saving a document that came from an external
 *  file (FDX, Fountain, DOCX, etc.). Clarifies that the save goes into
 *  FreeDraft's library — it does *not* write back to the source file. */
const ImportedSourceNotice: React.FC = () => {
  const importedSource = useEditorStore((s) => s.importedSource);
  if (!importedSource) return null;
  return (
    <div
      style={{
        padding: '10px 12px',
        margin: '0 0 12px 0',
        border: '1px solid rgba(46,125,215,0.4)',
        background: 'rgba(46,125,215,0.10)',
        borderRadius: 6,
        fontSize: 12,
        color: 'var(--fd-text)',
        lineHeight: 1.45,
      }}
    >
      <strong>Note:</strong> This document was imported from <strong>{importedSource.name}</strong>{' '}
      ({importedSource.format}). Saving creates a new file inside FreeDraft's library —
      it does <strong>not</strong> overwrite the original source file. To write back to
      the original format, use <em>File → Export</em> after saving.
    </div>
  );
};

const SaveAsDialog: React.FC<SaveAsDialogProps> = ({
  defaultFileName,
  defaultDestination,
  onSaved,
  onClose,
  buildContent,
}) => {
  // v0.16: File Name is composed from Draft + Version. Draft autofills from
  // the document's draft label (Edit > Set Draft Number), Version from
  // today's date in MM/DD/YY — both editable.
  const initialDraft = useEditorStore.getState().draftLabel || 'First Draft';
  const today = new Date();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const yy = String(today.getFullYear()).slice(-2);
  const [draft, setDraft] = useState(initialDraft);
  const [version, setVersion] = useState(`${mm}/${dd}/${yy}`);

  /*
   * v1.15 — THE SCRIPT HAS A NAME AGAIN, and it is the script's own.
   *
   * v1.14 got the model wrong. In the old world the PROJECT carried the name of the
   * screenplay and a "script" was one draft inside it, titled "Draft - Date". So when
   * I removed the project field I removed the only place you could name your work:
   * Save As asked for a draft and a date, filed the script in whatever container was
   * lying around, and the status bar showed that container's name — which is why a
   * brand-new screenplay came back called "Test".
   *
   * Now a FreeDraft file is one script, so the NAME belongs to the script. Draft and
   * version are what they always should have been: metadata about which draft this
   * is, not the identity of the work.
   */
  const [name, setName] = useState(defaultFileName || 'Untitled');
  const fileName = name.trim();
  const draftLabel = [draft.trim(), version.trim()].filter(Boolean).join(' - ');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [destination, setDestination] = useState<SaveDestination>(
    WEB_ONLY_CLOUD ? 'cloud' : (defaultDestination ?? 'local'),
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Re-fetch projects when the signed-in user changes. The dialog can open
  // while the user is anonymous (we got a 401 on the initial listProjects),
  // AuthGate then prompts a sign-in, and when the token lands we want to
  // reload the list so a subsequent save doesn't hit 409 on a project the
  // user actually already owns.
  const accessToken = useSettingsStore((s) => s.collabAuth.accessToken);
  const authVerified = useSettingsStore((s) => s.authVerified);
  const signedIn = Boolean(accessToken && authVerified);


  // Focus the file name input once the project name has been auto-populated
  // by the projects-list load. Two guards:
  //  - didInitialFocusRef: only fire once, so clearing & retyping doesn't
  //    yank focus.
  //  - active-element check inside the timer: if the user has already
  //    clicked into the project input (e.g. they were faster than the
  //    list load), don't steal their focus mid-typing.
  const didInitialFocusRef = useRef(false);
  useEffect(() => {
    if (didInitialFocusRef.current) return;
    didInitialFocusRef.current = true;
    // Small delay to let React render the field
    const t = setTimeout(() => {
      // If the user has already focused (or typed into) any input in this
      // dialog, leave them alone — auto-focus is only a convenience when
      // they haven't engaged with the form yet.
      const active = document.activeElement;
      if (active && active.tagName === 'INPUT') return;
      fileInputRef.current?.focus();
      fileInputRef.current?.select();
      // Android: the soft keyboard appears ~150-300ms after focus and the
      // visual viewport shrinks — explicitly scroll the input into view so
      // it's not hidden behind the keyboard, with a follow-up scroll once
      // the IME has finished animating.
      fileInputRef.current?.scrollIntoView({ block: 'center', behavior: 'auto' });
      setTimeout(() => {
        fileInputRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 350);
    }, 50);
    return () => clearTimeout(t);
  }, []);


  const handleSave = async () => {
    const trimmedFile = fileName.trim();
    if (!trimmedFile) return;   // a title is the only thing a save needs now

    if (destination === 'cloud' && !signedIn) {
      // AuthGate handles dispatching the login dialog. The user can re-click
      // Save once they're back; the projects list will refresh automatically
      // via the auth-token effect dependency.
      window.dispatchEvent(new CustomEvent('opendraft:auth-required'));
      return;
    }

    setSaving(true);
    setError('');

    const client = destination === 'cloud' ? cloudApi : api;

    try {
      /*
       * v1.14: nothing to pick, create or reconcile. A FreeDraft file is one script,
       * so it goes in the one library. This used to create a project from a typed
       * name, handle the 409 when it already existed, refetch, and then surface
       * "Could not create project" to someone who had merely tried to save their
       * screenplay.
       */
      const project = { id: await getLibraryId(client), name: LIBRARY_NAME } as ProjectInfo;

      // Create script in the project
      const content = buildContent();
      const scriptResp = await client.createScript(project.id, {
        title: trimmedFile,
        content: content || undefined,
      });

      // Fan out to enabled secondary save locations (Settings > Save Locations)
      if (content) {
        void mirrorSave({
          projectId: project.id,
          scriptId: scriptResp.meta.id,
          projectName: LIBRARY_NAME,
          title: trimmedFile,
          content,
        });
      }
      onSaved(project.id, LIBRARY_NAME, scriptResp.meta.id, trimmedFile, destination, draftLabel);
    } catch (err) {
      // AuthGate / QuotaExceededDialog already showed a dialog for these —
      // don't duplicate the raw message inline.
      if (!(err as any)?.handled) {
        setError(err instanceof Error ? err.message : 'Save failed');
      }
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && fileName.trim()) {
      handleSave();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-box" onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className="dialog-header">Save Screenplay</div>
        <div className="dialog-body">
          <ImportedSourceNotice />

          {!WEB_ONLY_CLOUD && (
            <div className="dialog-row" style={{ marginBottom: 12 }}>
              <label>Save to</label>
              <div className="open-file-source-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={destination === 'local'}
                  className={`open-file-source-tab ${destination === 'local' ? 'active' : ''}`}
                  onClick={() => setDestination('local')}
                >
                  <FaDesktop /> This device
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={destination === 'cloud'}
                  className={`open-file-source-tab ${destination === 'cloud' ? 'active' : ''}`}
                  onClick={() => setDestination('cloud')}
                >
                  <FaCloud /> FreeDraft Cloud
                </button>
              </div>
              {destination === 'cloud' && !signedIn && (
                <div style={{ fontSize: 12, color: '#ff9966', marginTop: 6 }}>
                  Sign in to save to FreeDraft Cloud — pressing Save will open the login dialog.
                </div>
              )}
            </div>
          )}
          <div className="dialog-row">
            <label>Name</label>
            <input
              ref={fileInputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Script name"
            />
          </div>
          <div className="dialog-row" style={{ marginTop: 12 }}>
            <label>Draft</label>
            <input
              ref={fileInputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="First Draft"
            />
          </div>
          <div className="dialog-row" style={{ marginTop: 12 }}>
            <label>Version</label>
            <input
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder={`${mm}/${dd}/${yy}`}
            />
          </div>
          <div className="save-as-preview">
            Saves as: <strong>{fileName || '—'}</strong>
            {draftLabel && <span className="fs-saveas-draft"> · {draftLabel}</span>}
          </div>
          {error && (
            <div style={{ color: '#ff6b6b', fontSize: 12, marginTop: 8 }}>{error}</div>
          )}
        </div>
        <div className="dialog-actions">
          <button onClick={onClose}>Cancel</button>
          <button
            className="dialog-primary"
            onClick={handleSave}
            disabled={saving || !fileName.trim()}
          >
            {saving
              ? 'Saving...'
              : destination === 'cloud' ? 'Save to Cloud' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SaveAsDialog;
