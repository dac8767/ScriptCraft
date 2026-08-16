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
import { SCRIPT_EXTS } from '../utils/scriptFileExt';
import { FaFileExport, FaFileImport } from 'react-icons/fa';
import { useThemeStore } from '../stores/themeStore';
import { useOutlinePresetStore } from '../stores/outlinePresetStore';
import { useEditorStore } from '../stores/editorStore';
import {
  buildCustomizeExport, applyCustomizeExport,
  buildPresetBundle, readPresetFile, applyPresetFile, presetPart,
  PRESET_PARTS, type PresetPartId,
  typedExportName, stampedBase,
} from '../utils/presets';
import { saveFile, openTextFile } from '../utils/fileOps';
import { confirmDialog } from './ConfirmDialog';
import { showToast } from './Toast';
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

/* v6.63, Derek: "I want one single preset file that can include all the
   information for each item on the current preset list. The tab has a
   checklist of each of these items. If you check an item, preset
   information for that item will be included in the single preset file."
   The rows render from PRESET_PARTS (utils/presets.ts) — the same registry
   that builds the file and applies it, so a checkbox can't drift from what
   the file actually carries. */
const PART_DESC: Record<PresetPartId, (n: number | null) => string> = {
  settings: () => 'Every preference the app remembers — the Settings window, shortcuts, spelling, backup and file options. Applies fully after a restart.',
  customize: () => 'The Customize window’s choices: toolbar and panel layout, elements and transitions, theme order, context menu, Mores & Continueds. Applies immediately.',
  themes: (n) => (n ? `Your ${n} custom theme${n === 1 ? '' : 's'}.` : 'Your custom themes. None yet — create one in Customize ▸ Themes.'),
  workspaces: (n) => (n ? `Your ${n} saved layout${n === 1 ? '' : 's'} — which tools are open, where, and how big.` : 'Saved layouts — which tools are open, where and how big. None saved yet; save one from View ▸ Workspaces.'),
  outline: (n) => (n ? `Your ${n} saved outline arrangement${n === 1 ? '' : 's'}.` : 'Your saved outline arrangements. None saved yet — save one from the Outline’s Presets menu.'),
  /* v6.70, Derek: "add annotation presets … check the app for any additional
     presets missing from that list." */
  annotations: (n) => `Your ${n ?? 0} annotation preset${n === 1 ? '' : 's'} — the icon and colour combinations offered when you add an annotation (Customize ▸ Markups).`,
  shortcuts: (n) => (n ? `Your ${n} rebound keyboard shortcut${n === 1 ? '' : 's'}.` : 'Your keyboard shortcuts. None rebound yet — change one in Settings ▸ Shortcuts.'),
  design: (n) => (n ? `Your ${n} adjusted design value${n === 1 ? '' : 's'} — sizes, spacing and padding from the Design window.` : 'Sizes, spacing and padding from the Design window. Nothing adjusted yet.'),
  helpertext: (n) => (n ? `Your ${n} helper text change${n === 1 ? '' : 's'} — tooltips you have rewritten or hidden.` : 'Tooltips you have rewritten or hidden. None changed yet — edit one in the Helper Text window.'),
};

export default function PresetsPanel({ showImports = true }: { showImports?: boolean }) {
  // Store reads so the counts (and therefore which rows are available)
  // re-render as the writer adds themes / workspaces / outline presets.
  useThemeStore((s) => s.customThemes);
  useOutlinePresetStore((s) => s.presets);
  useEditorStore((s) => s.workspaces);
  const [, bump] = useState(0);

  const counts = Object.fromEntries(PRESET_PARTS.map((p) => [p.id, p.count()])) as Record<PresetPartId, number | null>;
  const available = PRESET_PARTS.filter((p) => counts[p.id] !== 0).map((p) => p.id);
  // Everything the app actually has is checked to begin with — the common
  // case is "save all of it", and the old Full Preset was one click.
  const [checked, setChecked] = useState<PresetPartId[]>(available);
  const on = (id: PresetPartId) => checked.includes(id) && counts[id] !== 0;
  const live = checked.filter((id) => counts[id] !== 0);
  const allOn = available.length > 0 && available.every((id) => checked.includes(id));

  const toggle = (id: PresetPartId) =>
    setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  const exportBundle = async () => {
    if (!live.length) return;
    const now = new Date().toISOString();
    if (await saveFile(buildPresetBundle(live, now), typedExportName(stampedBase(now), 'preset'), JSON_FILTER)) {
      showToast(`Preset exported — ${live.length} item${live.length === 1 ? '' : 's'} included.`, 'success');
    }
  };

  const importBundle = async () => {
    const file = await openTextFile([{ name: 'ScriptCraft Preset', extensions: ['json', ...SCRIPT_EXTS] }]);
    if (!file) return;
    let ids: PresetPartId[];
    try {
      ids = readPresetFile(file.content).ids;
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not read that file.', 'error');
      return;
    }
    const names = ids.map((id) => presetPart(id)!.label).join(', ');
    const sure = await confirmDialog(
      `This preset contains: ${names}.\n\nImporting overrides what you have for each of those. Nothing else is touched.`,
      { title: 'Import Preset', confirmLabel: 'Import', danger: true },
    );
    if (!sure) return;
    try {
      const { applied, failed } = applyPresetFile(file.content);
      bump((v) => v + 1);
      const done = applied.join(', ');
      if (failed.length) showToast(`Imported ${done}. Could not apply: ${failed.join(', ')}.`, 'error');
      else showToast(`Imported ${done} — restart ScriptCraft to apply everything.`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not import that file.', 'error');
    }
  };

  return (
    <div className="fs-presets">
      <div className="fs-presets-intro">
        Tick what to include. Everything you tick is saved in ONE preset file.
        <button
          className="fs-presets-all"
          onClick={() => setChecked(allOn ? [] : available)}
          title={allOn ? 'Untick every item' : 'Tick every item'}
        >{allOn ? 'Select none' : 'Select all'}</button>
      </div>

      {PRESET_PARTS.map((p) => {
        const empty = counts[p.id] === 0;
        return (
          <label key={p.id} className={`fs-presets-row${empty ? ' fs-presets-row-empty' : ''}`}>
            <input
              type="checkbox"
              className="fs-presets-check"
              checked={on(p.id)}
              disabled={empty}
              onChange={() => toggle(p.id)}
              title={empty ? `Nothing to include — you have no ${p.label.toLowerCase()} yet` : `Include ${p.label.toLowerCase()} in the preset file`}
            />
            <div className="fs-presets-meta">
              <div className="fs-presets-label">{p.label}</div>
              <div className="fs-presets-desc">{PART_DESC[p.id](counts[p.id])}</div>
            </div>
          </label>
        );
      })}

      <div className="fs-presets-footer">
        <button
          className="fs-presets-btn fs-presets-btn-primary"
          disabled={!live.length}
          title={live.length ? 'Save the ticked items as one preset file' : 'Tick at least one item to export'}
          onClick={() => void exportBundle()}
        ><FaFileExport aria-hidden /> Export Preset</button>
        {showImports && (
          <button
            className="fs-presets-btn"
            title="Load a preset file — it applies whatever that file contains"
            onClick={() => void importBundle()}
          ><FaFileImport aria-hidden /> Import Preset</button>
        )}
      </div>
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
