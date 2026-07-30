#!/usr/bin/env node
/**
 * harvest-calibration.mjs
 *
 * Turns the local rewrite log into candidate calibration pairs for the system
 * prompt at src-tauri/prompts/action_line_rewrite.md.
 *
 * The premise: the most valuable before/after pair is not one written
 * deliberately in a design session. It is the one where the writer accepted a
 * variant and then changed it. That change is the writer correcting the model on
 * their own material, which is exactly the signal the prompt's calibration
 * section wants.
 *
 * Usage:
 *   node scripts/harvest-calibration.mjs --log <path> [--max 12] [--stats]
 *
 * Get the log path from the app: Settings, or the rewrite_log_path command.
 *
 * Output is markdown on stdout, ready to review and paste into the WRITER'S OWN
 * CALIBRATION block of the prompt.
 *
 * Deliberately manual. Nothing here writes to the prompt file, for two reasons:
 * unreviewed model output must never become an exemplar, and the prompt has to
 * stay a stable byte-identical cache prefix rather than something generated at
 * runtime.
 */

import { readFileSync } from "node:fs";
import { argv, exit } from "node:process";

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

function arg(name, fallback = null) {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = argv[i + 1];
  return v && !v.startsWith("--") ? v : true;
}

const logPath = arg("log");
const max = Number(arg("max", 12));
const statsOnly = arg("stats", false) === true;

if (!logPath || logPath === true) {
  console.error(
    "usage: node scripts/harvest-calibration.mjs --log <path> [--max 12] [--stats]",
  );
  exit(1);
}

// ---------------------------------------------------------------------------
// Load and join
// ---------------------------------------------------------------------------

let raw;
try {
  raw = readFileSync(logPath, "utf8");
} catch (e) {
  console.error(`Could not read ${logPath}: ${e.message}`);
  exit(1);
}

const suggestions = new Map(); // eventId -> record
const outcomes = new Map(); // eventId -> record
let torn = 0;

for (const line of raw.split("\n")) {
  const t = line.trim();
  if (!t) continue;
  let rec;
  try {
    rec = JSON.parse(t);
  } catch {
    torn++; // a final line written mid-crash
    continue;
  }
  if (rec.kind === "suggestion") suggestions.set(rec.eventId, rec);
  else if (rec.kind === "outcome") outcomes.set(rec.eventId, rec);
}

const words = (s) => (s || "").trim().split(/\s+/).filter(Boolean).length;
const norm = (s) => (s || "").trim().replace(/\s+/g, " ");

/**
 * Shape bonuses shared by every pair kind. Prefer meaningful compression on
 * passages long enough to actually demonstrate something: a two-word line that
 * got shorter teaches less than a bloated paragraph that got cut in half.
 */
function bonuses(sug, compression) {
  let n = 0;
  if (compression < 0.7) n += 20;
  if (compression < 0.5) n += 10;
  if (words(sug.original) >= 25) n += 15;
  if (words(sug.original) >= 12) n += 5;
  if (sug.assessment === "improvable") n += 5;
  if (sug.locationEstablished) n += 5;
  return n;
}

// ---------------------------------------------------------------------------
// Classify
// ---------------------------------------------------------------------------

const pairs = [];
const dismissals = [];
const strategyCounts = new Map();
const contributions = new Map();
let accepted = 0;
let composed = 0;

for (const [id, sug] of suggestions) {
  const out = outcomes.get(id);
  if (!out) continue; // panel still open, or app closed before resolving

  if (out.outcome === "dismissed") {
    dismissals.push(sug);
    continue;
  }
  if (out.outcome !== "accepted" || !out.chosenStrategy) continue;

  // The custom slot has no offered variant to compare against. It is also the
  // best pair available: original passage in, the writer's own text out, with
  // no model voice in the result at all.
  accepted++;
  strategyCounts.set(
    out.chosenStrategy,
    (strategyCounts.get(out.chosenStrategy) || 0) + 1,
  );

  if (out.chosenStrategy === "custom") {
    const after = out.finalText;
    if (!after || norm(sug.original) === norm(after)) continue;
    composed++;
    for (const from of out.composedFrom || []) {
      contributions.set(from, (contributions.get(from) || 0) + 1);
    }
    const comp = words(after) / Math.max(1, words(sug.original));
    pairs.push({
      // Composed drafts get the top base score plus the same shape bonuses the
      // model-derived pairs earn, so ranking stays comparable across kinds.
      score: 130 + bonuses(sug, comp),
      editKind: "composed",
      wasEdited: true,
      strategy: "custom",
      before: sug.original,
      after,
      modelText: "",
      note: "",
      compression: comp,
      tsMs: sug.tsMs,
      composedFrom: out.composedFrom || [],
    });
    continue;
  }

  const offered = (sug.variants || []).find(
    (v) => v.strategy === out.chosenStrategy,
  );
  if (!offered) continue;

  const finalText = out.finalText || offered.text;

  // Prefer the recorded classification from the panel. Fall back to a text
  // comparison for records written before editKind existed.
  let editKind = out.editKind;
  if (!editKind) {
    editKind = norm(finalText) === norm(offered.text) ? "none" : "substantive";
  }
  const wasEdited = editKind !== "none";

  const before = sug.original;
  const after = finalText;
  if (!before || !after) continue;
  if (norm(before) === norm(after)) continue; // nothing was learned

  const compression = words(after) / Math.max(1, words(before));

  // Ranking. An edited accept is the writer correcting the model on their own
  // material, so it outranks everything. Beyond that, prefer meaningful
  // compression and passages long enough to actually demonstrate something.
  let score = bonuses(sug, compression);
  // A substantive edit is the writer rewriting the model on their own material,
  // which is the whole point. A punctuation swap is a preference, not a lesson,
  // so it scores no better than a clean accept.
  if (editKind === "substantive") score += 100;
  else if (editKind === "minor") score += 40;

  pairs.push({
    score,
    wasEdited,
    editKind,
    strategy: out.chosenStrategy,
    before,
    after,
    modelText: offered.text,
    note: offered.note,
    compression,
    tsMs: sug.tsMs,
  });
}

pairs.sort((a, b) => b.score - a.score);

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const editedCount = pairs.filter((p) => p.wasEdited).length;
const substantiveCount = pairs.filter((p) => p.editKind === "substantive").length;

console.log(`# Calibration harvest

Log: \`${logPath}\`
Suggestions logged: ${suggestions.size}
Resolved: ${outcomes.size} (accepted ${accepted}, dismissed ${dismissals.length})
Usable pairs: ${pairs.length}, of which ${editedCount} were edited (${substantiveCount} substantively)
Composed in the custom slot: ${composed}
${torn ? `Unparseable lines skipped: ${torn}\n` : ""}`);

if (strategyCounts.size) {
  console.log("Accepted by strategy:\n");
  for (const [s, n] of [...strategyCounts].sort((a, b) => b[1] - a[1])) {
    const pct = Math.round((n / accepted) * 100);
    console.log(`- ${s}: ${n} (${pct}%)`);
  }
  console.log(`
If one strategy is near zero across a few dozen accepts, that slot is dead
weight and the design should lose it. If one is above roughly 70 percent, the
other two may not be earning their latency.
`);
  if (contributions.size) {
    console.log("Beats contributed to composed drafts:\n");
    for (const [s, n] of [...contributions].sort((a, b) => b[1] - a[1])) {
      console.log(`- ${s}: ${n}`);
    }
    console.log(`
A variant that is rarely chosen outright but often contributes beats is earning
its place. One that does neither should be cut.
`);
  }
  if (composed > accepted * 0.5 && accepted >= 10) {
    console.log(`Note: the custom slot is winning most of the time (${composed}/${accepted}).
That means the three suggestions are useful as raw material but rarely right as
written. Worth revisiting the prompt rather than adding more variants.
`);
  }
}

if (statsOnly) exit(0);

if (!pairs.length) {
  console.log(
    "No usable pairs yet. Accept some suggestions, and edit them where they are not quite right.",
  );
  exit(0);
}

console.log(`---

## Candidate pairs, best first

Review each one. Keep only those where the "after" is genuinely how you would
write it, and where the "before" shows a mistake worth teaching. Then paste the
keepers into the WRITER'S OWN CALIBRATION block of
\`src-tauri/prompts/action_line_rewrite.md\`.

A **REWRITTEN** pair means you substantially changed the model's output. Those
are the most valuable, because the delta is you correcting it on your own
material. Read the model's version too, shown as a comment, since the gap between
it and yours is the lesson. Punctuation-only edits are not promoted: they are
real preferences but they teach nothing.
`);

for (const [i, p] of pairs.slice(0, max).entries()) {
  const pct = Math.round(p.compression * 100);
  const tag = {
    composed: "COMPOSED BY YOU",
    substantive: "REWRITTEN",
    minor: "lightly edited",
    punctuation: "punctuation only",
    none: "accepted as-is",
  }[p.editKind];
  console.log(`
### ${i + 1}. ${tag} \u00b7 ${p.strategy} \u00b7 ${pct}% of original length

Before:
\`\`\`
${p.before.trim()}
\`\`\`
After:
\`\`\`
${p.after.trim()}
\`\`\`
`);
  if (p.editKind === "substantive" || p.editKind === "minor") {
    console.log(`<!-- model offered: ${norm(p.modelText)} -->`);
  }
  if (p.editKind === "composed") {
    const from = (p.composedFrom || []).join(", ") || "written from scratch";
    console.log(`<!-- borrowed beats from: ${from} -->`);
  }
  if (p.note) console.log(`<!-- model's note: ${p.note} -->`);
}

if (dismissals.length) {
  console.log(`
---

## Dismissed passages (${dismissals.length})

All three variants rejected. These are failures, not pairs, so they do not
belong in the prompt. They are worth reading: a cluster of similar dismissals
points at a rule the prompt is missing or getting wrong.
`);
  for (const d of dismissals.slice(0, 10)) {
    console.log(`- ${norm(d.original).slice(0, 140)}`);
  }
}
