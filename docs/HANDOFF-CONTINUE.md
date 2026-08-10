# ScriptCraft — continuation brief (current as of v6.70 — READ docs/SPEED-AUDIT-2026-07-28.md §3 before verifying anything; NOTE the isolate:false revert in §2)

> READ FIRST — v4.84 fixed a v4.81 bug worth learning from: the window
> shape-memory was written correctly and then OVERWRITTEN by the dock-row
> click handler (`setToolMode(id,'docked')` on every open), so the
> commonest way to reopen a tool erased the memory. My driver had tested
> the Tools MENU path and passed; Derek hit the panel-row path. When a
> feature has several entry points, drive the one the user actually
> uses — the rule now lives in ToolDock's `openFromRow`: opening READS
> the mode, only explicit gestures WRITE it.


> QUEUE — NEXT UP (Derek, 2026-07-31, verbatim): **ONE PRESET EXPORT
> WINDOW.** "I want to combine all of the various preset exports into one
> tool. this is how it will work: anywhere in the app, if you click export
> theme preset, export settings preset, export workspace... whatever you
> choose, they all lead to the same preset export window. In this window,
> there is a checklist of all the various things that can be exported as
> presets: workspaces, themes, settings, etc. You check which of these you
> want to include, and it exports a single file holding the info for the
> presets for each of the items you selected."
> Build notes: utils/presets.ts (v4.79) is the foundation — it already
> compiles customizations/full-preset/themes/outline-presets and owns the
> `_<type>.json` filename rule, and PresetsPanel/PresetsDialog is the
> File ▸ Export ▸ Presets window. What this spec ADDS: (a) a per-category
> CHECKLIST producing ONE combined file (a bundle format with per-section
> keys — version it), (b) WORKSPACES as an exportable category (not in the
> v4.79 set; snapshots live in workspacesSlice/viewState), (c) EVERY
> scattered export door (ThemesTab, outline presets, Settings ▸ Backup,
> Customize footer, any workspace export) OPENS THIS WINDOW instead of
> running its own flow — a door may PRE-CHECK its own category but they all
> land in the one window. Import side: Derek's spec covers EXPORT; ask (or
> spec separately) whether import becomes the mirror-image checklist of the
> combined file before building that half.

> QUEUE — WAITING on Derek: the ribbon default preset (he will send a Full
> Preset export to bake in as the shipped defaults). Otherwise clear; the
> standing what's-left:
> 1. **Tauri fs scope** — the one audit item deliberately NOT shipped.
>    Full plan + Derek's 6-step desktop test list in
>    docs/AUDIT-2026-07-26.md §3 (v4.82 follow-up). It rewrites the save
>    path and cannot be tested in this sandbox — give it its own session.
> 2. Derek's unanswered question (asked v4.78): which EXTRA Guided Setup
>    steps he wants — page layout, autosave/backup, theme-with-preview,
>    template preview, start-from-an-existing-script.
> 3. Older backlog, untouched: #20 editorStore chrome slice, #21
>    ScreenplayEditor hooks split, #22 MenuBar/Toolbar/CharacterProfiles
>    split, #23 Modal/PopupMenu shells + dead-CSS pass.
> 1. NEW-SCRIPT LAUNCHER + GUIDED SETUP WIZARD (Derek's big feature,
>    late v4.78 session — his spec verbatim in the chat): a first window
>    with four options — New Script (Manual Setup) / New Script (Guided
>    Setup) / Open Script / Import File. Manual = the current new-script
>    window PLUS a save-locations field defaulting to the most recently
>    updated script's locations; Open/Import leave that window (they
>    live on the launcher now). Guided = a wizard: Project Naming, Save
>    locations & options, Format options, then a friendly page per
>    Customize tab (NOT the raw tabs — explanation text, user-friendly),
>    each with Next and "Skip for now", plus a persistent note "all of
>    these options can be changed at a later time". MUST stay in sync
>    with Customize (single source — read the same stores/registries,
>    never copies). Claude suggested additions pending Derek's pick (see
>    the v4.78 delivery message): a page-layout step, autosave/backup
>    step, theme step, template preview, an "import settings from
>    another script" step.
>    PLUS (Derek, same session): Customize window footer gains Import /
>    Export Customizations — export writes a file of every customization
>    choice; import applies it after a warning ("this will override all
>    of your current customization settings"). Both Manual and Guided
>    setup offer "customize from file": pick a customize file OR an
>    existing ScriptCraft file and copy its customization settings.
>    Foundations: utils/settingsBackup (v4.22 whole-settings export) and
>    the workspaces customize snapshot — scope a CUSTOMIZATIONS-only
>    subset of that, one schema shared by Customize footer + both setups.
> 2. Window-mode memory incl. FULLSCREEN (deferred from v4.78, reason:
>    touches openTool/dock/persist semantics across many flows — needs
>    fresh-session care): every tool reopens in its last shape — side
>    panel / floating / fullscreen. v4.78 already shipped the fullscreen
>    header's shrink button (left of ×, → floating) and closed-row
>    drag-out; what remains is persisting 'fullscreen' as a remembered
>    mode and honoring it in openTool/dock clicks.
> 3. Audit items: rescans gated on tool-open (live open / refresh on open /
>    idle closed); react-router major bump; Tauri fs $HOME scope narrowing;
>    CSP decision documented.
> FINDINGS standing: (a) File ▸ Print is window.print() and 16-print.css
>    hides every .page-sep overlay — printed output has NO page numbers/
>    headers/footers; PDF export is the numbered path. Fixing print = its
>    own project. (b) About ▸ Compatibility = runtime capability probes
>    (services/compat.ts): UUID/SubtleCrypto/Clipboard are always
>    "Latest" in the desktop app; the Storage row is the only
>    informative one. Recommended: fold into a Diagnostics surface or
>    trim — awaiting Derek's call.

Read `CLAUDE.md` and `docs/HANDOFF.md` first for the durable footguns, the architecture
map, and Derek's working style. **This file is the fresh-chat catch-up**: the exact
commit/deploy workflow, what shipped in the last run, the best practices learned while
fixing this run's bugs, and where development stands — so a new session picks up without
re-deriving it. When it drifts, **rewrite it** (don't just append).

> Why this exists: chats grow long and slow. Starting fresh keeps each turn fast; this
> doc + `CLAUDE.md` carry everything forward.

---

## 0. THE WORKFLOW — how a change reaches Derek's Mac (read this first)

You are **not** editing Derek's Mac. You run in a **remote sandbox with its own fresh
clone**. The only channel to Derek is **git push**. He never copies files, never runs a
build — he runs **one command** and your pushed commits arrive.

**The contract, every single change:**

1. Edit files in this sandbox.
2. Run the gates (below). They must pass.
3. `git commit` with a clear message + the trailers (below).
4. `git push -u origin claude/v0_32`
5. End your delivery message with exactly:
   ```
   cd /Users/dcarl/ScriptCraft && npm run desktop
   ```

That's it. **`npm run desktop` = restore `src-tauri/Cargo.lock` (v5.55: his local
`tauri dev` rewrites that generated file; a dirty copy aborted `git pull` — the
committed lockfile is canonical) → `git pull` → `npm install` (no-op unless deps
changed) → launch the Tauri app.** So the instant you've pushed to `claude/v0_32`, Derek runs that
one command and sees your change. If you didn't push, he gets nothing — pushing **is**
the deploy.

### Branch, remote, gotchas
- **Branch: `claude/v0_32`.** It is what Derek's clone tracks and what `npm run desktop`
  pulls. This is the current branch and its upstream is `origin/claude/v0_32`, so a plain
  `git push -u origin claude/v0_32` is all you need (single branch — no dual-push in this
  environment).
- **Remote in this environment is the `dac8767/ScriptCraft` path** (via the sandbox
  proxy) and it works. (An older handoff said the ScriptCraft path 403s and to use the
  `FreeScript` path — that was a *different* environment. Trust `git remote -v` in your
  own sandbox; here it's ScriptCraft and pushes succeed.)
- **Never commit to `main`** (stale v0.6 baseline). **Never force-push** `v0_32`.
- **Push retries:** on a network error, retry up to 4× with backoff (2s/4s/8s/16s).
- **Do NOT open a PR** unless Derek explicitly asks. The workflow is push-to-branch, not PR.
- **Model identity:** never put the model id in commits, code, changelog, or PR bodies —
  chat replies only. Commit trailers:
  ```
  Co-Authored-By: <the model trailer your environment instructions give>
  Claude-Session: https://claude.ai/code/session_...
  ```

### The gates — run before claiming anything works
```bash
cd frontend
npx tsc -b        # MUST be 0 errors. It gates the .dmg build; an unused import breaks the release.
npm test          # 605 tests as of this run, all green
npm run build     # tsc -b && vite build — must succeed
```
Bash resets to the repo root each call, so `cd frontend` every time (or chain with `&&`).
Write a real regression test for anything with logic — this repo's habit is "render it
and read back what it produced," which is how its worst bugs were caught.

### Versioning — the per-batch rule
Every shipped batch bumps `APP_VERSION` in `frontend/src/data/changelog.ts` and adds a
newest-first entry to `frontend/src/data/changelog.json` (the `changes: […]` string
shape) **in the same commit**, then gets its §1 section here. One batch = one version =
one changelog entry = one §1 section.

---

## 0.5 Multi-worker strategy — read `docs/WORKERS.md` (the playbook)

**Tier 1 (DEFAULT, proven): in-chat parallel workers.** The Dispatcher (this
chat) spawns N background subagents via the Agent tool — in ONE message so they
run concurrently — each with a tight brief on a disjoint lane. Workers never run
gates (concurrent tsc/vitest clobber shared state) and never commit; the
Dispatcher reviews diffs, runs the three gates once, live-verifies, commits,
pushes. Derek talks to one chat.

**Tier 2 (scale-out, use with care): fresh-session Routine spawns** — one at a
time, heartbeat-first prompts, standalone checkout preamble (fresh clones sit on
stale `main` with the WRONG CLAUDE.md), permissions via the committed
`.claude/settings.json`. The 2026-07-24 double-spawn produced two silently dead
sessions; `docs/WORKERS.md` has the derived operating rules. **Path B** (Derek
pastes briefs into chats himself) is the always-works fallback.

Lane infrastructure (all tiers): `docs/AREA-MAP.md` (lane map + spine),
`docs/lanes.json` (file→lane truth), `scripts/check-lanes.mjs`
(`npm run check-lanes`; `plan <lanes...>`; `--selftest` after edits),
`docs/EFFICIENCY-AUDIT.md` (cleanup backlog).

**Standing instruction:** when Derek queues more than one update, classify each
into a lane, run the planner, spawn Tier-1 workers for parallel-safe lanes, keep
spine work in the Dispatcher, and report the wave plan before starting.

---

## 0.6 Done phases — slicing, coverage, splits (history in HANDOFF-ARCHIVE.md)

The editorStore slicing (10 domains; chrome deliberately deferred), the
safe-progress/coverage phase (suite 343 → 605 tests; the working-notes export
leak found & fixed across all four exporters; the workspaces apply root-cause)
and the first component splits are DONE. Their full write-ups moved verbatim to
`docs/HANDOFF-ARCHIVE.md` (§0.6/§0.7) — read them there BEFORE reworking those
areas; the durable rules they produced live in CLAUDE.md §4 and §2 below.

Durable bits kept live here:
- Any test that (even transitively) imports `editorStore` needs
  `// @vitest-environment jsdom` (the store touches localStorage at import).
  Single-file `npx vitest run <file>` can resolve a cached vitest without jsdom
  and die with ERR_MODULE_NOT_FOUND — re-run the full suite before believing a
  weird worker failure.
- Still open from those phases (needs Derek): his list of WHICH Design-panel
  options "never worked"; deliberate minor nits (odraft meta value-type
  validation, fonts loadFont failure-retry, templateCss selector escaping).

---

## 1. Where we are right now (end of this run)

> **STANDING RULE — start EVERY turn with `git fetch origin claude/v0_32 &&
> git log --oneline -1 origin/claude/v0_32`, and if local HEAD differs,
> `git reset --hard origin/claude/v0_32` BEFORE reading or editing anything.**
> The sandbox has now rolled back to a stale snapshot TWICE mid-session
> (v4.28-era files reappearing while origin was fine). Symptom: a file shows
> long-deleted code. The remote is the truth; pushes always survived.

> **STANDING SIZE CAP (2026-07-28 token-efficiency batch):** §1 keeps only
> the LAST 4–5 version sections fully written. When you add a new one, move
> the oldest kept section VERBATIM to the top of the version list in
> `docs/HANDOFF-ARCHIVE.md` and add its one-liner to the index below. This
> file is read at the start of every fresh session — its length is a
> per-session tax. It was allowed to reach 2,559 lines; don't let it again.

### v6.70 — four more preset parts (the audit Derek asked for)

- Derek: "add annotation presets to the Settings > Presets tab options.
  check the app for any additional presets missing from that list."
- THE AUDIT. What the app lets a writer author, keep, and would want on
  another machine — and which of it any preset part already carried:
  | Thing | Where it lives | Verdict |
  |---|---|---|
  | Annotation presets | `viewState.markupPresets` | **ADDED** (his ask) |
  | Keyboard shortcuts | `opendraft:shortcutOverrides` | **ADDED** |
  | Design token values | `viewState.designVars` | **ADDED** |
  | Helper text | `helperTextOverrides` + `helperTextHidden` | **ADDED** |
  | Script Formats templates | `api.listFormattingTemplates()` | NOT added — they load through the HTTP backend the desktop app doesn't run (v6.69) |
  | Snippets / shelf cards, tags, characters | per SCRIPT | NOT presets — they travel in the .odraft |
  | Toolbar/menu/panel layout | captureCustomizations | already in Customizations |
- FINDING worth acting on separately: `CUSTOMIZATION_FIELDS` does NOT list
  `markupPresets`, though Customize ▸ Markups is where they're edited — so
  Customize's **Cancel does not revert an annotation-preset change**, and the
  customization export never carried them. Same family as the v4.79 "fields
  that had DRIFTED out of this list" fix. NOT changed here (it alters Cancel
  behaviour Derek hasn't asked about) — reported to him instead.
- The registry did its job: adding the ids to `PresetPartId` broke the build
  until `PART_DESC` gained all four, because it is typed
  `Record<PresetPartId, …>`. A row cannot exist without a description, and a
  description cannot exist without a row.
- Care taken in the apply paths: a deliberate `null` shortcut (unbound on
  purpose) survives the round trip; a corrupt annotation payload never wipes
  the writer's presets; non-numeric design values are refused; and
  helperTextHidden is RECONCILED rather than re-toggled, so applying the
  same file twice doesn't flip things back on (a test pins that).
- Gates: tsc 0, vitest 1190, build ok, check-all 951/0 (check-v663 now 19).

### v6.69 — Snapshots stopped hanging (a missing guard, not a slow server)

- Derek: "clicking on 'Snapshots' shows a window that is forever stuck on
  'Loading snapshots...'".
- ROOT CAUSE, and it is a single-source violation: `services/api.ts`'s
  `request()` had NO empty-base guard, while `services/cloudApi.ts` — the
  OTHER client against the same server — has had one all along
  (`if (!base) throw NOT_CONFIGURED`). config.ts is explicit that "on Tauri
  the HTTP backend is NOT used" and `getApiBase()` returns '' on desktop
  unless a cloud URL is configured, so every Snapshots load fired at a
  RELATIVE url through the Tauri invoke bridge and waited on a request that
  could never arrive. api.ts now carries the same guard, worded identically.
- Script History is a SERVER feature. There is no sidecar, no uvicorn, no
  Rust snapshot command — the desktop app is frontend + Rust only. So on
  Derek's Mac the window could never have worked; it just failed silently
  instead of saying so. (Local snapshots would be a real feature build —
  NOT started, and worth asking about before anyone does.)
- Belt and braces: `utils/withTimeout.ts` bounds the WAIT (12s) in both
  snapshot loaders — the Snapshots window and the Compare picker — so no
  transport behaviour can put the spinner back. It bounds the wait rather
  than aborting the request, because the loader doesn't own the request. A
  "Try again" button replaces the dead end.
- HONESTY NOTE for whoever reads this next: the exact mechanism of the
  hang on Derek's machine was NOT reproduced here — the harness has no
  Tauri IPC, and in the browser the request always settles. The guard is
  provably right (api.ts was missing what cloudApi.ts has); the timeout is
  what makes "forever" impossible regardless of mechanism. If he ever
  reports it again, the message on screen now names what it could not
  reach.
- v6.69 also exposes `window.__scProjectStore` in DEV beside `__scStore` /
  `__scEditor`: Snapshots reads the PROJECT store, and a check could not
  reproduce "a script is open" without it.
- check-v669 (8) drives the real menu path in both states and asserts the
  window never sits on "Loading…", says something actionable, offers a
  retry, settles inside the budget, and does not re-arm.
- Gates: tsc 0, vitest 1182, build ok, check-all 949/0.

### v6.68 — Annotation Filter + a plain View Annotations toggle

- Derek: "the current button 'annotation visibility' should be called
  'Annotation Filter'. Make a new button that is called 'View Annotations'.
  This is a simple on or off toggle, like the toggle for the side panels,
  and the ribbon toolbar."
- Note the history: v6.41 REMOVED a `toggleMarkups` Show/Hide button at his
  request. This is a NEW key (`viewAnnotations`), not the retired one —
  v6.41's discard rule means any layout still carrying `b:toggleMarkups`
  shed it long ago, so reviving the old token would have been a trap.
- The toggle drives `markupsVisible` — the SAME state as View ▸ Annotations
  ▸ Show Annotations in Script and the Annotations window's Show button.
  Icon carries the state (eye / crossed eye) the way the sizing lock swaps
  its padlock; `active` lights it.
- Both buttons are palette-only (Derek places annotation buttons himself),
  so `migrateViewAnnotations` seats the new one immediately before the
  filter in any saved layout that already has it — the `migrateResetSizes`
  pattern. A layout without the filter is left alone.
- CHECK-WRITING LESSON, and it cost real time: **HoverTooltip moves a
  button's `title` into `data-tip-stash` while the pointer is over it** (it
  suppresses the native tooltip). A title-based selector therefore goes
  blind exactly when a check is clicking — my first draft reported the
  button "vanishing from the ribbon" mid-check. Address ribbon buttons by
  `[data-key="<builtin>"]` and read the tip from either attribute.
  Related: the first draft ALSO passed "the button goes unlit" while the
  button was missing entirely (`btn?.classList` → null → `!null` is true).
  A state reader must THROW when its element is absent, never report a
  default — that is the third time this session an assert has passed on a
  missing element.
- check-v668 (14) drives both buttons: the rename, the filter popover still
  opening, the toggle hiding and showing the icons for real, the state
  round-trip with the View menu, and Customize's palette listing both.
- Gates: tsc 0, vitest 1177, build ok, check-all 941/0.

### v6.67 — annotation icons follow the ZOOM (and any resize)

- Derek, two screenshots at 50% and 90%: "annotation do not scale or adapt
  when the zoom is changed, putting them in the wrong place." At 90% an icon
  sat INSIDE a line of dialogue.
- Root cause, and it was written in the call site's own comment ("recompute
  on doc change only"): every number in MarkupIconLayer is MEASURED off the
  rendered page — `coordsAtPos`, `getBoundingClientRect` — and the page is
  drawn with `transform: scale(zoom)`. `zoomLevel` was never in the effect's
  deps, so the stored top/left stayed frozen while the text moved under them.
  The chip's size ignored zoom too (Design knob only), so zoomed out it
  swelled relative to the page.
- Fix: `zoomLevel` in the deps; the chip's size is the Design knob TIMES the
  measured page scale, carried per-spot as `IconSpot.size` (the icons are
  absolute children of the SCROLLER, not of the scaled page, so nothing
  scales them for us); and a ResizeObserver on the container covers every
  OTHER geometry change — panel opening, window resize, page setup — since a
  transform-scale leaves the layout box alone and an observer never sees the
  zoom itself.
- **NEGATIVE CONTROL, and do this more often.** check-v667 (10) was run
  against the OLD code before the fix landed: 3 passed, 7 failed, with the
  icon frozen at y=257 while the row moved to 185 (50%) and 313 (150%), and
  the chip 22px at every zoom. That is the proof an assert measures the real
  thing — the v6.62/v6.66 lesson twice over (a check that passes on broken
  code is worse than no check).
- This was a PRE-EXISTING bug in annotations generally, not something the
  outline work introduced; it only became obvious once Send to Script
  started placing them automatically.
- Gates: tsc 0, vitest 1173, build ok, check-all 927/0.

### v6.64 → v6.66 — Send to Script makes LIVE ANNOTATIONS

- Derek: "the 'send to script' button in the outline toolbar adds the
  section header as an annotation at the indicated page location. if section
  info changes, such as the name or the estimated page amount, the change
  should be indicated in the annotation as well."
- The old button appended one `# Beat title — description` line per BEAT at
  the END of the script — no sections, no page placement, no page estimate.
  I asked rather than guess and he chose sections, at their page, mirroring
  silently. **v6.64 then read "annotation" as the `# …` section LINE** and
  built exactly that. He came straight back with a screenshot: "it adds them
  to the script in the old section format instead of as an annotation like I
  requested." He meant the app's ANNOTATIONS (markupsSlice) — the tool in
  the right panel. THE LESSON: this app has a feature literally named
  Annotations; when a word names a shipped feature, it means that feature.
  Check the tool list before reading a term loosely.
- v6.65 is what he asked for. A sent section is a `ScriptMarkup` with a new
  `outlineSectionId` field, anchored by the element's `markupId` BLOCK
  attribute (ScriptMarkup's point-anchor path — no text selection needed,
  works on any annotatable element). Its text lives in the annotation's
  content, so **the mirror is a plain store write and never touches the
  document at all** — much safer than v6.64's text rewriting.
- `utils/outlineScriptSync.ts`: `sectionAnnotationText` is the ONE builder;
  `sectionAnnotationContent` wraps it as mini-editor JSON;
  `annotationFirstLine` reads it back (the round-trip is what the mirror
  compares on); `collectOutlineSections` spans every variation;
  `syncSectionAnnotations` rewrites what fell behind; `freeAnchorPos` finds
  the next annotatable element that isn't already anchored — two sections
  can resolve to the same spot and one element holds ONE markupId, so
  without it the second would silently evict the first;
  `clearLegacySectionLines` sweeps v6.64's stamped lines on the next send
  (the stamp proves the app wrote them — nothing unstamped is touched).
- `General.outlineSectionId` is KEPT, marked legacy: the sweep can only find
  those lines while the schema still parses the stamp.
- The mirror lives in ScreenplayEditor, not the Outline Bar — the bar is
  usually closed while a section is renamed on the board, and a mirror that
  only runs when a panel happens to be mounted is the silent no-op this repo
  keeps re-learning. A `id|title|pages` signature gates it so a column-resize
  drag doesn't rewrite anything. A hand-made annotation (no
  outlineSectionId) is never rewritten; a deleted section leaves its
  annotation as it stands.
- **v6.66 — the PAGE mapping.** Derek: "each section is 1 page, so section
  1 should be at the top of page 1, the next at the top of page 2, etc. But
  … that is not where the section annotations were placed." v6.65's
  `posForPage` reused the Outline Bar's own scene arithmetic — the SCENE
  whose estimated range covered the page — so a section landed wherever its
  scene began. Only the paginator knows where a page starts:
  `computePageBlocks` + `posAfterScriptPageIn(n - 1)` is the first block of
  page n, the SAME pure boundary function the Pages tool and the Custom Page
  dialog resolve through. Verified: page tops at element 0/18/36, three
  1-page sections anchored at 0/18/36.
- **v6.66 — orphaned anchors.** `freeAnchorPos` treated ANY element carrying
  a markupId as occupied. An element still stamped with a DELETED
  annotation's id was therefore blocked for ever. It now takes the set of
  live annotation ids, so a stale stamp reads as free.
- CHECK-WRITING LESSON: my first placement assert measured icon Y against
  `.page` boxes — and there is only ONE `.page` container in the editor;
  the page breaks are `margin-top` decorations on the element that OPENS
  each page. The assert reported a failure the product didn't have, and the
  fix was to measure the paginator's own ground truth (element 0 plus every
  element with a big inline margin-top ARE the page tops).
- check-v665 (23) drives it for real: annotations not script text (the doc's
  textContent is byte-identical before and after), anchor placement, the
  rename/page rewrites, mirroring with the bar CLOSED, no duplicates, no
  eviction when four sections compete for anchors, the hand-made case, the
  deleted-section case, and the v6.64 sweep.
- Gates: tsc 0, vitest 1173, build ok, check-all 917/0.

### v6.63 — Settings ▸ Presets is a CHECKLIST that makes ONE file

- Derek: "the Settings > Presets tab is not what I want. I want one single
  preset file that can include all the information for each item on the
  current preset list. The tab has a checklist of each of these items. If
  you check an item, preset information for that item will be included in
  the single preset file." (This is the QUEUED "ONE PRESET EXPORT WINDOW"
  spec from 2026-07-31, arriving as the Settings tab rather than a new
  window — see the queue block at the top of this file for the rest of it.)
- `PRESET_PARTS` (utils/presets.ts) is the registry and the ONE source: the
  checklist renders from it, `buildPresetBundle` collects from it, and
  `applyPresetFile` applies through it. A new preset type can't be in the
  file but missing from the checkbox, or the reverse. Five parts: settings,
  customize, themes, workspaces, outline.
- Each part's payload is byte-for-byte what that item's own export always
  wrote (gatherSettings, buildCustomizeExport, customThemes, workspaces +
  order, outlinePresetStore.exportJson) — so what a category MEANS didn't
  change, only how many files come out. The old "Full Preset" row retires
  into "tick everything"; its payload was gatherSettings, which is the
  settings part.
- File: `{ kind: 'preset-bundle', version: 1, includes: [...], parts: {...} }`
  written as `…_preset.json` (typedExportName, Derek's suffix rule).
- BACKWARD COMPATIBILITY is the part worth keeping: `readPresetFile`
  recognises the bundle AND every single-type file the app has ever written
  (full-preset, settings-backup, customize-export, themes array,
  workspaces-export, and a bare outline-preset array), each reading as the
  one part it holds. A preset the app made must never become unopenable.
- An item the writer has none of renders disabled with a title saying why;
  Export is disabled until something is ticked (no empty preset file). One
  part throwing is reported by name — `{ applied, failed }` — instead of
  taking the rest of the import down.
- SCOPE, stated to Derek: the checklist governs EXPORT (his words). Import
  takes one file and applies everything in it after a confirm naming the
  contents — `applyPresetFile(json, only?)` already takes the filter, so a
  mirror-image import checklist is a UI change away if he wants it. The
  other scattered export doors (Customize footer, ThemesTab, Settings ▸
  Backup) still run their own flows — that half of the queued spec is
  untouched.
- Gates: tsc 0, vitest 1157, build ok, check-all 894/0 (presets.test.ts +8,
  check-v663: 17).

### v6.62 — the board LIED about where deleted beats went

- Derek (screenshot): "when i deleted the Act II column, instead of the
  beats going to the unsorted section (which they should), they went into
  the act I column instead."
- They hadn't. I reproduced his exact sequence and dumped the store: after
  deleting down to one act, `Act I:20, LOOSE:40` — the v6.60 code did
  precisely the right thing. What moved was the LAYOUT: `isSingleColumn`
  counted only SECTIONS, so the moment the second-to-last one went, the
  survivor took `flex: 1` + `.beat-column-cards-wrap` and its 20-card
  vertical list blew open into a 994px-wide 2-across grid. That reads as
  "everything landed in Act I" — and the measurement is in the repro:
  340px/1-wide before, 994px/wrapped after.
- Fix at the cause: Unsorted IS a column on the board, so a section is only
  "the single column" when Unsorted isn't showing. `unsortedShowing` is now
  computed ONCE (from keepUnsortedMounted) and read by both the layout flag
  and the render — the same one-source rule that keeps drifting lists in
  this codebase honest. A genuinely lone section still stretches (verified:
  1150 of 1198px), and maximize is untouched.
- LESSON for the file: a store assert is not a UI assert. check-v660 proved
  the beats were in Unsorted and passed while the screen was telling Derek
  the opposite. Its new asserts measure what he can SEE — the surviving
  section is the same width as Unsorted, its cards are not wrapped, and the
  card counts per column match the store.
- Gates: tsc 0, vitest 1149, build ok, check-all 877/0 (check-v660 now 16).

### v6.61 — one default column width; the edge is actually grabbable

- Derek (screenshot): "the unsorted section should be the same width by
  default as the other sections. allow resizing of the column widths by
  dragging the edge."
- WIDTH. `.beat-column` carried no `width` — only `min-width: 280` /
  `max-width: 500` — so every column sized to its own max-content. Sections
  settled at 340 (their widest card); Unsorted's one-line hint measured 483
  and shoved it to the 500 cap. Fixed at the cause: `width: 340px` on
  `.beat-column`, one default every column starts at. `min-width` still
  reads the `--dz-beat-col-minw` design token, so raising it in the Design
  window still grows them all together. Verified single-column
  (`flex: 1 1 0%` beats `width`) and maximized still fill the row.
- RESIZE. It EXISTED — `useColumnResize` + `.beat-column-resize-handle`, and
  it worked — but the handle sat at `right: -3px; width: 6px` inside a
  column with `overflow: hidden`, so the outer half was clipped away and
  what was left was a ~3px strip with no visual cue. My first probe of it
  reported "dead"; that was my own error (I aimed 200px below a 206px-tall
  column). Root cause was reach, not wiring: the handle now lives fully
  inside the edge at `width: 10px`, with an `::after` bar that fades in on
  hover and a "Drag to change this column's width" tooltip.
- Unsorted resizes too. A control you can see and can't drag is the silent
  no-op Derek hates, and Unsorted is a phantom column with no record to
  hold a width — so it gets one as a VIEW PREF (`outlineUnsortedWidth`,
  saved through saveViewState like outlineBarZoom/RowScale, added to
  CUSTOMIZATION_FIELDS). Real sections keep storing width on the column
  record, which saves with the script.
- check-v661 (13): all three columns equal at rest, the strip is a target at
  2/4/6/8px in, col-resize cursor, the tint arrives on hover (waited for —
  the .12s transition reads 0 if you measure too early), a section drag
  moves only that column and lands on its record, Unsorted's drag persists
  and survives the column unmounting, and the 200px floor holds.
- Gates: tsc 0, vitest 1149, build ok, check-all 874/0.

### v6.60 — deleting a SECTION no longer deletes its beats (Unsorted)

- Derek: "if an outline section is deleted and it had beats inside it, the
  beats should not be deleted. instead they should move to an Unsorted
  section (make it the furthest left column). no beats should ever be
  deleted unless they are individually deleted using the delete button on
  the beat itself."
- `deleteBeatColumn` was `beats: s.beats.filter(b => b.columnId !== id)` —
  one click on a trash icon, no confirm, and every card in that section was
  gone. Now it CUTS THEM LOOSE: `columnId: ''`, `barOffset: undefined` (a
  pin is an offset inside a section that no longer exists), and the whole
  loose pool is renumbered 0..n-1 — the beats already waiting keep their
  order, the freed ones land after them, so two deletes in a row can't
  collide on position. Still one undo step.
- No new column type was invented: "Unsorted" is the v2.23 holding pen,
  which already rendered before the first section and vanished when empty.
  It only needed the beats pointed at it. `Uncategorized` → `Unsorted`
  everywhere — label, hint, `unsortedBeats`, `keepUnsortedMounted`,
  `.beat-column-unsorted*` CSS, comments, tests.
- The trash tooltip now states the outcome up front: "Delete section — its
  beats move to Unsorted, they are not deleted" (catalog rebuilt, the
  standing rule).
- AUDITED the whole "no beats are ever deleted" claim: the only other
  places that drop beats are seven `setBeats([])` calls in MenuBar /
  ScreenplayEditor, and every one is a document swap (new script, open,
  import fdx/docx/pdf) where the beats belong to the document being
  replaced. deleteOutlineTab keeps them (v6.58), applyPresetSections
  re-homes them (v6.59), `deleteBeat` is the card's own button. So the
  invariant now holds: inside a live script, only the beat's own trash
  deletes a beat.
- check-v660 (13) drives the real trash button: the section goes, all three
  beats survive, they RENDER as cards in Unsorted, Unsorted measures
  furthest left, a second delete appends after the waiting ones, one undo
  restores, the card's own delete still deletes, and the column disappears
  when the last beat is dragged back into a section.
- Gates: tsc 0, vitest 1149, build ok, check-all 861/0.

### Older versions — one line each (full sections in `docs/HANDOFF-ARCHIVE.md`)

Newest first. When a version rolls out of the detailed set above, its section
moves verbatim to the archive and its line lands here.

- **v6.59** — presets re-home existing beats (splitPages/distributeBeats/presetReuseOrder); page estimates went per-variation (beatSlots.span, barSetBeatSpan)
- **v6.58** — an outline tab is DELETED, not "closed" (the tab flow only; other Close buttons stay)
- **v6.57** — presets fill their sections at ~2 pages a beat with sums exact (presetBeatSpans); divider before the + button
- **v6.56** — the outline beat count left the tab pill (ToolChrome grew an AfterTabs slot outside the strip)
- **v6.55** — freeform beat titles shrunk (mindTitleSize 12–16, title width 46%) so the title bar has bare band to grab
- **v6.54** — freeform beat cards got real title bars (windowChrome in BeatCardContent), the ⋮⋮ grip retired in freeform
- **v6.53** — freeform header drag fixed (always preventDefault + tap-to-focus), any-edge resize, click-place-click links with edge anchors (mindAnchors)
- **v6.52** — beat count beside the tabs; card/board contrast (color-mix step); Helper Text became a real dockable TOOL; freeform link highlights + header drag
- **v6.51** — the Helper Text catalog covers DYNAMIC title/placeholder expressions (+97); applier arm-flip fix; the rebuild-the-catalog standing rule
- **v6.50** — Outline polish: bare View trigger (icon + current view), option icons, add button leads the body row
- **v6.49** — Outline header standardized: View/Filter/Search cluster, actions row in the body, "Show beat color on all tabs" retired
- **v6.48** — Themes menu label + click-to-apply; outline tabs into the window header (ChromeTabs grew rename/close/TabsExtra); Auto Save → Snapshot
- **v6.47** — three new built-in themes: Paper, Gruvbox Dark, Catppuccin Mocha (the theme-adding pattern lives in its archive section)
- **v6.46** — theme legibility pass (palette report S1/S2/S6: sepia/sol-light/dracula/light depth fixes, AA floors)
- **v6.45** — Upload Voice Clip tool removed from the character window (Voice Profile writing fields stay; AssetAudio deleted)
- **v6.44** — print round 4: sharedPrintInfo (nil-NSPrintInfo theory) + fsync breadcrumb log; Settings…→app menu above Quit
- **v6.43** — print round 3: ACTIVE_PRINT keep-alive (async sheet lifetime); Settings→File (reversed v6.44); standard window buttons on FloatingWindow
- **v6.42** — LOCAL-FIRST: account/cloud UI purged (service layer kept in code); Settings became a FloatingWindow; Auto Saves subfolder; Filter→Display
- **v6.41** — Save Options always editable; Local System (backup location); toolbar toggle retired
- **v6.40** — Collaboration removed end-to-end (account system KEPT then; see v6.42)
- **v6.39** — map rotation via Options any time; the map became a CANVAS (WKWebView vanish)
- **v6.38** — the ten-item batch: helper text window/blank overrides, snippet buttons, map floor + header Options + rail ⋮, panel zoom
- **v6.37** — print hotfix: async command + sheet + ObjC exception catch
- **v6.36** — Print = the real system dialog via PDFKit (crashed; fixed v6.37)
- **v6.35** — annotation icons moved to the LEFT margin band (0.75" center)
- **v6.34** — `npm run desktop` restores package-lock.json too; Cargo.toml dirt = unknown origin
- **v6.33** — the MEASURED wrap geometry (63 chars); the asset handler's cwd bug; Print opens
- **v6.32** — asset protocol ON; Tauri print = save+toast; Courier Prime embedded
- **v6.31** — Asset Manager: inline image thumbnails
- **v6.30** — formatting verified against the standard; Print's silent Tauri no-op
- **v6.29** — Print through the exporter; the goal chip's Header = the TITLE BAR
- **v6.28** — PDF import: the legacy pdf.js build for WKWebView
- **v6.27** — Title tab scales with its window; Asset Manager menu no-op
- **v6.26** — Title Page: the Contact field is 4 rows
- **v6.25** — Goals spacing: the phantom row was DOUBLE bottom padding
- **v6.24** — Helper Text: areas, on-screen found-in, hide, go-there, line breaks
- **v6.23** — Goals: ONE Start/Stop top-left; Show in beside it; count quick starts
- **v6.22** — Helper Text: its own window, with the control's face on every row
- **v6.21** — Goals: the current total on the Reach rows; one-row footer; Header/Footer
- **v6.20** — the Helper Text editor (Design window)
- **v6.19** — Thesaurus over the selection + context-menu entry; Analytics header tabs
- **v6.18** — paste fills the active element: action is the schema's fallback
- **v6.17** — a dragged snippet drops its TEXT into the script
- **v6.16** — collapsed tabs expand back; Working Notes menu gone
- **v6.15** — Goals: Show in Toolbar/Footer, relative count goals, footer
- **v6.14** — Derek's menu reorganization
- **v6.13** — Characters polish: flat list rows, quieter cards, List first
- **v6.12** — Characters header: Filter everywhere, Sort+Search on Relationships
- **v6.11** — the Characters list is the shared table
- **v6.10** — the Highlights tool is retired
- **v6.09** — Preview: Script Options + Include Annotations…
- **v6.08** — big ribbon buttons: one geometry, one hover box
- **v6.07** — the temp window's drag teleport
- **v6.06** — dropping Analytics on a panel actually docks it
- **v6.05** — the crushed-header fix (chrome-less windows)
- **v6.04** — locations toggle everywhere, the Insert menu diet, two dead-flow fixes
- **v6.03** — the Thesaurus is WordNet proper, with definitions
- **v6.02** — Goals tabs go left; Customize finally remembers its tab
- **v6.01** — one leading row: Map · Pin · Group
- **v6.00** — the rail's expanded rows carry the List view's details block
- **v5.99** — the fullscreen map's rail hangs under the Locations ROW
- **v5.79** — connect-to-location, the pin anchor, and cursor placement
- **v5.78** — Locations map: six follow-ups
- **v5.77** — Locations: a pin is a PLACE
- **v5.76** — the map image actually displays
- **v5.75** — Locations: List / Map tabs, with pins
- **v5.74** — ONE title page, three renderers reconciled
- **v5.73** — the title-page THUMBNAIL shows the true format
- **v5.72** — Pages tabs: Script / Title / Custom / All
- **v5.71** — All Pages tab, tab renames, the collapsed-tabs caret
- **v5.70** — Pages: the Custom tab
- **v5.69** — the type grid rides one row with "Type:"
- **v5.68** — Navigator filter: the Scene Headings section
- **v5.67** — Pages window tabs: Script / Title Page / Custom; the tool retirement
- **v5.66** — Focus tool: ? in the header + Design-window layout knobs
- **v5.65** — the mid-heading caret jump (uppercase plugin, since v3.45)
- **v5.64** — Rerun-with-note + the shared-language prompt rule
- **v5.63** — the cards speak the app's visual language (dark block = editable)
- **v5.62** — the note clears on a NEW target (disjoint overlap rule)
- **v5.61** — full-length suggestion cards, ONE scroll
- **v5.60** — the rewrite target stays PAINTED (blur-proof), + the declutter eye
- **v5.59** — Action Rewrite v4: editable drafts + linter, the Yours slot + beats, the LOG + calibration loop
- **v5.58** — Action Rewrite v3: the writer's NOTE replaces the steer enum
- **v5.57** — Action Rewrite v2: faithful/compressed/reimagined, tighten-only steer, native dash rule
- **v5.56** — Action Rewrite prompt: Derek's no-em-dash rule
- **v5.55** — npm run desktop self-heals the Cargo.lock pull collision
- **v5.54** — ACTION REWRITE: Derek's design-handoff integrated (Rust API call + keychain, PM adaptation)
- **v5.53** — the THESAURUS tool: local MyThes/WordNet data, caret-follow, replace-in-place
- **v5.52** — icon/color window OK/Cancel + live hex, colored filter grids, one-checkbox nav fix, header +
- **v5.51** — ribbon legacy-inserts retired, Filter right, pick BANNER, Navigator View menu
- **v5.50** — hide-ribbon CRASH fix, shared PerRowStepper, no-flash Design seat, Scrapbook auto-dock
- **v5.49** — Design seats at the panel edge, stacked previews + Save, picker ×/white chips, spinner + typeable count
- **v5.48** — annotations = highlighted text, pick-to-place, title-bar status/delete, Scene # in header
- **v5.47** — # goto in header, stacked stepper, Design DOCKS BACK, notes checklist fixes, edit-window force-show
- **v5.46** — nav Filter=annotation grid, Design independent window, edge resize everywhere, live checklist, working inserts
- **v5.45** — AI Writer: panel-only remove button, out of the Tools menu; Pages header right pair
- **v5.44** — Pages: header reorder + gap knob, + Add Page dropdown, thumb ratio fix, custom-page drag/⋮
- **v5.43** — ONE Filter drives script+window together; whole-area context menu; Return to Editor retired
- **v5.42** — annotation preview padding knobs, no phantom row, pinned ⋮, growing field, two-section Filter (reversed in v5.43)
- **v5.41** — annotation previews ×2, Used order, compact draggable picker, ribbon formatting drives the mini, move toast
- **v5.40** — CUSTOM PAGES: the customPage node/keymap, unnumbered pagination breaks, export exclusion
- **v5.39** — Title Page hand-grabber pan (per-column scrolling made the preview pannable)
- **v5.38** — Scenes cards: metrics wrap to a second row instead of truncating the name
- **v5.37** — fullscreen joins the one-window rule; the annotation window never coexists with a takeover
- **v5.36** — Notes v2: one rich card kind, equal-height rows, the WebKit drag-abort fix
- **v5.35** — docked side-panel tools survive clicks into the script (floats/temp still dismiss)
- **v5.34** — the Scenes "Reorder" button reads "Change Order"
- **v5.33** — icon-anchored seating, resizable windows, real scrapbook links, nav list rows, titlebar ⋮, Displays-as preview
- **v5.32** — one-row nav header (blue body buttons), unmistakable active icon, Design exempt both ways
- **v5.31** — highlight delete/link conversions, inline Used row, combined icon+color picker
- **v5.30** — the edit window becomes a WINDOW (drag/fullscreen/× + own theme); tool locked to panel
- **v5.29** — picker Used sections, legible chips, one-row popover head, icon import
- **v5.28** — annotation view controls everywhere (View submenu, ribbon menu) + navigator polish
- **v5.27** — solid icons, colored rings, segmented toggles, FaMarker identity
- **v5.26** — ANNOTATIONS: rename + the 14-item polish batch (block anchors, swatch pickers, auto-icon)
- **v5.25** — MARKUPS: the annotation tool is born (store/mark/popover/panel/presets)
- **v5.24** — columns not rows, the drag that never started, tab washes
- **v5.23** — compact buttons, the anchored-resize truth, per-row right
- **v5.22** — Sticky Notes: one interleaved list, reorderable tabs, blank check row
- **v5.21** — the seven-pack: Sticky Notes merge, fullscreen Title Page, one window, and the zombie Window menu
- **v5.20** — the Scenes four-pack: contained popover, Cards per row, one menu, lighter cards
- **v5.19** — Reorder wears the dialogs' Apply format
- **v5.18** — per-row button spacing; the box-air truth
- **v5.17** — padding grows the bar; the descender truth
- **v5.16** — 0 means 0; bar side-padding knobs
- **v5.15** — the ribbon Design reorg, and the 1px lie
- **v5.14** — per-kind ribbon geometry
- **v5.13** — title page out of Pages; the Design field you can type in
- **v5.12** — the table↔caret line is Derek's slider
- **v5.11** — caret-only again, but a caret you can hit
- **v5.10** — the whole row is the caret
- **v5.09** — narrow Scenes fold behind a caret; the isolate:false lesson
- **v5.08** — Pages controls say what they mean
- **v5.07** — resize bars split the difference
- **v5.06** — a column is what the eye groups
- **v5.05** — where an element SITS is its format
- **v5.04** — "clicking it doesn't do anything"
- **v5.03** — resizable scene columns; the full-screen close bug
- **v5.02** — the Scenes list is a TABLE
- **v5.01** — tool action rows; Scenes synopsis column; Pages title page
- **v5.00** — the screenshot drag is REMOVED
- **v4.99** — the drag is offered only where it can work
- **v4.98** — Feedback capture: Copy/paste route
- **v4.97** — Feedback capture drags as a real file
- **v4.95** — Pages fixes, Feedback CSP, Airtable dev panel
- **v4.94** — Pages search + preview scaling
- **v4.93** — Locations "Scene order" sort
- **v4.92** — Locations controls, scene-scan gate fix
- **v4.91** — header tabs re-expand, icon centering
- **v4.90** — one edge line, docked close button
- **v4.89** — header fullscreen button height
- **v4.88** — per-character custom fields, character-record cleanup
- **v4.87** — header corner actions, softer window edge
- **v4.86** — menu check items, hidden panels, header buttons
- **v4.85** — ribbon title groups, tool toggles, Scrapbook close
- **v4.84** — element revert, shape-memory fix, chrome items
- **v4.82** — gated rescans + react-router v8
- **v4.81** — a tool reopens in its last-used shape
- **v4.80** — new-script launcher + Guided Setup wizard
- **v4.79** — presets: export/import everything
- **v4.73–v4.78** — the crash hotfix and the rest of Derek's stream
- **v4.72** — page-number position (Derek's margin diagram) + ruler tail
- **v4.71** — ribbon toggle highlights, gray titles, title knobs, tab memory
- **v4.70** — Feedback screenshot chip + html2canvas-pro
- **v4.69** — title-bar-style window buttons
- **v4.68** — parenthetical after dialogue + the "(" trigger
- **v4.67** — collapse pill + auto-expand hardening
- **v4.66** — Show All / Hide All in the Shown/Hidden headers
- **v4.65** — reset sections, Defaults tab, tab-in-place, no auto-picker
- **v4.64** — flattened Settings + five Customize refinements
- **v4.63** — Dialogue (Name), rules table, M&C on top
- **v4.62** — speed/efficiency/security/stability audit
- **v4.61** — three explicit dialogue options
- **v4.60** — Customize ▸ Editor reordered
- **v4.59** — Derek's full follows-what table, user-editable
- **v4.58** — grammar-filtered element suggestions
- **v4.57** — dialogue Enter offers options, Tab starts dialogue
- **v4.56** — parenthetical leads the picker under a name
- **v4.55** — paren delete-to-remove, picker-autofill fix
- **v4.54** — parenthetical lock, Dialogue-initiated names, ruler note bands
- **v4.53** — two-stage header overflow, leading tool controls, panel icons
- **v4.52** — transparent embeds, centered rows, explicit tool homes
- **v4.51** — Scenes cards fill their host
- **v4.50** — content-sized character cards + scroll
- **v4.49** — the theme surface ladder
- **v4.48** — header = navigator surface
- **v4.47** — title-gap knob + status-bar headers
- **v4.46** — per-side header padding knobs + 0.5px hairlines
- **v4.45** — window-chrome Design knobs + docked divider
- **v4.44** — flush fullscreen + fd-bg window bodies
- **v4.43** — geometry-only header buttons
- **v4.42** — header polish
- **v4.41** — visible drag-out + shape-consistent Characters + ribbon hairlines
- **v4.40** — docked look restored + drag-to-editor threshold + hairlines
- **v4.39** — single-row window headers + drag docking
- **v4.38** — fullscreen □ vs expand ⤢
- **v4.37** — batch v11
- **v4.36** — batch v10
- **v4.35** — batch v9
- **v4.34** — Scenes fullscreen carries the full View cluster
- **v4.33** — Notes/To-Do are general-only; script notes edit on the highlight
- **v4.32** — batch v8 (items 1-13)
- **v4.31** — icon unification
- **v4.30** — batch v7
- **v4.29** — batch v6 on top of the template
- **v4.27–v4.28** — Derek's universal window template + two Customize moves
- **v4.24** — Derek's eight-update batch: ALL SHIPPED
- **v4.24-era run summary** — that run's full shipped list + open threads
  (Character tool overhaul, dockable tools, toolbar/ruler polish)

### Standing release blockers (unchanged; from CLAUDE.md §6 / HANDOFF.md §5)
Brand art (`src-tauri/icons/`, splash, favicon); Apple Developer + signing identity in
`build-desktop.sh`; rehost `languageCatalog.ts` dictionaries off Proteus's CDN; Courier
Prime + dictionary licenses; trademark clearance on "ScriptCraft"; `macos-private-api` is
on ⇒ no Mac App Store (the signed-`.dmg` plan); rotate the embedded GitHub PAT.

---

## 2. Best practices & footguns learned THIS run (add to the ones in CLAUDE.md §4)

These each cost a bug. They're specific to what this run touched.

- **Assets on desktop can't be `fetch()`ed.** Derek runs the Tauri SQLite backend, whose
  `getAssetUrl` returns a `convertFileSrc` `asset://…` URL — the webview loads it fine via
  `<img src>` but **cannot `fetch()` it**, so a blob-loader that fetched the URL showed a
  broken "!". Fix pattern, now the rule: **every storage backend exposes `getAssetBytes`;
  load bytes → `URL.createObjectURL(new Blob([bytes]))`.** Works on desktop *and* web.
  `AssetImage` / `AssetAudio` in `CharacterProfiles.tsx` are the reference.
- **Two lists that drift = the Remove bug.** The character panel drew names from the
  store's `characters` list, which goes stale the instant a cue is deleted
  (`updateCharacters` only re-runs when the cursor leaves a character node). So a deleted
  profile got resurrected. Fix, and the general rule: **derive from one fresh source.** The
  panel now scans the live doc (`scriptCharacterNames`) as the single source of "who's in
  the script"; the stale store list is not a source for it. (This is CLAUDE.md's
  single-source-of-truth rule biting in practice — believe it.)
- **Flex `flex: 0 0 auto` moves the shrink pressure, it doesn't remove it.** Making ribbon
  sections non-shrinking (so the bar scrolls instead of squishing) meant *all* the
  narrow-window shrink fell on the separators (still `flex-shrink: 1`) → they collapsed to
  0 width and the dividers vanished. **When you pin one set of flex children, pin the
  siblings that must keep their size too.** Now both sections and separators are
  `flex: 0 0 auto`; nothing shrinks, the bar scrolls.
- **Ribbon overflow model:** the toolbar used to hide low-priority sections into a "…"
  menu on narrow widths (that reads as "squishing"). It now **scrolls horizontally**
  (`overflow-x: auto` + non-shrinking children). The overflow menu is kept **only** for
  genuinely CSS-hidden (mobile-only, `offsetWidth === 0`) items so those stay reachable on
  phones. Don't reintroduce width-based hiding.
- **Making a floating window dockable = extract a body, share it.** Pattern used three
  times this run (Design, Workspaces, Feedback): pull the panel's guts into a
  `…Body`/`…Docked` component with no chrome, render it from both the floating window and a
  new `ToolDock` case, so the two entry points can't drift. To register a dockable tool:
  add the id to `ToolId` (`stores/editorStore.ts`), add an `ALL_TOOLS` entry + a render
  `case` in `ToolDock.tsx`; it then appears in **Customize > Side Panels** automatically
  (it's built from `ALL_TOOLS` minus `PANEL_EXCLUDED_IDS`). Give width-hungry surfaces
  `noPanelFit: true` so they open floating but still pop-in-dock.
- **Portalled toolbar slot = line one panel's controls up with another's.** The
  relationship map's action bar renders via `createPortal` into a `.char-rels-toolbar`
  `<div>` that CharacterProfiles owns (passed as `headerSlot`), so the map's Fit/Add
  buttons sit in the *same place and style* as the list view's toolbar. A `useState`
  element + ref-callback is the wiring (`setMapHeaderSlot`).
- **File-tab CSS trick:** tabs get `border-radius: 8px 8px 0 0`, `margin-bottom: -1px` to
  overlap the track's bottom border, and the **active** tab gets
  `border-bottom: 1px solid <content-bg>` (here `--fd-navigator-bg`) to *mask* the track
  line so it visually merges with the panel below. That's what makes them read as real
  tabs, not underlined text.
- **Design tokens are gated by a test.** Each token in `design/designTokens.ts` must have
  `def` equal to the CSS `var(--x, <fallback>)` literal it drives (a unit test enforces
  it). New knob this run: `charFieldGap` / `--dz-char-field-gap`, def `8`, and every CSS
  use writes `var(--dz-char-field-gap, 8px)`. Keep them in lockstep or `npm test` fails.
- **Persisted character data rides the whole profile object.** `voiceProfile`,
  `customFields`, etc. persist automatically because `_characterProfiles` serializes the
  full `characterProfiles` array (save sites in `ScreenplayEditor.tsx` +
  `MenuBar.tsx`; load spreads the full object; `collabSync` syncs the whole array). Add a
  field to the `CharacterProfile` type and it just persists — no per-field plumbing.

---

## 3. Architecture pointers for what this run touched

| File | What lives there |
|---|---|
| `components/CharacterProfiles.tsx` | The character tool. Tabs (`activeTab`: profiles/relationships/setup), `relViewMode` (list/map), `AssetImage`/`AssetAudio`, name-rewrite-into-script, Setup tab, custom fields. Big file — the whole tool. |
| `components/RelationshipMap.tsx` | SVG force-graph. Its toolbar (Fit + Add Relationship) **portals into `headerSlot`**; pan/zoom hint is a bottom-left corner overlay. |
| `components/ToolDock.tsx` | `ALL_TOOLS` registry + the render `switch`. Add dockable tools here. `WINDOW_IDS`, `PANEL_EXCLUDED_IDS`. |
| `components/DesignPanel.tsx` | `DesignPanelBody` (shared guts) + `DesignPanelDocked` + the floating `DesignPanel`. |
| `components/WorkspacesTool.tsx`, `FeedbackTool.tsx` | The new dockable tools. Feedback reads `data/helpForms.ts`. |
| `components/Toolbar.tsx` + `styles/screenplay/03-toolbar.css` | The ribbon. Overflow → scroll logic in `measure()`; `.rib-section` / `.toolbar-separator` are `flex: 0 0 auto`. |
| `stores/editorStore.ts` | `ToolId` (add dockable ids here), `CharacterProfile` type, character store actions. ~2.6k lines. |
| `design/designTokens.ts` | Design-knob registry; `def` must equal the CSS var fallback. |
| `styles/screenplay/10-character-profiles.css` | All character-tool styling. |

**The stylesheet is already split** into `styles/screenplay/NN-*.css` area files (that
was the long-planned `screenplay.css` split; it happened). Character = `10-…`, toolbar =
`03-…`, tools-extra = `22-…`, design panel = `26-…`, toolbar-zones = `23-…`.

---

## 4. UI verification — USE THE KIT (speed audit 2026-07-28)

**Start from `frontend/devtools/driver.mjs`** — launch/boot/seedScript/openTool/
fullscreen/waitScenes/shot, all event-waited. Derek timed the old way at 11
minutes per small update; the kit reaches the same verified state **31× faster**
(measured 108.4s → 3.5s, `devtools/bench-boot.mjs` reproduces it). The rules
live in `docs/SPEED-AUDIT-2026-07-28.md` §3; the short form:

- **Never type a fixture** — `seedScript()` injects the whole document through
  the DEV-only `window.__scEditor` handle (ScreenplayEditor, DEV builds only).
- **Never `waitForTimeout` on a guess** — wait on a named condition.
- **One driver run prints every number** you need; re-running is ~4s but the
  habit matters.
- Iterate with `npx vitest related <files> --run` (~3s); the **full suite once,
  before commit** (~12s since `isolate: false`; if a failure smells like
  cross-file leakage, re-check with `--isolate`).
- Driver scripts and fixtures live in `frontend/devtools/`, IN THE REPO — a
  rollback wiped the scratchpad copies mid-audit.

Environment facts that still hold:
- Chromium at `executablePath: '/opt/pw-browsers/chromium'`; dev server
  `npx vite --port 5199` (curl-poll for 200). Don't run `playwright install`.
- Startup dialogs block the UI — `boot()` Escapes them; clicking **Create** on
  the New Script dialog also works if you drive by hand.
- Open Customize via `window.dispatchEvent(new CustomEvent('scriptcraft:command', { detail: 'customize' }))`.
- Seed chrome state via `localStorage['opendraft:viewState']` in `addInitScript`;
  to keep a seeded ribbon verbatim, also set the one-time migration flags
  (`opendraft:toolbar*NNN`).
- Tools render **inline** by default (`.tool-inline-*`); clicking `.ProseMirror`
  **minimizes** an open tool window (by design).

---

## 5. Derek, in one paragraph

Sole product owner and tester; tests each build on his Mac and reports back. Wants **root
cause, not patches**; **one source of truth** for anything that appears twice; **no silent
no-ops**; honest risk assessment (defer with a reason, own mistakes plainly). He renames
things constantly — rename everywhere, immediately. Icons are monotone line-style, never
emoji in UI chrome. Never comment on the time of day. He iterates fast on visual
placement, so a reasonable attempt he can correct beats stalling — **but** don't invent
*content/behavior* decisions (a genre taxonomy, what a new control does); ask for those.
End every delivery with `cd /Users/dcarl/ScriptCraft && npm run desktop`.
