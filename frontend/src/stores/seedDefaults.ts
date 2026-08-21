/**
 * The app's shipped defaults (v7.70).
 *
 * Derek sent a full preset export: "everything in this file should be made the
 * default setting." So a fresh install now opens as HIS app — his ribbon, his
 * panels, his menus, his design tokens, his annotation presets and his five
 * workspaces — instead of the assorted hardcoded fallbacks scattered through
 * the store.
 *
 * WHERE THIS RUNS, AND WHY IT MATTERS. viewState.ts reads localStorage at
 * module scope (`_vs`) and editorStore's slices read `_vs` for their initial
 * values, so anything that wants to influence those has to have written to
 * localStorage BEFORE that line executes. This module is imported at the top
 * of viewState.ts for exactly that reason — not from main.tsx, where it would
 * depend on an import order nobody can see.
 *
 * IT NEVER OVERWRITES. Seeding writes a key only when that key is absent, and
 * the whole pass is skipped once SEED_KEY is set. An existing user keeps every
 * setting they have; only what they have never touched comes from the preset.
 * Wiping someone's configuration to install a default would be the worst
 * possible reading of "make this the default" — and it would wipe Derek's own
 * app the moment he pulled this version.
 *
 * The bundle itself is built by devtools/build-default-preset.mjs, which drops
 * the keys that describe Derek's machine rather than the product — his email,
 * his folder paths, a window position on a monitor to the left of his main one.
 * The reasons are listed there, by key.
 */
import DEFAULT_PRESET from '../data/defaultPreset.json';
import { BACKUP_EXCLUDED } from '../utils/settingsBackup';
import { WORKSPACE_FIELDS } from './workspaceFields';

/** Bumping the suffix re-runs the pass — for a NEW default bundle, not for
 *  edits to this file. Existing keys are still never overwritten. */
const SEED_KEY = 'opendraft:defaultsSeeded:1';

const PREFIX = 'opendraft:';

type Bundle = {
  parts?: {
    settings?: Record<string, unknown>;
    workspaces?: { workspaces?: Record<string, unknown>; workspaceOrder?: string[] };
  };
};

const bundle = DEFAULT_PRESET as Bundle;
const presetSettings: Record<string, unknown> = bundle.parts?.settings ?? {};

/** The export's live view state. A workspace snapshot saved before v7.69 holds
 *  19 of the 33 fields a snapshot carries now, and these are the values the
 *  other 14 had on his screen when he exported — which is exactly what saving
 *  each of those workspaces again would have written. */
const presetViewState: Record<string, unknown> = (() => {
  const raw = presetSettings['opendraft:viewState'];
  if (typeof raw !== 'string') return {};
  try {
    const v: unknown = JSON.parse(raw);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch { return {}; }
})();

/**
 * Fill in the fields a snapshot predates.
 *
 * Not cosmetic: workspaceIsDirty compares the live state against the snapshot
 * key for key, so a snapshot missing a field reads as CHANGED the instant it
 * is applied — "Save Changes to this Workspace" would have been lit on all
 * five, permanently, which is the v7.65 complaint in reverse.
 */
function complete(snap: Record<string, unknown>): Record<string, unknown> {
  const out = { ...snap };
  for (const f of WORKSPACE_FIELDS) {
    if (f in out) continue;
    if (f in presetViewState) out[f] = presetViewState[f];
  }
  return out;
}

/** The five that ship with the app, in the order they appear. */
export const BUILTIN_WORKSPACE_ORDER: string[] =
  bundle.parts?.workspaces?.workspaceOrder
  ?? Object.keys(bundle.parts?.workspaces?.workspaces ?? {});

export const BUILTIN_WORKSPACES: Record<string, unknown> = Object.fromEntries(
  Object.entries(bundle.parts?.workspaces?.workspaces ?? {})
    .map(([name, snap]) => [name, complete(snap as Record<string, unknown>)]),
);

/** Derek: "all of which should be included as default, non deletable options."
 *  Read by the store's guards AND by the two lists that draw the buttons, so
 *  what the UI offers and what the store permits cannot drift. */
export function isBuiltinWorkspace(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(BUILTIN_WORKSPACES, name);
}

/**
 * Write the preset's settings into localStorage, once, for keys nobody has set.
 *
 * Returns the keys it wrote — the check reads that rather than inferring the
 * pass ran from a side effect.
 */
export function seedDefaultSettings(): string[] {
  const written: string[] = [];
  try {
    if (localStorage.getItem(SEED_KEY)) return written;
    for (const [key, value] of Object.entries(presetSettings)) {
      /* The same rule applyBackup uses on an imported file, from the same
         list: only `opendraft:*`, never a credential or a per-device id, and
         only the raw strings localStorage actually holds. */
      if (!key.startsWith(PREFIX) || BACKUP_EXCLUDED.has(key)) continue;
      if (typeof value !== 'string') continue;
      if (localStorage.getItem(key) !== null) continue;   // never overwrite
      localStorage.setItem(key, value);
      written.push(key);
    }
    localStorage.setItem(SEED_KEY, 'v7.70');
  } catch {
    /* Private browsing, quota, a browser with storage off. The app has always
       had to run without persistence; it just starts on the old hardcoded
       fallbacks instead of these. */
  }
  return written;
}

/**
 * Put back any of the five that are missing, and leave every other workspace
 * — and the user's ordering — alone.
 *
 * Seeding alone would not do it: it runs once, and it skips a key that already
 * exists, so anyone who had a `workspaces` entry before this version would
 * never receive them. This runs on EVERY load and is the reason all five are
 * always there.
 *
 * A built-in the user has since edited is NOT replaced — the name existing is
 * what matters, and overwriting their version on every launch would make "Save
 * Changes to this Workspace" a no-op that quietly undoes itself overnight.
 *
 * Nor is the order rewritten. Forcing the five to the top would throw away the
 * arrangement Edit Workspaces' up/down arrows just made, on the next restart:
 * a control that works until you close the app is the same silent no-op with a
 * delay on it. The stored order is kept as it is, and a built-in it has never
 * heard of is appended.
 */
export function withBuiltinWorkspaces<T>(
  existing: Record<string, T> | undefined,
  order: string[] | undefined,
): { workspaces: Record<string, T>; workspaceOrder: string[] } {
  const workspaces = { ...(existing ?? {}) } as Record<string, T>;
  for (const [name, snap] of Object.entries(BUILTIN_WORKSPACES)) {
    if (!(name in workspaces)) workspaces[name] = snap as T;
  }
  const seen = new Set<string>();
  const workspaceOrder: string[] = [];
  const push = (n: string) => {
    if (n in workspaces && !seen.has(n)) { seen.add(n); workspaceOrder.push(n); }
  };
  for (const n of order ?? []) push(n);        // his arrangement, first and intact
  for (const n of BUILTIN_WORKSPACE_ORDER) push(n);   // built-ins he has not seen yet
  for (const n of Object.keys(workspaces)) push(n);   // anything the order forgot
  return { workspaces, workspaceOrder };
}
