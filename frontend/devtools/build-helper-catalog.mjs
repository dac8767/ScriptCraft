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
// v6.51: title={…}/placeholder={…} EXPRESSIONS count too — every fixed
// string literal inside one is harvested (ternary arms, || fallbacks).
// Template literals interpolating live data (`Switch to ${name}`) have no
// fixed default to key an override by and stay contextual.
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

/* v6.51, Derek: "recheck the entire app for helper text that is not an
   option in the helper text window. I've found many." The misses were the
   DYNAMIC attribute sites — title={cond ? 'A' : 'B'}, title={'X'} — which
   the literal-only regexes above never saw. The DOM applier overrides
   whatever lands in the DOM (keyed by the default string), so these were
   always EDITABLE at runtime; they just never got LISTED. This pass slices
   the balanced {…} expression after title=/placeholder= and harvests every
   fixed string literal inside it. */
const ATTR_EXPR_RE = /\b(title|placeholder)=\{/g;
// '…' / "…" / `…` — template literals with ${…} are CONTEXTUAL text (they
// embed live data, so no fixed default exists to key an override by) and
// are excluded by the [^`$] class.
const EXPR_LITERAL_RE = /'((?:[^'\\\n]|\\.)+)'|"((?:[^"\\\n]|\\.)+)"|`((?:[^`\\$]|\\.)+)`/g;
// A literal that is a comparison operand / lookup key, not display text:
// mode === 'auto', obj['key'], s.includes('x'), case 'x'. The attr= guard
// covers title={<span className="…">…} — a JSX-typed title prop whose
// attribute values (classNames) are not helper text. (A literal title="…"
// nested in such JSX is still caught by the file-level TITLE_RE pass.)
const OPERAND_BEFORE_RE = /(?:===|!==|==|!=|\.includes\(|\.startsWith\(|\.endsWith\(|\[|\bcase|[A-Za-z-]+=)\s*$/;
const OPERAND_AFTER_RE = /^\s*(?:===|!==|==|!=|\])/;

/** The balanced {…} expression starting at src[open] === '{' — quote-aware
 *  so braces inside strings don't unbalance the walk. Returns the inner
 *  expression text, or null on an unterminated slice. */
function sliceBalancedExpr(src, open) {
  let depth = 0, quote = null;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return src.slice(open + 1, i);
    }
  }
  return null;
}

/** Drop `…${…}…` templates from an expression WHOLE — the literals inside
 *  their interpolations ('can'/'cannot', pluralizing 's') are fragments of
 *  one contextual string, never standalone helper text. A template with no
 *  interpolation survives (it IS a fixed string). */
function stripInterpolatedTemplates(expr) {
  let out = '';
  for (let i = 0; i < expr.length; i++) {
    const c = expr[i];
    if (c !== '`') { out += c; continue; }
    let j = i + 1, depth = 0, hasInterp = false, quote = null;
    for (; j < expr.length; j++) {
      const d = expr[j];
      if (quote) {
        if (d === '\\') j++;
        else if (d === quote) quote = null;
        continue;
      }
      if (d === '\\') { j++; continue; }
      if (depth === 0 && d === '`') break;
      if (d === '$' && expr[j + 1] === '{') { hasInterp = true; depth++; j++; continue; }
      if (depth > 0) {
        if (d === "'" || d === '"') { quote = d; continue; }
        if (d === '{') depth++;
        else if (d === '}') depth--;
      }
    }
    if (!hasInterp) out += expr.slice(i, j + 1);
    i = j;
  }
  return out;
}

/** Fixed string literals inside an attribute expression, operands skipped. */
function literalsInExpr(rawExpr) {
  const expr = stripInterpolatedTemplates(rawExpr);
  const out = [];
  for (const m of expr.matchAll(EXPR_LITERAL_RE)) {
    const text = (m[1] ?? m[2] ?? m[3]).replace(/\\(['"`])/g, '$1');
    if (OPERAND_BEFORE_RE.test(expr.slice(0, m.index))) continue;
    if (OPERAND_AFTER_RE.test(expr.slice(m.index + m[0].length))) continue;
    out.push(text);
  }
  return out;
}

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

  /** v6.38, Derek ("found in scriptnotes … 'video'. Is this actually still
   *  in use?"): literals that are ACCESSIBILITY LABELS on embeds — not
   *  user-facing helper text — stay out of the editor. The code keeps them;
   *  the tool stops listing them. */
  const NOT_HELPER_TEXT = new Set([
    'video',   // ScriptNotes.tsx — title on the iframe embedding a video link
  ]);

  /** entries: text -> { kinds, files, n, icon?, label? } */
  const entries = new Map();
  const add = (text, kind, file, ctx = {}) => {
    if (!text || !text.trim()) return;
    if (!/[a-zA-Z]/.test(text)) return;            // pure glyphs aren't editable text
    if (NOT_HELPER_TEXT.has(text)) return;
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
    // v6.51: dynamic attribute expressions — every fixed literal inside.
    for (const m of src.matchAll(ATTR_EXPR_RE)) {
      const expr = sliceBalancedExpr(src, m.index + m[0].length - 1);
      if (expr === null) continue;
      const kind = m[1] === 'title' ? 'tooltip' : 'placeholder';
      const ctx = kind === 'tooltip'
        ? contextAfter(src, m.index + m[0].length + expr.length + 1)
        : {};
      for (const text of literalsInExpr(expr)) add(text, kind, f, ctx);
    }
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
