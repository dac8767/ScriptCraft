// v5.25: the Markups tool — Derek's redesign of on-page annotations. A markup
// anchors IN the script as a `scriptMarkup` mark (over the selection, or over
// the whole current element when created at a bare cursor — the schema is
// text-only, so an inline anchor node is impossible) and carries its rich
// content HERE, keyed by id — the scriptNote model (mark in doc, data in
// store), persisted per script as the `_markups` save-content key.
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
  /** how it was made: 'range' = a real selection (highlight offered),
   *  'point' = a bare cursor (anchored on the whole element, no highlight) */
  anchor: 'range' | 'point';
  done: boolean;
  createdAt: string;
  /** v5.26: the user picked this icon by hand — auto-icon (first content
   *  kind) must never overwrite it. Absent on v5.25 saves = false. */
  iconManual?: boolean;
}

/** Content kinds a markup can contain — drives the auto-icon rule. */
export type MarkupKind = 'note' | 'bullets' | 'numbers' | 'checklist' | 'link' | 'image';

/** v5.26: the side-panel Filter. `hiddenIcons` holds the annotation TYPES
 *  (icons) unchecked in the "Select all that you want visible" grid — empty
 *  means everything shows. Separate from viewPrefs' markupHiddenIcons,
 *  which hides types in the SCRIPT (the "Show in Script" control). */
export interface MarkupFilters {
  hiddenIcons: string[];
  /** default 'open' — Derek: "by default it only shows incomplete markups" */
  done: 'open' | 'done' | 'all';
}

export const EMPTY_MARKUP_FILTERS: MarkupFilters = { hiddenIcons: [], done: 'open' };

export interface MarkupPreset { icon: string; color: string }

/** v5.26, Derek: an annotation made from a SELECTION auto-highlights the
 *  text in this yellow (the window's "Hide highlights in script" removes
 *  it; the swatch recolors it). First entry of MARKUP_HIGHLIGHTS. */
export const DEFAULT_MARKUP_HIGHLIGHT = '#ffe066';

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
  /** v5.41, Derek: while the annotation window is open, the ribbon's
   *  formatting buttons drive ITS mini editor instead of the script.
   *  Loosely typed (the tiptap Editor) to keep tiptap out of store types;
   *  never persisted. */
  markupMiniEditor: unknown;
  setMarkupMiniEditor: (ed: unknown) => void;
  /** v5.48, Derek: every annotation anchors to highlighted TEXT. An add
   *  with nothing selected arms this instead of creating — the next
   *  selection in the script places the annotation (the old Link Script
   *  Text flow, promoted to the front door). Ephemeral. */
  markupCreatePick: boolean;
  setMarkupCreatePick: (v: boolean) => void;
  /** v5.52, Derek: the panel's + moved into the window HEADER, which mounts
   *  without the editor — the click arms this and the panel body (which has
   *  the editor) runs createMarkupAtSelection. The pagesGotoRequest
   *  chrome→body pattern. Ephemeral. */
  markupAddRequest: boolean;
  setMarkupAddRequest: (v: boolean) => void;
  markupFilters: MarkupFilters;
  setMarkupFilters: (f: MarkupFilters) => void;
  /** v5.26: the side panel's search query (header ControlSearch). */
  markupSearch: string;
  setMarkupSearch: (q: string) => void;
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
  markupMiniEditor: null,
  setMarkupMiniEditor: (ed) => set({ markupMiniEditor: ed }),
  markupCreatePick: false,
  setMarkupCreatePick: (v) => set({ markupCreatePick: v }),
  markupAddRequest: false,
  setMarkupAddRequest: (v) => set({ markupAddRequest: v }),
  markupFilters: EMPTY_MARKUP_FILTERS,
  setMarkupFilters: (f) => set({ markupFilters: f }),
  markupSearch: '',
  setMarkupSearch: (q) => set({ markupSearch: q }),
});
