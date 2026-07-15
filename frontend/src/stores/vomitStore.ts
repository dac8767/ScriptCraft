/**
 * Vomit Draft (v1.62) — session state for the timed no-editing writing sprint.
 *
 * Deliberately NOT persisted: a lock that survived an app restart with no
 * running timer would read as "the editor is broken". Restarting the app ends
 * the sprint.
 *
 * The lock itself is enforced in editor/extensions/VomitLock.ts; the tool UI
 * lives in components/VomitDraftTool.tsx. This store is the single source both
 * read.
 */
import { create } from 'zustand';

export interface VomitSession {
  /** Wall-clock ms when editing unlocks — or null for Hemingway mode
   *  (v1.74): no timer, the lock holds until it's switched off. */
  endsAt: number | null;
  /** Wall-clock ms when the sprint started (for the progress bar). */
  startedAt: number;
  /**
   * Document position floor captured at start: everything before it existed
   * before the sprint and is immutable. The effective floor also advances to
   * the start of the last block as new blocks are written (see VomitLock).
   */
  floor: number;
}

interface VomitState {
  session: VomitSession | null;
  /** Bumped every time the lock rejects an edit — the timer UI pulses on it. */
  blockedTick: number;
  start: (endsAt: number | null, floor: number) => void;
  /** Ends the sprint (timer done, ended early, or the script was swapped). */
  end: () => void;
  bumpBlocked: () => void;
}

export const useVomitStore = create<VomitState>((set) => ({
  session: null,
  blockedTick: 0,
  start: (endsAt, floor) => set({ session: { endsAt, startedAt: Date.now(), floor } }),
  end: () => set({ session: null }),
  bumpBlocked: () => set((s) => ({ blockedTick: s.blockedTick + 1 })),
}));

/** True while a sprint is running (and its clock hasn't run out). */
export function vomitLockActive(): boolean {
  const s = useVomitStore.getState().session;
  return !!s && (s.endsAt === null || Date.now() < s.endsAt);
}
