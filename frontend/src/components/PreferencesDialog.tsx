import type { Editor } from '@tiptap/core';
import React, { useState } from 'react';
import { FaSlidersH, FaColumns, FaFileAlt, FaRulerCombined, FaCommentDots, FaCog, FaCloudUploadAlt } from 'react-icons/fa';
import { applyDraftNumber } from './SetDraftDialog';
import { useEditorStore } from '../stores/editorStore';
import { useSettingsStore } from '../stores/settingsStore';
import { DATE_FORMATS, type DateFormatId } from '../utils/dateFormat';
import MoresContdsDialog from './MoresContdsDialog';
import PageSetupDialog from './PageSetupDialog';
import ScriptFormatPreferencesDialog from './ScriptFormatPreferencesDialog';
import CustomizePanelsDialog from './CustomizePanelsDialog';
import SettingsPage from './SettingsPage';
import { showToast } from './Toast';
import { downloadBackup, applyBackup, readFileText } from '../utils/settingsBackup';
import { confirmDialog } from './ConfirmDialog';
import { spellChecker, BUILTIN_LANGUAGE } from '../editor/spellchecker';
import { BUILTIN, CATALOG, urlsFor } from '../editor/languageCatalog';
import { useState as useStateReact, useEffect as useEffectReact } from 'react';
import {
  connectGDrive, connectOneDrive, gdriveConnected, onedriveConnected,
  disconnectGDrive, disconnectOneDrive,
} from '../services/saveLocations';
import { redirectUri } from '../services/oauthPkce';

/* ─────────────────────────────────────────────────────────────────────────
   Settings (File → Settings…)

   One window for the settings that used to be scattered across menus:
   - General            — startup + automatic snapshots
   - Customize Layout   — same live settings as View → Customize Layout
   - Script Formats     — formerly Format → Script Format Preferences…
   - Page Setup         — formerly File → Page Setup…
   - Mores & Continueds — formerly Format → Mores & Continueds…

   The last four embed the existing dialogs in `embedded` mode, so both entry
   points (where they still exist) edit exactly the same state.
   ───────────────────────────────────────────────────────────────────────── */

type PrefTab = 'general' | 'layout' | 'formats' | 'page' | 'mores' | 'saveloc' | 'system';

const TABS: Array<{ id: PrefTab; label: string; icon: React.ReactNode }> = [
  // App-wide first, then writing setup, then data, then system.
  { id: 'general', label: 'General', icon: <FaSlidersH /> },
  { id: 'saveloc', label: 'Save Options', icon: <FaCloudUploadAlt /> },
  { id: 'layout', label: 'Customize', icon: <FaColumns /> },
  { id: 'formats', label: 'Templates', icon: <FaFileAlt /> },
  { id: 'page', label: 'Page Setup', icon: <FaRulerCombined /> },
  { id: 'mores', label: 'Mores & Continueds', icon: <FaCommentDots /> },
  { id: 'system', label: 'System', icon: <FaCog /> },
];

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



function LayoutTab() {
  return <CustomizePanelsDialog open embedded onClose={() => {}} />;
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
    <p className="prefs-hint">
      Apply mirrors Production → Set Draft Number: updates the saved draft
      label and the Title Page draft line (keeping its date). Set as Default
      makes it what new scripts start as — currently
      &ldquo;{defaultDraftLabel}&rdquo;.
    </p>
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
    autoSnapshotKeep, setAutoSnapshotKeep,
    saveToCloud, setSaveToCloud,
    saveToGDrive, setSaveToGDrive,
    saveToOneDrive, setSaveToOneDrive,
    snapToCloud, setSnapToCloud,
    snapToGDrive, setSnapToGDrive,
    snapToOneDrive, setSnapToOneDrive,
    snapToLocalFolder, setSnapToLocalFolder,
    snapLocalFolder, setSnapLocalFolder,
    screenshotFolder, setScreenshotFolder,
    gdriveClientId, setGdriveClientId,
    onedriveClientId, setOnedriveClientId,
    collabAuth,
  } = useSettingsStore();
  const lastAutoSaveMinutes = React.useRef(autoSnapshotMinutes > 0 ? autoSnapshotMinutes : 5);
  const [gConnected, setGConnected] = useStateReact(gdriveConnected());
  const [oConnected, setOConnected] = useStateReact(onedriveConnected());
  const [busy, setBusy] = useStateReact<string | null>(null);
  const signedIn = !!collabAuth.user;

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
        <h3>Collaborator Account</h3>
        {signedIn ? (
          <div className="prefs-account-row">
            <span>
              Signed in as <strong>{collabAuth.user!.displayName}</strong>
              {' '}({collabAuth.user!.email})
            </span>
          </div>
        ) : (
          <div className="prefs-account-row">
            <span>Not signed in — the Cloud save location and collaboration need an account.</span>
            <button
              className="dialog-primary"
              onClick={() => window.dispatchEvent(new CustomEvent('opendraft:auth-required'))}
            >Sign In / Create Account</button>
          </div>
        )}
        <p className="prefs-hint">
          Full account management (sign out, verification, devices) lives in the
          System tab.
        </p>
      </section>

      <section>
        <h3>Draft Number</h3>
        <DraftNumberRow editor={editor} />
      </section>

      <section id="prefs-save-locations">
        <h3>Script Save Locations</h3>
        <p className="prefs-hint" style={{ margin: '0 0 10px' }}>
          Save and Save As always write to the script's home (local or cloud,
          wherever it was created). Every location checked below receives a
          copy at the same time. If a secondary location fails, the save still
          succeeds — you'll get an error to acknowledge.
        </p>
        <label className="prefs-check-row">
          <input type="checkbox" checked disabled />
          <span>Local System (always on)</span>
        </label>
        <label className="prefs-check-row">
          <input type="checkbox" checked={saveToCloud} onChange={(e) => setSaveToCloud(e.target.checked)} />
          <span>Cloud - Collaborator Account{!signedIn ? ' — sign in above first' : ''}</span>
        </label>
        <label className="prefs-check-row">
          <input type="checkbox" checked={saveToGDrive} onChange={(e) => setSaveToGDrive(e.target.checked)} disabled={!gConnected} />
          <span>Google Drive{!gConnected ? ' — connect below first' : ''}</span>
        </label>
        <label className="prefs-check-row">
          <input type="checkbox" checked={saveToOneDrive} onChange={(e) => setSaveToOneDrive(e.target.checked)} disabled={!oConnected} />
          <span>OneDrive{!oConnected ? ' — connect below first' : ''}</span>
        </label>
      </section>

      <section>
        <h3>Auto Save Locations</h3>
        {/* v3.25, Derek (task #139): the two "local" rows read like the same
            thing. Each row now says what it actually IS — invisible in-app
            history vs real files in a folder you choose. */}
        <label className="prefs-check-row">
          <input type="checkbox" checked disabled />
          <span>Local version history (always on)</span>
        </label>
        <p className="prefs-hint prefs-subhint">
          Kept inside the app — not files on disk. Browse, compare and restore
          any version from Project → Script History.
        </p>
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
            Local folder — timestamped copies
            {snapLocalFolder ? <code className="prefs-path-chip">{snapLocalFolder}</code> : ' — choose a folder'}
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
        <p className="prefs-hint prefs-subhint">
          Real .odraft files, one per auto save, named with the date and time —
          in a folder you pick (for Finder, Time Machine, or a synced folder).
        </p>
        <label className="prefs-check-row">
          <input type="checkbox" checked={snapToCloud} onChange={(e) => setSnapToCloud(e.target.checked)} disabled={!signedIn} />
          <span>Cloud — timestamped copies{!signedIn ? ' — sign in above first' : ''}</span>
        </label>
        <label className="prefs-check-row">
          <input type="checkbox" checked={snapToGDrive} onChange={(e) => setSnapToGDrive(e.target.checked)} disabled={!gConnected} />
          <span>Google Drive — Auto Saves folder{!gConnected ? ' — connect below first' : ''}</span>
        </label>
        <label className="prefs-check-row">
          <input type="checkbox" checked={snapToOneDrive} onChange={(e) => setSnapToOneDrive(e.target.checked)} disabled={!oConnected} />
          <span>OneDrive — Auto Saves folder{!oConnected ? ' — connect below first' : ''}</span>
        </label>
        <p className="prefs-hint">
          The local version history (Project → Script History) is always kept.
          Every checked location additionally receives a timestamped copy of
          the script whenever an auto save is taken, manual or automatic.
        </p>
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
        <p className="prefs-hint prefs-subhint">
          The Screenshot toolbar button saves PNGs here. Leave it on Downloads to
          use the browser's normal download folder.
        </p>
      </section>

      <section>
        <h3>Auto Saves</h3>
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
        <div className="prefs-field-row prefs-autosave-row">
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
        <div className="prefs-field-row prefs-autosave-row">
          <label htmlFor="prefs-autosnap-keep">Maximum Project Versions:</label>
          <input
            id="prefs-autosnap-keep"
            type="number"
            min={0}
            max={999}
            className="prefs-num-input"
            value={autoSnapshotKeep}
            onChange={(e) => setAutoSnapshotKeep(Math.max(0, parseInt(e.target.value, 10) || 0))}
          />
        </div>
        <p className="prefs-hint">
          Auto saves are version checkpoints of the whole project (Tools →
          Script History → Auto Saves), taken silently and skipped when nothing
          has changed. When a maximum is set, the oldest auto saves beyond it
          are squashed into a single baseline checkpoint — retained versions are
          preserved exactly. 0 keeps every version.
        </p>
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
    followSystemTheme, setFollowSystemTheme,
    menuSystem, setMenuSystem,
    smartTypography, setSmartTypography,
    units, setUnits,
    timeFormat, setTimeFormat,
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
      </section>

      <section>
        <h3>Appearance</h3>
        <label className="prefs-check-row">
          <input
            type="checkbox"
            checked={followSystemTheme}
            onChange={(e) => setFollowSystemTheme(e.target.checked)}
          />
          <span>Match the system's light or dark appearance</span>
        </label>
        <p className="prefs-hint">
          Switches between the Dark and Light themes when macOS does. Picking
          a theme by hand still works; the next system change follows again.
        </p>
      </section>

      <section>
        <h3>Menus</h3>
        <label className="prefs-field-row">
          <span>Menu bar lives in:</span>
          <select value={menuSystem} onChange={(e) => setMenuSystem(e.target.value as 'inWindow' | 'native')}>
            <option value="inWindow">The app window (classic)</option>
            <option value="native">The macOS menu bar</option>
          </select>
        </label>
        <p className="prefs-hint">
          v2.93 (experimental): the same menus, installed in the real menu bar
          next to the  — the in-window bar hides and the script gains its
          room. Icons, the table-size grid, and drag-to-reorder stay in-window
          only. Switching back here restores the classic bar instantly.
        </p>
      </section>

      <section>
        <h3>Editing</h3>
        <label className="prefs-check-row">
          <input
            type="checkbox"
            checked={spellCheckByDefault}
            onChange={(e) => setSpellCheckByDefault(e.target.checked)}
          />
          <span>Check spelling as you type in new scripts</span>
        </label>
        <p className="prefs-hint">
          Each script's own Tools → Spell Check toggle still wins once set.
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

  // v1.21: land ON the tab you were sent to. Scrolling alone was useless if Settings
  // happened to be sitting on a different tab — the section wasn't even rendered.
  React.useEffect(() => {
    if (open && openTab) setTab(openTab);
  }, [open, openTab]);

  if (!open) return null;

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-box prefs-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          Settings
          <button className="fs-dialog-x" onClick={onClose} title="Close">&times;</button>
        </div>
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
          </div>
          <div className="prefs-content">
            {tab === 'general' && <GeneralTab />}
            {tab === 'layout' && (
              <LayoutTab />
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
            {tab === 'mores' && (
              <MoresContdsDialog embedded onClose={() => showToast('Mores & Continueds applied', 'success')} />
            )}
            {tab === 'saveloc' && <SaveLocationsTab editor={editor ?? null} />}
            {tab === 'system' && <SettingsPage embedded />}
          </div>
        </div>
      </div>
    </div>
  );
}
