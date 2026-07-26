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
import { applyCustomizeExport } from '../utils/presets';
import { openTextFile } from '../utils/fileOps';
import { confirmDialog } from './ConfirmDialog';

/** Where new scripts get saved. The values ARE Settings ▸ Save Options — which
 *  is also why they already describe the most recently saved script: that
 *  script was saved with exactly these destinations. */
export function SaveLocationsField() {
  const {
    saveToCloud, setSaveToCloud,
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
        <input type="checkbox" checked={saveToCloud} onChange={(e) => setSaveToCloud(e.target.checked)} />
        <span>ScriptCraft Cloud</span>
      </label>
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

/** "Customize from a file" — accepts a customizations preset. Shared by both
 *  setups; runs the same applyCustomizeExport the Customize footer does. */
export function CustomizeFromFileField() {
  const [applied, setApplied] = useState<string | null>(null);
  const run = async () => {
    const file = await openTextFile([{ name: 'ScriptCraft Preset', extensions: ['json'] }]);
    if (!file) return;
    const sure = await confirmDialog(
      'Are you sure? This will override all of your current customization settings.',
      { title: 'Customize From File', confirmLabel: 'Apply', danger: true },
    );
    if (!sure) return;
    try {
      applyCustomizeExport(file.content);
      setApplied(file.name);
      showToast('Customizations applied.', 'success');
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
        ? <span className="fs-setup-applied">Applied from {applied}</span>
        : <span className="fs-setup-hint">Copy the layout and look from a customizations preset.</span>}
    </div>
  );
}
