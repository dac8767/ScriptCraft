# ScriptCraft — continuation brief (current as of v4.28 — the universal window template era)

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

### Versioning — a live inconsistency to resolve
This run iterated fast and **did not bump the version**: `frontend/src/data/changelog.ts`
still reads `APP_VERSION = '4.22'`, while the code comments written this run say `v4.23`.
So "v4.23" is only an internal marker, not a shipped version. **If Derek wants the About
box / changelog to reflect this run's work, bump `APP_VERSION` to `4.23` and add one
hand-written, newest-first changelog entry.** Otherwise leave it — nothing breaks, the
number is just cosmetic. Decide with Derek rather than silently bumping.

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

## 0.6 editorStore slicing — DONE (10 domains; chrome deliberately deferred)

`stores/editorStore.ts` was carved into per-domain Zustand slices. **editorStore
went 3,099 → 1,699 lines.** Every step was a pure, shape-preserving refactor
(flat state kept, consumers untouched), gated by tsc/test/build, and pushed as
its own commit.

**Done (each `stores/slices/<name>Slice.ts`):** `designSlice`, `characterSlice`
(data CRUD), `tagSlice` (data), `typewriterSlice`, `notesSlice`, `sceneNavSlice`
(filters), `workspacesSlice` (the apply-doesn't-take bug was later ROOT-CAUSED
and fixed here — see the fix round in §0.7), `viewPrefsSlice` (viewStyle/preview/
visibility/zoom/font/pageLayout; `theme` stayed — dynamic theme-apply imports),
`spellGrammarSlice` (took the module-load dictionary/add-targets/language infra
with it; its import-time `spellChecker.set*` side-effects still run at startup
because editorStore imports the slice), `beatsOutlineSlice` (beat CRUD +
outline-tab system + bar-routed edits + the debounced undo/redo engine —
`_pushBeatSnapshot` became an in-creator closure over `api.setState`, no
singleton back-reference).

**Shared plumbing (spine):** `stores/viewState.ts` holds `ViewState`,
`loadViewState`/`saveViewState`, the `_vs` singleton, and `clamp`. Slices import
those from there — NOT from editorStore (would be circular). Types/value-consts
still exported from editorStore (external importers): import types **type-only**
in slices; value-consts are safe when only read inside the creator (live binding).

**chrome-customization is deliberately NOT sliced** (Derek's call): its ~196
refs are interspersed the whole length of the store — it IS the store's core —
the marginal win is the smallest, the risk the largest, and slicing it would
not free the toolbar/menus/customize lanes (same chrome domain either way). If
ever attempted: it also owns the ~120-line import-time toolbar-zone migration
chain at the top of the file.

---

## 0.7 Safe-progress phase — coverage + real bugs found (this run's tail)

After the slicing, work switched to "Path A": extract/test pure logic, add
regression tests to critical untested code. The suite went **343 → 419 tests**.
What landed:

- **`utils/screenplaySaveContent.ts`** — `composeSaveContent` + `resolveHFFields`
  lifted from ScreenplayEditor **with tests** (the extras list that once wiped
  Outline beats when forked is now pinned).
- **`components/screenplayEditorConstants.ts`** — editor static config lifted;
  test locks `DEFAULT_NEXT_TYPE` ↔ `ALL_ELEMENT_TYPES` in sync (§3 drift bug).
- **REAL BUG FOUND & FIXED: working notes leaked into FDX/DOCX/PDF exports.**
  §4's filter only existed inline in fountainExporter. Now one shared predicate
  — **`utils/workingNotes.ts`** (`isWorkingNoteNode`) — is routed through by ALL
  FOUR exporters. Add a new working-note kind there and every path excludes it.
  Fountain + FDX exclusion is unit-tested. **DOCX/PDF: VERIFIED live** — the real
  export pipelines were driven in headless Chromium against the Vite dev server
  (playwright-core, `page.evaluate` dynamic-importing `/src/utils/*.ts`, download
  capture); the produced `.docx`'s `word/document.xml` and the `.pdf` (read back
  through the app's own `parsePdfScreenplay`) contain none of the seeded working
  notes while all real-content controls survived. Same technique works for any
  "needs the running app" check (e.g. the dead-CSS pass): `npm run dev` +
  playwright-core with `executablePath: /opt/pw-browsers/chromium`.
- **Round-trip guards:** Fountain export→parse and FDX export→parse both
  round-trip the core elements under test — catches exporter/parser drift.
- **Coverage added to previously-untested core logic:** `scriptStatistics`,
  `scriptTiming`, `scriptStructure`, `fountainParser`, `fdxParser`, `scriptDiff`.
- **Coverage fan-out (9 modules, 133 tests, each verified by an independent
  re-derivation pass):** `odraftFormat` (native-format round-trip), `templateConflicts`,
  `templateCss`, `effectiveFormatting`, `titlePageLayout`, `dateFormat`,
  `pdfClassify`, `fonts` (registry↔categories drift-guard), `docxImporter`
  (in-memory .docx fixture). Suite now 552 tests / 75 files.

**Fix round (2026-07-24, Derek's "continue with suggested"):** every flagged
finding below was fixed as its own tested commit — the pinned KNOWN LIMITATION
tests flipped to assert the corrected behavior:

- `.odraft` robustness (null crash → friendly error, version gate, themes
  returned by parse, `''` title round-trips) — `1f6e575`
- Title page: lone "based on" credit reaches the page; two-line byLine budget —
  `64fa6d8`
- PDF import decision table: text-identified scene headings at any indent,
  FADE IN: at the left margin, `(V.O.)` → parenthetical, back-to-back
  parentheticals, band-gap at 130, empty-run guard — `02e9601`
- scriptDiff "modified" was unreachable (LCS emits add-then-remove; merge now
  handles both orders — DiffViewer shows inline word diffs) — `b90d4d2`
- ONE `stripHtml` (utils/stripHtml, DOMPurify + textContent decode): FDX cast
  descriptions decode entities; block boundaries spaced — `2b4fa5e`
- Small batch: parseISODate range check, FontEntry.category typed against
  FONT_CATEGORIES, templateCss placeholder fallback, effectiveFormatting
  docblock truth-up (behavior unchanged by design) — `4a77b3b`
- DOCX import: right-align needs transition-shaped text, act-break anchoring,
  warnings only for lines still ambiguous after pass 2, namespace-safe
  dc:title — `a724730`
- Template enforce detect→resolve converges in one pass (replace ops strip the
  replacement's locked marks; all-disabled fallback declines) — `5b185d5`
- **Workspaces "apply doesn't take" — ROOT-CAUSED & FIXED** (`bc0dd00`): save
  captured `panelSizeMode`/`chromeCustomPx`/`theme` but apply never restored
  them (drifted field lists). Apply now restores everything, theme via
  setTheme so the DOM actually changes. Live-verified in headless Chromium.
  Keep save/apply in lockstep — workspacesApply.test.ts guards the round-trip.

**Component-split phase (started 2026-07-24, Derek: "start the splits").**
The verification pattern for EVERY extraction: gates (tsc/test/build) + a live
smoke in headless Chromium driving the real surface (the recipe in the export
section above). Four steps landed, each its own commit:

- `CharacterScanTab.tsx` (1e72eec) — the From Script tab out of
  CharacterProfiles; smoke ran a real scan.
- `CharacterRelationshipsTab.tsx` (8688334) — List/Map tab; the map-toolbar
  portal slot state moved with it; smoke added a relationship + mounted the map.
- `DiagnosticsDialog.tsx` (ac335b0) — owns its collect-on-mount lifecycle;
  MenuBar keeps only the open flag. NOTE: it lives under Help → Developer ▸.
- `AboutDialog.tsx` (9a03c5b) — What's New hands off via onShowChangelog.

Running totals: CharacterProfiles 1767 → 1643, MenuBar 2824 → 2599.
Next in the queue: MenuBar's Changelog dialog (state cluster around
changelogOpen/clKeyword/clTag), then Toolbar's 32-case render switch — do THAT
one as thin-out-the-big-cases-first (zoom, fontSize, insertTable each become
components), NOT a one-shot switch→map move: the cases lean on ~30 closure
variables and a mega-move invites transcription bugs. ScreenplayEditor hooks
remain the riskiest; live-smoke each one.

Also verified this run: the Design tool's Menu Bar items (Item spacing,
Dropdown min width) work end-to-end — store→pixels, panel number inputs, real
slider drag, reload persistence — could not reproduce Derek's "never worked";
ask him for exact repro if he still sees it.

**Still open (needs Derek):**
- The Design-panel options that never worked — need Derek's list of WHICH
  options, then same root-cause treatment.
- Minor unfixed nits (deliberate): odraft meta value-type validation,
  fonts loadFont failure-retry, templateCss selector escaping (UUID ids).

**Test-writing notes:** any test that (even transitively) imports `editorStore`
needs `// @vitest-environment jsdom` (the store touches localStorage at import).
Single-file `npx vitest run <file>` sometimes resolves a cached vitest without
jsdom and dies with ERR_MODULE_NOT_FOUND — the full `npx vitest run` is
reliable; re-run before believing a weird worker failure.

---

## 1. Where we are right now (end of this run)

### v4.27–v4.28 — Derek's universal window template + two Customize moves (HEAD)

Derek supplied a schematic: EVERY tool window is row 1 (pop-in | centered tool
name + count | window actions · pop-out · close) over row 2 (tabs left |
Filter / Sort / View / Search cluster right, Airtable-style quiet controls).
Shipped in four phases, all on `claude/v0_32`:

- **`ToolControls.tsx`** — the shared primitives: `ControlDropdown` (portalled
  menu, 150ms scroll-grace) and `ControlSearch` (magnifier ⇄ inline field,
  Escape collapses). Styled once as `.tool-ctl*` in `20-tool-dock.css`.
- **`TOOL_CHROME` registry in ToolDock** ({TitleExtra, WindowActions, Tabs,
  Controls}) — REPLACES `TOOL_HEADER_EXTRAS`/`TOOL_FOOTERS` (both deleted).
  The floating frame renders 3-zone row 1 + row 2; the dock compresses the
  same template: the accordion row IS row 1 (open tool's count + fullscreen
  ride on it), `.tool-inline-header` is row 2. `.tool-chrome-row2-tabbed`
  rows read as a tab track (workspace bg, -1px tab overlap) and WRAP in the
  300px dock (tabs line, then controls line). The controls span is flex:1 +
  justify-end so spanning bars (Outline, Scrapbook) keep their layout.
- **Characters migrated** (tabs/sort/view/search now STORE state:
  `charActiveTab`, `charViewMode` (persisted), `relViewMode` (persisted),
  `charSearchQuery`, reusing `characterSortBy`). The in-body tabs/toolbar
  rows are GONE in embedded mode (the frame provides them); the fullscreen
  takeover renders the same `CharTabs`/`CharControls` in its own two rows;
  the legacy context-menu overlay keeps its private header/tabs/toolbar.
  **View (Cards/List) now applies EVERYWHERE, default Cards** — the dock used
  to be list-only; flip the View dropdown if Derek prefers the old look.
  The Relationships tab's List/Map toggle is the cluster's View dropdown.
- **Scenes migrated** (worker): count → title suffix, filter popover behind a
  quiet "Filter" + active-dimension chip, List/Cards → View dropdown, the
  footer search → the cluster's expanding search (`TOOL_FOOTERS` retired).
  Filter/Search hide in Cards view (they only drive the list).
- **Sweep**: navigator/goals/notebook/beatboard control bars re-registered as
  `TOOL_CHROME.Controls` — same row-2 slot, internal layouts unchanged.
- **v4.28 moves**: "Mores & Continueds" left Settings for **Customize >
  Editor** (embedded `MoresContdsDialog`), and the **Customize > Menu Bar tab
  is GONE** — menus are ALWAYS native macOS now (`nativeMenus = isTauriEnv()`
  in MenuBar; `menuSystem`/`setMenuSystem` deleted from settingsStore; the
  in-window bar remains only as the non-Tauri browser fallback). Stored
  `menuBarOrder`/`menuBarHidden` still shape the native bar; their editor UI
  is gone. `opendraft:menuSystem` localStorage key is orphaned on purpose.

Verified live end-to-end (template-check.js / moves2-check.js in the driver
scratchpad): dock inline, popped-out floating, fullscreen, sort/view/search
store writes, scenes filter chip + cards-view hiding, sweep smoke on the four
re-registered tools — zero page errors; 605 unit tests, tsc 0, build green.
`APP_VERSION` and the changelog are at **4.28**.

---

### v4.24 — Derek's eight-update batch: ALL SHIPPED (this run's head)

Derek queued eight numbered updates; two spawned worker chats never materialized, so
the Dispatcher absorbed the whole batch. All eight are on `claude/v0_32`:

1+2. **From Script tab auto-scans on entry; classifications + scan list persist in the
   script file** (`_referredTags`/`_characterScan` in `composeSaveContent`, restored by
   both load paths, cleared by every per-script reset). Root cause of the lost
   classifications: they only rode collabSync's Yjs map, which never runs Local-only.
   Same commit: **MenuBar's forked partial save-extras list is gone** (manual File>Save
   was stripping `_shelf`/outline tabs/spell prefs until autosave healed it) — it now
   delegates to `composeSaveContent`; the five hand-forked strip-destructures are one
   `stripSaveExtras()`; import/new resets clear relationships/tags/scan too.
3. **Essentials-only character cards** (name, photo, description, gender, age) + a
   **Full Info** button opening the enlarge modal — the card's drifted inline copy of
   every full section is deleted, `renderCharacterFields` is the one full renderer.
5. **Cards view reserves the image footprint** when a character has no picture
   (`.char-profile-image-placeholder`, 200px, monotone `FaRegUser`).
4. **Three-layer color scheme for the Characters tool**: panel = `--fd-bg`, tab surface
   (`.char-tab-surface`) + active tab = `--fd-navigator-bg`, cards = `--fd-dropdown-bg`
   with a real outline (`color-mix` of muted text, fallback to `--fd-border`). Two
   hardcoded light-theme overrides were flattening it — fixed; verified both themes.
6. **Zoom % readout reserves constant width** (`.zoom-tb-value`, 5ch tabular-nums).
7. **Scenes + Index Cards merged into ONE Scenes tool** with a persisted List/Cards
   toggle (`scenesViewMode`; new `ScenesTool.tsx`). `'indexcards'` is a legacy ToolId:
   `openTool` remaps it, `migrateToolOrder`/`migrateToolConfig` migrate persisted
   viewState AND workspace snapshots, the old full-editor overlay is deleted, and the
   scene filter/footer search hide in Cards view (they only drive the list).
8. **Customize > Side Panels > Panel Name Style** — Title Case / ALL CAPS
   (`panelNameCase`, both dock labels and window titles).

Everything verified live via the Playwright recipe (§4) — including a full
save→relaunch→restore round-trip for 1+2 against the localStorage fallback storage —
plus 582 unit tests, tsc 0, release build green.

> Driver gotcha learned here: after HMR-heavy sessions, `import('/src/...')` in
> page.evaluate can load a SECOND module instance (the app graph uses `?t=` URLs) — a
> ghost zustand store that makes reads/writes look broken. Restart vite before trusting
> store reads from a driver.

---

The previous run was a **Character tool overhaul** plus a set of **dockable side-panel
tools** and **toolbar/ruler polish**. Everything below is committed and pushed to
`claude/v0_32`.

### Shipped this run (newest first)
- **Character tool — file-tab tabs, Setup tab, clearer Update button, map layout**
  - Profiles/Relationships tabs restyled as **real file tabs** (rounded tops on a track;
    active tab filled to the panel bg so it reads as connected).
  - New **Setup** tab holds **Build from Script** and the **Referred in Script** list
    (moved out of Profiles; the referred list is inline now, no overlay).
  - "Update name in script" → **"Update in Script"**, restyled as a clearly *filled*
    button (was a faint outline that looked like plain text).
  - Relationship **map controls mirror the list view**: List/Map toggle in the same spot,
    a **top** toolbar (not a bottom overlay) with **`+ Add Relationship`** in the list's
    exact style and **`Fit` to its left**; pan/zoom hint moved to the map's bottom-left.
- **Toolbar — ribbon section dividers no longer vanish on a narrow window** (regression
  from the scroll change; see §2).
- **Feedback → dockable tool** (embeds the same Airtable form the Help menu opens; URL now
  in a shared `data/helpForms.ts`). **Character Voice Profile** (audio-clip upload per
  character, plays inline, replace/remove). **Card section divider** + new **Character
  field row spacing** Design knob (`--dz-char-field-gap`).
- **Workspaces → dockable tool** (lists saved layouts; apply/save/rename/delete; drives
  the same store API as the View menu).
- **Design surface → dockable tool** (shared `DesignPanelBody` renders in both the
  floating window and the docked tool).
- **Toolbar — ribbon scrolls horizontally** at narrow widths instead of squishing/hiding
  sections (mirrors the edit-mode approach).
- **Character — "Appears in N scenes"** shown next to the name (removed the duplicate from
  the right-hand stats).
- **Character — Relationship Map folded into Relationships** as a List/Map toggle (removed
  the standalone third tab; then this run a *fourth* "Setup" tab was added — see above).
- **Character — images fixed** (were a broken "!"; see §2) and **Remove actually removes**
  a character (see §2).

Earlier in the same character-tool arc (prior session, same branch): First/Last name
fields that rewrite the script, restructured card body, shared custom fields, header
carets/expand icon, auto family links, Design knob for header spacing, slideshow, theme
re-apply after Customize-Save, window-drag permission, tool windows flush under the ruler,
"Spell Check" → "Spelling & Grammar".

### Open threads / not done
- **Genre selector — dropped.** Derek explicitly said not to build it. Don't resurrect it
  unless he asks.
- **Character card field re-order — pending Derek's exact order.** This run added the
  section divider and the Upload/Voice-Profile row but left the existing field sequence
  (name → media → description → gender/age/sexuality → custom fields → backstory → arc →
  voice-text fields). If he names a target order, set it.
- **Voice Profile is audio** (upload a reference clip). If Derek would rather it be a text
  field, it's a quick swap — the profile already has text voice fields (speechPattern,
  vocabulary, verbalTics, sampleDialogue).
- **Dead CSS to sweep (optional):** `.char-referred-overlay/-panel/-header/-desc`,
  `.char-referred-btn`, `.char-fs-map-actions`, `.rel-map-toolbar-label/-hint` are no
  longer referenced after this run. Harmless, but Derek dislikes cruft — remove when convenient.

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

## 4. Playwright live-check recipe (still true, if you do UI verification)

- Launch `chromium` at `executablePath: '/opt/pw-browsers/chromium'`; dev server
  `npx vite --port 5199` (curl-poll for 200 before driving). Don't run `playwright install`.
- On load a **"New Script" dialog** blocks the UI — click **Create** first.
- Open Customize via `window.dispatchEvent(new CustomEvent('scriptcraft:command', { detail: 'customize' }))`.
- Seed state via `localStorage['opendraft:viewState']` in `addInitScript`; to keep a
  seeded ribbon verbatim, also set the one-time migration flags (`opendraft:toolbar*NNN`).
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
