/* check-readme — the front page has to be true.
 *
 * v7.36, Derek: "update the readme so it is all correct." It was upstream
 * OpenDraft's marketing copy and had drifted a long way from this fork:
 * real-time collaboration advertised in four places after v6.40 deleted it,
 * iOS and Android apps listed as features of a repo that builds neither, a
 * screenshot of a feature that no longer exists pointing at an image file that
 * no longer exists, `cd OpenDraft` after a clone that makes `ScriptCraft/`,
 * and download links to a version that was never published.
 *
 * A README rots silently — nothing fails when it lies. This is the cheapest
 * thing that notices: every local path it points at must exist, and the claims
 * that were false must not come back. No browser, so it runs in a blink.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const md = readFileSync(join(ROOT, 'README.md'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ FAIL ${name} ${extra}`); }
};

/* ── every local path it references must exist ───────────────────────────── */
const refs = [
  ...md.matchAll(/<img[^>]*src="([^"]+)"/g),
  ...md.matchAll(/\]\(([^)#][^)]*)\)/g),
  ...md.matchAll(/<a href="([^"]+)"/g),
].map((m) => m[1])
  .filter((p) => !/^https?:|^mailto:|^#/.test(p));

ok('the scan found paths to check', refs.length > 5, `${refs.length} found`);
const missing = [...new Set(refs)].filter((p) => !existsSync(join(ROOT, p.split('#')[0])));
ok('every local file it points at exists', missing.length === 0, missing.join(', '));

/* ── claims that are not true of this fork ───────────────────────────────── */
// Collaboration was removed in v6.40 — tool, menu, sync, settings, all of it.
const collabClaims = md.split('\n').filter((l) =>
  /collaborat/i.test(l) && !/^\s*[-*>|]?\s*\*\*Real-time Collaboration\*\*\s*\|\s*No/i.test(l)
  && !/removed in v6\.40/i.test(l) && !/is not used/i.test(l));
ok('collaboration is not advertised as a feature', collabClaims.length === 0,
  collabClaims.map((l) => l.trim().slice(0, 70)).join(' // '));

// The store apps are upstream's. This repo builds no mobile app.
const mobileClaims = md.split('\n').filter((l) =>
  /\b(iOS|Android)\b/.test(l) && !/not built from this repository|upstream OpenDraft's/.test(l));
ok('no iOS/Android app is claimed as this fork\'s', mobileClaims.length === 0,
  mobileClaims.map((l) => l.trim().slice(0, 70)).join(' // '));

// `git clone` makes ScriptCraft/, so every cd after one must say ScriptCraft.
const badCd = md.match(/^cd OpenDraft\s*$/gm) ?? [];
ok('the clone instructions cd into the directory clone actually makes', badCd.length === 0, String(badCd));

// Nothing is published yet; a download table for a version that never shipped
// sends people to 404s.
ok('no download links to unpublished builds',
  !/releases\/latest\/download\//.test(md), '');

// It must say so, rather than leaving people to discover it at a 404.
ok('it says there is no release yet', /has not had its first release/i.test(md), '');

/* ── the tree it prints must match the tree that exists ──────────────────── */
const tree = md.match(/```\n(ScriptCraft\/[\s\S]*?)```/)?.[1] ?? '';
ok('the project structure block is present', tree.length > 0, '');
const listed = [...tree.matchAll(/[├└]──\s+(\S+)/g)].map((m) => m[1].replace(/\/$/, ''));
const goneFromDisk = listed.filter((n) => !existsSync(join(ROOT, n)));
ok('every directory it lists is really there', goneFromDisk.length === 0, goneFromDisk.join(', '));

console.log(`\ncheck-readme: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
