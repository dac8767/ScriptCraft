/**
 * v4.35: import workspaces from another project's exported .odraft file (or a
 * workspaces JSON) — ONE implementation for the View → Workspaces menu item
 * and the Workspaces tool's button, so the two entry points can't drift.
 * Workspaces live in view state, not in the script, so an .odraft carries
 * them only if it was exported with them; we accept either shape and merge
 * without overwriting existing names (the store suffixes duplicates).
 */
import { openTextFile } from './fileOps';
import { SCRIPT_EXTS } from './scriptFileExt';
import { showToast } from '../components/Toast';
import { useEditorStore, type WorkspaceSnapshot } from '../stores/editorStore';

export async function importWorkspacesFromFile(): Promise<void> {
  try {
    const result = await openTextFile([
      { name: 'ScriptCraft Project or Workspaces', extensions: [...SCRIPT_EXTS] },
    ]);
    if (!result) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(result.content);
    } catch {
      showToast('That file isn’t valid JSON.', 'error');
      return;
    }
    const obj = parsed as Record<string, unknown>;
    // Accept: { workspaces: {...} } (view-state / .odraft export) or a bare
    // { name: snapshot } map.
    const candidate = (obj?.workspaces ?? obj?._workspaces ?? obj) as Record<string, unknown>;
    const entries = Object.entries(candidate ?? {}).filter(
      ([, v]) => v && typeof v === 'object' && ('toolConfig' in (v as object) || 'toolbarMode' in (v as object)),
    );
    if (entries.length === 0) {
      showToast('No workspaces found in that file.', 'error');
      return;
    }
    const added = useEditorStore.getState().importWorkspaces(
      Object.fromEntries(entries) as Record<string, WorkspaceSnapshot>,
    );
    showToast(
      added.length === 1
        ? `Imported workspace “${added[0]}”`
        : `Imported ${added.length} workspaces`,
      'success',
    );
  } catch (err) {
    showToast(`Import failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
  }
}
