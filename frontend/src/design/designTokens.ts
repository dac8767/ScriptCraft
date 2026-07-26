/**
 * Design tokens — the single source of truth for the live Design panel (v4.8).
 *
 * Each token is one numeric design knob (a size, padding, gap, radius or font
 * size) bound to a CSS custom property that the real stylesheet CONSUMES via
 * `var(--x, DEFAULT)`. The panel writes the property onto :root; unset, the
 * rule falls back to DEFAULT — which is the same literal that lives in the base
 * rule, so there's exactly one default and nothing to drift.
 *
 * Every `cssVar` here is a `--dz-*` knob we introduced: the base CSS rule was
 * edited to read `var(--dz-x, <original literal>)`, so a token's DEFAULT MUST
 * equal that fallback literal (a test enforces it). A token with more than one
 * usage — a base rule plus a mode-specific one, e.g. the ribbon small-button
 * width — just needs its default to match ONE of the fallbacks (the mode it
 * represents).
 *
 * What is deliberately NOT here, and why (all verified against the live app):
 *  - Values set INLINE from a store beat a :root override, so a slider here
 *    would be a dead no-op: --rib-gap / --rib-rowh (ribbon gap/height, own drag
 *    grips), --dock-scale / --chrome-scale, --ddw-* (dropdown widths), and the
 *    whole page geometry (width, margins, script font/line-height — applied
 *    inline from pageLayout; owned by Page Setup, and they reflow pagination).
 *
 * Adding a knob later = one entry here + making its CSS rule read the var, and
 * confirm it actually wins the cascade in the mode you use (a more specific rule
 * can shadow the base one). That's the whole point of this file: it replaces a
 * note-per-formatting-change.
 */

import { useEditorStore } from '../stores/editorStore';

type EditorStoreState = ReturnType<typeof useEditorStore.getState>;

export interface DesignToken {
  /** stable id, also the persisted key in the store's designVars map */
  id: string;
  label: string;
  /** the CSS custom property the stylesheet reads (css-var tokens) */
  cssVar?: string;
  /** OR a binding to an existing store field (store-bound tokens). Used for
   *  chrome dimensions the app already owns (spacing, sizes) so the slider
   *  drives that ONE system instead of a second, losing CSS variable. */
  store?: { get: (s: EditorStoreState) => number; set: (v: number) => void };
  /** '' for unitless (line-height) */
  unit: 'px' | 'in' | 'pt' | '';
  min: number;
  max: number;
  step: number;
  /** built-in value — equals the fallback literal in the base CSS rule */
  def: number;
  /** optional one-line hint shown under the control */
  hint?: string;
  /** v4.71: enumerated tokens (e.g. alignment). The panel renders these as a
   *  segmented row instead of a slider; the numeric `value` is what persists
   *  in designVars, and `css` is what the mirror writes to the custom
   *  property. min/max/step still bound the stored number. */
  choices?: { value: number; label: string; css: string }[];
}

export interface DesignGroup {
  id: string;
  label: string;
  tokens: DesignToken[];
}

export const DESIGN_GROUPS: DesignGroup[] = [
  {
    id: 'editor',
    label: 'Editor Surface',
    tokens: [
      // NB: page geometry — width, margins, script font size & line spacing —
      // is deliberately NOT here. It's owned by Page Setup (applied inline on
      // the page from the pageLayout store) and changing it reflows pagination,
      // so it belongs to that dialog, not a free design slider. Only chrome-ish
      // surface knobs live here.
      { id: 'editorMainPadTop', label: 'Space above first page', cssVar: '--dz-editor-main-pad-top', unit: 'px', min: 0, max: 120, step: 2, def: 30 },
    ],
  },
  {
    id: 'menu',
    label: 'Menu Bar',
    tokens: [
      // The menu BAR height/padding/label size all have compact/comfortable/
      // custom variants (and the custom height is set inline from the drag) —
      // that mode+drag system is their single source, so they live on the bar's
      // own resize handle and the View ▸ menu size, not here. Item spacing is
      // the one dimension applied uniformly (inline gap) in every mode, so it's
      // driven here through that same store field.
      { id: 'menuSpacing', label: 'Item spacing', unit: 'px', min: 0, max: 32, step: 1, def: 0,
        store: { get: (s) => s.chromeGapPx.menu, set: (v) => useEditorStore.getState().setChromeGap('menu', v) } },
      { id: 'menuDropdownMinW', label: 'Dropdown min width', cssVar: '--dz-menu-dd-minw', unit: 'px', min: 160, max: 400, step: 5, def: 260 },
    ],
  },
  {
    id: 'toolbar',
    label: 'Toolbar / Ribbon',
    tokens: [
      // Button width/height scale with the compact/comfortable/custom mode, so
      // they're owned by the toolbar mode + its height drag-bar, not here. These
      // are the leaf properties with a single declaration in every mode:
      { id: 'toolbarSpacing', label: 'Section spacing', unit: 'px', min: 0, max: 32, step: 1, def: 2,
        store: { get: (s) => s.chromeGapPx.toolbar, set: (v) => useEditorStore.getState().setChromeGap('toolbar', v) },
        hint: 'Gap between sections (and between big buttons).' },
      { id: 'ribBtnGap', label: 'Button spacing (in section)', cssVar: '--dz-rib-btn-gap', unit: 'px', min: 0, max: 20, step: 1, def: 1 },
      { id: 'ribRowGap', label: 'Two-row vertical gap', cssVar: '--dz-rib-row-gap', unit: 'px', min: -14, max: 24, step: 1, def: 0,
        hint: 'Negative pulls the two rows of icons together.' },
      { id: 'ribPadTop', label: 'Ribbon top padding', cssVar: '--dz-rib-pad-top', unit: 'px', min: 0, max: 30, step: 1, def: 5 },
      { id: 'ribPadBottom', label: 'Ribbon bottom padding', cssVar: '--dz-rib-pad-bottom', unit: 'px', min: 0, max: 30, step: 1, def: 2 },
      { id: 'toolbarBtnRadius', label: 'Button corner radius', cssVar: '--dz-toolbar-btn-radius', unit: 'px', min: 0, max: 12, step: 1, def: 5 },
      { id: 'toolbarBigIcon', label: 'Big icon size', cssVar: '--dz-toolbar-big-icon', unit: 'px', min: 16, max: 40, step: 1, def: 26 },
      { id: 'toolbarBigLabel', label: 'Big button label font', cssVar: '--dz-toolbar-big-label', unit: 'px', min: 7, max: 16, step: 0.5, def: 10 },
      // v4.71, Derek: the section-title band (.rib-sec-title). The band's
      // height tracks the font (font + 1.5px) so titled and untitled sections
      // keep reserving the identical strip — the v4.5 determinism rule.
      { id: 'ribTitleFont', label: 'Section title font', cssVar: '--dz-rib-title-font', unit: 'px', min: 7, max: 16, step: 0.5, def: 9.5,
        hint: 'The title band grows with the font so rows stay aligned.' },
      { id: 'ribTitleAlign', label: 'Section title alignment', cssVar: '--dz-rib-title-align', unit: '', min: 0, max: 2, step: 1, def: 1,
        choices: [
          { value: 0, label: 'Left', css: 'left' },
          { value: 1, label: 'Center', css: 'center' },
          { value: 2, label: 'Right', css: 'right' },
        ] },
      { id: 'ribTitlePad', label: 'Section title padding', cssVar: '--dz-rib-title-pad', unit: 'px', min: 0, max: 12, step: 1, def: 3,
        hint: 'Room between the title and its buttons.' },
    ],
  },
  {
    id: 'panels',
    label: 'Panels & Windows',
    tokens: [
      // Panel WIDTHS are dragged (local state / resize handle) — that handle is
      // their single source. These are the fixed design details:
      { id: 'dockEdgeW', label: 'Dock edge grip width', cssVar: '--dz-dock-edge-w', unit: 'px', min: 2, max: 16, step: 1, def: 6 },
      { id: 'toolWinRadius', label: 'Tool window radius', cssVar: '--dz-toolwin-radius', unit: 'px', min: 0, max: 20, step: 1, def: 8 },
      // v4.46, Derek: header padding is FOUR per-side knobs now (was one
      // vertical-only toolWinHeaderPad — a saved override migrates into
      // top+bottom in designSlice). The docked strip rides the same vars
      // with its own tighter fallbacks (4/8 vs the frame's 6/10).
      { id: 'toolWinPadTop', label: 'Header padding — top', cssVar: '--dz-toolwin-pad-top', unit: 'px', min: 0, max: 20, step: 1, def: 6 },
      { id: 'toolWinPadBottom', label: 'Header padding — bottom', cssVar: '--dz-toolwin-pad-bottom', unit: 'px', min: 0, max: 20, step: 1, def: 6 },
      { id: 'toolWinPadLeft', label: 'Header padding — left', cssVar: '--dz-toolwin-pad-left', unit: 'px', min: 0, max: 28, step: 1, def: 10 },
      { id: 'toolWinPadRight', label: 'Header padding — right', cssVar: '--dz-toolwin-pad-right', unit: 'px', min: 0, max: 28, step: 1, def: 10 },
      // v4.47, Derek: the air between the window's name and its tabs (the
      // header's 8px column-gap sits on top of this margin).
      { id: 'toolWinTitleGap', label: 'Space after window name', cssVar: '--dz-toolwin-title-gap', unit: 'px', min: 0, max: 40, step: 1, def: 10 },
      { id: 'toolWinTitleFont', label: 'Tool window title font', cssVar: '--dz-toolwin-title-font', unit: 'px', min: 9, max: 20, step: 0.5, def: 12 },
      // v4.45, Derek: header-bar tuning — the bar's control/tab type size and
      // the air between the header and the window's content, every shape.
      { id: 'toolWinBarFont', label: 'Header bar font size', cssVar: '--dz-toolwin-bar-font', unit: 'px', min: 9, max: 18, step: 0.5, def: 12,
        hint: 'Sizes the header bar\u2019s controls (Filter/Sort/View\u2026) and tabs; the title has its own knob.' },
      { id: 'toolWinBodyGap', label: 'Space above window content', cssVar: '--dz-toolwin-body-gap', unit: 'px', min: 0, max: 32, step: 1, def: 0,
        hint: 'Extra space between the header bar and the window\u2019s content \u2014 docked, popped out, and fullscreen alike.' },
    ],
  },
  {
    // v4.26, Derek: "as many formatting options from the character window as
    // possible" — the character tool's dimensions get their own group. The two
    // v4.22/v4.23 knobs moved here from Panels & Windows; their ids and cssVars
    // are persisted keys (designVars / users' saved overrides) and stayed
    // IDENTICAL — only the grouping and label wording changed.
    id: 'characters',
    label: 'Characters',
    tokens: [
      { id: 'charCardRadius', label: 'Card corner radius', cssVar: '--dz-char-card-radius', unit: 'px', min: 0, max: 20, step: 1, def: 6 },
      { id: 'charCardBorder', label: 'Card outline width', cssVar: '--dz-char-card-border', unit: 'px', min: 0, max: 6, step: 1, def: 1 },
      // v4.22, Derek: spacing of the character card header's right-side items
      // (line/scene count, the % ring, the expand button).
      { id: 'charHeaderGap', label: 'Header item spacing', cssVar: '--dz-char-header-gap', unit: 'px', min: 0, max: 32, step: 1, def: 8 },
      // v4.23, Derek: vertical gap between a character card's field rows — dial
      // it down to pack the card into a small window.
      { id: 'charFieldGap', label: 'Field row spacing', cssVar: '--dz-char-field-gap', unit: 'px', min: 0, max: 24, step: 1, def: 8 },
      { id: 'charDetailPad', label: 'Card detail padding', cssVar: '--dz-char-detail-pad', unit: 'px', min: 0, max: 24, step: 1, def: 8,
        hint: 'Around the expanded card body — sides/bottom keep their +2/+4px rhythm.' },
      { id: 'charInputH', label: 'Input field height', cssVar: '--dz-char-input-h', unit: 'px', min: 20, max: 40, step: 1, def: 28,
        hint: 'Each field keeps its own built-in height until this moves; then all match.' },
      // Drives the no-photo slot exactly AND caps the photo max-heights (the
      // stacked-layout photo falls back to its own 360px until the knob moves).
      { id: 'charImageH', label: 'Image slot height', cssVar: '--dz-char-image-h', unit: 'px', min: 60, max: 480, step: 5, def: 200 },
      { id: 'charCardMinW', label: 'Cards view — min card width', cssVar: '--dz-char-card-minw', unit: 'px', min: 240, max: 520, step: 10, def: 320 },
      // v4.50: charCardMinH is BACK (Derek asked for it) — a min-height on the
      // cards-view card in every shape; 0 keeps cards purely content-sized.
      { id: 'charCardMinH', label: 'Cards view — min card height', cssVar: '--dz-char-card-minh', unit: 'px', min: 0, max: 800, step: 10, def: 0 },
      { id: 'charDescLines', label: 'Cards view — description lines', cssVar: '--dz-char-desc-lines', unit: '', min: 1, max: 6, step: 1, def: 2,
        hint: 'Lines the description shows before clamping; clicking in still lifts it.' },
      // Store-bound (menuSpacing precedent): the size the Characters window
      // opens at, riding the SAME toolSizes entry the window's own resize drag
      // persists — one system, no second source. 420×360 mirrors ALL_TOOLS'
      // defaultSize for 'characters' (a test greps ToolDock.tsx to keep them
      // equal). Setting one dimension carries the other over unchanged.
      { id: 'charWinW', label: 'Window default width', unit: 'px', min: 280, max: 900, step: 10, def: 420,
        hint: 'Dragging the window edge updates this too.',
        store: { get: (s) => s.toolSizes.characters?.w ?? 420,
                 set: (v) => { const st = useEditorStore.getState(); st.setToolSize('characters', v, st.toolSizes.characters?.h ?? 360); } } },
      { id: 'charWinH', label: 'Window default height', unit: 'px', min: 240, max: 800, step: 10, def: 360,
        store: { get: (s) => s.toolSizes.characters?.h ?? 360,
                 set: (v) => { const st = useEditorStore.getState(); st.setToolSize('characters', st.toolSizes.characters?.w ?? 420, v); } } },
    ],
  },
  {
    id: 'cards',
    label: 'Notes & To-Do Cards',
    tokens: [
      { id: 'cardPad', label: 'Card padding', cssVar: '--dz-swn-card-pad', unit: 'px', min: 2, max: 20, step: 1, def: 8 },
      { id: 'cardRadius', label: 'Card corner radius', cssVar: '--dz-swn-card-radius', unit: 'px', min: 0, max: 16, step: 1, def: 4 },
      { id: 'cardFont', label: 'Card body font', cssVar: '--dz-swn-card-font', unit: 'px', min: 9, max: 18, step: 0.5, def: 12 },
      { id: 'cardHeadFont', label: 'Card title font', cssVar: '--dz-swn-card-head-font', unit: 'px', min: 9, max: 16, step: 0.5, def: 11 },
      { id: 'cardDot', label: 'Color dot size', cssVar: '--dz-swn-dot', unit: 'px', min: 6, max: 20, step: 1, def: 12 },
      { id: 'snippetFont', label: 'Snippet (code) font', cssVar: '--dz-swn-snippet-font', unit: 'px', min: 8, max: 18, step: 0.5, def: 11 },
      { id: 'genNoteTitleFont', label: 'Script-note title font', cssVar: '--dz-gen-note-title-font', unit: 'px', min: 9, max: 20, step: 0.5, def: 13 },
    ],
  },
  {
    id: 'scrapbook',
    label: 'Scrapbook',
    tokens: [
      { id: 'nbFont', label: 'Scrapbook base font', cssVar: '--dz-nb-font', unit: 'px', min: 10, max: 18, step: 0.5, def: 13 },
      { id: 'nbCellPadX', label: 'Table cell padding — horizontal', cssVar: '--dz-nb-cell-padx', unit: 'px', min: 2, max: 16, step: 1, def: 7 },
      { id: 'nbCellPadY', label: 'Table cell padding — vertical', cssVar: '--dz-nb-cell-pady', unit: 'px', min: 1, max: 14, step: 1, def: 5 },
      { id: 'nbCellFont', label: 'Table cell font', cssVar: '--dz-nb-cell-font', unit: 'px', min: 9, max: 18, step: 0.5, def: 12.5 },
      { id: 'nbTitleFont', label: 'Page title font', cssVar: '--dz-nb-title-font', unit: 'px', min: 12, max: 40, step: 1, def: 20 },
      { id: 'nbSideHeadFont', label: 'Sidebar heading font', cssVar: '--dz-nb-sidehead-font', unit: 'px', min: 8, max: 18, step: 0.5, def: 11 },
    ],
  },
  {
    id: 'dialogs',
    label: 'Dialogs',
    tokens: [
      { id: 'dialogRadius', label: 'Dialog corner radius', cssVar: '--dz-dialog-radius', unit: 'px', min: 0, max: 20, step: 1, def: 8 },
      { id: 'dialogHeaderPadY', label: 'Header padding', cssVar: '--dz-dialog-header-pady', unit: 'px', min: 4, max: 28, step: 1, def: 14 },
      { id: 'dialogHeaderFont', label: 'Header font size', cssVar: '--dz-dialog-header-font', unit: 'px', min: 12, max: 24, step: 0.5, def: 16 },
      { id: 'dialogBodyPad', label: 'Body padding', cssVar: '--dz-dialog-body-pad', unit: 'px', min: 4, max: 40, step: 1, def: 20 },
      { id: 'dialogBtnHeight', label: 'Button height', cssVar: '--dz-dialog-btn-h', unit: 'px', min: 24, max: 48, step: 1, def: 34 },
      { id: 'dialogBtnRadius', label: 'Button corner radius', cssVar: '--dz-dialog-btn-radius', unit: 'px', min: 0, max: 16, step: 1, def: 4 },
      { id: 'dialogLabelFont', label: 'Field label font', cssVar: '--dz-dialog-label-font', unit: 'px', min: 10, max: 20, step: 0.5, def: 14 },
      { id: 'dialogInputH', label: 'Input height', cssVar: '--dz-dialog-input-h', unit: 'px', min: 24, max: 48, step: 1, def: 36 },
    ],
  },
  {
    id: 'beatboard',
    label: 'Beatboard & Index Cards',
    tokens: [
      { id: 'beatColGap', label: 'Column gap', cssVar: '--dz-beat-col-gap', unit: 'px', min: 0, max: 40, step: 1, def: 16 },
      { id: 'beatColMinW', label: 'Column min width', cssVar: '--dz-beat-col-minw', unit: 'px', min: 180, max: 400, step: 5, def: 280 },
      { id: 'beatCardRadius', label: 'Beat card radius', cssVar: '--dz-beat-card-radius', unit: 'px', min: 0, max: 16, step: 1, def: 6 },
      { id: 'beatCardPad', label: 'Beat card padding', cssVar: '--dz-beat-card-pad', unit: 'px', min: 2, max: 24, step: 1, def: 10 },
      { id: 'icRadius', label: 'Index card radius', cssVar: '--dz-ic-radius', unit: 'px', min: 0, max: 16, step: 1, def: 6 },
      { id: 'icHeadingFont', label: 'Index card heading font', cssVar: '--dz-ic-heading-font', unit: 'px', min: 9, max: 18, step: 0.5, def: 12 },
      { id: 'icBadge', label: 'Index card badge size', cssVar: '--dz-ic-badge', unit: 'px', min: 14, max: 36, step: 1, def: 24 },
      { id: 'beatColHeadPad', label: 'Column header padding', cssVar: '--dz-beat-col-head-pad', unit: 'px', min: 2, max: 20, step: 1, def: 8 },
    ],
  },
  {
    id: 'navigator',
    label: 'Navigator & Outline',
    tokens: [
      { id: 'navTitleFont', label: 'Panel title font', cssVar: '--dz-nav-title-font', unit: 'px', min: 10, max: 20, step: 0.5, def: 13 },
      { id: 'navScenePadY', label: 'Scene row padding', cssVar: '--dz-nav-scene-pady', unit: 'px', min: 2, max: 24, step: 1, def: 10 },
      { id: 'navSceneFont', label: 'Scene heading font', cssVar: '--dz-nav-scene-font', unit: 'px', min: 10, max: 20, step: 0.5, def: 14 },
      { id: 'navSynopsisFont', label: 'Scene synopsis font', cssVar: '--dz-nav-synopsis-font', unit: 'px', min: 8, max: 18, step: 0.5, def: 11 },
      { id: 'navBadge', label: 'Scene number badge size', cssVar: '--dz-nav-badge', unit: 'px', min: 14, max: 32, step: 1, def: 22 },
      { id: 'obPad', label: 'Outline bar padding', cssVar: '--dz-ob-pad', unit: 'px', min: 0, max: 16, step: 1, def: 4 },
      { id: 'obTitleFont', label: 'Outline title font', cssVar: '--dz-ob-title-font', unit: 'px', min: 8, max: 16, step: 0.5, def: 11 },
      { id: 'obIconBtn', label: 'Outline icon button size', cssVar: '--dz-ob-iconbtn', unit: 'px', min: 18, max: 36, step: 1, def: 26 },
    ],
  },
  {
    id: 'behavior',
    label: 'Behavior',
    tokens: [
      { id: 'mapScrollSpeed', label: 'Relationship map scroll speed', unit: '', min: 0.1, max: 3, step: 0.1, def: 1,
        hint: 'Lower = slower scroll-to-zoom in the character relationship map.',
        store: { get: (s) => s.mapScrollSpeed, set: (v) => useEditorStore.getState().setMapScrollSpeed(v) } },
    ],
  },
];

/** Flat list, handy for lookups and apply. */
export const DESIGN_TOKENS: DesignToken[] = DESIGN_GROUPS.flatMap((g) => g.tokens);

const BY_ID: Record<string, DesignToken> = Object.fromEntries(DESIGN_TOKENS.map((t) => [t.id, t]));

export function designToken(id: string): DesignToken | undefined {
  return BY_ID[id];
}

/** Format a numeric value with its unit for a CSS declaration. Choice tokens
 *  emit the selected option's css keyword (falling back to the default's). */
export function formatTokenValue(t: DesignToken, val: number): string {
  if (t.choices) {
    return (t.choices.find((c) => c.value === val) ??
      t.choices.find((c) => c.value === t.def) ?? t.choices[0]).css;
  }
  return `${val}${t.unit}`;
}

/**
 * Mirror the current overrides onto :root. For every KNOWN token: an override
 * sets its property, and absence removes it (so the CSS fallback — the built-in
 * default — takes over). Unknown keys are ignored so a stale persisted value
 * from a renamed token can't leak onto the DOM.
 */
export function applyDesignVars(vars: Record<string, number>): void {
  const root = document.documentElement;
  for (const t of DESIGN_TOKENS) {
    if (!t.cssVar) continue; // store-bound tokens drive the store, not :root
    const v = vars[t.id];
    if (v === undefined || v === null || Number.isNaN(v)) {
      root.style.removeProperty(t.cssVar);
    } else {
      root.style.setProperty(t.cssVar, formatTokenValue(t, v));
    }
  }
}

/**
 * Build a copy-pasteable CSS block of just the OVERRIDDEN tokens, so a chosen
 * look can be baked into the stylesheet permanently instead of living in
 * localStorage. Returns '' when nothing is overridden.
 */
export function buildOverrideCss(vars: Record<string, number>): string {
  const lines = DESIGN_TOKENS
    .filter((t) => t.cssVar && vars[t.id] !== undefined && vars[t.id] !== t.def)
    .map((t) => `  ${t.cssVar}: ${formatTokenValue(t, vars[t.id])};`);
  if (!lines.length) return '';
  return `:root {\n${lines.join('\n')}\n}`;
}
