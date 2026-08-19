// build-release-manifest.mjs (v7.63) — emit the updater's latest.json.
//
// The manifest lives in the PUBLIC ScriptCraft-releases repo and is the file
// every running copy of the app polls: services/updateCheck.ts fetches it,
// compares its `version` against APP_VERSION, and offers the download when it
// is newer. So it holds one more copy of the version number — and hand-copied
// version numbers are the entire subject of v7.62 and v7.63. tauri.conf.json
// sat at 0.19.0 for three hundred releases; the diagnostics report quoted the
// forked-from version to every tester. Both because a number was written down
// twice and only one copy was ever maintained.
//
// This generates it from APP_VERSION instead, so cutting a release is a command
// rather than an edit:
//
//   node devtools/build-release-manifest.mjs                    print it
//   node devtools/build-release-manifest.mjs --notes "…"        override the note
//   node devtools/build-release-manifest.mjs -o latest.json     write a file
//
// Paste the output into ScriptCraft-releases/latest.json. Nothing here talks to
// GitHub — a token that can write to a public repo is not worth having on disk
// for a file this small.
import { readFileSync, writeFileSync } from 'node:fs';
import { readAppVersion } from './sync-version.mjs';

const RELEASES = 'https://github.com/dac8767/ScriptCraft-releases/releases';
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};

const version = readAppVersion();
const log = JSON.parse(
  readFileSync(new URL('../src/data/changelog.json', import.meta.url), 'utf8'),
);
const entry = log.find((e) => e.version === version);

/* The banner shows `notes` inline beside the version, so it wants ONE short
   line — not a changelog. Default to the first sentence of the newest entry,
   which is written to lead with the point. */
function firstLine() {
  const first = String(entry?.changes?.[0] ?? entry?.items?.[0]?.title ?? '');
  /* Split on a full stop that ENDS A SENTENCE, not on the one inside "7.62".
     The version's dot is masked before the split and restored after. The
     sentinel is spelled as an escape rather than typed: a raw control byte in
     a source file is invisible in every editor and diff that will show it. */
  const SENTINEL = '\u0001';
  const masked = first.replace(/(\d)\.(\d)/g, `$1${SENTINEL}$2`);
  const sentence = /^(.*?[.!?])(\s|$)/.exec(masked);
  return (sentence ? sentence[1] : masked).split(SENTINEL).join('.').trim();
}

const manifest = {
  version,
  url: flag('--url') || `${RELEASES}/tag/v${version}`,
  notes: flag('--notes') || firstLine(),
  /* Taken from the changelog rather than the clock: these scripts run in a
     container whose date is not necessarily the release date, and a wrong date
     in the banner's tooltip is worse than no date at all. */
  date: flag('--date') || entry?.date || '',
};
if (!manifest.date) delete manifest.date;

const json = `${JSON.stringify(manifest, null, 2)}\n`;
const out = flag('-o') || flag('--out');
if (out) {
  writeFileSync(out, json);
  console.log(`wrote ${out} (version ${version})`);
} else {
  process.stdout.write(json);
}
