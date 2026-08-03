# ScriptCraft — continuation brief (current as of v5.97 — READ docs/SPEED-AUDIT-2026-07-28.md §3 before verifying anything; NOTE the isolate:false revert in §2)

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

### v5.79 — connect-to-location, the pin anchor, and cursor placement

Derek's three:
1. "+ Connect to location" (renamed), listing ALL script locations plus the
   location GROUPS. `connectTargets()` in utils/locationPlaces (6 tests):
   every location minus the ones this place already has, each carrying a
   `from` label when it sits on another pin; groups are the other places
   that are named or already multi-location, and picking one MERGES. The pin
   dropdown now renders the SAME list — one connect list, two entry points.
2. "locking an items position moves the pin off the map." ROOT CAUSE: v5.78
   anchored the marker with `translate(-100% + 12px)` for right-half pins but
   never reversed the capsule's children, so the marker (the first child)
   stayed on the LEFT — a pin stored at 79.9% drew at 63.6%, and locking it
   (a lock glyph widens the capsule) pushed it to 61.8%. `row-reverse` on
   .locmap-pin-flip puts the marker at the anchored edge: 79.9% → 80.2%, and
   locking moves it 0.0%.
3. "+ Add Pin" is the blue button and ARMS placement — a dashed ghost pin
   rides the cursor and the click sets it down; Escape cancels.

ONE MORE BUG, found by the check: the guard that swallows a pin-drag's own
trailing click could outlive the gesture. When a drag ended ON the pin, no
canvas click ever arrived to clear the flag, so the writer's NEXT genuine
click was eaten. A time window traded one race for another; the flag is now
cleared by whichever comes first, the drag's click or the next press.

devtools/mapFixture.mjs — the PNG generator both checks were carrying a copy
of, now one module (the container restarts, /tmp doesn't survive).
check-v578 30/30, check-v577 37/37. Gates: tsc 0, 1013 tests, build.

### v5.78 — Locations map: six follow-ups

Derek's list, in his numbers:
1. One sidebar row per PLACE, not per script location — `locationRows()` in
   utils/locationPlaces (pure, 6 tests). The row carries a count badge.
2. The expanded row lists its script locations as a field, each detachable
   (the last one isn't — a place with no name is nothing).
3. "+ Connect a script location" in that row, a portalled list of the
   locations not yet placed.
4. "+ Add Pin" drops one in the middle and opens its dropdown. Clicking the
   map still works — "instead of JUST clicking on screen".
5. THE PIN JUMP, root cause: the whole capsule was centred on the point, so
   a longer label dragged the marker sideways — the driver measured the
   marker going from 4.5% to **-3.3%** of the map (off it) when a name was
   attached. The MARKER is now anchored on the point (12px into the capsule)
   and the label hangs off it; in the right-hand half the capsule flips so
   the label reaches inward. Same driver measurement now: 7.8% → 7.8%.
6. `locked` on the place, toggled from the pin dropdown AND the sidebar.
   movePlace() refuses a locked pin, so no caller can move one.

TWO BUGS THE CHECK FOUND, both mine, both fixed:
- Dragging a pin dropped a SECOND pin: the drag ends with a mouseup on the
  map, and the browser then fires a click on the common ancestor. A guard
  swallows exactly that click.
- A locked pin couldn't open its own dropdown (the early return killed the
  press), so it could never be unlocked. A locked press now still counts as
  a click; it just never moves.

check-v578 18/18, check-v577 still 37/37. Gates: tsc 0, 1007 tests, build.

### v5.77 — Locations: a pin is a PLACE

- Derek's brief: rotate the background on import and then lock it; an
  options button in the HEADER to replace/delete it; click the map to drop
  a pin and pick (or create) its location; the sidebar lists every location
  and opens display name / description / + Add custom field; the dropdown
  can rename in the script; and a pin can carry SEVERAL script locations
  ("BELKADAN - SPACE and BELKADAN - SURFACE would be the same location").
  Mid-batch: "change list and map from tabs to the View button format".
- MODEL CHANGE: `utils/locationPlaces.ts` replaces locationPins. A PLACE
  owns the spot — scriptNames[], displayName, description, fields[], x/y —
  and script locations attach TO it. That one shape answers every one of
  Derek's asks; a name-keyed pin could not have held two locations.
  45 pure tests. v5.75's flat pins migrate on load (`migratePins`).
- The display name is window-only, in BOTH views. Where one display name
  covers several script locations, each row appends its own script name —
  otherwise the list showed the same word three times, which the driver
  screenshot caught after the unit tests were green.
- Rotation locks because pin fractions are measured against the image AS
  SHOWN; a later turn would move every pin off its landmark. The stage is
  measured against the ROTATED ratio (rotatedRatio), and a quarter turn
  swaps the box, which check-v577 asserts by geometry.
- ONE heading rewriter: `utils/renameLocationInScript.ts`, shared by the
  List view's Rename Location and the pin dropdown's "change the name in
  the script". It also moves the places onto the new name.
- `mergePlaces` (the "assign to an existing pin" action) carries the
  source's display name / description / custom fields onto the target when
  the target's are empty, then drops the source pin. The first cut just
  re-attached the names and left an empty pin sitting on the map — the
  driver check caught it.
- Chrome: no tab strip. `LocationsControls` now leads with a View dropdown
  (List/Map, the same control the Characters window's Relationships view
  uses) and, on Map only, `LocationMapOptions`.
- check-v577 37/37 drives all of it through the real UI. Gates: tsc 0,
  1017 tests, build.

### v5.76 — the map image actually displays

- Derek, on the v5.75 build: "the image is not displaying" — a broken-image
  box where the map should be.
- ROOT CAUSE: v5.75's MapImage was a THIRD hand-rolled image loader. On the
  desktop `getAssetUrl` returns a `convertFileSrc` asset:// path that the
  webview will not load from an <img src> here — which is the entire reason
  `AssetImage` exists (api.ts says it outright: "fetching getAssetUrl
  directly does NOT [work]"). Character portraits have always gone through
  AssetImage → `api.getAssetBytes` → blob URL, which every backend
  implements. The map now does too; the private loader is deleted.
- AssetImage gained two passthroughs — `onLoad` (the map needs the natural
  size for its stage fit) and `onFailed` (so a caller can show its own
  message instead of the one-character "!" box).
- A map whose bytes can't be read now renders a stated panel — "This map
  couldn't be loaded… Replace it — the pins are kept" — rather than a
  broken icon. The stage also keeps a 4:3 box before the image reports its
  shape, so loading/failed states have somewhere to render.
- check-v575 is 23/23: the two new cases stub the asset fetch to prove the
  asset path resolves to a blob: URL through the shared loader, then reject
  it to prove the failure panel appears.
- STILL CARRYING THE SAME FLAW, reported not fixed: `TpImageThumb` in
  TitlePageEditor is the OTHER private loader (authedFetch + a raw
  asset:// <img src> on Tauri), so title-page IMAGES are likely just as
  broken on the desktop. Same one-line class of fix; it needs AssetImage to
  take a style/size passthrough, which is surgery on a shared component for
  an unasked change. Next pass.

### v5.75 — Locations: List / Map tabs, with pins

- Derek: "add the tabs List and Map to the locations window. the current
  locations info will go under list. in the map tab, allow the user to
  upload a map, which acts as a background in the tab, and then the user
  can pin locations from the list onto the map."
- SHAPE: `useLocationsTabs` in SceneNavigator, registered in ToolDock's
  TOOL_CHROME like usePagesTabs — same chrome slot, no second tab
  mechanism. List renders exactly what the window rendered before.
  `LocationMapTab.tsx` is the Map tab: a rail of not-yet-pinned locations
  beside the map. The rail reads the SAME filtered/sorted `locations` the
  list does, so the window's Filter/Sort/Search drive both tabs instead of
  going decorative on one.
- DATA: `utils/locationPins.ts` holds the rules, pure and tested (20
  tests) — upsert/remove/rename/visible/unpinned/dropFraction.
  `stores/slices/locationMapSlice.ts` holds image + pins;
  `locationsTab` sits in sceneNavSlice with pagesTab (view state,
  per machine) while image+pins are SCRIPT data, saved as
  `_locationMapImage` / `_locationPins` in composeSaveContent and read
  back at BOTH load sites in ScreenplayEditor.
- Pins carry FRACTIONS of the map image (0..1), never pixels — a pixel
  offset slides off its landmark the moment the window resizes.
- Renaming a location moves its pin (handleRenameSubmit calls
  renameLocationPin); a pin whose location disappears is kept in the data
  but not drawn, so retyping the heading brings it back.
- Images follow the app's existing two-path rule: a project uploads an
  ASSET, local-only stores a data URL; `resolveImageUrl` reads both.
- THREE LAYOUT BUGS the check caught, all mine, all now fixed:
  1. `max-width/max-height: 100%` leaves the image contributing its
     NATURAL width to layout — a wide map sized the whole tab and pushed
     it out of a narrowed window. The map is now MEASURED: a
     ResizeObserver on the canvas + the image's aspect ratio give the
     stage an explicit px size.
  2. Measuring the canvas while the map sized the canvas fed back on
     itself. The scroll layer is now ABSOLUTE (`inset: 0`) inside the
     canvas, so the map contributes no intrinsic width to any ancestor.
  3. A CENTRED flex item that overflows can't be scrolled back to on the
     start side — the top of a tall map, and any pin on it, was
     unreachable. `margin: auto` centres and keeps the overflow reachable.
- WebKit: every dragstart calls dataTransfer.setData() (CLAUDE.md §4).
- check-v575 20/20 drives the real chrome tabs, uploads a real PNG through
  the real file input, drags from the rail, and reads back where the pin
  landed. NOTE for future checks: DragEvent clientX/clientY are INTEGERS,
  so a tiny fixture image can't express a fractional drop — use a
  realistically sized one. Gates: tsc 0, 972 tests, build. TENTH rollback
  at batch start.

### v5.74 — ONE title page, three renderers reconciled

- Derek, after v5.73: "the title page in the title page tool, and the
  title page in the Page > All view still do not match." True — v5.73
  fixed the thumbnail against the EDITOR's CSS, but the Title tab's
  preview is a THIRD hand-written renderer, and all three disagreed.
- ROOT CAUSE + FIX: `titleLineStyle(field, {sizePt, shiftPx})` in
  utils/titlePageLayout.ts is now THE definition of a title-page line;
  TitlePageEditor's renderSpecLine and SceneNavigator's getBlockStyle both
  render from it (the editor CSS is the third renderer and is kept in step
  by hand — comments in all three say so). `titlePaperShiftPx(layout)` is
  the paper-centering correction, applied by both containers.
- THREE REAL BUGS THIS SURFACED:
  1. title2's size lives in **tpTitleFontSize** on the node (that's what
     titlePageBlockSpecs writes, and what renderHTML / computeBreaks /
     pdfExporter read). v5.73 read tpTitle2FontSize → title2 previewed at
     12pt. The v5.73 TEST passed because its fixture set the attr no real
     node carries — fixture now built the way the builder builds.
  2. The preview page was a hardcoded 8.5x11in with 1in/1.5in margins and
     NO paper shift: A4 or custom margins previewed as Letter, and its
     centered title sat 0.25in right of the paper's centre. It now takes
     pageWidth/Height + all four margins + the shift from pageLayout.
  3. `.title-page-author { line-height: 1.5 }` was the odd one out — the
     paginator, the preview, the thumbnail and the PDF all count a credit
     line on the 12pt grid. Removed.
- STILL DIVERGENT, REPORTED NOT FIXED: pdfExporter treats **title2** as a
  plain 12pt line (`isTitle = field === 'title'`), so the printed PDF
  neither uppercases nor enlarges it. One-line change, but it moves print
  output and can't be verified in this sandbox — queued for its own pass.
- check-v574 14/14: fills the REAL form, clicks Apply, reads BOTH live
  renderings and compares block by block (text/align/weight/caps/wrap +
  size as a multiple of that rendering's own body line — the two are
  transform-scaled differently, so raw px cannot be compared), then
  proves each centres the title on the paper. Gates: tsc 0, 952 tests
  (+9 titleLineStyle), build. NINTH rollback at batch start.

### v5.73 — the title-page THUMBNAIL shows the true format

- Derek (screenshot of the All tab): "the small version of the title page
  in this window should display the true format." It was drawing title
  pages as body elements — action indents, left aligned, no weight/caps/
  size — because PageBlockInfo carried only {typeName, text, lines, pos},
  and the real look lives in `.title-page` / `.title-page-<field>` CSS
  keyed off the node's `field` attr, which never reached the preview.
- pagination.ts: blocks now carry titleField, fontSizePt (title vs title2
  read their OWN size attrs — the same split renderHTML makes) and
  imageLines. SceneNavigator's getBlockStyle takes the BLOCK (not a type
  name) and, for titlePage, reproduces: per-field alignment (title/
  title2/author/date center, draft left, contact/copyright right), bold +
  uppercase titles, the custom size with its 12pt-slot-snapped
  line-height, and the paper-centering shift ((right-left)/2) that the CSS
  applies — without it a centered title lands (1.5in-0.76in)/2 right of
  the paper's true center. The comment in each place says KEEP IN STEP:
  one look, two renderers (editor CSS + this inline style).
- FIXED ALONGSIDE (same feature, real bug): the title-region carve counted
  only titlePage nodes, but computeBreaks counts the leading run of
  titlePage OR screenplayImage as the title page — so a title-page logo
  previewed at the top of script page 1. The carve now matches
  computeBreaks (guarded: no titlePage in the run ⇒ a leading image is
  ordinary body content, untouched), and an image block reserves its
  paginator line budget instead of collapsing to one blank line.
- check-v573 11/11 — computed styles AND geometry (title box center vs the
  paper's center, 0.00px off; draft inside the left margin; script pages
  unchanged). Gates: tsc 0, 943 tests (+5), build.

### v5.72 — Pages tabs: Script / Title / Custom / All

- Derek: "change the name of the tabs again so they are Script, Title,
  Custom, All. and put the tabs in that order." One edit in usePagesTabs
  (labels + order; ids untouched). check-v572 5/5 (exact strip order +
  each tab still lands on its view). Gates: tsc 0, 938 tests, build.
- EIGHTH sandbox rollback hit at this batch's start (stale tree at
  7febeb7 while origin held v5.71) — standing drill ran: reset --hard
  origin, npm install (TS2307 symptom), Vite restart. One new wrinkle
  for the drill: restart Vite FROM frontend/ — a root-started Vite
  serves 404 and the driver reports ERR_HTTP_RESPONSE_CODE_FAILURE.

### v5.71 — All Pages tab, tab renames, the collapsed-tabs caret

- Derek, three asks. (1) CARET: every window whose header tabs collapse
  into the narrow-dock dropdown now shows a trailing ▾ — a `caret` prop
  on ControlDropdown, set by HeaderTabs' collapsed branch, so ALL tabbed
  windows (Characters, Tags, Pages) get it from the one shared spot.
  (2) ALL PAGES: a leading Pages tab compiling the other three — title
  page + script pages + custom pages in document order. (3) RENAMES:
  "Script Pages" / "Title Page" / "Custom Pages" — labels only, the
  persisted pagesTab ids stay 'script'/'title'/'custom' (+ new 'all').
- Pagination: computePageBlocks grew opts.includeTitlePage — the v5.13
  title carve, instead of discarding the region, re-emits it as an
  UNNUMBERED first page (isTitle, pageNumber 0); titlePage nodes render
  only on that bound (the per-node guard keeps them off script pages).
  The DEFAULT call still emits nothing — pageThumbnails.test pins both
  behaviors (11 tests incl. 5 new).
- SceneNavigator: pageContentAll (flagged call) is the ONE computation;
  pageContent derives by dropping the title entry, so every existing
  consumer (posAfterScriptPage, goToPageNumber, lastScriptPage, scroll
  sync, tool count) keeps v5.13 semantics with ZERO new guards. Only the
  All grid and posAfterEntry read the full list — so dropping a dragged
  custom onto the title thumb lands it "after the title page" (= before
  page 1), which is the only legal spot there anyway. Controls (#/search)
  and the scroll-sync/goto effects run on Script AND All. The custom
  position note stays Custom-tab-only (All SHOWS the position).
- check-v571 12/12 (carets in two windows, renamed set, document order
  Title | Page 1 | Custom | Page 2, real title text in the thumb, no ⋮
  on the title, controls on All, Script still script-only).
  Gates: tsc 0, 938 tests, build.

### Older versions — one line each (full sections in `docs/HANDOFF-ARCHIVE.md`)

Newest first. When a version rolls out of the detailed set above, its section
moves verbatim to the archive and its line lands here.

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
