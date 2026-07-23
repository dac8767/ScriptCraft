// v4.24: Beats / Outline slice — the Beat Board + Outline-tabs DATA engine:
// beat & section (column) CRUD, the shared-beats-across-tabs outline-variation
// system, bar-routed edits (the Outline Bar edits ITS tab, which may not be the
// viewed one), and the debounced beat undo/redo with smart doc-vs-beat routing.
//
// Scope note: the Outline Bar DISPLAY config (outlineBarOpen/Zoom/RowScale/Rows/
// Labels, beatColorAllTabs) stays in editorStore — it's view-state-persisted
// render config, a separate concern from this data engine, and lives interleaved
// with the other chrome/display fields there. The beat/outline TYPES (BeatInfo,
// BeatColumn, OutlineTabData, OutlineBarRow, BeatLinkPreview, BeatArrangeMode,
// DEFAULT_OUTLINE_BAR_ROWS) also stay exported from editorStore — six external
// files type-import them from there — so we take them type-only here.
import type { StateCreator } from 'zustand';
import { uuid } from '../../utils/uuid';
import { clamp } from '../viewState';
import type { EditorState, BeatInfo, BeatColumn, OutlineTabData, BeatArrangeMode } from '../editorStore';

const BEAT_UNDO_MAX = 50;
const BEAT_SNAPSHOT_DEBOUNCE = 300; // ms — group rapid changes into one undo step

export interface BeatsOutlineSlice {
  // Beats
  beatArrangeMode: BeatArrangeMode;
  setBeatArrangeMode: (mode: BeatArrangeMode) => void;
  beatColumns: BeatColumn[];
  setBeatColumns: (columns: BeatColumn[]) => void;

  /* v2.30: OUTLINE VARIATIONS — browser-style tabs on the Outline window.
     ONE pool of beats is shared by every tab; each tab has its own sections
     and its own beat→section assignment/order. The VIEWED tab's sections and
     assignments live in beatColumns / beats.columnId+position (so every
     existing consumer keeps one source of truth); every other tab's are
     parked in outlineStash. The bar shows the tab picked as outlineBarTab. */
  /* v2.47, Derek: a tab is BOUND to one arrangement — whichever was active
     when it was created, forever. Old saves' tabs have no arrangeMode yet;
     they're stamped lazily with the mode they're next shown in. */
  outlineTabs: Array<{ id: string; name: string; arrangeMode?: BeatArrangeMode }>;
  viewedOutlineTab: string;
  outlineBarTab: string;
  outlineStash: Record<string, OutlineTabData>;
  addOutlineTab: (mode?: BeatArrangeMode) => string;
  switchOutlineTab: (id: string) => void;
  renameOutlineTab: (id: string, name: string) => void;
  deleteOutlineTab: (id: string) => void;
  setOutlineBarTab: (id: string) => void;
  /** v2.47: the Arrangement toggle NAVIGATES — it jumps to a tab of the
   *  asked-for arrangement (creating one if none exists) instead of
   *  changing the current tab, which keeps its arrangement for life. */
  goToArrangement: (mode: BeatArrangeMode) => void;
  /** Reset to a single empty tab — new script / import. */
  resetOutlineTabs: () => void;
  /** Restore persisted tab state on script load. */
  loadOutlineTabs: (tabs: Array<{ id: string; name: string; arrangeMode?: BeatArrangeMode }>, viewed: string, bar: string, stash: Record<string, OutlineTabData>) => void;
  /* Bar-routed edits: the bar edits ITS tab, which may not be the viewed one. */
  barUpdateColumn: (id: string, updates: Partial<{ title: string; targetPages: number }>) => void;
  barAddColumn: (title: string) => string;
  /** Move a beat into a section of the bar's tab at the given index. */
  barAssignBeat: (beatId: string, columnId: string, index: number) => void;
  /** v2.60: pin beats at hand-placed pages on the bar's tab (offset from the
   *  section's start). Presentation only — never reorders the board, never
   *  pushes a beat-undo snapshot. undefined un-pins (back to packed). */
  barSetBeatOffsets: (offsets: Record<string, number | undefined>) => void;
  addBeatColumn: (title: string, targetPages?: number) => string;
  updateBeatColumn: (id: string, updates: Partial<{ title: string; position: number; width: number; targetPages: number }>) => void;
  deleteBeatColumn: (id: string) => void;
  beats: BeatInfo[];
  setBeats: (beats: BeatInfo[]) => void;
  addBeat: (title: string, columnId: string) => string;
  updateBeat: (id: string, updates: Partial<Omit<BeatInfo, 'id'>>) => void;
  deleteBeat: (id: string) => void;
  // Beat undo/redo
  beatUndo: () => void;
  beatRedo: () => void;
  /** v2.36: smart undo routing — when the newest change is a beat edit
   *  (delete a beat, move one…), Undo restores it; otherwise the script's
   *  own history runs. These stamps are how the router decides. */
  lastBeatEditAt: number;
  lastDocEditAt: number;
  noteDocEdit: () => void;
  canBeatUndo: boolean;
  canBeatRedo: boolean;
  _beatUndoStack: { beats: BeatInfo[]; beatColumns: BeatColumn[] }[];
  _beatRedoStack: { beats: BeatInfo[]; beatColumns: BeatColumn[] }[];
  _beatSnapshotTime: number;
  _beatIsUndoing: boolean;
}

export const createBeatsOutlineSlice: StateCreator<EditorState, [], [], BeatsOutlineSlice> = (set, get, api) => {
  // Push current beat state onto the undo stack (debounced unless forced). Uses
  // api.setState — the exact store method the old module-level _pushBeatSnapshot
  // reached for through the useEditorStore singleton — so this slice needs no
  // back-reference to the store it lives in.
  const pushBeatSnapshot = (force = false) => {
    const s = get() as EditorState & { _beatIsUndoing: boolean; _beatUndoStack: unknown[]; _beatSnapshotTime: number };
    if (s._beatIsUndoing) {
      api.setState({ _beatIsUndoing: false } as Partial<EditorState>);
      return;
    }
    const now = Date.now();
    if (!force && now - s._beatSnapshotTime < BEAT_SNAPSHOT_DEBOUNCE) return;
    const stack = [...(s._beatUndoStack as { beats: BeatInfo[]; beatColumns: BeatColumn[] }[]), { beats: s.beats, beatColumns: s.beatColumns }];
    if (stack.length > BEAT_UNDO_MAX) stack.shift();
    api.setState({ _beatUndoStack: stack, _beatRedoStack: [], _beatSnapshotTime: now, canBeatUndo: true, canBeatRedo: false, lastBeatEditAt: now } as Partial<EditorState>);
  };

  return {
    // Beats — undo/redo internals (not serialized)
    _beatUndoStack: [] as { beats: BeatInfo[]; beatColumns: BeatColumn[] }[],
    _beatRedoStack: [] as { beats: BeatInfo[]; beatColumns: BeatColumn[] }[],
    _beatSnapshotTime: 0,
    _beatIsUndoing: false,
    canBeatUndo: false,
    canBeatRedo: false,
    lastBeatEditAt: 0,
    lastDocEditAt: 0,
    noteDocEdit: () => set({ lastDocEditAt: Date.now() }),
    beatUndo: () =>
      set((s) => {
        const stack = s._beatUndoStack as { beats: BeatInfo[]; beatColumns: BeatColumn[] }[];
        if (stack.length === 0) return {};
        const prev = stack[stack.length - 1];
        const redo = [...(s._beatRedoStack as { beats: BeatInfo[]; beatColumns: BeatColumn[] }[]), { beats: s.beats, beatColumns: s.beatColumns }];
        return {
          beats: prev.beats,
          beatColumns: prev.beatColumns,
          _beatUndoStack: stack.slice(0, -1),
          _beatRedoStack: redo,
          _beatIsUndoing: true,
          canBeatUndo: stack.length > 1,
          canBeatRedo: true,
          lastBeatEditAt: Date.now(),
        };
      }),
    beatRedo: () =>
      set((s) => {
        const stack = s._beatRedoStack as { beats: BeatInfo[]; beatColumns: BeatColumn[] }[];
        if (stack.length === 0) return {};
        const next = stack[stack.length - 1];
        const undo = [...(s._beatUndoStack as { beats: BeatInfo[]; beatColumns: BeatColumn[] }[]), { beats: s.beats, beatColumns: s.beatColumns }];
        return {
          beats: next.beats,
          beatColumns: next.beatColumns,
          _beatUndoStack: undo,
          _beatRedoStack: stack.slice(0, -1),
          _beatIsUndoing: true,
          canBeatUndo: true,
          canBeatRedo: stack.length > 1,
          lastBeatEditAt: Date.now(),
        };
      }),

    // Beats
    beatArrangeMode: 'auto',
    setBeatArrangeMode: (mode) => set({ beatArrangeMode: mode }),
    beatColumns: [],
    setBeatColumns: (columns) => set({ beatColumns: columns }),

    /* v2.30: outline variation tabs. */
    outlineTabs: [{ id: 'tab-1', name: 'Outline 1', arrangeMode: 'auto' }],
    viewedOutlineTab: 'tab-1',
    outlineBarTab: 'tab-1',
    outlineStash: {},
    addOutlineTab: (mode) => {
      const id = uuid();
      set((s) => {
        // Park the viewed tab's data, open the new tab EMPTY: every shared
        // beat lands in Uncategorized until it's dragged into a section.
        const slots: OutlineTabData['beatSlots'] = {};
        for (const b of s.beats) slots[b.id] = { columnId: b.columnId, position: b.position, barOffset: b.barOffset };
        // v2.47: the new tab is bound, for life, to the arrangement that's
        // active at creation (or the one explicitly asked for).
        const arrangeMode = mode ?? s.beatArrangeMode;
        return {
          outlineTabs: [...s.outlineTabs, { id, name: `Outline ${s.outlineTabs.length + 1}`, arrangeMode }],
          outlineStash: { ...s.outlineStash, [s.viewedOutlineTab]: { columns: s.beatColumns, beatSlots: slots } },
          viewedOutlineTab: id,
          beatColumns: [],
          beatArrangeMode: arrangeMode,
        };
      });
      return id;
    },
    switchOutlineTab: (id) => set((s) => {
      if (id === s.viewedOutlineTab || !s.outlineTabs.some((t) => t.id === id)) return {};
      const slots: OutlineTabData['beatSlots'] = {};
      for (const b of s.beats) slots[b.id] = { columnId: b.columnId, position: b.position, barOffset: b.barOffset };
      const stash = { ...s.outlineStash, [s.viewedOutlineTab]: { columns: s.beatColumns, beatSlots: slots } };
      const target = stash[id] ?? { columns: [], beatSlots: {} };
      delete stash[id];
      // Beats without a slot in the target tab keep their columnId — it won't
      // match any of the target's sections, so they show as Uncategorized.
      const beats = s.beats.map((b) => {
        const slot = target.beatSlots[b.id];
        return slot ? { ...b, columnId: slot.columnId, position: slot.position, barOffset: slot.barOffset } : b;
      });
      // v2.47: the view follows the tab's own arrangement. A tab from an old
      // save has none yet — it's stamped with the mode it's shown in now.
      const targetTab = s.outlineTabs.find((t) => t.id === id)!;
      const arrangeMode = targetTab.arrangeMode ?? s.beatArrangeMode;
      const outlineTabs = targetTab.arrangeMode === undefined
        ? s.outlineTabs.map((t) => (t.id === id ? { ...t, arrangeMode } : t))
        : s.outlineTabs;
      return { viewedOutlineTab: id, outlineStash: stash, beatColumns: target.columns, beats, beatArrangeMode: arrangeMode, outlineTabs };
    }),
    renameOutlineTab: (id, name) => set((s) => ({
      outlineTabs: s.outlineTabs.map((t) => (t.id === id ? { ...t, name: name.trim() || t.name } : t)),
    })),
    deleteOutlineTab: (id) => set((s) => {
      if (s.outlineTabs.length <= 1) return {};
      const remaining = s.outlineTabs.filter((t) => t.id !== id);
      let { viewedOutlineTab, beatColumns, beats, outlineStash } = s;
      if (id === s.viewedOutlineTab) {
        // Load the nearest remaining tab; the deleted tab's data just drops.
        const next = remaining[Math.max(0, s.outlineTabs.findIndex((t) => t.id === id) - 1)];
        const stash = { ...outlineStash };
        const target = stash[next.id] ?? { columns: [], beatSlots: {} };
        delete stash[next.id];
        beats = beats.map((b) => {
          const slot = target.beatSlots[b.id];
          return slot ? { ...b, columnId: slot.columnId, position: slot.position, barOffset: slot.barOffset } : b;
        });
        beatColumns = target.columns;
        viewedOutlineTab = next.id;
        outlineStash = stash;
      } else {
        outlineStash = { ...outlineStash };
        delete outlineStash[id];
      }
      // v2.47: landing on another tab means adopting ITS arrangement.
      const landed = remaining.find((t) => t.id === viewedOutlineTab);
      return {
        outlineTabs: remaining,
        viewedOutlineTab,
        beatColumns,
        beats,
        outlineStash,
        outlineBarTab: s.outlineBarTab === id ? viewedOutlineTab : s.outlineBarTab,
        beatArrangeMode: landed?.arrangeMode ?? s.beatArrangeMode,
      };
    }),
    setOutlineBarTab: (id) => set((s) => (s.outlineTabs.some((t) => t.id === id) ? { outlineBarTab: id } : {})),
    goToArrangement: (mode) => {
      const s = get();
      // Lazy-migrate a legacy active tab: it keeps the mode it's shown in.
      const active = s.outlineTabs.find((t) => t.id === s.viewedOutlineTab);
      if (active && active.arrangeMode === undefined) {
        set({ outlineTabs: s.outlineTabs.map((t) => (t.id === active.id ? { ...t, arrangeMode: s.beatArrangeMode } : t)) });
      }
      if (s.beatArrangeMode === mode) return;
      const target = get().outlineTabs.find((t) => t.arrangeMode === mode);
      if (target) get().switchOutlineTab(target.id);
      else get().addOutlineTab(mode);
    },
    resetOutlineTabs: () => set({
      outlineTabs: [{ id: 'tab-1', name: 'Outline 1', arrangeMode: 'auto' }],
      viewedOutlineTab: 'tab-1',
      outlineBarTab: 'tab-1',
      outlineStash: {},
    }),
    loadOutlineTabs: (tabs, viewed, bar, stash) => set(() => {
      const valid = tabs.length > 0 ? tabs : [{ id: 'tab-1', name: 'Outline 1' }];
      const viewedId = valid.some((t) => t.id === viewed) ? viewed : valid[0].id;
      return {
        outlineTabs: valid,
        viewedOutlineTab: viewedId,
        outlineBarTab: valid.some((t) => t.id === bar) ? bar : viewedId,
        outlineStash: stash ?? {},
      };
    }),
    barUpdateColumn: (id, updates) => {
      const s = get();
      if (s.outlineBarTab === s.viewedOutlineTab) { s.updateBeatColumn(id, updates); return; }
      set((st) => {
        const tab = st.outlineStash[st.outlineBarTab];
        if (!tab) return {};
        return {
          outlineStash: {
            ...st.outlineStash,
            [st.outlineBarTab]: { ...tab, columns: tab.columns.map((c) => (c.id === id ? { ...c, ...updates } : c)) },
          },
        };
      });
    },
    barAddColumn: (title) => {
      const s = get();
      if (s.outlineBarTab === s.viewedOutlineTab) return s.addBeatColumn(title);
      const id = uuid();
      set((st) => {
        const tab = st.outlineStash[st.outlineBarTab];
        if (!tab) return {};
        const maxPos = tab.columns.length > 0 ? Math.max(...tab.columns.map((c) => c.position)) : -1;
        return {
          outlineStash: {
            ...st.outlineStash,
            [st.outlineBarTab]: { ...tab, columns: [...tab.columns, { id, title, position: maxPos + 1, width: 0, targetPages: 1 }] },
          },
        };
      });
      return id;
    },
    barAssignBeat: (beatId, columnId, index) => {
      const s = get();
      if (s.outlineBarTab === s.viewedOutlineTab) {
        pushBeatSnapshot();
        set((st) => {
          const siblings = st.beats
            .filter((b) => b.columnId === columnId && b.id !== beatId)
            .sort((a, b) => a.position - b.position)
            .map((b) => b.id);
          siblings.splice(clamp(index, 0, siblings.length), 0, beatId);
          const pos = new Map(siblings.map((bid, i) => [bid, i]));
          return {
            beats: st.beats.map((b) => (pos.has(b.id)
              // v2.60: entering a different section drops the beat's bar pin.
              ? { ...b, columnId, position: pos.get(b.id)!, ...(b.id === beatId && b.columnId !== columnId ? { barOffset: undefined } : {}) }
              : b)),
          };
        });
        return;
      }
      set((st) => {
        const tab = st.outlineStash[st.outlineBarTab];
        if (!tab) return {};
        const slots = { ...tab.beatSlots };
        const siblings = Object.entries(slots)
          .filter(([bid, sl]) => sl.columnId === columnId && bid !== beatId)
          .sort((a, b) => a[1].position - b[1].position)
          .map(([bid]) => bid);
        siblings.splice(clamp(index, 0, siblings.length), 0, beatId);
        const movedAcross = slots[beatId] && slots[beatId].columnId !== columnId;
        siblings.forEach((bid, i) => { slots[bid] = { ...slots[bid], columnId, position: i }; });
        // v2.60: entering a different section drops the beat's bar pin.
        if (movedAcross) slots[beatId] = { ...slots[beatId], barOffset: undefined };
        return { outlineStash: { ...st.outlineStash, [st.outlineBarTab]: { ...tab, beatSlots: slots } } };
      });
    },
    barSetBeatOffsets: (offsets) => {
      const s = get();
      if (s.outlineBarTab === s.viewedOutlineTab) {
        set((st) => ({
          beats: st.beats.map((b) => (b.id in offsets ? { ...b, barOffset: offsets[b.id] } : b)),
        }));
        return;
      }
      set((st) => {
        const tab = st.outlineStash[st.outlineBarTab];
        if (!tab) return {};
        const slots = { ...tab.beatSlots };
        for (const [bid, off] of Object.entries(offsets)) {
          if (slots[bid]) slots[bid] = { ...slots[bid], barOffset: off };
        }
        return { outlineStash: { ...st.outlineStash, [st.outlineBarTab]: { ...tab, beatSlots: slots } } };
      });
    },
    // v2.20: sections always get a page budget (default 1) — a blank budget
    // renders a section you can't grab on the Outline Bar.
    addBeatColumn: (title, targetPages = 1) => {
      const id = uuid();
      pushBeatSnapshot();
      set((s) => {
        const maxPos = s.beatColumns.length > 0 ? Math.max(...s.beatColumns.map((c) => c.position)) : -1;
        return { beatColumns: [...s.beatColumns, { id, title, position: maxPos + 1, width: 0, targetPages: Math.max(1, Math.round(targetPages)) }] };
      });
      return id;
    },
    updateBeatColumn: (id, updates) => {
      pushBeatSnapshot();
      set((s) => ({
        beatColumns: s.beatColumns.map((c) => (c.id === id ? { ...c, ...updates } : c)),
      }));
    },
    deleteBeatColumn: (id) => {
      pushBeatSnapshot(true);
      set((s) => ({
        beatColumns: s.beatColumns.filter((c) => c.id !== id),
        beats: s.beats.filter((b) => b.columnId !== id),
      }));
    },
    beats: [],
    setBeats: (beats) => {
      pushBeatSnapshot();
      // v2.60: a bar pin is an offset within the beat's SECTION — a beat handed
      // a new section (board drags between columns come through here) starts
      // un-pinned there, unless the caller set a fresh pin itself.
      set((s) => {
        const prev = new Map(s.beats.map((b) => [b.id, b]));
        return {
          beats: beats.map((b) => {
            const p = prev.get(b.id);
            return p && p.columnId !== b.columnId && b.barOffset === p.barOffset && b.barOffset !== undefined
              ? { ...b, barOffset: undefined }
              : b;
          }),
        };
      });
    },
    addBeat: (title, columnId) => {
      pushBeatSnapshot(true);
      const id = uuid();   // v1.75: returned so the Outline Bar can place it
      set((s) => {
        const colBeats = s.beats.filter((b) => b.columnId === columnId);
        const maxPos = colBeats.length > 0 ? Math.max(...colBeats.map((b) => b.position)) : -1;
        return {
          beats: [
            ...s.beats,
            {
              id,
              title,
              description: '',
              columnId,
              position: maxPos + 1,
              color: '',
              imageUrl: '',
              cardWidth: 0,
              cardHeight: 0,
              x: 0,
              y: 0,
              imageHeight: 0,
              outlineSpan: 1,   // v2.20: never blank — 1 page by default
            },
          ],
        };
      });
      return id;
    },
    updateBeat: (id, updates) => {
      pushBeatSnapshot();
      set((s) => ({
        beats: s.beats.map((b) => {
          if (b.id !== id) return b;
          // v2.60: same rule as setBeats — leaving the section drops the pin.
          const dropPin = updates.columnId !== undefined && updates.columnId !== b.columnId && !('barOffset' in updates);
          return { ...b, ...updates, ...(dropPin ? { barOffset: undefined } : {}) };
        }),
      }));
    },
    deleteBeat: (id) => {
      pushBeatSnapshot(true);
      set((s) => ({ beats: s.beats.filter((b) => b.id !== id) }));
    },
  };
};
