// v4.23: Scene-navigator filter/search slice (ephemeral UI state). EMPTY_SCENE_*
// are imported as values from editorStore — only read inside the creator, so the
// circular ref resolves via ES live bindings (same pattern as the tag slice).
// The `scenes` list itself stays in editorStore (doc-derived, used broadly).
import type { StateCreator } from 'zustand';
import { EMPTY_SCENE_FILTERS, EMPTY_SCENE_NAV_DATA, type EditorState, type SceneFilters, type SceneNavData } from '../editorStore';
import { EMPTY_NAV_SCENE_FILTERS, type NavSceneFilters } from '../../utils/sceneFilters';
import { _vs, saveViewState } from '../viewState';

export interface SceneNavSlice {
  /** v1.80: Navigator filter + kind visibility live in the store so the
   *  window's header (dropdown) and footer (filter field) — which render in
   *  the shared window chrome — stay in sync with the list body. */
  navFilter: string;
  setNavFilter: (v: string) => void;
  /** v3.54: Scenes tool search / filters / published option lists (ephemeral). */
  sceneSearch: string;
  setSceneSearch: (v: string) => void;
  sceneFilters: SceneFilters;
  setSceneFilters: (f: SceneFilters) => void;
  sceneNavData: SceneNavData;
  setSceneNavData: (d: SceneNavData) => void;
  navShowKinds: Record<string, boolean>;
  setNavShowKinds: (v: Record<string, boolean>) => void;
  /** v4.92, Derek: the Locations window's own Filter / Sort / Search. Here
   *  rather than inside SceneNavigator because the controls render in the
   *  window CHROME (TOOL_CHROME.locations) and the list renders in the body —
   *  two components, one state, so a control can never be a no-op. */
  locationSearch: string;
  setLocationSearch: (v: string) => void;
  /** 'all' | 'int' | 'ext' — read off each scene heading's prefix. */
  locationFilter: LocationFilter;
  setLocationFilter: (v: LocationFilter) => void;
  /** 'scene' = first appearance — the order you meet the locations reading
   *  the script, which is the order the list has always used. v4.93, Derek
   *  named it "scene order"; it was labelled "Script order" before, and the
   *  app calls the same idea "Scene #" in the Notes/To-Do sorts. */
  locationSort: LocationSort;
  setLocationSort: (v: LocationSort) => void;
  /** v4.94, Derek: the Pages window's header search + preview scaling. Same
   *  reasoning as the Locations trio — the controls render in the window
   *  chrome, the thumbnails in the body. */
  pagesSearch: string;
  setPagesSearch: (v: string) => void;
  /** v5.47, Derek: Go to page moved into the window CHROME (the # button's
   *  pop). The chrome REQUESTS the jump here; the Pages body — which owns
   *  the grid ref and the editor — performs it and clears the request. */
  pagesGotoRequest: number | null;
  setPagesGotoRequest: (n: number | null) => void;
  /** v5.67, Derek: the Pages window's header TABS — Script (the script's
   *  pages), Title Page (the whole title-page editor, replacing the retired
   *  standalone tool), Custom (create/manage custom pages). Persisted like
   *  the Characters tab (charActiveTab), and in the store because the tabs
   *  render in the window CHROME while the body switches on the value. */
  pagesTab: PagesTab;
  setPagesTab: (t: PagesTab) => void;
  /** v5.75, Derek: the Locations window's header TABS — List (the location
   *  list, everything the window held before) and Map (an uploaded map with
   *  the locations pinned onto it). Same shape as pagesTab: persisted per
   *  machine, and in the store because the tabs render in the window CHROME
   *  while the body switches on the value. The map's DATA — image and pins —
   *  is script data and lives in locationMapSlice instead. */
  locationsTab: LocationsTab;
  setLocationsTab: (t: LocationsTab) => void;
  /** v5.68: the Navigator filter's Scene Headings section — INT./EXT.,
   *  location, contains-text. Ephemeral like navFilter; in the store because
   *  the controls live in the chrome popover and the list in the body. */
  navSceneFilters: NavSceneFilters;
  setNavSceneFilters: (f: NavSceneFilters) => void;
  /** v5.08, Derek: the preview scale is stated as what it MEANS — how many
   *  pages sit on a row — stepped with buttons, never typed. Replaces the
   *  v4.94 pagesThumbPx column-width model. */
  pagesPerRow: number;
  setPagesPerRow: (v: number) => void;
  /** v5.20, Derek: "Copy the Pages-per-row tool… It will be 'Cards per
   *  row'" — the Scenes card view's column count, same model: the number IS
   *  the meaning, stepped with buttons, never typed. */
  cardsPerRow: number;
  setCardsPerRow: (v: number) => void;
  /** v5.12, Derek: below this width the Scenes list swaps its three-column
   *  table for the compressed caret rows. His call on where that line sits —
   *  a Design slider drives it (store-bound token), persisted. */
  scenesTableMinW: number;
  setScenesTableMinW: (v: number) => void;
}

export type LocationFilter = 'all' | 'int' | 'ext';
export type LocationSort = 'scene' | 'name' | 'count';
/** v5.71: + 'all' — the All Pages tab compiles the other three (title page,
 *  script pages and custom pages in document order). Ids persist; labels are
 *  usePagesTabs' business ("Script Pages" etc. — renamed v5.71). */
export type PagesTab = 'script' | 'title' | 'custom' | 'all';
/** v5.75: the Locations window's tabs. */
export type LocationsTab = 'list' | 'map';

/** v5.08: the grid is `repeat(<count>, 1fr)` — the number IS the meaning.
 *  (v4.94's pagesThumbPx set a column min-width and let auto-fill derive the
 *  count; Derek asked for the count itself as the control.) */
export const PAGES_PER_ROW_MIN = 1;
export const PAGES_PER_ROW_MAX = 8;
export const PAGES_PER_ROW_DEFAULT = 3;

/** v5.20: the Scenes card grid is `repeat(<count>, 1fr)` too — the CSS
 *  fallback in .index-cards-grid must equal CARDS_PER_ROW_DEFAULT. */
export const CARDS_PER_ROW_MIN = 1;
export const CARDS_PER_ROW_MAX = 8;
export const CARDS_PER_ROW_DEFAULT = 3;

/** v5.12: the table↔caret switch line. Default 700: Derek's screenshot of
 *  the ~570px pop-out came captioned "should have already moved the synopsis
 *  field by the time it was this small" (the old hard line was 520, so the
 *  table hung on into that squeeze), while his fullscreen — roughly 1000px
 *  of tool width — must keep the full table per v5.09. 700 splits those
 *  cases with margin on both sides; the Design slider owns the final word. */
export const SCENES_TABLE_MIN_DEFAULT = 700;

export const createSceneNavSlice: StateCreator<EditorState, [], [], SceneNavSlice> = (set) => ({
  navFilter: '',
  setNavFilter: (v) => set({ navFilter: v }),
  sceneSearch: '',
  setSceneSearch: (v) => set({ sceneSearch: v }),
  sceneFilters: EMPTY_SCENE_FILTERS,
  setSceneFilters: (f) => set({ sceneFilters: f }),
  sceneNavData: EMPTY_SCENE_NAV_DATA,
  setSceneNavData: (d) => set({ sceneNavData: d }),
  navShowKinds: {},
  setNavShowKinds: (v) => set({ navShowKinds: v }),
  locationSearch: '',
  setLocationSearch: (v) => set({ locationSearch: v }),
  locationFilter: 'all',
  setLocationFilter: (v) => set({ locationFilter: v }),
  locationSort: 'scene',
  setLocationSort: (v) => set({ locationSort: v }),
  pagesSearch: '',
  setPagesSearch: (v) => set({ pagesSearch: v }),
  pagesGotoRequest: null,
  setPagesGotoRequest: (n) => set({ pagesGotoRequest: n }),
  pagesTab: (_vs.pagesTab as PagesTab) ?? 'script',
  setPagesTab: (t) => {
    saveViewState({ pagesTab: t });
    set({ pagesTab: t });
  },
  locationsTab: (_vs.locationsTab as LocationsTab) ?? 'list',
  setLocationsTab: (t) => {
    saveViewState({ locationsTab: t });
    set({ locationsTab: t });
  },
  navSceneFilters: EMPTY_NAV_SCENE_FILTERS,
  setNavSceneFilters: (f) => set({ navSceneFilters: f }),
  pagesPerRow: PAGES_PER_ROW_DEFAULT,
  // Clamped HERE, not at the buttons, so no caller can push it out of range.
  setPagesPerRow: (v) => set({ pagesPerRow: Math.min(PAGES_PER_ROW_MAX, Math.max(PAGES_PER_ROW_MIN, Math.round(v))) }),
  cardsPerRow: CARDS_PER_ROW_DEFAULT,
  setCardsPerRow: (v) => set({ cardsPerRow: Math.min(CARDS_PER_ROW_MAX, Math.max(CARDS_PER_ROW_MIN, Math.round(v))) }),
  scenesTableMinW: (_vs.scenesTableMinW as number) ?? SCENES_TABLE_MIN_DEFAULT,
  setScenesTableMinW: (v) => {
    const scenesTableMinW = Math.min(2000, Math.max(300, Math.round(v)));
    saveViewState({ scenesTableMinW });
    set({ scenesTableMinW });
  },
});
