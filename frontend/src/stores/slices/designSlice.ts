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
  /** v6.77: bulk replace — Reset all's window-undo restore path. */
  setDesignVars: (vars: Record<string, number>) => void;
  designPanelOpen: boolean;
  setDesignPanelOpen: (v: boolean) => void;
  /** v6.22: the Helper Text editor's open flag. v6.52: Helper Text is a
   *  real TOOL (id 'helpertext'); this setter survives as a delegation door
   *  (checks and old call sites) — it just opens/closes the tool. */
  setHelperTextWindowOpen: (v: boolean) => void;
}

/** v4.46: toolWinHeaderPad split into four per-side knobs — a saved override
 *  seeds top+bottom so a tuned header keeps its height (idempotent; persisted
 *  on the next designVars write). Explicit per-side values always win.
 *  v5.18: the per-kind ribbon button gap split the same way, into per-ROW
 *  (top/bottom) knobs — a saved override seeds both rows.
 *  (Runs at slice init only: a preset IMPORTED mid-session with the old key
 *  migrates on the next launch — same accepted behavior as the v4.46 split.) */
export const migrateDesignVars = (vars: Record<string, number>): Record<string, number> => {
  let out = vars;
  if (out.toolWinHeaderPad !== undefined) {
    const { toolWinHeaderPad, ...rest } = out;
    out = { toolWinPadTop: toolWinHeaderPad, toolWinPadBottom: toolWinHeaderPad, ...rest };
  }
  if (out.ribBtnGapTitled !== undefined) {
    const { ribBtnGapTitled, ...rest } = out;
    out = { ribBtnGapTopTitled: ribBtnGapTitled, ribBtnGapBottomTitled: ribBtnGapTitled, ...rest };
  }
  if (out.ribBtnGapUntitled !== undefined) {
    const { ribBtnGapUntitled, ...rest } = out;
    out = { ribBtnGapTopUntitled: ribBtnGapUntitled, ribBtnGapBottomUntitled: ribBtnGapUntitled, ...rest };
  }
  return out;
};

export const createDesignSlice: StateCreator<EditorState, [], [], DesignSlice> = (set, get) => ({
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
  setDesignVars: (vars) => set(() => {
    saveViewState({ designVars: vars });
    return { designVars: vars };
  }),
  designPanelOpen: false,
  setDesignPanelOpen: (v) => set({ designPanelOpen: v }),
  setHelperTextWindowOpen: (v) => {
    if (v) get().openTool('helpertext');
    else get().closeTool('helpertext');
  },
});
