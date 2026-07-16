/**
 * outlinePresetStore (v2.26) — the user's own outline presets.
 *
 * A custom preset is the same shape the built-ins use (section titles +
 * page budgets, parallel arrays), saved from whatever is on the Outline
 * board. Persisted under 'opendraft:outlinePresets' (legacy key prefix on
 * purpose — see CLAUDE.md naming history). Export/import is a plain JSON
 * file of the presets array so writers can share structures.
 */
import { create } from 'zustand';
import { uuid } from '../utils/uuid';

export interface CustomOutlinePreset {
  id: string;
  name: string;
  columns: string[];
  pages: number[];
}

const STORAGE_KEY = 'opendraft:outlinePresets';

/** Validate one preset-shaped object (from storage or an imported file). */
export function isValidCustomPreset(p: unknown): p is Omit<CustomOutlinePreset, 'id'> & { id?: string } {
  if (!p || typeof p !== 'object') return false;
  const o = p as Record<string, unknown>;
  return typeof o.name === 'string' && o.name.trim().length > 0
    && Array.isArray(o.columns) && o.columns.length > 0 && o.columns.every((c) => typeof c === 'string')
    && Array.isArray(o.pages) && o.pages.length === o.columns.length
    && o.pages.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 1);
}

function loadPresets(): CustomOutlinePreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(isValidCustomPreset).map((p) => ({ ...p, id: p.id || uuid(), pages: p.pages.map((n) => Math.round(n)) }));
  } catch {
    return [];
  }
}

function persist(presets: CustomOutlinePreset[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(presets)); } catch { /* storage full — presets stay in memory */ }
}

interface OutlinePresetState {
  presets: CustomOutlinePreset[];
  /** Save the current board structure under a name. Returns the new preset. */
  savePreset: (name: string, columns: string[], pages: number[]) => CustomOutlinePreset;
  deletePreset: (id: string) => void;
  /** The export payload: a pretty JSON array of the user's presets. */
  exportJson: () => string;
  /** Merge presets from an exported file (accepts one preset or an array).
   *  Returns how many were added; invalid entries and name duplicates are
   *  skipped, never silently mangled. */
  importPresets: (json: string) => { added: number; skipped: number; error?: string };
}

export const useOutlinePresetStore = create<OutlinePresetState>((set, get) => ({
  presets: loadPresets(),

  savePreset: (name, columns, pages) => {
    const preset: CustomOutlinePreset = {
      id: uuid(),
      name: name.trim(),
      columns: [...columns],
      pages: pages.map((n) => Math.max(1, Math.round(Number(n) || 1))),
    };
    set((s) => {
      const next = [...s.presets, preset];
      persist(next);
      return { presets: next };
    });
    return preset;
  },

  deletePreset: (id) => {
    set((s) => {
      const next = s.presets.filter((p) => p.id !== id);
      persist(next);
      return { presets: next };
    });
  },

  exportJson: () => JSON.stringify(get().presets.map(({ id: _id, ...rest }) => rest), null, 2),

  importPresets: (json) => {
    let parsed: unknown;
    try { parsed = JSON.parse(json); } catch { return { added: 0, skipped: 0, error: 'Not a valid JSON file.' }; }
    const list = Array.isArray(parsed) ? parsed : [parsed];
    const existingNames = new Set(get().presets.map((p) => p.name.toLowerCase()));
    let added = 0; let skipped = 0;
    const incoming: CustomOutlinePreset[] = [];
    for (const item of list) {
      if (!isValidCustomPreset(item) || existingNames.has(item.name.trim().toLowerCase())) { skipped++; continue; }
      existingNames.add(item.name.trim().toLowerCase());
      incoming.push({ id: uuid(), name: item.name.trim(), columns: [...item.columns], pages: item.pages.map((n) => Math.round(n)) });
      added++;
    }
    if (incoming.length > 0) {
      set((s) => {
        const next = [...s.presets, ...incoming];
        persist(next);
        return { presets: next };
      });
    }
    if (added === 0 && !list.some(isValidCustomPreset)) {
      return { added, skipped, error: 'No outline presets found in that file.' };
    }
    return { added, skipped };
  },
}));
