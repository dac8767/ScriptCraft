/**
 * Built-in toolbar item registry (v0.42).
 *
 * Every built-in toolbar control is an individually placeable item — the old
 * fixed groups (`g:` tokens) and the per-item deactivation checkboxes
 * (`toolbarHiddenItems`, a FreeDraft v5.5 holdover) are gone. Zones hold flat
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
  /** Render a trailing separator inside the item's own block (it hides and
   *  moves with the item). Reproduces the old group boundaries by default. */
  sepAfter?: boolean;
  /** Permanent (v0.74): can be REORDERED and moved between zones, but never
   *  hidden or removed. normalizeToolbarZones re-inserts it if a persisted
   *  layout is missing it, so it can't be lost. */
  permanent?: boolean;
}

export const TOOLBAR_BUILTINS: ToolbarBuiltin[] = [
  { key: 'undo', label: 'Undo' },
  { key: 'redo', label: 'Redo', sepAfter: true },
  { key: 'element', label: 'Element' },
  { key: 'insertSection', label: 'Insert Section' },
  { key: 'insertNote', label: 'Insert Script Note' },
  { key: 'insertChecklist', label: 'Insert Checklist Item' },
  { key: 'titlePage', label: 'Title Page', sepAfter: true },
  { key: 'fontFamily', label: 'Font Family', priority: '5', desktopOnly: true },
  { key: 'fontSize', label: 'Font Size', priority: '5', desktopOnly: true, sepAfter: true },
  { key: 'bold', label: 'Bold', priority: '4', desktopOnly: true },
  { key: 'italic', label: 'Italic', priority: '4', desktopOnly: true },
  { key: 'underline', label: 'Underline', priority: '4', desktopOnly: true },
  { key: 'strike', label: 'Strikethrough', priority: '4', desktopOnly: true },
  { key: 'subscript', label: 'Subscript', priority: '4', desktopOnly: true },
  { key: 'superscript', label: 'Superscript', priority: '4', desktopOnly: true, sepAfter: true },
  { key: 'textColor', label: 'Text Color', priority: '4', desktopOnly: true },
  { key: 'highlightColor', label: 'Highlight Color', priority: '4', desktopOnly: true, sepAfter: true },
  { key: 'alignLeft', label: 'Align Left', priority: '3', desktopOnly: true },
  { key: 'alignCenter', label: 'Align Center', priority: '3', desktopOnly: true },
  { key: 'alignRight', label: 'Align Right', priority: '3', desktopOnly: true },
  { key: 'alignJustify', label: 'Justify', priority: '3', desktopOnly: true, sepAfter: true },
  { key: 'find', label: 'Find & Replace', priority: '2' },
  { key: 'goto', label: 'Go to Page', priority: '2', sepAfter: true },
  { key: 'scriptNotes', label: 'Script Notes' },
  { key: 'tags', label: 'Production Tags' },
  { key: 'zoom', label: 'Zoom', priority: '1', zoom: true },
  { key: 'view', label: 'Editor View', desktopOnly: true },
];

export const BUILTIN_BY_KEY: Record<string, ToolbarBuiltin> = Object.fromEntries(
  TOOLBAR_BUILTINS.map((b) => [b.key, b]),
);

// scriptNotes and tags are NOT in the default — they add from the dropdown's
// Tools and Production groups (legacy g:notes migration still preserves them
// in layouts that already had them).
// v0.91: 'customize' is gone from here. It's now permanent chrome to the right of
// BOTH bars, not a toolbar button — so it can't be reordered, hidden, or moved
// into a zone. normalizeToolbarZones drops unknown `b:` keys, which means a saved
// layout still holding `b:customize` cleans itself up on load; no migration needed.
export const DEFAULT_TOOLBAR_LEFT: string[] = [
  'undo', 'redo', 'element', 'insertSection', 'insertNote', 'insertChecklist',
  'fontFamily', 'fontSize', 'bold', 'italic', 'underline', 'strike',
  'subscript', 'superscript', 'textColor', 'highlightColor',
  'alignLeft', 'alignCenter', 'alignRight', 'alignJustify',
  'find', 'goto',
].map((k) => `b:${k}`);

export const DEFAULT_TOOLBAR_RIGHT: string[] = ['zoom', 'view'].map((k) => `b:${k}`);

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
  // gets it appended to the left zone rather than silently missing the button.
  for (const b of TOOLBAR_BUILTINS) {
    if (!b.permanent) continue;
    const tok = `b:${b.key}`;
    if (!l.includes(tok) && !r.includes(tok)) l.push(tok);
  }
  return { left: l, right: r };
}
