/**
 * Add-ons (v7.05, Derek: "create an add-on module where add-ons can be
 * installed").
 *
 * WHAT THIS IS, PLAINLY. An add-on is a feature that ships inside the app but
 * stays INERT until you install it. Nothing about it exists in the UI — no tool
 * window, no menu entry, no ribbon option — until it is installed, and removing
 * it puts the app back exactly as it was.
 *
 * WHAT THIS IS NOT, so nobody is surprised later: it does not download or run
 * code from anywhere. Everything here is bundled with the app and gated. That is
 * deliberate — it is what Derek asked for (a private tool he does not want
 * widely distributed), and executing fetched code inside a desktop app that can
 * read the user's filesystem is a decision to make on purpose, not by accident.
 * If remote add-ons are ever wanted, this is the seam to build them on: the
 * catalog would gain entries whose module is fetched instead of imported.
 *
 * WHY IT IS NOT THE PLUGIN REGISTRY. `src/plugins/registry.ts` already exists
 * and stays: it is the RUNTIME surface a plugin registers menus, panels and
 * grammar providers into, and it is in-memory only. This module is the layer
 * above it — WHICH add-ons the user has installed, remembered across restarts.
 * The two compose: an installed add-on is what gets to register.
 */

const STORAGE_KEY = 'opendraft:addons:installed';

export interface AddonManifest {
  /** Stable id. Persisted — renaming one orphans the user's install state. */
  id: string;
  name: string;
  /** One line, shown in the Add-ons list. */
  summary: string;
  version: string;
  /** Who to blame. Shown under the name. */
  author?: string;
  /** Tool-window ids this add-on brings with it (ToolDock's ALL_TOOLS). */
  toolIds?: string[];
  /** Longer text shown when the row is expanded. */
  details?: string;
}

/**
 * The bundled catalog. An entry appearing here does NOT put anything in the UI;
 * it only makes the add-on installable.
 */
export const ADDON_CATALOG: AddonManifest[] = [
  {
    id: 'action-rewrite',
    name: 'Action Rewrite',
    summary: 'Three craft-guided rewrites of the selected action lines.',
    version: '1.0',
    author: 'ScriptCraft',
    toolIds: ['rewrite'],
    details:
      'Adds the Action Rewrite tool window. Select action lines in the script '
      + 'and it offers three rewrites — tighter, more visual, and more active — '
      + 'that you can apply or ignore. Removing the add-on takes the tool, its '
      + 'menu entry and its ribbon option back out of the app.',
  },
];

// ── install state ─────────────────────────────────────────────────────────

function read(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];   // corrupt value must not take the app down
  }
}

let installed: string[] = read();
const listeners = new Set<() => void>();

function write(next: string[]): void {
  installed = next;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* quota / private mode */ }
  listeners.forEach((fn) => fn());
}

/** Ids of every installed add-on. */
export function installedAddons(): string[] {
  return installed;
}

export function isAddonInstalled(id: string): boolean {
  return installed.includes(id);
}

export function installAddon(id: string): void {
  if (!ADDON_CATALOG.some((a) => a.id === id)) return;   // unknown id is a no-op
  if (installed.includes(id)) return;
  write([...installed, id]);
}

export function removeAddon(id: string): void {
  if (!installed.includes(id)) return;
  write(installed.filter((x) => x !== id));
}

/** Subscribe to install/remove. Returns an unsubscribe function. */
export function subscribeAddons(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Tool ids that are currently gated OFF — i.e. belong to an add-on that is not
 * installed. ToolDock filters `ALL_TOOLS` through this, so every surface that
 * reads the tool list (dock rows, ribbon palette, Customize pickers, the Tools
 * menu) hides them together instead of each one remembering to.
 */
export function gatedToolIds(): string[] {
  return ADDON_CATALOG
    .filter((a) => !installed.includes(a.id))
    .flatMap((a) => a.toolIds ?? []);
}

/** Test seam — resets install state without touching localStorage semantics. */
export function __resetAddonsForTest(ids: string[] = []): void {
  write(ids);
}
