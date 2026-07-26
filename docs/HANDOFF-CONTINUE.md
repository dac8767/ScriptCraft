# ScriptCraft — continuation brief (current as of v4.72 — page-number position + ruler tail)

> QUEUE (Derek-approved, not yet landed), in order:
> 1. Title Page batch: (a) "Sync Title from Project" above the Title/Title
>    Size row; drop the duplicated "Title Page" caption row (keep the
>    header one); replace "PLACE IMAGE"+dropdown with a character-tool
>    style "+ Add Image" placeholder (same options); show top/bottom
>    placement only once an image exists. (b) Both Title Size dropdowns
>    get a top option "Default" that applies the default size but then
>    DISPLAYS as the numeric size (e.g. 16 pt). (c) The tool's title-page
>    display must be TO SCALE (match Preview) with zoom buttons.
> 2. Ribbon dividers (Derek, mid-v4.72): the vertical divider between a
>    two-row section and a one-row section must be REMOVABLE (default
>    stays: dividers appear as they do now), and the + menu gains "add a
>    single-row divider" and "add a double-row divider" options — so
>    mixed-height sections can sit flush next to each other.
> 3. Spelling squiggles (Derek, mid-v4.72): misspelled words get the
>    standard red squiggly underline in the editor; NEVER spell-check
>    all-caps words (character names, locations/scene headings).
> 4. Audit items: rescans gated on tool-open (live open / refresh on open /
>    idle closed); react-router major bump; Tauri fs $HOME scope narrowing;
>    CSP decision documented.
> FINDING to relay when relevant: File ▸ Print is window.print() and
>    16-print.css hides every .page-sep overlay — printed output has NO
>    page numbers/headers/footers at all. PDF export is the numbered
>    path. Fixing print = its own project (print pagination fidelity).

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

> **STANDING RULE — start EVERY turn with `git fetch origin claude/v0_32 &&
> git log --oneline -1 origin/claude/v0_32`, and if local HEAD differs,
> `git reset --hard origin/claude/v0_32` BEFORE reading or editing anything.**
> The sandbox has now rolled back to a stale snapshot TWICE mid-session
> (v4.28-era files reappearing while origin was fine). Symptom: a file shows
> long-deleted code. The remote is the truth; pushes always survived.

### v4.72 — page-number position (Derek's margin diagram) + ruler tail (HEAD)

- Derek's diagram: margins L1.5/R1/T1/B1; the TOP and RIGHT margins split
  in half; the page number rests ON the 0.5"-from-top line, horizontally
  CENTERED between the right-margin line and the 0.5"-from-right line
  (center 0.75" from the edge). Guides are demonstration-only.
- WAS WRONG on both axes everywhere: editor header top-anchored at
  0.25in (baseline ≈0.38"), right field ended AT a STALE margin var
  (--page-margin-right: 1.25in from 01-fonts-base — not the live layout);
  PDF put the baseline at headerMargin+12 = 0.667" (jsPDF y IS the
  baseline; the +12 treated it as top) and right-aligned to the margin.
- Fix, single rule both renderers: baseline line = layout.headerMargin
  (36pt default). Editor: page box exports --phm; .page-sep-header
  top: calc(var(--phm) - 1em) (text-box bottom ON the line; digits rest
  on it with only the font's descent below the baseline). Fields are
  absolute now (left 0 / center 50% translateX / right = a band from
  the margin line to 0.5in-from-edge, text-align center, min-width
  max-content) — the flex row could not hang the right field into the
  margin without breaking center. Containers use live --pl/--pr. Dead
  .page-sep-number block deleted. PDF: headerY = layout.headerMargin;
  right x = pageWidth − (rightMargin+0.5)/2 inches − half width.
  Driver v50-geom: box bottom 0.500in, center 0.750in exactly.
- Ruler tail (Derek's screenshot: whitespace counting 12,13,14…):
  EditorRulers' continuous branch now continues VIRTUAL divides after
  the last real .page-sep-line at the measured real-page span (≥2 lines:
  divide-to-divide minus the 0.25" breather; 1 line: page-1 span; 0:
  layout content height + breather), numbering restarts at each, same
  dotted mark (virtual divides join the dash pass). 400-iteration guard;
  span floored at 1". Driver v50b: tail reads …9, 10, ┄, 1, 2…
- PRINT FINDING (not fixed — report): File ▸ Print = window.print() and
  16-print.css does `.page-sep { display:none !important }` — print has
  NO page numbers/headers/footers. PDF export is the numbered output.

### v4.71 — ribbon toggle highlights, gray titles, title knobs, tab memory

Four Derek requests in one chrome batch:
- **Toggle highlight**: ToolbarCommand grew `active?: (s: EditorState) =>
  boolean` (a zustand SELECTOR); the c: branch of renderToken became
  `RibbonCommandButton`, which always calls
  `useEditorStore(cmd.active ?? NEVER_ACTIVE)` (stable hook count) and
  adds the same `.active` class the formatting builtins use. Wired:
  sceneNumbers/lock, revisionMode, trackChanges, both panel toggles,
  showRulers (state: sceneNumbersVisible/sceneNumbersLocked/revisionMode/
  trackChangesEnabled/navigatorOpen/shelfOpen/rulersVisible). Driver v49
  (seeded `st:View` section): buttons light with live state both ways.
- **Gray titles**: `.rib-sec-title` color → var(--fd-text-muted).
- **Design knobs** (Toolbar/Ribbon group): ribTitleFont (7–16, def 9.5),
  ribTitleAlign (CHOICE token — new `choices` field on DesignToken;
  numeric value persists, `css` keyword mirrors; TokenRow renders a
  segmented `.dz-choices` row; formatTokenValue + the fallback guard
  test learned the variant), ribTitlePad (0–12, def 3). Band height =
  calc(font + 1.5px) keeps the v4.5 deterministic-band rule at any size.
- **Tab memory**: settingsStore `openToLastTab` (default ON) +
  `lastWindowTabs` map (both localStorage-persisted);
  utils/windowTabMemory.ts `useWindowTabMemory(win, current, apply,
  first, valid, open)` — restore-on-open-edge when on, reset-to-first
  when off, record always. Wired: PreferencesDialog ('settings', open
  prop as edge, BEFORE the openTab effect so targeted opens win — incl.
  all cz-* Customize tabs), CharacterProfiles ('characters', open =
  embedded || characterProfilesOpen — the overlay instance stays
  mounted), TagsPanel ('tags'). Settings ▸ General checkbox. Driver
  burn: `evaluate(input.click())` does NOT drive a React controlled
  checkbox — use a real Playwright click. Unit tests pin
  restore/reset/record/edge (windowTabMemory.test.tsx, 5 tests).

### v4.70 — Feedback screenshot chip + html2canvas-pro

- Derek: "screenshot buttons in the feedback window header that auto-
  upload to the form's attachment field." The form is a CROSS-ORIGIN
  Airtable iframe — nothing on our side can write into its attachment
  field. The honest nearest thing shipped: header buttons (camera =
  full, crop = area, TOOL_CHROME.feedback Controls) capture WITHOUT
  saving; the capture becomes a chip ABOVE the form whose thumbnail is
  DRAGGABLE — dragstart carries the PNG as a real File (setData first,
  WebKit footgun, then items.add(file)), so dropping on the form's
  attachment dropzone uploads it. Save (screenshot folder/Downloads)
  and Discard ride the chip. Chip state is module-level in
  FeedbackTool.tsx (survives window close; header + body components
  share it). The chip sits OUTSIDE the rect-streamed placeholder, so
  the preloaded iframe host shrinks under it automatically (hostTop 0
  in driver v48).
- body.fs-shot-veil-feedback hides the Feedback window + iframe host
  for the WHOLE capture interaction (select + render) — the shot shows
  the app, not the tool that took it. `.tool-window`/`.tool-inline` now
  carry data-tool="<id>" for that veil (and for drivers).
- screenshot.ts: renderToCanvas()/captureToCanvas(mode, veilClass)/
  saveScreenshotCanvas()/screenshotFilename() exported; QAT path
  unchanged on top of them.
- ROOT CAUSE FOUND BY DRIVER v48: html2canvas 1.4.1 throws
  "unsupported color function color()" on this app's color-mix()-heavy
  styles (57 usages) — EVERY capture was failing, including the
  existing toolbar Screenshot button. Dependency swapped to
  html2canvas-pro 2.3.1 (maintained, modern-color-capable, API-
  compatible; prod audit unchanged). npm install runs on Derek's next
  `npm run desktop` (deps changed).
- Tests: FeedbackTool.test.tsx (4) — chip lifecycle, drag payload
  (setData + items.add pinned), discard, header buttons.

### v4.69 — title-bar-style window buttons

- Derek: replace the header's vertical divider — everything right of it
  becomes distinct bordered buttons like classic Windows title-bar
  buttons; scale the × so its drawn ink matches the fullscreen square.
- `.tool-chrome-sep` is GONE — renders removed in ToolDock (floating
  HeaderRightCluster AND both docked strips) and the CSS rule deleted.
- Button chrome (20-tool-dock.css): `.tool-window-close` + the
  fullscreen buttons in `.tool-window-header` / `.tool-inline-header` =
  20×20, 1px var(--fd-border), radius 4, bg rgba(128,128,128,0.06);
  close hover #c0564f/white, fullscreen hover --fd-hover-bg.
  `.tool-chrome-right` gap 3px; `.tool-chrome-controls` margin-right 8px
  keeps tool controls (Sort etc.) visually separate from the pair.
- CloseIcon (uiIcons.tsx) lines now span 1→13 — a 12-unit ×, the same
  extent as FullscreenIcon's square, so the drawn glyphs match height.
- ToolDock.template.test.tsx asserts sep is null + cluster < fs < close
  order. Driver v47: both buttons 20×20/1px/r4, SVGs 11×11, no sep.

### v4.68 — parenthetical after dialogue + the "(" trigger

- DEFAULT_SUGGESTION_RULES.dialogue += 'parenthetical' (mid-speech
  beats); ElementPicker/constants tests updated.
- Dialogue.ts plugin (handleTextInput): "(" at the END of a written
  dialogue line inserts a parenthetical on the next line (the v3.44 seed
  supplies "()", caret between); on an EMPTY dialogue line it converts
  IN PLACE (no stray blank row); mid-text "(" stays literal. Its Tab
  fallback is in-place-on-empty too. Tests: Dialogue.test.ts — invoke
  view props via someProp('handleTextInput'); it returns undefined when
  unhandled (assert toBeFalsy), and the prop TYPE takes 5 args (cast).
  Driver v46: SARAH / dialogue / "(beat)"; picker after dialogue offers
  Parenthetical.
- PROCESS BURN: a heredoc in the ship chain BROKE the && gating — the
  commit ran with tsc RED (the someProp arity error) and the handoff
  edit skipped; fixed in an immediate follow-up commit. NEVER put a
  heredoc mid-chain; run gates as their own command before committing.

### v4.67 — collapse pill + auto-expand hardening

- **Pill**: `.tool-chrome-tabs-dd .tool-ctl` = accent bg, white, 600 —
  the condensed dropdown reads as the active tab (shows its name).
- **Auto-expand**: v45d proved decide() correct (force-widened row →
  strip restored). The real stick risk found in code: HeaderTabs' RO
  binds `host.parentElement` ONCE — a header re-render that replaces the
  row node leaves the observer watching a detached element. Effect now
  re-binds on every collapse flip + a window resize listener as belt and
  braces. NOTE for drivers: Characters' floating shape is its own
  char-profiles panel (drag-out probes returned null .tool-window);
  synthetic panel-edge drags did not engage the resize handler — force
  widths via style injection instead (v45d pattern).

### v4.66 — Show All / Hide All in the Shown/Hidden headers

- DndColumns headerExtra hosts them (`.fs-dnd-headbtn`, right-aligned by
  the head's space-between): Elements + Transitions (EditElementsDialog),
  QAT + Panels-Hidden (CustomizePanelsDialog), Context Menu tab. SWAPPED
  per Derek's correction: Show All sits with Shown, Hide All with Hidden.
  Panels' Left/Right keep their visibility toggles only (no single
  sensible "show all into which side"); its Hidden header carries Hide
  All (the old adders button — removed). Context Menu's in-tab Reset
  deleted (duplicate of the tab's Reset section). Transitions Show/Hide
  All act on the BUILT-INS (customs are delete-only by design). Driver
  v44: all five tables show the right buttons; Elements Hide All → 4
  required left, Show All → 11/0.

### v4.65 — reset sections, Defaults tab, tab-in-place, no auto-picker

- **customizeResets.tsx** — ONE registry (CUSTOMIZE_RESETS) + ResetSection
  (bottom of every Customize tab) + ResetAllButton. Every scattered reset
  moved there: Elements/Transitions/Suggestions/M&C (Editor tab), toolbar
  size+items (+ddWidths), panels size+items, QAT items, context items.
  **Panels "Reset Size" FIXES Derek's bug**: width mode alone read as
  broken when only the vertical scaling was dragged — now resets BOTH
  sides' width modes AND panelItemScale. panels "Reset Items" mirrors the
  old resetPanels incl. setPanelDividers([]).
- **Settings ▸ Defaults tab** — compiles the registry per tab + hosts
  Reset All (REMOVED from the Customize globals; only Lock All remains
  there). Driver v42 lists all 10 buttons + Reset All.
- **M&C embedded**: whole actions row is modal-only now; an external
  reset syncs into the staged fields via per-field guards (typing,
  incl. un-trimmed trailing spaces, is never clobbered).
- **Enter after dialogue does NOT auto-open the picker** (v4.65 refine of
  v4.57): fresh Action line waits; second Enter opens the picker.
- **Tab converts an EMPTY line in place** (central TabHandler): splitting
  left a blank row behind (blank dialogue + Tab put a stray line between
  the name and its parenthetical — Derek's screenshot). Non-empty Tab
  still splits (mid-speech parentheticals unchanged). Driver v43: EJEJ /
  "()" adjacent; non-empty flow intact.
- NOTE: another mid-turn rollback hit during this batch (task list
  rewound too); origin + reset recovered everything as always.

### v4.64 — flattened Settings + five Customize refinements

- **Settings sidebar hosts the Customize tabs** (Derek: one less submenu
  level): TABS minus the old 'layout' entry, then `.prefs-tab-divider` +
  `.prefs-tab-caption` "Customize", then CUSTOMIZE_TABS (`cz-*` PrefTab
  ids). Each renders `CustomizePanelsDialog soloCategory=…` — new prop:
  no inner rail, `activeCat = soloCategory ?? state`, globals row at the
  content end (`.fs-customize-globals-solo`). LayoutTab deleted; deep
  links only ever used 'saveloc'/'keys' ✓.
- **Suggestion table columns follow element visibility**: cols =
  SUGGESTION_RULE_CANDIDATES ∩ getPickableElements (hidden values kept in
  the stored rules, so un-hiding restores the column). Driver v40: hiding
  Shot removes its column live.
- **M&C applies LIVE in Customize** (Apply removed there; the modal keeps
  it): embedded effect commits on change with an equality guard so
  opening the tab doesn't dispatch a no-op repagination.
- **"Show:" label** fronts the Script-Aware/All Elements seg.
- **Lock below the fold**: `.fs-customize-locked > *:not(veil)` kills
  pointer events — the absolute veil scrolls with the body and content
  past the first viewport (the suggestions table) escaped it.
- **Drag-out SNAPS to the classic popped position** (touching the panel
  edge — the frame's CSS anchor): the v4.41 windowSpawnAt drop-point
  seat is deleted. Driver v41: window right edge 8px off the dock.

### v4.63 — Dialogue (Name), rules table, M&C on top

- **"Dialogue (character)" → "Dialogue (Name)"** — sed across
  ELEMENT_LABELS, all six template rule labels, constants comments, tests.
- **SuggestionRulesEditor is a TABLE** (Derek's screenshot ask): thead =
  candidates, row th = the element above, `.fs-sugg-cell` check buttons
  (inline SVG check — no font glyphs), zebra rows + hairline row borders,
  `.fs-sugg-tablewrap` overflow-x. Driver v39: 18 default active cells
  (= table row sums), toggle → 19 + Reset appears, picker under heading
  gains Shot immediately.
- **Mores & Continueds moved to the TOP** of Customize ▸ Editor (order:
  M&C, Transitions, Elements, Element Suggestions).

### v4.62 — speed/efficiency/security/stability audit

- **docs/AUDIT-2026-07-26.md** is the full report (delta on the v0.54
  security audit + the T1–T7 efficiency backlog, both largely landed).
  APPLIED (safe): `npm audit fix` (prod vulns 6→2 — ws/linkify-it/
  markdown-it/dompurify patched; lockfile-only, suite+smoke green);
  `AppErrorBoundary` at the root in main.tsx (render crash → readable
  panel + Reload, was a white screen); saveLocations' odraftFormat import
  made static (kills the every-build INEFFECTIVE_DYNAMIC_IMPORT warning).
  AWAITING DEREK'S APPROVAL: react-router major bump (last 2 high
  advisories), debouncing the per-keystroke updateScenes/updateCharacters
  full-doc walks (~300ms trailing), Tauri fs scope ($HOME/** breadth) and
  CSP tightening, pip-audit on his Mac. Verified healthy: S1/S2 fixed,
  all localStorage parses guarded, listener add/remove balanced, no
  eval, innerHTML sites sanitized/known.

### v4.61 — three explicit dialogue options

- **"Dialogue (character)" (Derek)**: every element list offers THREE
  dialogue options — Dialogue, Dialogue (character) (= the `character`
  id, the name line), Dual Dialogue. `character` came OUT of
  NON_PICKABLE; `ELEMENT_LABELS['character']` AND all six templates'
  character-rule labels are 'Dialogue (character)' (the templates feed
  the Toolbar dropdown/Insert menu/context menu labels — ELEMENT_LABELS
  alone left the dropdown reading "Character", the two-label-source
  drift). DEFAULT_SUGGESTION_RULES now stores Derek's table VERBATIM
  ('character' entries). **resolvePickedElement is DELETED** — picks
  apply directly at all five former call sites; the Toolbar's
  character→dialogue display mapping is gone (the dropdown value can be
  'character' now); Tab-on-empty-far-left does `setNode('character')`.
  Driver v37: picker after heading = Action / Dialogue (character) /
  Dual Dialogue; picking it → character prompt; under a name =
  Parenthetical / Dialogue; dropdown shows "Dialogue (character)" with
  all three options listed. NOTE: internal id `character` persists in
  saved scripts — labels only.

### v4.60 — Customize ▸ Editor reordered

- **Editor Views section REMOVED (Derek)** from EditElementsDialog — the
  settingsStore keys (editorViewOrder/editorViewHidden,
  getEffectiveEditorViews) survive and Toolbar.tsx still reads them; only
  the customization UI is gone. **Elements section moved** into its old
  slot, so the tab reads Transitions → Elements → Element Suggestions →
  Mores & Continueds (the two element sections adjacent — driver v36
  confirms order + adjacency). NOTE: another mid-turn sandbox rollback hit
  right before this change (local at 27382d3 while origin held v4.59) —
  `git reset --hard origin/claude/v0_32` recovered; it also KILLS the Vite
  dev server, so restart it (`npx vite --port 5199 --strictPort`, bg)
  before driving.

### v4.59 — Derek's full follows-what table, user-editable

- **The complete grammar table (Derek)**: `DEFAULT_SUGGESTION_RULES` in
  screenplayEditorConstants — sceneHeading→[action,dialogue,dualDialogue];
  action→[+sceneHeading,transition]; character→[dialogue,parenthetical];
  parenthetical→[dialogue]; dialogue→[dialogue,action,sceneHeading,
  dualDialogue,transition]; transition→[sceneHeading,action]. KEY MAPPING:
  Derek's "Character"/"Dual Character" (name lines) are stored as
  'dialogue'/'dualDialogue' — the dropdown only ever says "Dialogue",
  which cues the name on an empty line via resolvePickedElement. A
  dualDialogue block above aliases to the dialogue row inside
  allowedElementsAfter. Unlisted prevs (top of script, shot, general,
  customs) fall back to all-minus-{parenthetical,transition}.
- **Customize ▸ Editor ▸ Element Suggestions (Derek)**:
  `SuggestionRulesEditor.tsx` — a Script-Aware / All Elements seg
  (suggestionMode: 'smart'|'all') plus one chip-row per table row
  (candidates = SUGGESTION_RULE_CANDIDATES, all ten pickable ids).
  Edits materialize the whole table into editorStore.suggestionRules
  (null = default; Reset to Default appears only when edited); both keys
  persist via viewState. ElementPicker reads mode+rules and passes them
  to allowedElementsAfter; rows render only in smart mode. CSS
  `.fs-sugg-*` in 22-tools-extra.css (chips share the seg-button look).
  Driver v35 (through the REAL Customize UI): 6 rows render; All
  Elements → 10-item picker under a heading; Script-Aware + clicking the
  Scene Heading row's "Shot" chip → picker reads Action/Dialogue/Dual
  Dialogue/Shot. Driver v34: all six default rows match the table.

### v4.58 — grammar-filtered element suggestions

- **The Enter-key picker follows script grammar (Derek)**:
  `allowedElementsAfter(prevType)` in screenplayEditorConstants is the
  single rule source — after `sceneHeading` ONLY action/dialogue/
  dualDialogue; `parenthetical` only when prev is `character`;
  `transition` only when prev ∈ {action, dialogue, dualDialogue}; null
  prev (top of script) excludes both. EnterHandler walks BACK past
  working-note general lines (isWorkingNoteText) to find the real
  script element and passes it as `prevScriptType` through showPickerRef
  → pickerState → ElementPicker, which filters the enabled list before
  the suggestion lift; the v4.56 parenthetical-lead now keys on the same
  prevScriptType. The v4.57 after-dialogue picker passes 'dialogue'.
  DELIBERATE conversion surfaces (toolbar dropdown, Insert menu,
  right-click) stay unfiltered — they fix lines, not suggest them.
  Driver v33 matrix: under heading → exactly 3; via a "# note" between →
  same 3; after action/dialogue → Transition in, Parenthetical out;
  under a name → Parenthetical first, Transition out. Tests:
  screenplayEditorConstants.test.ts (allowedElementsAfter),
  ElementPicker.test.tsx (filter cases).

### v4.57 — dialogue Enter offers options, Tab starts dialogue

- **Enter after a written dialogue line (Derek)**: at the END of a
  non-empty dialogue (not mid-line, not at start, not in a dual column),
  Enter splits to a fresh ACTION — its space-before IS the skipped blank
  line (driver: 16px gap) — and immediately opens the element picker
  (`showPickerRef('action')`, so the suggestion is Action). Escape/typing
  falls through to writing action text. Replaces the old
  nextOnEnter-dialogue chain for this case only.
- **Tab on an empty far-left line (Derek)**: an empty `action`/`general`
  row + Tab → `resolvePickedElement('dialogue', …)` → the character-name
  prompt (caret x 456→648 in the driver, FLIGMA autofill pops, Enter
  after the name lands in dialogue). Deliberately scoped to far-LEFT
  types so the couplet Tab flows (empty dialogue → parenthetical via
  nextOnTab, etc.) are untouched. Both live in ScreenplayEditor's
  EnterHandler / TabHandlerExtension (they're inline extensions — driver
  verification, no unit tests possible without extracting them).

### v4.56 — parenthetical leads the picker under a name

- **Context-aware picker suggestion (Derek)**: an empty DIALOGUE whose
  previous sibling is a CHARACTER (the couplet: name above, caret in the
  dialogue) shows the Enter-key picker with **Parenthetical** first and
  pre-selected; everywhere else the v0.88 suggestion (Action for
  dialogue) is unchanged. Plumbing: `showPickerRef(defaultType,
  availableTypes?, suggestType?)` → pickerState.suggestType →
  ElementPicker's `suggestType` prop, which wins over the
  ELEMENT_ORDER-derived pick when it's in the enabled list. The sibling
  check is `$from.before(depth)` → `resolve().nodeBefore` (works inside
  dual-dialogue columns too). Tests: ElementPicker.test.tsx (3 — NOTE:
  jsdom lacks scrollIntoView; the test stubs
  `Element.prototype.scrollIntoView`). Driver v31: under FLIGMA the
  picker reads Parenthetical/Scene Heading/Action with Parenthetical
  selected; a plain empty dialogue still leads with Action.

### v4.55 — paren delete-to-remove, picker-autofill fix

- **Deleting a paren removes the row (Derek)**: v4.54's repair-on-delete
  made parens undeletable; Derek's rule is "delete either paren → the
  whole parenthetical row goes". Parenthetical.ts plugin now: inverse-maps
  the row's content start through the transactions to read its OLD text
  (`Mapping` from @tiptap/pm/transform), and classifies — pure DELETION
  that lost an edge paren the old text had → `removeRow` (delete node,
  `TextSelection.near` biased backward for "(" / forward for ")");
  emptied-including-parens → row removed too; INSERTION present
  (conversion, replacing the selected row with typed text) → wrap-repair
  as in v4.54; a pure-deletion JOIN (Backspace at the start of the next
  line — text grew past the old ")" with `newText.startsWith(oldText)`) →
  split back at oldText.length and restore the joined node's type/attrs —
  the boundary reads as locked, caret back where it was. removeRow is
  try/caught: sole-block-in-doc/column falls back to converting the row
  to an empty action, then to null (never crash dispatch). No
  addToHistory meta on removals → undo restores the row in ONE step
  (verified live). Tests: Parenthetical.test.ts (8; note the harness must
  SET the selection at the gesture's seam before dispatching raw trs —
  the plugin only acts when the caret is in the row, and two tests
  failed exactly that way first).
- **Picker→autofill fix (Derek)**: choosing Dialogue in the Enter-key
  element picker presented the character field but no name autofill.
  Debug taps showed onUpdate DID fire 'show:SARAH' — then dismissedRef.
  Root cause: ElementPicker items select on MOUSEDOWN; the same
  mousedown was still bubbling to document when React mounted
  CharacterAutocomplete and attached its click-outside listener, which
  read the event's target as outside and dismissed it instantly,
  latching charAutoDismissedRef (mode never leaves 'character', so it
  never resets — autofill dead for the whole couplet). Fix: attach the
  click-outside listener in a `setTimeout(0)` (CharacterAutocomplete) so
  it can never observe the event that mounted it. Ctrl+3/Ctrl+4/toolbar
  paths were already fine (no bubbling mousedown after mount) — driver
  v29 matrix now shows all four paths popping ['SARAH'].

### v4.54 — parenthetical lock, Dialogue-initiated names, ruler note bands

- **Parenthetical row is locked (Derek)**: the parens are ALWAYS the first
  and last characters. `Parenthetical.ts` plugin (extends the v3.44 "()"
  seed): repairs a missing edge paren in place (repair joins the
  keystroke's undo step — no addToHistory:false, or undo doubles the
  paren), clamps an empty caret between the parens so typing can't land
  outside; emptying the row entirely still works (stays deletable).
  Enter (EnterHandler in ScreenplayEditor) and Tab (BOTH the central
  TabHandlerExtension and Parenthetical's own fallback) never split the
  row — they insert the next element (nextOnEnter/nextOnTab, dialogue by
  default) AFTER it via `insertContentAt($from.after(depth))` +
  `focus(after+1)`. Driver v28f: Tab and mid-row Enter both leave
  "(beat)" intact with typed text landing in the dialogue below.
  Unit tests: `Parenthetical.test.ts` (7 cases).
- **Character is not pickable; Dialogue initiates the name (Derek)**:
  `NON_PICKABLE` += 'character' (the RULE survives — Customize still
  edits its formatting, scripts keep their character elements).
  `resolvePickedElement(picked, currentType, isLineEmpty)` in
  screenplayEditorConstants is the ONE resolver: dialogue picked on an
  empty line → 'character' (unless already dialogue); non-empty →
  dialogue directly. Routed through ALL pick surfaces: Toolbar select
  (which also DISPLAYS a character line as "Dialogue"), MenuBar
  setElement, ScriptContextMenu, handlePickerSelect, Mod-4. Mod-3 still
  sets character directly (in-script muscle memory unchanged — drivers
  rely on it too).
- **Ruler skips working-note lines (Derek)**: sections/markers/to-dos
  take no space in the final document, so EditorRulers collects
  `.ol-section/.ol-marker/.ol-todo` rects into merged `noteBands`
  (band top extends to the previous element's bottom so the leading gap
  goes too; display:none → zero rect → drops out), grays each band
  (margin shade) and pauses the inch count over it — `drawScaleFrom` is
  now band-aware piecewise segments over `drawTicks`; the forced
  terminal "10"/"11" label only renders for band-free regions. Verified:
  1→2 inch gap measured 96px + band height, later gaps back to 96px.
  Note highlights are inline marks on text that DOES print — no band.
- **ol- classes are decorations now**: renderHTML stamped them at create
  time and ProseMirror never re-runs it on text edits, so hand-typed
  "# " lines kept stale classes (driver v28d caught it). General.ts
  plugin rebuilds Decoration.node classes per doc change from
  `workingNoteKind()` (new in utils/workingNotes — single classification
  for exporters + paginator + editor + ruler; pagination.ts regexes
  replaced with it). `General.test.ts` types into a live editor and
  reads the class back.

### v4.53 — two-stage header overflow, leading tool controls, panel icons

- **Tool-specific controls lead the right cluster (Derek)**: in Scenes the
  order is now Reorder, Filter, View, Search (`SceneControls` in
  SceneNavigator.tsx — `<ScenesReorderControl />` first). Pattern: any
  tool-specific control goes BEFORE the standard Filter/View/Search set.
- **Two-stage header overflow**: `HeaderTabs` (ToolDock.tsx) measures a
  hidden clone of the full tab strip (`.tool-chrome-tabs-measure`, fixed
  offscreen) plus the natural widths of its header siblings
  (`naturalWidth()` — flex-wrap containers sum children+gaps+padding, so
  the measurement is immune to the row's own wrapping feedback). If the
  full strip doesn't fit, tabs render as a `ControlDropdown` titled
  "Section" (`.tool-chrome-tabs-dd`); flex-wrap to a second line engages
  only if even the collapsed content still overflows. ResizeObserver on
  row + measurer; deps `[tabs.length]`. Driver v27: docked Characters
  strip 29px single line (was 83px wrapped), 0 collapse flip-flops over
  1.2s, dropdown selects tabs, wide fullscreen keeps the full strip.
- **Distinct panel-toggle icons**: `PanelLeftIcon`/`PanelRightIcon` in
  uiIcons.tsx (16-box outline rect + filled side rect), wired in
  toolbarCommands.tsx toggleLeftPanel/toggleRightPanel (both were
  FaColumns). `chevronTowards` deleted with its test.

### v4.52 — transparent embeds, centered rows, explicit tool homes

- **Shape-color parity, systemically**: driver matrix (driver/v25-matrix.js)
  sampled the painted bg per tool per shape — Pages/Scenes/Locations painted
  navigator-bg in windows vs fd-bg fullscreen. Fix:
  `.scene-navigator-embed { background: transparent }` and `.index-cards`
  bg → transparent — THE WINDOW BODY IS THE SURFACE, embeds paint nothing.
  (Matrix rows reading "none"/ancestor = already transparent = fine;
  Characters/Goals rows were sample-point artifacts hitting inputs/chips.)
- **`.navigator-scene` rows**: align-items center (min-height 40 made
  flex-start read top-hung); `.expanded` reverts to flex-start. Verified
  badge-midline delta 0. NOTE for drivers: the Scenes list needs REAL
  scene-heading elements — press Ctrl+1 before typing the heading, plain
  typed text stays Action and the list shows the empty state.
- **Width auto-dock RETIRED (Derek)**: `toolMode: Record<ToolId,
  'docked'|'floating'>` in editorStore (persisted; init derives from stored
  widths >300 so homes survive the upgrade; default = noPanelFit ? floating
  : docked). `inline` reads the mode, drag-out writes 'floating', dockInto
  writes 'docked'. Resizing a float to 240px: stays floating (verified).
- Characters tab label 'From Script' → 'Script' (tab id 'setup' persists);
  the "Scan Script (n)" `.char-setup-title` line removed.

### v4.51 — Scenes cards fill their host

Derek: dead space between the Scenes cards area and the window edge. Root
cause: `.index-cards { max-height: 50vh; flex-shrink: 0 }` — the old
above-the-editor strip sizing, still capping the embed inside windows.
ScenesTool is the ONLY render site now, so the BASE rule became
`flex: 1 1 0; min-height: 0; max-height: none` (fills window body / dock /
takeover, scrolls inside; the strip-era border-bottom went too).
Driver-verified: index-cards 475→695px == its flex parent.

### v4.50 — content-sized character cards + scroll

Derek: fullscreen cards were FIXED-size, fitted to the editor window, no
scroll. Root cause (driver-bisected): the `.char-view-cards` GRID's auto
rows bound to the container height — `overflow: hidden` on
`.char-profile-card` zeroes a grid item's automatic minimum size, so the
tracks compressed to an equal slice each (150px with 9 cards) and clipped
the card bodies; `overflow-y: auto` never engaged because nothing
overflowed. Fix: `grid-auto-rows: max-content` (rows = content height, list
scrolls; verified 150→441px cards, scrollH 2248 vs 796 client). The
`charCardMinH` knob is REINSTATED (Derek asked) as a min-height with def 0
— content can always exceed it. LESSON: a grid item with overflow:hidden
can be crushed below its content — always set grid-auto-rows on
scroll-container grids.

### v4.49 — the theme surface ladder

Derek annotated the dark theme's areas (same/lighter/darker) and made the
PATTERN canonical for all themes: **status < navigator(panels+window
headers) < bg(body+canvas) <= dropdown(cards) <= menu <= toolbar**, each
step LIGHTER, same direction in light themes. Fixed violators (hue kept):
light (navigator f2f2f2→e2e2e2, status→dbdbdb, toolbar→f7f7f7, and
`.editor-main` d5d5d5→var(--fd-bg)); sepia + solarized-light (toolbar/menu/
dropdown lifted above bg); dracula (same). Nord/solarized-dark/midnight
already complied. **`src/design/themeLadder.test.ts`** parses the REAL
stylesheets, resolves each theme's effective tokens (override ?? :root) and
asserts the ordering — theme edits that invert a relationship fail CI.
Suite 623 tests.

### v4.48 — header = navigator surface

One line: `.tool-window-header` bg → `--fd-navigator-bg` (Derek asked for
252525; that IS the dark theme's navigator token — the header has now been
--fd-bg (v4.37) → toolbar (v4.42) → status (v4.47) → navigator, keep using
tokens so themes follow).

### v4.47 — title-gap knob + status-bar headers

- `toolWinTitleGap` (`--dz-toolwin-title-gap`, def 10) — the
  `.tool-header-title` margin-right (name↔tabs air; the header's 8px
  column-gap rides on top).
- `.tool-window-header` bg: `--fd-toolbar-bg` → `--fd-status-bg` (v4.42's
  ribbon match superseded — Derek wants the status bar's darker surface).
  Driver: header computed == the status bar element's bg, knob 10→28 live.

### v4.46 — per-side header padding knobs + 0.5px hairlines

- `toolWinHeaderPad` RETIRED → four knobs: `toolWinPadTop/Bottom` (def 6) and
  `toolWinPadLeft/Right` (def 10), vars `--dz-toolwin-pad-*`. The frame/
  takeover header and the docked strip read all four (strip fallbacks stay
  4/8). `migrateDesignVars` (designSlice, EXPORTED + designMigrate.test.ts,
  3 cases) seeds top+bottom from a saved single-knob override — explicit
  per-side values win; idempotent, persisted on the next write.
- `--fd-hairline-w: 0.5px` (:root, 01-fonts-base) — every hairline border +
  the `.tool-chrome-sep`/ghost use `var(--fd-hairline-w, 1px)`. NOTE:
  headless Chromium REPORTS 0.5px borders as 1px (used-value snapping even
  at dsf 2 — probed with a literal) — don't chase that in drivers; WebKit
  on Derek's Retina renders true half-pixel lines.
- Driver: per-side pads move independently (top 4→14, left 8→20).

### v4.45 — window-chrome Design knobs + docked divider

- New Panels & Windows knobs: `toolWinBodyGap` (`--dz-toolwin-body-gap`,
  def 0 — padding-top on .tool-window-body/.tool-inline-body/
  .fs-tool-takeover-body) and `toolWinBarFont` (`--dz-toolwin-bar-font`,
  def 12 — .tool-ctl/.tool-chrome-tab/.tool-title-count). The existing
  `toolWinHeaderPad` knob now ALSO drives `.tool-inline-header`'s vertical
  padding (fallback 4 there vs 6 on the header — both fallback values are
  legal per the token test as long as the def appears somewhere).
- `.tool-chrome-sep` renders in the docked strip too, on the fullscreen
  button's inner side (skipped for NO_FULLSCREEN tools — no dangling line).
- Driver: knobs respond live (4→12 / 0→18 / 12→15px), defaults unchanged.

### v4.44 — flush fullscreen + fd-bg window bodies

- **Flush takeover**: `.editor-layout` gains `editor-layout-fs` while
  `fullscreenTool` is set (ScreenplayEditor) → the `.tool-dock-wrap` 6px
  margins zero out (that gap is scrollbar/grab-edge room for the editor
  canvas, a hole beside a takeover). The `fs-top-chrome-resize` strip is
  TRANSPARENT at rest now (hover/active still paint it; 6px hit area
  unchanged) — its always-on 45% band was Derek's "gap on top" (it overlays
  content since v4.40; my locked-strip driver never showed it).
- **Window bodies = `--fd-bg`** in all three shapes: `.tool-window`,
  `.tool-inline`, `.fs-tool-takeover-body`, and `.char-profiles-panel`
  (Characters paints its own bg over the body). The dock LIST stays
  `--fd-navigator-bg` — panels and window bodies are distinct surfaces now.
- Driver: leftGap 6→0, topGap 0, takeover body rgb(43,43,43).

### v4.43 — geometry-only header buttons

Derek: "the full screen button is still misaligned." Root cause was MIXING a
font glyph (×, seated by baseline/ascent metrics that differ per platform)
with a geometric SVG in one row — box alignment was already 0px in Chromium
but the ink drifted on his Mac's SF font. Fix: `CloseIcon` in uiIcons (SVG
twin of the ×, same 14-box/1.5-stroke as FullscreenIcon), rendered by
HeaderRightCluster; `.tool-window-close` and the header's
`.char-profiles-fullscreen-btn` share ONE fixed 20×20 inline-flex box.
Driver: both boxes 20×20, both SVGs 11px, midY delta 0. LESSON: never seat a
font glyph next to an SVG icon in aligned chrome — SVG-ize it.

### v4.42 — header polish

Two-liner: `.char-profiles-fullscreen-btn` is inline-flex centered (the SVG
rode the text baseline — a hair low beside the ×; driver-measured delta now
0px), and `.tool-window-header` bg is `--fd-toolbar-bg` (matches the ribbon;
was --fd-bg from v4.37).

### v4.41 — visible drag-out + shape-consistent Characters + ribbon hairlines

- **Drag-out is a visible gesture**: ~6px of motion spawns a `.tool-drag-ghost`
  (mini title bar, fixed, pointer-events none, z-300) that rides the cursor;
  over `.editor-center` it gets `.armed` (accent border); RELEASE there
  triggers the undock and `windowSpawnAt` (module-local one-shot) makes
  ToolWindowFrame's mount effect seat the window at the drop point (client
  x−60/y−14, clamped ≥8). Release short = nothing. Both the accordion row
  AND `.tool-inline-header` are handles (cursor: grab).
- **Selection fix for Derek's Mac**: WebKit ignored the unprefixed
  user-select AND anchors selections in content the pointer crosses —
  `-webkit-user-select` added to the handles, plus `body.fs-tool-dragging`
  (set for dock drags and frame drags alike) suppresses selection app-wide
  for the gesture; `armSwallow()` (flag + setTimeout-0) keeps drags from
  reading as accordion toggles without eating later clicks.
- **Characters, one look everywhere** (Derek's screenshots: fs = dark flat
  borderless, window = light bordered): the `char-profiles-fullscreen` /
  `char-fs-list-mode` classes and ALL their CSS are DELETED. The container
  carries `char-view-cards|list` now; cards = ONE responsive auto-fill grid
  `minmax(var(--dz-char-card-minw,320px),1fr)` (1 column at 300px = the
  docked look; more when wide). `isFullscreen` in CharacterProfiles is
  behavior-only now (legacy overlay headers/swipe/style). The
  `charCardMinH` Design knob is RETIRED (fullscreen-only; registry entry
  removed — designTokens.test's dead-knob sweep enforces this stays tidy).
- **Ribbon hairlines**: `.toolbar` border-top+bottom = `--fd-hairline`.
- Driver-verified (driver/batchv15-check.js + v15b-cards.js): ghost + armed
  states, short release stays docked with no selection, landing at drop
  point (exact px), card style parity docked vs fullscreen (bg/border/radius
  identical, grid 1→N columns), fs list = bordered rows, ribbon hairlines.

### v4.40 — docked look restored + drag-to-editor threshold + hairlines

Three Derek corrections to v4.39, same day:

- **Docked windows look pre-v4.39 again**: compact accordion row (label ·
  count · WindowActions in `.tool-dock-item-actions`), with tabs + controls
  on a restored `.tool-inline-header` strip inside the window (fullscreen at
  the editor-facing end where the pop-out sat). ONE difference from its old
  life: the strip WRAPS when narrow (Derek's overflow rule) — the dropdown
  collapse stays dead. No close × docked (row click toggles, as always).
  Floating windows + the takeover KEEP the v4.39 single-row header.
- **Drag-out needs the editor**: `startDockDragOut` pops the window out only
  when the pointer crosses into `.editor-center`'s rect; released short of
  it, nothing happens. `armSwallow()` (flag + setTimeout-0 reset — click
  dispatches before timers) keeps any real drag from reading as an
  accordion toggle without ever eating a later unrelated click.
- **`--fd-hairline`** (01-fonts-base.css :root):
  `color-mix(in srgb, var(--fd-text) 18%, transparent)` — the inner var()
  resolves at use-site, so every theme retunes it. Applied to the dock's
  outer edges, `.tool-window-header` / `.tool-inline-header` /
  `.tool-dock-item-header` bottom dividers, and `.tool-chrome-sep`. Reason:
  `--fd-border` (#2a2a2a dark) is invisible against #252525/#2b2b2b — Derek
  saw NO lines. Plus spacing: `.tool-header-title` margin-right 10px,
  `.tool-chrome-sep` margin 0 9px.
- Driver-verified (driver/batchv14-check.js): 32px compact row, strip tabs +
  controls + fullscreen, short drag stays docked, editor drag floats,
  drag-in docks, hairline rgba(text,.18) computed on all seams.

> NOTE: the sandbox rolled back AGAIN mid-v4.40 (local → 27382d3 with the
> task list; origin held v4.39). The standing rule §1 caught it — reset,
> nothing lost. It can strike MID-TURN, not just between turns: an Edit
> failing with "string not found" on code you just wrote is the tell.

### v4.39 — single-row window headers + drag docking

Derek's structural rework, all windows (frame, open dock item, fullscreen
takeover):

- **ONE header row** — left: name · TitleExtra count · tabs; right
  (`HeaderRightCluster`, ToolDock): Controls (+WindowActions) ·
  `.tool-chrome-sep` divider · fullscreen · close. **Too narrow → the row
  WRAPS** (flex-wrap; `.tool-chrome-right` is margin-left:auto so a wrapped
  cluster stays right-aligned). This REPLACED the tabs collapse-to-dropdown:
  ChromeRow2 + the measurer + `.tool-chrome-tabs-dd` + `TabbedRow2` are
  DELETED (ChromeTabs is strip-only now). Old two-row classes
  (`.tool-chrome-row2`, `.tool-inline-header`, `.tool-window-zone*`,
  `.char-fs-header`, `.tool-dock-item-actions`) are gone — drivers/tests must
  target `.tool-window-header` / `.tool-dock-item-header` / `.tool-chrome-right`.
- **Pop-in/pop-out buttons DELETED** (`.tool-window-popin`, `.tool-dock-popout`,
  `chevronTowards` + its test). Docked→floating: grab the open dock row and
  pull ~10px (`startDockDragOut` — same width-write pop-out did:
  `setToolSize(id, dockW+140, h)`; `draggedOutRef` swallows the release
  click so it can't re-minimize). Floating→docked: drag the window header
  over either panel — `.tool-dock` gets `.tool-dock-drop-target` (accent
  outline), release calls `dockInto(side)`: config move if needed
  (`setToolConfig {side, enabled}`), clear both slots, `setToolSize(w=dock
  width)`, then `openTool` (the single placement choke point). Works for
  temp/menu windows and cross-panel moves; icon-rail panels and
  neverDock/PANEL_EXCLUDED tools are not drop targets. Inline-vs-float is
  still DERIVED from width <= dockW — dragging just writes sizes/config.
- `.tool-dock-item` is `user-select: none` now (drag anchors — without it a
  pull-out painted a selection across the panel).
- Takeover header = the same `.tool-window-header` (`tool-fs-header` variant
  class, no fullscreen button, × = "Return to editor"); `--dz-toolwin-head-pad`
  default 8→6 (designTokens.ts matches the CSS fallback — the registry test
  pins them equal).
- Tabs reverted to muted resting color (Derek), `.tool-chrome-tab:hover`
  brightens again; `.tool-ctl` keeps v4.37's full text color.
- Driver-verified (driver/batchv13-check.js): merged row content/order, 0 pop
  buttons, drag-out floats, drop-hint + drag-in docks (hint clears), Characters
  wraps at 300px (row 83px, 3 tabs), takeover single row, 1px panel edge +
  header divider. Suite 612 tests / 82 files.

### v4.38 — fullscreen □ vs expand ⤢

Derek: "make it clear what the difference is between an expand button and a
full screen button." The uiIcons registry now encodes TWO verbs:
`FullscreenIcon` = the SQUARE four-corners face (the icon-audit's option A,
the former ⛶) on everything that takes a TOOL fullscreen (ToolFullscreenButton
in every frame/dock row, the legacy Characters overlay header); new
`ExpandIcon`/`ShrinkIcon` = the diagonal-arrows pair (the old v4.31 pick) on
everything that enlarges ONE thing (character card → modal, synopsis modal,
Outline section maximize/restore). `ExitFullscreenIcon` is deleted (its only
consumer was the Outline pair, which is expand-semantic). When adding a
fullscreen or enlarge control, pick by VERB from the registry — don't draw ad
hoc arrows.

### v4.37 — batch v11

Nine mid-turn items, dispatcher-only (no workers — mostly small, heavily
cross-window):

1. **Luminance ring on ColorDots** — `readableTextOn` MOVED from BeatBoard to
   `utils/palettes.ts` (THE dark/light system: YIQ > 150 → `#111111`, else
   `#ffffff`, `''` for non-hex). The closed trigger dot's border-color = the
   ink for the surface it sits on; `ColorDots` grew `surface?: string`
   (defaults to the card's own color; ScriptNotePopover passes
   `noteStickyBg(note.color)` because its dot sits on the tint, not the hex).
2. **Card foot** — date LEFT, `.swn-card-resize` grabber RIGHT (comment cards
   only): pointer-drag sets the textarea height (min 64px, inline style, same
   persistence semantics as the native handle it replaces — the base
   `.swn-comment-input` is `resize: none` now; the popover's scoped rule keeps
   its native vertical handle). The grabber joins the SHARED corner-stripes
   selector list (20-tool-dock.css) and re-points `--fd-text-muted` at the
   card's luminance ink inline, so the stripes stay visible on any user color.
3. **One scheme, every shape** — `.tool-window-header` bg = `--fd-bg` (the
   fullscreen takeover's row-1 relationship, now on the windowed frame) and
   `.fs-tool-takeover-body` bg = `--fd-navigator-bg` (tools whose content
   paints no bg no longer go darker in fullscreen). Row 2 was already
   navigator-bg in both.
4. **"I should not be able to have a window open twice"** — the one-place
   invariant is enforced IN THE STORE: `openTool(x)` while `fullscreenTool===x`
   is a no-op (the takeover satisfies it — same idempotence as re-opening a
   docked tool; the check sits AFTER the legacy remaps and BEFORE
   ALWAYS_FLOAT); `setActiveTool/setActiveToolRight/setTempTool(x)` clear
   `fullscreenTool` when it === x (explicit placement wins); `applyWorkspace`
   always exits the takeover. Pinned in `openTool.test.ts` (6 tests) +
   `workspacesApply.test.ts` (1).
5. **Carets gone** from in-window dropdown triggers — the single
   `<FaChevronDown className="tool-ctl-chev">` in ToolControls.tsx deleted
   (+ its CSS rule; SceneNavigator's tree chevrons are expand/collapse
   indicators and stay).
6. **Full text color for window toolbars** — `.tool-ctl` and
   `.tool-chrome-tab` resting color `--fd-text-muted` → `--fd-text`; the tab's
   now-no-op hover-brighten became a `--fd-menu-hover` bg hover.
7. **ColorPicker Apply closes the popover** (commit + onClose; preset swatches
   still stay open for live try-outs) — `ColorPicker.test.tsx`.
8. **Ribbon↔panel gap removed** — `.fs-top-chrome-resize` keeps its 6px hit
   area but `margin-bottom: -6px; position: relative; z-index: 60` OVERLAYS
   the panels' top edge: no band, lock-toggle still shifts nothing (the v4.3
   constraint), still grabbable.
9. All of it driver-verified on a fresh profile (`driver/batchv11-check.js`):
   ring rgb(17,17,17) on pastel / rgb(255,255,255) on `#3d1a5b`, foot order +
   50px drag, row1 #2b2b2b vs row2 #252525 on the popped frame, fullscreen
   Characters + Project>Characters again → still ONE instance, takeover body
   = navigator-bg, 0 carets, panels flush at the strip's own top edge.
   Suite 614 tests / 83 files. Menus for drivers: `.menu-item`>`.menu-label`,
   items `.menu-dropdown-item`; Characters lives under **Project**, not Tools.

### v4.36 — batch v10

Four small chrome fixes: (1) Feedback iframe `title` → `aria-label` (the
HoverTooltip renders every [title]; the a11y name survives). (2) The generic
fullscreen button sits on the EDITOR-FACING side everywhere: floating frames
zone-L for right-panel windows / zone-R for left; inline dock rows carry it
in the row-2 header beside the pop-out (which keeps the extreme edge) — and
ChromeRow2's never-wrap math now counts it among fixed row children.
(3) ColorDots: custom + swatch first (far end), current color LAST, and the
pop's right/top offsets compensate padding+border so the current color sits
pixel-exactly over the closed dot (dx=dy=0, driver-verified). When the
current color IS custom, the custom swatch takes the rightmost slot instead.
(4) Icon ink normalized to the pop-out chevron (~10px): Fullscreen/Exit
icons default 14→11, .tool-window-close and .char-profiles-close 16/18→21px
(the × glyph inks ~0.47em).

### v4.35 — batch v9

Nine items, three worker lanes + dispatcher. The architecture piece:
**`fullscreenTool: ToolId | null`** replaced charFullscreen/scenesFullscreen —
ONE store field, `enterToolFullscreen(id)` (clears the tool's slots + lowers
the Scrapbook) / `setFullscreenTool(null)`. `ToolFullscreenTakeover` in
ToolDock renders ANY tool fullscreen from TOOL_CHROME + ToolContent (row-1
header, row-2 tabs/controls, body). The frame + accordion render ONE generic
fullscreen button per tool (`NO_FULLSCREEN = ['notebook', 'titlepage']`);
per-tool WindowActions fullscreen buttons are gone (Tags' eye remains a
WindowActions). CharacterProfiles derives `isFullscreen` from the store
(`embedded && fullscreenTool === 'characters'`) and keeps emitting
char-profiles-fullscreen/char-fs-list-mode for its 27 layout rules; its
in-component fullscreen header rows are deleted. Toolbar has ONE ribbon
Return section; StatusBar gates on `fullscreenTool !== null`.

Scenes view parity: `utils/sceneFilters.ts` (shared predicate/details/options)
+ `utils/useSceneReorder.ts` (the reorder state machine, `active` param so the
Pages/Locations/Structure instances of SceneNavigator don't cancel a Scenes
reorder). Cards obey filter/search; the list has drag-reorder (WebKit
setData rule); reorder suspends filtering in BOTH views (Apply rewrites the
whole doc — a filtered pending list would eat scenes); `SceneReorderBar`
exported from IndexCards.

Note colors: NoteInfo/GeneralNote `.color` is `NoteColor | string` (hex).
Bridges in ScriptNotes are hex-safe; `noteStickyBg()` computes a 78%-white
pastel for hex; ColorDots grew the dashed custom `<input type=color>` swatch
(`.swn-color-custom`, 19-sticky-notes.css). Custom shelf-card colors stay
RAW (only note surfaces pastelize) — flagged to Derek.

Tabs: segmented Goals look app-wide — `.tool-chrome-tabs` is the bordered
group (empty/dd variants excluded), active = solid accent; analytics/tags/
char-overlay strips converted; Outline's `.beat-tabs` (user-created board
tabs, closable, scrollable) deliberately NOT converted — different animal.
Characters bg: layers 1-2 of the batch-4 three-layer scheme reverted
(uniform --fd-navigator-bg; `.char-tab-surface` transparent; cards keep
their face).

Misc: View menu — native Maximize dropped (macOS calls it "Zoom" = the
duplicate), no separator before Minimize/Fullscreen so page-Zoom sits in
that final section (nativeMenuSync.ts). Navigator numbers right-aligned
(margin-left auto). Focus: masterrow + ? popover (Goals pattern), rest dims
when off. Workspaces window: four menu actions below the list;
`utils/workspaceImport.ts` is the ONE import implementation (MenuBar calls
it too). Feedback: `FeedbackFrameHost` mounted in App.tsx — persistent
preloaded iframe positioned over the window body by a rAF rect publisher
(z-index 130 — measured: windows are z:120, dialogs 3000; a window dragged
OVER Feedback paints under the iframe, accepted; resize grip kept clickable
via clip-path notch).

Driver: scratchpad/driver/batchv9-check.js (probe gotchas: the fullscreen
button selector must be SCOPED to the open window — every open tool has one
now; the docked tab strip legitimately collapses to a dropdown at 300px —
measure segmented styling in a takeover; Focus master defaults ON).

### v4.34 — Scenes fullscreen carries the full View cluster

Derek: "the full screen version of Scenes does not display the view
options." The takeover's row 2 is now the SAME SceneControls the window has
(Filter / Reorder / View / Search) over the SAME ScenesTool body — switch
List/Cards, filter, and search inside fullscreen; ScenesWindowActions lost
its cards-only gate (fullscreen opens from either view, showing that view).
CSS: `.fs-scenes-takeover .scene-navigator-embed` joined the embed-fill rule
in 20-tool-dock.css. My v4.32 assumption that "fullscreen is definitionally
the card wall" was wrong — the takeover is the window's content given the
whole editor area, nothing less.

**Sandbox-rollback incident (know this):** this session's sandbox was
restored from an old filesystem snapshot mid-run — local HEAD, files, and
the task list silently rewound to v4.28-era while origin still had
everything. Symptom: a file read showing long-deleted code. Fix: `git fetch`
to see the TRUE remote, then `git reset --hard origin/claude/v0_32` (plain
fast-forward semantics — no force-push needed, nothing was lost upstream).
If a file ever looks impossibly old, check `git log origin/claude/v0_32`
BEFORE editing anything.


### v4.33 — Notes/To-Do are general-only; script notes edit on the highlight (HEAD)

Derek (mid-batch): "remove the functionality in both Notes and To-Do that
links an item to a note or to-do list in the script. those are accessible
from the navigator." Asked (AskUserQuestion) what happens to a script note's
typed text — his pick: **popover on the highlight**.

- **The model now**: window = general cards only; Navigator = everything in
  the script (scenes, acts, notes, script [ ] to-dos — note click JUMPS to
  the highlight and opens its popover; to-dos tick in the Navigator).
- **ScriptNotePopover.tsx** (new) is THE editing surface for script notes:
  sticky-card face, title/text, @asset autocomplete, media preview, color
  dots that recolor the mark, delete-with-mark-removal + confirm. Portalled,
  seated by measured top/left from the `.script-note-highlight[data-note-id]`
  span, re-measured on scroll/resize, closes if the span vanishes. Opened by:
  editor highlight click, context menu Add/Edit Note, toolbar Note button,
  Insert → Note, Navigator note click — ALL via `notePopoverId` in
  notesSlice.
- **utils/scriptNoteActions.ts** (new): `createScriptNoteAtSelection` — the
  ONE create-note flow (Toolbar and ScriptContextMenu carried near-identical
  private copies; both now call it) — and `findNotePos`.
- **Deleted**: noteFilter/NoteFilter, openShelfTab/shelfTab/notesSubTab (the
  whole shelf-tab router — last caller became `openTool('fragments')`),
  ListToolbar's FILTER_LABEL/ListFilter, the 'script' (Scene #) sort,
  notesFilter/todoFilter store fields, StickyCard's `anchor` foot
  (fs-script-link/fs-general-tag CSS too), TodoTool's script-list scan.
  `notesSort`/`todoSort` remain ('manual' | 'created').
- Sort is the windows' only cluster control now. Counts count general cards.
- **Not touched**: the `scriptNote` mark name, note storage, exporter/print
  filtering of working notes.

### v4.32 — batch v8 (items 1-13)

1. Caret pick REVISED: Fa chevrons everywhere (ICON-AUDIT.md updated —
   ~~B~~ → A). Structure/Locations/Tags rows' text ▾ glyphs included
   (explicit right/down icons, no CSS rotation).
2. **Scenes fullscreen = editor-area takeover** (`.fs-scenes-takeover`,
   ScenesTool.tsx `ScenesFullscreen`), replacing the position:fixed inset-0
   z-3500 overlay that covered the whole app with no way out. Same pattern
   as Characters: `scenesFullscreen` store flag, ribbon "Return to Editor"
   (one ever renders — guard chain), StatusBar takeover gate, mutual
   exclusivity with scrapbook/charFullscreen both directions.
   `enterScenesFullscreen()` in SceneNavigator.tsx clears the tool slots.
   IndexCards' goToScene exits the takeover FIRST, then focuses/scrolls in
   double-rAF (the editor is unmounted while the takeover is up — the old
   order silently no-opped; scroll container re-queried by class).
3. Relationship map: `fitted` gate — viewBox computed (incl. from saved
   positions) before the svg becomes visible; no oversized first paint.
4. Design window: all sections collapsed by default; `designCollapsedGroups`
   (null = untouched) persisted via viewState.
5-7. Navigator: `navShowSceneNumbers` toggle (# button, `.tool-ctl-lead`,
   numbers before names, assigned sceneNumber ?? ordinal), standard Filter
   dropdown (keepOpen kind toggles), standard search.
8-10. Scenes chrome: fullscreen button in the window actions slot
   (cards-only), Reorder in the row-2 cluster left of View
   (`ScenesReorderControl`, shared with the takeover header; flag-driven
   snapshot effect in IndexCards, unmount = cancel), count row DELETED
   (count lives in the title; IndexCards keeps sceneNavData.total live in
   cards view; the filtered/ fraction only shows in list view).
11-12. Standard-format sweep: Locations/Structure in-body title rows gone,
   counts to TitleExtra via `toolCounts` (`setToolCount`, no-op-if-same);
   Pages/Snippets/Highlights got counts; Highlights' add button moved to
   the bottom `.swn-add-row` (stays in-body — it tracks the live selection,
   which chrome can't); **Tags fully migrated** (tagsPanelTab lifted to the
   store, count + eye + View/Manage tabs in chrome — `badge?: boolean` added
   to ToolChromeTab for the pending-selection dot; legacy slide-in overlay
   keeps its own header). Remaining windows (Analytics, Focus, AI Writer,
   Title Page, Assets, Spelling, History, Design, Workspaces, Feedback) had
   NO redundant in-body title/controls to migrate — nothing deferred beyond
   "no change needed".
13. Scrapbook `.fs-nb-rowdel`: had no color property at all → UA ButtonText
   (black); now `var(--fd-text)`.

Driver: scratchpad/driver/batchv8-check.js — all probes green, zero page
errors. Watch-outs it caught: sidebar tools open INLINE (`.tool-inline`,
no `.tool-window-header`); the View dropdown's visible label is its CURRENT
value (match `[title="View"]`); `.tool-chrome-tab` matches the hidden
measurer copies too; editor clicks minimize docked tools; global chrome
probes catch OTHER open windows' controls — scope to the window root.

### v4.31 — icon unification

Derek answered the audit with picks for all 18 groups — recorded at the TOP
of docs/ICON-AUDIT.md ("DECIDED"), applied app-wide in two commits
(registries/chrome by the dispatcher, 23 leaf files by a worker). New shared
faces: `FullscreenIcon`/`ExitFullscreenIcon` in uiIcons (group 1-C) — use
them for any future fullscreen control; UTILITY_ICONS now carries the QAT
pair. Scope judgements (also in the audit doc): destroy-data actions wear
FaRegTrashAlt while hide/cancel ×'s stay ×; "Scale to Fit/Max" kept the
magnifier (fit ≠ zoom); the Design tool kept FaSlidersH as its identity;
"✓ " STRING prefixes in menu labels stayed text. Emoji swept from
NavigatorTool/AssetManager/StickyCard. When adding icons: check the audit
doc's decided list first — one icon per verb is now the standing rule.

### v4.30 — batch v7

Derek's fixes after living with the template: (1) AssetImage keeps the
previous image up while the next loads (slideshow flash gone — revoke the
old blob only after the swap); (2) .char-fs-header 45→34px; (3) Keyboard
Shortcuts tab moved Customize→Settings (openPreferences('keys');
'customizeShortcuts' command rerouted); (4) StatusBar: "Local System -
Saved" only renders on ERROR, and the editor readouts gate on ANY takeover
(scrapbook OR charFullscreen — was scrapbook-only, Derek's screenshot);
(5) HoverTooltip suppresses the tip when the element's visible text already
contains the title (native title still stripped) — one rule, app-wide;
(6) takeovers are mutually exclusive: NotebookTool mount lowers
charFullscreen, enterCharFullscreen calls closeNotebook(), and the ribbon
renders at most one "Return to Editor" (that was Derek's unreproducible
double-button). GHOST-STORE REMINDER proved again this run: after editing
store files, RESTART VITE before driver store access — a probe read a
ghost editorStore and looked like a real regression.

### v4.29 — batch v6 on top of the template

Derek's follow-ups after seeing the template: (1) the Design field-gap knob
now also drives the seam above Description (the stacked meta/name rows had
fixed margins); (2) an empty expanded cluster search folds on blur; (3) the
image slot says "+ Add Image"; (4) **tabbed chrome rows never wrap** —
`TOOL_CHROME.Tabs` became `useTabs` (tab DATA), and `ChromeRow2`
(ToolControls) measures the row: full strip when it fits, ONE dropdown when
it doesn't, horizontal scroll as the last resort (the shared tab look is
`.tool-chrome-tab` in 20-tool-dock.css now); (5) From Script auto-rescans
(debounced 1s) while open — Re-scan button deleted; note the v4.x auto-sync
means speaking cues get profiles on panel mount, so the scan list surfaces
REFERRED names; (6) the native Window menu merged into View (nativeMenuSync
appends Minimize/Zoom/Fullscreen there; browser fallback unchanged); (7)
**icon audit** delivered — `docs/icon-audit.html` (self-contained visual
picker, 18 duplicate-function groups) + `docs/ICON-AUDIT.md`; Derek replies
"fullscreen: B"-style picks, THEN unify the winners app-wide (also fix the
emoji violations it found: NavigatorTool 📝, AssetManager file-type emoji,
StickyCard placeholder).

---

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
