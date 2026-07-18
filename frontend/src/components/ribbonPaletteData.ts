/**
 * ribbonPaletteData (v3.37, Derek) — the categorized list of ITEMS that can be
 * added to the ribbon (buttons, dropdowns, tool launchers, menu commands).
 *
 * ONE source, used by both the Customize > Toolbar window and the on-bar
 * "+ Add" picker, so the two can never drift. `placed` filters out whatever
 * is already on the bar. Mirrors the menu-bar taxonomy (Toolbar / Edit /
 * Insert / View / Tools / Project); the culls from v3.19/v3.25/v3.30 stay.
 */
import { BUILTIN_BY_KEY } from './toolbarBuiltins';
import { TOOLBAR_COMMANDS } from './toolbarCommands';
import { ALL_TOOLS, WINDOW_IDS } from './ToolDock';

export interface PaletteCategory {
  id: string;
  label: string;
  options: Array<{ value: string; label: string }>;
}

const PRODUCTION_CMDS = ['titlePage', 'setDraft', 'addSceneNumbers', 'removeSceneNumbers', 'lockSceneNumbers', 'revisionMode'];
const TOOLS_CMDS = ['spellCheck', 'writingSuggestions', 'takeSnapshot', 'snapshots', 'trackChanges', 'compareSnapshot'];
const PROJECT_CMDS = ['rename'];
const EDIT_CMDS = ['cut', 'copy', 'paste', 'lastEditLocation'];
const INSERT_CMDS = ['insertImage', 'insertMarker'];
const VIEW_CMDS = ['fitPage', 'fitWidth', 'actualSize', 'showRulers', 'toggleLeftPanel', 'toggleRightPanel'];

const cmdOpt = (id: string) => {
  const c = TOOLBAR_COMMANDS.find((x) => x.id === id);
  return c ? [{ value: `c:${c.id}`, label: c.label }] : [];
};
const toolOpt = (id: string) => {
  const t = ALL_TOOLS.find((x) => x.id === id);
  return t ? [{ value: `t:${t.id}`, label: t.label }] : [];
};

/** Build the add-item categories, hiding anything `placed` reports as already
 *  on the bar. Empty categories drop out. */
export function buildRibbonPalette(placed: (v: string) => boolean): PaletteCategory[] {
  return ([
    {
      id: 'toolbar', label: 'Toolbar',
      options: Object.values(BUILTIN_BY_KEY)
        .filter((b) => b.key !== 'tags' && b.key !== 'scriptNotes' && !b.permanent && !b.unlisted)
        .map((b) => ({ value: `b:${b.key}`, label: b.label })),
    },
    { id: 'edit', label: 'Edit', options: EDIT_CMDS.flatMap(cmdOpt) },
    {
      id: 'insert', label: 'Insert',
      options: [...INSERT_CMDS.flatMap(cmdOpt), { value: 'b:tags', label: 'Production Tags' }],
    },
    { id: 'view', label: 'View', options: VIEW_CMDS.flatMap(cmdOpt) },
    {
      id: 'tools', label: 'Tools',
      options: [
        ...ALL_TOOLS.filter((t) => !WINDOW_IDS.includes(t.id) && t.id !== 'tags').flatMap((t) => toolOpt(t.id)),
        { value: 'b:scriptNotes', label: 'Notes' },
        ...TOOLS_CMDS.flatMap(cmdOpt),
      ],
    },
    {
      id: 'project', label: 'Project',
      options: [
        ...ALL_TOOLS.filter((t) => WINDOW_IDS.includes(t.id)).flatMap((t) => toolOpt(t.id)),
        ...PROJECT_CMDS.flatMap(cmdOpt),
        ...PRODUCTION_CMDS.flatMap(cmdOpt),
      ],
    },
  ] as PaletteCategory[])
    // v3.52, Derek: ONE entry per label across the whole palette. The same
    // feature can exist as a builtin, a command AND a tool (Title Page was all
    // three), so the list showed it repeatedly. Keep the first occurrence in
    // category order (builtins win) and drop the rest — no duplicates.
    .reduce<{ cats: PaletteCategory[]; seen: Set<string> }>(
      (acc, cat) => {
        const options = cat.options.filter((o) => {
          const key = o.label.trim().toLowerCase();
          if (acc.seen.has(key)) return false;
          acc.seen.add(key);
          return true;
        });
        acc.cats.push({ ...cat, options });
        return acc;
      },
      { cats: [], seen: new Set() },
    ).cats
    .map((cat) => ({ ...cat, options: cat.options.filter((o) => !placed(o.value)) }))
    .filter((cat) => cat.options.length > 0);
}
