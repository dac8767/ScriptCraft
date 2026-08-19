/* check-version-sync (v7.62) — the app's version and the shipped bundle's
 * version must be the same number.
 *
 * They were not. The app said 7.61; src-tauri/tauri.conf.json said 0.19.0, and
 * nothing connected them — release.yml reads the git tag into $VERSION and uses
 * it for the release NOTES only, never writing it into the config. So every
 * build since v0.19 was stamped 0.19.0 whatever the About box claimed, and the
 * .dmg filename disagreed with the app inside it.
 *
 * WHY THIS IS A GATE AND NOT A NOTE. It is invisible from inside the app: the
 * About box reads APP_VERSION and is always right, so nothing on screen ever
 * looks wrong. It only surfaces at release time, in an artifact, after the tag
 * is cut — and it is precisely what an updater compares, so the first thing
 * built on top of it would have compared 0.19.0 against 0.19.0 and concluded
 * forever that there was nothing to install.
 *
 * Fix drift with:  node devtools/sync-version.mjs
 */
import { readFileSync } from 'node:fs';
import { readAppVersion, readBundleVersion } from './sync-version.mjs';

let pass = 0, fail = 0;
const ok = (cond, name, extra = '') => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};

const app = readAppVersion();
const bundle = readBundleVersion();

console.log('\nthe app and the bundle agree on what version this is');
ok(app === bundle, 'APP_VERSION matches tauri.conf.json',
  app === bundle ? '' : `app=${app} bundle=${bundle} → node devtools/sync-version.mjs`);
/* The old value, named, because "0.19.0" is what this looks like when it has
   silently stopped being maintained — a plausible number that never moves. */
ok(bundle !== '0.19.0', 'the bundle version is not the stale 0.19.0 default', bundle);
ok(/^\d+\.\d+(\.\d+)?$/.test(app), 'and it is a plain dotted version', app);

/* The release workflow has to REFUSE a tag that disagrees, not paper over it.
   A build that quietly rewrites its own version produces an artifact matching
   no commit, which is worse than a failed build. */
console.log('\nand the release workflow refuses a tag that disagrees');
const wf = readFileSync(new URL('../../.github/workflows/release.yml', import.meta.url), 'utf8');
ok(/Check the tag matches the app version/.test(wf), 'the guard step exists');
ok(/tauri\.conf\.json \(\$BUNDLE\) and APP_VERSION \(\$APP\) disagree/.test(wf),
  '…and fails loudly rather than patching the config');
ok(!/sed -i.*tauri\.conf\.json/.test(wf) && !/jq .*version.*tauri\.conf\.json/.test(wf),
  '…and the workflow never rewrites the version itself');

console.log(`\ncheck-version-sync: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
