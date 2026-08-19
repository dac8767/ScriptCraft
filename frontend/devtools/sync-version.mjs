// sync-version.mjs (v7.62) — write APP_VERSION into the Tauri bundle config.
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
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const CONF = new URL('../../src-tauri/tauri.conf.json', import.meta.url);
const CHANGELOG = new URL('../src/data/changelog.ts', import.meta.url);

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
  const bundle = readBundleVersion();

  if (process.argv.includes('--check')) {
    if (app === bundle) {
      console.log(`version sync: ok (${app})`);
      process.exit(0);
    }
    console.error(`version sync: DRIFT — app says ${app}, bundle says ${bundle}`);
    console.error('  → node devtools/sync-version.mjs');
    process.exit(1);
  }

  if (app === bundle) {
    console.log(`version sync: already ${app}`);
  } else {
    /* Rewrite the ONE field, textually. JSON.parse/stringify would reformat the
       whole file and bury the change in a whitespace diff. */
    const src = readFileSync(CONF, 'utf8');
    writeFileSync(CONF, src.replace(/("version":\s*")[^"]+(")/, `$1${app}$2`));
    console.log(`version sync: ${bundle} → ${app}`);
  }
}
