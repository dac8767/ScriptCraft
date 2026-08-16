# Speed audit — 2026-07-28 ("the last few small updates took 11 minutes")
> Followed up 2026-08-16 ("updates are getting very slow again") — see §6-§9 at the end.

Derek's complaint is about **delivery latency**: the wall-clock time from his
message to "restart the app". This audit reconstructs where those minutes
actually went across v5.02–v5.05, fixes the two dominant sinks with measured
results, and writes down the working rules that keep it fast. It is about the
workflow, not the app — nothing here changes what ships (the one `src/` touch
is `import.meta.env.DEV`-gated and compiled out of release builds).

> Previous audits are different documents: `EFFICIENCY-AUDIT.md` is the dead-
> code backlog, `AUDIT-2026-07-26.md` is the release/security audit.

---

## 1. Where an 11-minute "small update" actually went

Reconstructed from the v5.02–v5.05 deliveries (each shipped 1–5 small UI
changes):

| Sink | Cost per delivery | Share |
|---|---|---|
| Playwright verification drivers, 3–5 runs × ~100–140s | **5–8 min** | ~60–70% |
| Full vitest suite 2–3× × 34–50s | 1.5–2.5 min | ~20% |
| `tsc -b` (incremental) ~6s × 4–6 runs | ~0.5 min | small |
| `npm run build` (rolldown) | 3–6s | negligible |
| Process losses (below) | 0–3 min, spiky | variable |

**Why the drivers cost 100–140s each.** Every driver paid the same tax, every
run: a fixed `waitForTimeout(4000)` boot wait, then **typing the fixture
script through the UI at keystroke granularity** (30–110 lines × ~50 chars),
then 6–9 scattered 600–2000ms sleeps. Measured head-to-head today with the
same end state (app booted, 4-scene script present, Scenes tool open, rows
counted):

```
OLD : boot 7.8s  type 98.4s  open 2.2s  total 108.4s
KIT : boot 3.3s  seed  0.1s  open 0.2s  total   3.5s     (31× faster)
```

**Why the suite cost 34–50s.** vitest built a fresh jsdom environment per
test file (105 files — `environment` line reads 60–87s of per-file setup).
And the full suite ran 2–3× per delivery when only the final pre-commit run
needed to be the full suite.

**Process losses**, spiky but real:
- Sandbox rollbacks (≥6 this session) cost a reset + `npm install` + Vite
  restart, and one wiped the session scratchpad — **taking every driver
  script with it**, mid-audit. Tooling that lives outside the repo dies.
- Re-running a whole 100s driver because one measurement line was wrong
  (v505.mjs ran 3× for one number).
- Heredoc edit scripts failing on `cd`-reset (`Shell cwd was reset`) and
  being re-run.

## 2. What changed (all landed in this commit)

1. **`frontend/devtools/driver.mjs` — the shared driver kit, in the repo.**
   - `boot(page)`: event-driven startup (waits on `.ProseMirror` + the DEV
     editor handle, not a stopwatch).
   - `seedScript(page, scenes)`: injects the whole fixture in **one
     `setContent` call** via `window.__scEditor` — a DEV-only handle exposed
     by ScreenplayEditor (gated exactly like the Airtable dev panel;
     `import.meta.env.DEV` is false in `npm run build`, so nothing ships).
     This is the 98s → 0.1s line.
   - `openTool` / `fullscreen` / `waitScenes` / `shot` helpers, all condition-
     waited; `dpr: 1` by default (dpr 2 quadruples capture cost and is only
     worth it when the deliverable is a screenshot).
   - `devtools/bench-boot.mjs` reproduces the OLD/KIT numbers above — rerun it
     if the kit ever feels slow again.
   - `playwright-core` is now a **devDependency** so the kit resolves from a
     fresh clone (it was only in the session scratchpad — see rollback loss
     above). It has no install scripts and downloads no browser; the sandbox
     browser lives at `/opt/pw-browsers/chromium`.
2. **vitest: `isolate: false` — tried, measured, and REVERTED same-day.**
   It delivered 34–50s → 10–14s, then produced exactly the predicted failure
   mode within hours: order-dependent flakes (Scrapbook caret/focus tests
   red only when certain files shared a worker; 2-of-3 full runs failing).
   Two real leaks were found and fixed (`src/test/sharedEnvReset.ts`: dirty
   document + notebookStore accumulating pages across files) — and a
   fifth-run flake REMAINED, so the gate went back to full isolation.
   **A gate that is sometimes wrong is worse than one that is 20s slower.**
   What survives: the per-file hygiene reset (real bugs, kept), and the
   iteration loop below — `vitest related` is where the test-time win
   actually lives. Full suite: ~34s, deterministic, once per delivery.

## 3. The working rules (the part that keeps it fast)

1. **Never type a fixture. Never sleep on a guess.** Drivers start with the
   kit; a bespoke driver is 15 lines of assertions on top of it. If a wait
   isn't on a named condition, it's a bug in the driver.
2. **One driver run answers every question.** Print all measurements in one
   pass; don't re-run a 100s script to read a second number. (With the kit a
   re-run is ~4s, but the habit still matters.)
3. **Iterate with `npx vitest related <changed files> --run`** (~3s, ~100
   tests for a SceneNavigator change). The **full suite runs once, right
   before commit, isolated** — it is the gate of record, not the iteration
   loop. `tsc -b` stays in the loop; it's incremental and catches the
   release blocker class.
4. **Session tooling lives in the repo** (`frontend/devtools/`), never only
   in the scratchpad. Rollbacks wipe the scratchpad; they cannot wipe a
   pushed commit.
5. **Docs-only edits don't re-run the suite.** Changelog/handoff text can't
   break a test; `tsc -b` + the commit gate cover the JSON import.
6. Keep the delivery batch discipline: verification is per-batch, not
   per-file-save.

## 4. Expected shape of a small update now

boot+seed+check driver ~5s × 2 runs, `related` tests ~3s × 2, full suite
~34s (isolated, deterministic), tsc ~6s × 2, build ~4s, git ~10s →
**~1.5 min of tool time** per small update, plus reading/writing the code
itself. The 11-minute figure was ~80% verification overhead; the driver kit
removed most of it, and the suite stays honest rather than fast-but-flaky.

## 5. Not done, deliberately

- No parallel-worker changes — `docs/WORKERS.md` already covers that; this
  audit is about the single-chat loop.
- No test-count trimming or sharding — 786 tests at 12s doesn't need it.
- `environmentMatchGlobs` is deprecated in vitest 4 (warns on every run);
  migrating to `projects` is a mechanical follow-up, skipped here to keep
  this commit small.

---

# Follow-up — 2026-08-16 ("updates are getting very slow again")

Same complaint, ~100 versions later. §4 above predicted **~1.5 min of tool
time** for a small update; a v7.24-sized delivery now costs **5–8 min**. This
section is the re-measurement, what was fixed, and the one finding that caps
how much further this can go.

## 6. Where it goes now (measured on v7.24, 4-core box)

| Gate | Cost | Note |
|---|---|---|
| `check-all --jobs=4` (91 checks) | **219s wall / 853s work** | didn't exist in July |
| `vitest run` (141 files, 1256 tests) | **48s** | of which **7.5s is tests** |
| `npm run build` | 15s | vite itself 3.4s |
| `tsc -b` incremental | ~6s | |

**The regression is check-all.** July's §4 shape assumed "the driver for this
version, ~5s, twice". The suite has since grown to 91 checks — one per version,
none ever retired — and running all of them became the routine gate. That
single change accounts for most of 1.5 min → 5–8 min.

Three things were measured and found NOT to be the problem, so nobody spends a
day on them again:

- **Scheduling is finished.** 853s of work / 4 jobs = 213s; actual wall 219s.
  That is ~97% parallel efficiency. There is nothing left in the scheduler.
- **Startup is small.** Instrumented: browser launch 221ms, boot (goto +
  `.ProseMirror` + DEV handle) 2.1s, settle 27ms. ~2.3s × 91 = 209s, 24% of
  the work. Pooling browsers across checks would reclaim a fraction of that,
  for real cross-contamination risk.
- **Sleeps are small.** Every hardcoded `setTimeout`/`waitForTimeout` in all
  91 checks totals **31s** — 3.6% of the work. §3's "never sleep on a guess"
  rule held.

So the suite is slow because it does 853 seconds of honest work, and that
number grows by ~8s per version. The only lever is running fewer of them in
the loop.

## 7. What changed

**`devtools/check-map.json` + `--changed`.** `build-check-map.mjs` derives,
per check, the `frontend/src` files it covers — from the commit that ADDED it
(these are written one per version, in the feature's own commit) plus every
`src/` path the check `readFileSync`s. `check-all --changed` then runs only
the checks whose files the diff touches. `--changed=<ref>` compares against a
ref instead.

Nobody annotates 91 files and nobody maintains an annotation, so the map is
derived and disposable — regenerate it any time. **A check with no map entry
is always run**: unmapped means unknown, and unknown must not mean skipped.
The failure mode is spent time, never lost coverage, and the full suite is
still the gate of record before a push.

One trap worth recording, because the first build was useless: `changelog.json`
and `changelog.ts` appeared in **90 of 91** maps — every version commit bumps
them — so every change matched everything and the filter selected 90/91. Files
appearing in more than 60% of the introducing commits are now dropped from the
commit-derived signal as *ceremony, not coverage* (a check that genuinely
reads one still picks it up from the readFileSync signal).

Measured selection, and what it costs at 4 jobs:

| Diff | Checks | Wall |
|---|---|---|
| one util (`titlePageDraftLine.ts`) | 1 / 91 | ~2s |
| one dialog (`FeedbackTool.tsx`) | 2 / 91 | ~5s |
| the PDF exporter | 4 / 91 | ~10s |
| one CSS file (`22-tools-extra.css`) | 18 / 91 | ~43s |
| `editorStore.ts` alone | 28 / 91 | ~67s |
| **v7.24 as shipped** (3 hub files) | **54 / 91** | **137s** (vs 219s, both green) |

## 8. The finding that caps it — the hub files

`--changed` gives a v7.24-sized delivery 137s instead of 219s. It gives a
one-file change 2s. The gap between those two numbers is the whole story:

```
checks whose coverage includes …
   28   stores/editorStore.ts
   23   components/SceneNavigator.tsx
   22   components/MenuBar.tsx
   21   components/ScreenplayEditor.tsx
   19   components/ToolDock.tsx
```

Touch `editorStore.ts` and a third of the suite is in scope — correctly, since
a third of the app's behaviour is in that file. **The monoliths are why change-
based selection can only go so far, and they are the same reason a change costs
so much to even write:** ScreenplayEditor.tsx is 3,972 lines, MenuBar.tsx 2,484,
editorStore.ts 2,393, Toolbar.tsx 2,203. Every edit starts by grepping through
them, and every edit puts a third of the suite back in scope.

The stalled refactor backlog — slicing the chrome domain out of editorStore,
splitting ScreenplayEditor into hooks, splitting MenuBar/Toolbar — is therefore
not housekeeping. **It is the remaining speed work**, and it pays twice: less
to read per change, fewer checks per change.

## 9. Working rules (amending §3)

7. **`check-all` is not a per-delivery gate — run it once.** Iterate with
   `--changed` (and the one new check directly); the full 91 runs once, before
   the push. Same rule §3.3 already gave for vitest, applied to the suite that
   grew after it was written.
8. **`vitest related <files> --run` for iteration** still stands, and matters
   more now: 40 of the suite's 48s is per-file jsdom setup and module import,
   not tests. `isolate: false` fixes that and was **tried, measured and
   reverted** in §2 — do not retry it without reading why.
9. **Regenerate the map when checks are added**: `node devtools/build-check-map.mjs`.
   It is cheap, and a stale map only ever runs too much.
