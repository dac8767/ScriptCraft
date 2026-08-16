/**
 * build-check-map — what source each browser check actually covers.
 *
 * WHY. The suite is 91 checks and 850 seconds of work; on a 4-core box that
 * is 219s wall at ~97% parallel efficiency, so scheduling has nothing left to
 * give. The only lever is running FEWER of them in the iteration loop — and
 * the only honest way to do that is to know which check covers which file.
 *
 * Nobody is going to annotate 91 files, and an annotation nobody updates is
 * worse than none. So the map is DERIVED, from two signals that are already
 * true today:
 *
 *   1. The commit that ADDED the check. These are written one per version,
 *      in the same commit as the feature they check — so that commit's src/
 *      files are what the check was written to cover.
 *   2. Every src/ path the check readFileSync's. The source-assertion half of
 *      a check names its files outright.
 *
 * Neither is complete, and that is fine, because the map only ever DECIDES
 * WHAT TO RUN EARLY. Unmapped → run it. Wrong → the check runs when it did
 * not need to, or the full suite (which is still the gate of record before a
 * release) catches it. The failure mode is time, never coverage.
 *
 *   node devtools/build-check-map.mjs          # rewrite check-map.json
 *   node devtools/build-check-map.mjs --dry    # print, write nothing
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const DIR = new URL('.', import.meta.url).pathname;
const REPO = new URL('../../', import.meta.url).pathname.replace(/\/$/, '');

const git = (...args) => {
  try {
    return execFileSync('git', ['-C', REPO, ...args], { encoding: 'utf8' }).trim();
  } catch { return ''; }
};

const files = readdirSync(DIR)
  .filter((f) => /^check-.*\.mjs$/.test(f) && f !== 'check-all.mjs' && f !== 'check-lanes.mjs')
  .sort();

/* Pass 1: what each introducing commit touched, and how often each file
   shows up across all of them. */
const commitFiles = {};
for (const f of files) {
  const sha = git('log', '--diff-filter=A', '--format=%H', '-1', '--', `frontend/devtools/${f}`);
  const touched = sha
    ? git('show', '--name-only', '--format=', sha).split('\n')
      .map((p) => p.trim())
      .filter((p) => p.startsWith('frontend/src/') && !/\.test\.[tj]sx?$/.test(p))
    : [];
  commitFiles[f] = { sha, touched };
}

/* RITUAL FILES. A version commit bumps the changelog and regenerates the
   helper catalog every single time, so those files land in nearly every
   commit-derived map — changelog.json was in 90 of 91, which made every
   change look like it touched everything and selected the whole suite.
   That is ceremony, not coverage. Anything appearing in more than
   RITUAL_SHARE of the commits is dropped from THIS signal; a check that
   genuinely reads one still gets it from signal (2) below. */
const RITUAL_SHARE = 0.6;
const freq = {};
for (const { touched } of Object.values(commitFiles)) {
  for (const p of new Set(touched)) freq[p] = (freq[p] || 0) + 1;
}
const ritual = new Set(
  Object.entries(freq).filter(([, n]) => n > files.length * RITUAL_SHARE).map(([p]) => p),
);

const map = {};
for (const f of files) {
  const covers = new Set();

  /* (1) the commit that introduced it, minus the ritual */
  for (const p of commitFiles[f].touched) if (!ritual.has(p)) covers.add(p);

  /* (2) every src/ path it reads for a source assertion — an explicit
     naming, so it counts even when the file is ritual elsewhere */
  const body = readFileSync(DIR + f, 'utf8');
  for (const m of body.matchAll(/new URL\('\.\.\/(src\/[^']+)'/g)) {
    covers.add(`frontend/${m[1]}`);
  }

  map[f] = { sha: commitFiles[f].sha.slice(0, 7), covers: [...covers].sort() };
}

const unmapped = Object.entries(map).filter(([, v]) => !v.covers.length).map(([k]) => k);
const out = {
  _comment: 'DERIVED by devtools/build-check-map.mjs — do not hand-edit. Maps each browser check to the frontend/src files it covers, so check-all --changed can run the relevant ones in the iteration loop. A check with no entry is always run (unmapped means unknown, and unknown must not mean skipped).',
  _generated_from: git('rev-parse', '--short', 'HEAD'),
  _ritual: [...ritual].sort(),
  checks: map,
};

const total = Object.values(map).reduce((s, v) => s + v.covers.length, 0);
console.log(`${files.length} checks, ${total} file links, ${unmapped.length} unmapped (always run):`);
for (const u of unmapped) console.log(`  ${u}`);
console.log(`dropped as ritual (in >${Math.round(RITUAL_SHARE * 100)}% of commits): ${[...ritual].map((p) => p.replace('frontend/src/', '')).join(', ') || 'none'}`);

if (!process.argv.includes('--dry')) {
  writeFileSync(`${DIR}check-map.json`, `${JSON.stringify(out, null, 1)}\n`);
  console.log('\nwrote devtools/check-map.json');
}
