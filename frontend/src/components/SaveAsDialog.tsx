import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { api } from '../services/api';
import { cloudApi } from '../services/cloudApi';
import { getLibraryId, LIBRARY_NAME } from '../services/scriptLibrary';
import { errText } from '../utils/errText';
import { shortenPathToFit } from '../utils/pathDisplay';
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
  /** Takes you to Settings > Save Locations — the one place copies are configured. */
  onOpenSaveLocations: () => void;
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

/** The switch beside Draft and Version: whether that piece joins the composed
 *  name. Script Name has no switch — a save always needs a name. */
const IncludeToggle: React.FC<{ what: string; on: boolean; onToggle: () => void }> = ({
  what,
  on,
  onToggle,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={`Include ${what} in name`}
    className={'fs-toggle' + (on ? ' fs-toggle-on' : '')}
    onClick={onToggle}
  >
    <span className="fs-toggle-knob" />
  </button>
);

const SaveAsDialog: React.FC<SaveAsDialogProps> = ({
  defaultFileName,
  defaultDestination,
  onSaved,
  onClose,
  onOpenSaveLocations,
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
  // v1.22: Draft and Version are optional PARTS OF THE NAME, and the toggles
  // say so. Off means "keep the field's value, just don't write it into the
  // name". Script Name has no toggle — it is the name.
  const [includeDraft, setIncludeDraft] = useState(true);
  const [includeVersion, setIncludeVersion] = useState(true);

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

  // Where copies go — read from Settings, changed in Settings. Shown here so you can
  // see what a save is about to do without having to go and look.
  const localSaveFolder = useSettingsStore((st) => st.localSaveFolder);
  const setLocalSaveFolder = useSettingsStore((st) => st.setLocalSaveFolder);
  const saveToCloud = useSettingsStore((st) => st.saveToCloud);
  const saveToGDrive = useSettingsStore((st) => st.saveToGDrive);
  const saveToOneDrive = useSettingsStore((st) => st.saveToOneDrive);
  const otherLocations = [
    saveToCloud && 'FreeDraft Cloud',
    saveToGDrive && 'Google Drive',
    saveToOneDrive && 'OneDrive',
  ].filter(Boolean) as string[];

  const chooseFolder = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const picked = await open({ directory: true, multiple: false, title: 'Where should FreeDraft keep this script?' });
      if (typeof picked !== 'string') return;

      /*
       * v1.18: PROVE we can write there, now, while you're looking at it.
       *
       * The folder was accepted without a check, and the failure surfaced later — at
       * save time, as a frightening "could not save your changes". Whatever the
       * reason (permissions, a read-only volume, an unmounted drive), you should find
       * out when you pick the folder, not when you're trying to save your work.
       */
      const { writeTextFile, remove } = await import('@tauri-apps/plugin-fs');
      /*
       * v1.20: NOT a dotfile.
       *
       * The probe was ".freedraft-write-test", and Tauri's scope check is glob-based:
       * glob patterns do not match leading-dot files unless told to. So "$DOWNLOAD/**"
       * matched Blackwater.odraft.json perfectly well and refused the probe — my
       * WRITABILITY CHECK was the only thing that couldn't be written, and it reported
       * that as the folder being unwritable. The check invented the failure it was
       * looking for.
       */
      const probe = `${picked}${picked.endsWith('/') ? '' : '/'}freedraft-write-test.tmp`;
      try {
        await writeTextFile(probe, '');
        await remove(probe).catch(() => { /* the write is what mattered */ });
      } catch (err) {
        // Tauri rejects with a STRING, so (err as Error).message was undefined and the
        // real reason — which permission, which path — was lost. errText keeps it.
        console.error('[FreeDraft] folder write test failed:', err);
        setError(
          `FreeDraft can't write to that folder — nothing has been changed. ` +
          `Pick another, or check the folder's permissions. (${errText(err)})`,
        );
        return;
      }

      setLocalSaveFolder(picked);
      setError('');
    } catch (err) {
      console.error('[FreeDraft] folder picker failed:', err);
      setError(`Could not open the folder picker: ${errText(err)}`);
    }
  };
  const fileName = name.trim();
  const draftLabel = [
    includeDraft ? draft.trim() : '',
    includeVersion ? version.trim() : '',
  ].filter(Boolean).join(' - ');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  /*
   * The script's home: the app's local store on desktop, the cloud on the web where
   * there is no local store. This is no longer a question the dialog asks — copies
   * are what Settings > Save Locations is for.
   */
  const destination: SaveDestination = WEB_ONLY_CLOUD ? 'cloud' : (defaultDestination ?? 'local');
  const fileInputRef = useRef<HTMLInputElement>(null);

  /*
   * v1.23: "Update save locations…" must ROUND-TRIP.
   *
   * It used to close this dialog on the way to Settings, unmounting it — so the
   * name, draft and toggles you'd already filled in were gone when you came
   * back. The dialog now stays mounted and merely hides while Settings is on
   * top; when Settings closes, it reappears exactly as you left it. (The
   * "Additional locations:" line updates by itself — it reads the settings
   * store live.)
   */
  const prefsOpen = useEditorStore((s) => s.preferencesRequest.open);

  /*
   * v1.22: shorten the path at "/" boundaries, not wherever the pixels run out.
   * The old CSS clip (direction: rtl + ellipsis) produced "…s/dcarl/Downloads/",
   * which reads as a folder that doesn't exist. We measure the button's actual
   * width and drop whole leading segments until the rest fits — and re-measure
   * when the (resizable) dialog changes size. Where measurement isn't available
   * (jsdom, a canvas-less WebView), the full path renders and the CSS ellipsis
   * remains the backstop.
   */
  const pathBtnRef = useRef<HTMLButtonElement>(null);
  const [displayPath, setDisplayPath] = useState(localSaveFolder);
  useLayoutEffect(() => {
    const btn = pathBtnRef.current;
    if (!btn || !localSaveFolder) {
      setDisplayPath(localSaveFolder);
      return;
    }
    const recompute = () => {
      const ctx = document.createElement('canvas').getContext('2d');
      if (!ctx) {
        setDisplayPath(localSaveFolder);
        return;
      }
      const style = getComputedStyle(btn);
      ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const max = btn.clientWidth;
      setDisplayPath(
        max > 0
          ? shortenPathToFit(localSaveFolder, (s) => ctx.measureText(s).width <= max)
          : localSaveFolder,
      );
    };
    recompute();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(recompute);
    ro.observe(btn);
    return () => ro.disconnect();
  }, [localSaveFolder]);

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
    <div className="dialog-overlay" style={prefsOpen ? { display: 'none' } : undefined} onClick={onClose}>
      <div className="dialog-box fs-saveas-dialog" onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className="dialog-header">Save Script</div>
        <div className="dialog-body">
          <ImportedSourceNotice />

          {/*
            * v1.21 — laid out like an export panel: one column of labels, one column
            * of controls, and the destination shown as a path you can click rather
            * than a text box you can't type into anyway.
            *
            * Order matters here: what the script is CALLED comes first, because that's
            * what you came to this dialog to decide. Where copies of it go is settled
            * once and rarely revisited, so it sits at the bottom.
            */}
          <div className="fs-saveas-grid">

            <label htmlFor="saveas-name">Script Name:</label>
            <input
              id="saveas-name"
              ref={fileInputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Script name"
            />

            {/* Heads the toggle column below; flows into the Script Name row's
              * third cell, which has no toggle on purpose — the name is always
              * required. */}
            <span className="fs-saveas-colhead">Include</span>

            <label htmlFor="saveas-draft">Draft:</label>
            <input
              id="saveas-draft"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="First Draft"
            />
            <IncludeToggle what="Draft" on={includeDraft} onToggle={() => setIncludeDraft(!includeDraft)} />

            <label htmlFor="saveas-version">Version:</label>
            <input
              id="saveas-version"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`${mm}/${dd}/${yy}`}
            />
            <IncludeToggle what="Version" on={includeVersion} onToggle={() => setIncludeVersion(!includeVersion)} />

            {/* v1.23: lives in the grid, right under Version, so the composed
              * name lines up with the fields that compose it. */}
            <span className="fs-saveas-rowlabel">Saves as:</span>
            <div className="save-as-preview fs-saveas-span">
              <strong>{fileName || '—'}</strong>
              {draftLabel && <span className="fs-saveas-draft"> - {draftLabel}</span>}
            </div>

            {!WEB_ONLY_CLOUD && (
              <>
                <label>Location on this device:</label>
                <div className="fs-saveas-folder fs-saveas-span">
                  <button
                    type="button"
                    ref={pathBtnRef}
                    className="fs-saveas-path"
                    onClick={chooseFolder}
                    title={localSaveFolder ? `${localSaveFolder} — click to change` : 'Click to choose a folder'}
                  >
                    {localSaveFolder ? displayPath : 'Choose a folder…'}
                  </button>
                </div>
              </>
            )}

            <label>Additional save locations:</label>
            <div className="fs-saveas-locations fs-saveas-span">
              <span>{otherLocations.length ? otherLocations.join(', ') : 'None'}</span>
              <button
                type="button"
                className="fs-saveas-change"
                onClick={onOpenSaveLocations}
              >Update save locations…</button>
            </div>

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
