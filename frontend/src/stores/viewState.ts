// v4.23: view-state persistence, extracted from editorStore so store SLICES can
// read their initial defaults (`_vs`) and persist changes (`saveViewState`)
// without importing editorStore.ts — which would be a circular dependency.
//
// The type imports below are type-only (erased at runtime), so this module has
// NO runtime dependency on editorStore and always evaluates first. `_vs` is
// therefore ready before editorStore's module-level migrations and create() run.
import type { ToolConfig, WorkspaceSnapshot, WritingGoal, OutlineBarRow, SpellingSettings } from './editorStore';

const VIEW_STATE_KEY = 'opendraft:viewState';

export interface ViewState {
  navigatorOpen?: boolean;
  showUnreleasedTools?: boolean;
  typewriterMasterEnabled?: boolean;
  typewriterEnabled?: boolean;
  typewriterFollowCursor?: boolean;
  typewriterOffset?: number;
  typewriterHighlightLine?: boolean;
  typewriterHighlightColor?: string;
  typewriterDimOthers?: boolean;
  typewriterDimMode?: 'elements' | 'sentences';
  typewriterDimOpacity?: number;
  typewriterRestoreCursor?: boolean;
  outlineBarOpen?: boolean;
  rulersVisible?: boolean;
  /** v4.59, Derek: Enter-key element suggestions — 'smart' filters by the
   *  follows-what grammar table, 'all' shows every element. */
  suggestionMode?: 'smart' | 'all';
  /** v4.59: the user's edited follows-what table (Customize ▸ Editor ▸
   *  Element Suggestions); null/absent = the built-in default. */
  suggestionRules?: Record<string, string[]> | null;
  qatItems?: string[];
  /** v3.34: per-dropdown widths for the ribbon's select fields (px), keyed
   *  by builtin key — set by dragging a dropdown's edge in the visual
   *  editor, read by the live bar AND the editor (one source). */
  toolbarDdWidths?: Record<string, number>;
  outlineBarZoom?: number;
  outlineBarRowScale?: number;
  scrapbookTreeScale?: number;
  bigBtnInsetPx?: number;
  panelItemScale?: { left: number; right: number };
  mapScrollSpeed?: number;
  /** v4.8: Design panel overrides — numeric design tokens keyed by token id
   *  (src/design/designTokens.ts). Each maps to a --dz-* custom property on
   *  :root; absent keys fall back to the built-in CSS value. */
  designVars?: Record<string, number>;
  outlineBarRows?: OutlineBarRow[];
  outlineBarLabels?: boolean;
  beatColorAllTabs?: boolean;
  uiResizeLocked?: boolean;
  highlightColor?: string;
  /** legacy (pre-v4.24): read once to seed scenesViewMode, never written. */
  indexCardsOpen?: boolean;
  /** v4.24 batch 7: the merged Scenes tool's view — scene list or index cards. */
  scenesViewMode?: 'list' | 'cards';
  /** v5.03: the scene list's resizable column widths, in px. The synopsis
   *  column takes the remainder, so these two describe the whole table. */
  sceneColWidths?: { head: number; metrics: number };
  /** v4.27 window template: Characters' persisted view choices. */
  charViewMode?: 'cards' | 'list';
  relViewMode?: 'list' | 'map';
  /** v4.32 batch-v8: Navigator scene numbers + Design collapsed groups. */
  navShowSceneNumbers?: boolean;
  designCollapsedGroups?: string[];
  beatBoardOpen?: boolean;
  shelfOpen?: boolean;
  activeTool?: string | null;
  activeToolRight?: string | null;
  toolConfig?: Record<string, ToolConfig>;
  toolOrder?: string[];
  viewStyle?: string;
  menuBarOrder?: string[];
  menuBarHidden?: string[];
  toolbarLeft?: string[];
  toolbarRight?: string[];
  toolbarZonesSet?: boolean;
  contextMenuHidden?: string[];
  contextMenuOrder?: string[];
  noteOrder?: string[];
  todoOrder?: string[];
  panelSizeMode?: { left: 'compact' | 'comfortable' | 'custom' | 'icons'; right: 'compact' | 'comfortable' | 'custom' | 'icons' };
  /** v4.24, Derek: side-panel display names — Title Case (as authored) or ALL CAPS. */
  panelNameCase?: 'title' | 'upper';
  chromeCustomPx?: { menu: number; toolbar: number; panelLeft: number; panelRight: number };
  /** v2.29: item spacing (flex gap, px) for the menu bar, toolbar and Big
   *  Button section — adjusted by the faint drag handles on the bars. */
  chromeGapPx?: { menu?: number; toolbar?: number; bigbtn?: number; scrapbook?: number };
  panelDividers?: { id: string; label: string; side: 'left' | 'right'; spacer?: boolean; size?: number }[];
  workspaces?: Record<string, WorkspaceSnapshot>;
  workspaceOrder?: string[];
  activeWorkspace?: string | null;
  toolbarHiddenItems?: string[];
  toolbarPinnedTools?: string[];
  toolSizes?: Record<string, { w: number; h: number }>;
  /** v4.52: EXPLICIT docked/floating per tool — replaces the width<=dock rule. */
  /** v4.81: 'fullscreen' joined — a tool reopens in its last-used shape. */
  toolMode?: Record<string, 'docked' | 'floating' | 'fullscreen'>;
  writingGoal?: WritingGoal | null;
  goalsCompleted?: number;
  characterProfilesOpen?: boolean;
  tagsPanelOpen?: boolean;
  locationDatabaseOpen?: boolean;
  notesVisible?: boolean;
  markersVisible?: boolean;
  tagsVisible?: boolean;
  zoomLevel?: number;
  toolbarMode?: 'compact' | 'comfortable' | 'custom' | 'hidden';
  menuMode?: 'compact' | 'comfortable' | 'custom' | 'hidden';
  characterSortBy?: 'name' | 'importance' | 'scenes' | 'dialogues' | 'appearance';
  grammarRulesEnabled?: Record<string, boolean>;
  spellingSettings?: SpellingSettings;
}

export function loadViewState(): ViewState {
  try {
    const raw = localStorage.getItem(VIEW_STATE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export function saveViewState(patch: Partial<ViewState>) {
  try {
    const current = loadViewState();
    localStorage.setItem(VIEW_STATE_KEY, JSON.stringify({ ...current, ...patch }));
  } catch { /* localStorage unavailable */ }
}

/** Loaded once at module init; slices read it for their initial defaults. */
export const _vs = loadViewState();

/** Clamp a number to the inclusive range [lo, hi]. Shared by store slices. */
export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
