/**
 * saveLocations — the Save Locations engine (Settings → Save Locations).
 *
 * Manual Save / Save As always writes to the script's home (local backend or
 * cloud, "mode follows the file") and then FANS OUT to every additional
 * enabled destination:
 *   - Cloud       — a mirrored project/script pair on the collab account,
 *                   mapped persistently (separate ID spaces).
 *   - Google Drive— the document JSON written to a ScriptCraft folder
 *                   (drive.file scope: the app only ever sees its own files).
 *   - OneDrive    — same, via Microsoft Graph path addressing.
 *
 * Snapshots can additionally be copied to one chosen destination.
 * Failures never block the primary save; each failing destination is
 * reported through the blocking acknowledge modal (per Derek's spec).
 */
import { useSettingsStore } from '../stores/settingsStore';
import { useProjectStore } from '../stores/projectStore';
import { useEditorStore } from '../stores/editorStore';
// Static on purpose: MenuBar/ScreenplayEditor already import odraftFormat
// statically, so a dynamic import here could never split a chunk — it only
// produced a build warning on every run (v4.62 audit).
import { exportOdraft } from '../utils/odraftFormat';
import { cloudApi } from './cloudApi';
import { reportSaveError } from '../stores/saveErrorStore';
import { errText } from '../utils/errText';
import {
  connect, getAccessToken, loadTokens, clearTokens, type ProviderConfig,
} from './oauthPkce';

/* ── Provider configs ──────────────────────────────────────────────────── */

export function gdriveConfig(): ProviderConfig {
  return {
    storageKey: 'opendraft:gdriveTokens',
    authEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    clientId: useSettingsStore.getState().gdriveClientId,
    scope: 'https://www.googleapis.com/auth/drive.file',
    extraAuthParams: { access_type: 'offline', prompt: 'consent' },
  };
}

export function onedriveConfig(): ProviderConfig {
  return {
    storageKey: 'opendraft:onedriveTokens',
    authEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    clientId: useSettingsStore.getState().onedriveClientId,
    scope: 'Files.ReadWrite offline_access openid',
  };
}

export const connectGDrive = () => connect(gdriveConfig());
export const connectOneDrive = () => connect(onedriveConfig());
export const gdriveConnected = () => !!loadTokens('opendraft:gdriveTokens');
export const onedriveConnected = () => !!loadTokens('opendraft:onedriveTokens');
export const disconnectGDrive = () => clearTokens('opendraft:gdriveTokens');
export const disconnectOneDrive = () => clearTokens('opendraft:onedriveTokens');

/* ── Small persistent maps (mirror IDs / remote file IDs) ──────────────── */

function mapGet(key: string): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; }
}
function mapSet(key: string, m: Record<string, string>): void {
  try { localStorage.setItem(key, JSON.stringify(m)); } catch { /* ignore */ }
}

const CLOUD_MAP = 'opendraft:saveloc:cloudMirror';
const GDRIVE_MAP = 'opendraft:saveloc:gdriveFiles';

function safeName(s: string): string {
  return (s || 'Untitled').replace(/[\\/:*?"<>|]/g, '-').slice(0, 120);
}

/* ── Cloud mirror ──────────────────────────────────────────────────────── */

async function saveToCloudMirror(args: SavePayload): Promise<void> {
  const { projectId, scriptId, projectName, title, content } = args;
  // Already a cloud script? Its home save covered it.
  if (useProjectStore.getState().isCloudScript(projectId, scriptId)) return;

  const map = mapGet(CLOUD_MAP);
  let cloudProjectId = map[`p:${projectId}`];
  if (cloudProjectId) {
    // Verify it still exists; recreate if the user deleted it in the cloud.
    const projects = await cloudApi.listProjects();
    if (!projects.some((p) => p.id === cloudProjectId)) cloudProjectId = '';
  }
  if (!cloudProjectId) {
    const projects = await cloudApi.listProjects();
    const existing = projects.find((p) => p.name.toLowerCase() === projectName.toLowerCase());
    const project = existing ?? await cloudApi.createProject(projectName);
    cloudProjectId = project.id;
    map[`p:${projectId}`] = cloudProjectId;
    mapSet(CLOUD_MAP, map);
  }

  const scriptKey = `s:${projectId}/${scriptId}`;
  let cloudScriptId = map[scriptKey];
  if (cloudScriptId) {
    try {
      await cloudApi.saveScript(cloudProjectId, cloudScriptId, { title, content });
      return;
    } catch (err) {
      // 404 → the mirror script was deleted remotely; fall through and recreate.
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('404')) throw err;
    }
  }
  const created = await cloudApi.createScript(cloudProjectId, { title, content });
  map[scriptKey] = created.meta.id;
  mapSet(CLOUD_MAP, map);
}

/* ── Google Drive ──────────────────────────────────────────────────────── */

async function driveFetch(token: string, url: string, init?: RequestInit): Promise<any> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Google Drive ${res.status}: ${text.slice(0, 160)}`);
  }
  return res.status === 204 ? null : res.json();
}

async function driveEnsureFolder(token: string, name: string, parentId?: string): Promise<string> {
  const q = encodeURIComponent(
    `name = '${name.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false` +
    (parentId ? ` and '${parentId}' in parents` : ''),
  );
  const list = await driveFetch(token, `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`);
  if (list.files?.length) return list.files[0].id;
  const created = await driveFetch(token, 'https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name, mimeType: 'application/vnd.google-apps.folder',
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  });
  return created.id;
}

async function driveUpload(token: string, fileName: string, json: string, folderId: string, existingId?: string): Promise<string> {
  const metadata = existingId
    ? { name: fileName }
    : { name: fileName, parents: [folderId] };
  const boundary = 'fd_boundary_7f3a';
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${json}\r\n--${boundary}--`;
  const url = existingId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart&fields=id`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id';
  const res = await driveFetch(token, url, {
    method: existingId ? 'PATCH' : 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  return res.id;
}

async function saveToGDrive(args: SavePayload): Promise<void> {
  const token = await getAccessToken(gdriveConfig());
  const root = await driveEnsureFolder(token, 'ScriptCraft');
  // v1.15: the file is named after the SCRIPT. It used to be
  // "<container> — <draft>.odraft.json", from when a project was the script —
  // which produced files called "Test — Draft 1 - 07-12-26.odraft.json" and, worse,
  // named a brand-new script after whatever container it landed in.
  const fileName = `${safeName(args.title)}.odraft.json`;
  const map = mapGet(GDRIVE_MAP);
  const key = `${args.projectId}/${args.scriptId}`;
  let fileId = map[key];
  try {
    fileId = await driveUpload(token, fileName, JSON.stringify(args.content), root, fileId || undefined);
  } catch (err) {
    // Stale file id (deleted in Drive) → create fresh once.
    const msg = err instanceof Error ? err.message : String(err);
    if (map[key] && msg.includes('404')) {
      fileId = await driveUpload(token, fileName, JSON.stringify(args.content), root);
    } else throw err;
  }
  map[key] = fileId;
  mapSet(GDRIVE_MAP, map);
}

async function snapshotToGDrive(projectName: string, label: string, json: string): Promise<void> {
  const token = await getAccessToken(gdriveConfig());
  const root = await driveEnsureFolder(token, 'ScriptCraft');
  const snaps = await driveEnsureFolder(token, 'Snapshots', root);
  await driveUpload(token, `${safeName(projectName)} — ${safeName(label)}.json`, json, snaps);
}

/* ── OneDrive (Microsoft Graph, path addressing) ───────────────────────── */

async function onedrivePut(token: string, path: string, json: string): Promise<void> {
  const url = `https://graph.microsoft.com/v1.0/me/drive/root:/${path.split('/').map(encodeURIComponent).join('/')}:/content`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: json,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OneDrive ${res.status}: ${text.slice(0, 160)}`);
  }
}

async function saveToOneDrive(args: SavePayload): Promise<void> {
  const token = await getAccessToken(onedriveConfig());
  const path = `ScriptCraft/${safeName(args.title)}.odraft.json`;
  await onedrivePut(token, path, JSON.stringify(args.content));
}

async function snapshotToOneDrive(projectName: string, label: string, json: string): Promise<void> {
  const token = await getAccessToken(onedriveConfig());
  await onedrivePut(token, `ScriptCraft/Snapshots/${safeName(projectName)} — ${safeName(label)}.json`, json);
}

/* ── Orchestration ─────────────────────────────────────────────────────── */

export interface SavePayload {
  projectId: string;
  scriptId: string;
  projectName: string;
  title: string;
  content: Record<string, unknown>;
}

/** Fan a successful primary save out to every enabled secondary location.
 *  Never throws; each failure raises the blocking acknowledge modal. */
/**
 * v1.16 — write a copy into the folder you chose in Save As.
 *
 * "Local System (always on)" means the app's own database, which lives inside
 * Application Support where you will never look for it. If you pick a folder, the
 * script is also written there as a real file you can find, back up and open.
 */
async function saveToLocalFolder(args: SavePayload, folder: string): Promise<void> {
  const { writeTextFile } = await import('@tauri-apps/plugin-fs');
  const sep = folder.endsWith('/') ? '' : '/';
  const path = `${folder}${sep}${safeName(args.title)}.odraft.json`;
  await writeTextFile(path, JSON.stringify(args.content, null, 2));
}

export async function mirrorSave(payload: SavePayload): Promise<void> {
  const s = useSettingsStore.getState();
  const jobs: Array<{ name: string; run: () => Promise<void> }> = [];
  if (s.localSaveFolder) {
    jobs.push({ name: 'This device', run: () => saveToLocalFolder(payload, s.localSaveFolder) });
  }
  if (s.saveToCloud) jobs.push({ name: 'Cloud', run: () => saveToCloudMirror(payload) });
  if (s.saveToGDrive) jobs.push({ name: 'Google Drive', run: () => saveToGDrive(payload) });
  if (s.saveToOneDrive) jobs.push({ name: 'OneDrive', run: () => saveToOneDrive(payload) });
  if (jobs.length === 0) return;

  const { setMirrorStatus } = useEditorStore.getState();
  const failures: string[] = [];
  await Promise.all(jobs.map(async (j) => {
    setMirrorStatus(j.name, 'saving');
    try {
      await j.run();
      setMirrorStatus(j.name, 'saved');
    } catch (err) {
      setMirrorStatus(j.name, 'error');
      console.error(`Save Locations: ${j.name} failed`, err);
      failures.push(`${j.name}: ${errText(err)}`);
    }
  }));
  if (failures.length > 0) {
    reportSaveError(
      new Error(`The script saved to its home location, but ${failures.length === 1 ? 'a secondary save location' : `${failures.length} secondary save locations`} failed —\n${failures.join('\n')}`),
      'save-location',
    );
  }
}

/** Copy a snapshot to every checked snapshot destination (Settings). */
export async function mirrorSnapshot(args: {
  projectId: string; projectName: string; title: string;
  content: Record<string, unknown>; message: string;
}): Promise<void> {
  const s = useSettingsStore.getState();
  const dests: Array<'cloud' | 'gdrive' | 'onedrive' | 'localfolder'> = [];
  if (s.snapToCloud) dests.push('cloud');
  if (s.snapToGDrive) dests.push('gdrive');
  if (s.snapToOneDrive) dests.push('onedrive');
  // v2.83, Derek: a chosen folder on this device gets a timestamped .odraft.
  if (s.snapToLocalFolder && s.snapLocalFolder) dests.push('localfolder');
  if (dests.length === 0) return; // local git checkpoint already covers it

  const now = new Date();
  const stamp = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getFullYear()).slice(-2)} ${String(now.getHours()).padStart(2, '0')}.${String(now.getMinutes()).padStart(2, '0')}`;
  const label = `${args.title} — ${args.message} — ${stamp}`;
  const failures: string[] = [];

  await Promise.all(dests.map(async (loc) => {
    try {
      if (loc === 'gdrive') {
        await snapshotToGDrive(args.projectName, label, JSON.stringify(args.content));
      } else if (loc === 'onedrive') {
        await snapshotToOneDrive(args.projectName, label, JSON.stringify(args.content));
      } else if (loc === 'localfolder') {
        // v2.83: write an .odraft into the chosen folder (desktop only —
        // the folder path only exists where a native dialog picked it).
        const { isTauri } = await import('./platform');
        if (!isTauri()) throw new Error('Local folder auto saves need the desktop app.');
        const blob = exportOdraft({
          id: '', title: args.title, author: '', format: 'json',
          created_at: '', updated_at: '', page_count: 0,
          size_bytes: 0, color: '', pinned: false, sort_order: 0, preview: '',
        }, args.content);
        const text = await blob.text();
        const safe = label.replace(/[/\\:*?"<>|]/g, '-');
        const folder = useSettingsStore.getState().snapLocalFolder.replace(/[/\\]$/, '');
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('save_text_to_path', { path: `${folder}/Auto Save — ${safe}.odraft`, contents: text });
      } else {
        // Timestamped copy inside the mirrored cloud project.
        const map = mapGet(CLOUD_MAP);
        let cloudProjectId = map[`p:${args.projectId}`];
        if (!cloudProjectId) {
          const projects = await cloudApi.listProjects();
          const existing = projects.find((p) => p.name.toLowerCase() === args.projectName.toLowerCase());
          const project = existing ?? await cloudApi.createProject(args.projectName);
          cloudProjectId = project.id;
          map[`p:${args.projectId}`] = cloudProjectId;
          mapSet(CLOUD_MAP, map);
        }
        await cloudApi.createScript(cloudProjectId, { title: `Auto Save — ${label}`, content: args.content });
      }
    } catch (err) {
      console.error(`Snapshot copy to ${loc} failed:`, err);
      const name = loc === 'gdrive' ? 'Google Drive' : loc === 'onedrive' ? 'OneDrive' : loc === 'localfolder' ? 'Local folder' : 'Cloud';
      failures.push(`${name}: ${errText(err)}`);
    }
  }));

  if (failures.length > 0) {
    reportSaveError(
      new Error(`The snapshot was saved locally, but ${failures.length === 1 ? 'a snapshot location' : `${failures.length} snapshot locations`} failed —\n${failures.join('\n')}`),
      'save-location',
    );
  }
}
