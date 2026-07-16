/**
 * Built-in toolbar item registry (v0.42).
 *
 * Every built-in toolbar control is an individually placeable item — the old
 * fixed groups (`g:` tokens) and the per-item deactivation checkboxes
 * (`toolbarHiddenItems`, a ScriptCraft v5.5 holdover) are gone. Zones hold flat
 * token lists:
 *   b:<key>       built-in item (this registry)
 *   t:<toolId>    pinned tool/window button
 *   c:<commandId> pinned command button
 *   d:<n>         user divider
 *
 * `normalizeToolbarZones` migrates persisted zones from the legacy scheme:
 * each `g:` token expands to its items (minus any the old checkboxes had
 * deactivated), so existing layouts survive the upgrade unchanged.
 *
 * This module is intentionally dependency-free — it is imported by the
 * store, the Toolbar, and the Customize dialog.
 */

export interface ToolbarBuiltin {
  key: string;
  label: string;
  /** Responsive collapse priority ('1' collapses first … '5' last). Items
   *  without a priority never collapse into the overflow menu. */
  priority?: string;
  /** Hidden on mobile via .toolbar-desktop-only. */
  desktopOnly?: boolean;
  /** Hidden on mobile via .zoom-group (mobile shows the single Zoom button). */
  zoom?: boolean;
  /** Permanent (v0.74): can be REORDERED and moved between zones, but never
   *  hidden or removed. normalizeToolbarZones re-inserts it if a persisted
   *  layout is missing it, so it can't be lost. */
  permanent?: boolean;
  /** Which zone a re-inserted permanent item lands in (default 'left').
   *  v2.02: Customize belongs to the Big Button section (the right zone). */
  permanentZone?: 'left' | 'right';
  /** v2.02: this item may live in the Big Button section. Everything else is
   *  a formatting control that has no big-button shape — Customize's Toolbar
   *  tab refuses to drop it there. Tools (t:) and commands (c:) always may. */
  bigOk?: boolean;
}

export const TOOLBAR_BUILTINS: ToolbarBuiltin[] = [
  { key: 'undo', label: 'Undo' },
  { key: 'redo', label: 'Redo' },
  { key: 'element', label: 'Element' },
  { key: 'insertSection', label: 'Insert Section' },
  { key: 'insertNote', label: 'Insert Note' },
  { key: 'insertChecklist', label: 'Add To-Do List' },
  { key: 'titlePage', label: 'Title Page' },
  { key: 'fontFamily', label: 'Font Family', priority: '5', desktopOnly: true },
  { key: 'fontSize', label: 'Font Size', priority: '5', desktopOnly: true },
  { key: 'bold', label: 'Bold', priority: '4', desktopOnly: true },
  { key: 'italic', label: 'Italic', priority: '4', desktopOnly: true },
  { key: 'underline', label: 'Underline', priority: '4', desktopOnly: true },
  { key: 'strike', label: 'Strikethrough', priority: '4', desktopOnly: true },
  { key: 'subscript', label: 'Subscript', priority: '4', desktopOnly: true },
  { key: 'superscript', label: 'Superscript', priority: '4', desktopOnly: true },
  { key: 'textColor', label: 'Text Color', priority: '4', desktopOnly: true },
  { key: 'highlightColor', label: 'Highlight Color', priority: '4', desktopOnly: true },
  { key: 'alignLeft', label: 'Align Left', priority: '3', desktopOnly: true },
  { key: 'alignCenter', label: 'Align Center', priority: '3', desktopOnly: true },
  { key: 'alignRight', label: 'Align Right', priority: '3', desktopOnly: true },
  { key: 'alignJustify', label: 'Justify', priority: '3', desktopOnly: true },
  { key: 'find', label: 'Find & Replace', priority: '2' },
  { key: 'goto', label: 'Go to Page', priority: '2' },
  { key: 'scriptNotes', label: 'Notes' },
  { key: 'tags', label: 'Production Tags' },
  { key: 'zoom', label: 'Zoom', priority: '1', zoom: true },
  { key: 'view', label: 'Editor View', desktopOnly: true },
  // v2.34, Derek: one-click surface toggles.
  { key: 'togglePanelLeft', label: 'Left Panel' },
  { key: 'togglePanelRight', label: 'Right Panel' },
  { key: 'toggleOutlineBar', label: 'Outline Bar' },
  // v2.02: Customize is a toolbar ITEM again — the anchor of the Big Button
  // section (the old right zone, reborn). Permanent: reorderable within the
  // section, never hidden or lost.
  { key: 'customize', label: 'Customize', permanent: true, permanentZone: 'right', bigOk: true },
];

export const BUILTIN_BY_KEY: Record<string, ToolbarBuiltin> = Object.fromEntries(
  TOOLBAR_BUILTINS.map((b) => [b.key, b]),
);

// scriptNotes and tags are NOT in the default — they add from the dropdown's
// Tools and Production groups (legacy g:notes migration still preserves them
// in layouts that already had them).
// v2.02: the zones are MAIN (left-aligned controls) and BIG BUTTON (large
// Customize-style launchers). Zoom and Editor View moved into Main — they're
// controls, not launchers; the default Big Button section is just Customize.
// v2.14: the group separators are REAL divider tokens now — they show up in
// Customize > Toolbar like any user divider, movable and removable. (The old
// sepAfter flags rendered ghosts Customize couldn't see.)
export const DEFAULT_TOOLBAR_LEFT: string[] = [
  'b:undo', 'b:redo', 'd:def-history',
  'b:element', 'b:insertSection', 'b:insertNote', 'b:insertChecklist',
  'b:fontFamily', 'b:fontSize', 'd:def-font',
  'b:bold', 'b:italic', 'b:underline', 'b:strike',
  'b:subscript', 'b:superscript', 'd:def-style',
  'b:textColor', 'b:highlightColor', 'd:def-color',
  'b:alignLeft', 'b:alignCenter', 'b:alignRight', 'b:alignJustify', 'd:def-align',
  'b:find', 'b:goto', 'd:def-nav',
  'b:zoom', 'b:view', 'd:def-surfaces',
  'b:togglePanelLeft', 'b:togglePanelRight', 'b:toggleOutlineBar',
];

/** v2.34 one-time: existing saved layouts get the three surface toggles
 *  appended to Main (new installs have them via the default above). */
export function migratePanelToggles(left: string[]): string[] {
  const toggles = ['b:togglePanelLeft', 'b:togglePanelRight', 'b:toggleOutlineBar'];
  if (toggles.some((t) => left.includes(t))) return left;
  return [...left, 'd:def-surfaces', ...toggles];
}

export const DEFAULT_TOOLBAR_RIGHT: string[] = ['customize'].map((k) => `b:${k}`);

/** May this token live in the Big Button section? */
export function bigZoneAllowed(tok: string): boolean {
  if (tok.startsWith('t:') || tok.startsWith('c:')) return true;
  if (tok.startsWith('b:')) return !!BUILTIN_BY_KEY[tok.slice(2)]?.bigOk;
  return false;   // dividers/spacers stay in Main
}

/** v2.14 one-time: sepAfter separators became real d: tokens. A saved
 *  layout gets a divider inserted after each item that used to carry one
 *  (Main zone only — the Big Button section never had separators), so the
 *  toolbar looks identical before and after, just editable now. */
const LEGACY_SEP_KEYS = ['redo', 'titlePage', 'fontSize', 'superscript', 'highlightColor', 'alignJustify', 'goto'];
export function migrateSepDividers(left: string[]): string[] {
  const out: string[] = [];
  for (const tok of left) {
    out.push(tok);
    const key = tok.startsWith('b:') ? tok.slice(2) : '';
    if (LEGACY_SEP_KEYS.includes(key)) out.push(`d:sep-${key}`);
  }
  return out;
}

/** v2.02 one-time shape change: the right zone stopped being "more small
 *  buttons at the far edge" and became the Big Button section. Whatever a
 *  saved layout had on the right moves to the end of Main so nothing
 *  silently changes shape; Customize is (re)seeded into the section. */
export function migrateToolbarBigZone(
  left: string[], right: string[],
): { left: string[]; right: string[] } {
  const stay = right.filter(bigZoneAllowed);
  const moved = right.filter((t) => !bigZoneAllowed(t));
  return { left: [...left, ...moved], right: stay };
}

/** Legacy `g:` group → item keys, in group order. */
const LEGACY_GROUP_ITEMS: Record<string, string[]> = {
  history: ['undo', 'redo'],
  element: ['element'],
  insert: ['insertSection', 'insertNote', 'insertChecklist'],
  font: ['fontFamily', 'fontSize'],
  style: ['bold', 'italic', 'underline', 'strike', 'subscript', 'superscript', 'textColor', 'highlightColor'],
  align: ['alignLeft', 'alignCenter', 'alignRight', 'alignJustify'],
  nav: ['find', 'goto'],
  notes: ['scriptNotes', 'tags'],
  zoom: ['zoom'],
  view: ['view'],
};

/**
 * Expand legacy tokens to the flat per-item scheme. `hidden` is the retired
 * `toolbarHiddenItems` list (display labels): items the old checkboxes had
 * deactivated are simply not re-added. Already-flat zones pass through
 * untouched (idempotent), with duplicate built-ins deduped first-wins.
 */
export function normalizeToolbarZones(
  left: string[] | undefined,
  right: string[] | undefined,
  hidden: string[] = [],
): { left: string[]; right: string[] } {
  const hiddenKeys = new Set(
    TOOLBAR_BUILTINS.filter((b) => hidden.includes(b.label)).map((b) => b.key),
  );
  const seen = new Set<string>();
  const expand = (tokens: string[] | undefined): string[] => {
    const out: string[] = [];
    for (const tok of tokens ?? []) {
      if (tok.startsWith('g:')) {
        for (const key of LEGACY_GROUP_ITEMS[tok.slice(2)] ?? []) {
          if (hiddenKeys.has(key) || seen.has(key)) continue;
          seen.add(key);
          out.push(`b:${key}`);
        }
      } else if (tok.startsWith('b:')) {
        // v0.75: the separate Zoom In / Zoom Out buttons became one Zoom
        // dropdown. Fold both legacy tokens into it (deduped by `seen`).
        const key = (tok === 'b:zoomIn' || tok === 'b:zoomOut') ? 'zoom' : tok.slice(2);
        if (!BUILTIN_BY_KEY[key] || seen.has(key)) continue;
        seen.add(key);
        out.push(`b:${key}`);
      } else {
        out.push(tok); // t: / c: / d:
      }
    }
    return out;
  };
  const l = expand(left);
  const r = expand(right);
  // Permanent items can be reordered or moved between zones, but never lost.
  // A layout saved before this item existed (or one that somehow dropped it)
  // gets it appended to its home zone rather than silently missing the button.
  for (const b of TOOLBAR_BUILTINS) {
    if (!b.permanent) continue;
    const tok = `b:${b.key}`;
    if (!l.includes(tok) && !r.includes(tok)) {
      (b.permanentZone === 'right' ? r : l).push(tok);
    }
  }
  return { left: l, right: r };
}
