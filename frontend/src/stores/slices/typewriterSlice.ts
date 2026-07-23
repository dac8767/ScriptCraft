// v4.23: Typewriter / writing-focus slice. All view-state-backed (reads _vs
// defaults, persists via saveViewState); two setters clamp their range.
import type { StateCreator } from 'zustand';
import { _vs, saveViewState, clamp } from '../viewState';
import type { EditorState } from '../editorStore';

export interface TypewriterSlice {
  /** v1.84: the tool's master switch — off silences EVERY Typewriter feature
   *  while each sub-option keeps its own checked state for next time. */
  typewriterMasterEnabled: boolean;
  setTypewriterMasterEnabled: (v: boolean) => void;
  /** v1.68: Typewriter mode — auto-scroll keeps the active line centered. */
  typewriterEnabled: boolean;
  setTypewriterEnabled: (v: boolean) => void;
  /** v1.70: also recenter when the cursor MOVES (clicks, arrow keys), not
   *  just when typing. Sub-option — only applies while typewriterEnabled. */
  typewriterFollowCursor: boolean;
  setTypewriterFollowCursor: (v: boolean) => void;
  /** v1.72 (ported from obsidian-typewriter-mode): where the typewriter line
   *  sits, as a fraction of the viewport from the top (0.5 = center). */
  typewriterOffset: number;
  setTypewriterOffset: (v: number) => void;
  /** v1.72: highlight bar glued to the caret's line (independent toggle). */
  typewriterHighlightLine: boolean;
  setTypewriterHighlightLine: (v: boolean) => void;
  /** v1.78: the bar's color (hex; rendered translucent over the page). */
  typewriterHighlightColor: string;
  setTypewriterHighlightColor: (v: string) => void;
  /** v1.72: dim every element except the one being edited (independent). */
  typewriterDimOthers: boolean;
  setTypewriterDimOthers: (v: boolean) => void;
  /** v1.74: dim whole elements, or everything but the current SENTENCE. */
  typewriterDimMode: 'elements' | 'sentences';
  setTypewriterDimMode: (v: 'elements' | 'sentences') => void;
  /** v1.77: how faint the dimmed text goes (0.05–0.7; 0.25 = plugin default). */
  typewriterDimOpacity: number;
  setTypewriterDimOpacity: (v: number) => void;
  /** v1.74 (control moved to Settings > General in v1.77): reopen a script
   *  with the cursor where you left it. */
  typewriterRestoreCursor: boolean;
  setTypewriterRestoreCursor: (v: boolean) => void;
  /** v1.74: fullscreen writing focus — hides all chrome, adds a vignette.
   *  Session-only on purpose: relaunching into fullscreen would be hostile. */
  writingFocus: boolean;
  setWritingFocus: (v: boolean) => void;
}

export const createTypewriterSlice: StateCreator<EditorState, [], [], TypewriterSlice> = (set) => ({
  typewriterMasterEnabled: (_vs.typewriterMasterEnabled as boolean) ?? true,
  setTypewriterMasterEnabled: (v) => {
    saveViewState({ typewriterMasterEnabled: v });
    set({ typewriterMasterEnabled: v });
  },
  typewriterEnabled: (_vs.typewriterEnabled as boolean) ?? false,
  setTypewriterEnabled: (v) => {
    saveViewState({ typewriterEnabled: v });
    set({ typewriterEnabled: v });
  },
  typewriterFollowCursor: (_vs.typewriterFollowCursor as boolean) ?? false,
  setTypewriterFollowCursor: (v) => {
    saveViewState({ typewriterFollowCursor: v });
    set({ typewriterFollowCursor: v });
  },
  typewriterOffset: (_vs.typewriterOffset as number) ?? 0.5,
  setTypewriterOffset: (v) => {
    const clamped = clamp(v, 0.2, 0.8);
    saveViewState({ typewriterOffset: clamped });
    set({ typewriterOffset: clamped });
  },
  typewriterHighlightLine: (_vs.typewriterHighlightLine as boolean) ?? false,
  setTypewriterHighlightLine: (v) => {
    saveViewState({ typewriterHighlightLine: v });
    set({ typewriterHighlightLine: v });
  },
  typewriterHighlightColor: (_vs.typewriterHighlightColor as string) ?? '#4a9eff',
  setTypewriterHighlightColor: (v) => {
    saveViewState({ typewriterHighlightColor: v });
    set({ typewriterHighlightColor: v });
  },
  typewriterDimOthers: (_vs.typewriterDimOthers as boolean) ?? false,
  setTypewriterDimOthers: (v) => {
    saveViewState({ typewriterDimOthers: v });
    set({ typewriterDimOthers: v });
  },
  typewriterDimMode: (_vs.typewriterDimMode as 'elements' | 'sentences') ?? 'elements',
  setTypewriterDimMode: (v) => {
    saveViewState({ typewriterDimMode: v });
    set({ typewriterDimMode: v });
  },
  typewriterDimOpacity: (_vs.typewriterDimOpacity as number) ?? 0.25,
  setTypewriterDimOpacity: (v) => {
    const clamped = clamp(v, 0.05, 0.7);
    saveViewState({ typewriterDimOpacity: clamped });
    set({ typewriterDimOpacity: clamped });
  },
  typewriterRestoreCursor: (_vs.typewriterRestoreCursor as boolean) ?? false,
  setTypewriterRestoreCursor: (v) => {
    saveViewState({ typewriterRestoreCursor: v });
    set({ typewriterRestoreCursor: v });
  },
  writingFocus: false,
  setWritingFocus: (v) => set({ writingFocus: v }),
});
