/**
 * check-all — run the browser checks CONCURRENTLY.
 *
 * They were run one after another, and each one pays the same fixed cost:
 * launch a browser (~1s), load the app (~3-6s), seed a script, open a tool.
 * Nothing about them is shared, so that cost was being paid in series — the
 * suite took as long as the sum of its parts when it only needs to take as
 * long as the slowest one.
 *
 *   node devtools/check-all.mjs            # every check-*.mjs
 *   node devtools/check-all.mjs v581 v582  # only those
 *   node devtools/check-all.mjs --serial   # the old way, for comparison
 */
import { readdirSync } from 'fs';
import { spawn } from 'child_process';
import { cpus } from 'os';

const args = process.argv.slice(2);
const serial = args.includes('--serial');
const picks = args.filter((a) => !a.startsWith('--'));

const files = readdirSync(new URL('.', import.meta.url))
  .filter((f) => /^check-.*\.mjs$/.test(f) && f !== 'check-all.mjs' && f !== 'check-lanes.mjs')
  .filter((f) => picks.length === 0 || picks.some((p) => f.includes(p)))
  .sort();

/* Each check drives a real browser, so the cap is about CPU, not politeness.
   Half the cores keeps the machine usable and still finishes in one wave. */
const LIMIT = serial ? 1 : Math.max(2, Math.min(files.length, Math.floor(cpus().length / 2)));

const run = (file) => new Promise((resolve) => {
  const started = Date.now();
  const child = spawn('node', [new URL(file, import.meta.url).pathname], { encoding: 'utf8' });
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { out += d; });
  child.on('close', () => {
    const tail = out.trim().split('\n').filter((l) => /passed,/.test(l)).pop() || 'NO RESULT';
    const m = tail.match(/(\d+) passed, (\d+) failed/);
    resolve({
      file, out, secs: ((Date.now() - started) / 1000).toFixed(1),
      passed: m ? +m[1] : 0, failed: m ? +m[2] : 1, line: tail,
    });
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
  console.log(r.out.split('\n').filter((l) => /✗|ERROR/.test(l)).join('\n'));
}
const wall = ((Date.now() - started) / 1000).toFixed(1);
const cpu = results.reduce((s, r) => s + +r.secs, 0).toFixed(1);
console.log(`\n${results.reduce((s, r) => s + r.passed, 0)} passed, ${results.reduce((s, r) => s + r.failed, 0)} failed`);
console.log(`${wall}s wall (${cpu}s of work, ${LIMIT} at a time)`);
process.exit(failed.length ? 1 : 0);
