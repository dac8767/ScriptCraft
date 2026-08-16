/**
 * check-all — run the browser checks CONCURRENTLY.
 *
 * They were run one after another, and each one pays the same fixed cost:
 * launch a browser (~1s), load the app (~3-6s), seed a script, open a tool.
 * Nothing about them is shared, so that cost was being paid in series — the
 * suite took as long as the sum of its parts when it only needs to take as
 * long as the slowest one.
 *
 *   node devtools/check-all.mjs            # every check-*.mjs — the GATE
 *   node devtools/check-all.mjs --changed  # only what the diff can break
 *   node devtools/check-all.mjs v581 v582  # only those
 *   node devtools/check-all.mjs --serial   # the old way, for comparison
 *
 * --changed is the ITERATION loop, not the gate. It reads check-map.json
 * (devtools/build-check-map.mjs) and runs the checks whose covered files the
 * working diff touches, plus any check with no map entry — unmapped means
 * unknown, and unknown must never mean skipped. Measured spread: 1-4 checks
 * for a one-file change, ~28 for editorStore, ~54 for a broad one. The full
 * suite still runs once before a push; this is what stops a 219s suite from
 * being the cost of every intermediate re-run.
 */
import { readdirSync, readFileSync } from 'fs';
import { spawn, execFileSync } from 'child_process';
import { cpus } from 'os';

const args = process.argv.slice(2);
const serial = args.includes('--serial');
/* --changed = uncommitted + unpushed. --changed=<ref> = everything since ref
   (e.g. --changed=HEAD~1 to re-verify the commit just made). */
const changedArg = args.find((a) => a === '--changed' || a.startsWith('--changed='));
const changedOnly = Boolean(changedArg);
const changedRef = changedArg?.includes('=') ? changedArg.split('=')[1] : null;
const jobsArg = args.find((a) => a.startsWith('--jobs='));
const picks = args.filter((a) => !a.startsWith('--'));

let files = readdirSync(new URL('.', import.meta.url))
  .filter((f) => /^check-.*\.mjs$/.test(f) && f !== 'check-all.mjs' && f !== 'check-lanes.mjs')
  .filter((f) => picks.length === 0 || picks.some((p) => f.includes(p)))
  .sort();

if (changedOnly) {
  const repo = new URL('../../', import.meta.url).pathname.replace(/\/$/, '');
  const git = (...a) => {
    try { return execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8' }); } catch { return ''; }
  };
  /* Uncommitted work AND anything committed but not yet pushed — a delivery
     is usually several commits, and only comparing to HEAD would miss the
     earlier ones. */
  const base = changedRef || git('rev-parse', '--abbrev-ref', '@{u}').trim();
  const changed = new Set([
    ...git('diff', '--name-only', 'HEAD').split('\n'),
    ...(base ? git('diff', '--name-only', `${base}...HEAD`).split('\n') : []),
  ].map((s) => s.trim()).filter(Boolean));

  let map = null;
  try {
    map = JSON.parse(readFileSync(new URL('check-map.json', import.meta.url), 'utf8')).checks;
  } catch { /* no map — fall through and run everything */ }
  if (!map) {
    console.log('(no check-map.json — run devtools/build-check-map.mjs; running everything)');
  } else {
    const before = files.length;
    files = files.filter((f) => {
      const covers = map[f]?.covers;
      return !covers?.length || covers.some((c) => changed.has(c));
    });
    console.log(`(--changed: ${files.length} of ${before} checks, from ${changed.size} changed files)`);
    if (!files.length) { console.log('nothing to run'); process.exit(0); }
  }
}

/* A check spends most of its life WAITING — for the page to settle, for a
   selector, for an animation — not burning CPU. So the useful concurrency is
   higher than the core count suggests; measured on this 4-core box, 4 at a
   time beats 2. --jobs=N to override. */
const LIMIT = serial ? 1
  : jobsArg ? Math.max(1, +jobsArg.split('=')[1] || 1)
  : Math.max(2, Math.min(files.length, cpus().length));

const run = (file) => new Promise((resolve) => {
  const started = Date.now();
  const child = spawn('node', [new URL(file, import.meta.url).pathname], { encoding: 'utf8' });
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { out += d; });
  child.on('close', () => {
    /* Two reporting conventions grew up in here: the newer checks print a
       "N passed, M failed" summary, the older ones only print OK/FAIL (or
       ✓/✗) per assertion. Reading both is a two-line job; rewriting twelve
       files to agree is churn — and a check that reports "NO RESULT" is a
       check nobody reads. */
    const lines = out.trim().split('\n');
    const tail = lines.filter((l) => /\d+ passed, \d+ failed/.test(l)).pop();
    const m = tail?.match(/(\d+) passed, (\d+) failed/);
    let passed, failed, line;
    if (m) { [passed, failed, line] = [+m[1], +m[2], tail]; }
    else {
      passed = lines.filter((l) => /^\s*(✓|OK\s)/.test(l)).length;
      failed = lines.filter((l) => /^\s*(✗|FAIL\s)/.test(l)).length;
      const crashed = /Error:|SCRIPT ERROR/.test(out) && !passed && !failed;
      if (crashed) failed = 1;
      line = passed + failed ? `${passed} passed, ${failed} failed` : 'NO ASSERTIONS';
      if (!passed && !failed) failed = 1;
    }
    resolve({ file, out, secs: ((Date.now() - started) / 1000).toFixed(1), passed, failed, line });
  });
});

/* Warm the dev server FIRST. Vite compiles on demand, so the first page load
   after a restart costs ~10-20s — and launching the checks together meant
   several of them paying that same cold cost at once. One request up front
   turns it into one wait. */
try {
  const t0 = Date.now();
  await fetch('http://localhost:5199/');
  const warm = ((Date.now() - t0) / 1000).toFixed(1);
  if (+warm > 1) console.log(`(warmed the dev server in ${warm}s)`);
} catch { console.log('(no dev server on :5199 — checks will start it cold)'); }

const started = Date.now();
const queue = [...files];
const results = [];
await Promise.all(Array.from({ length: LIMIT }, async () => {
  while (queue.length) {
    const r = await run(queue.shift());
    results.push(r);
    console.log(`${r.failed ? '✗' : '✓'} ${r.file.padEnd(26)} ${String(r.secs).padStart(5)}s  ${r.line}`);
  }
}));

const failed = results.filter((r) => r.failed);
for (const r of failed) {
  console.log(`\n──── ${r.file} ────`);
  console.log(r.out.split('\n').filter((l) => /✗|FAIL |ERROR|Error:/.test(l)).slice(0, 12).join('\n'));
}
const wall = ((Date.now() - started) / 1000).toFixed(1);
const cpu = results.reduce((s, r) => s + +r.secs, 0).toFixed(1);
console.log(`\n${results.reduce((s, r) => s + r.passed, 0)} passed, ${results.reduce((s, r) => s + r.failed, 0)} failed`);
console.log(`${wall}s wall (${cpu}s of work, ${LIMIT} at a time)`);
process.exit(failed.length ? 1 : 0);
