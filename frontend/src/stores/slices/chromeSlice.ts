// v7.37: chrome-customization slice — the last of the editorStore extractions
// (workspaces, view-prefs, spell/grammar, beats/outline, design came before
// it). Everything here answers one question: what does the app's FURNITURE
// look like. The ribbon's two zones, the menu bar's order and hidden set, the
// side panels' size mode / name case / item scale / dividers, the per-bar item
// gaps, the custom chrome heights, and the right-click menu's order and hidden
// set.
//
// WHAT DELIBERATELY STAYED BEHIND. `resetAllSettings` sits in the middle of
// this cluster in the old file and looks like it belongs — it does not. It
// writes toolConfig, toolOrder, navigatorOpen, viewStyle and pageLayout as
// well as the chrome, so it is cross-slice by nature and belongs to the store
// that owns all of them. Dragging it in here would have made this slice import
// four other slices' defaults to do its job.
//
// Same rule as the other slices: `EditorState` is a TYPE-only import (erased
// at runtime), and nothing here imports designTokens — designTokens imports
// editorStore for the store-bound tokens' setters, so a slice importing it
// closes a runtime cycle and the store's creator gets an undefined function.
// (v7.32 proved that one the hard way.)
import type { StateCreator } from 'zustand';
import { _vs, saveViewState, clamp } from '../viewState';
import type { EditorState } from '../editorStore';
import {
  migrateDropLegacyInserts, migrateDropPanelToggles, migrateLockResize, migratePanelToggles, migrateResetSizes, migrateRibbon, migrateRibbonSections, migrateSepDividers, migrateToolbarBigZone, migrateTwoRows, migrateViewAnnotations, normalizeToolbarZones,
} from '../../components/toolbarBuiltins';

/* THE TOOLBAR-ZONE MIGRATIONS came with the state they migrate.
   They ran at editorStore's module top and wrote `_tbZones`, which the store's
   creator then read — so the slice could not have its own initial value without
   them, and exporting `_tbZones` across the boundary would have closed exactly
   the runtime cycle this file is written to avoid. Moving the whole run here
   keeps "what the persisted zones are" and "how old layouts become them" in one
   place, which is the point of a slice.

   Every one of these is a ONE-TIME repair guarded by its own localStorage flag:
   a saved ribbon from an older version is rewritten in place, once, and never
   again. They are load-bearing history — the oldest predates v0.42 — so they
   are moved verbatim rather than tidied on the way. */
// v0.42: toolbar zones are flat per-item token lists; expand any persisted
// legacy g: group tokens (honoring the retired toolbarHiddenItems checkboxes)
// so pre-0.42 layouts survive unchanged.
let _tbZones = normalizeToolbarZones(
  Array.isArray(_vs.toolbarLeft) ? _vs.toolbarLeft as string[] : [],
  Array.isArray(_vs.toolbarRight) ? _vs.toolbarRight as string[] : [],
  _vs.toolbarHiddenItems ?? [],
);
// v2.02 one-time: the right zone became the Big Button section. Saved
// layouts keep every item — small controls that lived on the right move to
// the end of Main instead of silently turning into big buttons.
try {
  const BIG_FLAG = 'opendraft:toolbarBigZone202';
  if (_vs.toolbarZonesSet && !localStorage.getItem(BIG_FLAG)) {
    localStorage.setItem(BIG_FLAG, '1');
    _tbZones = migrateToolbarBigZone(_tbZones.left, _tbZones.right);
    saveViewState({ toolbarLeft: _tbZones.left, toolbarRight: _tbZones.right });
  }
} catch { /* storage unavailable — keep what we have */ }

// v5.51, Derek: the legacy working-note inserts left the ribbon (Insert
// Section / Insert Note / Add To-Do List / Insert Marker) — saved layouts
// shed the tokens once so the bar renders no dead buttons.
try {
  const DROP_INSERTS_FLAG = 'opendraft:toolbarDropLegacyInserts551';
  if (_vs.toolbarZonesSet && !localStorage.getItem(DROP_INSERTS_FLAG)) {
    localStorage.setItem(DROP_INSERTS_FLAG, '1');
    const strippedL = migrateDropLegacyInserts(_tbZones.left);
    const strippedR = migrateDropLegacyInserts(_tbZones.right);
    if (strippedL.length !== _tbZones.left.length || strippedR.length !== _tbZones.right.length) {
      _tbZones = { left: strippedL, right: strippedR };
      saveViewState({ toolbarLeft: _tbZones.left, toolbarRight: _tbZones.right });
    }
  }
} catch { /* storage unavailable — keep what we have */ }
// v6.68 one-time: the new "View Annotations" on/off toggle takes its place
// beside the Annotation Filter in layouts that already carry the filter.
try {
  const VIEW_ANN_FLAG = 'opendraft:toolbarViewAnnotations668';
  if (_vs.toolbarZonesSet && !localStorage.getItem(VIEW_ANN_FLAG)) {
    localStorage.setItem(VIEW_ANN_FLAG, '1');
    const withL = migrateViewAnnotations(_tbZones.left);
    const withR = migrateViewAnnotations(_tbZones.right);
    if (withL.length !== _tbZones.left.length || withR.length !== _tbZones.right.length) {
      _tbZones = { left: withL, right: withR };
      saveViewState({ toolbarLeft: _tbZones.left, toolbarRight: _tbZones.right });
    }
  }
} catch { /* storage unavailable — keep what we have */ }
// v2.14 one-time: the sepAfter ghost separators became real d: tokens —
// saved layouts get equivalent dividers so the bar looks unchanged, but
// they're now visible in Customize (movable, removable).
try {
  const SEP_FLAG = 'opendraft:toolbarSepDividers214';
  if (_vs.toolbarZonesSet && !localStorage.getItem(SEP_FLAG)) {
    localStorage.setItem(SEP_FLAG, '1');
    _tbZones = { left: migrateSepDividers(_tbZones.left), right: _tbZones.right };
    saveViewState({ toolbarLeft: _tbZones.left });
  }
} catch { /* storage unavailable — keep what we have */ }
// v2.34 one-time: saved layouts get the surface toggles (Left Panel /
// Right Panel / Outline Bar) appended to Main.
try {
  const TOGGLES_FLAG = 'opendraft:toolbarSurfaceToggles234';
  if (_vs.toolbarZonesSet && !localStorage.getItem(TOGGLES_FLAG)) {
    localStorage.setItem(TOGGLES_FLAG, '1');
    _tbZones = { left: migratePanelToggles(_tbZones.left), right: _tbZones.right };
    saveViewState({ toolbarLeft: _tbZones.left });
  }
} catch { /* storage unavailable — keep what we have */ }
// v2.55 one-time: saved layouts get the sizing-lock button appended to Main.
try {
  const LOCK_FLAG = 'opendraft:toolbarLockResize255';
  if (_vs.toolbarZonesSet && !localStorage.getItem(LOCK_FLAG)) {
    localStorage.setItem(LOCK_FLAG, '1');
    _tbZones = { left: migrateLockResize(_tbZones.left), right: _tbZones.right };
    saveViewState({ toolbarLeft: _tbZones.left });
  }
} catch { /* storage unavailable — keep what we have */ }
// v2.67 one-time: saved layouts get the sizing-reset button beside the lock.
// v2.78: this MUST be its own flag — it first shipped inside the v2.55 block
// above, whose flag was already set on existing installs, so it never ran.
try {
  const RESET_FLAG = 'opendraft:toolbarResetSizes267';
  if (_vs.toolbarZonesSet && !localStorage.getItem(RESET_FLAG)) {
    localStorage.setItem(RESET_FLAG, '1');
    _tbZones = { left: migrateResetSizes(_tbZones.left), right: _tbZones.right };
    saveViewState({ toolbarLeft: _tbZones.left });
  }
} catch { /* storage unavailable — keep what we have */ }
// v2.94 one-time: the two-row toolbar. Saved single-row layouts split —
// tool/window toggles, lock/reset, pinned tools and commands move to Row 2;
// the old Big Button zone's items become Row 2 items flagged big.
try {
  const TWOROWS_FLAG = 'opendraft:toolbarTwoRows294';
  if (_vs.toolbarZonesSet && !localStorage.getItem(TWOROWS_FLAG)) {
    localStorage.setItem(TWOROWS_FLAG, '1');
    _tbZones = migrateTwoRows(_tbZones.left, _tbZones.right);
    // The leftover from the menu migration rides along (Scrapbook-gated).
    if (![..._tbZones.left, ..._tbZones.right].some((t) => t.includes('b:insertTable'))) {
      _tbZones = { left: _tbZones.left, right: [..._tbZones.right, 'b:insertTable'] };
    }
    saveViewState({ toolbarLeft: _tbZones.left, toolbarRight: _tbZones.right });
  }
} catch { /* storage unavailable — keep what we have */ }
// v2.95 one-time: the RIBBON. The two zones fold into one sequence (a full-
// height divider between them), structural dividers become full-height, and
// the retired big!/customize tokens are shed. The right zone stays empty
// from here on.
try {
  const RIBBON_FLAG = 'opendraft:toolbarRibbon295';
  if (_vs.toolbarZonesSet && !localStorage.getItem(RIBBON_FLAG)) {
    localStorage.setItem(RIBBON_FLAG, '1');
    _tbZones = { left: migrateRibbon(_tbZones.left, _tbZones.right), right: [] };
    saveViewState({ toolbarLeft: _tbZones.left, toolbarRight: [] });
  }
} catch { /* storage unavailable — keep what we have */ }
// v2.96 one-time: the ribbon reorganizes by SECTION — the old column-major
// pairing becomes explicit r: row breaks so the bar keeps its look, and
// item-level 2! flags are shed (a section's shape sets item height now).
try {
  const SECTIONS_FLAG = 'opendraft:toolbarRibbonSections296';
  if (_vs.toolbarZonesSet && !localStorage.getItem(SECTIONS_FLAG)) {
    localStorage.setItem(SECTIONS_FLAG, '1');
    _tbZones = { left: migrateRibbonSections(_tbZones.left), right: [] };
    saveViewState({ toolbarLeft: _tbZones.left, toolbarRight: [] });
  }
} catch { /* storage unavailable — keep what we have */ }
// v3.02 one-time: Customize became a ribbon ITEM (it was fixed chrome in
// v2.95–v3.01). Saved layouts get it appended as its own section so the
// button doesn't silently vanish; it's fully movable/removable after.
try {
  const CUSTBTN_FLAG = 'opendraft:toolbarCustomizeItem302';
  if (_vs.toolbarZonesSet && !localStorage.getItem(CUSTBTN_FLAG)) {
    localStorage.setItem(CUSTBTN_FLAG, '1');
    if (!_tbZones.left.includes('b:customize')) {
      _tbZones = { left: [..._tbZones.left, '2!d:cust-302', 'b:customize'], right: [] };
      saveViewState({ toolbarLeft: _tbZones.left, toolbarRight: [] });
    }
  }
} catch { /* storage unavailable — keep what we have */ }
// v3.25 one-time, Derek (task #137): the Left/Right Panel toggle buttons are
// retired — saved layouts shed the tokens so the ribbon doesn't render dead
// buttons the palette no longer offers.
try {
  const DROP_TOGGLES_FLAG = 'opendraft:toolbarDropPanelToggles325';
  if (_vs.toolbarZonesSet && !localStorage.getItem(DROP_TOGGLES_FLAG)) {
    localStorage.setItem(DROP_TOGGLES_FLAG, '1');
    const stripped = migrateDropPanelToggles(_tbZones.left);
    if (stripped.length !== _tbZones.left.length) {
      _tbZones = { left: stripped, right: _tbZones.right };
      saveViewState({ toolbarLeft: _tbZones.left });
    }
  }
} catch { /* storage unavailable — keep what we have */ }

export interface ChromeSlice {
  /** Toolbar zones (v0.38). Tokens: g:<group> built-in section, t:<toolId>
   *  pinned tool, c:<commandId> pinned command, d:<n> divider line. The right
   *  zone renders after the flex spacer (far right). Empty arrays mean
   *  "defaults not yet materialized" — the Toolbar builds them lazily. */
  toolbarLeft: string[];
  toolbarRight: string[];
  toolbarZonesSet: boolean;
  setToolbarZones: (left: string[], right: string[]) => void;
  /** Hidden top-level sections of the right-click menu (v0.81). Only top-level
   *  items — an entry's CONTENTS (e.g. which elements Element offers) are
   *  governed by their own tab, so every instance stays in sync. */
  contextMenuHidden: string[];
  setContextMenuHidden: (ids: string[]) => void;
  /** Display order of the right-click menu's items (v0.86). */
  contextMenuOrder: string[];
  setContextMenuOrder: (ids: string[]) => void;
  /* (v5.22: noteOrder/todoOrder retired — the merged Sticky Notes list's
     manual order IS the shelfCards array order, like Snippets. The old
     viewState keys linger unread, which is the house pattern for retired
     persisted fields.) */
  panelSizeMode: { left: 'compact' | 'comfortable' | 'custom' | 'icons'; right: 'compact' | 'comfortable' | 'custom' | 'icons' };
  /** v4.24, Derek: side-panel display names — Title Case (as authored) or ALL CAPS. */
  panelNameCase: 'title' | 'upper';
  setPanelNameCase: (c: 'title' | 'upper') => void;
  /** Custom sizes in px, used when the matching mode is 'custom' (v0.72). */
  chromeCustomPx: { menu: number; toolbar: number; panelLeft: number; panelRight: number };
  setChromeCustomPx: (surface: 'menu' | 'toolbar' | 'panelLeft' | 'panelRight', px: number) => void;
  /** v2.76: how much shorter the Big Buttons are than the chrome they span
   *  (px). 16 = default breathing room; smaller = bigger buttons. Driven by
   *  the Big Button grip's vertical axis. */
  bigBtnInsetPx: number;
  setBigBtnInset: (px: number) => void;
  /** v2.77: vertical scale of the side panels' dock items (1 = default) —
   *  row height, text and icons follow. Driven by the panel edge's vertical
   *  axis, per side. */
  panelItemScale: { left: number; right: number };
  setPanelItemScale: (side: 'left' | 'right', scale: number) => void;
  /** v2.29: item spacing (flex gap) per bar — see the GapHandle grips. */
  chromeGapPx: { menu: number; toolbar: number; bigbtn: number; scrapbook: number };
  setChromeGap: (bar: 'menu' | 'toolbar' | 'bigbtn' | 'scrapbook', px: number) => void;
  setPanelSizeMode: (side: 'left' | 'right', mode: 'compact' | 'comfortable' | 'custom' | 'icons') => void;
  panelDividers: { id: string; label: string; side: 'left' | 'right'; spacer?: boolean; size?: number }[];
  setPanelDividers: (d: { id: string; label: string; side: 'left' | 'right'; spacer?: boolean; size?: number }[]) => void;

  /** Menu bar customization: display order + hidden menus (File cannot hide). */
  menuBarOrder: string[];
  setMenuBarOrder: (order: string[]) => void;
  menuBarHidden: string[];
  setMenuBarHidden: (hidden: string[]) => void;
  toolbarMode: 'compact' | 'comfortable' | 'custom' | 'hidden';
  /** Menu bar mode, split from toolbarMode (v0.39); migrates from it. */
  menuMode: 'compact' | 'comfortable' | 'custom' | 'hidden';
  setMenuMode: (m: 'compact' | 'comfortable' | 'custom' | 'hidden') => void;
  setToolbarMode: (mode: 'compact' | 'comfortable' | 'custom' | 'hidden') => void;
}

export const createChromeSlice: StateCreator<EditorState, [], [], ChromeSlice> = (set) => ({
  toolbarLeft: _tbZones.left,
  toolbarRight: _tbZones.right,
  // v2.86: judged from what was PERSISTED, never from the normalized output —
  // normalizeToolbarZones re-inserts the permanent Customize anchor into the
  // right zone, which made a FRESH profile look like a user-authored empty
  // layout, so the default toolbar never seeded (empty toolbar on install).
  toolbarZonesSet: _vs.toolbarZonesSet === true
    || (Array.isArray(_vs.toolbarLeft) && _vs.toolbarLeft.length > 0)
    || (Array.isArray(_vs.toolbarRight) && _vs.toolbarRight.length > 0),
  setToolbarZones: (left, right) => {
    saveViewState({ toolbarLeft: left, toolbarRight: right, toolbarZonesSet: true });
    set({ toolbarLeft: left, toolbarRight: right, toolbarZonesSet: true });
  },
  panelDividers: Array.isArray(_vs.panelDividers) ? _vs.panelDividers as { id: string; label: string; side: 'left' | 'right'; spacer?: boolean }[] : [],
  contextMenuHidden: _vs.contextMenuHidden ?? [],
  setContextMenuHidden: (ids) => {
    saveViewState({ contextMenuHidden: ids });
    set({ contextMenuHidden: ids });
  },
  contextMenuOrder: _vs.contextMenuOrder ?? [],
  setContextMenuOrder: (ids) => {
    saveViewState({ contextMenuOrder: ids });
    set({ contextMenuOrder: ids });
  },
  panelSizeMode: _vs.panelSizeMode ?? { left: 'comfortable', right: 'comfortable' },
  panelNameCase: (_vs.panelNameCase === 'upper' ? 'upper' : 'title') as 'title' | 'upper',
  setPanelNameCase: (c) => {
    saveViewState({ panelNameCase: c });
    set({ panelNameCase: c });
  },
  chromeCustomPx: _vs.chromeCustomPx ?? { menu: 36, toolbar: 33, panelLeft: 266, panelRight: 266 },
  setChromeCustomPx: (surface, px) => set((st) => {
    const next = { ...st.chromeCustomPx, [surface]: px };
    saveViewState({ chromeCustomPx: next });
    return { chromeCustomPx: next };
  }),
  bigBtnInsetPx: (_vs.bigBtnInsetPx as number) ?? 16,
  setBigBtnInset: (px) => set(() => {
    const clamped = clamp(Math.round(px), 0, 40);
    saveViewState({ bigBtnInsetPx: clamped });
    return { bigBtnInsetPx: clamped };
  }),
  panelItemScale: (_vs.panelItemScale as { left: number; right: number }) ?? { left: 1, right: 1 },
  setPanelItemScale: (side, scale) => set((st) => {
    const clamped = clamp(scale, 0.7, 1.8);
    const next = { ...st.panelItemScale, [side]: clamped };
    saveViewState({ panelItemScale: next });
    return { panelItemScale: next };
  }),
  chromeGapPx: { menu: 0, toolbar: 2, bigbtn: 0, scrapbook: 12, ...((_vs.chromeGapPx as Record<string, number>) ?? {}) },
  setChromeGap: (bar, px) => set((st) => {
    // v2.35: 'scrapbook' is an OFFSET (how far the Scrapbook menu group sits
    // from the last regular menu), so it gets a wider range than the gaps.
    const max = bar === 'scrapbook' ? 400 : 32;
    const next = { ...st.chromeGapPx, [bar]: clamp(Math.round(px), 0, max) };
    saveViewState({ chromeGapPx: next });
    return { chromeGapPx: next };
  }),
  setPanelSizeMode: (side, mode) => set((st) => {
    const next = { ...st.panelSizeMode, [side]: mode };
    saveViewState({ panelSizeMode: next });
    return { panelSizeMode: next };
  }),
  setPanelDividers: (panelDividers) => {
    saveViewState({ panelDividers });
    set({ panelDividers });
  },
  menuBarOrder: Array.isArray(_vs.menuBarOrder) ? _vs.menuBarOrder as string[] : [],
  setMenuBarOrder: (order) => {
    saveViewState({ menuBarOrder: order });
    set({ menuBarOrder: order });
  },
  menuBarHidden: (Array.isArray(_vs.menuBarHidden) ? _vs.menuBarHidden as string[] : []).filter((l) => l !== 'File'),
  setMenuBarHidden: (hidden) => {
    const safe = hidden.filter((l) => l !== 'File');
    saveViewState({ menuBarHidden: safe });
    set({ menuBarHidden: safe });
  },
  toolbarMode: (_vs.toolbarMode as 'compact' | 'comfortable' | 'hidden') ?? 'compact',
  // v0.97: the menu bar can no longer be hidden — hiding it took File off screen
  // with it. Anyone already sitting on the hidden mode would otherwise be stuck
  // with no menu bar and no way back, so that setting is migrated on load.
  menuMode: ((_vs.menuMode ?? _vs.toolbarMode) === 'comfortable' ? 'comfortable' : 'compact') as 'compact' | 'comfortable' | 'hidden',
  setMenuMode: (m) => {
    saveViewState({ menuMode: m });
    set({ menuMode: m });
  },
  setToolbarMode: (mode) => { set({ toolbarMode: mode }); saveViewState({ toolbarMode: mode }); },
});
