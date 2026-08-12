/**
 * setupFields (v4.80, Derek) — the setup controls the Manual new-script window
 * and the Guided wizard BOTH render. One implementation each, so the two
 * setups can never disagree, and each one writes through the SAME store
 * setters the Settings window uses — a choice made here IS the setting, not a
 * copy of it.
 */
import { useState } from 'react';
import { FaBoxOpen, FaFolderOpen } from 'react-icons/fa';
import { useSettingsStore } from '../stores/settingsStore';
import { isTauri } from '../services/platform';
import { showToast } from './Toast';
import { applyCustomizeExport, applySettingsFromScriptFile } from '../utils/presets';
import { openTextFile } from '../utils/fileOps';
import { confirmDialog } from './ConfirmDialog';

/** Where new scripts get saved. The values ARE Settings ▸ Save Options — which
 *  is also why they already describe the most recently saved script: that
 *  script was saved with exactly these destinations. */
export function SaveLocationsField() {
  const {
    localSaveFolder, setLocalSaveFolder,
    saveToGDrive, setSaveToGDrive,
    saveToOneDrive, setSaveToOneDrive,
  } = useSettingsStore();

  const pickFolder = async () => {
    if (!isTauri()) {
      showToast('Choosing a folder needs the desktop app.', 'info');
      return;
    }
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const dir = await open({ directory: true, multiple: false });
      if (typeof dir === 'string') setLocalSaveFolder(dir);
    } catch {
      showToast('Could not open the folder picker.', 'error');
    }
  };

  return (
    <div className="fs-setup-savelocs">
      <label className="fs-setup-check">
        <input type="checkbox" checked={saveToGDrive} onChange={(e) => setSaveToGDrive(e.target.checked)} />
        <span>Google Drive</span>
      </label>
      <label className="fs-setup-check">
        <input type="checkbox" checked={saveToOneDrive} onChange={(e) => setSaveToOneDrive(e.target.checked)} />
        <span>OneDrive</span>
      </label>
      <div className="fs-setup-folderrow">
        <label className="fs-setup-check">
          <input
            type="checkbox"
            checked={!!localSaveFolder}
            onChange={(e) => { if (!e.target.checked) setLocalSaveFolder(''); else void pickFolder(); }}
          />
          <span>A folder on this computer</span>
        </label>
        <button type="button" className="fs-setup-linkbtn" onClick={() => void pickFolder()}>
          <FaFolderOpen aria-hidden /> {localSaveFolder ? 'Change…' : 'Choose…'}
        </button>
      </div>
      {localSaveFolder && <div className="fs-setup-folderpath" title={localSaveFolder}>{localSaveFolder}</div>}
      <p className="fs-setup-hint">
        The script is always kept on this device; these are extra copies. Same
        as Settings ▸ Save Options, and what your last script used.
      </p>
    </div>
  );
}

/** v4.83: how often the script auto-saves a version, how many are kept, and
 *  whether timestamped copies land in a folder. Same store fields as
 *  Settings ▸ General / Save Options — this is a friendlier framing of them,
 *  not a second set of values. */
export function AutosaveField() {
  const {
    autoSnapshotMinutes, setAutoSnapshotMinutes,
    snapToLocalFolder, setSnapToLocalFolder,
    snapLocalFolder, setSnapLocalFolder,
  } = useSettingsStore();

  const pickFolder = async (): Promise<string> => {
    if (!isTauri()) { showToast('Choosing a folder needs the desktop app.', 'info'); return ''; }
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const dir = await open({ directory: true, multiple: false });
      return typeof dir === 'string' ? dir : '';
    } catch {
      showToast('Could not open the folder picker.', 'error');
      return '';
    }
  };

  return (
    <div className="fs-setup-savelocs">
      <label className="fs-setup-check">
        <span>Save a version every</span>
        <select
          value={autoSnapshotMinutes}
          onChange={(e) => setAutoSnapshotMinutes(Number(e.target.value))}
        >
          <option value={0}>never</option>
          <option value={5}>5 minutes</option>
          <option value={10}>10 minutes</option>
          <option value={15}>15 minutes</option>
          <option value={30}>30 minutes</option>
          <option value={60}>hour</option>
        </select>
      </label>
      <div className="fs-setup-folderrow">
        <label className="fs-setup-check">
          <input
            type="checkbox"
            checked={snapToLocalFolder && !!snapLocalFolder}
            onChange={async (e) => {
              if (!e.target.checked) { setSnapToLocalFolder(false); return; }
              const folder = snapLocalFolder || (await pickFolder());
              if (!folder) return;
              setSnapLocalFolder(folder);
              setSnapToLocalFolder(true);
            }}
          />
          <span>Also drop a timestamped copy in a folder</span>
        </label>
        <button
          type="button"
          className="fs-setup-linkbtn"
          onClick={async () => {
            const folder = await pickFolder();
            if (folder) { setSnapLocalFolder(folder); setSnapToLocalFolder(true); }
          }}
        ><FaFolderOpen aria-hidden /> {snapLocalFolder ? 'Change…' : 'Choose…'}</button>
      </div>
      {snapLocalFolder && <div className="fs-setup-folderpath" title={snapLocalFolder}>{snapLocalFolder}</div>}
      <p className="fs-setup-hint">
        Versions live inside the app — browse, compare and restore any of them
        from Project ▸ Script History. This is on top of the normal saving,
        which never stops.
      </p>
    </div>
  );
}

/** "Customize from a file" — Derek's spec (v4.80/v4.83): EITHER a
 *  customizations preset OR an existing ScriptCraft script, whose settings get
 *  copied. One picker takes both and dispatches on what the file actually is,
 *  so the user never has to know which kind they have.
 *
 *  What a .odraft can give is genuinely less than a preset (chrome layout is
 *  app-level and simply isn't in a script file), so the result line says what
 *  was copied rather than implying the whole look came across. */
export function CustomizeFromFileField() {
  const [applied, setApplied] = useState<string | null>(null);
  const run = async () => {
    const file = await openTextFile([
      { name: 'ScriptCraft Preset or Script', extensions: ['json', 'odraft'] },
    ]);
    if (!file) return;
    // Which kind is it? Ask the file, not the extension — a preset saved with
    // the wrong extension should still work.
    let isScript = false;
    try {
      const probe = JSON.parse(file.content) as { format?: unknown };
      isScript = probe?.format === 'opendraft-script';
    } catch {
      showToast('That file is not valid JSON.', 'error');
      return;
    }
    const sure = await confirmDialog(
      isScript
        ? 'Copy this script’s themes, page layout and format? This replaces those settings.'
        : 'Are you sure? This will override all of your current customization settings.',
      { title: 'Customize From File', confirmLabel: 'Apply', danger: true },
    );
    if (!sure) return;
    try {
      if (isScript) {
        const r = applySettingsFromScriptFile(file.content);
        const parts = [
          r.themes ? `${r.themes} theme${r.themes === 1 ? '' : 's'}` : '',
          r.pageLayout ? 'page layout' : '',
          r.templateId ? 'format' : '',
        ].filter(Boolean);
        setApplied(parts.length ? `${parts.join(', ')} from ${file.name}` : null);
        showToast(parts.length ? `Copied ${parts.join(', ')}.` : 'That script carried no settings to copy.', parts.length ? 'success' : 'info');
      } else {
        applyCustomizeExport(file.content);
        setApplied(file.name);
        showToast('Customizations applied.', 'success');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not read that file.', 'error');
    }
  };
  return (
    <div className="fs-setup-fromfile">
      <button type="button" className="fs-setup-linkbtn" onClick={() => void run()}>
        <FaBoxOpen aria-hidden /> Customize from a file…
      </button>
      {applied
        ? <span className="fs-setup-applied">Applied: {applied}</span>
        : <span className="fs-setup-hint">Use a customizations preset, or copy the settings from an existing ScriptCraft script.</span>}
    </div>
  );
}
