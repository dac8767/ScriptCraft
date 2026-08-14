// check-dead-css.mjs (v7.02) — styling with nothing using it.
//
// WHY. The v7.00 style audit found `.prefs-subtabs` still fully styled a version
// after the Settings rail replaced it, and two of the four up/down-arrow
// implementations (`.fs-pin-order`, `.fs-customize-order`) with no code using
// them at all. Dead rules are not harmless: they read as authoritative when you
// are deciding how something is *supposed* to look, and they get "kept in sync"
// by well-meaning edits forever.
//
// WHAT IT DOES. Collects every class name the stylesheets define, then looks for
// each one in the components. A class nothing mentions is reported.
//
// HONEST LIMITS — this is a linting aid, not proof. Class names built at runtime
// (`fs-${kind}-row`) can't be seen by a text search, so the allow-list below
// exists and MUST carry a reason per entry. When in doubt, verify in the app
// before deleting.
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src');
const STYLES = join(SRC, 'styles', 'screenplay');

/** Classes assembled at runtime or referenced from outside .tsx. Reason required. */
const ALLOW = [
  [/^screenplay-/, 'applied by the editor schema / ProseMirror node views'],
  [/^page/, 'pagination decorations, built in editor/pagination.ts'],
  [/^fd-/, 'theme plumbing'],
  [/^ProseMirror/, 'TipTap internals'],
  [/^tippy/, 'tooltip library'],
  [/^rib-/, 'ribbon classes composed from token kind at runtime'],
  [/^markup-/, 'annotation classes composed from the markup id'],
  [/^element-/, 'element classes composed from the element type'],
  [/^beat-card-/, 'beat card classes composed from card state'],
  [/^theme-/, 'theme id appended at runtime'],
  [/^is-|^has-|^active$|^selected$|^disabled$|^open$|^dragging$/, 'state flags toggled by class-name concatenation'],
  // v7.04: BEM-style modifiers are the normal way to express a variant that
  // depends on state, and they are ALWAYS built by concatenation
  // (`fs-gr-sev--${severity}`), so a text search can never find them. The base
  // class before the `--` is still checked, which is the part that matters:
  // if the base is dead, the modifiers go with it.
  [/--/, 'BEM modifier composed at runtime; its base class is checked separately'],
];

function walk(dir, ext, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, ext, out);
    else if (e.name.endsWith(ext)) out.push(p);
  }
  return out;
}

const cssText = readdirSync(STYLES)
  .filter((f) => f.endsWith('.css'))
  .map((f) => readFileSync(join(STYLES, f), 'utf8'))
  .join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const defined = new Set([...cssText.matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]{2,})/g)].map((m) => m[1]));

const code = [...walk(SRC, '.tsx'), ...walk(SRC, '.ts')]
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n');

const dead = [...defined]
  .filter((c) => !ALLOW.some(([re]) => re.test(c)))
  .filter((c) => !code.includes(c))
  .sort();

/* THE BASELINE. When this check was written (v7.02) it found 309 classes with
   nothing using them — a hundred versions of accumulated CSS. Deleting them is
   its own project, and doing it blind is how you delete something that turns
   out to be composed at runtime. So the check GUARDS instead: the backlog is
   recorded in dead-css-baseline.json and only a NEW dead class fails the run.
   Shrinking the baseline is the cleanup task; it must never grow. */
const baselinePath = join(HERE, 'dead-css-baseline.json');
let baseline = [];
try { baseline = JSON.parse(readFileSync(baselinePath, 'utf8')); } catch { /* first run */ }
const known = new Set(baseline);
const added = dead.filter((c) => !known.has(c));
const fixed = baseline.filter((c) => !dead.includes(c));

// --update records the CURRENT set as the backlog. Run it after a cleanup pass
// (to shrink the baseline), or once to bootstrap it. It must never be run to
// silence a genuine new offender — that's what the reason-carrying ALLOW list
// is for.
if (process.argv.includes('--update')) {
  writeFileSync(baselinePath, JSON.stringify(dead, null, 1) + '\n');
  console.log(`check-dead-css: baseline written — ${dead.length} known, ${added.length} newly added, ${fixed.length} cleaned up`);
  process.exit(0);
}

if (added.length === 0) {
  console.log('check-dead-css: 1 passed, 0 failed');
  console.log(`  ✓ no NEW dead styling (${dead.length} in the known backlog${fixed.length ? `, ${fixed.length} cleaned up since — rerun with --update` : ''})`);
  process.exit(0);
}
console.log('check-dead-css: 0 passed, 1 failed');
console.log(`  ✗ ${added.length} NEW styled class(es) that no component mentions:`);
for (const c of added) console.log(`      .${c}`);
console.log('  → delete the rule, or add it to ALLOW in devtools/check-dead-css.mjs WITH A REASON');
process.exit(1);
