/**
 * PresetsPanel (v4.79, Derek) — every preset-type export AND import, one
 * surface. Rendered in three hosts:
 *   • File ▸ Export ▸ Presets… / File ▸ Import ▸ Presets… → PresetsDialog
 *   • Settings ▸ Presets (the tab)
 * The Customize footer's Import/Export buttons run the SAME customization
 * flows (exported here), so no host can drift from another.
 *
 * Every export lands as `…_<type>.json` (typedExportName — Derek's rule: the
 * type must be readable off the filename).
 */
import { useState } from 'react';
import { FaFileExport, FaFileImport } from 'react-icons/fa';
import { useThemeStore } from '../stores/themeStore';
import { useOutlinePresetStore } from '../stores/outlinePresetStore';
import { useEditorStore } from '../stores/editorStore';
import {
  buildCustomizeExport, applyCustomizeExport,
  buildFullPreset, applyFullPreset,
  typedExportName, stampedBase,
} from '../utils/presets';
import { buildBackup, applyBackup } from '../utils/settingsBackup';
import { saveFile, openTextFile } from '../utils/fileOps';
import { confirmDialog } from './ConfirmDialog';
import { showToast } from './Toast';
import { extractThemes } from './ThemesTab';
import { Modal } from './Modal';

const JSON_FILTER = [{ name: 'ScriptCraft Preset', extensions: ['json'] }];

/** Export the current customizations to a file. Shared with the Customize
 *  footer. Returns true when a file was written. */
export async function exportCustomizationsFlow(): Promise<boolean> {
  const now = new Date().toISOString();
  const ok = await saveFile(buildCustomizeExport(now), typedExportName(stampedBase(now), 'customize'), JSON_FILTER);
  if (ok) showToast('Customizations exported.', 'success');
  return ok;
}

/** Pick + confirm + apply a customization export. Shared with the Customize
 *  footer. Returns true when applied. */
export async function importCustomizationsFlow(): Promise<boolean> {
  const file = await openTextFile(JSON_FILTER);
  if (!file) return false;
  const sure = await confirmDialog(
    'Are you sure? This will override all of your current customization settings.',
    { title: 'Import Customizations', confirmLabel: 'Import', danger: true },
  );
  if (!sure) return false;
  try {
    applyCustomizeExport(file.content);
    showToast('Customizations imported.', 'success');
    return true;
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Could not import that file.', 'error');
    return false;
  }
}

interface RowSpec {
  key: string;
  label: string;
  desc: string;
  onExport?: () => void | Promise<void>;
  onImport?: () => void | Promise<void>;
  exportDisabled?: string;   // reason — renders the button disabled with a title
}

export default function PresetsPanel({ showImports = true }: { showImports?: boolean }) {
  const customThemes = useThemeStore((s) => s.customThemes);
  const outlinePresets = useOutlinePresetStore((s) => s.presets);
  const workspaceNames = Object.keys(useEditorStore((s) => s.workspaces));
  // Bump to re-render after an import changes store-backed counts.
  const [, bump] = useState(0);

  const rows: RowSpec[] = [
    {
      key: 'full',
      label: 'Full Preset',
      desc: 'Everything the app remembers — Customize, Settings, themes, shortcuts, presets. Importing overrides it all and applies fully after a restart.',
      onExport: async () => {
        const now = new Date().toISOString();
        if (await saveFile(buildFullPreset(now), typedExportName(stampedBase(now), 'preset'), JSON_FILTER)) {
          showToast('Full preset exported.', 'success');
        }
      },
      onImport: async () => {
        const file = await openTextFile(JSON_FILTER);
        if (!file) return;
        const sure = await confirmDialog(
          'Are you sure? This will override every stored preference — Customize, Settings, themes, and the rest.',
          { title: 'Import Full Preset', confirmLabel: 'Import', danger: true },
        );
        if (!sure) return;
        try {
          const { imported } = applyFullPreset(file.content);
          showToast(`Imported ${imported} preferences — restart ScriptCraft to apply everything.`, 'success');
          bump((v) => v + 1);
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Could not import that file.', 'error');
        }
      },
    },
    {
      key: 'customize',
      label: 'Customizations',
      desc: 'The Customize window’s choices: toolbar and panel layout, elements and transitions, themes, context menu, Mores & Continueds. Importing applies immediately.',
      onExport: () => void exportCustomizationsFlow(),
      onImport: async () => { if (await importCustomizationsFlow()) bump((v) => v + 1); },
    },
    {
      key: 'settings',
      label: 'Settings',
      desc: 'The Settings window’s preferences (the same file as Settings ▸ System ▸ Export Settings). Importing applies fully after a restart.',
      onExport: async () => {
        const now = new Date().toISOString();
        if (await saveFile(buildBackup(now), typedExportName(stampedBase(now), 'settings'), JSON_FILTER)) {
          showToast('Settings exported.', 'success');
        }
      },
      onImport: async () => {
        const file = await openTextFile(JSON_FILTER);
        if (!file) return;
        const sure = await confirmDialog(
          'Import these settings? They override your current preferences and apply fully after a restart.',
          { title: 'Import Settings', confirmLabel: 'Import', danger: true },
        );
        if (!sure) return;
        try {
          const res = applyBackup(file.content);
          showToast(`Imported ${res.imported} settings — restart ScriptCraft to apply everything.`, 'success');
          bump((v) => v + 1);
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Could not import that file.', 'error');
        }
      },
    },
    {
      key: 'themes',
      label: 'Themes',
      desc: customThemes.length
        ? `Your ${customThemes.length} custom theme${customThemes.length === 1 ? '' : 's'} in one file. (Single-theme export lives in Customize ▸ Themes.)`
        : 'Your custom themes in one file. No custom themes yet — create one in Customize ▸ Themes.',
      exportDisabled: customThemes.length ? undefined : 'No custom themes to export',
      onExport: async () => {
        const payload = { kind: 'scriptcraft-themes', version: 1, themes: customThemes };
        if (await saveFile(JSON.stringify(payload, null, 2), typedExportName('scriptcraft-all', 'themes'), JSON_FILTER)) {
          showToast(`Exported ${customThemes.length} theme${customThemes.length === 1 ? '' : 's'}.`, 'success');
        }
      },
      onImport: async () => {
        const file = await openTextFile(JSON_FILTER);
        if (!file) return;
        try {
          const found = extractThemes(JSON.parse(file.content));
          if (!found.length) { showToast('No themes found in that file.', 'info'); return; }
          const th = useThemeStore.getState();
          for (const t of found) th.saveCustomTheme(t);
          showToast(`Imported ${found.length} theme${found.length === 1 ? '' : 's'}.`, 'success');
          bump((v) => v + 1);
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Could not read that file.', 'error');
        }
      },
    },
    {
      key: 'workspaces',
      label: 'Workspaces',
      desc: workspaceNames.length
        ? `Your ${workspaceNames.length} saved layout${workspaceNames.length === 1 ? '' : 's'} — which tools are open, where, and how big.`
        : 'Saved layouts — which tools are open, where, and how big. None saved yet; save one from View ▸ Workspaces.',
      exportDisabled: workspaceNames.length ? undefined : 'No workspaces to export',
      onExport: async () => {
        const st = useEditorStore.getState();
        const payload = {
          app: 'ScriptCraft', kind: 'workspaces-export', version: 1,
          workspaces: st.workspaces, workspaceOrder: st.workspaceOrder,
        };
        if (await saveFile(JSON.stringify(payload, null, 2), typedExportName('scriptcraft', 'workspaces'), JSON_FILTER)) {
          showToast(`Exported ${workspaceNames.length} workspace${workspaceNames.length === 1 ? '' : 's'}.`, 'success');
        }
      },
      onImport: async () => {
        // Accepts our export, a raw workspaces map, or another project's
        // .odraft — the same shapes View ▸ Workspaces ▸ Import accepts, since
        // importWorkspaces does the merging either way.
        const file = await openTextFile([{ name: 'ScriptCraft Workspaces or Script', extensions: ['json', 'odraft'] }]);
        if (!file) return;
        try {
          const doc = JSON.parse(file.content) as Record<string, unknown>;
          const map = (doc.workspaces ?? (doc.content as Record<string, unknown> | undefined)?._workspaces ?? doc) as Record<string, never>;
          if (!map || typeof map !== 'object' || Array.isArray(map)) { showToast('No workspaces found in that file.', 'info'); return; }
          const added = useEditorStore.getState().importWorkspaces(map);
          showToast(added.length ? `Imported ${added.length} workspace${added.length === 1 ? '' : 's'}.` : 'No workspaces found in that file.', added.length ? 'success' : 'info');
          bump((v) => v + 1);
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Could not read that file.', 'error');
        }
      },
    },
    {
      key: 'outline',
      label: 'Outline Presets',
      desc: outlinePresets.length
        ? `Your ${outlinePresets.length} saved outline arrangement${outlinePresets.length === 1 ? '' : 's'}.`
        : 'Your saved outline arrangements. None saved yet — save one from the Outline’s Arrangement menu.',
      exportDisabled: outlinePresets.length ? undefined : 'No outline presets to export',
      onExport: async () => {
        const store = useOutlinePresetStore.getState();
        if (await saveFile(store.exportJson(), typedExportName('scriptcraft', 'outline-presets'), JSON_FILTER)) {
          showToast('Outline presets exported.', 'success');
        }
      },
      onImport: async () => {
        const file = await openTextFile(JSON_FILTER);
        if (!file) return;
        const result = useOutlinePresetStore.getState().importPresets(file.content);
        if (result.error) showToast(result.error, 'error');
        else {
          showToast(`Imported ${result.added} preset${result.added === 1 ? '' : 's'}${result.skipped ? ` (${result.skipped} skipped)` : ''}.`, result.added > 0 ? 'success' : 'info');
          bump((v) => v + 1);
        }
      },
    },
  ];

  return (
    <div className="fs-presets">
      {rows.map((r) => (
        <div key={r.key} className="fs-presets-row">
          <div className="fs-presets-meta">
            <div className="fs-presets-label">{r.label}</div>
            <div className="fs-presets-desc">{r.desc}</div>
          </div>
          <div className="fs-presets-actions">
            <button
              className="fs-presets-btn"
              disabled={!!r.exportDisabled}
              title={r.exportDisabled ?? `Export ${r.label.toLowerCase()} to a file`}
              onClick={() => void r.onExport?.()}
            ><FaFileExport aria-hidden /> Export</button>
            {showImports && r.onImport && (
              <button
                className="fs-presets-btn"
                title={`Import ${r.label.toLowerCase()} from a file`}
                onClick={() => void r.onImport?.()}
              ><FaFileImport aria-hidden /> Import</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/** The File ▸ Export / File ▸ Import "Presets…" window — the same panel in a
 *  standard dialog shell. */
export function PresetsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <Modal onClose={onClose} boxClassName="fs-presets-dialog">
        <div className="dialog-header">
          Presets
          <button className="fs-dialog-x" onClick={onClose} title="Close">&times;</button>
        </div>
        <div className="dialog-body">
          <PresetsPanel />
        </div>
    </Modal>
  );
}
