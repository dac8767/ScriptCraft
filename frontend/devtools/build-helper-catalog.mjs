// build-helper-catalog.mjs (v6.20) — regenerate src/data/helperTextCatalog.json.
//
// The CODE is the source of truth for helper text; this scan is how the Design
// window's Helper Text section knows what exists. Rerun after adding/renaming
// helper strings:   node devtools/build-helper-catalog.mjs
// check-helper-catalog.mjs fails the suite when the committed catalog drifts.
//
// What counts as helper text (Derek's list, v6.20): hover tooltips (title=),
// field ghost text (placeholder=), and content hints registered through
// ht('…')/useHt()('…') — empty-list texts, ? popover bodies, the element
// placeholder map. Labels, menu items and button captions are UI text, not
// helper text, and stay out.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'src');
export const CATALOG_PATH = join(ROOT, 'data', 'helperTextCatalog.json');

const TITLE_RE = /\btitle="([^"]+)"/g;
const PLACEHOLDER_RE = /\bplaceholder="([^"]+)"/g;
// ht('…') and useHt()('…') direct-content reads; both quote styles.
const HT_RE = /\bht\(\s*(?:'((?:[^'\\]|\\.)+)'|"((?:[^"\\]|\\.)+)")\s*[),]/g;

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

  /** entries: text -> { kinds: Set, files: Set, n } */
  const entries = new Map();
  const add = (text, kind, file) => {
    if (!text || !text.trim()) return;
    if (!/[a-zA-Z]/.test(text)) return;            // pure glyphs aren't editable text
    const e = entries.get(text) ?? { kinds: new Set(), files: new Set(), n: 0 };
    e.kinds.add(kind); e.files.add(relative(ROOT, file)); e.n++;
    entries.set(text, e);
  };

  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(TITLE_RE)) add(m[1], 'tooltip', f);
    for (const m of src.matchAll(PLACEHOLDER_RE)) add(m[1], 'placeholder', f);
    for (const m of src.matchAll(HT_RE)) add((m[1] ?? m[2]).replace(/\\(['"])/g, '$1'), 'hint', f);
  }

  const KIND_ORDER = { tooltip: 0, placeholder: 1, hint: 2 };
  return [...entries.entries()]
    .map(([text, e]) => ({
      text,
      kind: [...e.kinds].sort((a, b) => KIND_ORDER[a] - KIND_ORDER[b])[0],
      sites: e.n,
      where: [...e.files].sort().slice(0, 6),
    }))
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.text.localeCompare(b.text));
}

export function catalogToJson(catalog) {
  return JSON.stringify(catalog, null, 1) + '\n';
}

// Run directly → (re)write the committed catalog.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const catalog = buildCatalog();
  writeFileSync(CATALOG_PATH, catalogToJson(catalog));
  console.log(`helperTextCatalog.json: ${catalog.length} strings ` +
    `(${catalog.filter((c) => c.kind === 'tooltip').length} tooltips, ` +
    `${catalog.filter((c) => c.kind === 'placeholder').length} placeholders, ` +
    `${catalog.filter((c) => c.kind === 'hint').length} hints)`);
}
