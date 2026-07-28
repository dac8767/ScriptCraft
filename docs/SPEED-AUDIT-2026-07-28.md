# Speed audit — 2026-07-28 ("the last few small updates took 11 minutes")

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
2. **vitest: `isolate: false` in `vitest.config.ts`.** Workers reuse their
   environment across files. Measured: **34–50s → 10–14s**, 786/786 green
   either way. The trade: module singletons (zustand stores) persist across
   files within a worker — tests already reset what they touch in
   `beforeEach`, and new test files must keep doing that. If a failure ever
   appears only in full runs and smells like cross-file leakage, re-check
   with `npx vitest run --isolate` before chasing ghosts.

## 3. The working rules (the part that keeps it fast)

1. **Never type a fixture. Never sleep on a guess.** Drivers start with the
   kit; a bespoke driver is 15 lines of assertions on top of it. If a wait
   isn't on a named condition, it's a bug in the driver.
2. **One driver run answers every question.** Print all measurements in one
   pass; don't re-run a 100s script to read a second number. (With the kit a
   re-run is ~4s, but the habit still matters.)
3. **Iterate with `npx vitest related <changed files> --run`** (~3s, ~100
   tests for a SceneNavigator change). The **full suite runs once, right
   before commit** — it is the gate of record, not the iteration loop.
   `tsc -b` stays in the loop; it's incremental and catches the release
   blocker class.
4. **Session tooling lives in the repo** (`frontend/devtools/`), never only
   in the scratchpad. Rollbacks wipe the scratchpad; they cannot wipe a
   pushed commit.
5. **Docs-only edits don't re-run the suite.** Changelog/handoff text can't
   break a test; `tsc -b` + the commit gate cover the JSON import.
6. Keep the delivery batch discipline: verification is per-batch, not
   per-file-save.

## 4. Expected shape of a small update now

boot+seed+check driver ~5s × 2 runs, `related` tests ~3s × 2, full suite
~12s, tsc ~6s × 2, build ~4s, git ~10s → **~1 min of tool time** per small
update, plus reading/writing the code itself. The 11-minute figure was
~80% verification overhead, and that overhead is what this removes.

## 5. Not done, deliberately

- No parallel-worker changes — `docs/WORKERS.md` already covers that; this
  audit is about the single-chat loop.
- No test-count trimming or sharding — 786 tests at 12s doesn't need it.
- `environmentMatchGlobs` is deprecated in vitest 4 (warns on every run);
  migrating to `projects` is a mechanical follow-up, skipped here to keep
  this commit small.
