// v4.23: first editorStore slice extracted to its own file. It reads defaults
// from _vs and persists via saveViewState (both from ../viewState), and takes
// the full EditorState as a type-only import (erased at runtime), so there's no
// runtime cycle: viewState -> designSlice -> editorStore.
//
// Pattern for the next slice: define a <Name>Slice interface + createNameSlice,
// have editorStore's EditorState `extends` it, and spread createNameSlice(...) at
// the top of create(). tsc then proves every field/action is still implemented.
import type { StateCreator } from 'zustand';
import { _vs, saveViewState } from '../viewState';
import type { EditorState } from '../editorStore';

export interface DesignSlice {
  /** v4.8: the Design panel. `designVars` holds only OVERRIDDEN tokens (keyed
   *  by token id from src/design/designTokens.ts); absent keys use the CSS
   *  default. An effect mirrors this map onto :root --dz-* / page vars, so this
   *  store is the one source the panel writes, the DOM reads, and Copy CSS dumps. */
  designVars: Record<string, number>;
  setDesignVar: (id: string, val: number) => void;
  resetDesignVar: (id: string) => void;
  resetAllDesign: () => void;
  designPanelOpen: boolean;
  setDesignPanelOpen: (v: boolean) => void;
}

/** v4.46: toolWinHeaderPad split into four per-side knobs — a saved override
 *  seeds top+bottom so a tuned header keeps its height (idempotent; persisted
 *  on the next designVars write). Explicit per-side values always win. */
export const migrateDesignVars = (vars: Record<string, number>): Record<string, number> => {
  if (vars.toolWinHeaderPad === undefined) return vars;
  const { toolWinHeaderPad, ...rest } = vars;
  return { toolWinPadTop: toolWinHeaderPad, toolWinPadBottom: toolWinHeaderPad, ...rest };
};

export const createDesignSlice: StateCreator<EditorState, [], [], DesignSlice> = (set) => ({
  designVars: migrateDesignVars((_vs.designVars as Record<string, number>) ?? {}),
  setDesignVar: (id, val) => set((st) => {
    const next = { ...st.designVars, [id]: val };
    saveViewState({ designVars: next });
    return { designVars: next };
  }),
  resetDesignVar: (id) => set((st) => {
    const next = { ...st.designVars };
    delete next[id];
    saveViewState({ designVars: next });
    return { designVars: next };
  }),
  resetAllDesign: () => set(() => {
    saveViewState({ designVars: {} });
    return { designVars: {} };
  }),
  designPanelOpen: false,
  setDesignPanelOpen: (v) => set({ designPanelOpen: v }),
});
