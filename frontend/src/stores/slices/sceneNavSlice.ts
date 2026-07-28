// v4.23: Scene-navigator filter/search slice (ephemeral UI state). EMPTY_SCENE_*
// are imported as values from editorStore — only read inside the creator, so the
// circular ref resolves via ES live bindings (same pattern as the tag slice).
// The `scenes` list itself stays in editorStore (doc-derived, used broadly).
import type { StateCreator } from 'zustand';
import { EMPTY_SCENE_FILTERS, EMPTY_SCENE_NAV_DATA, type EditorState, type SceneFilters, type SceneNavData } from '../editorStore';

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
  /** v5.08, Derek: the preview scale is stated as what it MEANS — how many
   *  pages sit on a row — stepped with buttons, never typed. Replaces the
   *  v4.94 pagesThumbPx column-width model. */
  pagesPerRow: number;
  setPagesPerRow: (v: number) => void;
}

export type LocationFilter = 'all' | 'int' | 'ext';
export type LocationSort = 'scene' | 'name' | 'count';

/** v5.08: the grid is `repeat(<count>, 1fr)` — the number IS the meaning.
 *  (v4.94's pagesThumbPx set a column min-width and let auto-fill derive the
 *  count; Derek asked for the count itself as the control.) */
export const PAGES_PER_ROW_MIN = 1;
export const PAGES_PER_ROW_MAX = 8;
export const PAGES_PER_ROW_DEFAULT = 3;

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
  pagesPerRow: PAGES_PER_ROW_DEFAULT,
  // Clamped HERE, not at the buttons, so no caller can push it out of range.
  setPagesPerRow: (v) => set({ pagesPerRow: Math.min(PAGES_PER_ROW_MAX, Math.max(PAGES_PER_ROW_MIN, Math.round(v))) }),
});
