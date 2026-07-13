/**
 * API configuration.
 *
 * In development the Vite dev server proxies /api to the backend on port 8008.
 * For web deployments the Python backend serves both frontend and API.
 *
 * On Tauri (desktop + mobile) the HTTP backend is NOT used — all data goes
 * through local SQLite. The API_BASE is only relevant for the web build.
 */

// Use the browser's hostname so the API is reachable when the frontend
// is accessed from another device on the local network (e.g. phone via IP).
// In dev mode (Vite on port 5173), hit the backend on port 8008.
// In production (frontend served by the backend itself), use same-origin /api.
//
// On Tauri custom schemes (e.g. `tauri://localhost`) `window.location.origin`
// returns the string "null" per the URL spec — gluing "/api" onto that yields
// "null/api", which fetch() rejects with WebKit's cryptic "The string did not
// match the expected pattern". Detect that and bail to an empty sentinel so
// cloudApi can surface a clean "cloud not configured" message instead.
const STORAGE_KEY_CLOUD_API = 'opendraft:cloudApiUrl';

function loadStoredCloudApi(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_CLOUD_API) || '';
  } catch {
    return '';
  }
}

/**
 * Accept either a server root (https://host) or a full API root
 * (https://host/api) from settings/env and always return the /api form.
 * Without this, a user who pastes their server URL without the /api suffix
 * gets 405s on every /auth/* call (FastAPI mounts auth at /api/auth).
 */
function normalizeApiBase(raw: string): string {
  const trimmed = raw.replace(/\/+$/, '');
  if (!trimmed) return '';
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
}

function computeApiBase(): string {
  const stored = loadStoredCloudApi();
  if (stored) return normalizeApiBase(stored);
  const env = import.meta.env.VITE_API_BASE;
  if (env) return normalizeApiBase(String(env));
  // Tauri (desktop + mobile) ships its own webview origins — `tauri://localhost`
  // on macOS/iOS, `https://tauri.localhost` on Windows, `null` on some Linux
  // builds. None of these point at a real backend, so always fall through to
  // the hosted default. Users can override in Settings → Cloud API URL.
  const isTauri = !!(window as any).__TAURI_INTERNALS__;
  // Desktop/mobile cloud endpoint. Set VITE_CLOUD_API_BASE at build time to
  // ScriptCraft's own backend (e.g. https://api.scriptcraft.com). Until that
  // backend is deployed this is intentionally empty — cloudApi surfaces a
  // clean "cloud not configured" state and the app runs fully offline on
  // local SQLite. Users can also point it at their own server in
  // Settings → Cloud API URL.
  if (isTauri) return normalizeCloudDefault(import.meta.env.VITE_CLOUD_API_BASE);
  const origin = window.location.origin;
  const validOrigin = origin && origin !== 'null';
  const isDev = window.location.port === '5173';
  if (isDev) return `http://${window.location.hostname}:8008/api`;
  if (validOrigin) return `${origin}/api`;
  return normalizeCloudDefault(import.meta.env.VITE_CLOUD_API_BASE);
}

/** Empty (cloud disabled) unless a ScriptCraft cloud base is configured. */
function normalizeCloudDefault(v: unknown): string {
  const raw = (v ? String(v) : '').trim();
  return raw ? normalizeApiBase(raw) : '';
}

/**
 * Live readback of the configured cloud API base. Re-reads localStorage on
 * every call so a Settings change takes effect without reloading the page.
 * Callers that need the URL should prefer this over the cached `API_BASE`
 * constant — the constant remains for backward compatibility with code paths
 * that capture the value once at startup.
 */
export function getApiBase(): string {
  return computeApiBase();
}

export const API_BASE: string = computeApiBase();

/** Server root without the /api suffix (used for asset URLs, etc.) */
export const SERVER_BASE: string = API_BASE.replace(/\/api$/, '');

/** WebSocket URL for the Hocuspocus collaboration server.
 *  Reads from localStorage (settings store) first, then falls back
 *  to the VITE env var, then to the default.
 */
// Empty until ScriptCraft's own collab server is deployed (set
// VITE_COLLAB_WS_URL at build time, e.g. wss://collab.scriptcraft.com).
const DEFAULT_COLLAB_WS = import.meta.env.VITE_COLLAB_WS_URL || '';
export function getCollabWsUrl(): string {
  const stored = localStorage.getItem('opendraft:collabServerUrl');
  if (stored) return stored;
  return DEFAULT_COLLAB_WS;
}
// Static alias kept for backward-compatible imports
export const COLLAB_WS_URL: string = DEFAULT_COLLAB_WS;

/**
 * Get the URL for an asset.
 *
 * On web this returns the backend HTTP URL (synchronous).
 * On Tauri (desktop + mobile) this returns a convertFileSrc() URL pointing
 * to the local file on disk (async because it needs path APIs).
 *
 * `filename` is the stored filename from the asset record — required on
 * Tauri.  On web it is ignored.
 */
export function getAssetUrlSync(
  projectId: string,
  assetId: string,
): string {
  // Web — use the HTTP backend
  return `${SERVER_BASE}/api/projects/${projectId}/assets/${assetId}`;
}

export async function getAssetUrl(
  projectId: string,
  assetId: string,
  filename?: string,
): Promise<string> {
  const { isTauri } = await import('./services/platform');
  if (isTauri()) {
    const { convertFileSrc } = await import('@tauri-apps/api/core');
    const { appDataDir } = await import('@tauri-apps/api/path');
    const base = await appDataDir();
    const filePath = `${base}/assets/${projectId}/${filename || assetId}`;
    return convertFileSrc(filePath);
  }
  return getAssetUrlSync(projectId, assetId);
}
