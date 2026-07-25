import { create } from 'zustand';
import { normalizeToolbarZones, migrateToolbarBigZone, migrateSepDividers, migratePanelToggles, migrateLockResize, migrateResetSizes, migrateTwoRows, migrateRibbon, migrateRibbonSections, migrateDropPanelToggles, DEFAULT_TOOLBAR_LEFT, DEFAULT_TOOLBAR_RIGHT } from '../components/toolbarBuiltins';

// ── View-state persistence helpers ──
import { _vs, saveViewState, clamp, type ViewState } from './viewState';
import { useNotebookStore } from './notebookStore';
import { createDesignSlice, type DesignSlice } from './slices/designSlice';
import { createCharacterSlice, type CharacterSlice } from './slices/characterSlice';
import { createTagSlice, type TagSlice } from './slices/tagSlice';
import { createTypewriterSlice, type TypewriterSlice } from './slices/typewriterSlice';
import { createNotesSlice, type NotesSlice } from './slices/notesSlice';
import { createSceneNavSlice, type SceneNavSlice } from './slices/sceneNavSlice';
import { createWorkspacesSlice, type WorkspacesSlice } from './slices/workspacesSlice';
import { createViewPrefsSlice, type ViewPrefsSlice } from './slices/viewPrefsSlice';
import { createSpellGrammarSlice, type SpellGrammarSlice } from './slices/spellGrammarSlice';
import { createBeatsOutlineSlice, type BeatsOutlineSlice } from './slices/beatsOutlineSlice';

export interface SpellingSettings {
  /** When true, capitalized unknown words (likely proper nouns) are flagged. */
  flagProperNouns?: boolean;
}

// v0.42: toolbar zones are flat per-item token lists; expand any persisted
// legacy g: group tokens (honoring the retired toolbarHiddenItems checkboxes)
// so pre-0.42 layouts survive unchanged.
let _tbZones = normalizeToolbarZones(
  Array.isArray(_vs.toolbarLeft) ? _vs.toolbarLeft as string[] : [],
  Array.isArray(_vs.toolbarRight) ? _vs.toolbarRight as string[] : [],
  _vs.toolbarHiddenItems ?? [],
);
// v2.02 one-time: the right zone became the Big Button section. Saved
// layouts keep every item — small controls that lived on the right move to
// the end of Main instead of silently turning into big buttons.
try {
  const BIG_FLAG = 'opendraft:toolbarBigZone202';
  if (_vs.toolbarZonesSet && !localStorage.getItem(BIG_FLAG)) {
    localStorage.setItem(BIG_FLAG, '1');
    _tbZones = migrateToolbarBigZone(_tbZones.left, _tbZones.right);
    saveViewState({ toolbarLeft: _tbZones.left, toolbarRight: _tbZones.right });
  }
} catch { /* storage unavailable — keep what we have */ }
// v2.14 one-time: the sepAfter ghost separators became real d: tokens —
// saved layouts get equivalent dividers so the bar looks unchanged, but
// they're now visible in Customize (movable, removable).
try {
  const SEP_FLAG = 'opendraft:toolbarSepDividers214';
  if (_vs.toolbarZonesSet && !localStorage.getItem(SEP_FLAG)) {
    localStorage.setItem(SEP_FLAG, '1');
    _tbZones = { left: migrateSepDividers(_tbZones.left), right: _tbZones.right };
    saveViewState({ toolbarLeft: _tbZones.left });
  }
} catch { /* storage unavailable — keep what we have */ }
// v2.34 one-time: saved layouts get the surface toggles (Left Panel /
// Right Panel / Outline Bar) appended to Main.
try {
  const TOGGLES_FLAG = 'opendraft:toolbarSurfaceToggles234';
  if (_vs.toolbarZonesSet && !localStorage.getItem(TOGGLES_FLAG)) {
    localStorage.setItem(TOGGLES_FLAG, '1');
    _tbZones = { left: migratePanelToggles(_tbZones.left), right: _tbZones.right };
    saveViewState({ toolbarLeft: _tbZones.left });
  }
} catch { /* storage unavailable — keep what we have */ }
// v2.55 one-time: saved layouts get the sizing-lock button appended to Main.
try {
  const LOCK_FLAG = 'opendraft:toolbarLockResize255';
  if (_vs.toolbarZonesSet && !localStorage.getItem(LOCK_FLAG)) {
    localStorage.setItem(LOCK_FLAG, '1');
    _tbZones = { left: migrateLockResize(_tbZones.left), right: _tbZones.right };
    saveViewState({ toolbarLeft: _tbZones.left });
  }
} catch { /* storage unavailable — keep what we have */ }
// v2.67 one-time: saved layouts get the sizing-reset button beside the lock.
// v2.78: this MUST be its own flag — it first shipped inside the v2.55 block
// above, whose flag was already set on existing installs, so it never ran.
try {
  const RESET_FLAG = 'opendraft:toolbarResetSizes267';
  if (_vs.toolbarZonesSet && !localStorage.getItem(RESET_FLAG)) {
    localStorage.setItem(RESET_FLAG, '1');
    _tbZones = { left: migrateResetSizes(_tbZones.left), right: _tbZones.right };
    saveViewState({ toolbarLeft: _tbZones.left });
  }
} catch { /* storage unavailable — keep what we have */ }
// v2.94 one-time: the two-row toolbar. Saved single-row layouts split —
// tool/window toggles, lock/reset, pinned tools and commands move to Row 2;
// the old Big Button zone's items become Row 2 items flagged big.
try {
  const TWOROWS_FLAG = 'opendraft:toolbarTwoRows294';
  if (_vs.toolbarZonesSet && !localStorage.getItem(TWOROWS_FLAG)) {
    localStorage.setItem(TWOROWS_FLAG, '1');
    _tbZones = migrateTwoRows(_tbZones.left, _tbZones.right);
    // The leftover from the menu migration rides along (Scrapbook-gated).
    if (![..._tbZones.left, ..._tbZones.right].some((t) => t.includes('b:insertTable'))) {
      _tbZones = { left: _tbZones.left, right: [..._tbZones.right, 'b:insertTable'] };
    }
    saveViewState({ toolbarLeft: _tbZones.left, toolbarRight: _tbZones.right });
  }
} catch { /* storage unavailable — keep what we have */ }
// v2.95 one-time: the RIBBON. The two zones fold into one sequence (a full-
// height divider between them), structural dividers become full-height, and
// the retired big!/customize tokens are shed. The right zone stays empty
// from here on.
try {
  const RIBBON_FLAG = 'opendraft:toolbarRibbon295';
  if (_vs.toolbarZonesSet && !localStorage.getItem(RIBBON_FLAG)) {
    localStorage.setItem(RIBBON_FLAG, '1');
    _tbZones = { left: migrateRibbon(_tbZones.left, _tbZones.right), right: [] };
    saveViewState({ toolbarLeft: _tbZones.left, toolbarRight: [] });
  }
} catch { /* storage unavailable — keep what we have */ }
// v2.96 one-time: the ribbon reorganizes by SECTION — the old column-major
// pairing becomes explicit r: row breaks so the bar keeps its look, and
// item-level 2! flags are shed (a section's shape sets item height now).
try {
  const SECTIONS_FLAG = 'opendraft:toolbarRibbonSections296';
  if (_vs.toolbarZonesSet && !localStorage.getItem(SECTIONS_FLAG)) {
    localStorage.setItem(SECTIONS_FLAG, '1');
    _tbZones = { left: migrateRibbonSections(_tbZones.left), right: [] };
    saveViewState({ toolbarLeft: _tbZones.left, toolbarRight: [] });
  }
} catch { /* storage unavailable — keep what we have */ }
// v3.02 one-time: Customize became a ribbon ITEM (it was fixed chrome in
// v2.95–v3.01). Saved layouts get it appended as its own section so the
// button doesn't silently vanish; it's fully movable/removable after.
try {
  const CUSTBTN_FLAG = 'opendraft:toolbarCustomizeItem302';
  if (_vs.toolbarZonesSet && !localStorage.getItem(CUSTBTN_FLAG)) {
    localStorage.setItem(CUSTBTN_FLAG, '1');
    if (!_tbZones.left.includes('b:customize')) {
      _tbZones = { left: [..._tbZones.left, '2!d:cust-302', 'b:customize'], right: [] };
      saveViewState({ toolbarLeft: _tbZones.left, toolbarRight: [] });
    }
  }
} catch { /* storage unavailable — keep what we have */ }
// v3.25 one-time, Derek (task #137): the Left/Right Panel toggle buttons are
// retired — saved layouts shed the tokens so the ribbon doesn't render dead
// buttons the palette no longer offers.
try {
  const DROP_TOGGLES_FLAG = 'opendraft:toolbarDropPanelToggles325';
  if (_vs.toolbarZonesSet && !localStorage.getItem(DROP_TOGGLES_FLAG)) {
    localStorage.setItem(DROP_TOGGLES_FLAG, '1');
    const stripped = migrateDropPanelToggles(_tbZones.left);
    if (stripped.length !== _tbZones.left.length) {
      _tbZones = { left: stripped, right: _tbZones.right };
      saveViewState({ toolbarLeft: _tbZones.left });
    }
  }
} catch { /* storage unavailable — keep what we have */ }

/** Built-in script element types — fixed set, hardcoded as Tiptap extensions. */
export type BuiltInElementType =
  | 'sceneHeading'
  | 'action'
  | 'character'
  | 'dialogue'
  | 'parenthetical'
  | 'transition'
  | 'general'
  | 'shot'
  | 'newAct'
  | 'endOfAct'
  | 'lyrics'
  | 'showEpisode'
  | 'castList'
  | 'titlePage';

/** Element type id — built-in literal or any custom id declared by a template.
 *  The `(string & {})` trick keeps autocomplete on built-ins while accepting any string. */
export type ElementType = BuiltInElementType | (string & {});

/** Display labels for built-in element types. Keyed permissively as `string` so callers
 *  can index with any `ElementType` (custom ids return undefined; pair with `|| fallback`). */
export const ELEMENT_LABELS: Record<string, string> = {
  sceneHeading: 'Scene Heading',
  action: 'Action',
  character: 'Character',
  dialogue: 'Dialogue',
  parenthetical: 'Parenthetical',
  transition: 'Transition',
  general: 'General',
  shot: 'Shot',
  newAct: 'New Act',
  endOfAct: 'End of Act',
  lyrics: 'Lyrics',
  showEpisode: 'Show/Episode',
  castList: 'Cast List',
  titlePage: 'Title Page',
};

/** Header/footer content for left, center, right positions.
 *  Dynamic fields: {page} = page number, {pages} = total pages,
 *  {title} = document title, {date} = current date, {revision} = revision color. */
export interface HeaderFooterContent {
  left: string;
  center: string;
  right: string;
}

export const DEFAULT_HEADER_CONTENT: HeaderFooterContent = {
  left: '',
  center: '',
  right: '{page}.',
};

export const DEFAULT_FOOTER_CONTENT: HeaderFooterContent = {
  left: '',
  center: '',
  right: '',
};

/** "Mores & Continueds" config (per-document, like Final Draft). Controls the two
 *  independent kinds of dialogue continuation and their marker text. Note: the
 *  character (CONT'D) never carries across a scene heading — that is a fixed
 *  industry rule, not a setting. */
export interface MoresContds {
  /** Append (CONT'D) to a character cue that resumes speaking after action
   *  WITHIN the same scene. */
  characterContd: boolean;
  /** Show (MORE) at the bottom of a page and CHARACTER (CONT'D) at the top of the
   *  next when a single dialogue block splits across a page break. */
  dialogueBreakContd: boolean;
  /** Marker for continued dialogue, e.g. "(CONT'D)". */
  contdText: string;
  /** Marker shown when dialogue continues onto the next page, e.g. "(MORE)". */
  moreText: string;
}

export const DEFAULT_MORES_CONTDS: MoresContds = {
  characterContd: true,
  dialogueBreakContd: true,
  contdText: "(CONT'D)",
  moreText: '(MORE)',
};

/** Always returns a complete MoresContds, filling any missing/legacy fields with
 *  defaults so older documents (saved before this feature) behave sensibly. */
export function resolveMoresContds(layout: PageLayout | undefined): MoresContds {
  const m = layout?.moresContds;
  const resolved: MoresContds = { ...DEFAULT_MORES_CONTDS, ...(m ?? {}) };
  if (!resolved.contdText.trim()) resolved.contdText = DEFAULT_MORES_CONTDS.contdText;
  if (!resolved.moreText.trim()) resolved.moreText = DEFAULT_MORES_CONTDS.moreText;
  return resolved;
}

export interface PageLayout {
  pageWidth: number;     // inches
  pageHeight: number;    // inches
  topMargin: number;     // points
  bottomMargin: number;  // points
  headerMargin: number;  // points
  footerMargin: number;  // points
  leftMargin: number;    // inches (from page edge to content start)
  rightMargin: number;   // inches (from content end to page edge)
  headerContent: HeaderFooterContent;
  footerContent: HeaderFooterContent;
  /** Show header/footer starting from this page number (default 2 = skip first page) */
  headerStartPage: number;
  footerStartPage: number;
  /** Dialogue continuation ("Mores & Continueds") config. Optional for back-compat
   *  with documents saved before this existed — read via resolveMoresContds(). */
  moresContds?: MoresContds;
}

export const DEFAULT_PAGE_LAYOUT: PageLayout = {
  pageWidth: 8.5,         // US Letter — Final Draft's default paper
  pageHeight: 11,
  topMargin: 72,
  bottomMargin: 72,
  headerMargin: 36,
  footerMargin: 36,
  leftMargin: 1.50,       // Final Draft default LeftIndent for Action
  rightMargin: 1.00,      // 8.5 - 7.50 (default RightIndent)
  headerContent: { ...DEFAULT_HEADER_CONTENT },
  footerContent: { ...DEFAULT_FOOTER_CONTENT },
  headerStartPage: 2,
  footerStartPage: 1,
  moresContds: { ...DEFAULT_MORES_CONTDS },
};

/** v0.12 migration: the app default moved from OpenDraft's inherited A4-ish
 * geometry (8.26 x 11.69, right margin 0.76") to US Letter (8.5 x 11, right
 * margin 1.0" — Final Draft's US defaults). Documents whose saved layout
 * carries the exact old-default signature were never customized in Page
 * Setup, so upgrade them; anything deliberately chosen (including the A4
 * preset, which is 8.27) doesn't match and is left alone. */
export function migratePageLayout(l: PageLayout): PageLayout {
  const eq = (a: number, b: number) => Math.abs(a - b) < 0.005;
  if (eq(l.pageWidth, 8.26) && eq(l.pageHeight, 11.69) && eq(l.leftMargin, 1.5) && eq(l.rightMargin, 0.76)) {
    return { ...l, pageWidth: 8.5, pageHeight: 11, rightMargin: 1.0 };
  }
  return l;
}

export interface SceneInfo {
  id: string;
  heading: string;
  sceneNumber: number | null;
  color: string;
  synopsis: string;
}

export const NOTE_COLORS = [
  { name: 'Yellow', hex: '#f4d35e' },
  { name: 'Red', hex: '#e06060' },
  { name: 'Blue', hex: '#6fa8dc' },
  { name: 'Green', hex: '#6abf69' },
  { name: 'Orange', hex: '#e89b4f' },
  { name: 'Purple', hex: '#b58ee0' },
] as const;

export type NoteColor = typeof NOTE_COLORS[number]['name'];

export interface NoteInfo {
  id: string;
  content: string;
  /** v0.96: notes render as the same card as everything else, and a card has an
   *  editable title. Optional — notes made before this have none. */
  title?: string;
  /** Anchored text snippet the note is attached to */
  anchorText: string;
  /** Element type where the note is anchored */
  elementType: string;
  /** Contextual label — e.g. character name, scene heading text */
  contextLabel: string;
  /** Note color: one of the six NOTE_COLORS names, or (v4.35 batch-v9 #5) an
   *  arbitrary '#rrggbb' hex from the custom picker. Persisted — readers must
   *  accept both forms forever. */
  color: NoteColor | string;
  createdAt: string;
  /** Optional scene context */
  sceneId: string | null;
}

/** A general note attached to the script file (not anchored to any text) */
export interface GeneralNote {
  id: string;
  title: string;
  content: string;
  color: NoteColor | string;
  createdAt: string;
}

// ── Sticky Notes (the "Shelf": Comments / To-Do / Snippets) ──

/** Sticky-note background colors: [hex, label]. */
export const SHELF_COLORS: [string, string][] = [
  ['#fff9c4', 'Yellow'], ['#ffd9e7', 'Pink'], ['#d6ecff', 'Blue'],
  ['#dcf5dc', 'Green'], ['#ffe4c4', 'Orange'], ['#e9defa', 'Purple'],
];
export const SHELF_DEFAULT_COLOR = SHELF_COLORS[0][0];

export type ShelfCardType = 'comment' | 'todo' | 'snippet';

/**
 * Top-level tabs of the unified Sticky Notes pane. The Notes tab houses two
 * sub-views: General (free-form sticky cards) and Script (anchored notes).
 */
/** Tools available in the tool docks (Photoshop-style panel lists). */
export type ToolId =
  | 'navigator' | 'scenes' | 'pages' | 'structure' | 'locations' | 'characters'
  | 'beatboard' | 'tags' | 'highlights' | 'projects' | 'assets'
  | 'analytics' | 'gender' | 'goals' | 'sticky' | 'fragments' | 'todo'
  | 'spelling' | 'history' | 'titlepage' | 'customize' | 'vomit' | 'typewriter' | 'aiwriter'
  | 'notebook' | 'design' | 'workspaces' | 'feedback'
  /** legacy — Notes merged back into 'sticky' (Notes > Script tab); kept
   *  in the type so persisted configs still typecheck, remapped on use. */
  | 'scriptnotes'
  /** legacy — Index Cards merged into 'scenes' as its Cards view (v4.24
   *  batch 7); persisted layouts are migrated, openTool remaps on use. */
  | 'indexcards';

export type ToolSide = 'left' | 'right';
export interface ToolConfig { side: ToolSide; enabled: boolean; }

/** A saved layout: the full Window/tool arrangement (Premiere-style workspace). */
export interface WorkspaceSnapshot {
  toolConfig: Record<string, ToolConfig>;
  toolOrder: string[];
  toolbarHiddenItems: string[];
  toolbarPinnedTools: string[];
  navigatorOpen: boolean;
  shelfOpen: boolean;
  toolSizes: Record<string, { w: number; h: number }>;
  /** v0.12: full-layout capture so Reset to Saved Layout rolls back EVERYTHING.
   *  Optional for back-compat — workspaces saved before v0.12 simply leave
   *  these aspects untouched when applied. */
  toolbarMode?: 'compact' | 'comfortable' | 'custom' | 'hidden';
  activeTool?: ToolId | null;
  /** v0.44: capture the Customize state too — toolbar zones, menu bar, and
   *  panel dividers — so Reset to Saved Layout actually rolls those back.
   *  Optional for back-compat with older workspaces. */
  toolbarLeft?: string[];
  toolbarRight?: string[];
  menuBarOrder?: string[];
  menuBarHidden?: string[];
  menuMode?: 'compact' | 'comfortable' | 'custom' | 'hidden';
  panelSizeMode?: { left: 'compact' | 'comfortable' | 'custom' | 'icons'; right: 'compact' | 'comfortable' | 'custom' | 'icons' };
  chromeCustomPx?: { menu: number; toolbar: number; panelLeft: number; panelRight: number };
  panelDividers?: { id: string; label: string; side: 'left' | 'right'; spacer?: boolean; size?: number }[];
  /** v0.78: the active theme is part of a workspace. */
  theme?: ThemeId;
  activeToolRight?: ToolId | null;
}

/** Default layout: script-structure tools left, everything else right. */
/** Canonical menu-bar labels in default order (File islocked visible). */
// v3.24, Derek's menu reorg: Production merged into Project. Saved orders
// that still carry 'Production' are harmless — unknown labels are ignored.
export const MENU_BAR_LABELS = ['File', 'Edit', 'View', 'Insert', 'Format', 'Project', 'Tools', 'Help'];

/** v3.36: where a dragged ribbon item would drop — section index, which row,
 *  and the item slot. Shared by the in-place editor's drag controller. */
export interface RibDropSpot { sec: number; row: 'top' | 'bottom'; idx: number }

/**
 * v0.85: Navigator belongs INSIDE the left panel by default. It already does on
 * a fresh install (its default width equals the dock, so it docks inline), but
 * a width stored by an older build — when windows popped out by default — wins
 * over the default forever and kept it floating.
 *
 * This drops that one stored width, once, so it returns to the panel. It runs a
 * single time (flagged), so if you deliberately pop it out afterwards, it stays
 * out. Nothing else is touched.
 */
function migrateNavigatorInline(
  sizes: Record<string, { w: number; h: number }>,
): Record<string, { w: number; h: number }> {
  const FLAG = 'opendraft:navInlineMigrated';
  try {
    if (localStorage.getItem(FLAG)) return sizes;
    localStorage.setItem(FLAG, '1');
    if (sizes.navigator) {
      const { navigator: _dropped, ...rest } = sizes;
      saveViewState({ toolSizes: rest });
      return rest;
    }
  } catch { /* storage unavailable — keep what we have */ }
  return sizes;
}

/**
 * v1.67: forget a remembered Spelling & Grammar window size ONCE. The v1.63
 * combined panel added a tabs row and a toggles row on top of a checker body
 * sized for none of that — a pre-v1.63 remembered height crushed the body to
 * zero (no misspelled word, no suggestions, just buttons). The new default
 * fits the whole thing; a size the user drags after this migration sticks
 * again as usual. Same pattern as migrateNavigatorInline above.
 */
function migrateSpellingSize(
  sizes: Record<string, { w: number; h: number }>,
): Record<string, { w: number; h: number }> {
  const FLAG = 'opendraft:spellSizeReset167';
  try {
    if (localStorage.getItem(FLAG)) return sizes;
    localStorage.setItem(FLAG, '1');
    if (sizes.spelling) {
      const { spelling: _dropped, ...rest } = sizes;
      saveViewState({ toolSizes: rest });
      return rest;
    }
  } catch { /* storage unavailable — keep what we have */ }
  return sizes;
}

/** v1.74: same story as migrateSpellingSize — the Typewriter panel grew from
 *  one toggle to the full option suite; a remembered v1.68-era 190px height
 *  would crush it. Forget the size once; new drags stick as usual. */
function migrateTypewriterSize(
  sizes: Record<string, { w: number; h: number }>,
): Record<string, { w: number; h: number }> {
  const FLAG = 'opendraft:typewriterSizeReset174';
  try {
    if (localStorage.getItem(FLAG)) return sizes;
    localStorage.setItem(FLAG, '1');
    if (sizes.typewriter) {
      const { typewriter: _dropped, ...rest } = sizes;
      saveViewState({ toolSizes: rest });
      return rest;
    }
  } catch { /* storage unavailable — keep what we have */ }
  return sizes;
}

/** v1.96: the Notebook window became the inline pages tree (the writing
 *  surface lives in the editor area now). A remembered v1.87-era 900px
 *  width would keep it floating forever. Forget the size once. */
function migrateNotebookInline(
  sizes: Record<string, { w: number; h: number }>,
): Record<string, { w: number; h: number }> {
  const FLAG = 'opendraft:notebookSizeReset196';
  try {
    if (localStorage.getItem(FLAG)) return sizes;
    localStorage.setItem(FLAG, '1');
    if (sizes.notebook) {
      const { notebook: _dropped, ...rest } = sizes;
      saveViewState({ toolSizes: rest });
      return rest;
    }
  } catch { /* storage unavailable — keep what we have */ }
  return sizes;
}

/** Tools that never dock — they always open as a floating window. */
export const ALWAYS_FLOAT: ToolId[] = ['analytics'];

export const DEFAULT_TOOL_CONFIG: Record<string, ToolConfig> = {
  // v0.68: the default panel layout. LEFT = script-structure windows;
  // RIGHT = writing tools. Production Tags is hidden by default (it opens from
  // the Production menu). EVERY tool in ALL_TOOLS must have an entry here —
  // see toolConfigFor() below and the v0.63 bug it prevents.
  history: { side: 'right', enabled: false },   // v0.84: available, off by default
  navigator: { side: 'left', enabled: true },
  scenes: { side: 'left', enabled: true },
  pages: { side: 'left', enabled: true },
  titlepage: { side: 'left', enabled: true },
  characters: { side: 'left', enabled: true },
  locations: { side: 'left', enabled: true },
  spelling: { side: 'left', enabled: true },
  assets: { side: 'left', enabled: true },

  sticky: { side: 'right', enabled: true },
  todo: { side: 'right', enabled: true },
  fragments: { side: 'right', enabled: true },
  beatboard: { side: 'right', enabled: true },
  highlights: { side: 'right', enabled: true },
  goals: { side: 'right', enabled: true },
  typewriter: { side: 'right', enabled: true },
  aiwriter: { side: 'right', enabled: true },
  notebook: { side: 'right', enabled: true },
  analytics: { side: 'right', enabled: true },

  tags: { side: 'right', enabled: false },
};

/** Default row order for the panels, matching DEFAULT_TOOL_CONFIG's grouping.
 *  Customize renders a stable partition by side, so this is also the order
 *  within each panel. 'Reset to Default' restores exactly this. */
export const DEFAULT_TOOL_ORDER: string[] = [
  'navigator', 'scenes', 'pages', 'titlepage', 'characters', 'locations', 'spelling', 'assets',
  'sticky', 'todo', 'fragments', 'beatboard', 'highlights', 'goals', 'typewriter', 'aiwriter', 'notebook', 'analytics',
  'tags',
];

/** v4.24 batch 7: Index Cards merged into the Scenes tool (its Cards view).
 *  Persisted layouts — viewState and workspace snapshots — may still carry
 *  the retired 'indexcards' id; map it onto 'scenes' without duplicating.
 *  (toolOrder also carries 'div:<id>' divider tokens; they pass through.) */
export function migrateToolOrder(order: string[]): string[] {
  const out: string[] = [];
  for (const raw of order) {
    const id = raw === 'indexcards' ? 'scenes' : raw;
    if (!out.includes(id)) out.push(id);
  }
  return out;
}
export function migrateToolConfig(cfg: Record<string, ToolConfig>): Record<string, ToolConfig> {
  if (!('indexcards' in cfg)) return cfg;
  const { indexcards, ...rest } = cfg;
  // If the retired tool was the enabled one, the merged tool inherits that.
  if (indexcards?.enabled && rest.scenes && !rest.scenes.enabled) {
    rest.scenes = { ...rest.scenes, enabled: true };
  }
  return rest;
}

/** Single source of truth for a tool's effective config. Used by ToolDock and
 *  the Customize dialog so a tool can never display in one place and be
 *  missing from the other. */
export function toolConfigFor(
  cfg: Record<string, ToolConfig>,
  id: string,
): ToolConfig {
  return cfg[id] ?? DEFAULT_TOOL_CONFIG[id] ?? { side: 'right', enabled: true };
}

/** A writing goal: word count, page count, or timed session. */
export interface WritingGoal {
  kind: 'words' | 'pages' | 'time';
  target: number;
  /** time goals: total seconds + wall-clock end */
  total?: number;
  endsAt?: number;
  done?: boolean;
}

export type BuiltInThemeId =
  | 'dark' | 'light' | 'sepia' | 'nord' | 'dracula'
  | 'solarized-dark' | 'solarized-light' | 'midnight';
/** Built-in id, or 'custom:<n>' for a user-created theme (v0.78). */
export type ThemeId = BuiltInThemeId | (string & {});


export interface ShelfTodoItem {
  text: string;
  done: boolean;
}

/**
 * One sticky card. Data shape matches ScriptCraft v5.5's shelf exactly
 * (cards from the old app's export can be imported verbatim).
 */
export interface ShelfCard {
  id: string;
  type: ShelfCardType;
  color: string;
  /** Editable card header; empty shows the type name as placeholder */
  title?: string;
  /** ISO timestamp; cards created before v0.3 have none and show no date */
  createdAt?: string;
  /** comment + snippet body */
  text?: string;
  /** todo entries */
  items?: ShelfTodoItem[];
}

// ── Production Tagging (Final Draft TagData) ──

export interface TagCategory {
  id: string;
  name: string;
  color: string;
  isBuiltIn: boolean;
}

export interface TagItem {
  id: string;
  categoryId: string;
  /** Entity name — the reusable label for this tag (e.g. "Protagonist Residence"). */
  name: string;
  /** Original highlighted text (kept for backward compat). */
  text: string;
  /** Detailed notes/information about this tagged entity. */
  notes: string;
  sceneId: string | null;
  elementType: string;
  createdAt: string;
}

export const DEFAULT_TAG_CATEGORIES: TagCategory[] = [
  { id: 'cast', name: 'Cast', color: '#e06060', isBuiltIn: true },
  { id: 'extras', name: 'Extras', color: '#c0392b', isBuiltIn: true },
  { id: 'stunts', name: 'Stunts', color: '#e74c3c', isBuiltIn: true },
  { id: 'vehicles', name: 'Vehicles', color: '#e06c9f', isBuiltIn: true },
  { id: 'props', name: 'Props', color: '#9370DB', isBuiltIn: true },
  { id: 'special-effects', name: 'Special Effects', color: '#5dade2', isBuiltIn: true },
  { id: 'costumes', name: 'Costumes', color: '#1abc9c', isBuiltIn: true },
  { id: 'makeup', name: 'Makeup/Hair', color: '#45b39d', isBuiltIn: true },
  { id: 'animals', name: 'Animals', color: '#6abf69', isBuiltIn: true },
  { id: 'animal-handler', name: 'Animal Handler', color: '#27ae60', isBuiltIn: true },
  { id: 'music', name: 'Music', color: '#f4d35e', isBuiltIn: true },
  { id: 'sound', name: 'Sound', color: '#f0b429', isBuiltIn: true },
  { id: 'set-dressing', name: 'Set Dressing', color: '#d4a373', isBuiltIn: true },
  { id: 'greenery', name: 'Greenery', color: '#2ecc71', isBuiltIn: true },
  { id: 'special-equipment', name: 'Special Equipment', color: '#8e44ad', isBuiltIn: true },
  { id: 'security', name: 'Security', color: '#7f8c8d', isBuiltIn: true },
  { id: 'additional-labor', name: 'Additional Labor', color: '#95a5a6', isBuiltIn: true },
  { id: 'vfx', name: 'Visual Effects', color: '#3498db', isBuiltIn: true },
  { id: 'optical-fx', name: 'Optical FX', color: '#ADD8E6', isBuiltIn: true },
  { id: 'mechanical-fx', name: 'Mechanical FX', color: '#4169E1', isBuiltIn: true },
];

export interface CharacterProfile {
  /** Uppercase canonical character name */
  name: string;
  /** v4.21: the character's full name (e.g. name "SAM" → fullName "SAM VEDU").
   *  Auto-filled when a "Referred in Script" name is connected to this character. */
  fullName?: string;
  /** v4.22: editable Title-Case first / last name shown in the Character tool.
   *  Unset ⇒ derived from the script (name → first, fullName → last). When a
   *  value differs from the script the tool offers "Update name in script". */
  firstName?: string;
  lastName?: string;
  /** Rich text description / bio (HTML string; maps to FDX CastMember Description as plain text) */
  description: string;
  /** Highlight color hex (Final Draft CharacterHighlighting) */
  color: string;
  /** Whether highlighting is enabled for this character */
  highlighted: boolean;
  /** Structured metadata (Final Draft Character Navigator fields) */
  gender: string;
  age: string;
  /** v4.22: character sexuality (ScriptCraft-only). */
  sexuality?: string;
  /** Role in the story: Lead, Supporting, Featured, Background, Day Player.
   *  v4.22: field removed from the Character tool UI (kept for stored data / FDX). */
  role: string;
  /** Rich text backstory / character history (HTML string; ScriptCraft-only, not in FDX) */
  backstory: string;
  /** Character arc — how the character changes through the story (HTML string; ScriptCraft-only) */
  arc: string;
  /** Dialogue voice profile (ScriptCraft-only) */
  speechPattern: string;
  vocabulary: string;
  verbalTics: string;
  sampleDialogue: string;
  /** Asset IDs of images associated with this character */
  images: string[];
  /** v4.23: asset ID of an uploaded voice-reference audio clip (ScriptCraft-only). */
  voiceProfile?: string;
  /** v4.22: values for user-defined custom fields, keyed by field id. The field
   *  DEFINITIONS (id + title) live in `characterCustomFields` and are shared by
   *  every character. */
  customFields?: Record<string, string>;
}

/** v4.22, Derek: a user-defined character field, shown on every character. */
export interface CharacterCustomField {
  id: string;
  label: string;
}

export interface CharacterRelationship {
  id: string;
  characterA: string;
  characterB: string;
  type: string;
  description: string;
  dynamic: string;
}

/** v4.19: classification of an ALL-CAPS name detected in action lines but not in
 *  the character list — lets the writer file it away so it drops off the
 *  "Referred in Script" list. */
export type ReferredTag =
  | { kind: 'character'; character: string }
  | { kind: 'location' }
  | { kind: 'other' };

export interface BeatColumn {
  id: string;
  title: string;
  position: number;
  width: number; // pixels, 0 = auto/fill
  /** v2.11: how many script pages this act/section is BUDGETED for — the
   *  Outline Bar's top row spans blocks by these (30/45/40 → a 115-page
   *  ruler). Unset = DEFAULT_COLUMN_PAGES. */
  targetPages?: number;
}

/** v2.42: one row of the Outline Bar — Customize > Outline Bar reorders,
 *  adds, removes and resizes these. `h` (px) overrides the kind's default
 *  height, before the global row scale. */
export interface OutlineBarRow {
  id: string;
  kind: 'ruler' | 'acts' | 'beats' | 'script';
  h?: number;
  /** v3.39, Derek: a user-chosen label for this row (Customize > Outline Bar).
   *  Blank ⇒ the kind's default name. */
  name?: string;
}
export const DEFAULT_OUTLINE_BAR_ROWS: OutlineBarRow[] = [
  { id: 'ruler-1', kind: 'ruler' },
  { id: 'acts-1', kind: 'acts' },
  { id: 'beats-1', kind: 'beats' },
  { id: 'script-1', kind: 'script' },
];

/** v3.54, Derek: the Scenes tool's active filter set. Lives in the store so the
 *  window's header popover, its footer search and the tool body all share it. */
export interface SceneFilters {
  characters: string[];
  location: string;
  prefix: string;
  time: string;
  color: string;
  synopsis: string;
}
export const EMPTY_SCENE_FILTERS: SceneFilters = { characters: [], location: '', prefix: '', time: '', color: '', synopsis: '' };
/** The derived data the Scenes body publishes for the header popover + count
 *  (the header/footer render outside the body and can't see the editor). */
export interface SceneNavData {
  filtered: number;
  total: number;
  characters: string[];
  locations: string[];
  prefixes: string[];
  times: string[];
}
export const EMPTY_SCENE_NAV_DATA: SceneNavData = { filtered: 0, total: 0, characters: [], locations: [], prefixes: [], times: [] };

/** v2.30: a non-viewed outline tab's parked data — its sections plus each
 *  beat's section/order in that tab. Beats themselves are SHARED. v2.60:
 *  barOffset is the beat's hand-placed page offset within its section on the
 *  Outline Bar (per tab, since sections differ per tab; unset = packed). */
export interface OutlineTabData {
  columns: BeatColumn[];
  beatSlots: Record<string, { columnId: string; position: number; barOffset?: number }>;
}

export interface BeatLinkPreview {
  url: string;
  title: string;
  description: string;
  image: string;
  siteName: string;
}

export interface BeatInfo {
  id: string;
  title: string;
  description: string;
  columnId: string;
  position: number;
  color: string;
  imageUrl: string;
  cardWidth: number;   // pixels, 0 = fill column
  cardHeight: number;  // pixels, 0 = auto
  x: number;           // custom-arrange: absolute X position on canvas
  y: number;           // custom-arrange: absolute Y position on canvas
  imageHeight: number; // pixels, 0 = default (140px)
  linkPreviews?: BeatLinkPreview[]; // cached link preview metadata
  /** v1.75 Outline Bar (Final Draft's Outline Editor): which lane the beat
   *  sits on (0 = Outline 1, 1 = Outline 2; unset = board only), the page it
   *  starts on, and how many pages it spans (default 0.5, min 0.125 — FD's
   *  eighth-of-a-page). SAME beat objects as the Outline tool, so titles,
   *  colors and edits stay linked. */
  outlineLane?: 0 | 1;
  outlinePage?: number;
  outlineSpan?: number;
  /** v2.60: hand-placed spot on the Outline Bar — whole-page offset from the
   *  START of the beat's section (0 = the section's first page). Unset means
   *  the bar packs it after its section siblings in board order, as before.
   *  Per-tab like columnId/position: parked/restored through outlineStash. */
  barOffset?: number;
  /** v2.33 mind map (Freeform arrangement): ids of beats this one draws
   *  connector lines to. mindShape is LEGACY — the shape feature was removed
   *  in v2.44, but the field stays so old saves still load cleanly. */
  mindShape?: 'rect' | 'rounded' | 'ellipse';
  mindLinks?: string[];
}

export type BeatArrangeMode = 'auto' | 'custom';

export interface EditorState extends DesignSlice, CharacterSlice, TagSlice, TypewriterSlice, NotesSlice, SceneNavSlice, WorkspacesSlice, ViewPrefsSlice, SpellGrammarSlice, BeatsOutlineSlice {
  /** Toolbar zones (v0.38). Tokens: g:<group> built-in section, t:<toolId>
   *  pinned tool, c:<commandId> pinned command, d:<n> divider line. The right
   *  zone renders after the flex spacer (far right). Empty arrays mean
   *  "defaults not yet materialized" — the Toolbar builds them lazily. */
  toolbarLeft: string[];
  toolbarRight: string[];
  toolbarZonesSet: boolean;
  setToolbarZones: (left: string[], right: string[]) => void;
  /** Settings > System: reset every layout/view setting to factory defaults.
   *  Never touches script content, projects, saved workspaces, or tool data. */
  resetAllSettings: () => void;

  /** Labeled divider lines for the side panels, ordered via toolOrder using
   *  div:<id> tokens. */
  /** Side-panel width (v0.70). 'hidden' is expressed by the existing
   *  navigatorOpen / shelfOpen flags, so this only carries the width. */
  /** Hidden top-level sections of the right-click menu (v0.81). Only top-level
   *  items — an entry's CONTENTS (e.g. which elements Element offers) are
   *  governed by their own tab, so every instance stays in sync. */
  contextMenuHidden: string[];
  setContextMenuHidden: (ids: string[]) => void;
  /** Display order of the right-click menu's items (v0.86). */
  contextMenuOrder: string[];
  setContextMenuOrder: (ids: string[]) => void;
  /** v1.0: manual order of the Notes / To-Do lists, when Sort is left blank.
   *  Keys are 'note:<id>' | 'card:<id>' | 'todo:<todoId>' so script-anchored and
   *  window items share ONE order — they live in one list now. */
  noteOrder: string[];
  setNoteOrder: (keys: string[]) => void;
  todoOrder: string[];
  setTodoOrder: (keys: string[]) => void;
  panelSizeMode: { left: 'compact' | 'comfortable' | 'custom' | 'icons'; right: 'compact' | 'comfortable' | 'custom' | 'icons' };
  /** v4.24, Derek: side-panel display names — Title Case (as authored) or ALL CAPS. */
  panelNameCase: 'title' | 'upper';
  setPanelNameCase: (c: 'title' | 'upper') => void;
  /** Custom sizes in px, used when the matching mode is 'custom' (v0.72). */
  chromeCustomPx: { menu: number; toolbar: number; panelLeft: number; panelRight: number };
  setChromeCustomPx: (surface: 'menu' | 'toolbar' | 'panelLeft' | 'panelRight', px: number) => void;
  /** v2.76: how much shorter the Big Buttons are than the chrome they span
   *  (px). 16 = default breathing room; smaller = bigger buttons. Driven by
   *  the Big Button grip's vertical axis. */
  bigBtnInsetPx: number;
  setBigBtnInset: (px: number) => void;
  /** v2.77: vertical scale of the side panels' dock items (1 = default) —
   *  row height, text and icons follow. Driven by the panel edge's vertical
   *  axis, per side. */
  panelItemScale: { left: number; right: number };
  setPanelItemScale: (side: 'left' | 'right', scale: number) => void;
  /** v2.29: item spacing (flex gap) per bar — see the GapHandle grips. */
  chromeGapPx: { menu: number; toolbar: number; bigbtn: number; scrapbook: number };
  setChromeGap: (bar: 'menu' | 'toolbar' | 'bigbtn' | 'scrapbook', px: number) => void;
  setPanelSizeMode: (side: 'left' | 'right', mode: 'compact' | 'comfortable' | 'custom' | 'icons') => void;
  panelDividers: { id: string; label: string; side: 'left' | 'right'; spacer?: boolean; size?: number }[];
  setPanelDividers: (d: { id: string; label: string; side: 'left' | 'right'; spacer?: boolean; size?: number }[]) => void;

  /** Menu bar customization: display order + hidden menus (File cannot hide). */
  menuBarOrder: string[];
  setMenuBarOrder: (order: string[]) => void;
  menuBarHidden: string[];
  setMenuBarHidden: (hidden: string[]) => void;

  // Current element type
  activeElement: ElementType;
  setActiveElement: (el: ElementType) => void;

  // Document info
  documentTitle: string;
  setDocumentTitle: (title: string) => void;
  pageCount: number;
  setPageCount: (count: number) => void;
  currentPage: number;
  setCurrentPage: (page: number) => void;

  // Scene navigator
  scenes: SceneInfo[];
  setScenes: (scenes: SceneInfo[]) => void;
  navigatorOpen: boolean;
  toggleNavigator: () => void;

  // Panels
  /** v4.24 batch 7: the merged Scenes tool's view — scene list or index cards. */
  scenesViewMode: 'list' | 'cards';
  setScenesViewMode: (m: 'list' | 'cards') => void;
  /** v4.32 batch-v8 #2/#8: the Cards board's fullscreen is an editor-area
   *  takeover now — never past the editor space, close always in its header.
   *  v4.35: folded into the generic fullscreenTool field. */
  /** v4.32 batch-v8 #9: the scene reorder (drag) mode — lifted so the
   *  window chrome's Reorder control drives it. v4.35 batch-v9 #2: drives
   *  BOTH views (card drag / list row drag). Session-only. */
  scenesReorderMode: boolean;
  setScenesReorderMode: (v: boolean) => void;
  /** v4.32 batch-v8 #5: Navigator list shows scene numbers before names. */
  navShowSceneNumbers: boolean;
  setNavShowSceneNumbers: (v: boolean) => void;
  /** v4.32 batch-v8 #4: Design window collapsed groups — ALL collapsed by
   *  default; remembered across close/reopen. null = never touched (all). */
  designCollapsedGroups: string[] | null;
  setDesignCollapsedGroups: (ids: string[]) => void;
  /** v4.32 batch-v8 #12: Notes / To-Do list sort, lifted so the window
   *  chrome's cluster drives it (session-only, like the old local state).
   *  v4.33: filters removed — the windows hold only general items now (script
   *  notes/to-dos live in the Navigator), so there is nothing to filter and
   *  no script position to sort by. */
  notesSort: 'manual' | 'created';
  setNotesSort: (v: 'manual' | 'created') => void;
  todoSort: 'manual' | 'created';
  setTodoSort: (v: 'manual' | 'created') => void;
  /** v4.32: generic list-count publisher — the body publishes, the window
   *  title's count (TitleExtra) displays. Same no-drift rule as charListCount. */
  toolCounts: Record<string, number>;
  setToolCount: (id: string, n: number) => void;
  beatBoardOpen: boolean;  statisticsOpen: boolean;
  setStatisticsOpen: (open: boolean) => void;
  statisticsScrollTo: string | null;
  setStatisticsScrollTo: (id: string | null) => void;
  shelfOpen: boolean;
  toggleShelf: () => void;
  /** Which tool window is open in the left dock (null = none) */
  activeTool: ToolId | null;
  setActiveTool: (tool: ToolId | null) => void;
  /** Per-tool remembered window size; a resize becomes that tool's default */
  toolSizes: Record<string, { w: number; h: number }>;
  setToolSize: (tool: ToolId, w: number, h: number) => void;
  /** Which tool window is open in the RIGHT dock (null = none) */
  activeToolRight: ToolId | null;
  setActiveToolRight: (tool: ToolId | null) => void;
  /** Per-tool placement + visibility (Customize Toolbar & Panels) */
  toolConfig: Record<string, ToolConfig>;
  setToolConfig: (cfg: Record<string, ToolConfig>) => void;
  /** Dock ordering across both panels (Customize Layout ↑/↓) */
  toolOrder: string[];
  setToolOrder: (order: string[]) => void;
  /** Tool open with no dock home: temporary floating window */
  tempTool: ToolId | null;
  setTempTool: (tool: ToolId | null) => void;
  /**
   * Open a tool wherever it lives: its dock side if enabled (revealing the
   * dock if hidden), or a temporary window if it's disabled in both panels.
   */
  openTool: (tool: ToolId) => void;
  /**
   * v1.21: request Preferences, opened on a specific TAB.
   *
   * v1.16 asked it to "scroll to a section", which only worked if you happened to
   * already be on the tab that contained it. Settings has tabs — Save Options is one
   * of them — so the request names the tab.
   */
  /** v1.57: launch found nothing to open (first run, or no last-opened doc)
   *  — MenuBar consumes this and opens the New Script prompt. */
  newScriptPromptRequest: boolean;
  setNewScriptPromptRequest: (v: boolean) => void;
  /** v1.34: show menu items for features that aren't finished (Collaboration,
   *  Lock Pages). Off by default; flipped from Help > Developer. */
  showUnreleasedTools: boolean;
  setShowUnreleasedTools: (v: boolean) => void;
  /** v1.75: the Outline Bar (Final Draft's Outline Editor) under the toolbar. */
  outlineBarOpen: boolean;
  setOutlineBarOpen: (v: boolean) => void;
  /** v2.95: Word/Docs-style rulers on the editor's top and left edges,
   *  toggled from the View menu. Persisted view state. */
  rulersVisible: boolean;
  setRulersVisible: (v: boolean) => void;
  /** v3.21, Derek: the Quick Access Toolbar's buttons (titlebar row) —
   *  ordered ids from TitleBar's QAT_OPTIONS. Persisted view state. */
  qatItems: string[];
  /** v3.34: dropdown field widths (px) by builtin key — one source for the
   *  live ribbon and the visual editor. */
  toolbarDdWidths: Record<string, number>;  /** v3.36, Derek: the ribbon is edited IN PLACE on the real bar — the
   *  Customize > Toolbar tab shows only the palette; the bar itself becomes
   *  the drop surface while that tab is open, and locks when it closes.
   *  These are EPHEMERAL (not persisted). */
  toolbarEditing: boolean;
  setToolbarEditing: (b: boolean) => void;
  ribEdit: { dragging: boolean; spot: RibDropSpot | null; secSpot: number | null };
  setRibEdit: (partial: Partial<{ dragging: boolean; spot: RibDropSpot | null; secSpot: number | null }>) => void;
  setQatItems: (ids: string[]) => void;
  /** v2.11: Outline Bar zoom — pixels per page on the timeline. 0 = fit
   *  the whole ruler to the visible width. Persisted view state. */
  outlineBarZoom: number;
  setOutlineBarZoom: (px: number) => void;
  /** v2.27: vertical scale of the Outline Bar's rows/ruler (1 = default).
   *  Driven by dragging the bar's bottom edge. */
  outlineBarRowScale: number;
  setOutlineBarRowScale: (s: number) => void;
  /** v2.66: vertical scale of the Scrapbook tree's rows (1 = default) —
   *  text and icons follow proportionally. Driven by the panel's bottom
   *  zoom bar. Persisted view state. */
  scrapbookTreeScale: number;
  setScrapbookTreeScale: (s: number) => void;
  /** v2.42: the bar's rows — kind, order, optional per-row height (px,
   *  before the global row scale). Customize > Outline Bar edits this. */
  outlineBarRows: OutlineBarRow[];
  setOutlineBarRows: (rows: OutlineBarRow[]) => void;
  outlineBarLabels: boolean;
  setOutlineBarLabels: (v: boolean) => void;
  /** v2.46, Derek: "Show beat color on all tabs" — ON paints the whole card
   *  with the beat's color everywhere; OFF falls back to a thin edge stripe. */
  beatColorAllTabs: boolean;
  setBeatColorAllTabs: (v: boolean) => void;
  /** v2.55, Derek: one lock freezes every chrome resize — panel edges, the
   *  bar strips, the outline bar edge, the spacing grips. */
  uiResizeLocked: boolean;
  setUiResizeLocked: (v: boolean) => void;
  /** v2.55: View > Reset All Sizes & Spacing — the same defaults the
   *  per-surface Customize reset buttons apply, all at once. */
  resetChromeSizes: () => void;
  /** v3.34: factory-resets every Customize layout — sizes, ribbon, QAT,
   *  dropdown widths, menu bar, panels, outline bar. */
  resetAllCustomizations: () => void;
  /** v3.49: a plain snapshot of every persistent customization field, so the
   *  Customize dialog can take one on open and, on Cancel / "don't save",
   *  restore it wholesale. ONE field list (CUSTOMIZATION_FIELDS) drives both
   *  capture and restore, so they can't drift. */
  captureCustomizations: () => Record<string, unknown>;
  restoreCustomizations: (snap: Record<string, unknown>) => void;
  /** v1.83: the CURRENT text-highlighter color — one source shared by the
   *  toolbar highlighter button and Format > Highlighting. Persisted. */
  highlightColor: string;
  setHighlightColor: (v: string) => void;
  /** v1.85: which goal kind the Goals window shows — lives here because the
   *  Words/Pages/Time tabs render in the window HEADER (chrome slot). */
  goalKind: 'words' | 'pages' | 'time';
  setGoalKind: (v: 'words' | 'pages' | 'time') => void;
  preferencesRequest: { open: boolean; tab?: 'saveloc' | 'keys' };
  openPreferences: (tab?: 'saveloc' | 'keys') => void;
  closePreferences: () => void;
  /** Toolbar customization: hidden built-in buttons + pinned tool shortcuts */
  toolbarHiddenItems: string[];  toolbarPinnedTools: ToolId[];  /** Active writing goal (words / pages / time), persisted across reloads */
  goal: WritingGoal | null;
  /** Per-destination mirror save status for the status bar (Save Locations). */
  mirrorStatuses: Record<string, 'saving' | 'saved' | 'error'>;
  setMirrorStatus: (name: string, st: 'saving' | 'saved' | 'error') => void;
  /** Lifetime count of completed writing goals (Analytics > Overview). */
  goalsCompleted: number;
  incrementGoalsCompleted: () => void;
  setGoal: (g: WritingGoal | null | ((g: WritingGoal | null) => WritingGoal | null)) => void;
  notesVisible: boolean;
  setNotesVisible: (v: boolean) => void;

  // Scene synopsis & color
  updateSceneSynopsis: (id: string, synopsis: string) => void;
  updateSceneColor: (id: string, color: string) => void;

  // Scene numbering
  /** Per-document draft label ("First Draft", "Second Draft", ...) — feeds the
   *  Save As autofill and the Title Page draft line. Persisted in the doc. */
  draftLabel: string;
  /** v1.50: the Version the user chose at New Script time (MM/DD/YY). Save
   *  Script prefills from it; empty = Save uses today's date. */
  versionLabel: string;
  setVersionLabel: (label: string) => void;
  setDraftLabel: (label: string) => void;


  // Revision
  revisionMode: boolean;
  revisionColor: string;
  setRevisionMode: (on: boolean) => void;
  setRevisionColor: (color: string) => void;

  characterProfilesOpen: boolean;
  toggleCharacterProfiles: () => void;
  selectedCharacter: string | null;
  setSelectedCharacter: (name: string | null) => void;
  /** v4.35 batch-v9 #4: ONE fullscreen takeover for every side-panel window —
   *  which tool currently owns the editor area (null = the editor). Replaces
   *  the per-tool charFullscreen/scenesFullscreen flags; a single field makes
   *  the takeovers mutually exclusive by construction. Session-only. */
  fullscreenTool: ToolId | null;
  setFullscreenTool: (id: ToolId | null) => void;
  /** Clears the tool's docked/floating slot and raises its takeover (also
   *  lowers the Scrapbook surface — that's the other editor-area owner). */
  enterToolFullscreen: (id: ToolId) => void;
  /** v4.24 batch-v2 #6: the character count the panel currently shows —
   *  published by CharacterProfiles so the tool-window header displays the
   *  SAME number (search-filtered, profiles ∪ live cues) without recomputing
   *  it. Not persisted. */
  charListCount: number;
  setCharListCount: (n: number) => void;
  /** v4.27 window template: the frame's row-2 chrome (tabs + the
   *  Filter/Sort/View/Search cluster) renders OUTSIDE CharacterProfiles, so
   *  the states it drives live here. Tab is session-only; the view modes
   *  persist like scenesViewMode; search is session-only. */
  charActiveTab: 'profiles' | 'relationships' | 'setup';
  setCharActiveTab: (t: 'profiles' | 'relationships' | 'setup') => void;
  charViewMode: 'cards' | 'list';
  setCharViewMode: (m: 'cards' | 'list') => void;
  relViewMode: 'list' | 'map';
  setRelViewMode: (m: 'list' | 'map') => void;
  charSearchQuery: string;
  setCharSearchQuery: (q: string) => void;
  /** v4.16: relationship-map scroll-to-zoom speed multiplier (Design panel). */
  mapScrollSpeed: number;
  setMapScrollSpeed: (v: number) => void;

  // Production tags
  tagsVisible: boolean;
  setTagsVisible: (v: boolean) => void;
  tagsPanelOpen: boolean;
  toggleTagsPanel: () => void;
  locationDatabaseOpen: boolean;
  toggleLocationDatabase: () => void;
  /** When set, the Tags panel shows a "select category" prompt for this selection */
  pendingTagSelection: { from: number; to: number; text: string; elementType: string; sceneId: string | null } | null;
  setPendingTagSelection: (sel: { from: number; to: number; text: string; elementType: string; sceneId: string | null } | null) => void;
  /** When set, the Tags panel auto-expands this tag for editing */
  editingTagId: string | null;
  setEditingTagId: (id: string | null) => void;
  /** v4.32 batch-v8 #12: the Tags window's View/Manage tab — store-held so the
   *  window chrome (TOOL_CHROME.tags tabs) can drive it from outside the body. */
  tagsPanelTab: 'view' | 'manage';
  setTagsPanelTab: (t: 'view' | 'manage') => void;


  // Theme
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;

  // Toolbar display mode
  toolbarMode: 'compact' | 'comfortable' | 'custom' | 'hidden';
  /** Menu bar mode, split from toolbarMode (v0.39); migrates from it. */
  menuMode: 'compact' | 'comfortable' | 'custom' | 'hidden';
  setMenuMode: (m: 'compact' | 'comfortable' | 'custom' | 'hidden') => void;
  setToolbarMode: (mode: 'compact' | 'comfortable' | 'custom' | 'hidden') => void;

  // Character sort preference
  characterSortBy: 'name' | 'importance' | 'scenes' | 'dialogues' | 'appearance';
  setCharacterSortBy: (sort: 'name' | 'importance' | 'scenes' | 'dialogues' | 'appearance') => void;

  // Navigator panel width (for floating menu positioning)
  navPanelWidth: number;
  setNavPanelWidth: (w: number) => void;

  // Track changes
  trackChangesEnabled: boolean;
  trackChangesLabel: string;
  setTrackChangesEnabled: (v: boolean) => void;
  setTrackChangesLabel: (v: string) => void;
  compareVersionOpen: boolean;
  setCompareVersionOpen: (v: boolean) => void;

  // Save status
  saveStatus: 'idle' | 'unsaved' | 'saving' | 'saved' | 'error';
  saveError: string | null;
  setSaveStatus: (status: 'idle' | 'unsaved' | 'saving' | 'saved' | 'error', error?: string | null) => void;

  // Dialogs
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  goToPageOpen: boolean;
  setGoToPageOpen: (open: boolean) => void;
  titlePageEditorOpen: boolean;
  setTitlePageEditorOpen: (open: boolean) => void;
  moresContdsOpen: boolean;
  setMoresContdsOpen: (open: boolean) => void;
  // Registered by ScreenplayEditor; the menu/toolbar calls it to start image insertion.
  imageInsertHandler: (() => void) | null;
  setImageInsertHandler: (fn: (() => void) | null) => void;
  openFileOpen: boolean;
  setOpenFileOpen: (open: boolean) => void;
  saveAsOpen: boolean;
  setSaveAsOpen: (open: boolean) => void;
  /** Set by ProjectView before navigating away to the editor for a new
   *  in-project script. MenuBar's mount effect consumes the flag and prompts
   *  the user for a script format (without wiping the project context that
   *  ProjectView just established). */
  pendingFormatPromptInProject: boolean;
  setPendingFormatPromptInProject: (v: boolean) => void;
  /** Optional callback to run after save-as completes (e.g. deferred import). */
  postSaveAction: (() => void) | null;
  setPostSaveAction: (action: (() => void) | null) => void;
  /** If the current unsaved document was imported from an external file
   *  (.fdx, .fountain, .docx, etc.), tracks the source filename. Used by
   *  SaveAsDialog to clarify that saves go to ScriptCraft's library rather than
   *  writing back to the source file. Cleared on successful save. */
  importedSource: { name: string; format: string } | null;
  setImportedSource: (src: { name: string; format: string } | null) => void;
}

/** v3.49: every persistent field the Customize dialog can change. The one
 *  list captureCustomizations / restoreCustomizations both read — so a
 *  Cancel reverts ALL of it, with nothing quietly left behind. Panel
 *  open/close and the active tool are view state, not customizations, so
 *  they're deliberately excluded (Cancel shouldn't slam panels shut). */
const CUSTOMIZATION_FIELDS = [
  'toolbarLeft', 'toolbarRight', 'toolbarMode',
  'toolConfig', 'toolOrder', 'toolbarHiddenItems', 'toolbarPinnedTools',
  'menuBarOrder', 'menuBarHidden', 'menuMode',
  'panelDividers', 'panelSizeMode',
  'qatItems', 'toolbarDdWidths',
  'chromeCustomPx', 'chromeGapPx',
  'outlineBarRows', 'outlineBarZoom', 'outlineBarLabels', 'outlineBarRowScale',
  'uiResizeLocked',
] as const;

export const useEditorStore = create<EditorState>((set, get, api) => ({
  ...createDesignSlice(set, get, api),
  ...createCharacterSlice(set, get, api),
  ...createTagSlice(set, get, api),
  ...createTypewriterSlice(set, get, api),
  ...createNotesSlice(set, get, api),
  ...createSceneNavSlice(set, get, api),
  ...createWorkspacesSlice(set, get, api),
  ...createViewPrefsSlice(set, get, api),
  ...createSpellGrammarSlice(set, get, api),
  ...createBeatsOutlineSlice(set, get, api),
  activeElement: 'action',
  setActiveElement: (el) => set({ activeElement: el }),

  documentTitle: 'Untitled Script',
  setDocumentTitle: (title) => {
    set({ documentTitle: title });
    // Update native window title on desktop so macOS Window menu shows file names
    import('../services/platform').then(({ isDesktopTauri }) => {
      if (!isDesktopTauri()) return;
      import('@tauri-apps/api/core').then(({ invoke }) => {
        invoke('set_window_title', { title: title || '' }).catch(() => {});
      }).catch(() => {});
    });
  },
  pageCount: 1,
  setPageCount: (count) => set({ pageCount: count }),
  currentPage: 1,
  setCurrentPage: (page) => set({ currentPage: page }),

  scenes: [],
  setScenes: (scenes) => set({ scenes }),
  navigatorOpen: _vs.navigatorOpen ?? (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0 ? false : true),
  toggleNavigator: () => set((s) => {
    const v = !s.navigatorOpen;
    saveViewState({ navigatorOpen: v });
    return { navigatorOpen: v };
  }),

  // v4.24 batch 7: Index Cards merged into Scenes. A layout that had the old
  // tool open (or active) reopens as Scenes showing the Cards view.
  scenesViewMode: _vs.scenesViewMode
    ?? ((_vs.activeTool === 'indexcards' || _vs.activeToolRight === 'indexcards' || _vs.indexCardsOpen) ? 'cards' : 'list'),
  setScenesViewMode: (m) => {
    saveViewState({ scenesViewMode: m });
    set({ scenesViewMode: m });
  },
  scenesReorderMode: false,
  setScenesReorderMode: (v) => set({ scenesReorderMode: v }),
  navShowSceneNumbers: _vs.navShowSceneNumbers ?? false,
  setNavShowSceneNumbers: (v) => {
    saveViewState({ navShowSceneNumbers: v });
    set({ navShowSceneNumbers: v });
  },
  designCollapsedGroups: _vs.designCollapsedGroups ?? null,
  setDesignCollapsedGroups: (ids) => {
    saveViewState({ designCollapsedGroups: ids });
    set({ designCollapsedGroups: ids });
  },
  notesSort: 'manual',
  setNotesSort: (v) => set({ notesSort: v }),
  todoSort: 'manual',
  setTodoSort: (v) => set({ todoSort: v }),
  toolCounts: {},
  setToolCount: (id, n) => set((st) => (st.toolCounts[id] === n ? st : { toolCounts: { ...st.toolCounts, [id]: n } })),
  beatBoardOpen: _vs.beatBoardOpen ?? false,
  statisticsOpen: false,
  setStatisticsOpen: (open) => set({ statisticsOpen: open }),
  statisticsScrollTo: null,
  setStatisticsScrollTo: (id) => set({ statisticsScrollTo: id }),
  shelfOpen: _vs.shelfOpen ?? true,
  toggleShelf: () => set((s) => {
    const v = !s.shelfOpen;
    saveViewState({ shelfOpen: v });
    return { shelfOpen: v };
  }),
  // v4.33: the shelf-tab router (openShelfTab / notesSubTab / shelfTab) is
  // gone — Notes holds only general notes now, so there is no Script sub-view
  // to route into. Callers open tools directly (openTool) and script-note
  // editing goes through the highlight popover (notePopoverId).
  activeTool: (_vs.activeTool === 'indexcards' ? 'scenes' : (_vs.activeTool as ToolId | null)) ?? null,
  setActiveTool: (tool) => {
    saveViewState({ activeTool: tool });
    set({ activeTool: tool });
  },
  toolSizes: migrateNotebookInline(migrateTypewriterSize(migrateSpellingSize(migrateNavigatorInline(_vs.toolSizes ?? {})))),
  setToolSize: (tool, w, h) => set((s) => {
    const toolSizes = { ...s.toolSizes, [tool]: { w, h } };
    saveViewState({ toolSizes });
    return { toolSizes };
  }),
  activeToolRight: (_vs.activeToolRight === 'indexcards' ? 'scenes' : (_vs.activeToolRight as ToolId | null)) ?? null,
  setActiveToolRight: (tool) => {
    saveViewState({ activeToolRight: tool });
    set({ activeToolRight: tool });
  },
  toolConfig: migrateToolConfig({ ...DEFAULT_TOOL_CONFIG, ...(_vs.toolConfig ?? {}) }),
  setToolConfig: (cfg) => {
    saveViewState({ toolConfig: cfg });
    set({ toolConfig: cfg });
  },
  toolOrder: migrateToolOrder(_vs.toolOrder ?? [...DEFAULT_TOOL_ORDER]),
  setToolOrder: (order) => {
    saveViewState({ toolOrder: order });
    set({ toolOrder: order });
  },
  tempTool: null,
  setTempTool: (tool) => set({ tempTool: tool }),
  newScriptPromptRequest: false,
  setNewScriptPromptRequest: (v) => set({ newScriptPromptRequest: v }),
  showUnreleasedTools: (_vs.showUnreleasedTools as boolean) ?? false,
  setShowUnreleasedTools: (v) => {
    saveViewState({ showUnreleasedTools: v });
    set({ showUnreleasedTools: v });
  },
  outlineBarOpen: (_vs.outlineBarOpen as boolean) ?? false,
  setOutlineBarOpen: (v) => {
    saveViewState({ outlineBarOpen: v });
    set({ outlineBarOpen: v });
  },
  // v2.95, Derek: Word/Docs-style rulers along the editor's top and left.
  rulersVisible: (_vs.rulersVisible as boolean) ?? true,
  setRulersVisible: (v) => {
    saveViewState({ rulersVisible: v });
    set({ rulersVisible: v });
  },
  qatItems: Array.isArray(_vs.qatItems) ? (_vs.qatItems as string[]) : ['save', 'undo', 'redo'],
  setQatItems: (ids) => {
    saveViewState({ qatItems: ids });
    set({ qatItems: ids });
  },
  toolbarDdWidths: (_vs.toolbarDdWidths && typeof _vs.toolbarDdWidths === 'object')
    ? (_vs.toolbarDdWidths as Record<string, number>) : {},
  toolbarEditing: false,
  setToolbarEditing: (b) => set({
    toolbarEditing: b,
    ...(b ? {} : { ribEdit: { dragging: false, spot: null, secSpot: null } }),
  }),
  ribEdit: { dragging: false, spot: null, secSpot: null },
  setRibEdit: (partial) => set((s) => ({ ribEdit: { ...s.ribEdit, ...partial } })),
  outlineBarZoom: (_vs.outlineBarZoom as number) ?? 0,
  setOutlineBarZoom: (px) => {
    saveViewState({ outlineBarZoom: px });
    set({ outlineBarZoom: px });
  },
  outlineBarRowScale: (_vs.outlineBarRowScale as number) ?? 1,
  setOutlineBarRowScale: (s) => {
    const clamped = clamp(s, 0.7, 2.5);
    saveViewState({ outlineBarRowScale: clamped });
    set({ outlineBarRowScale: clamped });
  },
  scrapbookTreeScale: (_vs.scrapbookTreeScale as number) ?? 1,
  setScrapbookTreeScale: (s) => {
    const clamped = clamp(s, 0.7, 2);
    saveViewState({ scrapbookTreeScale: clamped });
    set({ scrapbookTreeScale: clamped });
  },
  outlineBarRows: (Array.isArray(_vs.outlineBarRows) && (_vs.outlineBarRows as OutlineBarRow[]).length > 0)
    ? (_vs.outlineBarRows as OutlineBarRow[])
    : DEFAULT_OUTLINE_BAR_ROWS,
  setOutlineBarRows: (rows) => {
    const next = rows.length > 0 ? rows : DEFAULT_OUTLINE_BAR_ROWS;
    saveViewState({ outlineBarRows: next });
    set({ outlineBarRows: next });
  },
  outlineBarLabels: (_vs.outlineBarLabels as boolean) ?? true,
  setOutlineBarLabels: (v) => {
    saveViewState({ outlineBarLabels: v });
    set({ outlineBarLabels: v });
  },
  beatColorAllTabs: (_vs.beatColorAllTabs as boolean) ?? true,
  setBeatColorAllTabs: (v) => {
    saveViewState({ beatColorAllTabs: v });
    set({ beatColorAllTabs: v });
  },
  uiResizeLocked: (_vs.uiResizeLocked as boolean) ?? false,
  setUiResizeLocked: (v) => {
    saveViewState({ uiResizeLocked: v });
    set({ uiResizeLocked: v });
  },
  resetChromeSizes: () => {
    const st = get();
    st.setMenuMode('compact');
    st.setToolbarMode('compact');
    st.setChromeGap('menu', 0);
    st.setChromeGap('toolbar', 2);
    st.setChromeGap('bigbtn', 0);
    st.setChromeGap('scrapbook', 12);
    st.setPanelSizeMode('left', 'comfortable');
    st.setPanelSizeMode('right', 'comfortable');
    st.setOutlineBarRowScale(1);
    st.setScrapbookTreeScale(1);
    st.setBigBtnInset(16);
    st.setPanelItemScale('left', 1);
    st.setPanelItemScale('right', 1);
  },
  /** v3.34, Derek: "Reset All Customizations" — everything Customize can
   *  change goes back to factory: sizes AND layouts (ribbon, QAT, dropdown
   *  widths, menu bar, panels, outline bar rows). Themes, Elements and
   *  Keyboard Shortcuts keep their own per-tab resets — they're content,
   *  not layout. */
  resetAllCustomizations: () => {
    const st = get();
    st.resetChromeSizes();
    st.setToolbarZones([...DEFAULT_TOOLBAR_LEFT], []);
    st.setQatItems(['save', 'undo', 'redo']);
    saveViewState({ toolbarDdWidths: {} });
    set({ toolbarDdWidths: {} });
    st.setMenuBarOrder([...MENU_BAR_LABELS]);
    st.setToolConfig({ ...DEFAULT_TOOL_CONFIG });
    st.setToolOrder([...DEFAULT_TOOL_ORDER]);
    st.setOutlineBarRows([...DEFAULT_OUTLINE_BAR_ROWS]);
    st.setOutlineBarZoom(0);
  },
  // v3.49: capture reads the current value of every persistent-customization
  // field; restore writes them straight back (state + persisted view state).
  // Both walk the one CUSTOMIZATION_FIELDS list, so a field added to one is
  // added to the other — no drifting half-revert.
  captureCustomizations: () => {
    const s = get() as unknown as Record<string, unknown>;
    const snap: Record<string, unknown> = {};
    for (const k of CUSTOMIZATION_FIELDS) snap[k] = s[k];
    // Deep copy so later edits can't mutate the snapshot in place.
    return JSON.parse(JSON.stringify(snap));
  },
  restoreCustomizations: (snap) => {
    const patch: Record<string, unknown> = {};
    for (const k of CUSTOMIZATION_FIELDS) if (k in snap) patch[k] = snap[k];
    // toolbarZonesSet must ride along so restored ribbon zones aren't treated
    // as "never customized" and re-defaulted on the next load.
    patch.toolbarZonesSet = true;
    saveViewState(patch as Partial<ViewState>);
    set(patch as Partial<EditorState>);
  },
  highlightColor: (_vs.highlightColor as string) ?? '#ffff00',
  setHighlightColor: (v) => {
    saveViewState({ highlightColor: v });
    set({ highlightColor: v });
  },
  goalKind: 'time',
  setGoalKind: (v) => set({ goalKind: v }),
  preferencesRequest: { open: false },
  openPreferences: (tab) => set({ preferencesRequest: { open: true, tab } }),
  closePreferences: () => set({ preferencesRequest: { open: false } }),
  openTool: (tool) => set((s) => {
    // v1.2: Analytics always opens as its own window. It's far taller than a
    // panel, so docking it just meant a cramped column you had to scroll — the
    // window is the only shape it actually works in.
    if (ALWAYS_FLOAT.includes(tool)) return { tempTool: tool };
    if (tool === 'scriptnotes') {
      // Legacy id — remapped to the Notes window (v0.15; sub-tabs gone v4.33).
      tool = 'sticky';
    }
    if (tool === 'indexcards') {
      // Legacy id — Index Cards is Scenes' Cards view now (v4.24 batch 7).
      saveViewState({ scenesViewMode: 'cards' });
      setTimeout(() => set({ scenesViewMode: 'cards' }), 0);
      tool = 'scenes';
    }
    /**
     * v1.10 — ask the SAME question the dock asks.
     *
     * This used to do its own lookup: `s.toolConfig[tool] ?? DEFAULT_TOOL_CONFIG[tool]`.
     * ToolDock, meanwhile, calls toolConfigFor(), which falls back to
     * {side:'right', enabled:true} for anything it doesn't recognise. So a tool with
     * no DEFAULT_TOOL_CONFIG entry (historically the Dev Picker) was RENDERED IN THE DOCK by one
     * function and treated as undocked by the other — click its tab and it opened in
     * the panel; pick it from the menu and it floated a window in the middle of the
     * screen. Two sources of truth for one question, which is the bug this codebase
     * keeps re-learning.
     *
     * Now the menu opens a tool wherever it actually lives: docked if it's in a
     * panel, floating only if it isn't.
     */
    const cfg = toolConfigFor(s.toolConfig, tool);
    if (cfg && cfg.enabled) {
      if (cfg.side === 'left') {
        saveViewState({ activeTool: tool });
        const patch: Partial<EditorState> = { activeTool: tool, tempTool: null };
        if (!s.navigatorOpen) { patch.navigatorOpen = true; saveViewState({ navigatorOpen: true }); }
        return patch;
      }
      saveViewState({ activeToolRight: tool });
      const patch: Partial<EditorState> = { activeToolRight: tool, tempTool: null };
      if (!s.shelfOpen) { patch.shelfOpen = true; saveViewState({ shelfOpen: true }); }
      return patch;
    }
    return { tempTool: tool };
  }),
  toolbarHiddenItems: _vs.toolbarHiddenItems ?? [],
  toolbarPinnedTools: migrateToolOrder((_vs.toolbarPinnedTools as string[]) ?? []) as ToolId[],
  goal: _vs.writingGoal ?? null,
  setGoal: (g) => set((s) => {
    const goal = typeof g === 'function' ? g(s.goal) : g;
    saveViewState({ writingGoal: goal });
    return { goal };
  }),
  mirrorStatuses: {},
  setMirrorStatus: (name, st) => set((s) => ({ mirrorStatuses: { ...s.mirrorStatuses, [name]: st } })),
  goalsCompleted: _vs.goalsCompleted ?? 0,
  incrementGoalsCompleted: () => set((s) => {
    const goalsCompleted = (s.goalsCompleted || 0) + 1;
    saveViewState({ goalsCompleted });
    return { goalsCompleted };
  }),
  notesVisible: _vs.notesVisible ?? true,
  setNotesVisible: (v) => {
    saveViewState({ notesVisible: v });
    set({ notesVisible: v });
  },

  updateSceneSynopsis: (id, synopsis) =>
    set((s) => ({
      scenes: s.scenes.map((sc) => (sc.id === id ? { ...sc, synopsis } : sc)),
    })),

  updateSceneColor: (id, color) =>
    set((s) => ({
      scenes: s.scenes.map((sc) => (sc.id === id ? { ...sc, color } : sc)),
    })),

  // Scene numbering
  draftLabel: 'First Draft',
  setDraftLabel: (label) => set({ draftLabel: label }),
  versionLabel: '',
  setVersionLabel: (label) => set({ versionLabel: label }),
  toolbarLeft: _tbZones.left,
  toolbarRight: _tbZones.right,
  // v2.86: judged from what was PERSISTED, never from the normalized output —
  // normalizeToolbarZones re-inserts the permanent Customize anchor into the
  // right zone, which made a FRESH profile look like a user-authored empty
  // layout, so the default toolbar never seeded (empty toolbar on install).
  toolbarZonesSet: _vs.toolbarZonesSet === true
    || (Array.isArray(_vs.toolbarLeft) && _vs.toolbarLeft.length > 0)
    || (Array.isArray(_vs.toolbarRight) && _vs.toolbarRight.length > 0),
  setToolbarZones: (left, right) => {
    saveViewState({ toolbarLeft: left, toolbarRight: right, toolbarZonesSet: true });
    set({ toolbarLeft: left, toolbarRight: right, toolbarZonesSet: true });
  },
  resetAllSettings: () => {
    // Factory layout: no active workspace, default menu bar / toolbar /
    // panels / page layout, Page view. Saved workspaces, projects, scripts,
    // and tool data are untouched.
    const patch: Partial<EditorState> = {
      activeWorkspace: null,
      menuBarOrder: [], menuBarHidden: [], menuMode: 'compact',
      toolbarLeft: [...DEFAULT_TOOLBAR_LEFT], toolbarRight: [...DEFAULT_TOOLBAR_RIGHT],
      toolbarZonesSet: true, toolbarMode: 'compact',
      toolbarHiddenItems: [], toolbarPinnedTools: [],
      toolConfig: { ...DEFAULT_TOOL_CONFIG }, toolOrder: [], panelDividers: [],
      navigatorOpen: true, shelfOpen: true,
      viewStyle: 'page', previewMode: false,
      pageLayout: { ...DEFAULT_PAGE_LAYOUT },
    };
    saveViewState({
      activeWorkspace: null,
      menuBarOrder: [], menuBarHidden: [], menuMode: 'compact',
      toolbarLeft: patch.toolbarLeft, toolbarRight: patch.toolbarRight, toolbarZonesSet: true,
      toolbarMode: 'compact', toolbarHiddenItems: [], toolbarPinnedTools: [],
      toolConfig: patch.toolConfig, toolOrder: [], panelDividers: [],
      navigatorOpen: true, shelfOpen: true, viewStyle: 'page',
    });
    set(patch);
  },
  panelDividers: Array.isArray(_vs.panelDividers) ? _vs.panelDividers as { id: string; label: string; side: 'left' | 'right'; spacer?: boolean }[] : [],
  contextMenuHidden: _vs.contextMenuHidden ?? [],
  setContextMenuHidden: (ids) => {
    saveViewState({ contextMenuHidden: ids });
    set({ contextMenuHidden: ids });
  },
  contextMenuOrder: _vs.contextMenuOrder ?? [],
  setContextMenuOrder: (ids) => {
    saveViewState({ contextMenuOrder: ids });
    set({ contextMenuOrder: ids });
  },
  noteOrder: _vs.noteOrder ?? [],
  setNoteOrder: (keys) => {
    saveViewState({ noteOrder: keys });
    set({ noteOrder: keys });
  },
  todoOrder: _vs.todoOrder ?? [],
  setTodoOrder: (keys) => {
    saveViewState({ todoOrder: keys });
    set({ todoOrder: keys });
  },
  panelSizeMode: _vs.panelSizeMode ?? { left: 'comfortable', right: 'comfortable' },
  panelNameCase: (_vs.panelNameCase === 'upper' ? 'upper' : 'title') as 'title' | 'upper',
  setPanelNameCase: (c) => {
    saveViewState({ panelNameCase: c });
    set({ panelNameCase: c });
  },
  chromeCustomPx: _vs.chromeCustomPx ?? { menu: 36, toolbar: 33, panelLeft: 266, panelRight: 266 },
  setChromeCustomPx: (surface, px) => set((st) => {
    const next = { ...st.chromeCustomPx, [surface]: px };
    saveViewState({ chromeCustomPx: next });
    return { chromeCustomPx: next };
  }),
  bigBtnInsetPx: (_vs.bigBtnInsetPx as number) ?? 16,
  setBigBtnInset: (px) => set(() => {
    const clamped = clamp(Math.round(px), 0, 40);
    saveViewState({ bigBtnInsetPx: clamped });
    return { bigBtnInsetPx: clamped };
  }),
  panelItemScale: (_vs.panelItemScale as { left: number; right: number }) ?? { left: 1, right: 1 },
  setPanelItemScale: (side, scale) => set((st) => {
    const clamped = clamp(scale, 0.7, 1.8);
    const next = { ...st.panelItemScale, [side]: clamped };
    saveViewState({ panelItemScale: next });
    return { panelItemScale: next };
  }),
  chromeGapPx: { menu: 0, toolbar: 2, bigbtn: 0, scrapbook: 12, ...((_vs.chromeGapPx as Record<string, number>) ?? {}) },
  setChromeGap: (bar, px) => set((st) => {
    // v2.35: 'scrapbook' is an OFFSET (how far the Scrapbook menu group sits
    // from the last regular menu), so it gets a wider range than the gaps.
    const max = bar === 'scrapbook' ? 400 : 32;
    const next = { ...st.chromeGapPx, [bar]: clamp(Math.round(px), 0, max) };
    saveViewState({ chromeGapPx: next });
    return { chromeGapPx: next };
  }),
  setPanelSizeMode: (side, mode) => set((st) => {
    const next = { ...st.panelSizeMode, [side]: mode };
    saveViewState({ panelSizeMode: next });
    return { panelSizeMode: next };
  }),
  setPanelDividers: (panelDividers) => {
    saveViewState({ panelDividers });
    set({ panelDividers });
  },
  menuBarOrder: Array.isArray(_vs.menuBarOrder) ? _vs.menuBarOrder as string[] : [],
  setMenuBarOrder: (order) => {
    saveViewState({ menuBarOrder: order });
    set({ menuBarOrder: order });
  },
  menuBarHidden: (Array.isArray(_vs.menuBarHidden) ? _vs.menuBarHidden as string[] : []).filter((l) => l !== 'File'),
  setMenuBarHidden: (hidden) => {
    const safe = hidden.filter((l) => l !== 'File');
    saveViewState({ menuBarHidden: safe });
    set({ menuBarHidden: safe });
  },

  revisionMode: false,
  revisionColor: 'White',
  setRevisionMode: (on) => set({ revisionMode: on }),
  setRevisionColor: (color) => set({ revisionColor: color }),

  characterProfilesOpen: _vs.characterProfilesOpen ?? false,
  toggleCharacterProfiles: () => get().openTool('characters'),
  selectedCharacter: null,
  setSelectedCharacter: (name) => set({ selectedCharacter: name }),
  fullscreenTool: null,
  setFullscreenTool: (id) => set({ fullscreenTool: id }),
  enterToolFullscreen: (id) => {
    const s = get();
    if (s.activeTool === id) s.setActiveTool(null);
    if (s.activeToolRight === id) s.setActiveToolRight(null);
    if (s.tempTool === id) s.setTempTool(null);
    // The Scrapbook surface is the other editor-area owner — lower it. Its
    // dock slots clear too, matching closeNotebook() (which lives component-
    // side and can't be imported here without a cycle).
    useNotebookStore.getState().setNotebookOpen(false);
    if (s.activeTool === 'notebook') s.setActiveTool(null);
    if (s.activeToolRight === 'notebook') s.setActiveToolRight(null);
    if (s.tempTool === 'notebook') s.setTempTool(null);
    set({ fullscreenTool: id });
  },
  charListCount: 0,
  setCharListCount: (n) => set((s) => (s.charListCount === n ? {} : { charListCount: n })),
  charActiveTab: 'profiles',
  setCharActiveTab: (t) => set({ charActiveTab: t }),
  charViewMode: (_vs.charViewMode as 'cards' | 'list') ?? 'cards',
  setCharViewMode: (m) => { saveViewState({ charViewMode: m }); set({ charViewMode: m }); },
  relViewMode: (_vs.relViewMode as 'list' | 'map') ?? 'list',
  setRelViewMode: (m) => { saveViewState({ relViewMode: m }); set({ relViewMode: m }); },
  charSearchQuery: '',
  setCharSearchQuery: (q) => set({ charSearchQuery: q }),
  mapScrollSpeed: (_vs.mapScrollSpeed as number) ?? 1,
  setMapScrollSpeed: (v) => {
    const clamped = clamp(v, 0.1, 3);
    saveViewState({ mapScrollSpeed: clamped });
    set({ mapScrollSpeed: clamped });
  },

  tagsVisible: _vs.tagsVisible ?? false,
  setTagsVisible: (v) => {
    saveViewState({ tagsVisible: v });
    set({ tagsVisible: v });
  },
  tagsPanelOpen: _vs.tagsPanelOpen ?? false,
  toggleTagsPanel: () => get().openTool('tags'),
  locationDatabaseOpen: _vs.locationDatabaseOpen ?? false,
  toggleLocationDatabase: () => set((s) => {
    const v = !s.locationDatabaseOpen;
    saveViewState({ locationDatabaseOpen: v });
    return { locationDatabaseOpen: v };
  }),
  pendingTagSelection: null,
  setPendingTagSelection: (sel) => set({ pendingTagSelection: sel }),
  editingTagId: null,
  setEditingTagId: (id) => set({ editingTagId: id }),
  tagsPanelTab: 'view',
  setTagsPanelTab: (t) => set({ tagsPanelTab: t }),

  theme: (localStorage.getItem('opendraft:theme') as ThemeId) || 'dark',
  setTheme: (t) => {
    localStorage.setItem('opendraft:theme', t);
    // Custom themes are a base + inline variable overrides, so applying one is
    // more than setting data-theme — applyThemeToDom also clears any previous
    // custom overrides, which is what lets you switch back to a built-in.
    void import('../components/themes').then(async (m) => {
      const { useThemeStore } = await import('./themeStore');
      m.applyThemeToDom(t, useThemeStore.getState().customThemes);
    });
    set({ theme: t });
  },

  toolbarMode: (_vs.toolbarMode as 'compact' | 'comfortable' | 'hidden') ?? 'compact',
  // v0.97: the menu bar can no longer be hidden — hiding it took File off screen
  // with it. Anyone already sitting on the hidden mode would otherwise be stuck
  // with no menu bar and no way back, so that setting is migrated on load.
  menuMode: ((_vs.menuMode ?? _vs.toolbarMode) === 'comfortable' ? 'comfortable' : 'compact') as 'compact' | 'comfortable' | 'hidden',
  setMenuMode: (m) => {
    saveViewState({ menuMode: m });
    set({ menuMode: m });
  },
  setToolbarMode: (mode) => { set({ toolbarMode: mode }); saveViewState({ toolbarMode: mode }); },

  characterSortBy: (_vs.characterSortBy as 'name' | 'importance' | 'scenes' | 'dialogues' | 'appearance') ?? 'importance',
  setCharacterSortBy: (sort) => { set({ characterSortBy: sort }); saveViewState({ characterSortBy: sort }); },

  navPanelWidth: 0,
  setNavPanelWidth: (w) => set({ navPanelWidth: w }),

  trackChangesEnabled: false,
  trackChangesLabel: '',
  setTrackChangesEnabled: (v) => set({ trackChangesEnabled: v }),
  setTrackChangesLabel: (v) => set({ trackChangesLabel: v }),
  compareVersionOpen: false,
  setCompareVersionOpen: (v) => set({ compareVersionOpen: v }),

  saveStatus: 'idle',
  saveError: null,
  setSaveStatus: (status, error = null) => set({ saveStatus: status, saveError: error }),

  searchOpen: false,
  setSearchOpen: (open) => set({ searchOpen: open }),
  goToPageOpen: false,
  setGoToPageOpen: (open) => set({ goToPageOpen: open }),
  titlePageEditorOpen: false,
  setTitlePageEditorOpen: (open) => set({ titlePageEditorOpen: open }),
  moresContdsOpen: false,
  setMoresContdsOpen: (open) => set({ moresContdsOpen: open }),
  imageInsertHandler: null,
  setImageInsertHandler: (fn) => set({ imageInsertHandler: fn }),
  openFileOpen: false,
  setOpenFileOpen: (open) => set({ openFileOpen: open }),
  saveAsOpen: false,
  setSaveAsOpen: (open) => set({ saveAsOpen: open }),
  pendingFormatPromptInProject: false,
  setPendingFormatPromptInProject: (v) => set({ pendingFormatPromptInProject: v }),
  postSaveAction: null,
  setPostSaveAction: (action) => set({ postSaveAction: action }),
  importedSource: null,
  setImportedSource: (src) => set({ importedSource: src }),
}));

/** v2.36: ONE undo for the app — routes to the beat history when the most
 *  recent change was a beat edit (Derek: closing a beat then hitting Undo
 *  must bring it back), otherwise to the script editor's own history. */
export function smartUndo(editor: { chain: () => { focus: () => { undo: () => { run: () => void } } } } | null): void {
  const s = useEditorStore.getState();
  if (s.canBeatUndo && s.lastBeatEditAt > s.lastDocEditAt) { s.beatUndo(); return; }
  try { editor?.chain().focus().undo().run(); } catch { /* editor gone */ }
}
export function smartRedo(editor: { chain: () => { focus: () => { redo: () => { run: () => void } } } } | null): void {
  const s = useEditorStore.getState();
  if (s.canBeatRedo && s.lastBeatEditAt > s.lastDocEditAt) { s.beatRedo(); return; }
  try { editor?.chain().focus().redo().run(); } catch { /* editor gone */ }
}
