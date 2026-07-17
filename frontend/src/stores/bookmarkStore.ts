/**
 * Bookmarks (v3.08, Derek) — named jump points in the script, surfaced by the
 * Bookmarks menu (in-window and native alike; the menu is built once in
 * MenuBar and synced, so this store is the single source).
 *
 * Positions are ProseMirror document positions, kept per SCRIPT. They stay
 * valid across edits because ScreenplayEditor maps every bookmark through
 * each transaction's mapping (see the 'transaction' listener there). The
 * store also tracks the "last edit" position per script — the permanent
 * first entry of the Bookmarks menu.
 *
 * Persistence: 'opendraft:bookmarks' (the opendraft:* prefix is the app's
 * storage identity — see CLAUDE.md). Positions saved across sessions are
 * clamped to the document on jump, so a stale one lands near, not crashes.
 */
import { create } from 'zustand';

export interface Bookmark {
  id: string;
  label: string;
  pos: number;
}

interface PersistShape {
  byScript: Record<string, Bookmark[]>;
  lastEdit: Record<string, number>;
}

const STORE_KEY = 'opendraft:bookmarks';

function load(): PersistShape {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as PersistShape;
      return {
        byScript: p.byScript && typeof p.byScript === 'object' ? p.byScript : {},
        lastEdit: p.lastEdit && typeof p.lastEdit === 'object' ? p.lastEdit : {},
      };
    }
  } catch { /* corrupt or unavailable — start empty */ }
  return { byScript: {}, lastEdit: {} };
}

function save(s: PersistShape) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch { /* storage unavailable */ }
}

interface BookmarkState extends PersistShape {
  add: (scriptId: string, bm: Bookmark) => void;
  remove: (scriptId: string, id: string) => void;
  /** Rewrite every bookmark position for a script through a transaction's
   *  mapping. Called on each docChanged transaction. */
  mapPositions: (scriptId: string, mapFn: (pos: number) => number) => void;
  setLastEdit: (scriptId: string, pos: number) => void;
}

const _init = load();

export const useBookmarkStore = create<BookmarkState>((set, get) => ({
  byScript: _init.byScript,
  lastEdit: _init.lastEdit,

  add: (scriptId, bm) => {
    const byScript = {
      ...get().byScript,
      [scriptId]: [...(get().byScript[scriptId] ?? []), bm],
    };
    set({ byScript });
    save({ byScript, lastEdit: get().lastEdit });
  },

  remove: (scriptId, id) => {
    const list = (get().byScript[scriptId] ?? []).filter((b) => b.id !== id);
    const byScript = { ...get().byScript, [scriptId]: list };
    set({ byScript });
    save({ byScript, lastEdit: get().lastEdit });
  },

  mapPositions: (scriptId, mapFn) => {
    const list = get().byScript[scriptId];
    if (!list || list.length === 0) return;
    const mapped = list.map((b) => ({ ...b, pos: mapFn(b.pos) }));
    // No-op transactions map every pos to itself — skip the write.
    if (mapped.every((b, i) => b.pos === list[i].pos)) return;
    const byScript = { ...get().byScript, [scriptId]: mapped };
    set({ byScript });
    save({ byScript, lastEdit: get().lastEdit });
  },

  setLastEdit: (scriptId, pos) => {
    const lastEdit = { ...get().lastEdit, [scriptId]: pos };
    set({ lastEdit });
    save({ byScript: get().byScript, lastEdit });
  },
}));

/** Bookmarks are keyed by script — but a NEW, never-saved script has no id
 *  (currentScriptId is null on several paths). Those key under 'local' so
 *  bookmarking always works; jumps clamp to the document, so a stale 'local'
 *  entry lands near rather than crashing. */
export const bookmarkScriptKey = (scriptId: string | null | undefined): string => scriptId ?? 'local';

/** A readable label for a bookmark at `pos`: the surrounding block's text,
 *  trimmed — or a generic fallback for empty lines. */
export function bookmarkLabelAt(doc: { resolve: (p: number) => { parent: { textContent: string } } }, pos: number): string {
  try {
    const text = doc.resolve(pos).parent.textContent.trim();
    if (text) return text.length > 42 ? `${text.slice(0, 42)}…` : text;
  } catch { /* out-of-range — fall through */ }
  return 'Empty line';
}
