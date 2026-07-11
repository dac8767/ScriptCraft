/**
 * Shortcut overrides store (v0.77). Kept separate from editorStore so the
 * global key handler and the Customize tab react to the same state.
 */
import { create } from 'zustand';
import {
  loadShortcutOverrides,
  saveShortcutOverrides,
  effectiveBindings,
  type ShortcutOverrides,
} from '../components/shortcuts';

interface ShortcutState {
  overrides: ShortcutOverrides;
  /** command id -> effective combo (override, else default). */
  bindings: Record<string, string | null>;
  /** Bind a command to a combo, or null to leave it unbound. */
  setBinding: (id: string, combo: string | null) => void;
  /** Drop the override so the command returns to its default. */
  resetBinding: (id: string) => void;
  /** Clear every override. */
  resetAll: () => void;
}

const init = loadShortcutOverrides();

export const useShortcutStore = create<ShortcutState>((set, get) => ({
  overrides: init,
  bindings: effectiveBindings(init),

  setBinding: (id, combo) => {
    const overrides = { ...get().overrides, [id]: combo };
    saveShortcutOverrides(overrides);
    set({ overrides, bindings: effectiveBindings(overrides) });
  },

  resetBinding: (id) => {
    const overrides = { ...get().overrides };
    delete overrides[id];
    saveShortcutOverrides(overrides);
    set({ overrides, bindings: effectiveBindings(overrides) });
  },

  resetAll: () => {
    saveShortcutOverrides({});
    set({ overrides: {}, bindings: effectiveBindings({}) });
  },
}));
