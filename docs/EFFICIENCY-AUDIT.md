# ScriptCraft — efficiency audit & cleanup backlog (2026-07)

Findings from a full read-only scan (four parallel explorers over components,
stores/utils/services, CSS, and backend/build/deps) plus manual spot-checks of the
top items. Tick items off as they land. Each is meant to be its **own small,
verified, individually-pushed commit** so Derek can test and revert per step.

Lane tags (see `docs/AREA-MAP.md`) show which chat should own each item.

> **Verified by spot-check:** 80 zips / 7.6 MB; `MobileAccessoryBar`,
> `CharacterConnectionsGraph`, `zipExport/zipImport` have zero live refs; `d3` has a
> single consumer; `project-list-page` CSS has zero TS/TSX hits.

---

## Tier 1 — delete now (zero / near-zero risk)

### Dead component files (~1,110 lines) — lane: `character` / `spelling` / spine
- [x] `components/MobileAccessoryBar.tsx` (265) — only ref is a "removed" tombstone comment in `ScreenplayEditor.tsx:78`  *(verified done, v5.93)*
- [x] `components/CharacterConnectionsGraph.tsx` + `CharacterConnectionsGraph.test.ts` (294) — superseded by `RelationshipMap`; **sole `d3` consumer** (`character`)  *(verified done, v5.93)*
- [x] `components/SpellCheckContextMenu.tsx` (181) — zero refs (`spelling`)  *(verified done, v5.93)*
- [x] `components/LanguageSelector.tsx` (81) — zero refs (`spelling`)  *(verified done, v5.93)*
- [x] `utils/zipExport.ts` + `utils/zipImport.ts` (~175) — zero importers (`importexport`)  *(verified done, v5.93)*
- [x] `editor/sceneReorder.ts` (127) — zero importers (spine/schema)
- [~] `editor/extensions/index.ts` — NOT dead after all: imported by `ScreenplayEditor.tsx:35` via the directory path `../editor/extensions`. Kept.

### Dead functions / store actions (~180 lines)
- [ ] `getEffectiveFormatting` `utils/effectiveFormatting.ts:102` (~64) — `templates`
- [ ] wrappers: `parseFDX` (`fdxParser.ts`), `downloadPDF` (`pdfExporter.ts`), `getCompat` (`services/compat.ts`), `demoMessage` (`demoInfo.ts`), `hasCustomTitlebar` (`platform.ts`), `isPaginationContinuous` (`pagination.ts`), `jsdelivrUrls` (`languageCatalog.ts`), `vomitLockActive` (`vomitStore.ts`)
- [ ] ~13 never-called `editorStore` actions: `addCharacter`, `add/update/deleteGeneralNote`, `setShelfTab`, `toggleBeatBoard`, `clearMirrorStatuses`, `clearReferredTag`, and the unused `setToolbar*` setters (keep the *fields*, drop the setters) — spine
- [ ] dead branches: `'scriptnotes'` (`Toolbar.tsx:634,1276`, `editorStore.ts`), unreachable `case 'structure'` (`ToolDock.tsx`)

### Repo hygiene
- [x] Delete the **80 `freescript-v0_*.zip`** (7.6 MB) from the working tree — referenced by nothing but "don't use these" docs. *(History purge to shrink the 63 MB `.git` is a separate, optional op — needs a force-push + re-clone on the Mac.)*  *(verified done, v5.93)*
- [x] Backend sidecar remnants: `backend/desktop_entry.py`, `backend/opendraft-api.spec`, `pyinstaller` in `backend/requirements.txt` (Docker already strips it)  *(verified done, v5.93)*
- [x] Vestigial root `package-lock.json` (89-byte, still named "FreeScript")  *(verified done, v5.93)*

### npm — lane: `importexport` / build
- [x] Drop `d3` (after deleting `CharacterConnectionsGraph`)  *(verified done, v5.93)*
- [ ] Drop test-only `esbuild` + `@xmldom/xmldom` (used only by `test-script/*.mjs`); verify-then-drop `@types/dompurify`
- [x] **Move `html2canvas` from devDependencies → dependencies** — it's imported by production `utils/screenshot.ts` (real packaging bug)  *(verified done, v5.93)*

### Stale / mis-branded docs & scripts
- [x] `docs/desktop-build.md` — defunct Python-sidecar build; **deleted**, README link repointed to `DESKTOP-RELEASE.md`
- [~] `docs/UPSTREAM-OPENDRAFT-NOTES.md` — **kept**: CLAUDE.md intentionally references it as the archived upstream notes
- [ ] Reconcile `docs/RELEASE.md` (OpenDraft-branded) vs `docs/DESKTOP-RELEASE.md`
- [x] `release.sh` — repo constant fixed to `dac8767/ScriptCraft`
- [x] Misleading "backend on port 8000" toast at `ScreenplayEditor.tsx` — genericised

---

## Tier 2 — dead CSS (~3,000 lines, ~15%) — DEFERRED, needs a visual pass

**Status: deferred on purpose.** Re-verification during the cleanup run found the
dead selectors are *interleaved with live ones* inside the flagged ranges — e.g.
`.drag-handle`, `.delete-btn`, `.color-picker-swatch`, `.sort-select` sit inside the
"Projects hub" block in `12`, and `.fs-timefield` (the live TimeField) sits inside
the `fs-vomit` block in `22`. The substring-absence method also had a confirmed
**false positive**: the `ribed-*` / `rib-edit-*` ribbon-editor cluster was flagged
dead but has 14–26 live TS/TSX references — it is **live, do not remove**.

Because dead and live rules are interleaved and CSS changes can't be caught by
`tsc`/`test`, this needs **per-rule removal with a visual check on the running app**
(the Playwright live-check recipe in `HANDOFF-CONTINUE.md`, or Derek watching a
build). Do it as its own focused pass; do NOT bulk-delete ranges. Verified-dead
prefixes so far (0 TS/TSX hits — safe to remove *as individual rules*):
`script-notes-panel`, `sn-*`, `general-notes-*`, `note-item-*`, `fs-vomit-*`,
`fs-projects-*`/`fs-project-*`, `project-*`, `props-*`, `source-badge`, `script-card-*`,
`open-project-group-header`.

- [x] `12-projects-assets.css` — DONE: 83 rules removed per-rule (1350→854) via the
  postcss triple-gate filter + live pixel-diff (0 px across 4 surfaces). The
  `props-field/label/input/textarea` cluster proved LIVE (current properties
  dialog) and stays — `props-*` was partly live, same lesson as `ribed-*`.
- [x] `03-toolbar.css` projects part — DONE: 25 rules (the `.fs-pm-embedded`
  duplicate block + `fs-project-*` chooser), 1256→1218.
- [x] `15-responsive.css` tail — DONE: 45 rules, 801→714.
- [x] `22-tools-extra.css` — DONE: 36 rules (1847→1642). `fs-vomit-*` confirmed
  orphaned: the vomit feature lives in GoalsTool rendering `fs-goal-*` classes.
  `.fs-timefield` (live) untouched; `note-item-flash`/`note-item-media` proved
  LIVE and stay.
- [x] `09-script-notes.css` — DONE: 47 rules (501→229).
- [~] `24-notebook.css` — ~313 (old ribbon editor `ribed-*`/`ruv-*`) (`notebook`)
- [~] `10-character-profiles.css` — ~203 (`character`)
- [~] `03-toolbar.css` — ~182 (mostly the duplicate project block + `zoom-menu-*`) (`toolbar`)
- [~] smaller: `19-sticky-notes.css`, `05-scene-navigator.css`, `13-production-tags.css`, `18-elements-templates.css`, `06-editor-content.css`, `25-confirm-outline-tabs.css`, `20-tool-dock.css`, `23-toolbar-zones.css`

Confirmed still USED (do **not** remove): `.rel-map-toolbar-label`, `.rel-map-toolbar-hint`.

---

## Tier 3 — simplify / dedup (single-source-of-truth)

- [ ] One shared `<Modal>` shell — ~30 dialogs hand-roll overlay + Escape + backdrop (34 Escape handlers) — spine/shell
- [x] `uuid()`: `formattingTemplateStore` now imports `utils/uuid` (its identical local copy removed). The 3 storage-backend copies are intentionally standalone (zero-dep fallback chain) — left as-is. Added a module-local `clamp()` in `editorStore.ts` replacing 12 inline `Math.min/​max` copies.
- [~] Color palettes → `utils/palettes.ts` created; the scene-color set (duplicated between `SceneNavigator` and `SynopsisModal`, differing only in `''` position) is now the shared `SCENE_SWATCH_COLORS`. The broader ~14 palettes are mostly *different* palettes for different purposes (highlight vs note vs beat colors) — consolidate case-by-case as genuinely-shared ones appear.
- [ ] ~10 hand-rolled positioned popup/context menus → a `<PopupMenu>`/`usePopup` primitive
- [ ] 4 storage backends share a ~40-method interface (all **live** — SQLite→file→localStorage fallback chain) → extract shared interface/helpers, not deletion
- [ ] Dormant generic-plugin scaffolding in `plugins/registry.ts` (~130 lines; only the grammar-provider half is live, and this repo has no Pro-plugin split) — confirm intent, then trim to the grammar registry

---

## Tier 4 — split the monoliths (the real speed fix)

Do incrementally, one extraction per commit. This is also what unblocks parallel
chats (see `docs/AREA-MAP.md`).

- [x] **`stores/editorStore.ts`** → per-domain slices. DONE: 10 slices in `stores/slices/`. **chrome-customization was deliberately NOT sliced** (Derek's call — it IS the store's core; see HANDOFF-CONTINUE §0.6). Then update `docs/lanes.json` (`editorStore:<domain>` → `own:<slice>`) so the checker frees those lanes.
- [~] **`components/ScreenplayEditor.tsx` (4,743 → 4,619)** → hooks. DONE: `useTouchGestures` (hooks/useTouch), **`usePanelResize`** (v5.88, +4 tests), **`useFileAssociation`** (v5.88). `useFileDrop` — the state it named is already gone; only a tombstone comment remained. **`useCollaboration`** (v5.89 — 335 lines out; the 326 refs closed over only 4 component-scope names). LEFT: the `<EditorDialogs>` host.
- [x] **`data/changelog.ts` (2,783 → 72)** → data array moved to `changelog.json` (359 versions / 573 items), imported statically; the file is now just types + tag logic + `APP_VERSION`. Source-scanning win done. *(Optional follow-up: make it a lazy `import()` in MenuBar to also drop it from the initial bundle — deferred as it touches the MenuBar spine file.)*
- [x] ~~**`components/MenuBar.tsx`** → per-menu builder modules~~ **ATTEMPTED AND REVERTED (v5.90). Do not re-attempt as specified.**
  - Diagnostics is ALREADY split (`DiagnosticsDialog` is its own module; only the open/close state remains here, which is correct).
  - Per-menu builders were tried and backed out. A first scan suggested clean seams — View "needs 5 things", Tools "needs none" — and that scan was WRONG: it counted only top-level `const` declarations and missed props, store destructuring and hook returns. Measured properly by compiling the extracted modules, **View needs 43 context fields**, Project 14, Format 11. Threading 43 fields through a ctx object to move 216 lines makes the call site worse than the thing it replaces.
  - **The lesson for any future split here:** free-variable analysis must come from the COMPILER (extract, build, read the "Cannot find name" errors), not from a regex over declarations. A regex undercounts, and undercounting is how a refactor gets started that should not have been.
- [x] ~~**`components/Toolbar.tsx`** → token→renderer map~~ **DECLINED (v5.90).** NOTE (v5.88): this is not the mechanical move the line implies — every case closes over component state (`scrapbookOpen`, `editor`, a dozen handlers), so lifting it means threading a ~30-field context object. Do it by DOMAIN group (format / insert / view), each taking a narrow slice, not as one flat map.
- [x] **`components/CharacterProfiles.tsx`** → the valuable parts are DONE: `utils/characterScan` (extracted + tested) and `CharacterAssetMedia` (its own module). Per-tab components were measured (v5.90) and are not worth it: the Relationships tab is 20 lines and From Script is 85; the file's weight is shared handlers and `renderCharacterFields`, which belong to no single tab.

---

## Suggested sequence

1. Tier 1 repo hygiene (zips, docs, sidecar remnants, npm) — instant clone win, near-zero risk
2. Tier 1 dead files + dead functions/actions — ~1,300 lines gone
3. `changelog` → JSON + lazy-load (Tier 4) — removes 2.7k from the hot path
4. Tier 2 dead CSS, cluster-by-cluster
5. Tier 3 `<Modal>` + small dedups
6. Slice `editorStore` + extract `ScreenplayEditor` hooks (Tier 4) — unlocks full parallelism

---

## v5.85 — why a round takes as long as it does (measured, 4-core box)

Derek: "updates are getting slow again."

| step | cost |
|---|---|
| `npx tsc -b` | 17s |
| `npm test` (1055 tests) | 39s |
| `npm run build` (runs tsc again) | 21s |
| ONE browser check, 3 assertions | 7.3s — of which ~6s is fixed boot |
| all 66 `check-*.mjs`, serially | ~15 min |

**The fixed cost is the whole story.** Every check launches a browser, loads
the app, seeds a script and opens a tool before it asserts anything — about
6s — and there are 66 of them. The assertions themselves are nearly free.

### What changed

- **`devtools/check-all.mjs`** runs the files CONCURRENTLY and warms the dev
  server first (Vite compiles on demand; without a warm-up several checks
  each pay the same cold compile). 933s of work → 490s wall.
- **Targeted runs**: `node devtools/check-all.mjs v581 v585` — 6 files in 77s
  instead of 15 minutes. Iterate targeted; run the suite once before pushing.
- **The suite's wall time is its slowest FILE**, not its total. check-v582
  drove seven browser sessions back to back and set the floor at 62s; its
  independent scenarios now run together — 39s, and the whole suite's floor
  drops with it. Keep a check file to one browser session, or Promise.all
  the sessions inside it.
- Concurrency past ~4 buys nothing here (77s at 4 jobs, 80s at 6): the long
  pole is one file, not the queue.

### Still on the table

- **~6s of boot per check, 66 times over.** One browser serving many checks
  from a pre-seeded snapshot would take a large bite out of ~400s of pure
  setup. It means reworking every check's preamble, so it wants doing once,
  deliberately.
- **48 assertions across the older checks fail because the app deliberately
  changed** (Pages tabs in v567/v571, the display-name-in-the-list that v5.85
  reverses). Each stale selector costs a 30s timeout as well as trust. Triage:
  repair what still describes the app, retire what does not.
- `npm run build` re-runs `tsc -b`. Running both is 17s of duplicate work —
  build alone is the gate.


## The triage (v5.86) — what the suite actually was

**Correction first: my "48 failing assertions" was largely my own runner.**
Twelve files report `OK/FAIL` per assertion instead of a `N passed, M failed`
summary, and check-all — written the same day — scored every one of them as a
total failure. Reading both conventions is two lines, and those files were
green all along (`check-ribbon-kinds` 20, `check-ribbon-zero` 19,
`check-scenes-v520` 11).

The real state was 579 passed / 48 failed across 28 files. After triage:
**551 passed, 0 failed, 193s wall** (from ~15 min serial).

### The rule, and why

- **A few assertions failing among many** → the file still describes today's
  app; the stale lines were retired in place with a note naming what
  superseded them. 14 files, ~25 assertions. The file goes on guarding.
- **Most of a file failing** → the feature it drove had been rebuilt. Archived
  to `devtools/archive/` with a table of what replaced each. 17 files.

The rule earned itself the hard way: removing a stale assertion is easy, but
the SETUP that drove the retired feature stays behind — clicks that open a
popover that no longer exists — and crashes. Five files were reverted and
archived after exactly that. Half-repairing a check is worse than parking it.

### Where the time went, after

| | before | after |
|---|---|---|
| full suite | ~15 min serial | **193s** |
| targeted (`check-all.mjs v581 v585`) | — | **61s** |
| a wrong selector while writing a check | 30s | **8s** |
| files that report nothing readable | 12 | 0 |

### Still open

- **246 fixed sleeps** (`waitForTimeout`) remain, ~61s of pure waiting per
  run, and each is a flake when the machine is loaded. `settle(page)` — two
  animation frames — replaces the 205 that are ≤300ms. Do it as one change
  with a full-suite run either side, and revert per file if any turns red.
- **~6s of boot × 49 files.** One browser serving many checks from a seeded
  snapshot is the next real cut, and it wants doing deliberately.


## v5.87 — the last two levers, and where it stops

Full suite: **551 passed, 0 failed, 154s** (from ~15 min serial this morning).

### boot() was loading the app twice

`goto` → `localStorage.clear()` → `reload`. Every check paid the app's whole
startup cost twice, 49 times over. An init script clears storage before the
first load instead, so the reload is gone — but it must clear ONCE: an
unguarded init script runs before EVERY navigation, and check-v551 seeds a
stale toolbar layout then reloads to watch it migrate. It lost its seed and
went red. The marker lives in sessionStorage: survives a reload, not a new
page. The suite caught this within one run of introducing it, which is the
argument for running it either side of a change like this.

### 157 fixed sleeps replaced with settle()

Every `waitForTimeout(n)` with n ≤ 300 became `settle(page)` — two animation
frames, ~30ms, waiting for the thing the sleep was guessing at. 47 longer
sleeps are left alone: those wait for something real (a debounce, a save, an
animation), and two frames would be a flake, not a speed-up.

### Where the per-check cost now goes

| | |
|---|---|
| launch the browser | 0.24s |
| **load the app (Vite dev)** | **2.40s** |
| seed the script | 0.25s |
| open a tool | 0.37s |

### Why the shared-boot harness was NOT built

The 2.4s is the app loading through Vite's dev server — hundreds of module
requests. Two ways to cut it, both rejected:

1. **Serve a built bundle.** Loads far faster, but `window.__scEditor` and
   `window.__scStore` — which every check drives — are behind
   `import.meta.env.DEV`, false in any build. Getting them into a bundle
   means widening a production-safety guard so the checks can go faster.
   Not worth it: that guard is why nothing ships with a live handle on the
   editor.
2. **One page serving many checks.** Saves the 2.4s per file, but the runner
   spawns a process per file, so it means every check becoming a function the
   runner calls with a shared page — a rewrite of 49 files, and each one
   inheriting whatever DOM state the last left behind. The reload between
   checks is what makes them independent.

**The returns have flattened.** 15 min → 154s came from parallelism, a
fail-fast timeout, one wasted page load and 157 sleeps. The next 60s costs
either a weakened guard or a 49-file rewrite. Stop here; spend it on the app.


## v5.90 — where the splitting stops, and why

Three hooks came out of ScreenplayEditor (v5.88–v5.89) and were worth it:
each was a coherent unit that closed over almost nothing. The rest of the
list was measured and mostly declined:

| item | verdict |
|---|---|
| `useCollaboration` | **done** — 335 lines, 4 free names |
| `usePanelResize`, `useFileAssociation` | **done** — small, and now tested |
| `<EditorDialogs>` host | **declined** — 105 lines of pure JSX for a 24-prop interface, no testability gain |
| MenuBar per-menu builders | **attempted, reverted** — View needs 43 ctx fields, not the 5 a regex claimed |
| MenuBar Diagnostics | **already done** |
| CharacterProfiles per tab | **declined** — tabs are 20 and 85 lines; the real extractions already landed |
| Toolbar 32-case switch | **declined** — every case closes over component state (~30 fields) |

**The pattern across all of them:** a long file is not automatically a
badly-structured one. These components are long because they coordinate a lot
of state, and coordination does not move — it only gets renamed to "context"
and passed through a wider door. The splits that paid off were the ones with
a real boundary: a lifecycle (collab), a device concern (file association), a
self-contained interaction (panel resize). The ones that did not pay off were
slices of a render tree, which is not a boundary at all.


> **The CSS cluster boxes below/above are marked `[~]`, not `[x]`:** the v5.92
> pass removed only the styles of provably-deleted components. The bulk in
> those files (`ribed-*`, `ruv-*`, character-profile leftovers) is in the 292
> candidates DECLINED for the reasons in that section — they are not "still to
> do", they are "do not do this by analyser".

## v5.92 — the dead-CSS pass: 202 lines cut, 315 candidates DECLINED

A static sweep found 2,538 class selectors and 315 with no reference anywhere
in the repo. **Only 23 of them were removed.** The other 292 were left, and
the reason is the point of this entry.

### Why a blanket sweep is unsafe here

The candidate list contained provably-wrong entries — classes nothing in this
repo writes because something ELSE applies them:

- `recharts-cartesian-axis-line`, `recharts-pie-label-text`, … — the charting
  library emits these.
- `ProseMirror-focused`, `ProseMirror-selectednode`, `is-editor-empty` — TipTap
  and its Placeholder extension emit these.
- `pv-sceneHeading`, `page-thumb-transition`, `diff-el-character`,
  `track-change-deleted-dialogue`, `grammar-style` — built by concatenation
  from a type or severity, and a regex only catches the construction patterns
  it was taught.

Two of those categories were caught by inspection. **The existence of two
categories I caught is evidence for a third I did not**, and the failure mode
— an unstyled control, in a build that compiles and passes every test — is
exactly the silent kind this project treats as the cardinal sin.

### What WAS removed, and the rule that made it safe

Only CSS whose component is provably gone, each verified against the source
and the history that removed it:

- `mob-acc-*`, `mobile-accessory-bar` — MobileAccessoryBar was deleted; only
  a tombstone comment remained.
- `locmap-pin-tool*`, `locmap-rail-head`, `locmap-rail-count` — replaced by
  the row menus in v5.85.
- `locmap-options-btn` — the button moved to the action row in v5.81.
- `locmap-toolbar`, `locmap-pin-remove`, `locmap-scroll-over`,
  `locmap-locked`, `locmap-rail-sub` — superseded across v5.75–v5.85.

And the cutting tool only removes a rule when EVERY class in its selector
list is dead. A rule shared with a live selector stays, because losing one
live selector out of a group is precisely the silent breakage being avoided.

**If this is picked up again:** the safe unit of work is "a component was
deleted — remove its styles", done per removal, not "the analyser says 315
classes are unused". The second framing is how a UI loses its styling in a
way no test can see.
