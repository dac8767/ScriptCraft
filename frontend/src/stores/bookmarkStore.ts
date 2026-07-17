/**
 * Last-edit tracking (v3.08 as part of Bookmarks; v3.25: bookmarks REMOVED —
 * Derek: markers already cover named jump points — but "Last Edit Location"
 * stays, now under the Edit menu).
 *
 * ScreenplayEditor stamps the selection position after every docChanged
 * transaction, per script ('local' for a never-saved doc). Jumps clamp to
 * the document, so a stale position lands near rather than throwing.
 *
 * Persistence: 'opendraft:bookmarks' (the key keeps its historical name on
 * purpose — renaming persisted keys orphans data; old byScript entries in
 * the blob are simply ignored now).
 */
import { create } from 'zustand';

const STORE_KEY = 'opendraft:bookmarks';

function load(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as { lastEdit?: Record<string, number> };
      if (p.lastEdit && typeof p.lastEdit === 'object') return p.lastEdit;
    }
  } catch { /* corrupt or unavailable — start empty */ }
  return {};
}

interface BookmarkState {
  lastEdit: Record<string, number>;
  setLastEdit: (scriptId: string, pos: number) => void;
}

export const useBookmarkStore = create<BookmarkState>((set, get) => ({
  lastEdit: load(),
  setLastEdit: (scriptId, pos) => {
    const lastEdit = { ...get().lastEdit, [scriptId]: pos };
    set({ lastEdit });
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ lastEdit }));
    } catch { /* storage unavailable */ }
  },
}));

/** Last-edit is keyed by script — a NEW, never-saved script has no id
 *  (currentScriptId is null on several paths). Those key under 'local'. */
export const bookmarkScriptKey = (scriptId: string | null | undefined): string => scriptId ?? 'local';
