// sync-version.mjs (v7.62, fixed v7.63) — write APP_VERSION into everything
// that ships a version number.
//
// WHY THIS EXISTS. The app said 7.61 and the shipped bundle said 0.19.0, and
// nothing connected them: release.yml reads the tag into $VERSION but only ever
// prints it in the release notes — it never writes it into tauri.conf.json. So
// every build since v0.19 has been stamped 0.19.0 no matter what the About box
// claimed, the .dmg filename disagreed with the app inside it, and an updater
// added on top would have compared 0.19.0 against 0.19.0 forever and concluded
// there was nothing to install. That is the worst kind of broken: silent, and
// it looks like the updater's fault.
//
// APP_VERSION (frontend/src/data/changelog.ts) is the ONE source. It is the
// number Derek bumps, the number the changelog is keyed by, and the number the
// About box shows. This copies it outward.
//
//   node devtools/sync-version.mjs          write it
//   node devtools/sync-version.mjs --check  exit 1 if they disagree
//
// check-version-sync.mjs runs the --check form in the suite, so drift fails
// rather than waiting to be noticed in a release.
//
// v7.63 — THE VERSION MUST BE NORMALISED ON THE WAY OUT. This first shipped
// copying APP_VERSION through verbatim, which wrote `"version": "7.62"`, and
// Tauri refuses a version that is not full semver:
//
//     failed to parse config: `tauri.conf.json > version` must be a semver string
//
// The app would not start at all. Nothing in the suite caught it because that
// parser only runs inside `tauri dev` / `tauri build`, which the container this
// is written in cannot run — so the assertion has to stand in for it, and
// "is it three components" is now checked explicitly rather than allowed.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const CONF = new URL('../../src-tauri/tauri.conf.json', import.meta.url);
const CARGO = new URL('../../src-tauri/Cargo.toml', import.meta.url);
const CARGO_LOCK = new URL('../../src-tauri/Cargo.lock', import.meta.url);
const CHANGELOG = new URL('../src/data/changelog.ts', import.meta.url);

/**
 * MAJOR.MINOR.PATCH, always — Tauri and Cargo both require three components.
 *
 * Derek numbers releases with two ('7.63'), which is the number on screen and
 * the one the changelog is keyed by, so the third is supplied here rather than
 * asking him to type a `.0` he does not otherwise use. compareVersions() in
 * services/updateCheck.ts treats a missing part as 0, so 7.63 and 7.63.0 are
 * the same version to the updater and the manifest can say either.
 */
export function toSemver(v) {
  const parts = String(v).trim().replace(/^v/, '').split('-')[0].split('.')
    .map((n) => String(Number.parseInt(n, 10) || 0));
  while (parts.length < 3) parts.push('0');
  return parts.slice(0, 3).join('.');
}

/** APP_VERSION, read as text — importing the .ts would need a transpiler for
 *  what is one string on one line. */
export function readAppVersion() {
  const src = readFileSync(CHANGELOG, 'utf8');
  const m = /export const APP_VERSION = '([^']+)'/.exec(src);
  if (!m) throw new Error('APP_VERSION not found in src/data/changelog.ts');
  return m[1];
}

export function readBundleVersion() {
  const m = /"version":\s*"([^"]+)"/.exec(readFileSync(CONF, 'utf8'));
  if (!m) throw new Error('version not found in src-tauri/tauri.conf.json');
  return m[1];
}

/** The crate's own version. Not user-visible, but it is one more copy of the
 *  same number and it had drifted to 0.19.0 alongside the bundle's. */
export function readCrateVersion() {
  const m = /^\[package\][\s\S]*?\nversion = "([^"]+)"/.exec(readFileSync(CARGO, 'utf8'));
  if (!m) throw new Error('version not found in src-tauri/Cargo.toml [package]');
  return m[1];
}

/** Cargo.lock records the workspace member's version too. Left behind, cargo
 *  rewrites it on the next build and Derek's lockfile goes dirty — which is
 *  what aborts his `git pull` (see CLAUDE.md §3). */
export function readLockVersion() {
  const m = /name = "scriptcraft"\nversion = "([^"]+)"/.exec(readFileSync(CARGO_LOCK, 'utf8'));
  if (!m) throw new Error('scriptcraft package not found in src-tauri/Cargo.lock');
  return m[1];
}

/* Everything below is the CLI, and it runs ONLY when this file is the thing
   node was pointed at.
   Without this guard, check-version-sync's `import { readAppVersion }` would
   execute the writer as a side effect of importing it — silently repairing the
   very drift it exists to report, and then passing. Verified: the check fixed a
   0.19.0 config mid-run and reported six passes. A check that cannot fail is
   worse than no check, because it also tells you it looked. */
const isMain = import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
if (isMain) main();

function main() {
  const app = readAppVersion();
  const want = toSemver(app);

  /* Rewrite the ONE field in each file, textually. JSON.parse/stringify would
     reformat the whole config and bury the change in a whitespace diff, and
     there is no TOML writer here worth pulling in for one line. */
  const targets = [
    {
      what: 'tauri.conf.json', file: CONF, read: readBundleVersion,
      sub: (src) => src.replace(/("version":\s*")[^"]+(")/, `$1${want}$2`),
    },
    {
      what: 'Cargo.toml', file: CARGO, read: readCrateVersion,
      /* Anchored at [package] and non-greedy, so it lands on the crate's own
         version and not on the first dependency's. */
      sub: (src) => src.replace(/(^\[package\][\s\S]*?\nversion = ")[^"]+(")/, `$1${want}$2`),
    },
    {
      what: 'Cargo.lock', file: CARGO_LOCK, read: readLockVersion,
      sub: (src) => src.replace(/(name = "scriptcraft"\nversion = ")[^"]+(")/, `$1${want}$2`),
    },
  ];

  if (process.argv.includes('--check')) {
    const drift = targets.filter((t) => t.read() !== want);
    if (!drift.length) {
      console.log(`version sync: ok (${want})`);
      process.exit(0);
    }
    for (const t of drift) {
      console.error(`version sync: DRIFT — app says ${app} (${want}), ${t.what} says ${t.read()}`);
    }
    console.error('  → node devtools/sync-version.mjs');
    process.exit(1);
  }

  let wrote = 0;
  for (const t of targets) {
    const had = t.read();
    if (had === want) continue;
    const src = readFileSync(t.file, 'utf8');
    const out = t.sub(src);
    if (out === src) throw new Error(`sync-version: could not rewrite the version in ${t.what}`);
    writeFileSync(t.file, out);
    console.log(`version sync: ${t.what} ${had} → ${want}`);
    wrote++;
  }
  if (!wrote) console.log(`version sync: already ${want}`);
}
