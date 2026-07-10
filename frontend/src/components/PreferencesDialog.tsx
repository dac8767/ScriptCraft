import type { Editor } from '@tiptap/core';
import React, { useState } from 'react';
import { FaSlidersH, FaColumns, FaFileAlt, FaRulerCombined, FaCommentDots, FaCog, FaCloudUploadAlt } from 'react-icons/fa';
import { applyDraftNumber } from './SetDraftDialog';
import { useEditorStore } from '../stores/editorStore';
import { useSettingsStore } from '../stores/settingsStore';
import MoresContdsDialog from './MoresContdsDialog';
import PageSetupDialog from './PageSetupDialog';
import ScriptFormatPreferencesDialog from './ScriptFormatPreferencesDialog';
import CustomizePanelsDialog from './CustomizePanelsDialog';
import SettingsPage from './SettingsPage';
import { showToast } from './Toast';
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
  { id: 'layout', label: 'Layout', icon: <FaColumns /> },
  { id: 'formats', label: 'Templates', icon: <FaFileAlt /> },
  { id: 'page', label: 'Page Setup', icon: <FaRulerCombined /> },
  { id: 'mores', label: 'Mores & Continueds', icon: <FaCommentDots /> },
  { id: 'saveloc', label: 'Save Options', icon: <FaCloudUploadAlt /> },
  { id: 'system', label: 'System', icon: <FaCog /> },
];

const RETENTION_CHOICES: Array<{ keep: number; label: string }> = [
  { keep: 0, label: 'Keep all snapshots' },
  { keep: 10, label: 'Keep newest 10' },
  { keep: 25, label: 'Keep newest 25' },
  { keep: 50, label: 'Keep newest 50' },
  { keep: 100, label: 'Keep newest 100' },
];

const SNAPSHOT_CHOICES: Array<{ minutes: number; label: string }> = [
  { minutes: 0, label: 'Off (manual only)' },
  { minutes: 5, label: 'Every 5 minutes' },
  { minutes: 10, label: 'Every 10 minutes' },
  { minutes: 15, label: 'Every 15 minutes' },
  { minutes: 30, label: 'Every 30 minutes' },
  { minutes: 60, label: 'Every hour' },
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
  const [cat, setCat] = React.useState<'menu' | 'toolbar' | 'panels'>('menu');
  return (
    <div className="prefs-general">
      <div className="prefs-subtabs">
        {([['menu', 'Menu Bar'], ['toolbar', 'Tool Bar'], ['panels', 'Side Panels']] as const).map(([id, label]) => (
          <button
            key={id}
            className={cat === id ? 'active' : ''}
            onClick={() => setCat(id)}
          >{label}</button>
        ))}
      </div>
      <CustomizePanelsDialog open embedded category={cat} onClose={() => {}} />
    </div>
  );
}

function DraftNumberRow({ editor }: { editor: Editor | null }) {
  const draftLabel = useEditorStore((s) => s.draftLabel);
  const [value, setValue] = React.useState(draftLabel);
  React.useEffect(() => { setValue(draftLabel); }, [draftLabel]);
  const trimmed = value.trim();
  return (
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
    </div>
  );
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
    gdriveClientId, setGdriveClientId,
    onedriveClientId, setOnedriveClientId,
    collabAuth,
  } = useSettingsStore();
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
        <p className="prefs-hint">
          Mirrors Production → Set Draft Number: updates the saved draft label
          and the Title Page draft line (keeping its date).
        </p>
      </section>

      <section>
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
        <h3>Snapshot Locations</h3>
        <label className="prefs-check-row">
          <input type="checkbox" checked disabled />
          <span>Local version history (always on)</span>
        </label>
        <label className="prefs-check-row">
          <input type="checkbox" checked={snapToCloud} onChange={(e) => setSnapToCloud(e.target.checked)} disabled={!signedIn} />
          <span>Cloud — timestamped copies{!signedIn ? ' — sign in above first' : ''}</span>
        </label>
        <label className="prefs-check-row">
          <input type="checkbox" checked={snapToGDrive} onChange={(e) => setSnapToGDrive(e.target.checked)} disabled={!gConnected} />
          <span>Google Drive — Snapshots folder{!gConnected ? ' — connect below first' : ''}</span>
        </label>
        <label className="prefs-check-row">
          <input type="checkbox" checked={snapToOneDrive} onChange={(e) => setSnapToOneDrive(e.target.checked)} disabled={!oConnected} />
          <span>OneDrive — Snapshots folder{!oConnected ? ' — connect below first' : ''}</span>
        </label>
        <p className="prefs-hint">
          The local version history (Tools → Script History) is always kept.
          Every checked location additionally receives a timestamped copy of
          the script whenever a snapshot is taken, manual or automatic.
        </p>
      </section>

      <section>
        <h3>Automatic snapshots</h3>
        <div className="prefs-field-row">
          <label htmlFor="prefs-autosnap">Take a snapshot</label>
          <select
            id="prefs-autosnap"
            value={autoSnapshotMinutes}
            onChange={(e) => setAutoSnapshotMinutes(parseInt(e.target.value, 10) || 0)}
          >
            {SNAPSHOT_CHOICES.map((c) => (
              <option key={c.minutes} value={c.minutes}>{c.label}</option>
            ))}
          </select>
        </div>
        <p className="prefs-hint">
          Snapshots are version checkpoints of the whole project (File →
          Script History → Snapshots). Automatic snapshots are taken silently
          and skipped when nothing has changed since the last one, so turning
          this on won't create empty entries.
        </p>
        <div className="prefs-field-row" style={{ marginTop: 14 }}>
          <label htmlFor="prefs-autosnap-keep">Retention</label>
          <select
            id="prefs-autosnap-keep"
            value={autoSnapshotKeep}
            onChange={(e) => setAutoSnapshotKeep(parseInt(e.target.value, 10) || 0)}
          >
            {RETENTION_CHOICES.map((c) => (
              <option key={c.keep} value={c.keep}>{c.label}</option>
            ))}
          </select>
        </div>
        <p className="prefs-hint">
          When a limit is set, the oldest snapshots beyond it are squashed into
          a single baseline checkpoint after each automatic snapshot. The
          retained snapshots are preserved exactly — only history older than
          the window is compacted.
        </p>
      </section>

      <section>
        <h3>Google Drive</h3>
        <p className="prefs-hint" style={{ margin: '0 0 8px' }}>
          One-time setup: create an OAuth client (type "Web application") at
          console.cloud.google.com → APIs &amp; Services → Credentials, enable
          the Drive API, add <code>{redirectUri()}</code> as an authorized
          redirect URI, and paste the Client ID here. FreeScript only ever sees
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

function GeneralTab() {
  const {
    autoLoadLastScript, setAutoLoadLastScript,
  } = useSettingsStore();

  return (
    <div className="prefs-general">
      <section>
        <h3>Startup</h3>
        <label className="prefs-check-row">
          <input
            type="checkbox"
            checked={autoLoadLastScript}
            onChange={(e) => setAutoLoadLastScript(e.target.checked)}
          />
          <span>Open the last edited script when the app starts</span>
        </label>
        <p className="prefs-hint">
          When off, the app starts on the blank editor and you open scripts
          from File → Open.
        </p>
      </section>


      <LanguageSection />
    </div>
  );
}

export default function PreferencesDialog({ open, onClose, editor }: { open: boolean; onClose: () => void; editor?: Editor | null }) {
  const [tab, setTab] = useState<PrefTab>('general');

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
