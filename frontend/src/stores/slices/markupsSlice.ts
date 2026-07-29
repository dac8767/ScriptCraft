// v5.25: the Markups tool — Derek's redesign of on-page annotations. A markup
// anchors IN the script (a `scriptMarkup` mark over a selection, or a
// zero-width `markupAnchor` atom at a cursor) and carries its rich content
// HERE, keyed by id — the scriptNote model (mark in doc, data in store),
// persisted per script as the `_markups` save-content key.
import type { StateCreator } from 'zustand';
import type { EditorState } from '../editorStore';

export interface ScriptMarkup {
  id: string;
  /** TipTap JSON of the popover's mini editor; null = nothing written yet */
  content: unknown | null;
  /** icon id from MARKUP_ICONS, or 'emoji:<char>' */
  icon: string;
  /** icon color (also the highlight fallback tint) */
  color: string;
  /** highlight color painted on the script text — range markups only */
  highlight: string | null;
  /** how it anchors: 'range' = mark over text, 'point' = cursor atom */
  anchor: 'range' | 'point';
  done: boolean;
  createdAt: string;
}

/** Content kinds a markup can contain — the Filter's "what it includes". */
export type MarkupKind = 'note' | 'bullets' | 'numbers' | 'checklist' | 'link' | 'image';

export interface MarkupFilters {
  /** icon ids to show; empty = all */
  icons: string[];
  /** content kinds to show; empty = all */
  kinds: MarkupKind[];
  /** default 'open' — Derek: "by default it only shows incomplete markups" */
  done: 'open' | 'done' | 'all';
}

export const EMPTY_MARKUP_FILTERS: MarkupFilters = { icons: [], kinds: [], done: 'open' };

export interface MarkupPreset { icon: string; color: string }

/** Shipped preset combos — Derek's six, in his order. Customize ▸ Markups
 *  edits the live copy (viewState.markupPresets); this is the reset state.
 *  Lives HERE (pure data) so the store can default from it without pulling
 *  a component module into the store graph. */
export const DEFAULT_MARKUP_PRESETS: MarkupPreset[] = [
  { icon: 'flag', color: '#e05555' },
  { icon: 'star', color: '#e8b44f' },
  { icon: 'hashtag', color: '#4a9eff' },
  { icon: 'dot', color: '#9a9a9a' },
  { icon: 'check', color: '#2d8a4e' },
  { icon: 'exclaim', color: '#e8794f' },
];

export interface MarkupsSlice {
  markups: ScriptMarkup[];
  /** wholesale replace (script load / history restore) */
  setMarkups: (list: ScriptMarkup[]) => void;
  addMarkup: (m: ScriptMarkup) => void;
  updateMarkup: (id: string, patch: Partial<ScriptMarkup>) => void;
  removeMarkup: (id: string) => void;
  /** the markup whose popover editor is open (null = closed) */
  markupEditorId: string | null;
  setMarkupEditorId: (id: string | null) => void;
  markupFilters: MarkupFilters;
  setMarkupFilters: (f: MarkupFilters) => void;
}

export const createMarkupsSlice: StateCreator<EditorState, [], [], MarkupsSlice> = (set) => ({
  markups: [],
  setMarkups: (list) => set({ markups: list }),
  addMarkup: (m) => set((s) => ({ markups: [...s.markups, m] })),
  updateMarkup: (id, patch) => set((s) => ({
    markups: s.markups.map((m) => (m.id === id ? { ...m, ...patch } : m)),
  })),
  removeMarkup: (id) => set((s) => ({ markups: s.markups.filter((m) => m.id !== id) })),
  markupEditorId: null,
  setMarkupEditorId: (id) => set({ markupEditorId: id }),
  markupFilters: EMPTY_MARKUP_FILTERS,
  setMarkupFilters: (f) => set({ markupFilters: f }),
});
