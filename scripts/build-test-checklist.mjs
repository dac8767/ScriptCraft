/**
 * build-test-checklist.mjs — generate a manual test checklist from the
 * changelog, for a given date.
 *
 * Derek asked for "a full list of all changes made today. i need to manually
 * check them all myself to make sure the changes worked." Generated rather
 * than hand-written on purpose: the changelog is the shipped record, so a
 * generated list cannot quietly omit an item the way a retyped one can.
 *
 * Handles BOTH entry shapes (the v4.73 crash's root cause): the newer
 * `changes: [string]` and the older `items: [{title, detail}]`.
 *
 *   node scripts/build-test-checklist.mjs 2026-07-26 > docs/TEST-CHECKLIST-2026-07-26.md
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const log = JSON.parse(readFileSync(join(here, '../frontend/src/data/changelog.json'), 'utf8'));

const date = process.argv[2];
if (!date) { console.error('usage: build-test-checklist.mjs <YYYY-MM-DD>'); process.exit(1); }

const entries = log.filter((e) => e.date === date);
if (!entries.length) { console.error(`no changelog entries dated ${date}`); process.exit(1); }

/** One shape for both formats: a line of text per shipped change. */
const linesOf = (e) => {
  if (Array.isArray(e.changes)) return e.changes.map((c) => String(c));
  if (Array.isArray(e.items)) {
    return e.items.map((it) => (it.detail ? `**${it.title}** — ${it.detail}` : String(it.title)));
  }
  return [];
};

const total = entries.reduce((n, e) => n + linesOf(e).length, 0);
const versions = entries.map((e) => e.version);

const out = [];
out.push(`# Manual test checklist — ${date}`);
out.push('');
out.push(`**${total} changes across ${entries.length} versions** (v${versions[versions.length - 1]} → v${versions[0]}).`);
out.push('Generated from `frontend/src/data/changelog.json` — every shipped line appears');
out.push('here exactly once, so nothing can be quietly left off the list.');
out.push('');
out.push('```');
out.push('cd /Users/dcarl/ScriptCraft && npm run desktop');
out.push('```');
out.push('');
out.push('Tick as you go. If something is wrong, note the version number beside it —');
out.push('that is enough to find the change and the reasoning behind it.');
out.push('');

for (const e of entries) {
  out.push(`## v${e.version}`);
  out.push('');
  for (const line of linesOf(e)) out.push(`- [ ] ${line}`);
  out.push('');
}

console.log(out.join('\n'));
