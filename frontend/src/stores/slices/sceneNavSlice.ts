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
}

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
});
