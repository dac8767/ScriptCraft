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
  // Account auth state (the sign-in behind Cloud saves — historically named
  // "collab" because the identity provider began life as the collab server;
  // the name persists in localStorage, so it stays)
  collabAuth: CollabAuth;
  setCollabAuth: (auth: CollabAuth) => void;
  clearCollabAuth: () => void;

  // Whether the persisted token has been verified against the server during
  // this app session. Always starts false — a stored token alone never proves
  // "logged in" if the server hasn't confirmed it yet (e.g. offline boot).
  authVerified: boolean;
  setAuthVerified: (verified: boolean) => void;

  // Settings dialog open state
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;

  // Script-format preferences — which system templates show up in the new-script picker.
  // Stored as template ids (e.g. INDUSTRY_STANDARD_ID, MULTICAM_SITCOM_ID, ...).
  enabledScriptFormats: string[];
  setEnabledScriptFormats: (ids: string[]) => void;

  // True once the user has seen and confirmed the first-run format-preferences dialog.
  // Until then, the New Script action opens the prefs dialog instead of going straight in.
  formatPreferencesInitialized: boolean;
  setFormatPreferencesInitialized: (v: boolean) => void;

  // Preferences > General: how dates are shown everywhere (v1.59).
  dateFormat: import('../utils/dateFormat').DateFormatId;
  setDateFormat: (id: import('../utils/dateFormat').DateFormatId) => void;

  // v1.60 — the standard-settings round.
  /** New documents start with spell check on. Per-document toggle still wins. */
  spellCheckByDefault: boolean;
  setSpellCheckByDefault: (v: boolean) => void;
  /** Launch window: maximized (default) or remembered size/position. */
  windowStartup: 'maximized' | 'remember';
  setWindowStartup: (v: 'maximized' | 'remember') => void;
  /** Theme follows the OS light/dark appearance. */
  followSystemTheme: boolean;
  /* (v4.28, Derek: menuSystem is GONE — on desktop the menus always live in
   *  the macOS menu bar; there is no other option. The in-window bar remains
   *  only as the browser fallback, gated on isTauri alone. The old
   *  'opendraft:menuSystem' localStorage key is simply no longer read.) */
  /** v4.22: which Editor View choices appear in the toolbar dropdown, and in
   *  what order. Customizable in Customize ▸ Editor; 'page' can't be hidden. */
  editorViewOrder: string[];
  editorViewHidden: string[];
  setEditorViewOrder: (ids: string[]) => void;
  setEditorViewHidden: (ids: string[]) => void;
  resetEditorViews: () => void;
  getEffectiveEditorViews: () => { id: string; label: string }[];
  setFollowSystemTheme: (v: boolean) => void;
  /** v2.15 (Settings > Tools): launching the Scrapbook hides every other
   *  sidebar item and its panel window fills the sidebar; Return to editor
   *  restores the sidebars (render-time only — nothing is rewritten). */
  scrapbookExclusive: boolean;
  setScrapbookExclusive: (v: boolean) => void;
  /** v5.60, Derek: the same declutter for Action Rewrite — while its window
   *  is open, every other sidebar tool hides and the outline bar drops
   *  (render-time only, like the Scrapbook's). */
  rewriteExclusive: boolean;
  setRewriteExclusive: (v: boolean) => void;
  /** v4.71 (Settings > General): tabbed windows reopen on their last-used tab;
   *  off = they always open on their first tab. */
  openToLastTab: boolean;
  setOpenToLastTab: (v: boolean) => void;
  /** last-used tab per tabbed window (window id → tab id); recorded always,
   *  APPLIED only while openToLastTab is on (useWindowTabMemory). */
  lastWindowTabs: Record<string, string>;
  rememberWindowTab: (win: string, tab: string) => void;
  /** What the Draft field starts as on a new script. */
  defaultDraftLabel: string;
  setDefaultDraftLabel: (v: string) => void;
  /** v1.61: curly quotes and em dashes as you type. */
  smartTypography: boolean;
  setSmartTypography: (v: boolean) => void;
  /** v1.61: how Page Setup shows measurements. */
  units: 'in' | 'cm';
  setUnits: (v: 'in' | 'cm') => void;
  /** v1.73: 12-hour (11:30 PM) or 24-hour (23:30) time display and entry. */
  timeFormat: '12h' | '24h';
  setTimeFormat: (v: '12h' | '24h') => void;

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
  /** v1.16: a folder on this device to keep a copy of the script in. Empty = none. */
  localSaveFolder: string;
  setLocalSaveFolder: (path: string) => void;
  /** v6.41, Derek: "a second location on the local device" — the Save Options
   *  row "Local System (backup location)". The checkbox and the chosen folder
   *  are separate so unchecking keeps the folder for next time. */
  saveToBackupFolder: boolean;
  setSaveToBackupFolder: (v: boolean) => void;
  backupSaveFolder: string;
  setBackupSaveFolder: (path: string) => void;
  saveToGDrive: boolean;
  setSaveToGDrive: (v: boolean) => void;
  saveToOneDrive: boolean;
  setSaveToOneDrive: (v: boolean) => void;
  /** Snapshot copy destinations (local git history is always kept). */
  /** v2.83: a folder on this device that receives a timestamped .odraft on
   *  every auto save. Empty path = feature off. */
  snapToLocalFolder: boolean;
  setSnapToLocalFolder: (v: boolean) => void;
  snapLocalFolder: string;
  setSnapLocalFolder: (path: string) => void;
  /** v3.95: a folder on this device that Screenshot PNGs are written to (desktop
   *  only). Empty = fall back to the browser download (Downloads folder). */
  screenshotFolder: string;
  setScreenshotFolder: (path: string) => void;
  snapToGDrive: boolean;
  setSnapToGDrive: (v: boolean) => void;
  snapToOneDrive: boolean;
  setSnapToOneDrive: (v: boolean) => void;
  gdriveClientId: string;
  setGdriveClientId: (id: string) => void;
  onedriveClientId: string;
  setOnedriveClientId: (id: string) => void;
}

const STORAGE_KEY_AUTH = 'opendraft:collabAuth';
const STORAGE_KEY_FORMATS = 'opendraft:enabledScriptFormats';
const STORAGE_KEY_FORMATS_INIT = 'opendraft:formatPreferencesInitialized';
const STORAGE_KEY_AUTOLOAD = 'opendraft:autoLoadLastScript';
const STORAGE_KEY_DATEFMT = 'opendraft:dateFormat';
const STORAGE_KEY_SPELLDEF = 'opendraft:spellCheckByDefault';
const STORAGE_KEY_WINSTART = 'opendraft:windowStartup';
const STORAGE_KEY_SYSTHEME = 'opendraft:followSystemTheme';

/** v4.22: the Editor View choices — a fixed set of built-in modes, shown/
 *  ordered by the user in Customize ▸ Editor. */
export const EDITOR_VIEWS: { id: string; label: string }[] = [
  { id: 'page', label: 'Page' },
  { id: 'continuous', label: 'Continuous' },
  { id: 'preview', label: 'Preview' },
];
export const EDITOR_VIEW_REQUIRED = ['page'];
const STORAGE_KEY_EDITORVIEWS = 'opendraft:editorViews';
function loadEditorViews(): { order: string[]; hidden: string[] } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EDITORVIEWS);
    if (raw) {
      const p = JSON.parse(raw);
      const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x: unknown) => typeof x === 'string') : []);
      return { order: arr(p?.order), hidden: arr(p?.hidden) };
    }
  } catch { /* ignore */ }
  return { order: [], hidden: [] };
}
function saveEditorViews(v: { order: string[]; hidden: string[] }) {
  try { localStorage.setItem(STORAGE_KEY_EDITORVIEWS, JSON.stringify(v)); } catch { /* ignore */ }
}
const STORAGE_KEY_SBEXCL = 'opendraft:scrapbookExclusive';
const STORAGE_KEY_RWEXCL = 'opendraft:rewriteExclusive';
/* v4.71, Derek: tabbed windows reopen on their last-used tab (or always the
   first tab, when the setting is off). One map for every tabbed window —
   Settings/Customize, Characters, Tags — keyed by a stable window id. */
const STORAGE_KEY_OPENLASTTAB = 'opendraft:openToLastTab';
const STORAGE_KEY_LASTTABS = 'opendraft:lastWindowTabs';
function loadLastWindowTabs(): Record<string, string> {
  try {
    const p = JSON.parse(localStorage.getItem(STORAGE_KEY_LASTTABS) || '{}');
    if (p && typeof p === 'object' && !Array.isArray(p)) {
      return Object.fromEntries(Object.entries(p).filter(([, v]) => typeof v === 'string')) as Record<string, string>;
    }
  } catch { /* ignore */ }
  return {};
}
const STORAGE_KEY_DRAFTDEF = 'opendraft:defaultDraftLabel';
const STORAGE_KEY_SMARTTYPO = 'opendraft:smartTypography';
const STORAGE_KEY_UNITS = 'opendraft:units';
const STORAGE_KEY_TIMEFMT = 'opendraft:timeFormat';
const STORAGE_KEY_AUTOSNAP = 'opendraft:autoSnapshotMinutes';
const STORAGE_KEY_AUTOSNAP_KEEP = 'opendraft:autoSnapshotKeep';
const SL_KEYS = {
  localFolder: 'opendraft:saveloc:localFolder',
  backupOn: 'opendraft:saveloc:saveToBackupFolder',
  backupFolder: 'opendraft:saveloc:backupFolder',
  gdrive: 'opendraft:saveloc:gdrive',
  onedrive: 'opendraft:saveloc:onedrive',
  snaploc: 'opendraft:saveloc:snapshotLocation', // legacy single choice (migrated)
  snapLocal: 'opendraft:saveloc:snapToLocalFolder',
  snapLocalFolder: 'opendraft:saveloc:snapLocalFolder',
  screenshotFolder: 'opendraft:saveloc:screenshotFolder',
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

function loadAuth(): CollabAuth {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AUTH);
    if (raw) return JSON.parse(raw) as CollabAuth;
  } catch { /* ignore */ }
  return { accessToken: null, refreshToken: null, user: null };
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
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
  // v4.77, Derek: ON unless explicitly turned off — squiggles are the
  // standard text-editor baseline. ('0' = a real opt-out; the old '1'-only
  // read made OFF the default.)
  spellCheckByDefault: localStorage.getItem(STORAGE_KEY_SPELLDEF) !== '0',
  setSpellCheckByDefault: (v) => {
    try { localStorage.setItem(STORAGE_KEY_SPELLDEF, v ? '1' : '0'); } catch { /* ignore */ }
    set({ spellCheckByDefault: v });
  },
  windowStartup: (localStorage.getItem(STORAGE_KEY_WINSTART) === 'remember' ? 'remember' : 'maximized'),
  setWindowStartup: (v) => {
    try { localStorage.setItem(STORAGE_KEY_WINSTART, v); } catch { /* ignore */ }
    set({ windowStartup: v });
  },
  editorViewOrder: loadEditorViews().order,
  editorViewHidden: loadEditorViews().hidden,
  setEditorViewOrder: (ids) => {
    saveEditorViews({ order: ids, hidden: get().editorViewHidden });
    set({ editorViewOrder: ids });
  },
  setEditorViewHidden: (ids) => {
    // 'page' is the fallback view — never hidable.
    const hidden = ids.filter((id) => !EDITOR_VIEW_REQUIRED.includes(id));
    saveEditorViews({ order: get().editorViewOrder, hidden });
    set({ editorViewHidden: hidden });
  },
  resetEditorViews: () => {
    saveEditorViews({ order: [], hidden: [] });
    set({ editorViewOrder: [], editorViewHidden: [] });
  },
  getEffectiveEditorViews: () => {
    const { editorViewOrder: order, editorViewHidden: hidden } = get();
    const ids = EDITOR_VIEWS.map((v) => v.id);
    const ordered = order.length
      ? [...order.filter((id) => ids.includes(id)), ...ids.filter((id) => !order.includes(id))]
      : ids;
    return ordered
      .filter((id) => !hidden.includes(id))
      .map((id) => EDITOR_VIEWS.find((v) => v.id === id)!)
      .filter(Boolean);
  },
  followSystemTheme: localStorage.getItem(STORAGE_KEY_SYSTHEME) === '1',
  setFollowSystemTheme: (v) => {
    try { localStorage.setItem(STORAGE_KEY_SYSTHEME, v ? '1' : '0'); } catch { /* ignore */ }
    set({ followSystemTheme: v });
  },
  scrapbookExclusive: localStorage.getItem(STORAGE_KEY_SBEXCL) === '1',
  setScrapbookExclusive: (v) => {
    try { localStorage.setItem(STORAGE_KEY_SBEXCL, v ? '1' : '0'); } catch { /* ignore */ }
    set({ scrapbookExclusive: v });
  },
  rewriteExclusive: localStorage.getItem(STORAGE_KEY_RWEXCL) === '1',
  setRewriteExclusive: (v) => {
    try { localStorage.setItem(STORAGE_KEY_RWEXCL, v ? '1' : '0'); } catch { /* ignore */ }
    set({ rewriteExclusive: v });
  },
  // ON unless explicitly turned off — Derek asked for last-tab reopening
  // first and for the switch second, so remembering is the default.
  openToLastTab: localStorage.getItem(STORAGE_KEY_OPENLASTTAB) !== '0',
  setOpenToLastTab: (v) => {
    try { localStorage.setItem(STORAGE_KEY_OPENLASTTAB, v ? '1' : '0'); } catch { /* ignore */ }
    set({ openToLastTab: v });
  },
  lastWindowTabs: loadLastWindowTabs(),
  rememberWindowTab: (win, tab) => set((s) => {
    if (s.lastWindowTabs[win] === tab) return s;
    const next = { ...s.lastWindowTabs, [win]: tab };
    try { localStorage.setItem(STORAGE_KEY_LASTTABS, JSON.stringify(next)); } catch { /* ignore */ }
    return { lastWindowTabs: next };
  }),
  // ON unless explicitly turned off — the standard default in writing apps.
  smartTypography: localStorage.getItem(STORAGE_KEY_SMARTTYPO) !== '0',
  setSmartTypography: (v) => {
    try { localStorage.setItem(STORAGE_KEY_SMARTTYPO, v ? '1' : '0'); } catch { /* ignore */ }
    set({ smartTypography: v });
  },
  units: (localStorage.getItem(STORAGE_KEY_UNITS) === 'cm' ? 'cm' : 'in'),
  setUnits: (v) => {
    try { localStorage.setItem(STORAGE_KEY_UNITS, v); } catch { /* ignore */ }
    set({ units: v });
  },
  timeFormat: (localStorage.getItem(STORAGE_KEY_TIMEFMT) === '24h' ? '24h' : '12h'),
  setTimeFormat: (v) => {
    try { localStorage.setItem(STORAGE_KEY_TIMEFMT, v); } catch { /* ignore */ }
    set({ timeFormat: v });
  },
  defaultDraftLabel: localStorage.getItem(STORAGE_KEY_DRAFTDEF) || '1st Draft',
  setDefaultDraftLabel: (v) => {
    try { localStorage.setItem(STORAGE_KEY_DRAFTDEF, v); } catch { /* ignore */ }
    set({ defaultDraftLabel: v });
  },
  dateFormat: (localStorage.getItem(STORAGE_KEY_DATEFMT) as import('../utils/dateFormat').DateFormatId) || 'short',
  setDateFormat: (id) => {
    try { localStorage.setItem(STORAGE_KEY_DATEFMT, id); } catch { /* ignore */ }
    set({ dateFormat: id });
  },
  // v1.53: ON by default — absent key means enabled; '0' is an explicit opt-out.
  autoLoadLastScript: localStorage.getItem(STORAGE_KEY_AUTOLOAD) !== '0',
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
    // Default 12 (v0.71). Only an ABSENT setting takes the default — a stored
    // 0 is the user explicitly choosing "keep every version" and is honored.
    const stored = localStorage.getItem(STORAGE_KEY_AUTOSNAP_KEEP);
    if (stored === null) return 12;
    const raw = parseInt(stored, 10);
    return Number.isFinite(raw) && raw >= 0 ? raw : 12;
  })(),
  setAutoSnapshotKeep: (n) => {
    try { localStorage.setItem(STORAGE_KEY_AUTOSNAP_KEEP, String(n)); } catch { /* ignore */ }
    set({ autoSnapshotKeep: n });
  },
  localSaveFolder: localStorage.getItem(SL_KEYS.localFolder) || '',
  setLocalSaveFolder: (path) => {
    try { localStorage.setItem(SL_KEYS.localFolder, path); } catch { /* ignore */ }
    set({ localSaveFolder: path });
  },
  saveToBackupFolder: localStorage.getItem(SL_KEYS.backupOn) === '1',
  setSaveToBackupFolder: (v) => { try { localStorage.setItem(SL_KEYS.backupOn, v ? '1' : '0'); } catch { /* ignore */ } set({ saveToBackupFolder: v }); },
  backupSaveFolder: localStorage.getItem(SL_KEYS.backupFolder) || '',
  setBackupSaveFolder: (path) => { try { localStorage.setItem(SL_KEYS.backupFolder, path); } catch { /* ignore */ } set({ backupSaveFolder: path }); },
  saveToGDrive: localStorage.getItem(SL_KEYS.gdrive) === '1',
  setSaveToGDrive: (v) => { try { localStorage.setItem(SL_KEYS.gdrive, v ? '1' : '0'); } catch { /* ignore */ } set({ saveToGDrive: v }); },
  saveToOneDrive: localStorage.getItem(SL_KEYS.onedrive) === '1',
  setSaveToOneDrive: (v) => { try { localStorage.setItem(SL_KEYS.onedrive, v ? '1' : '0'); } catch { /* ignore */ } set({ saveToOneDrive: v }); },
  snapToLocalFolder: localStorage.getItem(SL_KEYS.snapLocal) === '1',
  setSnapToLocalFolder: (v) => { try { localStorage.setItem(SL_KEYS.snapLocal, v ? '1' : '0'); } catch { /* ignore */ } set({ snapToLocalFolder: v }); },
  snapLocalFolder: localStorage.getItem(SL_KEYS.snapLocalFolder) || '',
  setSnapLocalFolder: (path) => { try { localStorage.setItem(SL_KEYS.snapLocalFolder, path); } catch { /* ignore */ } set({ snapLocalFolder: path }); },
  screenshotFolder: localStorage.getItem(SL_KEYS.screenshotFolder) || '',
  setScreenshotFolder: (path) => { try { localStorage.setItem(SL_KEYS.screenshotFolder, path); } catch { /* ignore */ } set({ screenshotFolder: path }); },
  snapToGDrive: localStorage.getItem(SL_KEYS.snapGDrive) === '1' || localStorage.getItem(SL_KEYS.snaploc) === 'gdrive',
  setSnapToGDrive: (v) => { try { localStorage.setItem(SL_KEYS.snapGDrive, v ? '1' : '0'); localStorage.removeItem(SL_KEYS.snaploc); } catch { /* ignore */ } set({ snapToGDrive: v }); },
  snapToOneDrive: localStorage.getItem(SL_KEYS.snapOneDrive) === '1' || localStorage.getItem(SL_KEYS.snaploc) === 'onedrive',
  setSnapToOneDrive: (v) => { try { localStorage.setItem(SL_KEYS.snapOneDrive, v ? '1' : '0'); localStorage.removeItem(SL_KEYS.snaploc); } catch { /* ignore */ } set({ snapToOneDrive: v }); },
  gdriveClientId: localStorage.getItem(SL_KEYS.gdriveId) || '',
  setGdriveClientId: (id) => { try { localStorage.setItem(SL_KEYS.gdriveId, id); } catch { /* ignore */ } set({ gdriveClientId: id }); },
  onedriveClientId: localStorage.getItem(SL_KEYS.onedriveId) || '',
  setOnedriveClientId: (id) => { try { localStorage.setItem(SL_KEYS.onedriveId, id); } catch { /* ignore */ } set({ onedriveClientId: id }); },
}));
