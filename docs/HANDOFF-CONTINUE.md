# ScriptCraft — continuation brief (current as of v5.20 — READ docs/SPEED-AUDIT-2026-07-28.md §3 before verifying anything; NOTE the isolate:false revert in §2)

> READ FIRST — v4.84 fixed a v4.81 bug worth learning from: the window
> shape-memory was written correctly and then OVERWRITTEN by the dock-row
> click handler (`setToolMode(id,'docked')` on every open), so the
> commonest way to reopen a tool erased the memory. My driver had tested
> the Tools MENU path and passed; Derek hit the panel-row path. When a
> feature has several entry points, drive the one the user actually
> uses — the rule now lives in ToolDock's `openFromRow`: opening READS
> the mode, only explicit gestures WRITE it.


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

That's it. **`npm run desktop` = `git pull` → `npm install` (no-op unless deps changed) →
launch the Tauri app.** So the instant you've pushed to `claude/v0_32`, Derek runs that
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

### v5.20 — the Scenes four-pack: contained popover, Cards per row, one menu, lighter cards (HEAD)

- Derek's batch: (1) "The filter menu items in the Scene tool spills out of
  the window." (2) "Copy the Pages per row tool… 'Cards per row:' aligned
  left on the same row as Reorder, and move Reorder so it is right aligned."
  (3) "allow only one of these menus to be open at one time." (4) "give the
  cards a lighter background color."
- (1) The popover's left math still assumed its pre-v3.54 240px width while
  the content had grown past it. It now measures the hosting shape —
  `closest('.tool-window, .tool-inline, .fs-tool-takeover')` (those are THE
  three window containers; viewport fallback) — takes width
  clamp(240, winW−16, 400) INLINE, right-aligns to the trigger, clamps into
  the window box. `.scene-filter-row`/`.scene-filter-colors` got flex-wrap
  so unshrinkable content (the 10 color dots) wraps instead of overflowing.
- (3) ROOT CAUSE: every header trigger stopPropagations pointerdown (the
  window-drag guard), so the bubble-phase outside-close listeners never
  heard presses on sibling controls — two menus sat open. Both closers
  (ControlDropdown in ToolControls, the filter popover in SceneControls)
  now listen in the CAPTURE phase with explicit target tests (trigger and
  own-menu exempt). This fixes exclusivity for EVERY ControlDropdown pair
  in the app (Locations Filter+Sort etc.), not just Scenes. ControlDropdown's
  resize handler split out (it closes unconditionally; the pointer one
  target-checks).
- (2) `cardsPerRow` in sceneNavSlice (CARDS_PER_ROW 1/8/3 — exact copy of
  the pagesPerRow model incl. NOT persisted, matching Pages); stepper JSX in
  ScenesTool's ToolActionRow, cards mode only; Reorder wrapped in
  `.tool-action-right` (the Pages Go-to pattern) so it right-aligns in both
  views. Grid: `repeat(var(--cards-per-row, 3), 1fr)` — fallback must equal
  CARDS_PER_ROW_DEFAULT. (The grid WAS auto-fill minmax(190px,1fr) because a
  hardcoded 3 once squeezed side panels — fine now: the count is Derek's own
  number and steps to 1.)
- (4) `.index-card` background: dropdown-bg → toolbar-bg — one step up the
  surface ladder (dark #2d2d2d → #353535), lighter in light theme too.
- Tests: exclusivity simulated in jsdom (dispatch pointerdown on the second
  trigger — capture listener fires there too); cardsPerRow clamp. Driver
  check-scenes-v520.mjs (11 checks): popover rect ⊆ window rect, no
  scrollWidth overflow, dots contained, both exclusivity directions, stepper
  left / Reorder right by rect math, 3→4 columns, card bg rgb(53,53,53).

### v5.19 — Reorder wears the dialogs' Apply format

- Derek (screenshot of a dialog's Cancel/Apply): "change the reorder button
  to match this format." The Scenes Reorder button's idle look is now the
  filled-accent primary — done by WEARING `dialog-btn dialog-btn-primary`
  (ScenesReorderControl), not by copying values: the dialogs' rules, their
  light-theme variant and the Design knobs --dz-dialog-btn-h/-radius all
  drive it for free. 22-tools-extra.css keeps ONLY the `.active` amber
  override (deliberate since v4.32: an unapplied order must not look like
  an available action) — it beats the light-theme dialog rules on source
  order (same specificity, 22 loads after 01), noted in the comment.
- The old `.scene-reorder-btn` idle block (grey wash + accent outline,
  v5.13) and its grey hover are GONE — the hover would have tied with
  `.dialog-btn-primary:hover` and won on source order, silently killing the
  primary hover.
- SceneNavigator.test.tsx now selects `button.scene-reorder-btn` (was
  `.tool-action-btn`, a class the button no longer wears) and pins
  `dialog-btn-primary` in the class list.
- Driver check-reorder-btn.mjs (5 checks): computed-style EQUALITY against
  a live `dialog-btn dialog-btn-primary` probe appended to the same
  document (9 properties, zero diffs — the "same format" proof is the
  dialogs' own computed values, no hardcoded colors); active still amber.
  Gotcha recorded: after page.click the cursor hovers the button — move
  the mouse away before reading colors or you sample the :hover shade.

### v5.18 — per-row button spacing; the box-air truth

- Derek: "for two row section, add bottom row button spacing and top row
  button spacing. currently 0 for button spacing still has a decent gap."
- ROOT CAUSE of "0 isn't 0": flex gap bottomed out at box-touching, but a
  20px (22 comfortable) button box holds a ~16px glyph — the "decent gap" at
  0 was the boxes' own air around their icons. Same finding as v4.12's row
  gap, vertically. Same cure: margins, which unlike `gap` can go NEGATIVE.
- The row's `gap` became `.rib-row > * + * { margin-left: … }`; the second
  row (`.rib-row ~ .rib-row >`) reads its own var. Four tokens replace the
  two per-kind ones: ribBtnGapTop/BottomTitled, ribBtnGapTop/BottomUntitled
  (min −10 to overlap boxes; def 1 so nothing moves). In-row user dividers
  keep their intrinsic 6px side margins via `calc(knob + 6px)` restore rules
  — defaults render IDENTICALLY to the gap model (driver-proven: 1px pairs,
  7px divider air).
- Specificity dance (recorded in 03-toolbar.css): divider rules AFTER row
  rules — bottom-divider (7 classes) beats all; top-divider vs bottom-generic
  is a 6-class tie broken by source order; top-generic (5) loses to both.
- migrateDesignVars (designSlice) seeds both rows from a saved per-kind
  value — the v4.46 toolWinHeaderPad pattern (init-time; a preset imported
  mid-session migrates on next launch). 5 new unit tests in
  designMigrate.test.ts.
- Drivers: NEW check-ribbon-btngap.mjs — 11 checks in 3 boots (defaults
  parity incl. divider air; per-row isolation with 8 / 0 / −6 / 12 rendering
  exactly, the −6 as real box overlap; legacy-key migration).
  check-ribbon-zero.mjs measures box-edge pair distances now (margins never
  show in columnGap — rect deltas are the honest measure).
  check-ribbon-kinds.mjs drives BOTH new knobs through the real Design panel.

### v5.17 — padding grows the bar; the descender truth

Derek: "increasing the section bottom padding can push the title behind the
top bar. adjusting padding should never do this. the height of the bar
should adjust instead." Root cause: per-kind paddings were rendered but NOT
counted in ribbonKindVars' contentH, so a padded section overflowed the
centered bar both ways and the title clipped under the menu bar.
- ribbonKindVars now takes the four vertical pads; each kind's TOTAL =
  pads + k·inner; contentH = max of totals; the auto-fill levels the padded
  totals (still targeting titled-at-100%). CSS-truth note in the helper:
  every scaled term mirrors a ×--rib-k rule — and that audit caught a real
  mismatch: the ROW-GAP margin wasn't ×k while row heights and title gap
  were. It is now, so "Section scale" scales the whole section. (The kinds
  driver consequently expects rendered rowGap = knob × fill — 9 renders
  9×72/65 with gapU 9 — the formula, not the raw knob.)
- "Space between title and buttons: 0 still leaves a distance": at 0 the
  structural margin IS zero — the leftover is the title text's descender +
  the buttons' centering inside their row (~4-5px of physics). Rather than
  lie about zero, the knob now goes NEGATIVE (−10) with a hint saying
  exactly that; the auto-fill floors at 0.25 so extreme negatives can't
  invert the bar.
- 10 unit tests (padded totals level, contentH grows by pads, negative gap,
  floor) + 4 new driver checks (bar grows ≥15px under 16px padding, title
  and rows stay inside, −6 renders −6). Both ribbon drivers green: 19 + 17.

### Older versions — one line each (full sections in `docs/HANDOFF-ARCHIVE.md`)

Newest first. When a version rolls out of the detailed set above, its section
moves verbatim to the archive and its line lands here.

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
