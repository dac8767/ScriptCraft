/**
 * v6.99 (Derek, via the feedback form): the Settings window's Cancel.
 * Settings apply LIVE, so Cancel needs the state as it was when the window
 * opened — and the restore must go THROUGH each field's own setter, because
 * the setters carry the per-field localStorage writes (settingsStore has no
 * persist middleware; a bare setState would revert memory but not disk).
 *
 * The snapshot covers every settingsStore field with a conventional
 * set<Field> twin — one rule, no hand-kept list to drift.
 */
import { useSettingsStore } from '../stores/settingsStore';

const setterName = (k: string) => `set${k[0].toUpperCase()}${k.slice(1)}`;

export function snapshotSettings(): Record<string, unknown> {
  const s = useSettingsStore.getState() as unknown as Record<string, unknown>;
  const snap: Record<string, unknown> = {};
  for (const k of Object.keys(s)) {
    if (typeof s[k] === 'function') continue;
    if (typeof s[setterName(k)] === 'function') {
      snap[k] = JSON.parse(JSON.stringify(s[k] ?? null));
    }
  }
  return snap;
}

/** Restore a snapshot through the setters, skipping untouched fields.
 *  Returns how many fields actually moved. */
export function restoreSettings(snap: Record<string, unknown>): number {
  const s = useSettingsStore.getState() as unknown as Record<string, unknown>;
  let changed = 0;
  for (const [k, v] of Object.entries(snap)) {
    if (JSON.stringify(s[k] ?? null) === JSON.stringify(v)) continue;
    const setter = s[setterName(k)];
    if (typeof setter === 'function') {
      (setter as (x: unknown) => void)(v);
      changed++;
    }
  }
  return changed;
}
