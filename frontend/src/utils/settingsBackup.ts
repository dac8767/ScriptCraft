/**
 * Settings Backup & Restore (v4.22, Derek).
 *
 * The dev app (served from the Vite dev server, http://127.0.0.1:5173) and a
 * release build (served from the bundled index.html on a tauri:// origin) have
 * SEPARATE localStorage — browser storage is per-origin — so none of the app's
 * settings/customizations carry from one to the other. This exports every
 * `opendraft:*` preference to a JSON file you can import into the other app.
 *
 * Security/session keys (auth, OAuth tokens, device id) are deliberately left
 * OUT: they're machine/session specific and don't belong in a portable file you
 * might save or share. Sign in once on the target app instead.
 */

const PREFIX = 'opendraft:';

/** Keys never included in a backup — credentials, tokens, per-device identity,
 *  and volatile session flags that shouldn't (or needn't) travel. */
export const BACKUP_EXCLUDED = new Set<string>([
  'opendraft:auth',
  'opendraft:collabAuth',
  'opendraft:collabSavedCreds',
  'opendraft:gdriveTokens',
  'opendraft:onedriveTokens',
  'opendraft:deviceId',
  'opendraft:deviceName',
  'opendraft:rememberedEmail',
  'opendraft:email',
  'opendraft:quota',
  'opendraft:demo',
  'opendraft:fallback',
]);

export interface SettingsBackup {
  app: 'ScriptCraft';
  kind: 'settings-backup';
  version: 1;
  exportedAt: string;
  data: Record<string, string>;
}

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'key' | 'length' | 'removeItem'>;

const store = (s?: Storage): Storage => s ?? localStorage;

/** Every backup-eligible `opendraft:*` key/value currently in storage. */
export function gatherSettings(s?: Storage): Record<string, string> {
  const st = store(s);
  const out: Record<string, string> = {};
  for (let i = 0; i < st.length; i++) {
    const key = st.key(i);
    if (!key || !key.startsWith(PREFIX) || BACKUP_EXCLUDED.has(key)) continue;
    const val = st.getItem(key);
    if (val !== null) out[key] = val;
  }
  return out;
}

/** Build the backup document as a pretty JSON string. `nowIso` is injected so
 *  callers (and tests) control the timestamp. */
export function buildBackup(nowIso: string, s?: Storage): string {
  const doc: SettingsBackup = {
    app: 'ScriptCraft',
    kind: 'settings-backup',
    version: 1,
    exportedAt: nowIso,
    data: gatherSettings(s),
  };
  return JSON.stringify(doc, null, 2);
}

export interface ApplyResult { imported: number; skipped: number; }

/** Parse a backup document and write its keys into storage. Only `opendraft:*`
 *  keys that aren't excluded are applied, so a hand-edited or hostile file can't
 *  scribble arbitrary keys. Throws on a malformed / non-backup document. */
export function applyBackup(json: string, s?: Storage): ApplyResult {
  let doc: unknown;
  try { doc = JSON.parse(json); } catch { throw new Error('That file is not valid JSON.'); }
  const d = doc as Partial<SettingsBackup>;
  if (!d || d.kind !== 'settings-backup' || typeof d.data !== 'object' || d.data === null) {
    throw new Error('That file is not a ScriptCraft settings backup.');
  }
  const st = store(s);
  let imported = 0, skipped = 0;
  for (const [key, val] of Object.entries(d.data as Record<string, unknown>)) {
    if (!key.startsWith(PREFIX) || BACKUP_EXCLUDED.has(key) || typeof val !== 'string') { skipped++; continue; }
    st.setItem(key, val);
    imported++;
  }
  return { imported, skipped };
}

/** Trigger a download of the current settings as a JSON file. */
export function downloadBackup(): void {
  const json = buildBackup(new Date().toISOString());
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const stamp = new Date().toISOString().slice(0, 10);
  // v4.79, Derek: the export TYPE must be readable off the filename — every
  // preset-type export ends in _<type>.json (see utils/presets).
  a.download = `scriptcraft-${stamp}_settings.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the click has consumed the URL.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Read a picked file as text (import flow). */
export function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ''));
    r.onerror = () => reject(r.error ?? new Error('Could not read the file.'));
    r.readAsText(file);
  });
}
