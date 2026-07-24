#!/usr/bin/env node
// check-lanes — parallel-chat lane overlap checker & dispatcher for ScriptCraft.
//
// Lanes are independently-ownable slices of the codebase (see docs/AREA-MAP.md);
// two Claude chats can safely run in parallel only if their lanes don't overlap.
// This tool reads docs/lanes.json and answers "do these overlap?" and "how do I
// split these updates into parallel-safe waves?".
//
// Usage:
//   node scripts/check-lanes.mjs lane <laneA> <laneB> [...]     check chosen lanes for overlap
//   node scripts/check-lanes.mjs plan [--sliced] <laneA> [...]  partition lanes into non-overlapping waves
//   node scripts/check-lanes.mjs files <path> [...]             which lane(s) do these files belong to
//   node scripts/check-lanes.mjs diff                           classify the current git diff into lanes
//   node scripts/check-lanes.mjs lanes                          list every lane
//   node scripts/check-lanes.mjs --selftest                     run built-in assertions
//
// --sliced models the world AFTER stores/editorStore.ts is split into per-domain
// slices: lanes that only conflict because they share editorStore.ts today become
// independent. Use it to see what parallelism the store-split will unlock.
//
// Exit code is 1 when an overlap/conflict is found (so CI or a wrapper can gate on it).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const MANIFEST = join(HERE, '..', 'docs', 'lanes.json');

function loadManifest() {
  let raw;
  try {
    raw = readFileSync(MANIFEST, 'utf8');
  } catch {
    fail(`Cannot read manifest at ${MANIFEST}`);
  }
  let m;
  try {
    m = JSON.parse(raw);
  } catch (e) {
    fail(`docs/lanes.json is not valid JSON: ${e.message}`);
  }
  if (!m.lanes || !m.spine) fail('docs/lanes.json must have "lanes" and "spine".');
  return m;
}

function fail(msg) {
  console.error(`check-lanes: ${msg}`);
  process.exit(2);
}

// A manifest "entry" is either an exact repo-relative path or a directory prefix
// ending in '/'. A file belongs to it on exact match or prefix match.
function entryMatches(file, entry) {
  return entry.endsWith('/') ? file.startsWith(entry) : file === entry;
}

function isSpine(file, m) {
  return m.spine.files.some((e) => entryMatches(file, e));
}

// Every lane whose file list claims this path (a file can be shared, e.g. CSS).
function lanesForFile(file, m) {
  return Object.keys(m.lanes).filter((name) => m.lanes[name].files.some((e) => entryMatches(file, e)));
}

function storeDomain(lane, m) {
  const s = m.lanes[lane].store || 'none';
  return s.startsWith('editorStore:') ? s.slice('editorStore:'.length) : null;
}

function sharedFiles(a, b, m) {
  const setB = new Set(m.lanes[b].files);
  return m.lanes[a].files.filter((f) => setB.has(f));
}

// Why (if at all) two lanes conflict. `sliced` = assume editorStore is split.
function conflictReasons(a, b, m, sliced) {
  const reasons = [];
  const shared = sharedFiles(a, b, m);
  if (shared.length) reasons.push(`share ${shared.join(', ')}`);
  const da = storeDomain(a, m);
  const db = storeDomain(b, m);
  if (da && db) {
    if (da === db) reasons.push(`both own the editorStore '${da}' domain (same slice)`);
    else if (!sliced) reasons.push(`both write editorStore.ts today (domains: ${da}, ${db}) — independent once sliced`);
  }
  return reasons;
}

function validateLanes(names, m) {
  const bad = names.filter((n) => !m.lanes[n]);
  if (bad.length) {
    fail(`unknown lane(s): ${bad.join(', ')}\nValid lanes: ${Object.keys(m.lanes).join(', ')}`);
  }
}

function dedupe(arr) {
  return [...new Set(arr)];
}

// ---- commands ---------------------------------------------------------------

function cmdLanes(m) {
  console.log('Lanes:');
  for (const [name, l] of Object.entries(m.lanes)) {
    const store = l.store && l.store !== 'none' ? `  [${l.store}]` : '';
    console.log(`  ${name.padEnd(14)} ${l.title}${store}`);
  }
  console.log(`\nSpine (shared — one chat at a time, registry edits append-only):`);
  for (const f of m.spine.files) console.log(`  ${f}`);
}

function cmdLane(names, m, sliced) {
  names = dedupe(names);
  validateLanes(names, m);
  if (names.length < 2) {
    console.log(`Only one lane given (${names[0]}). Nothing to overlap. Add another lane to compare.`);
    return 0;
  }
  console.log(`Overlap check${sliced ? ' (assuming editorStore is sliced)' : ''}:\n`);
  let conflicts = 0;
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const a = names[i], b = names[j];
      const reasons = conflictReasons(a, b, m, sliced);
      if (reasons.length) {
        conflicts++;
        console.log(`  CONFLICT  ${a} + ${b}`);
        for (const r of reasons) console.log(`            - ${r}`);
      } else {
        console.log(`  ok        ${a} + ${b}`);
      }
    }
  }
  console.log('');
  if (conflicts) {
    console.log(`${conflicts} overlapping pair(s). Run these in separate waves, or split the shared file first.`);
    console.log(`Tip: 'plan ${names.join(' ')}' groups them into parallel-safe waves for you.`);
    return 1;
  }
  console.log('No overlaps — these lanes can run in parallel chats at the same time.');
  return 0;
}

// Greedy graph-colouring: each "wave" is a set of mutually non-conflicting lanes.
function cmdPlan(names, m, sliced) {
  names = dedupe(names);
  validateLanes(names, m);
  const waves = [];
  for (const lane of names) {
    let placed = false;
    for (const wave of waves) {
      if (wave.every((other) => conflictReasons(lane, other, m, sliced).length === 0)) {
        wave.push(lane);
        placed = true;
        break;
      }
    }
    if (!placed) waves.push([lane]);
  }

  console.log(`Dispatch plan${sliced ? ' (assuming editorStore is sliced)' : ' (current codebase)'} — ${names.length} update(s) → ${waves.length} wave(s):\n`);
  waves.forEach((wave, i) => {
    console.log(`  Wave ${i + 1} (run these in parallel): ${wave.join(', ')}`);
  });
  if (waves.length > 1 && !sliced) {
    console.log(`\n  ${waves.length} waves because some lanes still share stores/editorStore.ts.`);
    console.log(`  Re-run with --sliced to see how many waves collapse once the store is split.`);
  }

  console.log(`\n--- copy-paste briefs for the worker chats ---`);
  let wave = 0;
  for (const w of waves) {
    wave++;
    for (const lane of w) {
      const l = m.lanes[lane];
      console.log(`\n### Wave ${wave} · lane "${lane}" — ${l.title}`);
      console.log(`You own ONLY these files:`);
      for (const f of l.files) console.log(`  ${f}`);
      const dom = storeDomain(lane, m);
      if (dom) console.log(`Store: writes stores/editorStore.ts ('${dom}' state) — coordinate if another chat also touches it.`);
      else console.log(`Store: ${l.store} (independent).`);
      console.log(`Rules: do not edit other lanes' files or the spine (editorStore.ts, ScreenplayEditor.tsx,`);
      console.log(`  ToolDock.tsx, uiIcons.tsx, editor/extensions, api.ts). Registry edits append-only. Run the`);
      console.log(`  gates (cd frontend && npx tsc -b && npm test && npm run build), then push to claude/v0_32.`);
    }
  }
  return waves.length > 1 ? 1 : 0;
}

function classifyPaths(paths, m) {
  const lanesTouched = new Set();
  let spineHit = false;
  const unclassified = [];
  for (const p of paths) {
    if (isSpine(p, m)) { spineHit = true; console.log(`  SPINE       ${p}`); continue; }
    const ls = lanesForFile(p, m);
    if (ls.length === 0) { unclassified.push(p); console.log(`  ?           ${p}   (unclassified — assign it a lane in docs/lanes.json)`); }
    else { ls.forEach((l) => lanesTouched.add(l)); console.log(`  ${ls.join(',').padEnd(11)} ${p}`); }
  }
  console.log('');
  const lanes = [...lanesTouched];
  if (spineHit) console.log('Touches the SPINE — this is coordination-heavy; keep it to one chat.');
  if (lanes.length > 1) {
    console.log(`Spans ${lanes.length} lanes: ${lanes.join(', ')}. Check they belong together:`);
    return cmdLane(lanes, m, false);
  }
  if (lanes.length === 1) console.log(`All in one lane: ${lanes[0]} — safe as a single chat's work.`);
  if (unclassified.length) console.log(`\n${unclassified.length} unclassified file(s) — the manifest is a living doc; add them.`);
  return spineHit || unclassified.length ? 1 : 0;
}

function cmdFiles(paths, m) {
  if (!paths.length) fail('files: give one or more paths.');
  console.log('File → lane:\n');
  return classifyPaths(paths, m);
}

function cmdDiff(m) {
  let out = '';
  try {
    out = execSync('git diff --name-only HEAD', { cwd: join(HERE, '..'), encoding: 'utf8' });
  } catch (e) {
    fail(`git diff failed: ${e.message}`);
  }
  const paths = out.split('\n').map((s) => s.trim()).filter(Boolean);
  if (!paths.length) { console.log('No changed files vs HEAD.'); return 0; }
  console.log('Current diff → lane:\n');
  return classifyPaths(paths, m);
}

function selftest(m) {
  const checks = [];
  const assert = (name, cond) => checks.push([name, !!cond]);

  assert('CharacterProfiles → character lane', lanesForFile('frontend/src/components/CharacterProfiles.tsx', m).join() === 'character');
  assert('editorStore.ts is spine', isSpine('frontend/src/stores/editorStore.ts', m));
  assert('an extension file is spine (prefix)', isSpine('frontend/src/editor/extensions/Character.ts', m));
  assert('08 css shared by scenes+beatboard', sharedFiles('scenes', 'beatboard', m).length === 1);
  assert('scenes+beatboard conflict (shared css)', conflictReasons('scenes', 'beatboard', m, false).length > 0);
  assert('character+notes independent by DEFAULT (their domains are sliced)', conflictReasons('character', 'notes', m, false).length === 0);
  assert('toolbar+customize still conflict by default (chrome unsliced)', conflictReasons('toolbar', 'customize', m, false).length > 0);
  assert('toolbar+menus conflict even sliced (same chrome domain)', conflictReasons('toolbar', 'menus', m, true).length > 0);
  assert('character+notebook never conflict', conflictReasons('character', 'notebook', m, false).length === 0);
  assert('importexport+stats+collab all independent', conflictReasons('importexport', 'stats', m, false).length === 0 && conflictReasons('stats', 'collab', m, false).length === 0);

  let ok = true;
  for (const [name, pass] of checks) {
    console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}`);
    if (!pass) ok = false;
  }
  console.log(`\n${checks.filter((c) => c[1]).length}/${checks.length} passed.`);
  return ok ? 0 : 1;
}

function usage() {
  console.log(`check-lanes — parallel-chat lane overlap checker & dispatcher

  node scripts/check-lanes.mjs lane <laneA> <laneB> [...]     check chosen lanes for overlap
  node scripts/check-lanes.mjs plan [--sliced] <laneA> [...]  split updates into parallel-safe waves
  node scripts/check-lanes.mjs files <path> [...]             which lane(s) own these files
  node scripts/check-lanes.mjs diff                           classify the current git diff
  node scripts/check-lanes.mjs lanes                          list every lane
  node scripts/check-lanes.mjs --selftest                     run built-in assertions

  --sliced   model the world after stores/editorStore.ts is split into per-domain slices.`);
}

// ---- main -------------------------------------------------------------------

const argv = process.argv.slice(2);
const sliced = argv.includes('--sliced');
const rest = argv.filter((a) => a !== '--sliced');
const cmd = rest[0];
const args = rest.slice(1);

if (!cmd || cmd === 'help' || cmd === '-h' || cmd === '--help') { usage(); process.exit(0); }

const m = loadManifest();
let code = 0;
switch (cmd) {
  case '--selftest': case 'selftest': code = selftest(m); break;
  case 'lanes': cmdLanes(m); break;
  case 'lane': code = cmdLane(args, m, sliced); break;
  case 'plan': code = cmdPlan(args, m, sliced); break;
  case 'files': code = cmdFiles(args, m); break;
  case 'diff': code = cmdDiff(m); break;
  default: fail(`unknown command '${cmd}'. Run with no args for usage.`);
}
process.exit(code);
