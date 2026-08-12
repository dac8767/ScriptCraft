/**
 * Window-action undo (v6.77) — Derek: "using Undo button or ctrl+Z / cmd+Z
 * should undo changes made in windows as well. I tried to undo my accidental
 * help text reset, but undo does not work for that."
 *
 * A third undo LANE beside the script's (ProseMirror history) and the beat
 * board's (v2.36): major changes made through window buttons — Reset helper
 * text, the Customize resets, Reset all design, Hide all… — push an entry
 * here, and smartUndo/smartRedo route to whichever lane holds the newest
 * change. An entry is a pair of closures over the state it restores, taken
 * at the moment the button ran (utils/majorChange.ts is the one wrapper
 * that pushes them).
 *
 * The stacks live in their own store, not editorStore, so the Toolbar's
 * Undo button can subscribe to canUndo without editorStore growing another
 * field — and so nothing here can cycle back into the stores the closures
 * restore.
 */
import { create } from 'zustand';

export interface WindowAction {
  /** What the writer did, in words a toast can show ("Reset helper text"). */
  label: string;
  /** When it happened — how smartUndo ranks this lane against the others. */
  at: number;
  undo: () => void;
  redo: () => void;
}

interface WindowUndoState {
  undoStack: WindowAction[];
  redoStack: WindowAction[];
  /** Record a just-run action. Clears the redo lane, like every editor. */
  push: (label: string, undo: () => void, redo: () => void) => void;
  /** Run + pop the newest entry. Returns its label, or null if empty. */
  undoLast: () => string | null;
  redoLast: () => string | null;
}

/** Plenty for a session of window actions; closures hold real state, so the
 *  stack is capped rather than unbounded. */
const MAX_ENTRIES = 20;

export const useWindowUndoStore = create<WindowUndoState>((set, get) => ({
  undoStack: [],
  redoStack: [],
  push: (label, undo, redo) => set((s) => ({
    undoStack: [...s.undoStack, { label, at: Date.now(), undo, redo }].slice(-MAX_ENTRIES),
    redoStack: [],
  })),
  undoLast: () => {
    const s = get();
    const entry = s.undoStack[s.undoStack.length - 1];
    if (!entry) return null;
    try { entry.undo(); } catch { return null; }   // a broken closure must not eat the stack
    set({
      undoStack: s.undoStack.slice(0, -1),
      // Restamp: redo recency is measured from the undo, not the original act.
      redoStack: [...s.redoStack, { ...entry, at: Date.now() }],
    });
    return entry.label;
  },
  redoLast: () => {
    const s = get();
    const entry = s.redoStack[s.redoStack.length - 1];
    if (!entry) return null;
    try { entry.redo(); } catch { return null; }
    set({
      redoStack: s.redoStack.slice(0, -1),
      undoStack: [...s.undoStack, { ...entry, at: Date.now() }],
    });
    return entry.label;
  },
}));
