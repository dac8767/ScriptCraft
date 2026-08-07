// build-helper-catalog.mjs (v6.20, context in v6.22) — regenerate
// src/data/helperTextCatalog.json and src/data/helperTextIcons.ts.
//
// The CODE is the source of truth for helper text; this scan is how the
// Helper Text window knows what exists. Rerun after adding/renaming helper
// strings:   node devtools/build-helper-catalog.mjs
// check-helper-catalog.mjs fails the suite when the committed files drift.
//
// What counts as helper text (Derek's list): hover tooltips (title=), field
// ghost text (placeholder=), and content hints registered through ht('…') —
// empty-list texts, ? popover bodies, the element placeholder map. Labels,
// menu items and button captions are UI text, not helper text, and stay out.
//
// v6.22, Derek: each row must show WHICH control it belongs to — so every
// tooltip site also captures the control's ICON component (<Fa…/>/<Lu…/>,
// the two packs this app uses) and/or its visible TEXT child, read from the
// JSX right after the attribute. Icons resolve at runtime through the
// GENERATED src/data/helperTextIcons.ts (importing exactly the icons the
// catalog names keeps tree-shaking honest).
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'src');
export const CATALOG_PATH = join(ROOT, 'data', 'helperTextCatalog.json');
export const ICONS_PATH = join(ROOT, 'data', 'helperTextIcons.ts');

const TITLE_RE = /\btitle="([^"]+)"/g;
const PLACEHOLDER_RE = /\bplaceholder="([^"]+)"/g;
// ht('…') and useHt()('…') direct-content reads; both quote styles.
const HT_RE = /\bht\(\s*(?:'((?:[^'\\]|\\.)+)'|"((?:[^"\\]|\\.)+)")\s*[),]/g;

// The terminator ([\s/>]) is REQUIRED — a bare \b also matches the end of
// the sliced window, which once minted truncated names (FaDotCi, FaR).
/* v6.24, Derek: "organize the helper text tool items by where they are
   found: ribbon toolbar, menu, side panel, quick access toolbar, etc" —
   every entry carries an `area` derived from its source file. First match
   wins; unmatched files land in "Everything Else" (visible, not silent —
   map them when they matter). */
export const AREA_RULES = [
  [/Toolbar\.tsx$/, 'Ribbon Toolbar'],
  [/TitleBar\.tsx$/, 'Quick Access Toolbar'],
  [/MenuBar\.tsx$/, 'Menus'],
  [/ScriptContextMenu\.tsx$/, 'Context Menu'],
  [/StatusBar\.tsx$/, 'Status Bar'],
  [/(ToolDock|ToolControls|EdgeResize)\.tsx$/, 'Side Panel & Window Chrome'],
  [/NavigatorTool\.tsx$/, 'Navigator Window'],
  [/(SceneNavigator|SceneCard|scene)/i, 'Scenes / Pages / Locations Windows'],
  [/Location/, 'Scenes / Pages / Locations Windows'],
  [/(CharacterProfiles|CharacterRelationship|char)/i, 'Characters Window'],
  [/(StickyNotes|StickyCard|ScriptNotes)/, 'Notes & Snippets Windows'],
  [/(MarkupsPanel|markupIcons|MarkupsCustomizeTab|MarkupIconLayer)/, 'Annotations Window'],
  [/BeatBoard/, 'Outline Window'],
  [/GoalsTool/, 'Goals Window'],
  [/TypewriterTool/, 'Focus Window'],
  [/(AnalyticsTool|GenderAnalysisTool|ScriptStatistics)/, 'Analytics Window'],
  [/ThesaurusTool/, 'Thesaurus Window'],
  [/NotebookTool/, 'Scrapbook Window'],
  [/RewriteTool/, 'Action Rewrite Window'],
  [/TagsPanel/, 'Production Tags Window'],
  [/(SpellCheckPanel|Spell)/i, 'Spelling & Grammar'],
  [/(DesignPanel|HelperText)/, 'Design & Helper Text'],
  [/(WorkspacesTool|workspace)/i, 'Workspaces'],
  [/FeedbackTool/, 'Feedback Window'],
  [/(CustomizePanelsDialog|customizeResets|ContextMenuTab|AddMenu)/, 'Customize Window'],
  [/(PreferencesDialog|SettingsPage|PageSetupDialog|GuidedSetup)/, 'Settings & Setup'],
  [/(Dialog|Modal)/, 'Dialogs'],
  [/(ScreenplayEditor|editor\/|TitlePageEditor|PreviewSidebar)/, 'Editor & Preview'],
];
export const FALLBACK_AREA = 'Everything Else';
const areaFor = (rel) => (AREA_RULES.find(([re]) => re.test(rel)) ?? [null, FALLBACK_AREA])[1];

const ICON_RE = /<((?:Fa|Lu)[A-Z]\w*)[\s/>]/;
const TEXT_CHILD_RE = />\s*([A-Za-z][^<>{}|]{0,40}?)\s*</;

/** Icon component + visible text near a tooltip site — the control's face. */
function contextAfter(src, idx) {
  const win = src.slice(idx, idx + 300);
  const icon = ICON_RE.exec(win)?.[1];
  const text = TEXT_CHILD_RE.exec(win)?.[1]?.trim();
  return { icon, label: text && /[a-zA-Z]/.test(text) ? text : undefined };
}

/** Scan src/ and return the catalog array (what the JSON file holds). */
export function buildCatalog() {
  const files = [];
  (function walk(dir) {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      if (!/\.(tsx?|ts)$/.test(name)) continue;
      if (/\.test\.tsx?$/.test(name) || name.endsWith('.d.ts')) continue;
      files.push(p);
    }
  })(ROOT);

  /** entries: text -> { kinds, files, n, icon?, label? } */
  const entries = new Map();
  const add = (text, kind, file, ctx = {}) => {
    if (!text || !text.trim()) return;
    if (!/[a-zA-Z]/.test(text)) return;            // pure glyphs aren't editable text
    const rel = relative(ROOT, file);
    const e = entries.get(text) ?? { kinds: new Set(), files: new Set(), n: 0 };
    e.kinds.add(kind); e.files.add(rel); e.n++;
    if (!e.area) e.area = areaFor(rel);
    if (!e.icon && ctx.icon) e.icon = ctx.icon;
    if (!e.label && ctx.label) e.label = ctx.label;
    entries.set(text, e);
  };

  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(TITLE_RE)) add(m[1], 'tooltip', f, contextAfter(src, m.index + m[0].length));
    for (const m of src.matchAll(PLACEHOLDER_RE)) add(m[1], 'placeholder', f);
    for (const m of src.matchAll(HT_RE)) add((m[1] ?? m[2]).replace(/\\(['"])/g, '$1'), 'hint', f);
  }

  const KIND_ORDER = { tooltip: 0, placeholder: 1, hint: 2 };
  return [...entries.entries()]
    .map(([text, e]) => ({
      text,
      kind: [...e.kinds].sort((a, b) => KIND_ORDER[a] - KIND_ORDER[b])[0],
      sites: e.n,
      area: e.area,
      where: [...e.files].sort().slice(0, 6),
      ...(e.icon ? { icon: e.icon } : {}),
      ...(e.label ? { label: e.label } : {}),
    }))
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.text.localeCompare(b.text));
}

export function catalogToJson(catalog) {
  return JSON.stringify(catalog, null, 1) + '\n';
}

/** The generated icon-map module: imports exactly the icons the catalog
 *  names, from the two packs this app uses. */
export function iconsModule(catalog) {
  const names = [...new Set(catalog.map((e) => e.icon).filter(Boolean))].sort();
  const fa = names.filter((n) => n.startsWith('Fa'));
  const lu = names.filter((n) => n.startsWith('Lu'));
  return [
    '// GENERATED by devtools/build-helper-catalog.mjs — do not edit by hand.',
    '// The icons the helper-text catalog references, imported one by one so',
    '// tree-shaking keeps only what the catalog actually names.',
    "import type { IconType } from 'react-icons';",
    fa.length ? `import { ${fa.join(', ')} } from 'react-icons/fa';` : null,
    lu.length ? `import { ${lu.join(', ')} } from 'react-icons/lu';` : null,
    '',
    'export const HELPER_ICONS: Record<string, IconType> = {',
    `  ${names.join(', ')},`,
    '};',
    '',
  ].filter((l) => l !== null).join('\n');
}

// Run directly → (re)write the committed catalog + icon map.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const catalog = buildCatalog();
  writeFileSync(CATALOG_PATH, catalogToJson(catalog));
  writeFileSync(ICONS_PATH, iconsModule(catalog));
  const withCtx = catalog.filter((c) => c.icon || c.label).length;
  console.log(`helperTextCatalog.json: ${catalog.length} strings ` +
    `(${catalog.filter((c) => c.kind === 'tooltip').length} tooltips, ` +
    `${catalog.filter((c) => c.kind === 'placeholder').length} placeholders, ` +
    `${catalog.filter((c) => c.kind === 'hint').length} hints; ` +
    `${withCtx} with icon/label context)`);
}
