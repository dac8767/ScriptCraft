import { create } from 'zustand';

export interface CollabUser {
  id: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  /** Optional — only present from the collab server; the backend's lighter
   *  /api/auth/me payload omits it. Defaults to false when missing. */
  twoFactorEnabled?: boolean;
}

export interface CollabAuth {
  accessToken: string | null;
  refreshToken: string | null;
  user: CollabUser | null;
}

interface SettingsState {
  // Collab server URL (ws:// or wss://)
  collabServerUrl: string;
  setCollabServerUrl: (url: string) => void;

  // Collab auth state
  collabAuth: CollabAuth;
  setCollabAuth: (auth: CollabAuth) => void;
  clearCollabAuth: () => void;

  // Whether the persisted token has been verified against the server during
  // this app session. Always starts false — a stored token alone never proves
  // "logged in" if the server hasn't confirmed it yet (e.g. offline boot).
  authVerified: boolean;
  setAuthVerified: (verified: boolean) => void;

  // Default invite expiry (hours)
  defaultInviteExpiry: number;
  setDefaultInviteExpiry: (hours: number) => void;

  // Settings dialog open state
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;

  // Script-format preferences — which system templates show up in the new-script picker.
  // Stored as template ids (e.g. INDUSTRY_STANDARD_ID, MULTICAM_SITCOM_ID, ...).
  enabledScriptFormats: string[];
  setEnabledScriptFormats: (ids: string[]) => void;

  // True once the user has seen and confirmed the first-run format-preferences dialog.
  // Until then, the New Screenplay action opens the prefs dialog instead of going straight in.
  formatPreferencesInitialized: boolean;
  setFormatPreferencesInitialized: (v: boolean) => void;

  // Preferences > General: reopen the last edited script on app start.
  autoLoadLastScript: boolean;
  setAutoLoadLastScript: (v: boolean) => void;

  // Preferences > General: automatic snapshot interval in minutes (0 = off).
  // Snapshots are project version checkpoints (File > Script History), created
  // silently; the backend skips the commit when nothing changed.
  autoSnapshotMinutes: number;
  setAutoSnapshotMinutes: (m: number) => void;

  // Preferences > General: snapshots kept before old ones are squashed (0 = keep all).
  autoSnapshotKeep: number;
  setAutoSnapshotKeep: (n: number) => void;

  // Settings > Save Locations
  saveToCloud: boolean;
  setSaveToCloud: (v: boolean) => void;
  saveToGDrive: boolean;
  setSaveToGDrive: (v: boolean) => void;
  saveToOneDrive: boolean;
  setSaveToOneDrive: (v: boolean) => void;
  /** Snapshot copy destinations (local git history is always kept). */
  snapToCloud: boolean;
  setSnapToCloud: (v: boolean) => void;
  snapToGDrive: boolean;
  setSnapToGDrive: (v: boolean) => void;
  snapToOneDrive: boolean;
  setSnapToOneDrive: (v: boolean) => void;
  gdriveClientId: string;
  setGdriveClientId: (id: string) => void;
  onedriveClientId: string;
  setOnedriveClientId: (id: string) => void;
}

const STORAGE_KEY_URL = 'opendraft:collabServerUrl';
const STORAGE_KEY_AUTH = 'opendraft:collabAuth';
const STORAGE_KEY_EXPIRY = 'opendraft:defaultInviteExpiry';
const STORAGE_KEY_FORMATS = 'opendraft:enabledScriptFormats';
const STORAGE_KEY_FORMATS_INIT = 'opendraft:formatPreferencesInitialized';
const STORAGE_KEY_AUTOLOAD = 'opendraft:autoLoadLastScript';
const STORAGE_KEY_AUTOSNAP = 'opendraft:autoSnapshotMinutes';
const STORAGE_KEY_AUTOSNAP_KEEP = 'opendraft:autoSnapshotKeep';
const SL_KEYS = {
  cloud: 'opendraft:saveloc:cloud',
  gdrive: 'opendraft:saveloc:gdrive',
  onedrive: 'opendraft:saveloc:onedrive',
  snaploc: 'opendraft:saveloc:snapshotLocation', // legacy single choice (migrated)
  snapCloud: 'opendraft:saveloc:snapToCloud',
  snapGDrive: 'opendraft:saveloc:snapToGDrive',
  snapOneDrive: 'opendraft:saveloc:snapToOneDrive',
  gdriveId: 'opendraft:saveloc:gdriveClientId',
  onedriveId: 'opendraft:saveloc:onedriveClientId',
};

function loadEnabledScriptFormats(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FORMATS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((x) => typeof x === 'string');
    }
  } catch { /* ignore */ }
  return [];
}

const DEFAULT_COLLAB_URL = 'wss://collab.open-draft.com';

function loadAuth(): CollabAuth {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AUTH);
    if (raw) return JSON.parse(raw) as CollabAuth;
  } catch { /* ignore */ }
  return { accessToken: null, refreshToken: null, user: null };
}

export const useSettingsStore = create<SettingsState>((set) => ({
  collabServerUrl: localStorage.getItem(STORAGE_KEY_URL) || DEFAULT_COLLAB_URL,
  setCollabServerUrl: (url) => {
    localStorage.setItem(STORAGE_KEY_URL, url);
    set({ collabServerUrl: url });
  },


  collabAuth: loadAuth(),
  setCollabAuth: (auth) => {
    localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(auth));
    // A fresh token from login/refresh is implicitly verified — the server
    // just issued it. Avoids a flicker where AuthIndicator briefly shows
    // "Local only" right after sign-in while we wait for /auth/me.
    set({ collabAuth: auth, authVerified: Boolean(auth.accessToken && auth.user) });
  },
  clearCollabAuth: () => {
    localStorage.removeItem(STORAGE_KEY_AUTH);
    set({
      collabAuth: { accessToken: null, refreshToken: null, user: null },
      authVerified: false,
    });
  },

  authVerified: false,
  setAuthVerified: (verified) => set({ authVerified: verified }),

  defaultInviteExpiry: parseInt(localStorage.getItem(STORAGE_KEY_EXPIRY) || '1', 10),
  setDefaultInviteExpiry: (hours) => {
    localStorage.setItem(STORAGE_KEY_EXPIRY, String(hours));
    set({ defaultInviteExpiry: hours });
  },

  settingsOpen: false,
  setSettingsOpen: (open) => set({ settingsOpen: open }),

  enabledScriptFormats: loadEnabledScriptFormats(),
  setEnabledScriptFormats: (ids) => {
    try { localStorage.setItem(STORAGE_KEY_FORMATS, JSON.stringify(ids)); } catch { /* ignore */ }
    set({ enabledScriptFormats: ids });
  },

  formatPreferencesInitialized: localStorage.getItem(STORAGE_KEY_FORMATS_INIT) === '1',
  setFormatPreferencesInitialized: (v) => {
    try { localStorage.setItem(STORAGE_KEY_FORMATS_INIT, v ? '1' : '0'); } catch { /* ignore */ }
    set({ formatPreferencesInitialized: v });
  },
  autoLoadLastScript: localStorage.getItem(STORAGE_KEY_AUTOLOAD) === '1',
  setAutoLoadLastScript: (v) => {
    try { localStorage.setItem(STORAGE_KEY_AUTOLOAD, v ? '1' : '0'); } catch { /* ignore */ }
    set({ autoLoadLastScript: v });
  },
  autoSnapshotMinutes: (() => {
    const raw = parseInt(localStorage.getItem(STORAGE_KEY_AUTOSNAP) || '0', 10);
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  })(),
  setAutoSnapshotMinutes: (m) => {
    try { localStorage.setItem(STORAGE_KEY_AUTOSNAP, String(m)); } catch { /* ignore */ }
    set({ autoSnapshotMinutes: m });
  },
  autoSnapshotKeep: (() => {
    const raw = parseInt(localStorage.getItem(STORAGE_KEY_AUTOSNAP_KEEP) || '0', 10);
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  })(),
  setAutoSnapshotKeep: (n) => {
    try { localStorage.setItem(STORAGE_KEY_AUTOSNAP_KEEP, String(n)); } catch { /* ignore */ }
    set({ autoSnapshotKeep: n });
  },
  saveToCloud: localStorage.getItem(SL_KEYS.cloud) === '1',
  setSaveToCloud: (v) => { try { localStorage.setItem(SL_KEYS.cloud, v ? '1' : '0'); } catch { /* ignore */ } set({ saveToCloud: v }); },
  saveToGDrive: localStorage.getItem(SL_KEYS.gdrive) === '1',
  setSaveToGDrive: (v) => { try { localStorage.setItem(SL_KEYS.gdrive, v ? '1' : '0'); } catch { /* ignore */ } set({ saveToGDrive: v }); },
  saveToOneDrive: localStorage.getItem(SL_KEYS.onedrive) === '1',
  setSaveToOneDrive: (v) => { try { localStorage.setItem(SL_KEYS.onedrive, v ? '1' : '0'); } catch { /* ignore */ } set({ saveToOneDrive: v }); },
  snapToCloud: localStorage.getItem(SL_KEYS.snapCloud) === '1' || localStorage.getItem(SL_KEYS.snaploc) === 'cloud',
  setSnapToCloud: (v) => { try { localStorage.setItem(SL_KEYS.snapCloud, v ? '1' : '0'); localStorage.removeItem(SL_KEYS.snaploc); } catch { /* ignore */ } set({ snapToCloud: v }); },
  snapToGDrive: localStorage.getItem(SL_KEYS.snapGDrive) === '1' || localStorage.getItem(SL_KEYS.snaploc) === 'gdrive',
  setSnapToGDrive: (v) => { try { localStorage.setItem(SL_KEYS.snapGDrive, v ? '1' : '0'); localStorage.removeItem(SL_KEYS.snaploc); } catch { /* ignore */ } set({ snapToGDrive: v }); },
  snapToOneDrive: localStorage.getItem(SL_KEYS.snapOneDrive) === '1' || localStorage.getItem(SL_KEYS.snaploc) === 'onedrive',
  setSnapToOneDrive: (v) => { try { localStorage.setItem(SL_KEYS.snapOneDrive, v ? '1' : '0'); localStorage.removeItem(SL_KEYS.snaploc); } catch { /* ignore */ } set({ snapToOneDrive: v }); },
  gdriveClientId: localStorage.getItem(SL_KEYS.gdriveId) || '',
  setGdriveClientId: (id) => { try { localStorage.setItem(SL_KEYS.gdriveId, id); } catch { /* ignore */ } set({ gdriveClientId: id }); },
  onedriveClientId: localStorage.getItem(SL_KEYS.onedriveId) || '',
  setOnedriveClientId: (id) => { try { localStorage.setItem(SL_KEYS.onedriveId, id); } catch { /* ignore */ } set({ onedriveClientId: id }); },
}));
