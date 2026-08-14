import type { Editor } from '@tiptap/core';
import React, { useState } from 'react';
import { FaWrench, FaColumns, FaFileAlt, FaRulerCombined, FaCloudUploadAlt, FaKeyboard, FaEdit, FaGripHorizontal, FaBolt, FaMousePointer, FaPalette, FaUndo, FaBoxOpen, FaMarker } from 'react-icons/fa';
import PresetsPanel from './PresetsPanel';
import { CUSTOMIZE_RESETS, ResetAllButton, runCustomizeReset, type CustomizeTabId } from './customizeResets';
import { applyDraftNumber } from './SetDraftDialog';
import { useEditorStore } from '../stores/editorStore';
import { useSettingsStore } from '../stores/settingsStore';
import { DATE_FORMATS, type DateFormatId } from '../utils/dateFormat';
import PageSetupDialog from './PageSetupDialog';
import ScriptFormatPreferencesDialog from './ScriptFormatPreferencesDialog';
import CustomizePanelsDialog from './CustomizePanelsDialog';
import SettingsPage from './SettingsPage';
import { showToast } from './Toast';
import KeyboardShortcutsTab from './KeyboardShortcutsTab';
import { downloadBackup, applyBackup, readFileText } from '../utils/settingsBackup';
import { useWindowTabMemory } from '../utils/windowTabMemory';
import { confirmDialog } from './ConfirmDialog';
import { spellChecker, BUILTIN_LANGUAGE } from '../editor/spellchecker';
import { BUILTIN, CATALOG, urlsFor } from '../editor/languageCatalog';
import { useState as useStateReact, useEffect as useEffectReact } from 'react';
import {
  connectGDrive, connectOneDrive, gdriveConnected, onedriveConnected,
  disconnectGDrive, disconnectOneDrive,
} from '../services/saveLocations';
import { redirectUri } from '../services/oauthPkce';
import FloatingWindow from './FloatingWindow';

/* ─────────────────────────────────────────────────────────────────────────
   Settings (File → Settings…)

   One window for the settings that used to be scattered across menus:
   - General            — startup + automatic snapshots
   - Customize Layout   — same live settings as View → Customize Layout
   - Script Formats     — formerly Format → Script Format Preferences…
   - Page Setup         — formerly File → Page Setup…

   (v4.28: Mores & Continueds moved to Customize > Editor.)
   The remaining embeds use the existing dialogs in `embedded` mode, so both entry
   points (where they still exist) edit exactly the same state.
   ───────────────────────────────────────────────────────────────────────── */

type CustomizeCat = 'elements' | 'toolbar' | 'panels' | 'qat' | 'context' | 'markups' | 'themes';
type PrefTab = 'general' | 'formats' | 'page' | 'keys' | 'saveloc' | 'system' | 'presets' | 'defaults' | `cz-${CustomizeCat}`;

const TABS: Array<{ id: PrefTab; label: string; icon: React.ReactNode }> = [
  // App-wide first, then writing setup, then data, then system.
  { id: 'general', label: 'General', icon: <FaWrench /> },
  { id: 'saveloc', label: 'Save Options', icon: <FaCloudUploadAlt /> },
  { id: 'formats', label: 'Templates', icon: <FaFileAlt /> },
  { id: 'page', label: 'Page Setup', icon: <FaRulerCombined /> },
  /* v4.30 batch-v7 #3, Derek: hotkeys are behavior, not workspace layout —
     moved here from Customize. */
  { id: 'keys', label: 'Keyboard Shortcuts', icon: <FaKeyboard /> },
  { id: 'system', label: 'System', icon: <FaWrench /> },
  /* v4.79, Derek: every preset-type export AND import — the same panel the
     File ▸ Import/Export ▸ Presets… window shows. */
  { id: 'presets', label: 'Presets', icon: <FaBoxOpen /> },
  /* v4.65, Derek: every reset in one place — plus Reset All (moved here
     from the Customize globals). */
  { id: 'defaults', label: 'Defaults', icon: <FaUndo /> },
];

/* v4.64, Derek: the Customize tabs are first-class entries in THIS sidebar —
   the old "Customize" tab wrapped its own inner tab rail, a submenu level
   deeper than it needed to be. Each entry renders CustomizePanelsDialog
   pinned to one tab (soloCategory). */
const CUSTOMIZE_TABS: Array<{ id: CustomizeCat; label: string; icon: React.ReactNode }> = [
  { id: 'elements', label: 'Editor', icon: <FaEdit /> },
  { id: 'toolbar', label: 'Toolbar', icon: <FaGripHorizontal /> },
  { id: 'panels', label: 'Side Panels', icon: <FaColumns /> },
  { id: 'qat', label: 'Quick Access', icon: <FaBolt /> },
  { id: 'context', label: 'Context Menu', icon: <FaMousePointer /> },
  { id: 'markups', label: 'Annotations', icon: <FaMarker /> },
  { id: 'themes', label: 'Themes', icon: <FaPalette /> },
];

/* v4.71: every openable tab id, for the last-used-tab memory's validity
   check — derived from the two arrays above so it can't drift. */
const ALL_PREF_TAB_IDS: readonly PrefTab[] = [
  ...TABS.map((t) => t.id),
  ...CUSTOMIZE_TABS.map((t) => `cz-${t.id}` as PrefTab),
];

/* v4.65, Derek: every reset in one place. The per-tab Reset sections stay;
   this tab COMPILES them (one registry — customizeResets) and hosts the
   Reset All button, moved here from the Customize globals. */
function DefaultsTab() {
  const groups = CUSTOMIZE_TABS
    .map((t) => ({ ...t, actions: CUSTOMIZE_RESETS.filter((a) => a.tab === (t.id as CustomizeTabId)) }))
    .filter((g) => g.actions.length > 0);
  return (
    <div className="fs-defaults-tab">
      <p className="prefs-hint">
        Every reset in one place. Each button restores one area to its factory
        defaults — the same buttons also live at the bottom of their own tabs.
      </p>
      {groups.map((g) => (
        <section key={g.id}>
          <h3>{g.label}</h3>
          <div className="fs-reset-row">
            {g.actions.map((a) => (
              <button
                key={a.id}
                className="swn-add-btn"
                /* v6.85: the SAME warn+undo wrapper as the per-tab Reset
                   sections — this tab was still resetting bare (missed in
                   v6.77), the exact drift the shared registry forbids. */
                onClick={() => runCustomizeReset(a)}
              >{a.label}</button>
            ))}
          </div>
        </section>
      ))}
      <section>
        <h3>Everything</h3>
        <p className="prefs-hint">
          Resets sizes, spacing and layouts app-wide. Themes, the Editor tab's
          content and Keyboard Shortcuts keep their own resets above.
        </p>
        <ResetAllButton />
      </section>
    </div>
  );
}

function LanguageSection() {
  const [enabled, setEnabled] = useStateReact<string[]>(() => spellChecker.getEnabledLanguages());
  const [loading, setLoading] = useStateReact<string | null>(null);

  useEffectReact(() => {
    // Reflect external changes (per-script language restore on doc switch)
    const off = spellChecker.onChange?.(() => setEnabled(spellChecker.getEnabledLanguages()));
    return () => { if (typeof off === 'function') off(); };
  }, []);

  const toggle = async (code: string, on: boolean) => {
    const current = spellChecker.getEnabledLanguages();
    if (on) {
      const lang = code === BUILTIN.code ? BUILTIN : CATALOG.find((l) => l.code === code);
      if (lang && code !== BUILTIN_LANGUAGE) {
        setLoading(code);
        const { aff, dic } = urlsFor(lang);
        const ok = await spellChecker.loadLanguage(code, { affUrl: aff, dicUrl: dic, label: lang.label, persist: true });
        setLoading(null);
        if (!ok) {
          showToast(`Could not download the ${lang.label} dictionary`, 'error');
          return;
        }
      }
      spellChecker.setEnabledLanguages([...new Set([...current, code])]);
    } else {
      spellChecker.setEnabledLanguages(current.filter((c) => c !== code));
    }
    setEnabled(spellChecker.getEnabledLanguages());
  };

  const all = [BUILTIN, ...CATALOG];
  return (
    <section>
      <h3>Language</h3>
      <p className="prefs-hint" style={{ margin: '0 0 10px' }}>
        Spell-check languages for the current script. Dictionaries download once
        and are kept on this device; the selection saves with the document.
      </p>
      <div className="prefs-lang-list">
        {all.map((l) => (
          <label key={l.code} className="prefs-check-row">
            <input
              type="checkbox"
              checked={enabled.includes(l.code)}
              disabled={loading === l.code || (l.code === BUILTIN_LANGUAGE && enabled.length === 1 && enabled[0] === BUILTIN_LANGUAGE)}
              onChange={(e) => toggle(l.code, e.target.checked)}
            />
            <span>{l.label}{loading === l.code ? ' — downloading…' : ''}</span>
          </label>
        ))}
      </div>
    </section>
  );
}




function DraftNumberRow({ editor }: { editor: Editor | null }) {
  const draftLabel = useEditorStore((s) => s.draftLabel);
  // v1.65: this one field also owns the default for NEW scripts (the
  // "Default draft label" that briefly lived in Settings > General).
  const defaultDraftLabel = useSettingsStore((s) => s.defaultDraftLabel);
  const setDefaultDraftLabel = useSettingsStore((s) => s.setDefaultDraftLabel);
  const [value, setValue] = React.useState(draftLabel);
  React.useEffect(() => { setValue(draftLabel); }, [draftLabel]);
  const trimmed = value.trim();
  return (
    <>
    <div className="prefs-field-row">
      <label htmlFor="prefs-draft-label">Draft label</label>
      <input
        id="prefs-draft-label"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="e.g. Second Draft"
        style={{ minWidth: 180 }}
      />
      <button
        className="dialog-primary"
        disabled={!trimmed || trimmed === draftLabel}
        onClick={() => applyDraftNumber(editor, trimmed)}
      >Apply</button>
      <button
        disabled={!trimmed || trimmed === defaultDraftLabel}
        onClick={() => setDefaultDraftLabel(trimmed)}
      >Set as Default</button>
    </div>
    {/* v6.95 (Derek, via the feedback form): the explainer paragraph is gone
        with the rest of this tab's helper text. */}
    </>
  );
}

/** v2.83: native folder picker — desktop only (a folder path only means
 *  something where the OS dialog picked it). */
async function pickFolder(title = 'Folder for auto save copies'): Promise<string | null> {
  const { isTauri } = await import('../services/platform');
  if (!isTauri()) { showToast('Choosing a local folder needs the desktop app.', 'info'); return null; }
  const { open } = await import('@tauri-apps/plugin-dialog');
  const picked = await open({ directory: true, multiple: false, title });
  return typeof picked === 'string' ? picked : null;
}

function SaveLocationsTab({ editor }: { editor: Editor | null }) {
  const {
    autoSnapshotMinutes, setAutoSnapshotMinutes,
    localSaveFolder, setLocalSaveFolder,
    saveToGDrive, setSaveToGDrive,
    saveToOneDrive, setSaveToOneDrive,
    saveToBackupFolder, setSaveToBackupFolder,
    backupSaveFolder, setBackupSaveFolder,
    snapToGDrive, setSnapToGDrive,
    snapToOneDrive, setSnapToOneDrive,
    snapToLocalFolder, setSnapToLocalFolder,
    snapLocalFolder, setSnapLocalFolder,
    screenshotFolder, setScreenshotFolder,
    gdriveClientId, setGdriveClientId,
    onedriveClientId, setOnedriveClientId,
  } = useSettingsStore();
  const lastAutoSaveMinutes = React.useRef(autoSnapshotMinutes > 0 ? autoSnapshotMinutes : 5);
  const [gConnected, setGConnected] = useStateReact(gdriveConnected());
  const [oConnected, setOConnected] = useStateReact(onedriveConnected());
  const [busy, setBusy] = useStateReact<string | null>(null);

  const doConnect = async (which: 'g' | 'o') => {
    setBusy(which);
    try {
      if (which === 'g') { await connectGDrive(); setGConnected(true); showToast('Google Drive connected', 'success'); }
      else { await connectOneDrive(); setOConnected(true); showToast('OneDrive connected', 'success'); }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Connection failed', 'error');
    } finally { setBusy(null); }
  };

  return (
    <div className="prefs-general">
      <section>
        <h3>Draft Number</h3>
        <DraftNumberRow editor={editor} />
      </section>

      <section id="prefs-save-locations">
        <h3>Script Save Locations</h3>
        {/* v6.95 (Derek, via the feedback form): this tab's helper text is
            gone — only the two cloud sections keep their setup notes. */}
        {/* v6.42, Derek: "i should still be able to change the location of
            'Local System (always on)'" — the row now shows and edits the
            device folder that receives the script as a real file: the SAME
            localSaveFolder Save As's "Location on this device" writes (one
            field, two doors). The checkbox stays locked — the app's own
            library copy always saves — but the folder is yours. */}
        <label className="prefs-check-row">
          <input type="checkbox" checked disabled />
          <span>
            Local System (always on)
            {localSaveFolder && <code className="prefs-path-chip">{localSaveFolder}</code>}
          </span>
          <button
            className="prefs-inline-btn"
            onClick={async (e) => {
              e.preventDefault();
              const folder = await pickFolder('Where should ScriptCraft keep this script?');
              if (folder) setLocalSaveFolder(folder);
            }}
          >Choose Folder…</button>
        </label>
        {/* v6.41, Derek: "a second location on the local device" — a folder
            that receives a copy of the script on every save. Checking with no
            folder yet opens the picker (the v2.83 pattern); the checkbox and
            the folder are separate so unchecking keeps the path. */}
        <label className="prefs-check-row">
          <input
            type="checkbox"
            checked={saveToBackupFolder && !!backupSaveFolder}
            onChange={async (e) => {
              if (!e.target.checked) { setSaveToBackupFolder(false); return; }
              let folder = backupSaveFolder;
              if (!folder) folder = (await pickFolder()) || '';
              if (!folder) return;
              setBackupSaveFolder(folder);
              setSaveToBackupFolder(true);
            }}
          />
          <span>
            Local System (backup location)
            {backupSaveFolder && <code className="prefs-path-chip">{backupSaveFolder}</code>}
          </span>
          <button
            className="prefs-inline-btn"
            onClick={async (e) => {
              e.preventDefault();
              const folder = await pickFolder();
              if (folder) { setBackupSaveFolder(folder); setSaveToBackupFolder(true); }
            }}
          >Choose Folder…</button>
        </label>
        {/* v6.41, Derek: "Make the save options always editable." OneDrive was
            checked during document setup (which has no connection guard) and
            this window's `disabled={!connected}` then refused to UNcheck it —
            a checkbox you can see but not change. The guards are gone; the
            label hints still say what a location needs to actually receive
            saves, and an enabled-but-unconnected location reports its failure
            through the save-error surface instead of silently blocking here. */}
        <label className="prefs-check-row">
          <input type="checkbox" checked={saveToGDrive} onChange={(e) => setSaveToGDrive(e.target.checked)} />
          <span>Google Drive{!gConnected ? ' — connect below first' : ''}</span>
        </label>
        <label className="prefs-check-row">
          <input type="checkbox" checked={saveToOneDrive} onChange={(e) => setSaveToOneDrive(e.target.checked)} />
          <span>OneDrive{!oConnected ? ' — connect below first' : ''}</span>
        </label>
      </section>

      <section>
        <h3>Auto Saves</h3>
        {/* v6.95 (Derek, via the feedback form): the timer and the locations
            it writes to are ONE section now. An auto save is a crash-spare
            FILE in the checked locations below — never a snapshot (v6.72;
            ScreenplayEditor's auto-save timer takes no version check-in). */}
        <label className="prefs-check-row" style={{ marginBottom: 10 }}>
          <input
            type="checkbox"
            checked={autoSnapshotMinutes > 0}
            onChange={(e) => {
              if (e.target.checked) {
                setAutoSnapshotMinutes(lastAutoSaveMinutes.current || 5);
              } else {
                if (autoSnapshotMinutes > 0) lastAutoSaveMinutes.current = autoSnapshotMinutes;
                setAutoSnapshotMinutes(0);
              }
            }}
          />
          <span>Automatically save projects</span>
        </label>
        <div className="prefs-field-row prefs-autosave-row" style={{ marginBottom: 12 }}>
          <label htmlFor="prefs-autosnap">Automatically Save Every:</label>
          <input
            id="prefs-autosnap"
            type="number"
            min={1}
            max={720}
            className="prefs-num-input"
            disabled={autoSnapshotMinutes === 0}
            value={autoSnapshotMinutes === 0 ? (lastAutoSaveMinutes.current || 5) : autoSnapshotMinutes}
            onChange={(e) => {
              const v = Math.max(1, parseInt(e.target.value, 10) || 1);
              lastAutoSaveMinutes.current = v;
              if (autoSnapshotMinutes > 0) setAutoSnapshotMinutes(v);
            }}
          />
          <span className="prefs-unit-label">minute(s)</span>
        </div>
        {/* v2.83, Derek: a chosen folder on this device gets a timestamped
            .odraft on every auto save. Checking with no folder yet opens the
            picker; the path shows beside the row. */}
        <label className="prefs-check-row">
          <input
            type="checkbox"
            checked={snapToLocalFolder && !!snapLocalFolder}
            onChange={async (e) => {
              if (!e.target.checked) { setSnapToLocalFolder(false); return; }
              let folder = snapLocalFolder;
              if (!folder) folder = (await pickFolder()) || '';
              if (!folder) return;
              setSnapLocalFolder(folder);
              setSnapToLocalFolder(true);
            }}
          />
          <span>
            Local device folder
            {snapLocalFolder && <code className="prefs-path-chip">{snapLocalFolder}</code>}
          </span>
          <button
            className="prefs-inline-btn"
            onClick={async (e) => {
              e.preventDefault();
              const folder = await pickFolder();
              if (folder) { setSnapLocalFolder(folder); setSnapToLocalFolder(true); }
            }}
          >Choose Folder…</button>
        </label>
        {/* v6.41: no disabled guards here either — same rule as the script
            save rows above. */}
        <label className="prefs-check-row">
          <input type="checkbox" checked={snapToGDrive} onChange={(e) => setSnapToGDrive(e.target.checked)} />
          <span>Google Drive — Auto Saves folder{!gConnected ? ' — connect below first' : ''}</span>
        </label>
        <label className="prefs-check-row">
          <input type="checkbox" checked={snapToOneDrive} onChange={(e) => setSnapToOneDrive(e.target.checked)} />
          <span>OneDrive — Auto Saves folder{!oConnected ? ' — connect below first' : ''}</span>
        </label>
      </section>

      <section>
        <h3>Screenshots</h3>
        {/* v3.95, Derek: where the Screenshot tool writes PNGs. Empty = the
            browser's Downloads folder. A chosen folder needs the desktop app. */}
        <div className="prefs-check-row">
          <span>
            Save screenshots to
            {screenshotFolder
              ? <code className="prefs-path-chip">{screenshotFolder}</code>
              : ' Downloads (default)'}
          </span>
          <button
            className="prefs-inline-btn"
            onClick={async (e) => {
              e.preventDefault();
              const folder = await pickFolder('Folder for screenshots');
              if (folder) setScreenshotFolder(folder);
            }}
          >Choose Folder…</button>
          {screenshotFolder && (
            <button
              className="prefs-inline-btn"
              onClick={(e) => { e.preventDefault(); setScreenshotFolder(''); }}
            >Reset to Downloads</button>
          )}
        </div>
      </section>

      <section>
        <h3>Google Drive</h3>
        <p className="prefs-hint" style={{ margin: '0 0 8px' }}>
          One-time setup: create an OAuth client (type "Web application") at
          console.cloud.google.com → APIs &amp; Services → Credentials, enable
          the Drive API, add <code>{redirectUri()}</code> as an authorized
          redirect URI, and paste the Client ID here. ScriptCraft only ever sees
          files it created (drive.file scope).
        </p>
        <div className="prefs-field-row">
          <input
            style={{ flex: 1, height: 30, background: 'var(--fd-input-bg)', color: 'var(--fd-text)', border: '1px solid var(--fd-border)', borderRadius: 4, padding: '0 8px', fontSize: 12.5 }}
            value={gdriveClientId}
            placeholder="Google OAuth Client ID (…apps.googleusercontent.com)"
            onChange={(e) => setGdriveClientId(e.target.value.trim())}
          />
          {gConnected ? (
            <button onClick={() => { disconnectGDrive(); setGConnected(false); setSaveToGDrive(false); }}>Disconnect</button>
          ) : (
            <button className="dialog-primary" disabled={!gdriveClientId || busy === 'g'} onClick={() => doConnect('g')}>
              {busy === 'g' ? 'Connecting…' : 'Connect'}
            </button>
          )}
        </div>
      </section>

      <section>
        <h3>OneDrive</h3>
        <p className="prefs-hint" style={{ margin: '0 0 8px' }}>
          One-time setup: register an app at portal.azure.com → App
          registrations (single-page application), add
          <code> {redirectUri()}</code> as the SPA redirect URI, grant
          delegated Files.ReadWrite permission, and paste the Application
          (client) ID here.
        </p>
        <div className="prefs-field-row">
          <input
            style={{ flex: 1, height: 30, background: 'var(--fd-input-bg)', color: 'var(--fd-text)', border: '1px solid var(--fd-border)', borderRadius: 4, padding: '0 8px', fontSize: 12.5 }}
            value={onedriveClientId}
            placeholder="Azure Application (client) ID"
            onChange={(e) => setOnedriveClientId(e.target.value.trim())}
          />
          {oConnected ? (
            <button onClick={() => { disconnectOneDrive(); setOConnected(false); setSaveToOneDrive(false); }}>Disconnect</button>
          ) : (
            <button className="dialog-primary" disabled={!onedriveClientId || busy === 'o'} onClick={() => doConnect('o')}>
              {busy === 'o' ? 'Connecting…' : 'Connect'}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

/* v2.35, Derek: the Tools tab is gone — the Scrapbook declutter toggle
   lives on the Scrapbook window, the Typewriter master switch lives in the
   Typewriter window, and restore-cursor went back to General > Startup. */

function GeneralTab() {
  const restoreCursor = useEditorStore((s) => s.typewriterRestoreCursor);
  const setRestoreCursor = useEditorStore((s) => s.setTypewriterRestoreCursor);
  const {
    autoLoadLastScript, setAutoLoadLastScript,
    dateFormat, setDateFormat,
    spellCheckByDefault, setSpellCheckByDefault,
    windowStartup, setWindowStartup,
    smartTypography, setSmartTypography,
    units, setUnits,
    timeFormat, setTimeFormat,
    openToLastTab, setOpenToLastTab,
  } = useSettingsStore();

  // v4.22, Derek: Backup & Restore. Dev and a release build load from different
  // origins, so their localStorage (all settings/customizations) is separate —
  // export here, import into the other app.
  const fileRef = React.useRef<HTMLInputElement>(null);
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';               // allow re-picking the same file later
    if (!file) return;
    try {
      const text = await readFileText(file);
      const ok = await confirmDialog(
        'This replaces this app\'s current settings and customizations with the ones in the file, then reloads. Your scripts are not affected.',
        { title: 'Import settings?', confirmLabel: 'Import & Reload', danger: true },
      );
      if (!ok) return;
      const { imported } = applyBackup(text);
      showToast(`Imported ${imported} settings — reloading…`);
      setTimeout(() => window.location.reload(), 500);
    } catch (err) {
      showToast((err as Error).message || 'Could not import that file.');
    }
  };

  return (
    <div className="prefs-general">
      <section>
        <h3>Startup</h3>
        {/* v2.35: back home after the Tools tab was removed. */}
        <label className="prefs-check-row">
          <input
            type="checkbox"
            checked={restoreCursor}
            onChange={(e) => setRestoreCursor(e.target.checked)}
          />
          <span>Restore the cursor position when opening a script</span>
        </label>
        <label className="prefs-check-row">
          <input
            type="checkbox"
            checked={autoLoadLastScript}
            onChange={(e) => setAutoLoadLastScript(e.target.checked)}
          />
          <span>Open the last edited script when the app starts</span>
        </label>
        <p className="prefs-hint">
          When off, the app starts at the New Script prompt and you open
          scripts from File → Open.
        </p>
        <label className="prefs-check-row">
          <span>Window on launch</span>
          <select
            value={windowStartup}
            onChange={(e) => setWindowStartup(e.target.value as 'maximized' | 'remember')}
          >
            <option value="maximized">Open maximized</option>
            <option value="remember">Remember last size and position</option>
          </select>
        </label>
        <label className="prefs-check-row">
          <input
            type="checkbox"
            checked={openToLastTab}
            onChange={(e) => setOpenToLastTab(e.target.checked)}
          />
          <span>Reopen windows on their last used tab</span>
        </label>
        <p className="prefs-hint">
          Applies to every window with tabs — this Settings window (including
          the Customize tabs), Characters, Production Tags. When off, they
          always open on their first tab.
        </p>
      </section>

      {/* v4.26, Derek: "Match the system appearance" moved to Customize >
          Themes (next to the theme picker it overrides); "Menu bar lives in"
          moved to Customize > Menu Bar (it's menu-chrome configuration, and
          the way back from native mode was stranded here). */}

      <section>
        <h3>Editing</h3>
        <label className="prefs-check-row">
          <input
            type="checkbox"
            checked={spellCheckByDefault}
            onChange={(e) => setSpellCheckByDefault(e.target.checked)}
          />
          <span>Check spelling as you type</span>
        </label>
        <p className="prefs-hint">
          Misspellings get the red squiggle. Applies to every script that
          hasn't made its own choice; a script's Tools → Spell Check toggle
          still wins once set. Names and anything typed in ALL CAPS are never
          checked.
        </p>
        {/* v3.24, Derek's menu reorg #6: the rules panel opens from HERE now
            (it left the Project > Spell Check submenu — it's configuration).
            The bus command is the same one the old menu item used. */}
        <div className="prefs-check-row">
          <button
            className="swn-add-btn"
            onClick={() => window.dispatchEvent(new CustomEvent('scriptcraft:command', { detail: 'grammarSettings' }))}
          >Grammar &amp; Spelling Settings…</button>
        </div>
        <label className="prefs-check-row">
          <input
            type="checkbox"
            checked={smartTypography}
            onChange={(e) => setSmartTypography(e.target.checked)}
          />
          <span>Replace straight quotes and dashes as you type</span>
        </label>
        <p className="prefs-hint">
          Turns "quotes" into “curly quotes” and two hyphens into an em
          dash (—). Applies immediately; text already typed is untouched.
        </p>
      </section>

      <section>
        <h3>Measurements</h3>
        <label className="prefs-check-row">
          <span>Units</span>
          <select
            value={units}
            onChange={(e) => setUnits(e.target.value as 'in' | 'cm')}
          >
            <option value="in">Inches (in)</option>
            <option value="cm">Centimeters (cm)</option>
          </select>
        </label>
        <p className="prefs-hint">
          How Page Setup shows page size and margins. Stored values never
          change — only the display converts.
        </p>
      </section>

      {/* v1.65: "Default draft label" moved into Settings > Save Options —
          the Draft label field there syncs the current script AND can set
          the default for new scripts. One field, one home. */}

      <section>
        <h3>Dates &amp; Times</h3>
        <label className="prefs-check-row">
          <span>Date format</span>
          <select
            value={dateFormat}
            onChange={(e) => setDateFormat(e.target.value as DateFormatId)}
          >
            {DATE_FORMATS.map((f) => (
              <option key={f.id} value={f.id}>{f.name} ({f.format(new Date())})</option>
            ))}
          </select>
        </label>
        <p className="prefs-hint">
          Used wherever ScriptCraft shows a date — the Version autofill, the
          changelog, and friends.
        </p>
        <label className="prefs-check-row">
          <span>Time format</span>
          <select
            value={timeFormat}
            onChange={(e) => setTimeFormat(e.target.value as '12h' | '24h')}
          >
            <option value="12h">12-hour (11:30 PM)</option>
            <option value="24h">24-hour (23:30)</option>
          </select>
        </label>
        <p className="prefs-hint">
          How times are typed and shown — for example Vomit Draft's
          &ldquo;Write until&rdquo; field and its unlock time.
        </p>
      </section>

      <LanguageSection />

      <section>
        <h3>Backup &amp; Restore</h3>
        <p className="prefs-hint">
          Settings and customizations live in this app's local storage, which
          isn't shared between separate installs (for example the development app
          and a release build load from different origins). Export them to a file
          here, then import that file in the other app to carry everything over —
          design tweaks, toolbar and ribbon layout, themes, elements,
          transitions, shortcuts, the menu system and more.
        </p>
        <div className="prefs-check-row">
          <button className="swn-add-btn" onClick={() => { downloadBackup(); showToast('Settings exported'); }}>
            Export Settings…
          </button>
          <button className="swn-add-btn" onClick={() => fileRef.current?.click()}>
            Import Settings…
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
        </div>
        <p className="prefs-hint">
          Sign-in, cloud tokens and this device's identity are left out of the
          file for safety — sign in once on the other app.
        </p>
      </section>
    </div>
  );
}

export default function PreferencesDialog({ open, onClose, editor, openTab }: {
  open: boolean;
  onClose: () => void;
  editor?: Editor | null;
  /** v1.21: open straight ON a tab — Save As sends you to Save Options. */
  openTab?: PrefTab;
}) {
  const [tab, setTab] = useState<PrefTab>('general');

  // v4.71, Derek: reopen on the last-used tab (Settings ▸ General toggle).
  // Runs on the open edge, BEFORE the openTab effect below — a targeted open
  // still lands where it was sent.
  useWindowTabMemory('settings', tab, setTab, 'general', ALL_PREF_TAB_IDS, open);

  // v1.21: land ON the tab you were sent to. Scrolling alone was useless if Settings
  // happened to be sitting on a different tab — the section wasn't even rendered.
  React.useEffect(() => {
    if (open && openTab) setTab(openTab);
  }, [open, openTab]);

  if (!open) return null;

  return (
    <FloatingWindow
      className="prefs-window"
      initial={{ w: 900, h: 660 }}
      min={{ w: 620, h: 420 }}
      onClose={onClose}
      title={<span className="tool-window-title">Settings</span>}
    >
        <div className="prefs-layout">
          <div className="prefs-tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={`prefs-tab${tab === t.id ? ' active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                <span className="prefs-tab-icon">{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
            {/* v4.64, Derek: the Customize tabs sit right here, one level up. */}
            <div className="prefs-tab-divider" aria-hidden />
            <div className="prefs-tab-caption">Customize</div>
            {CUSTOMIZE_TABS.map((t) => (
              <button
                key={t.id}
                className={`prefs-tab${tab === `cz-${t.id}` ? ' active' : ''}`}
                onClick={() => {
                  /* v6.83, Derek: "make this window work exactly like how it
                     works when opening from the customize button." The live
                     on-ribbon editing needs the bar VISIBLE — this modal
                     covers it — so the Toolbar entry hands over to the real
                     Customize window (which parks itself under the bar and
                     spotlights it) instead of embedding a dead copy. */
                  if (t.id === 'toolbar') {
                    onClose();
                    window.dispatchEvent(new CustomEvent('scriptcraft:open-customize', { detail: 'toolbar' }));
                    return;
                  }
                  setTab(`cz-${t.id}`);
                }}
              >
                <span className="prefs-tab-icon">{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>
          <div className="prefs-content">
            {tab === 'general' && <GeneralTab />}
            {tab.startsWith('cz-') && (
              <CustomizePanelsDialog
                open
                embedded
                soloCategory={tab.slice(3) as CustomizeCat}
                onClose={() => {}}
              />
            )}
            {tab === 'formats' && (
              <ScriptFormatPreferencesDialog
                embedded
                onConfirm={() => showToast('Script format preferences saved', 'success')}
              />
            )}
            {tab === 'page' && (
              <PageSetupDialog embedded onClose={() => showToast('Page setup applied', 'success')} />
            )}
            {tab === 'keys' && <KeyboardShortcutsTab />}
            {tab === 'saveloc' && <SaveLocationsTab editor={editor ?? null} />}
            {tab === 'system' && <SettingsPage embedded />}
            {tab === 'presets' && (
              <div className="prefs-section">
                <h3>Presets</h3>
                <p className="prefs-hint">
                  Export any of these to a file, or import one — the file type
                  is spelled out at the end of every filename.
                </p>
                <PresetsPanel />
              </div>
            )}
            {tab === 'defaults' && <DefaultsTab />}
          </div>
        </div>
    </FloatingWindow>
  );
}
