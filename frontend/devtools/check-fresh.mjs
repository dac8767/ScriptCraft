#!/usr/bin/env node
/**
 * check-fresh — is this working tree the one we were working in?
 *
 * WHAT HAPPENS. This container's disk is periodically restored from a
 * snapshot. It has landed on the same one every time: HEAD at 87e94b8
 * (v6.67, 2026-08-10 04:27) with five files dirty. Everything in the
 * container comes back with it — the repo, `.git`, the lot.
 *
 * HOW WE KNOW IT IS NOT GIT DOING IT. A `git reset` APPENDS to the reflog and
 * cannot erase what came before. After the last restore the reflog jumped
 * from 2026-08-10 straight to the recovery — six days and a dozen commits
 * missing — while every one of those commits was still on the remote. And
 * `.git/HEAD`, which git rewrites on every checkout, was three weeks old.
 * Neither is reachable by any git command. It is the filesystem.
 *
 * WHY IT MATTERS, AND WHY IT IS NOT "LOST WORK". Pushed commits survived
 * every single time — the remote is the truth and always was. The real
 * damage is subtler: WORKING ON A STALE TREE WITHOUT NOTICING. It nearly
 * shipped twice. Once a whole feature (`check-all --changed`) was simply
 * absent from a file being edited, and it was caught only because the code
 * being read did not match the code remembered.
 *
 * SO THIS IS THE FIX WE CAN ACTUALLY MAKE. The restore cannot be prevented
 * from in here — the container is the platform's, and its contract is
 * "commit and push or lose it", which is honoured. What CAN be guaranteed is
 * that a stale tree is impossible to work in quietly: this fails loudly, with
 * the recovery command, before anything is built or believed.
 *
 *   node devtools/check-fresh.mjs           # exits 1 when stale
 *   node devtools/check-fresh.mjs --quiet   # only speaks up when wrong
 */
import { execFileSync } from 'node:child_process';

const REPO = new URL('../../', import.meta.url).pathname.replace(/\/$/, '');
const quiet = process.argv.includes('--quiet');
const git = (...a) => execFileSync('git', ['-C', REPO, ...a], { encoding: 'utf8' }).trim();
const say = (s) => console.log(s);

let branch;
try { branch = git('rev-parse', '--abbrev-ref', 'HEAD'); }
catch { say('check-fresh: not a git repo — skipping.'); process.exit(0); }

/* The fetch is the whole point: staleness is invisible from inside the tree,
   because a restored tree is perfectly self-consistent. Only the remote knows
   the branch moved on. A network failure must NOT read as "fresh". */
try {
  git('fetch', '--quiet', 'origin', branch);
} catch (e) {
  say(`check-fresh: COULD NOT REACH THE REMOTE (${String(e.message).split('\n')[0].slice(0, 60)}).`);
  say('  Freshness is unverified — this is not the same as verified fresh.');
  process.exit(0);
}

const head = git('rev-parse', 'HEAD');
const remote = git('rev-parse', `origin/${branch}`);

if (head === remote) {
  if (!quiet) say(`check-fresh: up to date with origin/${branch} (${head.slice(0, 7)}).`);
  process.exit(0);
}

/* Ahead of the remote is normal — unpushed work. BEHIND is the signature. */
let behind = false;
try { git('merge-base', '--is-ancestor', remote, head); }
catch { behind = true; }

if (!behind) {
  if (!quiet) {
    const n = git('rev-list', '--count', `${remote}..HEAD`);
    say(`check-fresh: ${n} commit(s) ahead of origin/${branch} — unpushed, not stale.`);
  }
  process.exit(0);
}

const missing = git('rev-list', '--count', `HEAD..${remote}`);
say('');
say('  ╭─────────────────────────────────────────────────────────────────╮');
say('  │  STALE WORKING TREE — do not build, test or believe this code.  │');
say('  ╰─────────────────────────────────────────────────────────────────╯');
say(`  HEAD            ${head.slice(0, 7)}  ${git('log', '-1', '--format=%s', 'HEAD').slice(0, 58)}`);
say(`  origin/${branch}  ${remote.slice(0, 7)}  ${git('log', '-1', '--format=%s', remote).slice(0, 58)}`);
say(`  ${missing} commit(s) on the remote are missing from this tree.`);

/* The tell that says WHY, so nobody spends an afternoon on it again: a git
   reset appends to the reflog, so the newest reflog entry is never older than
   the newest commit here. A restored .git loses everything after the snapshot. */
try {
  const lastReflog = git('reflog', '--date=unix', '-1', '--format=%gd');
  const reflogTime = Number(git('log', '-g', '-1', '--format=%ct'));
  const headTime = Number(git('log', '-1', '--format=%ct', remote));
  if (reflogTime && headTime && headTime - reflogTime > 3600) {
    const days = ((headTime - reflogTime) / 86400).toFixed(1);
    say('');
    say(`  The reflog stops ${days} day(s) before the branch tip (${lastReflog}).`);
    say('  That is a DISK RESTORE, not a git operation — a reset cannot erase');
    say('  reflog history. Nothing you did caused this and nothing is lost:');
    say('  every pushed commit is safe on the remote.');
  }
} catch { /* reflog shapes vary; the verdict above stands without it */ }

say('');
say('  RECOVER:');
say(`    git fetch origin ${branch} && git reset --hard origin/${branch}`);
say('  Then VERIFY BY CONTENT, never by commit id — a restored tree has once');
say('  read as the right sha with the wrong blobs:');
say('    grep APP_VERSION frontend/src/data/changelog.ts');
say('');
process.exit(1);
