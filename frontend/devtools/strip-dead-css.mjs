/**
 * strip-dead-css — delete rule blocks whose selectors are ALL dead classes.
 *
 * check-dead-css finds the names; removing them by hand across 26 stylesheets
 * is where the mistakes happen, because a selector like
 *   `.script-notes-panel, .fs-note-popover { … }`
 * is half dead and must be edited, not deleted. This only removes a block when
 * EVERY selector in it names a class from the dead list, and reports the mixed
 * ones for a human instead of guessing.
 *
 *   node devtools/strip-dead-css.mjs script-notes template-list   # dry run
 *   node devtools/strip-dead-css.mjs --write script-notes         # do it
 *
 * A prefix argument matches any dead class starting with it, so a whole
 * retired feature goes in one pass.
 */
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
const STYLES = join(HERE, '..', 'src', 'styles', 'screenplay');

const args = process.argv.slice(2);
const write = args.includes('--write');
const prefixes = args.filter((a) => !a.startsWith('--'));
if (!prefixes.length) {
  console.log('usage: node devtools/strip-dead-css.mjs [--write] <prefix…>');
  process.exit(1);
}

const dead = new Set(
  JSON.parse(readFileSync(join(HERE, 'dead-css-baseline.json'), 'utf8'))
    .filter((c) => prefixes.some((p) => c === p || c.startsWith(`${p}-`))),
);
if (!dead.size) { console.log('no dead classes match those prefixes'); process.exit(1); }
console.log(`${dead.size} dead classes matched: ${[...dead].slice(0, 6).join(', ')}${dead.size > 6 ? '…' : ''}\n`);

/** Every class named in a selector list. */
const classesIn = (sel) => [...sel.matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)].map((m) => m[1]);

let removedBlocks = 0, removedLines = 0;
const mixed = [];

for (const file of readdirSync(STYLES).filter((f) => f.endsWith('.css'))) {
  const path = join(STYLES, file);
  const text = readFileSync(path, 'utf8');
  const lines = text.split('\n');
  const drop = new Set();

  for (let i = 0; i < lines.length; i++) {
    const open = lines[i].indexOf('{');
    if (open < 0) continue;
    // the selector list can span lines — walk back over lines ending in ','
    let start = i;
    while (start > 0 && /,\s*$/.test(lines[start - 1])) start--;
    const sel = lines.slice(start, i + 1).join(' ').slice(0, undefined).split('{')[0];
    if (/^\s*@/.test(sel)) continue;                     // @media / @supports
    const named = classesIn(sel);
    if (!named.length || !named.some((c) => dead.has(c))) continue;
    if (!named.every((c) => dead.has(c))) { mixed.push(`${file}: ${sel.trim()}`); continue; }
    // find the closing brace (these sheets are flat — no nested rules)
    let end = i;
    while (end < lines.length && !lines[end].includes('}')) end++;
    for (let k = start; k <= end; k++) drop.add(k);
    // take a comment block sitting directly above it
    let c = start - 1;
    while (c >= 0 && /^\s*(\/\*|\*|\/\/)/.test(lines[c])) { drop.add(c); c--; }
    removedBlocks++;
    i = end;
  }

  if (!drop.size) continue;
  removedLines += drop.size;
  const kept = lines.filter((_, i) => !drop.has(i));
  console.log(`${file}: ${drop.size} lines`);
  if (write) writeFileSync(path, kept.join('\n'));
}

console.log(`\n${removedBlocks} blocks, ${removedLines} lines${write ? ' REMOVED' : ' (dry run — pass --write)'}`);
if (mixed.length) {
  console.log(`\n${mixed.length} selector(s) mix dead and live classes — edit these by hand:`);
  for (const m of mixed) console.log(`  ${m}`);
}
