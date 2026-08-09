# ScriptCraft — handoff archive (rolled out of HANDOFF-CONTINUE.md)

> **What this is:** the older version sections and completed-phase write-ups
> that used to live in `docs/HANDOFF-CONTINUE.md`. They moved here 2026-07-28
> (token-efficiency batch) so the fresh-session brief stays small — it had
> grown to 2,559 lines and every new chat paid to read all of it. Standing
> rule: HANDOFF-CONTINUE.md §1 keeps only the last 4–5 versions; when a new
> one lands there, the oldest rolls to the TOP of the version list below.
>
> **Don't read this file by default.** Come here when a task genuinely turns
> on how an old version worked (a regression hunt, "when did X change",
> reworking a sliced/split area). Sections are verbatim as archived, so
> "this run" / "HEAD" phrasing inside them refers to the run that wrote
> them, not to now.

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

## Version history — v6.53 and older (newest first)

### v6.55 — freeform titles shrink so the title bar has room to grab

- Derek: "make the beat title smaller so that the area for grabbing and
  moving is bigger in the freeform view." TWO changes, because the font
  alone would not have helped: the input was `flex: 1` and swallowed the
  whole bar regardless of type size.
  1. mindTitleSize's range 13–24 → 12–16 (divisor 15 → 18): a default
     240px card now reads at 13px — the same size as every other beat
     card's title — and a big card tops out at 16px instead of 24px. The
     v2.33 emphasis (bigger card = bigger title) survives, just gentler.
     The unit test carries the new numbers plus a monotonicity check.
  2. `.beat-card-title` in a title bar takes `width: 46%` (flex 0 1 auto)
     instead of flex:1, so bare band is always left between it and the
     card's buttons — measured 43px on a 250px card, and the whole strip
     is a drag surface. A long title ellipsizes at rest
     (text-overflow works on an unfocused input) and `:focus` hands the
     full row back for editing, so nothing is unreachable.
- check-v653 (30 asserts) measures the outcome rather than the CSS: title
  font ≤13px, ≥30px of bare bar between title and buttons, the title
  spanning <70% of the bar, and the focus expansion.
### v6.54 — freeform beat cards wear a real TITLE BAR

- Derek: "give beat windows in the freeform view proper headers that can be
  grabbed to drag the beats on the screen." v6.53 made the top row draggable
  but it still LOOKED like the first line of the card — nothing said
  "grab here", and the title input ate most of the row.
- BeatCardContent derives `windowChrome = !!headerDragProps` (freeform
  passes it, sections doesn't) and under it: the row gets
  .beat-card-titlebar, renders FIRST — above any picture, where a window's
  title bar belongs (it used to sit under the image, and in the
  full-bleed branch inside the bottom overlay) — and the ⋮⋮ grip retires
  in BOTH places (the inline one and the floating-over-image one), since
  the whole bar is the handle now. FreeBeatCard stopped passing
  dragHandleProps entirely: nothing left to render it.
- ONE CSS rule does every theme AND every beat color: the band is
  `color-mix(in srgb, currentColor 11%, transparent)` with a 20%
  currentColor border. currentColor resolves to the theme's text on a
  plain card and to readableTextOn(color) on a color-filled one, so the
  bar is always a legible step off whatever is behind it — no per-theme
  or per-color values to maintain. Negative margins pull it out to the
  card's padding edges; the top corners take --dz-beat-card-radius.
  user-select:none on the bar (dragging never selects), text on the title.
- CHECK LESSON (cost one failing assert): a translucent band's computed
  backgroundColor is the INK's channels plus alpha — comparing those to
  the card's opaque color measures nothing. Composite fg over bg first
  (and note getComputedStyle returns `color(srgb 0..1)` for color-mix,
  not `rgb(0..255)` — parse both). Composited Δ17 in dark, asserted ≥10.
- check-v653 grew 7 asserts (26 total): bar spans the card at the top, is
  grabbable, holds title+buttons, no grip in freeform, visible band, sits
  ABOVE a picture (with the floating grip gone), and sections-mode cards
  still keep their ⋮⋮ and take no bar.
### v6.53 — freeform cards: header drag FIXED, any-edge resize, edge-anchored links

- Derek: "i still cannot move the cards by dragging the window." ROOT
  CAUSE of the v6.52 miss: the header's title branch used a threshold and
  deliberately let the pointerdown default through so the input could
  focus — which handed the gesture to the browser's native text-selection
  drag INSIDE that input, and the card never moved. (My v6.52 check
  dragged in one 80px jump, clearing the threshold before the browser
  settled into selection; a hand-paced press-creep-travel reproduces it.
  RULE: drive drag checks the way a hand moves — tiny first steps.) FIX:
  beginCardDrag ALWAYS preventDefaults; nothing native starts. A press
  that never travels far enough replays as a tap — focusTitleAt() focuses
  the field and drops the caret at the click point via
  caretRangeFromPoint (falls back to end-of-text). A FOCUSED title still
  keeps text selection (the drag defers), so editing is unchanged.
  check-v653 drives both the slow drag and the plain click.
- Any-edge resize: FreeBeatCard renders the shared EdgeResizeZones +
  startEdgeResize (v5.46's primitive — same one the tool windows use);
  rect() falls back to the DOM box for auto-height cards, apply() writes
  x/y/cardWidth/cardHeight straight to the store so west/north edges move
  the card's origin as they resize. BeatCardContent's corner grip is now
  OPTIONAL (resizePointerDown?) — sections mode keeps it, freeform drops
  it because the Connect button took that corner.
- LINK REBUILD (Derek's spec): the Connect button moved to the card's
  BOTTOM-RIGHT corner (z-index 41, above the .fs-edge zones' 40), and
  arm-then-drag became CLICK-PLACE-CLICK: click Connect → a circle
  follows the pointer along THIS card's perimeter → click to fix it →
  the line follows the pointer, the hovered card shows its own circle →
  click to fix and connect. Escape or a click on empty canvas cancels;
  the button toggles off at any stage. The canvas takes those clicks in
  the CAPTURE phase, so no card drag or edge resize starts under them.
- DATA (backwards compatible): mindLinks stays a plain id array; the new
  BeatInfo.mindAnchors keys the two endpoint anchors by target id. An
  anchor is NORMALIZED to the card's box ({ax, ay} in 0..1, one pinned to
  an edge) so a resized card keeps its connection point in proportion. A
  pre-v6.53 save has no anchors and draws center-to-center exactly as it
  did — asserted in check-v653.
- Geometry is now MEASURED: a ResizeObserver over the canvas keeps each
  card's real box (the old `cardHeight || 110` guess would float the
  circles off the edge, and had been skewing every line's endpoints).
  nearestEdgeAnchor/anchorPoint are pure + unit-tested
  (BeatBoard.anchors.test.ts, 7 cases incl. the pointer-outside-the-card
  projection and the resize-keeps-its-spot property).
- check-v653 (19 asserts). check-v652's four link-drag asserts retired
  with the flow they tested (its count/contrast/HelperText/header-drag
  asserts stay, 9).

### v6.52 — Outline/freeform polish; card contrast; Helper Text = a real TOOL

- Derek's five (screenshot batch): (1) the beat count moved LEFT, beside
  the tab strip — OutlineBeatCount renders in OutlineTabsExtra (window)
  AND the takeover's .beat-tabs row; the cluster starts at View now;
  (2) CARD ↔ BOARD CONTRAST: .beat-card background = color-mix(in srgb,
  var(--fd-dropdown-bg) 86%, var(--fd-text) 14%) + a soft shadow — the
  AA text floor guarantees a visible step in EVERY theme, no per-theme
  values (dark Δ43, light Δ23 measured in check-v652); user-colored
  cards unaffected; (3) HELPER TEXT IS A TOOL (id 'helpertext'):
  ALL_TOOLS + DEFAULT_TOOL_CONFIG enabled:false (no dock row until
  dragged in — dockInto enables on drop), ToolContent case, TitleExtra
  "N changed" chip; the FloatingWindow shell + helperTextWindowOpen flag
  are GONE — setHelperTextWindowOpen survives as a delegation door to
  openTool/closeTool (checks + old callers); body keeps .htw-panel (now
  .htw-tool too) so the v6.24 row selectors held; (4) freeform connect
  shows its state: the ORIGIN card stays lit during the line-drag
  (mind-link-origin — arming clears at drag start, so the class rides
  linkDrag.fromId) and the hovered card lights up hard
  (mind-link-target, elementFromPoint tracking in onMove); (5) freeform
  cards drag by the WHOLE header row, windows-style — beginCardDrag
  grew a threshold mode: buttons keep their jobs, a FOCUSED title keeps
  text selection, an unfocused title starts the drag only after 4px
  (onEngage blurs it) so plain clicks still focus with the caret.
- FLOAT-EXCLUSIVITY exemption extended: FLOAT_EXEMPT = ['design',
  'helpertext'] in closeOtherFloats (v5.32's design rule, now a set) AND
  the slot-open branches' unconditional tempTool:null now preserves an
  exempt temp tool — that null predates anything living in the temp slot
  that should survive; it silently closed Helper Text when its v6.24
  go-to buttons opened the target window (check-v624 caught it).
- Takeover note recorded in check-v638: the fullscreen takeover owns the
  EDITOR AREA (side docks stay) — width asserts compare against the
  takeover, not the viewport; leave fullscreen via the takeover's shrink
  button (a raw setFullscreenTool(null) just closes the tool).
- check-v652 (13 asserts); v624/v638/v649/v651 updated where the Helper
  Text shell changed; 1125 vitest.

### v6.51 — Helper Text catalog covers DYNAMIC sites; applier arm-flip fix

- Derek (with his screenshot of the bar checkbox's tooltip): "recheck the
  entire app for helper text that is not an option in the helper text
  window. I've found many." ROOT CAUSE: build-helper-catalog.mjs only
  matched LITERAL title="…"/placeholder="…" attributes — every dynamic
  site (title={cond ? 'A' : 'B'}, title={'X'}, ~147 of them) produced
  overridable DOM text the window never LISTED. The DOM applier always
  handled them at runtime (it keys whatever lands in the DOM by default
  string); listing was the gap.
- Builder now slices the balanced {…} expression after title=/
  placeholder= (quote-aware walker) and harvests every FIXED string
  literal inside. Guards: comparison operands/lookup keys skipped
  (===, [key], .includes(, case, and attr= for JSX-typed title props
  whose classNames aren't helper text); templates WITH ${…} dropped
  WHOLE (their pieces — 'can'/'cannot', pluralizing 's' — are fragments
  of one contextual string; no fixed default exists to key an override).
  Catalog 365 → 462 entries (+96 tooltips/placeholders, +1 hint).
- APPLIER BUG found by the new coverage: data-ht-orig memory went STALE
  when a dynamic title re-rendered to its OTHER arm — it painted the old
  arm's override over the new arm (or "restored" the wrong default).
  applyToElement now adopts cur as the new original when it matches
  neither the remembered default nor its override. helperText.test grew
  the arm-flip case (12 tests).
- BeatBoard's ? popover body now rides ht() (the TypewriterTool
  convention it had missed) — editable like the rest.
- STANDING RULE recorded in CLAUDE.md §3 (Derek, this batch): any change
  that adds/removes/rewords helper text reruns build-helper-catalog.mjs
  in the SAME change. check-helper-catalog enforces it in check-all.
- NOT covered (by design): tooltips interpolating live data (`Switch to
  ${tab name}`) have no fixed default to key an override by — contextual
  labels, not fixed helper text. Raw EMPTY-STATE texts (~109 sites, e.g.
  "No snapshots yet…") are also still outside ht() — a separate
  mechanical sweep if Derek wants those editable too.
- helperTextCatalog.test.ts pins the coverage + junk-guards at the data
  level; check-v651 (8 asserts) drives the LIVE loop: override a ternary
  tooltip → control updates; arm flips stay clean; ? popover editable;
  the window lists the example strings.

### v6.50 — Outline polish: bare View trigger + option icons; add-button leads

- Derek's four: (1) the View trigger drops the word "View" — icon + the
  CURRENT view's name only (the Characters-window pattern: no `label`,
  `title="View"`, `icon` swaps with the mode; data-ctl still stamps
  'view' because chromeSlotOf reads label ?? title, so the v5.80 order
  test keeps covering it); (2) Sections/Freeform menu OPTIONS carry
  icons — ControlDropdownItem gained optional `icon` (LuColumns3 /
  LuWaypoints, monotone); (3) the bar checkbox reads "Show this outline
  in the outline bar"; (4) "+ Add Section" (or + Add Beat in Freeform)
  moved to the FAR LEFT of the body row, with margin air before the
  Presets dropdown (.beat-tabs-actions .beat-board-add-col-btn
  margin-right).
- check-v649 UPDATED to the new shapes (View selected by [data-ctl=
  "view"], icon asserts, new checkbox text, add-left-of-preset) — 20
  asserts now. Filter still selected by its .tool-ctl-label.

### v6.49 — Outline header standardized: View/Filter/Search; actions row in the BODY

- Derek's five: (1) the Arrangement label+buttons → the standard View
  dropdown (Sections/Freeform; still NAVIGATES per v2.47 — goToArrangement
  jumps/creates a tab of that arrangement); (2) Presets + "+ Add Section"
  → the body's FIRST ROW (.beat-board-actions-row, left side; the row
  renders in window AND takeover, both arrange modes); (3) "Show beat
  color on all tabs" REMOVED — color always paints the whole card
  (beatColorAllTabs store field + setter + viewState write deleted; old
  blobs carry the dead key harmlessly; the edge-stripe branch is gone);
  (4) header search + color filter — standard cluster, v5.80 CANONICAL
  ORDER View·Filter·Sort·Search (ToolControls.order.test caught my
  Filter-first draft — the registry-driven order test works); (5) the
  v6.48 "Show in Outline Bar" checkbox → the body row's RIGHT edge
  (margin-left:auto), semantics unchanged (locked while viewed tab feeds
  the bar). New OutlineBarCheck component; OutlineHeaderControls is now
  count ("M of N beats" while filtering) · View · Filter · Search · ?.
- Search/filter machinery: beatSearch + beatColorFilter TRANSIENT store
  state (editorStore; not saved to file, not viewState); ONE predicate
  beatMatchesFilter(title/description substring + color set, '' =
  uncolored) hides cards in sections, Uncategorized AND the freeform
  canvas (canvas link-drawing already skips missing endpoints); Filter
  menu lists only colors IN USE (BEAT_COLOR_NAMES) + swatch dots —
  ControlDropdownItem gained optional `swatch`.
- CSS unwound with the features: .beat-mode-* rules, the container-type
  + @container block AND the v6.48 :has() grow workaround (only needed
  because of that container-type) are all gone — the header cluster
  contributes real max-content again (v4.86 contract); hc wraps instead
  of clipping (overflow:hidden dropped).
- check-v649 (18 asserts). Browser-check lesson recorded: the collapsing
  search field shifts the cluster mid-click — test Filter BEFORE typing
  in Search, or the Filter click lands on a moved target.

### v6.48 — seven-item batch: Themes label/click-to-apply; outline tabs → HEADER; Snapshot rename

- Derek's five + two mid-turn: (1) View ▸ "Theme" → "Themes"; (2) clicking
  a theme row in Customize APPLIES it (ThemesTab rows get onClick +
  fs-theme-click cursor; buttons exempt via closest('button'); a HIDDEN
  row applies + unhides — active can never be hidden); (3) applying an
  outline preset RENAMES the viewed tab to the preset's name (inside
  applyOutlinePreset itself so every door gets it; resolveOutlinePreset
  return type gained `name`); (4) `.beat-board-preset` wears the standard
  dropdown clothes (bg --fd-input-bg, text --fd-text — was transparent);
  (5) Script History says SNAPSHOT everywhere (labels/dialogs/toasts:
  Take Snapshot…/Snapshots/Compare with Snapshot…/Track Changes Since
  Last Snapshot; the Check In dialog → "Take Snapshot"; VersionHistory
  window title "Snapshots"; CompareVersionPicker; toolbarCommands +
  shortcuts labels; HelpReference — which ALSO still advertised
  "ScriptCraft Cloud account", a missed v6.42 surface, now gone). The
  command IDS were already takeSnapshot/snapshots/compareSnapshot —
  labels only. On-disk "Auto Saves/Auto Save — …" names KEPT (v6.42
  spec; shared with timed autosaves; check-v642 asserts them). Stale
  toast path "Tools > Script History" corrected to File > (it's the File
  menu's last item). (6) the per-tab ◉ → a "Show in Outline Bar"
  checkbox in the header — checked+DISABLED when the viewed tab feeds
  the bar (exactly one tab always does; you check it on another tab,
  never uncheck), wired to setOutlineBarTab(viewed). (7) outline
  variation tabs live in the WINDOW HEADER via TOOL_CHROME.useTabs —
  ToolChromeTab gained optional key/onRename/onClose(+closeTitle)
  (double-click rename input, × span — strip mode only, like badge);
  ToolChrome gained TabsExtra (the + button, inside the strip host, so
  it survives collapse); beatboard chrome = useTabs+TabsExtra+Controls;
  Presets + Add Section moved INTO OutlineHeaderControls; the in-board
  .beat-tabs row now renders ONLY in the chrome-less takeover
  (!embedded); .beat-tab-use CSS retired.
- TWO PRE-EXISTING header bugs surfaced (the tabs made them load-
  bearing): (a) .beat-header-controls is a SIZE CONTAINER (container-
  type: inline-size for its @container query) → reports ZERO max-content
  → .tool-chrome-right's min-width:max-content sizing collapsed the
  whole outline cluster to 0px (confirmed on the PRE-change build via
  stash: cluster w=0 even then). Fix: `.tool-chrome-right:has(
  .beat-header-controls)` + its .tool-chrome-controls get flex:1 1 auto
  (the docked strip's v4.90 contract). (b) naturalWidth() counted
  ABSOLUTE children (the pinned corner actions — already reserved via
  row padding — and the dead-center Arrangement block), inflating the
  collapse decision ~230px → tabs collapsed in rows that fit. Fix:
  skip out-of-flow children in the sum. And the v2.48 absolute
  DEAD-CENTER Arrangement is retired — it painted OVER the presets/
  checkbox at most widths now the row is shared; it rides the flow
  (margin-left:auto), which is exactly v2.95's narrow fallback made
  permanent.
- check-v648 (20 asserts: menu labels, flyout snapshot names, theme
  click applies via Settings cz-themes, header strip/+/no beat-tabs/no
  dot, checkbox states + bar move, preset bg + rename-on-apply in store
  AND strip, dblclick rename + Escape). Note for future checks: the
  in-window menu bar is a TOGGLE (openMenu helper clicks until open);
  tool window width seeds via toolSizes setState (strip collapses to
  the v5.71 pill below ~1200px with this many controls — by design).
- New tests: BeatBoard.presets (rename on apply incl. override),
  ToolControls.tabs (×/rename affordances; React 19 onBlur = focusout),
  ThemesTab.click (apply + button-guard + hidden-unhide),
  BeatBoard.barcheck (checkbox states/move). 1114 vitest.

### v6.47 — three new built-in themes: Paper, Gruvbox Dark, Catppuccin Mocha

- Derek: "do you recommend adding any additional default themes?" → I
  recommended Paper (a TRUE paper-white light — the stock Light is cool
  blue-gray, nothing in the set was plain white), Gruvbox Dark (warm dark
  — every existing dark theme is cool-toned) and Catppuccin Mocha (the
  soft pastel-dark) → Derek: "add all".
- The pattern for ANY new built-in theme (three touch points, no more):
  (1) a `[data-theme="…"]` block in 22-tools-extra.css — placed BEFORE
  the light-family override block; a LIGHT theme (paper) must also join
  the light-family `.menu-dropdown` / `.dialog-box` selector lists there;
  (2) themes.ts — BuiltInThemeId union + a BUILTIN_THEMES `{id,label,
  base}` row (ThemesTab, MenuBar's View ▸ Theme and editorStore all read
  that registry — nothing else to update; themeStore.allThemeIds appends
  builtins missing from the persisted order, so new ones appear even on
  a machine with a saved order); (3) the id into themeLadder.test.ts
  THEMES.
- Values chosen numerically BEFORE writing CSS (same method as v6.46):
  every text/muted pair ≥4.5:1 on bg+panels; buttons paper #1565c0/white
  5.75:1, gruvbox #6f5c12/#ebdbb2 4.76:1, catppuccin #655385/#cdd6f4
  4.64:1 (the palettes' published accents #d79921/#cba6f7 fail as button
  FILLS under their light text, so fills are custom darker steps; the
  accents themselves stay authentic). Ladder verified: paper
  234<241<250≤252≤254≤255, gruvbox 29<31<40≤48≤57, catppuccin
  18<25<31≤43≤51. Screenshots of all three eyeballed (Vite+Chromium,
  data-theme swap) before shipping.

### v6.46 — theme legibility pass (the palette report's S1/S2/S6, applied)

- Derek: "make suggested changes to themes" — SCOPE: only the THEME
  suggestions from the palette-analysis artifact (claude.ai/code/artifact/
  842e3485-…): S1 sepia (muted #8a7a5f→#6e5f45 5.01:1; accent
  #a5673f→#7d4a26 5.89:1 — ONE accent slot, so chrome fills deepen with
  it; tinted-page idea NOT applied, page/export pipeline), S2 solarized-
  light (text #586e75→#49606a 6.15:1, muted #93a1a1→#657271 4.64:1),
  S6 dracula muted #8a8fa8→#979db6 5.30:1 + light muted #666→#5d5d5d
  (5.08:1 on panels). S3/S4/S5/S7 (note red, annotation colors, scene
  wheel, palettes.ts consolidation) deliberately NOT applied — Derek said
  "themes". All ratios were verified in the report's build script before
  shipping. themeLadder.test.ts only orders surfaces — unaffected.
- The artifact was republished with APPLIED tags on S1/S2/S6 (same URL).

### v6.45 — Upload Voice Clip removed from the character window

- Derek: "remove the 'upload voice clip' tool from the character window."
  SCOPE READ: the TOOL, not the section — the Voice Profile photo-row
  toggle and its Speech Pattern / Vocabulary fields STAY (they're
  writing fields); renderVoiceButton (upload / player+Replace+Remove),
  the handlers, the hidden audio input, and AssetAudio (CharacterProfiles
  was its only consumer) are gone. `.char-profile-voice-btn` CSS KEPT —
  the Relationships/Appears-in/Voice-Profile toggles wear it; the
  player-row CSS block (28 lines) removed. characterProfile.voiceProfile
  stays in the type (saved scripts carry it; annotated HISTORICAL like
  rotationLocked). Helper catalog regenerated (366).
- Print (v6.44) still awaits Derek's verdict — if it crashed again, ask
  for `cat "$HOME/Library/Application Support/com.freedraft.app/print/
  print-debug.log"` FIRST; plan B (out-of-process helper) is declared.

### v6.44 — print round 4: nil NSPrintInfo + BREADCRUMBS; Settings→app menu

- Derek: "print still crashes" (no crash log supplied). Re-derived from
  the FAILURE PATTERN: v6.36 (modal) / v6.37 (sheet+catch) / v6.43
  (kept-alive) all crashed IDENTICALLY — so the fault predates where they
  differ. The one shared call: `printOperationForPrintInfo_…(None, …)` —
  operation CREATION with a NIL print info. The header marks it nullable;
  every working PDFKit example passes sharedPrintInfo; a SIGSEGV inside
  creation is invisible to exception::catch and shows no dialog. Now
  passes `NSPrintInfo::sharedPrintInfo()` (signature verified from the
  registry source — NO mtm arg; darwin scratch crate + Linux cargo check
  both clean).
- INSTRUMENTATION, the real insurance: every print attempt REWRITES
  app-data/print/print-debug.log, one fsync'd line per step (start /
  main-thread / doc-loaded / printinfo / op-created / presenting-sheet /
  sheet-scheduled / kept-alive). After any crash the LAST LINE names the
  dying step — ask Derek for `cat "$HOME/Library/Application
  Support/com.freedraft.app/print/print-debug.log"` BEFORE the next
  theory. If sharedPrintInfo didn't fix it, plan B is an OUT-OF-PROCESS
  print helper (sidecar binary doing the PDFKit dance — a SIGSEGV then
  kills only the helper), declared to Derek.
- Settings…: Derek clarified "second to last item in the SCRIPTCRAFT
  menu" — v6.43 misread it as File. Now: app menu, directly above Quit
  (hardcoded ⌘, accelerator there; registry keeps Mod+, for Keyboard
  Shortcuts + in-window). In-window File keeps it second-to-last (no app
  menu exists there); the nativeMenus gate is back.

### v6.43 — the print crash's TRUE root cause; Settings→File; standard window buttons

- PRINT CRASH ROUND 3 (survived v6.37): ROOT CAUSE — a LIFETIME bug, not
  threading/exceptions. `runOperationModalForWindow…` presents the sheet
  ASYNCHRONOUSLY and returns at once; the closure then dropped the
  `Retained<NSPrintOperation>`, so the runloop presented a sheet for a
  DEALLOCATED operation → SIGSEGV (no ObjC exception involved — nothing
  for catch to catch, no dialog ever visible; matches Derek's symptom
  exactly). Fix: a main-thread `thread_local!` slot `ACTIVE_PRINT` keeps
  (op, doc) alive until the NEXT print replaces them. Type-checked on
  aarch64-apple-darwin via the scratch crate (scratchpad/print-check —
  exception::catch omitted there, its C shim needs Apple's toolchain);
  Linux cargo check clean. RULE, recorded: any AppKit API that presents
  asynchronously needs its objects kept alive past the presenting call.
  NOT runnable in this sandbox — if Derek STILL crashes, ask for the
  macOS crash log (Console.app ▸ Crash Reports) before theorizing again.
- Settings…: OUT of the macOS app menu (reverses v4.22), INTO File as
  the SECOND-TO-LAST item (Script History stays last), both menu modes —
  nativeMenuSync mirrors MenuBar's one list. ⌘, moved to the shortcut
  REGISTRY (shortcuts.ts defaultCombo 'Mod+,') — the app-menu item had
  hardcoded it.
- FloatingWindow (Settings + Helper Text) buttons = THE standard set:
  char-profiles-fullscreen-btn + FullscreenIcon (RestoreIcon while
  fullscreen), tool-window-close + CloseIcon — Derek's screenshot caught
  the Lu-icon lookalikes. check-v638/v642 assert the SVG family now
  (close count is exactly one).
- check-v642 gained the File-menu-tail assert (scope to the ROOT
  .menu-dropdown — a submenu flyout is a second one).

### v6.42 — LOCAL-FIRST: account/cloud UI purged; Settings is a WINDOW

- Derek's seven (plus a mid-turn rename). The decisive read: his items
  2/4/5 flagged the ACCOUNT surfaces v6.40 deliberately kept ("I think
  this refers to the now disabled collaboration server") — the answer is
  they were the account system, and they're gone from the UI anyway:
  no sign-in affordance may remain. SERVICE LAYER KEPT in code
  (collabAuth api, cloudApi, authedFetch, scriptApi cloud routing,
  authVerified/collabAuth store fields, /verify /reset-password logic is
  DELETED though) — UI-less, so nothing can arm it. Revert = git.
- REMOVED: SettingsPage rewritten (System tab = Reset only; Cloud Server
  URL + ScriptCraft Account + Account & Security gone, plus the Google
  Identity helpers); Save Options' account section + BOTH Cloud rows;
  setupFields' ScriptCraft Cloud row; SaveAs 'ScriptCraft Cloud' chip;
  StatusBar Cloud mirror + AuthIndicator; AuthGate/AuthBootstrap
  unmounted; files deleted: AuthGate, AuthBootstrap, AuthIndicator,
  CollabLoginDialog, VerifyEmailRoute, ResetPasswordRoute (+their
  routes); OpenFile's This device/Cloud tabs (app=local, web=cloud-only
  — both single-source); saveLocations lost saveToCloudMirror + cloud
  snapshot branch; settingsStore lost saveToCloud/snapToCloud (+keys);
  login CSS culled (auth-indicator cluster, 53 dead settings/collab
  rules). /oauth-callback STAYS — it's the GDrive/OneDrive PKCE popup
  lander, NOT account UI.
- Always-on row: shows + edits localSaveFolder (THE Save As field — one
  source, two doors) with Choose Folder…; checkbox stays locked.
- Auto saves: the local-folder branch writes `<folder>/Auto Saves/…`;
  save_text_to_path (lib.rs) now create_dir_all's parents (cargo check
  clean). GDrive/OneDrive already used an Auto Saves folder.
- Settings window: PreferencesDialog swapped Modal for FloatingWindow —
  NEW shared shell extracted from HelperTextWindow's v6.38 chrome (drag,
  any-edge EdgeResizeZones, fullscreen, close; htw-* classes are the
  shared window classes now). HelperTextWindow consumes it too (one
  shell, no fork). prefs-window CSS: layout flexes, inputs re-enable
  user-select.
- Annotations: "Filter" → "Display" (label + title only — the
  markup-ctl-filter class and data-ctl="filter" are persisted/check ids
  and keep their names; every check selects by class, verified).
- check-v642 (16 asserts: window chrome/drag/fullscreen, no account/
  cloud anywhere, chip = localSaveFolder, System=Reset, Display label,
  Auto Saves path). v638 re-run 19/0 (shared shell holds).

### v6.41 — Save Options unlocked + backup location; toolbar toggle retired

- Derek: (1) "OneDrive is locked as a save location even though I haven't
  connected" — ROOT CAUSE: setup's SaveLocationsField has NO connection
  guard (tick anything), but PreferencesDialog's rows wore
  `disabled={!connected}` — written to stop ENABLING unconnected
  providers, it also blocked DISABLING one. All five guards removed
  (gdrive/onedrive save; cloud/gdrive/onedrive snapshots); the "— connect
  below first" label hints stay. An enabled-but-unconnected provider
  fails through the save-error surface (reportSaveError), not silently.
- (2) "Local System (backup location)": settingsStore gains
  saveToBackupFolder (bool) + backupSaveFolder (path) — SEPARATE so
  unchecking keeps the folder (keys opendraft:saveloc:saveToBackupFolder
  / :backupFolder; settingsBackup picks them up by prefix scan).
  mirrorSave adds job 'Local backup' gated on BOTH (checkbox alone can't
  arm a write into nowhere) reusing saveToLocalFolder(payload, folder).
  Prefs row = the v2.83 snapshot-folder pattern (check-with-no-folder
  opens the picker, path chip, Choose Folder…). SaveAsDialog's chips
  include 'Local backup' under the same gate (tested).
- (3) "Show/Hide Annotations" toolbar button REMOVED: the
  toolbarBuiltins row is deleted — normalizeToolbarZones DROPS unknown
  b: tokens, so saved layouts shed it on next normalize; Toolbar's case +
  uiIcons entry gone; helper catalog regenerated. Visibility still lives
  in annotationsMenu + the Annotations window's Show button.
- NOTE (scout finding, not acted on): localSaveFolder ('This device'
  mirror, set via Save As/setup) still has NO row in Save Options, and
  StatusBar's enabledMirrors ignores both local mirrors — pre-existing
  gaps, flag to Derek if he wants them surfaced.

### v6.40 — Collaboration REMOVED (Derek: "remove all Collaborate or Collaboration Server functionality")

- THE LINE THAT MATTERS: `collabAuth`/`CollabLoginDialog`/`/auth/*` are the
  ACCOUNT system (Cloud saves, sign-in, 2FA, devices) — the identity
  provider merely began life on the collab server, and the names + the
  `opendraft:collabAuth` storage key STAY (renaming orphans signed-in
  users). Everything session/share/sync is GONE.
- Deleted: hooks/useCollaboration, services/collabSync, ShareDialog,
  JoinCollabDialog, backend app/api/collab.py + services/collab_service.py,
  start_collab.sh, user-manual/collaboration.html (+ sidebar/nav links),
  COLLAB_COLORS. ScreenplayEditor lost the /collab/:token route (App.tsx
  too), banner, start/stop/switch/join handlers, collabExtensions
  (History is unconditional now — line was `...(collabMode ? ...)`),
  editorKey (only collab set it), isCollabGuest guards (~12 sites).
  MenuBar lost the File ▸ Collaboration submenu + guest disables;
  showUnreleasedTools stays (Lock Pages still reads it).
- Settings: "Collaboration Server" + "Invite Defaults" sections gone
  (SettingsPage); account sections retitled "ScriptCraft Account"
  (SettingsPage + PreferencesDialog; save row now "Cloud - ScriptCraft
  Account"). settingsStore lost collabServerUrl + defaultInviteExpiry
  (+ their opendraft:* keys); config.ts lost getCollabWsUrl.
- collabAuth.ts kept ONLY the account api (register/login/2FA/devices/
  getServerConfig via the backend proxy); collabRequest/testConnection/
  reset-close-document/revokeMyCollabSessions/isCollabAuthenticated/
  setLogoutCollabTeardown removed; performLogout is 3 steps now. The four
  storage adapters dropped the 5 collab methods + CollabSession in
  lockstep (api/local-storage/fallback/file-fallback).
- npm: @hocuspocus/provider, @tiptap/extension-collaboration{,-cursor},
  yjs, y-prosemirror, y-protocols uninstalled → About's open-source list
  dropped Yjs & Hocuspocus (v4.76 standing rule). Helper catalog
  REGENERATED (dialog strings left). CSS: collab blocks out of 16-print/
  15-responsive/17-settings (login dialog's .collab-forgot-link/.collab-
  remember-* stay — account UI). Tests 1103→1102 (randomCollabColor).
- collab-server/ is now an AUTH-ONLY server (server.ts rewritten:
  no Hocuspocus/Yjs/ws/upgrade path, /api/collab + reset/close-document
  gone; /auth + /health stay; deps ws/yjs/@hocuspocus/* dropped;
  `tsc --noEmit` verified). deploy/ configs still name the service
  "collab" — renaming the service id across compose/Caddy/supervisord
  was deliberately NOT done (infra rename, no behavior change).
- lanes.json "collab" lane → "Auth / Cloud / Settings" minus deleted
  files. If Derek ever wants collaboration back: `git log` around
  v6.39→v6.40, it's one revert away plus npm install.

### v6.39 — map rotation unlocked; the map is a CANVAS now (WKWebView)

- Derek: (1) remove the import bar ("Turn the map upright…", Rotate, Set
  Rotation) — rotation is changeable in Options now; (2) "rotating the
  map in the location window still makes it disappear" (SURVIVED v6.38's
  160px floor on his Mac).
- (2) ROOT CAUSE UNREACHABLE IN CHROMIUM: probes rendered the CSS
  quarter-turn correctly in docked AND fullscreen shapes, so the vanish
  is WKWebView mishandling the construct (absolute box-swap +
  translate(-50%,-50%) rotate()). Fix: MapImage DRAWS the bitmap onto a
  dpr-scaled canvas (translate/rotate/drawImage, quarter-swapped draw
  box) — no CSS transform left to mis-render. Bytes load via
  api.getAssetBytes → blob URL (AssetImage's rule) with callback refs
  (v6.38's refetch lesson); a failed load unmounts to the broken box and
  a rotation remounts = retry. `.locmap-img` is the canvas now — checks
  wait on `canvas.locmap-img` (the loading box shares the stage's 4/3).
- (1) `importing` gates, lockLocationMapRotation, the import bar and its
  CSS are GONE; importLocationMap + the asset picker set
  rotationLocked: true (the field is vestigial — saved scripts carry it,
  nothing reads it). Pins render and place from the first moment.
  rotateLocationMap already turned pins with the map (v5.81) — that's
  what makes any-time rotation safe.
- Checks v577 (rotate flow = Options ▸ Rotate 90 degrees ×4),
  v578/v581/v581-orphan/v582 (×4 sites)/v585: the import-bar setup step
  became waitForSelector('canvas.locmap-img'). All green + v638.

### v6.38 — Derek's ten-item batch (helper text, snippets, locations map, panel zoom)

- Ten reports in one stream (several mid-turn). The load-bearing ones:
- HELPER TEXT: the window wears the STANDARD tool-window header classes
  (+ a local fullscreen toggle — htw-fsbtn); BLANK overrides are real now
  (HelperTextSection.commit keeps '' — only typing the default verbatim
  clears; the ↺ reset restores). The "video" row was ScriptNotes' iframe
  a11y label — build-helper-catalog gained a NOT_HELPER_TEXT exclusion
  set (regenerate after editing it).
- SNIPPETS: captureSelectionSnippet (StickyNotes.tsx) is the ONE
  implementation behind ⌥⌘X/⌥⌘C AND the new window buttons; per-card
  insert uses editor.view.pasteText → the same paste pipeline as the
  v6.21 drag (v6.20 fill-active-element applies). StickyCard gained
  headActions (the card is still THE card). FragmentsTool now consumes
  its editor prop.
- LOCATIONS MAP, the rotation "disappear": REPRODUCED — a short canvas
  + a quarter-turn's flipped ratio fit the stage to a ~20px speck. The
  stage now keeps ≥160px on its long side and scrolls (the scroll
  container existed for exactly this). Also: AssetImage re-fetched bytes
  on EVERY parent re-render (onFailed, an inline arrow, sat in the
  effect deps — now rides a ref) and a transient failure branded the map
  broken until the image changed (mapFailed now resets on rotation).
- LOCATIONS MAP chrome: Map Options → the WINDOW HEADER as "Options"
  (LocationsControls, map view only — REVERSES v5.81; Derek's call);
  the Grouped toggle sits at the action bar's RIGHT edge (count
  stretches between); the rail rows' Map/Pin/Group buttons collapsed
  into ONE ⋮ menu (locmap-rail-menu-btn) — Connect/Hide/Lock/Delete
  (the old Group button WAS the connect flow; group create/join stays
  in the details' Location Group field). LocationPlaceDetails gained
  hideActionsRow (List view unchanged).
- PANEL ITEM-SIZE (screenshots): --dock-scale scaled only dock rows.
  `.tool-inline { zoom: var(--dock-scale, 1) }` scales the OPEN tool —
  zoom is layout-aware and WebKit+Chromium both honor it. NOTE: a
  zoomed container KEEPS its outer width (content lays out at
  width/zoom) — measure INNER elements in checks. Notebook's
  --nb-tree-scale default reverted to 1 (was defaulting to --dock-scale
  → would have double-scaled).
- + Add Section / + Add Beat wear the new shared `.fs-btn-primary`
  (22-tools-extra.css) — THE standard blue; reuse it for future primary
  body buttons instead of minting new ones.
- CHECK UPDATES (superseded specs): v577 + v581 asserted the v5.81
  "options OUT of the header" — flipped to v6.38; v578/v585 drove the
  removed Map/Pin detail buttons — they drive the ⋮ menu now (v585's
  railOption helper, one place). check-v638 (19) covers all ten;
  check-v635 re-run green.
- Gates: tsc 0, 1103 tests, build, checks 720/0.

### v6.37 — HOTFIX: v6.36's native print CRASHED the app

- Derek: "File > Print made the app crash." Two faults in the v6.36
  command, both fixed:
  (1) it was a SYNC command — Tauri runs sync commands ON THE MAIN
      THREAD, so rx.recv() blocked the very thread the print closure was
      queued to run on. Async now (off-main; recv via spawn_blocking).
  (2) runOperation() spun an APP-MODAL nested run loop inside the tao
      event-loop callback. The panel now presents as a SHEET on the main
      window (runOperationModalForWindow…, ns_window() from the tauri
      WebviewWindow) — present-and-return, no nested loop.
  Plus: the whole AppKit/PDFKit body is wrapped in
  objc2::exception::catch (objc2 "exception" feature; the helper crate
  was ALREADY in the lock) — an NSException now reports back as Err and
  the frontend falls back to opening the file, instead of the process
  terminating. catch()'s signature was verified from the registry source
  (the C shim can't cross-compile here); the sheet body re-verified
  against aarch64-apple-darwin.
- LESSON (Rust-side commands): sync #[tauri::command] = main thread.
  Anything that dispatches to the main thread AND waits must be async.
- Frontend untouched (the invoke + fallback chain already fit).

### v6.36 — Print = the REAL system dialog (PDFKit), no viewer

- Derek on v6.33's openPath flow: "it opens it in a pdf view first. it
  should not do that." The saga's end state: a new `print_pdf_dialog`
  Tauri command (lib.rs) — macOS PDFKit builds a print operation for the
  just-written export PDF and runs it with the system panel. Straight
  from File ▸ Print to the dialog, printing the EXACT exporter output.
- HOW IT WAS DERISKED FROM A LINUX SANDBOX: `rustup target add
  aarch64-apple-darwin` + an isolated scratch crate pinning the tree's
  exact objc2 generation (objc2 =0.6.4, framework crates =0.3.2, NEW
  objc2-pdf-kit =0.3.2) type-checked the command body against the real
  darwin target — the compiler corrected two API guesses
  (printOperationForPrintInfo… takes Option<&NSPrintInfo> + a
  MainThreadMarker; alloc needs objc2::AnyThread). A full-graph darwin
  check is impossible here (C deps want an Apple toolchain), so the
  lib.rs body is VERBATIM from the validated scratch; only the
  path-containment prelude + run_on_main_thread glue are outside that
  proof. Setup errors report over an mpsc channel BEFORE runOperation
  blocks the main thread modally — a bad file surfaces as Err and JS
  falls back (openPath + toast → save dialog + toast; nothing silent).
  The command prints ONLY canonical paths under app-data/print.
- Cargo: [target.'cfg(target_os = "macos")'.dependencies] pins the four
  objc2 crates to versions ALREADY in the tree — the lock gained only
  objc2-pdf-kit (+83 additive lines). Linux cargo check clean.
- MID-BATCH SANDBOX ROLLBACK (the third): local HEAD reverted to
  b15c8f7 (v6.33) while origin held v6.35; the four v6.36 files were
  edited on the stale tree. Recovery: targeted stash → fetch →
  reset --hard origin → pop (clean — v6.34/35 touched none of the four).
  The standing rule (fetch+compare EVERY turn) caught it.
- checks: check-v629 (browser print paths) 5/0 re-run; check-v633 12/0.
- Gates: tsc 0, 1103 tests, build.

### v6.35 — annotation icons in the LEFT margin

- Derek: "for annotations, move the on-page icon to the left margin from
  the right." MarkupIconLayer's one position formula flips: the icon now
  centers in the LEFT margin band (page edge → 1.5" text start; center
  0.75" ± half an icon), clear of the page edge, the text, and the
  scene-number zone that hugs the text (1.0–1.35"). No other consumer
  assumed the right side (check-v547 only counts icons).
- check-v635 (4: renders, centers in the band, left of the text column,
  left half of the page). check-v547 re-run 19/0.
- Gates: tsc 0, 1103 tests, build.

### v6.34 — the launcher restores package-lock.json too (Derek's aborted pull)

- Derek's v6.33 pull ABORTED: "Your local changes … would be overwritten
  by merge: frontend/package-lock.json, src-tauri/Cargo.toml". The
  launcher runs `npm install` on every start and npm rewrites
  package-lock.json per-machine (fsevents/optional-dep churn) — it sat
  dirty for weeks and only collided when a push finally touched it
  (v6.33's opener dep). Fix: `npm run desktop` now restores
  frontend/package-lock.json alongside Cargo.lock before pulling (the
  v5.55 pattern: committed generated files are canonical).
- Cargo.toml's local change has UNKNOWN origin (nothing on his Mac
  should edit it — possibly a hand-edit from an old session). NOT added
  to the auto-restore (it's source, not generated); Derek was given a
  targeted `git stash push -- <both files>` so the state is preserved,
  not destroyed. If Cargo.toml turns up dirty AGAIN, something on his
  machine is regenerating it — find out what before restoring blindly.
- Gates: tsc 0, 1103 tests, build (changelog/version are src).

### v6.33 — the MEASURED wrap geometry (63 chars); the asset handler's cwd bug; Print OPENS

- Five Derek reports (print, wrap, assets — then darkness and Title-Page
  Fit mid-stream). The wrap and asset fixes both overturned earlier
  diagnoses; details matter here.
- WRAP ("the word 'of' is in a third row in scriptcraft; at the end of
  the second row with a different program"): his two comparison pages
  were re-extracted from the session transcript and MEASURED pixel-wise
  (Playwright canvas). The reference is TRUE 10 cpi — 12pt Courier at
  its natural 7.2pt advance, NO tracking — with full-width columns
  1.5"→7.8" = 63 chars (both 63-char lines end ink ≈7.79"; CUT TO:
  right-aligns to 7.8"; cap-height/pitch matches ours, so full-size
  glyphs, wider column). THREE compounding causes had ScriptCraft at
  60–61:
  (a) FD_CPI 10.33 with 6.0" columns — 62-char capacity, wrong vs the
      measured reference;
  (b) the exporter's wordWrapRuns counted each word's TRAILING space in
      its fit check — one word early on every full line;
  (c) ProseMirror sets `white-space: break-spaces`, under which a
      soft-wrapped line must ALSO fit the space it breaks at (Chromium
      flip measured at EXACTLY capacity+1 advances; same spec rule in
      WKWebView — Derek's observed 61 = floor(576/9.29) − 1. The
      phantom SPACE, not letter-spacing quantization).
- THE FIX — one geometry source: NEW `utils/screenplayMetrics.ts`
  (FD_CPI 10.0, FD_INDENTS right edges 7.80, CHARS_PER_LINE floor'd,
  SPACE_BEFORE, getTextLines, and columnFor(type, layout) which CLAMPS
  columns to the layout's content edge — FDX imports / custom margins
  now wrap identically in editor, page count, and exports).
  pagination.ts, pdfExporter.ts AND docxExporter.ts import it (docx's
  local copy had already drifted: its sceneHeading space-before missed
  v6.30's change to 2 — the copies are dead). Editor side: the -0.31px
  letter-spacing squeeze is REMOVED; default rightMargin 0.7"
  (+ migratePageLayout chains untouched-default docs A4→Letter→0.7);
  static CSS + industry template + templates/_helpers right edges
  7.80" (stagePlay pins its historical 7.50 via a local wrapper); and
  the break-spaces allowance: `.screenplay-element { margin-right:
  -14px }` — one invisible space + slack, RESET on right/center-aligned
  elements (and emitted per-rule by templateCss), so ink still ends at
  7.8". TITLE_CPL = action − 1 (title blocks reset the allowance).
  Export scene numbers now anchor ±0.15" off the heading column (were
  hardcoded 1.0/7.75).
- KNOWN EDGE: a spaceless 64-char token can render on 1 line where the
  estimate counts 2 (no trailing space to fit) — pathological input;
  measured fills absorb the visual drift.
- ASSET IMAGES ("the images are still broken"): the v6.32 diagnosis was
  WRONG TWICE OVER — the config assetProtocol enable was a no-op (the
  `protocol-asset` cargo feature was never on) AND irrelevant (lib.rs
  hand-rolls the `asset:` scheme handler; do NOT add the feature — the
  built-in would fight the custom handler for the scheme name). REAL
  bug: the handler's `trim_start_matches('/')` strips EVERY leading
  slash from the decoded path → RELATIVE → resolved against cwd → 404
  under `tauri dev` (a packaged app with cwd "/" survives by luck).
  Fixed: path re-anchored absolute, canonicalized, and SCOPED to
  app_data_dir (403 outside). The v6.32 config block is REVERTED.
  cargo check ran IN-SANDBOX (GTK headers apt-installed) and caught a
  real compile error before Derek could (UriSchemeContext needs
  .app_handle() — the closure arg is not an AppHandle). Frontend
  belt-and-suspenders: `utils/useAssetDisplayUrl` (direct URL →
  onError → getAssetBytes → blob:, else a missing-file icon) wired in
  AssetThumb (AssetManager) + AssetViewer.
- PRINT ("just saved the script as a pdf. it did not open the print
  menu"): tauri-plugin-opener `=2.5.4` (newest whose tauri req ^2.10
  accepts the =2.10.3 pin) + `.plugin(init)` + `opener:allow-open-path`
  scoped `$APPDATA/print/**` + @tauri-apps/plugin-opener npm dep.
  Tauri print path now: write `print/<title>.pdf` under app data →
  openPath() → Preview opens the exact export, one ⌘P from the real
  dialog (autoPrint stays embedded — Acrobat-class viewers open the
  dialog themselves); any throw falls back to the v6.32 save-dialog
  path. Cargo.lock regenerated in-sandbox (additive only). FIRST
  LAUNCH RECOMPILES the shell (~minutes).
- DARKNESS ("figure out why"): two real contributors fixed — the
  letter-spacing squeeze (denser ink, now gone) and macOS WebKit's
  default stem-darkening (`-webkit-font-smoothing: antialiased` now on
  .screenplay-content). Courier Prime now LEADS the font stack so the
  screen face is the embedded export face even where Courier Final
  Draft is installed. The residual difference vs his reference is the
  reference's thinner Courier cut (cap-height ratio reads like Courier
  New) — inherent to the face; said so plainly.
- Title Page Fit: both axes — min(width, height ratios) against the
  scroll viewport; effect deps now include page size.
- checks: check-v633 (12 — layout default 0.7, squeeze gone, column
  618.8px, the editor breaks Derek's EXACT sample like the reference,
  export items match line-for-line, 63 chars end at 7.794in measured
  from the PDF bytes) + screenplayMetrics.test.ts (9, incl. the exact
  sample strings + migration chain) + AssetManager fallback tests.
- Gates: tsc 0, 1103 tests, build, cargo check clean (in-sandbox — GTK
  headers apt-installed; caught the UriSchemeContext error), checks 698/0.

### v6.32 — asset protocol ON; Tauri print = save+toast; Courier Prime embedded

- Derek's three reports, root causes:
  (a) BROKEN ASSET IMAGES ("?" in list AND viewer — so pre-dating the
  v6.31 thumbs): local-storage builds asset:// URLs via convertFileSrc,
  the CSP allows asset://localhost — but tauri.conf.json NEVER ENABLED
  the protocol. `app.security.assetProtocol { enable, scope:
  ["$APPDATA/assets/**"] }` added — config only, no Rust, scope exactly
  the assets tree (the fs-scope caution stands). NOT verifiable in this
  sandbox (no WKWebView) — structural fix, flagged to Derek.
  (b) PRINT still dead on Tauri: the v6.30 iframe fallback dies
  silently too — WKWebView doesn't render PDFs in iframes, onload fires
  against nothing, print() shows no dialog. Tauri branch is now
  DETERMINISTIC: isDesktopTauri() → saveFile (proven native dialog) +
  toast saying press ⌘P. Browsers keep the real popup print. The next
  step up needs tauri-plugin-opener (Rust dep — Derek's machine must
  compile/test; offered, not shipped).
  (c) "Exports as Courier Std": jsPDF's builtin 'courier' is the PDF
  standard font — viewers substitute. The app's bundled Courier Prime
  TTFs (all 4 weights) are EMBEDDED per export (fetch → VFS → addFont,
  cached; builtin only as load-failure fallback). charSpace derives
  from getTextWidth so the FD 10.33-cpi layout is unchanged.
  check-v630 asserts CourierPrime in the export bytes (9).
- In-app text size re-verified 12pt on a 12pt grid (check-v630); his
  "size still not matching" was measured against a pre-pull build —
  the v6.30 heading spacing + this font embed are the deltas.
- Gates: tsc 0, 1092 tests, build, checks 686/0.

### v6.31 — Asset Manager: inline image thumbnails

- Derek: "show a preview of the image in the asset manager" — image
  assets render a real 38px `<img>` thumbnail in the list's icon cell
  (api.getAssetUrl, lazy-loaded, click = the same AssetViewer the name
  opens). Other types keep their mime icon.
- TEST TRAP: the component re-fetches on mount — the api MOCK must
  serve the fixtures (vi.hoisted), or listAssets() overwrites whatever
  the test seeded into the store. AssetManager.thumbs.test.tsx (1).

### v6.30 — formatting verified against the standard; Print's silent Tauri no-op

- Derek's side-by-side (another program vs ScriptCraft, same text) +
  the StudioBinder reference. MEASURED verdicts:
  (a) FONT was never wrong — Courier (Courier Final Draft → Prime
  fallback) at 12pt on an exact 12pt line grid, FD-matched
  letter-spacing. The "different font look" was density.
  (b) The density: SCENE HEADINGS carried ONE blank line; the spec (and
  his other program) uses TWO. Fixed in all three renderers + template:
  editor CSS 24pt, pagination SPACE_BEFORE 2, pdfExporter 2,
  industryStandardTemplate marginTop 24. (Genre templates — sitcom,
  stage — keep their own spacing on purpose.) Pages repaginate ~10%
  longer; that is the correct standard.
  (c) FADE IN: is the OPENING transition — LEFT margin, action column;
  every other transition stays right. ONE predicate
  (utils/transitions.isLeftTransition) shared by the editor decoration
  (Transition.ts — a decoration, not renderHTML, so typing flips it
  live) and the pdfExporter (indent choice at the caller, line 454ish —
  renderElement alone only fixed alignment INSIDE the transition
  column).
- PRINT ("clicking File > Print does nothing"): v6.29's window.open
  returns NULL in Tauri WITHOUT throwing — the fallback never fired, a
  silent no-op shipped. Cascade now: popup → blocked? hidden
  iframe[data-print-frame] holding the same PDF prints it (WebKit
  prints a PDF frame at the PDF's own page size) → frame never loads?
  saveFile + a toast that SAYS so. check-v629 stubs window.open=null
  and pins the frame branch (7 asserts).
- checks: check-v630 (8 — editor classes/margins/font, live flip, and
  the export GEOMETRY parsed in node: FADE IN x=108, CUT TO right,
  heading gap 36pt).
- Gates: tsc 0, 1092 tests, build, checks 685/0.

### v6.29 — Print through the exporter; the goal chip's Header = the TITLE BAR

- Derek's shrunken-print PDF, MEASURED: Producer "macOS Quartz
  PDFContext" (the PRINT dialog, not our exporter), font 8.9pt =
  12×0.743, left margin 2.21in = 1.09in printer margin + 1.5in script
  margin ×0.743 — window.print() in WKWebView ignores 16-print.css's
  `@page { margin: 0 }`, so the OS laid our full page inside its own
  printer margins and scaled to fit ("double margins", exactly his
  theory). Our jsPDF exporter measured EXACT: 108pt margin, 12pt font,
  612×792. FIX: File ▸ Print renders the SAME exporter PDF and opens it
  with autoPrint queued (blob: popup; falls back to window.print() only
  if the PDF path throws) — one rendering path for paper and file.
  exportPDF grew `print?: boolean`.
- Goal chip: Derek: "the app header is the same line with the quick
  action toolbar and the script name" — Show in: Header now mounts the
  chip in the TITLE BAR, absolute at its right edge (the centering
  counterweight untouched; `.fs-titlebar` gained position:relative;
  pointer-events re-enabled above the drag layer). The ribbon seat
  remains ONLY where no title bar exists (browser/non-Mac), gated by
  showTitleBar() — one chip, one place. Stored value stays 'toolbar'.
- CHECK TRAP: the DEV titlebar flag must be set AFTER boot() + reload —
  the driver's first-load init script clears localStorage and init
  scripts run in add order (its clear is once per session).
- check-v629 (4). Gates: tsc 0, 1091 tests, build, checks 676/0.

### v6.28 — PDF import: the legacy pdf.js build for WKWebView

- Derek's screenshot: "PDF import failed: undefined is not a function
  (near '...value of readableStream...')" — that phrasing is WEBKIT's.
  The modern pdfjs-dist build assumes engine features Tauri's WKWebView
  lacks (ReadableStream async iteration among them). pdfImporter now
  imports `pdfjs-dist/legacy/build/pdf.mjs` AND the legacy worker —
  BOTH must switch together; a modern worker throws the same way off
  the main thread. Same API, transpiled + polyfilled; types resolve
  through the exports map (tsc clean, no shim needed).
- The import pipeline had ZERO end-to-end coverage — how this shipped
  unnoticed. check-v628 (4) drives parsePdfScreenplay on a hand-built
  one-page PDF through the REAL worker: pages, text layer, screenplay
  classification. (True WKWebView behavior is only observable on
  Derek's Mac — the check pins the pipeline and the legacy wiring;
  Chromium runs both builds, so green here + the documented
  legacy-build contract is the case for the fix.)
- Gates: tsc 0, 1091 tests, build, checks 672/0.

### v6.27 — Title tab scales with its window; Asset Manager menu no-op

- Derek (two reports): (1) "the title page tool does not scale with the
  title page window … the info column also has a scroll bar." (2)
  "nothing happens when clicking Asset Manager in the File menu."
- Title tab: NOTHING overrode the modal's `width: min(780px, 96vw)` in
  the Pages tab, so a big window framed a capped box in grey.
  `.fs-modal-as-panel .tp-editor-dialog` now fills the host (dialog
  chrome stripped — the window frame is the chrome). Columns:
  `minmax(400px,460px) minmax(0,1fr)` — the form fits its fields, the
  preview takes the rest and its Fit zoom re-scales (the ResizeObserver
  was already there). The h-scrollbar's cause: BARE `1fr` field tracks
  keep min-content floors (a date input, a long placeholder) —
  `minmax(0,1fr)` lets fields shrink. Narrow hosts stack at <700 (was
  560; the form's new floor would have left a sliver preview between).
  BONUS: the Contact placeholder showed a literal \n — JSX ATTRIBUTE
  strings keep the backslash; it is a JS-string expression now.
- Asset Manager: openTool seated panel-EXCLUDED tools in a panel slot
  the dock refuses to render — invisible, and isToolOpen counted the
  stale slot so the NEXT click toggle-closed nothing. Exactly the
  two-sources bug openTool's own v1.10 comment warns about.
  PANEL_EXCLUDED_IDS ('assets','spelling') LIVES IN editorStore now
  (ToolDock imports + re-exports); openTool floats excluded tools as
  windows and clears any stale slot. Spelling shared the bug (Tools ▸
  Spelling & Grammar ▸ Spell Check Panel).
- check-v627 (8) pins all of it. Gates: tsc 0, 1091 tests, build,
  checks 668/0.


### v6.26 — Title Page: the Contact field is 4 rows

- Derek: one-liner — the tpContact textarea in TitlePageEditor grew
  rows 3 → 4 (matches its own four-line placeholder). No CSS cap on
  .props-textarea, so `rows` is the height. Probe-verified live (74px).

### v6.25 — Goals spacing: the phantom row was DOUBLE bottom padding

- Derek: space below Start/Stop; space before Quick start; "there is a
  whole row at the bottom below the vomit draft row."
- The phantom row: `.fs-goals` padded 12px below the footer AND the
  window body carries the GLOBAL bottom inset (the toolWinPadBottom
  design knob, default 18) — 30px read as an empty row. The pane's own
  bottom padding is GONE (12px 12px 0); the footer sits flush on the
  pane bottom and the global inset is the only gap, same as every
  window's last row. check-v621 pins footerFlush (13 asserts now).
- Spacing: `.fs-goal-toprow` margin-bottom 12; `.fs-goal-quick-label`
  display block + margin-top 16 (covers the Time tab too).
- goals defaultSize h 264 → 400 — the v6.23 layout (top row + quick
  starts + footer) never fit 264 and clipped the footer entirely on a
  fresh install; saved sizes are untouched.
- The footer hairline can LOOK like it stops partway — it is full width
  (measured 604/604); --fd-hairline at 1px on this background is just
  near-invisible. Not a defect; do not "fix" the width.


### v6.24 — Helper Text: areas, on-screen found-in, hide, go-there, line breaks

- Derek (five mid-turn asks): (a) found-in ON SCREEN, not hover; (b) a
  show/hide per row to clear reviewed items; (c) rows ORGANIZED by where
  they're found; (d) a go-there button per row that opens the surface
  WITHOUT closing the window; (e) LINE BREAKS in helper text.
- Areas: the generator stamps `area` per entry (AREA_RULES on source
  paths — ribbon/QAT/menus/context/status/chrome/editor + one area per
  tool window; unmatched → "Everything Else", visible not silent). The
  section renders collapsible area groups, Derek's surfaces first, all
  open by default. NOTE: the Quick Access Toolbar group is legitimately
  ABSENT — its tooltips are computed from the QAT registry, no literals.
- Hidden: `helperTextHidden` (persisted, viewState) — the eye-slash
  hides a row; the "Hidden (N)" chip shows exactly those, each with a
  put-it-back eye. Never data loss.
- Go-there: utils/helperTextDestinations.ts maps the entry's first file
  → openTool(id) / setDesignPanelOpen / openPreferences. Menus, the
  context menu and Customize have NO button — Customize's open flag is
  MenuBar-LOCAL state (no store channel), menus have no programmatic
  open. The row's found-in still names the place.
- Line breaks: the row editor is an auto-growing TEXTAREA (Enter = new
  line, blur commits, Escape reverts; `data-ht-for` targets rows in
  checks — textareas have no value ATTRIBUTE, the old [value=]
  selectors go nowhere). white-space: pre-line on .hover-tip,
  .swn-hint, .fs-nav-empty, .fs-help-pop so breaks render; a
  single-line input's placeholder just runs lines together.
- CHECK TRAP: the row buttons must NOT share .dz-reset — querySelector
  ('.dz-reset') in check-v620 clicked the go-there button. New buttons
  are .ht-iconbtn (styles grouped with .dz-reset in CSS).
- checks: check-v624 (12), check-v620 still 9 (blur-commit now).
- Gates: tsc 0, 1091 tests, build, checks 659/0.


### v6.23 — Goals: ONE Start/Stop top-left; Show in beside it; count quick starts

- Derek: footer was still 2 rows (his screenshot); Start moves to the
  BODY's top-left and becomes Stop while a goal runs; the Header/Footer
  toggle rides that same row aligned right; quick starts for the Words
  and Pages tabs.
- `.fs-goal-toprow` (space-between): ONE `.fs-goal-main` button —
  ▶ Start / ■ Stop / Dismiss (done) — Start fires the ACTIVE tab's
  configured shape (time: for/until; count: reach/relative);
  the per-tab .fs-goal-startrow rows are GONE. progressBlock lost its
  stop button (one control per action); the vomit-locked branch keeps
  its own stop below the block.
- Quick starts (count tabs) launch RELATIVE goals from the current
  position: words [250,500,1000,2000,5000], pages [1,2,3,5,10]
  (baseline captured at click). The footer holds ONLY the Vomit
  checkbox — one row by construction.
- CHECK TRAP: a reach goal the script has already met completes
  INSTANTLY (the button reads Dismiss, not Stop) — aim above the
  current total before asserting Start→Stop. check-v621 (12) pins the
  whole shape.


### v6.22 — Helper Text: its own window, with the control's face on every row

- Derek (items 5–7 of the batch): rows must show WHICH control they
  belong to; the section leaves the Design window for its OWN window
  under Help ▸ Developer; every row shows at once (no cap).
- Window: `HelperTextWindow.tsx` — dz-panel shell (drag by header,
  EdgeResizeZones, portal), own search + kind chips, ALL rows.
  Store flag `helperTextWindowOpen` (designSlice, session-only).
  Menu: Help ▸ Developer ▸ Helper Text… (FaRegEdit). DesignPanel lost
  the group, its filter plumbing and the 'helper-text' collapsed id.
- Row context: the generator captures, per tooltip site, the control's
  ICON component (`<Fa…/<Lu…` — the two packs in use) and/or first
  visible TEXT child from the JSX after the attribute; entries carry
  `icon`/`label`, files stay in `where`. Icons render through the
  GENERATED `src/data/helperTextIcons.ts` (imports exactly the named
  icons — tree-shaking stays honest; regenerated with the catalog).
  388 strings, ~150 with icon/label context; the rest show their source
  file's name. TRAP fixed in the scan: a bare `\b` after the icon-name
  regex also matched the END of the sliced window and minted truncated
  names (FaDotCi, FaR) — the terminator `[\s/>]` is required.
- check-v620 re-pointed at the window (9): menu path opens it — EXACT
  item text there, the Developer parent row's textContent contains the
  whole nested submenu so a substring match clicks the parent — 388
  rows, no cap note, 91 icons, group gone from Design, live tooltip/
  hint overrides, reset, persistence. check-helper-catalog still guards
  drift (regen: node devtools/build-helper-catalog.mjs — writes BOTH
  files now).
- Gates: tsc 0, 1090 tests, build, checks 641/0 (shared run with
  v6.21: +6 check-v621, +3 net as check-v620 grew 6→9).


### v6.21 — Goals: the current total on the Reach rows; one-row footer; Header/Footer

- Derek (items 1–4): the Reach word/page rows carry the script's
  CURRENT total right-aligned (`.fs-goal-nowcount`, margin-left auto,
  tabular-nums — reads `current`, the same source the explainer line
  uses); the footer is ONE row (flex row space-between; the Vomit
  caption tightened to "Vomit Draft Mode", its full sentence is now the
  label's hover text — which the Helper Text editor can edit); the
  placement toggle reads Header / Footer — the STORED value keeps the
  name 'toolbar' (persisted in viewState; renaming it orphans saved
  choices). The header chip already hugged the ribbon's right edge
  (margin-left auto, 12px = the bar's padding) — verified, not changed.
- check-v621 (6) pins: both tabs' totals, right alignment, one-row
  footer, the Header|Footer labels, the chip's right-edge seat.


### v6.20 — the Helper Text editor (Design window)

- Derek: "create a new item in the dev window called 'Helper Text' …
  edit every single piece of helper text in the app … blank lists and
  fields, hover text, helper text for buttons and windows, the ? button
  text." ("Dev window" read as the DESIGN window — the only live
  dev-ish surface since the Dev Picker's v3.25 removal — and said so in
  the delivery.)
- ONE mechanism, keyed by the DEFAULT STRING (`helperTextOverrides` in
  editorStore, persisted via viewState): editing "Delete" retitles
  every Delete tooltip — same-string sites were the same on purpose,
  and per-site ids on 500 call sites would be unmaintainable.
- Delivery paths (utils/helperText.ts):
  (1) `installHelperTextDom()` (App root) — a MutationObserver swaps
  `title`/`placeholder` attributes whose value matches an overridden
  default, remembers the original in `data-ht-orig-*`, converges when
  React writes the literal back, restores on removal. Covers all ~365
  attribute strings with ZERO call-site churn — including TipTap node
  views and portals — and composes with HoverTooltip, which reads the
  same attribute. (2) `ht()`/`useHt()` for RENDERED hints: empty-list
  texts (Navigator, Analytics, Gender, Notes/Snippets, Thesaurus idle),
  the Focus ? popover body, and the ELEMENT HINT map in ScreenplayEditor
  — template-provided placeholders route through ht() too, so the
  Helper Text row never silently loses to the template path.
- Catalog: `devtools/build-helper-catalog.mjs` scans src for
  title=/placeholder= literals and ht('…') calls →
  `src/data/helperTextCatalog.json` (386: 263 tooltips, 102
  placeholders, 21 hints). `check-helper-catalog.mjs` (5) fails the
  suite on drift — regenerate with the build script. The CODE is the
  source; more hints join by wrapping them in ht().
- UI: DesignPanel grows a "Helper Text" collapsed group (search box
  shared with the tokens; kind chips All/Hovers/Fields/Hints; rows show
  a kind badge + the app's own text once overridden + a full-width
  field; per-row reset, section Reset helper text (N); 60-row cap with
  a refine-the-search note). New CSS tail in 26-design-panel.css.
- vitest 4 reminder: jsdom tests need `// @vitest-environment jsdom`
  (helperText.test.tsx, 6 tests — swap/restore/converge/added-nodes).
- check-v620 (6): edit Fullscreen tooltip → live button retitles;
  Design's own search placeholder changes; the empty action's script
  hint shows the override; reset restores; overrides persist in
  viewState.
- Gates: tsc 0, 1090 tests, build, checks 632/0 (+11).


### v6.19 — Thesaurus over the selection + context-menu entry; Analytics header tabs

- Derek (two asks, one ship): (1) "if I already have a word highlighted,
  and then I open the thesaurus tool, it should open with the thesaurus
  info for that word … Add thesaurus as an option in the context menu."
  (2) "move the analytics tab options into the header of the analytics
  window."
- Thesaurus: the follow-the-script effect only listened for
  selectionUpdate/update — the selection the tool OPENED OVER was never
  looked up. One `sync()` at effect setup fixes it (and covers the data
  file finishing after mount, since the effect re-runs when `api`
  lands). Context menu: registry entry `{ id: 'thesaurus', label:
  'Thesaurus', group: 'Tools' }` + a section that `openTool('thesaurus')`s
  — ContextMenuTab picks it up automatically (registry-driven).
- Analytics: `analyticsTab` + setter in editorStore (session memory,
  like goalKind — NOT persisted), `useAnalyticsTabs()` exported from
  AnalyticsTool, `analytics: { useTabs: useAnalyticsTabs }` in
  TOOL_CHROME. The in-body `.fs-analytics-tabs` strip and its CSS are
  GONE (22-tools-extra.css). Narrow windows collapse the header tabs
  into the dropdown via the v6.16 machinery.
- Check-writing traps hit (both selector semantics): Playwright
  `:text-is` attributes exact-text to the DEEPEST element — a
  span-wrapped label (`.ctx-item > span`) never matches on the parent,
  target the span. And header tab buttons are `.tool-chrome-tab`, not
  `.chrome-tab`.
- FALLOUT: check-v606 grabbed the analytics header's CENTER to drag it
  onto a panel — the new tabs sit there now, and a mousedown on a tab
  button is a click, not a drag (5 asserts red). The check grabs
  `.tool-window-title` instead, which is also what a real user drags.
  Any future header-drag check: grab the title, never the center.
- checks: check-v619 (4 — mount lookup, definitions, menu item, menu
  open looks up too), check-v619-analytics (4 — four header tabs, no
  body strip, tab click drives data-show, active mark).
- Gates: tsc 0, 1084 tests, build, checks 621/0 (+8).

### v6.18 — paste fills the active element: action is the schema's fallback

- Derek: pasting with an action active "adds it below the action element,
  which makes the paragraph spacing incorrect." Root cause: SCHEMA ORDER
  decides where ProseMirror puts content with no matching parse rule —
  external-clipboard paragraphs, plain text lines, dropped snippet text —
  and CustomElement registered before Action in ScreenplayEditor's
  extension array. The fallback minted ATTRLESS custom elements (no
  customTypeId → no template rule → wrong margins). `Action` now
  registers FIRST among the block nodes (big comment at the site); the
  old Action slot in the line-1304 list is gone. Empty-doc fill
  (createAndFill) moves from attrless customElement to action too —
  no in-repo callers depended on it.
- What this yields: paste into an empty active action REPLACES it with
  action blocks (both clipboard flavors); caret-mid-text paste merges
  para 1 into the element and continues as action; typed screenplay
  HTML (div[data-type=…]) still parses by its own rules; internal
  copies unchanged. Snippet DROPS (v6.17) now land as action too —
  same fallback.
- Keymap note: Action carries the Tab→character split; registering it
  earlier keeps it ahead of TabHandlerExtension (registered later
  either way), so precedence is unchanged — check-v618 asserts the
  split still works.
- check-v618 (7) pins: plain-text fill, no customElement, no leftover
  empty action, external <p> HTML, mid-text merge, dialogue parse rule,
  Tab from action.
- Gates: tsc 0, 1084 tests, build, checks 613/0 (+7: check-v618).


### v6.17 — a dragged snippet drops its TEXT into the script

- Derek: dragging a snippet into the script inserted
  "0d855902-f95d-4227-b7ce-39e146b8f1e5". The card grip's text/plain
  payload had been the card's UUID since v5.24 — set ONLY to satisfy
  WebKit's no-data-no-drag rule — and text/plain is exactly what
  ProseMirror pastes on an external drop. Nothing ever read the id
  (reorder tracks `dragId` in React state; NotebookTool's readers match
  their own ids and no-op on anything else), so the payload was free.
- `cardDragText(card)` (StickyCard.tsx, exported): snippets carry
  `card.text` VERBATIM (multi-line survives, \n → blocks on drop);
  notes flatten their rich HTML via the shared stripHtml; empty text
  falls back to a single space so WebKit still starts the drag. The
  card SURVIVES the drop (copy, not move).
- Tests: StickyCard.dragText.test.tsx (4 — payload rules; NOTE the
  repo runs vitest 4, where environmentMatchGlobs is dead config: a
  jsdom component test MUST carry `// @vitest-environment jsdom` as its
  first line, which every existing .test.tsx already does). check-v617
  (6) runs the REAL handlers: dragstart on the grip with a fresh
  DataTransfer, the app writes its payload, the same DataTransfer rides
  a drop onto .ProseMirror — text lands, both lines, no UUID, card kept.
- Gates: tsc 0, 1084 tests, build, checks 606/0 (+6: check-v617).

### v6.16 — collapsed tabs expand back; Working Notes menu gone

- Derek: "if the window size is expanded to a point where all of the tabs
  would fit, this drop down is supposed to automatically change into the
  tab format… both a popped out window and a window in the side panel."
  Root cause in `naturalWidth()` (ToolDock.tsx): the docked strip's
  controls span is a flex-GROW spacer (v4.90) — its STRETCHED offsetWidth
  absorbs every free pixel, so `need` tracked the row's width and the fit
  test could never pass once the tabs collapsed. Same self-defeating
  arithmetic v4.91 killed for the auto margin, through the width this
  time. Fix: a grow container's natural width is the SUM of its children
  (the flex-wrap treatment), and an empty grow spacer wants nothing
  (padding + right margin only).
- check-v616 (6/6) pins collapse→expand→collapse in BOTH shapes: left
  panel 250→700→250px (setPanelSizeMode('left','custom') +
  setChromeCustomPx('panelLeft', …)) and floating window 360→900→360px
  (setToolSize). Characters is the fixture — real tabs + a controls
  cluster.
- Derek (mid-ship): the View menu's WORKING NOTES submenu is removed —
  the six Show-…-in-Script checks and Show/Hide All. Store state and the
  tools' own toggles live on; the Annotations submenu right below stays.
  (nativeMenuSync.test still lists the label — it's a sample string for
  the ampersand escape, not a menu reference.)
- Handoff hygiene: §1 had grown to 21 fully-written sections (the cap
  above says 4–5) — v5.77…v6.11 moved verbatim to the archive.
- Gates: tsc 0, 1080 tests, build, checks 600/0 (+6: check-v616).


### v6.15 — Goals: Show in Toolbar/Footer, relative count goals, footer

- WritingGoal grew `mode: 'reach'|'relative'` + `baseline`;
  useGoalProgress measures GROWTH for relative goals (label "N / M kind
  written"). Words/Pages tabs are radio pairs (Reach page:/word: vs
  Finish N Pages / Write N Words); startCount captures baseline=current.
- goalShowIn ('footer' default, persisted) + ONE `GoalChip`
  (GoalsTool.tsx) mounted by StatusBar (footer mode) and the ribbon
  (toolbar mode, `.toolbar-goalchip`, right edge; `useGoalWords(editor)`
  computes words there). NOTE: the status bar's center cluster hides
  during ANY takeover (pre-existing v-old gate) — the footer chip never
  renders in fullscreen; the ribbon chip does.
- Quick start [5,15,30,60,120]; footer row (`.fs-goal-footer`,
  margin-top auto) holds Show in + the Vomit checkbox; the ? helper is
  GONE (GoalsHeaderExtra deleted; goals chrome = useTabs only — the
  ToolControls.order guard therefore iterates one fewer window: 1081→
  1080 tests, explained, not a loss).
- REGRESSION FIX (v6.10 fallout, Derek's screenshot): saved layouts
  carrying b:highlightColor rendered an EMPTY priority block outside the
  Scrapbook → measured as CSS-hidden → the overflow three-dot appeared.
  The token is filtered from the live list unless the Scrapbook is open.
- Gates: tsc 0, 1080 tests, build, checks 594/0.


### v6.14 — Derek's menu reorganization

- Bar: File · Edit · View · Format · Project · Tools · Production · Help
  (Insert REMOVED; Production un-merged from Project — the v3.24 merge
  undone). PROJECT_MENU_GROUPS/TOOL_MENU_GROUPS now hold his exact
  orders; Project tail = Set Draft Number… / Title Page / Custom Page…;
  Tools tail = the S&G submenu (moved from Project) + Thesaurus.
  Production = Revision Mode / Production Tags / Lock Scene Numbers /
  Lock Pages(unreleased-gated). Edit tail = Insert Image… + Insert
  Element (the ex-Insert Element submenu, renamed; Customize Elements…
  rides inside). View leads with Customize… again (v4.86 removed it;
  Derek asked it back — the v6.02 remembered-tab door). Action Rewrite
  ('rewrite') moved into Help ▸ Developer; menu items for
  thesaurus/rewrite pull icon+label from ALL_TOOLS (no second registry).
- checks: v540 walks Project ▸ Custom Page…; v554 asserts Developer ▸
  Action Rewrite.
- Gates: tsc 0, 1081 tests, build, checks 594/0.


### v6.13 — Characters polish: flat list rows, quieter cards, List first

- List view: `.char-view-list .char-profile-card` = no border/background,
  ONE bottom hairline (`--fd-overlay-subtle` — the exact .navigator-scene
  divider). The light-theme card rule scoped to `.char-view-cards`.
- Cards: background = color-mix 5% text over navigator-bg (a lifted
  surface — it MATCHED the window before); outline dimmed 45%→22% (hover
  75%→45%); radius default 6→4 — and the designTokens registry default
  moved WITH it (the token guard test caught the drift: registry and CSS
  fallback are one source, keep them equal).
- View menu order: List above Cards (menu order only; cards stays the
  stored default view).
- Gates: tsc 0, 1081 tests, build, checks 594/0.


### v6.12 — Characters header: Filter everywhere, Sort+Search on Relationships

- Profiles Filter (multi-toggle ControlDropdown, keepOpen): In script
  only / With an image / With a description — applied in the
  allCharacters memo. Store: charFilterInScript/HasImage/HasDesc
  (persisted), setCharFilter.
- Relationships: Filter by rel.type (dynamic list from the data + All
  types), Sort character|type (persisted relSort), Search REUSES
  charSearchQuery (one box, matches either endpoint). ONE processed
  array (visibleRelationships memo in CharacterProfiles) feeds the tab —
  list AND map. Creation writes the unfiltered store.
- Both tabs hold the View/Filter/Sort/Search order (data-ctl guard
  passes). Pre-existing quirk noted while probing: a relationship naming
  a character with no script cue shows placeholder selects (options come
  from script names) — untouched.
- Gates: tsc 0, 1081 tests, build, checks 594/0.


### v6.11 — the Characters list is the shared table

- List view rows render the SAME `.location-header` grid the Scenes and
  Locations tables use — the grid's name track reads a cascading
  `--table-name-w` var so ONE template serves all three
  (`.char-profiles-list` overrides it to `--char-col-name`). Cards view
  untouched; expansion still opens the full inline profile.
- The name column registered as `charName` in sceneColWidths (persisted)
  + COL_LIMITS; CharacterProfiles carries its own grip handler writing
  the same store. The inline Description field writes
  profile.description as PLAIN text (stripHtml projection — an inline
  edit of a previously rich description drops its formatting; the
  expanded editor stays rich).
- Gates: tsc 0, 1081 tests, build, checks 594/0.

### v6.10 — the Highlights tool is retired

- Removed: ALL_TOOLS entry + case + chrome (ToolDock), ToolId member,
  DEFAULT_TOOL_CONFIG/ORDER entries, Tools-menu group entry, the whole
  Format ▸ Highlighting submenu (palette const, pick/jump helpers, the
  hidden color input), HighlightsTool.tsx, its CSS block.
- KEPT deliberately: the `highlight` MARK (saved scripts render); the
  ribbon key 'highlightColor' — it doubles as the Scrapbook's v2.69
  box-background picker, so the script case renders NULL and the
  registry label is now "Box Background (Scrapbook)"; store
  highlightColor state removed (the scrapbook branch is self-contained);
  'b:highlightColor' dropped from the DEFAULT layout only (placed copies
  keep their scrapbook function — no forced migration).
- Probe: no dock row / Tools entry / Format submenu; legacy mark still
  applies and renders.
- Gates: tsc 0, 1081 tests, build, checks 594/0.

### v6.09 — Preview: Script Options + Include Annotations…

- Renames per Derek; the old Include toggles (sections/notes/scene
  numbers/to-dos) are REMOVED: working notes hard-hide in Preview
  (previewOpts keys deleted; ScreenplayEditor's page classes and the
  pagination hide flags treat previewMode as unconditional), and scene
  numbers follow the EDITOR's sceneNumbersVisible (preview page class +
  exportPDF both read it — one source).
- Include Annotations…: previewOpts.annotationIcons (session-only, like
  the other preview opts) + togglePreviewAnnotationIcon. Rows = the
  CURRENT types (markupPresets deduped by icon, MarkupIcon glyph in its
  preset color). MarkupIconLayer's span effect stamps
  `.markup-preview-hidden` (neutralize rule mirrors markup-type-hidden)
  on excluded types while previewMode; the page-level markups-hidden
  class no longer applies in preview. The margin icon layer was already
  preview-gated.
- Gates: tsc 0, 1081 tests, build, checks 594/0.

### v6.08 — big ribbon buttons: one geometry, one hover box

- Derek (screenshots): icon→label distance varied and some big buttons
  hover-highlighted the icon alone. TWO SHAPES existed: one-block
  `.rib-tall-btn` (label inside — commands/tools/customize/lock) vs
  wrapper builtins (`.toolbar-priority-block.rib-tall`) whose label was a
  CSS ::after (own 10px font, outside the inner button's hover box).
- FIX: the wrapper's label is a REAL `.rib-tall-label` child now (one
  class, one knob); the wrapper wears rib-tall-btn's padding/gap and IS
  the hover surface (`--fd-overlay-light`), with the inner control's own
  hover paint turned off; inner `.toolbar-btn`s lose vertical padding so
  the icon zone = the 26px box and the 3px flex gap alone sets the
  distance — measured equal across both shapes incl. the Font Size
  select and popup-hosting builtins (check-v608: 3px everywhere, hover
  box contains the label, no inner solo box).
- Gates: tsc 0, 1081 tests, build, checks 589/0 + v608 5/0.

### v6.07 — the temp window's drag teleport

- Derek: "the hand grabber shoots to the right, off the window."
  `.tool-window-temp` is CSS-centered (left:50% + translateX(-50%));
  startDrag/beginEdgeResize measure baseLeft from the VISUAL rect and
  switch to explicit left/top — but the transform survived, so the first
  move re-applied -50% and the window jumped half its width left, cursor
  parked off its right edge. FIX: both conversions set
  `transform:'none'` (and left/top at drag START, so no first-move
  flash). check-v606 gained the 1:1 tracking assertion (40px for 40px).
- Gates: tsc 0, 1081 tests, build, checks 589/0.

### v6.06 — dropping Analytics on a panel actually docks it

- Derek: drag-drop into the panel left the floating window open (closing
  it by hand then showed the tool docked). ROOT CAUSE: openTool's v1.2
  `ALWAYS_FLOAT` early-out (`['analytics']`) predates the explicit-mode
  machinery — dockInto wrote toolMode='docked' and the early-out floated
  a tempTool anyway. FIX mirrors design's v5.47 rule: the early-out is
  SKIPPED when config.enabled && toolMode==='docked' (an explicit dock
  gesture stands); it falls through to the normal docked open, which
  also clears tempTool. Dragging back out rewrites mode and the
  always-float default resumes.
- check-v606 (new, 6 assertions): real pointer drag of the window header
  onto the right dock — window leaves, inline appears, mode docked, temp
  null; row close/reopen stays docked.
- Gates: tsc 0, 1081 tests, build, checks 588/0.

### v6.05 — the crushed-header fix (chrome-less windows)

- Derek (screenshots: Snippets, Thesaurus): the docked strip's height
  comes from IN-FLOW chrome (tabs/controls); the ⛶/× are pinned out of
  flow (v4.90). No chrome → strip = padding only (9px) and the buttons
  overflowed the body. Swept ALL windows via a measuring probe: five
  crushed (fragments/highlights/aiwriter/thesaurus/workspaces), Focus at
  24px, rest 29px. FIX: `.tool-inline-header` min-height =
  calc(20px + pad-top + pad-bottom + hairline) — knob-aware, so it
  tracks the Design paddings instead of hardcoding 29. Re-swept: every
  window 29px (characters 53 = its legit two-row wrap). Floating-only
  tools (analytics/design/feedback) have title-bearing headers — fine.
- Gates: tsc 0, 1081 tests, build, checks 582/0.

### v6.04 — locations toggle everywhere, the Insert menu diet, two dead-flow fixes

- Map Options = `.locmap-add-btn` (Add Pin's blue); "Location groups"
  subhead → "Other Groups" (3 files). Group left the header for an
  Ungrouped/Grouped pair (`LocationsGroupToggle`, own file — imported by
  SceneNavigator AND LocationMapTab, avoiding the import cycle) in the
  List body's action row and the map's actionbar. `locationRows` grew
  `{grouped}`: ungrouped = one row per script location (still knows its
  place); the rail reads `locationsGrouped`. DEFAULT false → the rail
  now starts split (list unchanged); v578/v585 set/click Grouped first.
- Insert menu: Section/Marker/Note/To-Do List entries REMOVED (tools/
  ribbon keep the features). Custom Page → `AddCustomPageDialog` ("after
  page N of M", 0 = before page 1) → `posAfterScriptPageIn` — the v5.44
  boundary math extracted PURE into pagination.ts, shared with the Pages
  tool's callback so the two doors cannot disagree. ROOT CAUSE of "does
  not actually add": the caret sat in the TITLE region on a fresh doc
  and the node landed where pagination never shows it.
- Armed annotation pick: the mouseup listener moved from editor.view.dom
  to DOCUMENT capture — releasing a selection sweep past the page edge
  never reached the old one ("select text → nothing happens").
- check-v540 drives the dialog now; v578 expects "Other Groups".
- Gates: tsc 0, 1081 tests, build, checks 582/0.

### v6.03 — the Thesaurus is WordNet proper, with definitions

- Derek: "is there a different open source thesaurus tool? … the
  thesaurus should also show the word definitions." MyThes th_en_US_v2
  has NO definitions in the file, so showing them meant a data swap:
  `public/thesaurus/wn_en_31.dat` (20.2MB, 147k lemmas, 207k senses) is
  generated from Princeton WordNet 3.1 (wordnet-db npm tarball) by
  `devtools/build-thesaurus.mjs` — regeneration instructions in its
  header; the artifact is COMMITTED (same precedent as the old .dat).
- Format: MyThes-shaped with a GLOSS as sense field[1] —
  `(pos)|gloss|syn|…|ant (antonym)`. Examples are stripped from glosses
  (a third of the bytes). thesaurus.ts reads field[1] as
  `ThesaurusSense.gloss`; gloss-only senses are KEPT (the definition is
  content); lookup chain/qualifier grammar unchanged. UI: `.thes-def`
  line above the chips per sense.
- check-v553 was pinned to MyThes ("inhabit" as occupy's first synonym)
  — now data-agnostic (captures the first chip, counts dynamically), +
  a definitions assertion. AboutDialog entry → "Princeton WordNet
  lexical database"; public/thesaurus licenses swapped to the WordNet
  3.0 license text (covers 3.1), README rewritten.
- Gates: tsc 0, 1081 tests (2 new), build, checks 581/0.

### v6.02 — Goals tabs go left; Customize finally remembers its tab

- Goals: the Words/Pages/Time buttons were a bespoke `fs-goal-tabs`
  cluster in the CONTROLS slot (right). Now `useGoalTabs()` registers
  them through TOOL_CHROME's useTabs — shared ChromeTabs, left-aligned,
  and in a narrow dock they collapse into the labeled ▾ dropdown like
  every other window (v4.53 two-stage overflow; Derek asked for that
  caret himself in v5.71, so the collapse is expected behavior, not a
  regression). Vomit-lock hides them by returning []. Bespoke CSS gone.
- Customize last-tab memory (Derek: "a long time ago I asked… this has
  never worked"). ROOT CAUSE: every menu door called
  `openCustomize('elements'|…)` and the dialog's open-effect forces any
  passed category — the memory was overwritten on the way in, and
  nothing persisted anyway. FIX: generic doors ('customize' command,
  ribbon button) pass NOTHING; `opendraft:customizeTab` in localStorage
  (beside the v0.84 size key) persists every tab change and seeds the
  dialog. Targeted doors (Customize Themes…/Elements…/Context) still
  steer — and become the new memory. `soloCategory` instances
  (Settings, Guided Setup) neither read nor write it.
- Probe-verified: switch→close→reopen, RELOAD→reopen, targeted→becomes
  memory. No devtools check drives the Customize dialog's tab rail (only
  ribbon-item ids named 'customize'), so no check updates were needed.
- Gates: tsc 0, 1079 tests, build, checks 580/0.

### v6.01 — one leading row: Map · Pin · Group

- Derek: Connect-to-location joins the options row; the three read "Map",
  "Pin", "Group". Built INSIDE LocationPlaceDetails (new `actions` prop):
  the block always opens with `.locmap-detail-actions`, ending in its own
  Group button (`FaLink`, `.locmap-tool-btn`, opens the v5.79 connect
  menu); the rail passes Map/Pin in via `actions`. So the List dropdown
  leads with [Group] and the rail with [Map · Pin · Group] — one row, one
  builder. The old `+ Connect to location` `.locmap-add-field` button is
  gone from under Script Locations.
- NAMING NOTE: the Locations HEADER also has a "Group" control (v5.85's
  list-grouping toggle). Two "Group"s, different jobs — both named by
  Derek (v5.85, v6.01). If he ever flags the collision, the row button is
  the newer naming.
- The rail's Map MENU keeps its "Connect to location…" item — same list,
  two entry points (the standing v5.79 pattern).
- checks: v578/v581/v585 rail-button selectors →
  `.locmap-detail-actions button:text-is("Map"|"Pin")`; v585 asserts the
  row order [Map, Pin, Group], the block-owns-the-row structure, and that
  no "+ Connect to location" button remains. The map SURFACE's
  `.locmap-mapopts-btn` ("Map Options" beside + Add Pin, Derek's v5.90
  naming) is deliberately UNTOUCHED.
- Gates: tsc 0, 1079 tests, build, checks 580/0.

### v6.00 — the rail's expanded rows carry the List view's details block

- Derek: "the drop down info for each item in the location list view
  should be in the side panel info of the location map view." The rail's
  expanded detail now renders `LocationPlaceDetails` under the Map/Pin
  Options buttons — the SAME component the List view's dropdowns render
  (v5.96's extraction pays off: one block, two homes, cannot drift). New
  `allLocations` prop threaded rail-ward from all three render sites
  (SceneNavigator standalone, LocationMapTab, ToolDock's
  FullscreenMapRailPanel — which passes its `all` memo) so "apply to all
  locations" means ALL, not the filtered view.
- Deliberately NOT included: the List dropdown's Rename Location button.
  It needs the `editor` instance and renames ONE script location — a rail
  row can stand for a whole group, so "rename" is ambiguous there. Told
  Derek; List view keeps it.
- check-v585: the old `#4 body holds ONLY the buttons` assertion (v5.96's
  moved-to-the-panel rule) is REWRITTEN to assert
  `[locmap-detail-actions, locplace-details]`, + a fullscreen-panel
  textarea assertion.
- Gates: tsc 0, 1079 tests, build, checks 578/0.

### v5.99 — the fullscreen map's rail hangs under the Locations ROW

- Derek (screenshot): the v5.97 side-panel rail was hardcoded to the LEFT
  dock; his Locations window docks RIGHT. Fix: `FullscreenMapRailPanel`
  renders inside ToolDock's rows loop, directly under the
  `t.id === 'locations'` row — rows are side-filtered, so the panel lands
  in whichever dock holds the tool. Its internal "Locations" header is
  GONE; the row above is the label. Gate: `fsTool === 'locations' &&
  locationsTabNow === 'map'`.
- Why the dock renders the panel itself instead of auto-docking the tool
  scrapbook-style: measured in v5.97 — `setActiveTool` on a panel slot
  CLEARS fullscreenTool. Direct render = no store writes, and the panel
  leaves with fullscreen.
- check-v585 `#v599` pins it: `.locmap-rail-panel`'s
  `previousElementSibling` is `[data-tool-row="locations"]`, and the
  panel holds no `.tool-inline-header`.
- NOTE: v5.80–v5.98 have no sections here (fast-batch era) —
  `changelog.json` is the per-version record for that stretch.
- Gates: tsc 0, 1079 tests, build, checks 577/0.

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


New arrivals from HANDOFF-CONTINUE.md §1 are inserted at the TOP of this list.

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

### v5.70 — "…all types" labels + the Navigator filter's Reset

- Derek: (1) "make it clear that 'Show all' and 'Hide all' apply to the
  annotation types only" — renamed IN TypeGridSection ("Show all types" /
  "Hide all types"), so both doors (Navigator filter, Annotations
  window's filter) say it. (2) "add a button to the navigator filter
  menu called 'Reset'… resets everything back to the default options" —
  a divider row at the menu's foot; onClick writes
  EMPTY_NAV_SCENE_FILTERS + EMPTY_MARKUP_FILTERS — the SAME constants
  the store initializes from, so "default" cannot drift from a fresh
  session. Navigator-only (the ask named that menu); the annotation half
  is the shared markupFilters, so Reset also resets the Annotations
  panel/ribbon view — v5.46's one-filter design, working as intended.
- check-v570 8/8 (labels in both doors, all five controls dirtied →
  chip 5 → Reset → store defaults, visible control states, chip gone,
  no Reset added elsewhere). Gates: tsc 0, 933 tests, build.


### v5.69 — the type grid rides one row with "Type:"

- Derek (screenshot of the v5.68 pop): "change 'annotation types' to
  'Type:' show the buttons after that, so the format matches the rest of
  the window." Changed INSIDE TypeGridSection (MarkupPickers.tsx), so
  every door — the Navigator filter pop AND the Annotations window's
  filter — reformats together; nothing forked.
- The "Annotation Types:" caption line + full-width 6-column grid became
  a statusrow-format row: "Type:" label, then the buttons. Scoped CSS
  (.markup-filter-typerow .markup-filter-grid) turns the grid into a
  wrapping flex in the row's remaining width (base 3px gap still
  applies; extra types wrap under). The "No annotations yet." empty
  state sits inline on the row too. Show all / Hide all row unchanged.
- check-v569 9/9: label text, old caption gone, and a GEOMETRY proof
  (label/buttons rects overlap vertically, buttons start right of the
  label) in three states — Navigator empty, Navigator with a type,
  Annotations window. Gates: tsc 0, 933 tests, build.


### v5.68 — Navigator filter: the Scene Headings section

- Derek (verbatim): "in the navigator filter window, change Filter
  Annotations to 'Annotations'. Above that, add a new section in the
  filter called 'Scene Headings'. the filter options should be INT. or
  EXT., location, Contains X (type in a word or words)."
- ONE predicate — utils/sceneFilters.navSceneHeadingMatch — serves the
  chrome chip and the body's row test (NavSceneFilters {intExt,
  location, contains}; EMPTY_NAV_SCENE_FILTERS; ephemeral in
  sceneNavSlice like navFilter). INT/EXT reads the PREFIX the
  Locations-window way: "has this kind", so INT./EXT. compounds pass
  both. Location is an EXACT match on parseHeading().location —
  time words strip, sub-places stay ("SPACE CARRIER - BRIDGE" is one
  location, identical to the Locations window's grouping). Contains is
  a case-blind substring over the whole heading; whitespace = inactive.
- The pop: Scene Headings title, INT./EXT. as a markup-seg segment (the
  Status toggle's classes — one look for one idea), a native Location
  select fed by sceneHeadingLocations(s.scenes headings — live because
  'navigator' is in SCENES_READERS), a Contains text field; then the
  "Annotations" title (renamed) over the untouched TypeGridSection.
  Chip = annotation filters + countActiveNavSceneFilters. Scene filters
  gate ONLY kind==='scene' rows — annotations/notes/acts keep their own
  filters (the View-menu independence rule).
- Gates: tsc 0, 933 tests (+7 predicate/count/locations — fixture
  lesson: 'EXT. SPACE - BELKADAN' parses location 'SPACE - BELKADAN',
  only TIME WORDS strip after a dash), build, check-v568 10/10 (titles
  renamed/ordered, EXT/INT rows, dropdown lists all 4 locations,
  location narrows, chip=2 stacked, contains, clear restores).


### v5.67 — Pages window tabs: Script / Title Page / Custom

- Derek ("in the page window, add three tabs to the header…"): the Pages
  window's chrome carries Script / Title Page / Custom via the SAME
  useTabs slot Characters uses (usePagesTabs in SceneNavigator.tsx;
  TOOL_CHROME.pages). Narrow dock ⇒ the v4.53 collapse-to-"Section"-
  dropdown, by design. pagesTab persists in viewState (charActiveTab
  precedent). PagesControls (# goto + search) null off the Script tab —
  the hooks-above-early-return rule applies.
- SCRIPT tab = script pages only (customs filtered out; the title count
  publishes the script-page count). CUSTOM tab = the custom pages with
  + Add Custom Page (the v5.44 two-item dropdown died — its other item
  is the tab beside it), ⋮ Move/Delete, drag-to-reorder, and a position
  note on each thumb: customPagePosLabel reads v5.40's numbering (a
  custom page CARRIES the next script page's number) as "before page
  N", one past the last script page as "end of script" (pure, tested in
  pagesMatching.test.ts).
- TITLE PAGE tab hosts TitlePagePanel — ONE TitlePageEditor behind the
  modal door and the tab (no fork). Apply/Cancel → back to Script.
  fs-tp-narrow (host ResizeObserver, <560px) stacks the editor's two
  columns — the stack rules mirror the mobile @media 720 block in
  06-editor-content.css and are commented to stay in LOCKSTEP; @media
  reads the screen, this reads the HOST (a dock column ≈ 277px).
- THE STANDALONE TOOL IS RETIRED (the todo/indexcards drill, every
  surface): out of ALL_TOOLS / WINDOW_IDS / DEFAULT_TOOL_CONFIG /
  DEFAULT_TOOL_ORDER; FULLSCREEN_ONLY_TOOLS is now EMPTY (machinery
  kept); RETIRED_TOOL_IDS += titlepage→pages and is EXPORTED — the
  workspaces activeTool remap reads the map instead of hardcoding
  'indexcards' (todo snapshots heal too); openTool('titlepage') remaps
  + defers pagesTab='title' (the indexcards setTimeout pattern);
  Project ▸ Title Page sets the tab explicitly THEN opens Pages (no
  Script flash). A titlepage workspace reopens Pages on the tab.
  ToolContent's onClose prop retired (its one reader was the hosted
  modal). CSS: .fs-modal-as-panel-fixed deleted (one consumer, gone).
  toolModeMemory.test updated: the retired id opens Pages, NO takeover
  (the old v5.21 fullscreen-only pin was the replaced behavior).
- LATENT after this: ToolDef.fixedSize/neverDock have no members;
  .tool-window-fixed CSS pairs with fixedSize. Kept as typed frame
  machinery — flag for a future dead-CSS pass.
- Gates: tsc 0, 926 tests (+6: titlepage migrations, customPagePosLabel),
  build, check-v567 12/12 (tabs strip+dropdown forms, dock row gone,
  script-only grid, custom add/position note, narrow 1-col vs
  fullscreen 2-col, Cancel→Script, menu lands on the tab).


### v5.66 — Focus tool: ? in the header + Design-window layout knobs

- Derek ("moving to the focus tool"): (1) the "?" moved from the master
  row to the window header — FocusHeaderControls exported from
  TypewriterTool.tsx into TOOL_CHROME (same portalled .fs-help-pop,
  positioned from the header button; pointerdown stopPropagation for the
  drag handle). (2) A 'Focus Tool' Design group: focusPad (side padding,
  12), focusRowGap (8 — toggle gaps, the rest-block, subgroup gap),
  focusSectionGap/Below (6/10 — subgroup vertical margins), focusIndent
  (14 — subgroup padding-left). Defs === CSS fallbacks (the contract
  test).
- TRAP HIT AND WORTH REMEMBERING: .fs-typewriter-section and
  .fs-typewriter-sub looked like the obvious binding targets but are
  DEAD CSS (pre-v1.77 slim-down; nothing renders them) — the no-dead-
  knobs TEST passed anyway because it only checks the var is read in
  CSS, not that the RULE is alive in the DOM. First wiring shipped dead
  sliders; the driver's computed-style probe caught it (nulls). Both
  dead rule sets deleted; tokens re-bound to the live
  .fs-typewriter-subgroup. Lesson: bind tokens to classes you've seen
  in the RENDERED DOM, and always drive the knob in the driver.
- Gates: tsc 0, 920 tests (29 token-contract incl. the new group),
  build, check-v566 8/8 (header ?, popover open/Escape, three knobs
  moving real computed styles, reset, Design group listed). SEVENTH
  rollback at batch start (standing recovery).


### v5.65 — the mid-heading caret jump (uppercase plugin, since v3.45)

- Derek's repro: changing "EXT. SPACE CARRIER - BELKADIN" to CRUISER —
  "my cursor would jump to the end of the scene header after every
  single letter typed." ROOT CAUSE in SceneHeading.ts's uppercase
  appendTransaction: it replaced the WHOLE heading text node whenever
  any character differed, and its comment's claim that same-length
  replacement leaves the "selection untouched" is FALSE — a caret
  strictly INSIDE a replaced range maps to the range's END. Appending
  at the end never showed it (the caret sits on the boundary), which
  is how it survived since v3.45. LESSON for the footgun list:
  length-preserving ≠ selection-preserving; a caret inside any
  replaced range maps to its end — replace only what changed.
- Fix: replace only the DIFFERING RUNS (per-char scan inside the text
  node) — a typed lowercase letter becomes a one-char replacement whose
  boundary the caret sits on, which maps to itself. Still same-length
  ⇒ the batch stays position-safe; v3.54's preventUpdate guard and
  addToHistory:false untouched.
- Proven red→green: the new caret test FAILED against the old code
  (caret at heading end), passes now. check-v565 3/3 drives REAL
  keystrokes through the view (types "ruiser" mid-heading → CRUISER in
  place, head advances letter by letter). Gates: tsc 0, 920 tests,
  build. (SIXTH sandbox rollback at batch start — standing recovery:
  reset + npm install + Vite; cargo untouched this batch so GTK libs
  not needed.)


### v5.64 — Rerun-with-note + the shared-language prompt rule

- Derek: all three suggestions once contained "their fingers drummed on
  the control panel"; he wants (a) a rerun with "do not use the phrase
  X" and (b) a rule against variants sharing language.
- (a) RERUN: the note field was ALWAYS the right channel for negative
  steers — what was missing was targeting. A Rerun button (results bar,
  left of Dismiss) re-runs the SAME passage via resolveEditorRange
  (explicit range → indices → resolveSelection; context re-gathered
  fresh) against the mapped targetRef, validated by targetIsCurrent
  (stale → falls back to the live selection). Enter in the note field
  reruns while results are up (suggests otherwise). suggest/rerun share
  runRequest; a rerun dismisses the superseded event (log semantics
  hold). The note survives a rerun (same target = overlap = v5.62 keeps
  it).
- (b) PROMPT (Derek-sanctioned craft edit): "Variants must not share
  language" added to # The three variants — a phrase of the MODEL'S
  invention may appear in only one variant; wording carried from the
  writer's original may repeat where a beat survives. Prose kept
  dash-free (the prompt discipline); cache re-writes once.
- FIFTH SANDBOX ROLLBACK hit at this batch's start — worst yet: local
  HEAD AND the origin ref were back at the ancient 7febeb7 while the
  true origin held v5.63 (everything pushed = nothing lost). Recovery
  additions to the standing drill: node_modules gutted (TS2307 on
  @tiptap/extension-link → npm install) AND the apt-installed GTK libs
  were wiped — re-run `apt-get update && apt-get install -y libgtk-3-dev
  libwebkit2gtk-4.1-dev` before trusting cargo check.
- Gates: cargo check, tsc 0, 917 tests (resolveEditorRange holds the
  range against a wandering caret + carries the note), build,
  check-v564 4/4 (rule present, scoped, dash-free; targeting live).


### v5.63 — the cards speak the app's visual language (dark block = editable)

- Derek (screenshot): "in almost all other windows, dark blocks are
  editable text blocks… so the Faithful/Compressed/Reimagined/Yours
  title blocks look like they are the editable fields. I tried clicking
  on 'Yours' thinking thats where I was supposed to type." The v5.59
  cards had it INVERTED: dark header bars (read as inputs) over
  borderless transparent textareas (read as static text).
- Fix, pure CSS: headers are plain text (no background/border); the
  draft textareas wear the standard input dress — var(--fd-input-bg) +
  var(--fd-border) 1px + radius, accent border on focus — the SAME as
  .rw-note/.thes-input. Card frames/dividers dropped; cards separate by
  spacing. The grow mirror carries the border THICKNESS but not its
  color (a `border: 1px solid transparent` shorthand in the shared rule
  initially clobbered the field's color at equal specificity — split
  into border-width/style shared + per-element color).
- check-v563 5/5 asserts the CONTRACT, not pixels: header bg transparent;
  the draft field's computed background AND border EQUAL the note
  field's; focus flips accent; grow stays exact with the border. Gates:
  tsc 0, 916 tests, build.


### v5.62 — the note clears on a NEW target (disjoint-range rule)

- Derek: "delete the text in the context/intent text field when a new set
  of text is highlighted." Rule chosen: the note clears when the live
  target resolves DISJOINT from the last ok-target (lastOkTargetRef,
  overlap test in the debounced sync). Deliberately NOT position-equality:
  positions drift as you type inside the passage — an equality rule would
  wipe the note mid-thought on every keystroke or on clicking back into
  the same paragraph. Overlap = same working area = keep; disjoint = new
  text = clear. Focusing the field itself never clears (no editor
  selectionUpdate fires).
- check-v562 4/4 (written → kept within passage → cleared on a different
  paragraph → survives field focus). Gates: tsc 0, 916 tests, build.


### v5.61 — full-length suggestion cards, ONE scroll

- Derek: "show the text of all three suggestions in their full length…
  i just want one scroll for the whole tool." The v5.59 textareas capped
  at rows 9 (and counted only \n — soft-wrapped lines overflowed even
  sooner), so long variants scrolled inside their cards inside the
  scrolling body.
- Fix: the grid replicated-content trick — `.rw-grow` wraps each
  textarea; its ::after mirrors data-value (same font/padding/pre-wrap
  box, hidden) and defines the cell height, the textarea stretches to
  match (grid-area 1/1 both). Pure CSS: no JS measuring, re-wraps
  automatically when the panel resizes. data-value carries a trailing
  \n so the last empty line counts. `overflow: hidden; resize: none` on
  the textarea; the beat list's max-height/scroll removed too —
  `.rw-body` is the ONLY scroll.
- Driver technique worth keeping (check-v561): the results UI needs the
  API, but the MECHANISM was probed in-page against the real
  stylesheet — inject the .rw-grow structure, long text → 416px tall
  with scrollHeight == clientHeight (no inner scroll), short text →
  56px. Verifies the CSS contract without a live request.
- Gates: tsc 0, 916 tests, build, check-v561 5/5.

### v5.60 — the rewrite target stays PAINTED (blur-proof), + the declutter eye

- Derek's bug: "if i click into the context text field, or if I open the
  ai tool and it is popped out, my selected text on screen gets
  unselected." ROOT CAUSE: the PM selection state SURVIVES the blur —
  WebKit just stops painting the native contenteditable selection when
  focus moves into the panel. Nothing was collapsing state (driver
  proved from/to identical through note-field focus AND a floating
  open). The missing piece was the design handoff's own
  highlight(resolved.target), never built.
- FIX: editor/extensions/RewriteTarget.ts — a decoration plugin
  (meta-only transactions via setRewriteTargetHighlight; the pagination
  plugin correctly ignores them). Pre-request the highlight follows the
  debounced live resolve; suggest() freezes it on the captured range;
  the plugin maps itself through edits with the SAME biases as the
  panel's targetRef (map(from,1)/map(to,-1)); cleared on accept/off-
  action caret/unmount. Registered in ScreenplayEditor's extension list;
  .rw-target-hl in 29-rewrite.css. BONUS Derek will feel: it paints the
  CLAMPED range (whole action paragraphs) — truer than the native
  selection ever was.
- DECLUTTER (Derek, same turn: "the same button & functionality found in
  the scrapbook"): RewriteHeaderControls (chrome Controls slot) reuses
  the .fs-nb-declutter eye classes; settingsStore.rewriteExclusive
  (persisted, own key 'opendraft:rewriteExclusive'); ToolDock's
  scrapbookSolo generalized to soloId ('notebook' wins if both claim);
  the outline bar drops too (ScreenplayEditor, render-time only).
  isToolOpen('rewrite') is the one "open" answer (docked/floating/
  fullscreen alike).
- Gates: tsc 0, 916 tests (3 new: decoration paints/clears, maps
  through prior edits, dies with a consumed range), build, check-v560
  9/9 (selection + paint survive note-field focus and a floating open;
  caret-off clears; declutter hides/restores both sidebars exactly).

### v5.59 — Action Rewrite v4: editable drafts + linter, the Yours slot + beats, the LOG + calibration loop

- Derek's FOURTH design-chat drop, the big one (two NEW files:
  rewrite_log.rs + scripts/harvest-calibration.mjs). Everything diffed
  against drop 3 before applying; docs/ACTION-REWRITE.md §Decisions is
  current — READ IT FIRST, the following are its headlines.
- THE LOG IS THE IMPROVEMENT MECHANISM ("most likely to be treated as
  optional — it isn't"): append-only JSONL in the app data dir
  (rewrite-log.jsonl), suggestion + outcome records sharing an eventId
  (rewrite_action_lines now takes AppHandle and returns event_id, logs
  variants/context flags/latency/token usage incl. cache reads). EVERY
  suggestion needs an outcome: the panel reports accepted (finalText
  AFTER panel edits + editKind + composedFrom) or dismissed — on
  Dismiss, on a superseding request, and on unmount
  (pendingEventRef). recordRewriteOutcome swallows its own errors.
  Local-only; Activity log footer = stats/path/Clear.
- EDITABLE DRAFTS: variants render as textareas (prepareDrafts →
  VariantDraft {offered — never mutated, draft}); Revert when
  isDirty; classifyEdit(offered, final) = none/punctuation/minor/
  substantive via word-LCS (punctuation must NOT outrank clean accepts
  in harvest); acceptDraftInEditor = validate + apply + record in ONE
  step (PM port of their acceptDraft), then the results CLOSE (applied
  state, ⌘Z undoes) — replaced v5.54's swap-variants-after-apply.
- lintActionText: advisory craft check on every draft keystroke
  (dashes, we-see, camera, interiority verbs, begins-to/progressive,
  long paragraphs, caps count, repeated beats). NEVER blocks.
- THE YOURS SLOT (4th card; "many times I wish I could use parts of
  all three"): sentence-level beats from the other three
  (allBeats/appendBeatToCustom — a trailing ¶ break must SURVIVE the
  next append, their one dev regression, unit-tested), seedCustom from
  original/any variant, logs editKind 'composed' + composedFrom (stats
  report per-variant 'contributed'). NO fifth model variant — the
  license axis is fully covered; reasoning recorded in the doc.
- HARVEST (manual, never automated): node scripts/harvest-calibration.mjs
  --log <path> [--stats] → reviewed markdown for the prompt's
  <!-- BEGIN WRITER CALIBRATION --> block (prompt v4 verbatim, block
  empty on purpose; composed ranks first, then REWRITTEN; torn last
  line tolerated). Ten of Derek's own pairs = the highest-leverage
  improvement; unreviewed output never becomes an exemplar.
- Gates: cargo check, tsc 0, 913 tests (classify 6-case, lint, drafts,
  beats-break regression, seed provenance), build, check-v559 8/8
  (harvest end-to-end on a synthetic log incl. torn line + stats
  contributions; panel regression).

### v5.58 — Action Rewrite v3: the writer's NOTE replaces the steer enum

- Derek's THIRD design-chat drop ("another update"), diffed against the
  second before applying. The steer enum is GONE (tighten too — compressed
  already covers it; the obvious "improvement" is re-adding the dropdown,
  DON'T). In its place: `writerNote`, optional free text ≤300 chars — the
  two things no rule can infer: what the beat is FOR and which detail must
  SURVIVE. Four prompt guards (first is load-bearing): never overrides a
  hard rule (a feeling request is answered with behavior); a named detail
  survives in ALL variants incl. compressed; cannot authorize new story;
  never quoted into the script.
- Wire shape: request field writer_note/writerNote (distinct from
  RewriteVariant.note, the model's explanation, opposite direction);
  Rust clean_note flattens whitespace to one line (a multi-line note
  can't fake a labelled context section) + chars().take cap (multi-byte
  safe); sent LAST in the user turn. Cap enforced BOTH ends
  (MAX_WRITER_NOTE TS / MAX_NOTE_CHARS Rust — the command is callable
  without the panel).
- Panel: single-line note field + live counter (shows once non-empty,
  flags at 300), teaching placeholder "What's this beat for? Anything
  that must stay?"; Enter submits. Prompt v3 verbatim;
  docs/ACTION-REWRITE.md updated incl. 4 new desktop verification steps
  (the feeling-request guard is the one most likely to fail).
- Gates: cargo check, tsc 0, 909 tests (writerNote trim/cap/empty test),
  build, check-v558 4/4.

### v5.57 — Action Rewrite v2: faithful/compressed/reimagined, tighten-only steer, native dash rule

- Derek's SECOND design-chat drop ("update the ai tool with this info") —
  a revised handoff superseding the v5.54 package. Every delta diffed
  against the first drop before applying. docs/ACTION-REWRITE.md updated;
  read it before touching the feature.
- THE VARIANT MODEL CHANGED (the big one): cut/sharpen/restructure →
  faithful / compressed / reimagined. Rationale (preserved in the doc):
  sharpen was a deliberate under-application — the writer should never
  pick between a correct rewrite and a half-correct one. All three now
  apply every rule in full and differ by LICENSE taken with the writer's
  shape. Rust rank order: faithful, compressed, reimagined (least license
  first). Prompt v2 copied VERBATIM.
- Steer reduced to ONLY tighten (visual/verbs/plain asked for what the
  hard rules already require — no observable change). INTENT_LABELS is
  the single source: the panel select updated itself with zero component
  edits.
- The no-em-dash rule is NATIVE to the v2 prompt now (hard rule 8 — also
  en dashes and -- as punctuation; compound-word hyphens protected),
  superseding v5.56's rule 13. The prompt's own prose is deliberately
  dash-free (models mimic prompt punctuation); keep it that way when
  editing. -- ban came from the design side, resolving the question
  v5.56 left open.
- Cache policy documented (second handoff §6): stay on the 5-minute TTL;
  break-even ~0.28 reads; an isolated rewrite costing 1.25x is the design
  working — do not "fix" idle-gap cache misses; if rewrites prove
  isolated, drop caching rather than reach for the 1-hour tier.
- KEPT deliberately: our keychain service com.freedraft.app (their v2
  says com.derek.scriptcraft + "confirm it matches" — ours IS the real
  bundle id, and Derek's key already lives under it; changing the
  service would orphan his saved key. Keychain coordinates are persisted
  identifiers).
- Gates: cargo check, tsc 0, 908 tests, build, check-v557 2/2 (steer
  pair, targeting regression).

### v5.56 — Action Rewrite prompt: Derek's no-em-dash rule

- Derek confirmed the API path works on his Mac, then: "add a rule to the
  suggestions: Dont use em dash". Hard rule 13 added to
  src-tauri/prompts/action_line_rewrite.md (variant text never contains
  an em dash; break the sentence or use comma/colon/ellipsis). This is
  the SANCTIONED kind of prompt edit — Derek asking is exactly the
  condition the design handoff set; keep honoring that rule.
- Mechanics to remember: the prompt is include_str!'d, so a prompt edit
  is a RUST change — cargo check here, quick incremental rebuild on his
  next launch, and the prompt cache re-writes once (pennies). The
  screenplay interruption dash (--) is deliberately untouched; ban it
  too only if Derek asks. No output post-processing was added — the
  prompt is the enforcement point; revisit only if he reports leaks.

### v5.55 — npm run desktop self-heals the Cargo.lock pull collision

- Derek's launch failed live: `git pull` aborted with "Your local changes
  to src-tauri/Cargo.lock would be overwritten by merge". Cause: his
  `tauri dev` runs rewrite the generated lockfile locally (cargo version
  skew re-resolves it), and v5.54 was the first push in ages to also
  change it. Fix: the desktop script now runs
  `git restore src-tauri/Cargo.lock 2>/dev/null;` BEFORE the pull chain —
  surgical (that one generated file only), and the `&&` chain after it is
  untouched so a failed pull still blocks the launch. One-time manual
  unblock (the fixed script arrives via the very pull that was blocked):
  `git restore src-tauri/Cargo.lock && npm run desktop`. CLAUDE.md §3 and
  §0 here updated to describe the new script.
- RECURRENCE NOTE for future Rust batches: any push touching Cargo.toml/
  Cargo.lock would have re-hit this on every Mac pull; the self-heal ends
  the class. Never gitignore Cargo.lock (app lockfiles are canonical and
  cargo check here depends on it).

### v5.54 — ACTION REWRITE: Derek's design-handoff integrated (Rust API call + keychain, PM adaptation)

- Derek uploaded a zip from a DESIGN CHAT (HANDOFF.md + system prompt +
  rewrite.rs + a flat-model actionRewrite.ts): "use these files from a
  different chat to create an action line improvement tool." Feature:
  select action lines → three craft-guided rewrites (cut / sharpen /
  restructure), each with a teaching note; dialogue untouched.
  docs/ACTION-REWRITE.md now carries the handoff's rationale + Derek's
  desktop verification checklist — READ IT before touching this feature;
  its decisions are deliberate (temperature 1.0, include_str! prompt,
  already_strong softening, three-strategies contract).
- RUST (first Rust this project ships beyond upstream): rewrite.rs =
  4 tauri commands (rewrite_action_lines, save/has/clear_api_key);
  system prompt include_str!'d from src-tauri/prompts/ (VERBATIM from
  the handoff — it is the product, don't rewrite its craft content);
  BYO Anthropic key in the OS keychain (service com.freedraft.app —
  the persisted bundle id), read Rust-side per request, NEVER the
  webview. keyring v3 dep gated to desktop targets; mobile compiles
  keyless stubs. reqwest body serialized by hand (this repo's reqwest
  lacks the json feature — kept it that way). Model claude-sonnet-5,
  opus is a one-line swap.
- SANDBOX CAN CARGO CHECK NOW: apt-get install libgtk-3-dev
  libwebkit2gtk-4.1-dev (after apt-get update) makes `cargo check`
  pass on the Linux host (~58s cold). Derek's `npm run desktop` runs
  `tauri dev` = compiles Rust on HIS machine — NEVER push Rust
  unchecked. macOS cross-check is impossible here (objc2 needs a mac
  cc); the Linux check + keyring's documented feature set is the gate.
- FRONTEND (the handoff's §5 answered — flat model → ProseMirror):
  utils/actionRewrite.ts = projectScript (top-level walk, sceneHeading→
  scene_heading, recurses dualDialogue columns, elements carry PM
  spans), the handoff's pure context helpers UNCHANGED (clamp-to-action,
  scene-boundary stops, locationEstablished, firstAppearances, dialogue
  lookback), resolveEditorSelection (PM selection → indices → pmTarget
  {from,to,text}), targetIsCurrent (textBetween equality — the stale
  guard), applyVariantToEditor (insertContentAt, retargets onto the
  insert so variant B replaces variant A; undo = history), invoke
  wrappers isTauri-guarded (browser build: hasApiKey false, calls throw
  the desktop-only message).
- RewriteTool.tsx: key setup card (BYO key → keychain; Change/Remove in
  a footer), intent select (No steer/Tighten/More visual/Stronger
  verbs/Plainer), live target line ("Target: N action paragraphs" /
  clamp notice / refusal reason — never a silent dead button), three
  variant cards (label + blurb + Courier text + note + Use),
  already_strong banner softens, stale banner blocks Use after
  conflicting edits (positions remapped via transaction mapping
  map(from,1)/map(to,-1)). Registered: ToolId 'rewrite', right panel,
  ALL_TOOLS (FaMagic, 360×520, group 3), Tools menu, 29-rewrite.css.
  About list credits keyring-rs. AI Writer (the joke) untouched.
- Tests: 13 new in actionRewrite.test.ts against a REAL TipTap editor
  (the Dialogue.test.ts harness pattern) — projection spans (textBetween
  agreement), dual-dialogue nesting, clamping, context fields, scene
  boundaries, established location, first appearances, apply+retarget+
  swap, stale refusal (908 total). check-v554: 6 green in the browser
  build (desktop-only notice + disabled button, intent options, 1-para
  target, clamp notice, refusal reason, Tools menu row).
- NOT VERIFIABLE HERE: the live API call + keychain round-trip — Derek's
  8-step checklist is in docs/ACTION-REWRITE.md (incl. the prompt-cache
  check: second request must show cache_read, not cache_creation).
- QUEUED NEXT (in order):
  1. PAGES WINDOW TABS restructure (Script / Title Page / Custom; the
     separate Title Page tool leaves the side panels).
  2. NAVIGATOR FILTER (Derek, mid-v5.54, verbatim): "in the navigator
     filter window, change Filter Annotations to 'Annotations'. Above
     that, add a new section in the filter called 'Scene Headings'. the
     filter options should be INT. or EXT., location, Contains X (type
     in a word or words)".

### v5.53 — the THESAURUS tool: local MyThes/WordNet data, caret-follow, replace-in-place

- Derek: "Add a thesaurus tool. Find an open source thesaurus resource
  online… The code should be local, don't connect to an external app or
  server."
- DATA: MyThes en_US (th_en_US_v2.dat, 18.5 MB, UTF-8, ~146k head words)
  — the WordNet-derived thesaurus LibreOffice ships — fetched VERBATIM
  from github.com/LibreOffice/dictionaries (en/) into
  frontend/public/thesaurus/ with WordNet_license.txt + license.txt +
  a provenance README. Bundled asset, fetched same-origin at first tool
  open; NO runtime network (deliberately unlike languageCatalog's CDN
  fetch, which remains a release blocker). The upstream .idx is NOT
  shipped — the loader derives the index in one pass.
- utils/thesaurus.ts: the file stays ONE string; buildThesaurusIndex maps
  head word → char offset (head lines say how many sense lines to skip);
  readThesaurusEntry parses on demand. Qualifier grammar audited over the
  whole file: (generic term)/(similar term)/(related term) strip,
  (antonym) becomes a flag. lookupCandidates: exact → lower → suffix
  fallbacks ORDERED so "hoping"→hope beats hop, running→run,
  stopped→stop, cities→city. wordAt (caret word, edge-punctuation
  trimmed) + matchCase (WALK→AMBLE, Walk→Amble) are pure and tested
  (15 new unit tests → 895).
- ThesaurusTool.tsx: search row (Back + input + go); follows the script
  caret via debounced selectionUpdate/update (250ms) — caret word looks
  up + becomes the replace TARGET ("In script: word"); chips = word
  button (chain lookup, Back retraces) + ⇄ replace (only when targeted;
  validates doc.textBetween(from,to)===word before writing, toast if the
  script moved; matchCase dresses the replacement; after replace the
  tool follows onto the new word). Antonyms: dashed chips on an "ant."
  row per sense. Loading/miss/fallback states all speak
  ("Showing "hope"", "No synonyms found").
- Registration (the full surface, v0.63 rule): ToolId union,
  DEFAULT_TOOL_CONFIG (right, enabled — toolConfigFor's fallback shows
  it for EXISTING layouts too; a missing toolOrder id lands at the rail
  end by the 1000+index rule, no migration needed), DEFAULT_TOOL_ORDER,
  ALL_TOOLS (FaBookOpen, 320×420, group 3), ToolDock render case,
  MenuBar TOOL_MENU_GROUPS third group. About window credits
  WordNet/MyThes (Derek's v4.76 standing rule). CSS: 28-thesaurus.css
  (+ screenplay.css import).
- check-v553: 11 green (loads from dock, happy = 4 senses incl. adj.,
  no ⇄ before a script target, chip chains + Back, caret in "occupy"
  auto-targets, ⇄ swaps occupy→inhabit exactly once, tool follows onto
  the new word, Hoping→hope note, zzzqqq miss message, Tools menu row).
- QUEUED NEXT: the PAGES WINDOW TABS restructure (Script / Title Page /
  Custom; the separate Title Page tool leaves the side panels).

### v5.52 — icon/color window OK/Cancel + live hex, colored filter grids, one-checkbox nav fix, header +

- Derek's 4 (one in flight when the batch opened, three mid-turn):
  (1) ICON & COLOR WINDOW: the hex row's Apply is GONE for embedded
  pickers — ColorPicker auto-applies any complete #rrggbb (typed or
  square/hue-drag) via effect; standalone pickers (highlight swatch)
  keep Apply. MarkupComboPicker picks (presets / used / bare icons) no
  longer close the window — v5.31's combo-closes shortcut retired; a
  `.markup-icon-pop-foot` (Cancel / OK, compact .dialog-btn dress) owns
  leaving. Open-time snapshot {icon, color, iconManual}; Cancel
  restores via updateMarkup, OK / × / outside keep what's live.
  (2) FILTER GRID COLORS (Derek's screenshot: a gray flag): the shared
  TypeGridSection drew MarkupIcon colorless (inherited chrome gray on
  the white chip). It now derives icon→color from the markups wearing
  it (first in store order, memoized) — one fix, every door: panel
  Filter, Navigator Filter, ribbon visibility menu, View submenu.
  (3) ONE-CHECKBOX NAV BUG root-caused: MarkupPopover's live mirror
  called a doc "empty" when getText() was blank and stored
  content: null — but a taskList with one blank item IS structure;
  the null made markupIsList false while the auto-icon (a check for
  checklists, read from the LIVE editor) became the row's big icon.
  Typing anything "fixed" it, which is why two items looked like the
  cure. markupDocIsEmpty (markupActions — structural: only blank
  paragraphs are empty; lists/images/text count) now feeds BOTH mirror
  sites, and markupNavLines keeps textless LIST items so the row shows
  its ☐ (4 new unit tests → 880).
  (4) + ADD ANNOTATION → the window header: bare FaPlus, tool-ctl-lead
  (leads the row; Filter/Search ride right). The header has no editor,
  so the click arms markupsSlice.markupAddRequest and the panel body
  (owns the editor, mounted iff that header shows) runs
  createMarkupAtSelection — the pagesGotoRequest chrome→body pattern.
  Body add-row + its CSS retired; empty-state copy updated.
- check-v552: 12 green (bare + leads the header, gap 116px, body row
  gone; + creates from the selection; no Apply + Cancel/OK footer;
  typed hex auto-applies; a preset pick stays open; Cancel restores;
  OK keeps; a lone checkbox is STORED and previews ☐; nav row shows ☐
  and NO big icon; both filter-grid doors wear the annotation color;
  empty-selection + still arms the banner).
- Driver lesson (encoded in the check script): Navigator and
  Annotations dock on DIFFERENT sides — both windows live at once and
  both filter buttons are `.markup-ctl-filter`. Scope chrome clicks via
  closest('.tool-dock-wrap') from a body landmark, and NEVER re-click a
  dock item to "open" an already-active tool — it toggles it CLOSED.
- QUEUED NEXT: the PAGES WINDOW TABS restructure (Script / Title Page /
  Custom; the separate Title Page tool leaves the side panels) — the
  batch opener for the next run.

### v5.51 — ribbon legacy-inserts retired, Filter right, pick BANNER, Navigator View menu

- Derek's 4 (mid-turn, after the v5.50 ship):
  (1) RIBBON RETIREMENT (phase 2's leading edge): Insert Section /
  Insert Note / Add To-Do List (builtins) + Insert Marker (command)
  removed — TOOLBAR_BUILTINS entries, Toolbar render cases,
  DEFAULT_TOOLBAR_LEFT tokens (and the orphaned r:def-3 rail),
  LEGACY_GROUP_ITEMS.insert → [], the insertMarker command +
  INSERT_CMDS palette slot. migrateDropLegacyInserts (toolbarBuiltins,
  the v3.25 shed pattern, flag 'opendraft:toolbarDropLegacyInserts551')
  strips saved layouts ONCE, both zones, 2!-flag-blind. The Insert MENU
  entries remain until phase 2 proper.
  (2) Annotations panel Filter: tool-ctl-lead dropped → rides right,
  just left of Search.
  (3) The PICK BANNER replaced the pick toast: a strip pinned above the
  scroll area — editor-center column child; .editor-main is a flex ROW,
  so a child there lands BESIDE the page (the first driver run caught
  the pill far-left) — pill centered, 15px, persistent until a
  selection lands; Escape cancels (the v5.48 listener).
  (4) NAVIGATOR VIEW MENU: the Scene # button became a ControlDropdown
  "View" with keep-open toggles — Scene Numbers (navShowSceneNumbers),
  Annotations, Scene Headings (navShowKinds.markup/.scene; missing =
  shown; the body honors JUST these two kinds again). Toggle handlers
  read the store AT CLICK TIME — two same-tick clicks through render
  closures clobbered each other (the driver caught it).
- check-v551: 11 green (fresh ribbon clean, persisted-layout shed with
  flag + undo kept, Filter gap 3px, banner top-center 15px persistent,
  Esc cancels, pick places + clears, Scene # gone, three menu items,
  scene rows 4→0, anno rows 1→0, both restored).
- QUEUED NEXT: the PAGES WINDOW TABS restructure (Script / Title Page /
  Custom; the separate Title Page tool leaves the side panels) — the
  batch opener for the next run.

### v5.50 — hide-ribbon CRASH fix, shared PerRowStepper, no-flash Design seat, Scrapbook auto-dock

- Derek's 6 (five mid-turn messages, one CRASH report):
  (1) THE CRASH ("when i tried to hide the ribbon toolbar"): three
  useEditorStore reads (dzVars + the two rib scale pcts, the v5.14
  per-kind geometry) sat ~900 lines BELOW Toolbar's
  `toolbarMode==='hidden'` early return — hiding the ribbon changed the
  hook count → 'Rendered fewer hooks'. Hoisted above the return beside
  the zone hooks (the file's own NOTE says exactly this; §4 footgun).
  Verified live: hide→restore, 0 pageerrors.
  (2) `.fs-perrow-input` wears `.tool-action-field` (standard border +
  dark input bg) at 30px, margin -4px → ~2px off the arrow frame.
  (3) The # button tooltip: "Go to page #".
  (4) ONE PerRowStepper (ToolControls) — framed Up/Down + typeable
  field; Pages AND Scenes-Cards render it (CircleMinus/Plus gone from
  ScenesTool; the count-span/perRowText inline versions deleted).
  (5) Design FLASH on open (far-left frame): the seat effect became
  useLayoutEffect — seats before first paint.
  (6) SCRAPBOOK AUTO-DOCK: NotebookSurface mount, when
  toolConfig.notebook is disabled, enables it into the LEFT panel
  (docked, activeTool) and remembers the prior cfg; unmount restores it
  verbatim. Probe: rows 0 → 1 (left, active) → 0 with cfg restored.
- Probes (inline, no check file — every piece store+DOM-verified live):
  pages type-5, scenes framed stepper type-4 + 0 old icons, auto-dock
  cycle, hidden-ribbon toggle crash-free.
- QUEUED NEXT (Derek, this turn — in order): ribbon retirement of
  Insert Section / Insert Note / Add To-Do List / Insert Marker
  (builtins+palette+default layout+one-time shed; RIBBON_HIDE precedent);
  Annotations-panel Filter right-aligned before Search (drop
  tool-ctl-lead); the pick-to-place prompt as a BIG persistent centered
  banner at the editor top (Escape cancels — listener exists);
  Navigator: Scene # toggle → a "View" menu (Scene Number / Annotations
  / Scene Heading toggles — reuse navShowKinds for scene+markup);
  PAGES WINDOW TABS (Script / Title Page / Custom) with the separate
  Title Page tool leaving the side panels — the big restructure.

### v5.49 — Design seats at the panel edge, stacked previews + Save, picker ×/white chips, spinner + typeable count

- Derek's 8 (five mid-turn messages; the sandbox rolled back a FOURTH
  time at turn start — reset + reinstall recovered it, and the restored
  node_modules was MISSING the tiptap extension packages until
  `npm install` reran):
  (1) DESIGN SEAT SPEC (his correction of v5.48's top-right anchor):
  every OPEN of the independent window seats it against its OWN panel —
  right edge on the right panel's left edge (mirrored for a left-side
  config), measured live from `.tool-dock-wrap.tool-dock-<side>`;
  no visible panel → top-right fallback. Drags while open are
  respected; the v5.48 sentinel/off-screen logic is gone.
  (2) PREVIEWS STACKED: "In Script:" UNDER "In Navigator:", both left
  (.markup-prev-lines column, .markup-prev-line rows); SAVE moved into
  the same section, pinned bottom-right (.markup-pop-preview align-items
  flex-end + margin-left auto); the .markup-pop-foot row + spacer are
  dead, removed.
  (3) Highlight group hugs the head row's right (.markup-hl-group
  margin-left auto — keeps right-hugging when wrapped).
  (4) The icon/color picker's drag bar gained a × (.markup-icon-pop-close,
  stopPropagation vs the drag).
  (5) WHITE CHIPS: `.markup-preset` background is #fff app-wide (the
  paper the margin icons ride) — the isDarkColor light-chip special case
  is now redundant-but-harmless (class + rule remain).
  (6) STEPPER: one frame around both arrows (.fs-updown bordered,
  divider between buttons), number snug (-3px against the group gap)…
  (7) …and the count is a FIELD (.fs-perrow-input — type it or step it;
  raw text while editing, blur snaps to the clamped store value;
  reverses v5.08's "never typed").
- check-v549: 11 green (fresh + post-dock-cycle seat gap 8px, stacked
  left-aligned previews, Save bottom-right + foot gone, highlight
  right-hug 0px, picker × present/closes, 57/57 white chips, framed
  tight arrows, 3px number gap, typed 6 → store+grid 6).

### v5.48 — annotations = highlighted text, pick-to-place, title-bar status/delete, Scene # in header

- Derek's 8 (six mid-turn messages):
  (1) EVERY annotation anchors to highlighted TEXT: createMarkupAtSelection
  with an EMPTY selection creates NOTHING — it arms
  markupsSlice.markupCreatePick (+ a toast prompt) and the next selection
  in the script places the annotation (the Link Script Text flow promoted
  to the front door; listener hosted in MarkupIconLayer, Escape stands
  down). A cursor INSIDE an existing highlight opens that annotation.
  Point annotations are no longer creatable; legacy ones stay readable
  (their Link Script Text upgrade path remains). convertMarkupToPoint is
  GONE with the remove-highlight button. Return type is now
  `string | null`.
  (2) The window's ⋮ MENU IS GONE (superseding the just-asked move-to-
  header mid-batch): the title bar carries a STATUS toggle
  (.markup-win-status, FaRegCheckCircle, green when done) and DELETE
  (.markup-win-delete) which confirmDialog-warns, then does the ⋮ menu's
  exact delete (removeMarkupFromDoc + emit + removeMarkup + close).
  MarkupDotsMenu remains on panel cards + Navigator rows.
  (3) Preview icons CENTERED on their labels (.markup-pop-preview
  align-items center; nav preview inline-flex).
  (4) NAVIGATOR: the Scene # toggle moved into the window HEADER — text
  only (.fs-nav-nums-ctl, .tool-ctl.active = accent); NavActionRow and
  its CSS are gone.
  (5) DESIGN POP-OUT SEAT (Derek's screenshot: half off-screen): the
  dock-drag left `pos` at the panel edge and reopening used it. dockInto
  resets pos to the sentinel; the open effect ALSO re-anchors whenever
  the remembered spot is mostly off-viewport.
- check-v548: 12 green (empty add → armed+toast+no create, Escape
  cancels, next selection places a highlighted range annotation with the
  mark in the doc, no hl-del / no ⋮ / status+delete present, status
  toggles+lights, chip centered Δ0, cancel keeps, confirmed delete
  removes annotation+span+window, selected add unchanged, dock-cycle
  pop-out fully on screen).

### v5.47 — # goto in header, stacked stepper, Design DOCKS BACK, notes checklist fixes, edit-window force-show

- Derek's 10 (seven mid-turn messages; the sandbox ALSO rolled back a
  THIRD time at turn start — reset + npm install + Vite restart, the
  standing recovery):
  (1) GO TO PAGE → the window HEADER: PagesControls gains a bare
  `#` button (`.fs-pages-goto-btn`, FaHashtag, shares the
  .tool-ctl-search-btn sizing rule) LEFT of the search; its pop asks
  "Go to page #:". The jump crosses components via
  sceneNavSlice.pagesGotoRequest (chrome REQUESTS, the body — owner of
  the grid ref + editor — performs and clears; the slice's own
  chrome/body precedent). The body row's goto form + gotoPage state are
  gone.
  (2) STEPPER: `.fs-updown` — Up stacked on Down, LEFT of the number
  (− / + retired; CircleMinus/PlusIcon imports dropped here — the
  Scenes cards stepper keeps its own).
  (3) DESIGN DOCKS BACK (Derek: "i can no longer add the design window
  back into the side panel" — the v5.46 hole): the independent window's
  header drag got the v4.39 drop-on-panel gesture (zones + drop-target
  highlight + dockInto: setToolConfig side, setToolMode 'docked',
  designPanelOpen false, openTool). openTool('design') honors an
  EXPLICIT docked home (cfg.enabled && toolMode.design==='docked' →
  falls through to the docked-slot branch), else independent window.
  migrateDesignToolMode (editorStore, viewState.designModeReset flag)
  strips a LEGACY pre-v5.46 'docked' ONCE so upgrades don't resurrect
  the slot-stealing v5.46 removed. The dock-row drag-out for design
  hands back to the independent window (mode 'floating', closeTool +
  openTool), never the old slot-float frame.
  (4) NOTES CHECKLIST CARET: `.swn-note-editor` task rows lacked the
  annotation editor's `li > div { flex: 1 }` — the empty text div was
  ZERO-width, so clicks beside the box missed the editable area. Fixed
  (+ label flex-shrink 0).
  (5) NOTES HELPER TEXT gone: the Placeholder extension removed from
  StickyCard's NoteBody (+ its CSS); the title field's placeholder
  stays.
  (6) NO STRIKETHROUGH on checked items — Notes AND annotation editor
  (line-through dropped, the dim color/opacity kept).
  (7) ICON ROW: MarkupUsedRow's separate current-swatch + `+` trigger
  merged — MarkupComboPicker's trigger IS the current combo
  (`.markup-combo-current`); .markup-combo-plus CSS retired.
  (8) EDIT-WINDOW FORCE-SHOW: while markupEditorId != null the script
  shows ALL annotations — an OVERRIDE, never a write: the page's
  `markups-hidden` class condition, MarkupIconLayer's layer gates AND
  its scriptFiltered() all stand down while open; closing reverts to
  the stored preference untouched.
  (9) tooltip: "Delete highlight (the annotation stays)" → "Remove
  highlight from script". (10) (batch hygiene: mixed-escape MenuBar-
  style edits again needed python splices; .swn mini bar is
  :focus-within-gated — the driver must click INTO the field first.)
- check-v547: 21 green (bare # left of search, pop label, jump from
  pos 1 → page 2 + request cleared, stacked geometry + left-of-count +
  − / + gone, up/down 3→4→3, window-drop docks + row click honors home
  + row drag-out returns to the window, no [data-placeholder], div
  fills row + caret lands beside the box, no strikethrough ×2,
  force-show with toggle off + revert on close, new tooltip, + gone /
  current combo opens picker).

### v5.46 — nav Filter=annotations, Design independent window, edge resize everywhere, live checklist, working inserts

- Derek's 9 (six mid-turn messages, one batch):
  (1) NAVIGATOR FILTER: NavigatorControls' kind-toggle ControlDropdown is
  GONE — the header Filter button now opens `.markup-filter-pop` with a
  `.fs-nav-filter-title` ("Filter Annotations") + the shared
  TypeGridSection driving markupFilters. The body's Annotations button
  died with it (content moved up); NavActionRow is just the scene-number
  toggle, relabeled "Scene #". The body list STOPPED consulting
  navShowKinds (no door left — a stale persisted hide would be an
  invisible trap); the store field remains, unread.
  (2) DESIGN INDEPENDENT: openTool('design') now returns
  `{designPanelOpen: true}` — the pre-existing INDEPENDENT window
  (DesignPanel, portalled, own pos/size) is Design's ONE shape from every
  door (openFromRow routes there too; isToolOpen/closeTool know the
  flag). The probe that drove it: Design docked STOLE the panel slot
  (collapsing the neighbor) and a slot-float Design DIED to slot
  reassignment — closeOtherFloats' v5.32 exemption never covered slots.
  The old keep-the-temp special case in openTool's slot branch is dead
  code, removed (TS2367 flagged it). MarkupPopover's outside-press saver
  ignores `.dz-panel` + `[data-tool-row="design"]` (rows carry
  data-tool-row now) — tweaking Design with the annotation window open
  is the point. toolModeMemory.test updated to the new contract.
  (3) EDGE RESIZE: components/EdgeResize.tsx — ONE primitive
  (startEdgeResize: 8 zones n/s/e/w/ne/nw/se/sw, west/north drags move
  that edge and pin the opposite) + EdgeResizeZones renderer +
  `.fs-edge-*` CSS (5px edges inset 12, 12px corners, z 40). Wired into:
  the floating tool frame (anchor converted to explicit left/top at
  start — the header-drag conversion; v0.85 slack-shrink kept, edge
  recomputed POST-slack; commits via setToolSize), DesignPanel
  (pos/size state), MarkupPopover (writes el width/height + setDragPos →
  the seat's override engages, so the v5.33 right-edge re-pin stands
  down once you resize). The hash grips are GONE (.tool-window-resize
  element+CSS, .dz-resize, and the popover's native `resize: both` — its
  WebKit corner was the same hash; `.markup-icon-pop` keeps native
  resize for now). CRITICAL RESTRUCTURE for the popover: the frame is
  `overflow: hidden` and a new `.markup-pop-scroll` inside carries the
  scrolling (flex:1, the v5.42 flex-chain selectors moved onto it) —
  abs-positioned zones inside a scrolling box would have scrolled away
  with the content.
  (4) FILE MENU: Asset Manager (label/icon from ALL_TOOLS — single
  source) + the Script History submenu moved from Project to File, after
  Print. (The Project block had MIXED \uXXXX escapes and literals — the
  Edit tool can't match those; a python line-range splice did it.)
  (5) LIVE CHECKLIST: markupNavLines returns STRUCTURED MarkupNavLine[]
  ({text, marker: bullet/number/check/uncheck, n}) and
  MarkupNavLines.tsx (MarkupNavLineSpans) is THE renderer for the
  Navigator row AND the "In Navigator:" preview — checklist lines show
  real FaReg(Check)Square icons at the nav's 11px. The mini editor
  LIVE-MIRRORS content into the store (debounced 250ms on 'update') so
  the real Navigator updates as you type/check; snapRef gained `content`
  (the STORE value at open) and closeWithoutSaving restores it — ×
  still discards. markupActions.test updated to the structured shape
  (+ a numbered/bullet case).
  (6) INSERTS FIXED: Insert Link / Insert Image used window.prompt — a
  SILENT NO-OP in Tauri WebKit (fine in a browser, dead in the app; §4
  material). Both are in-window flows now: link = inline URL field
  (collapsed selection inserts the URL as linked text; a selection gets
  setLink); image = three-source menu — From local device (via
  utils/imageIntake.ts: fileToDataUrl+compressImage EXTRACTED from
  NotebookTool, shared, compressed to the Scrapbook's ~300k budget),
  From Asset Manager (api.listAssets image/* → api.getAssetUrl), From
  URL. State resets when a different annotation opens.
- check-v546: 20 green (menu moves, nav filter title/grid/store-write,
  Scene # alone, live mirror via a REAL checkbox click — setContent is
  emit-silent, the first run's lesson — 4 rendered checkboxes, × rollback
  despite live writes, link href landed, 3-source menu, URL image node,
  8 zones + resize:none + scroll split + e-drag Δ70 on the annotation
  window, Design beside the annotation window with slot untouched, dz
  8 zones/no grip/w-drag moves left edge, float opens with Design still
  up, tool window 8 zones/no hash/w-drag). NOTE: the Design window can
  COVER the annotation window (both seat right) — the driver drags dz
  aside by its header before clicking Save under it.

### v5.45 — AI Writer panel-only remove button + out of Tools menu; Pages right pair

- Derek's queue #1 + a mid-turn Pages tweak: (1) AiWriterTool's footer
  button renders ONLY in-panel — `inPanel = (toolMode.aiwriter ?? 'docked')
  === 'docked' && tempTool !== 'aiwriter'` (ToolContent renders the same
  body docked and floating; tempTool is the no-dock-home float) — and its
  text is "Remove AI Writer from side panel". Popped out: no footer at
  all. The remove-and-stash behavior (enabled:false, back via Customize ▸
  Panels) is unchanged. (2) 'aiwriter' removed from MenuBar's
  TOOL_MENU_GROUPS — its doors are the dock row and Customize ▸ Panels.
  (Ribbon palette already hid it: t:aiwriter in RIBBON_HIDE.) (3) Pages
  header re-split per Derek: + Add Page keeps the LEFT; Go to page + the
  per-row stepper live in `.fs-pages-right` (margin-left auto, its own
  ctl-gap, justify-content flex-end so a wrapped lone row still hugs
  right).
- check-v545: 7 green (left/right geometry, Tools menu without AI Writer
  but with neighbors, docked button text, floating = no button,
  remove-and-stash still works: window closed + dock row gone +
  enabled=false).

### v5.44 — Pages tool: header reorder + gap knob, + Add Page dropdown, ratio fix, custom-thumb drag/⋮

- Derek's 5 (four mid-turn messages, one batch): (1) HEADER ORDER — the
  Pages row is now a raw `.tool-action-row.fs-pages-actions` div (ToolActionRow
  couldn't take a class): + Add Page, Go to page, Pages per row, ALL left
  (v5.23's right-pinned stepper reversed for THIS row only; Scenes keeps
  its). Gap = `--dz-pages-ctl-gap` (pagesCtlGap, def 10, Navigator &
  Outline group). COMPOUND selector required — the base row's `gap: 6px`
  lives in 22-tools-extra which loads AFTER 05-scene-navigator, so a
  single-class override silently loses the tie (the driver caught 6px).
  (2) "+ Add Page" DROPDOWN (`.fs-pages-pop`, portalled, useSeat/useDismiss
  from MarkupPickers): "Add Custom Page" → "Add after page #:" input
  (blank = cursor via insertCustomPage, 0 = before page 1, N = between N
  and N+1); "Add/Edit Title Page" (label = doc has titlePage nodes) →
  openTool('titlepage'). (3) POSITION MATH single-sourced: posAfterScriptPage
  / posAfterEntry — "after page N" = the NEXT pageContent entry's first
  block docPos (doc end when last). PageContentInfo now carries cpId
  (computePageBlocks; unit-tested) so every door addresses a run by id.
  New CustomPage.ts helpers: insertCustomPageAt / customPageRunRange /
  moveCustomPage (delete run → insert mapped through tr.mapping; target
  inside the run = no-op) / deleteCustomPage. (4) CUSTOM thumbs drag
  (draggable only when isCustom; dragstart does setData + DEFERRED state
  write — both v5.36 WebKit rules; drop on any page = land right after it,
  `.drop-after` inset edge marks the target); ⋮ kebab (`.page-thumb-kebab`,
  FaEllipsisV, top-right of the thumb) → Move page ("Move after page #:")
  / Delete page (confirmDialog danger, removes the run). Script thumbs:
  no drag, no kebab. (5) RATIO ROOT CAUSE of "white space at the bottom
  of each page": `.page-thumb-content-clip` hardcoded aspect-ratio
  8.26/11.69 — A4 — while scripts are US Letter (8.5/11), a ~9% dead
  strip on EVERY thumb. Now inline `${pageLayout.pageWidth} /
  ${pageLayout.pageHeight}` (CSS fallback = Letter).
- check-v544: 16 green (old button gone, reading order, stepper unpinned,
  gap 10→26 via setDesignVar, ratio 1.294 ≠ A4 1.415, menu pair, add
  after 1 → [P1, Custom, P2], custom draggable+kebab / script neither,
  Move after 2, synthetic DataTransfer drag with mid-drag `.drop-after`
  hint, confirmed delete empties the doc, Title Page window opens).

### v5.43 — ONE Filter for both scopes, whole-area context menu, Return to Editor retired

- Derek's 3 (one turn): (1) FILTER REVERSAL of v5.42's two-section design
  ("the drop down window is not big enough for the status field. abandon
  the two section idea"): MarkupsPanel renders ONE TypeGridSection whose
  every control writes BOTH scopes — setBothDone/toggleBoth/showAll/
  hideAll pair markupHiddenIcons+markupScriptDone (script) with
  markupFilters (window). Display reads the UNION of the two hidden
  lists, so legacy split state (the ⋮ menus, ribbon and Navigator still
  write single scopes) shows as hidden and ONE click converges both.
  `.markup-filter-pop` widened 216→252px (216 clipped the Status row's
  "All"); `.markup-filter-combined` + section-title CSS removed dead.
  Chip = hiddenUnion + status. (2) CONTEXT MENU owns the whole script
  area: the handler moved from `editor.view.dom.parentElement` to
  DOCUMENT with a `.closest('.editor-main')` guard — right-clicks on
  page margins, page-break bands and annotation chips now open the APP
  menu (WebKit's native Look Up/Translate suppressed); outside the
  script area nothing changes. (3) the Scrapbook ribbon's "Return to
  Editor" section is GONE (the × does it; last remaining instance —
  the fullscreen one died earlier); orphaned LuUndo2 + closeNotebook
  imports cleaned (the TS6133 gate would have blocked the .dmg).
- check-v543: 10 green (one section/one status row, old titles gone,
  "All" fits in 252px, status/type/hide-all each write BOTH scopes,
  split-state converges in one click, backdrop right-click →
  defaultPrevented + app menu AFTER the React flush — same-tick DOM
  reads race the render, the first run's lesson — no-op outside the
  script area, no Return-to-Editor button with the Scrapbook open).

### v5.42 — preview knobs, no phantom row, pinned ⋮, growing field, ONE Filter

- Derek's 6 (mid-turn adds included): (1) `.markup-pop-preview` padding is
  four Design knobs — --dz-anno-prev-pad-top/right/bottom/left (defs
  8/0/0/0 = the CSS fallbacks; test-enforced). (2) the head-row SPACER is
  gone; groups wrap inside `.markup-pop-head-main` (flex:1, wrap) so a
  tight window drops the Highlight group with NO empty row between. (3)
  the ⋮ left the title bar for the head row's right edge —
  `.markup-head-dots` (margin-left auto) inside the NON-wrapping outer
  head (`flex-wrap: nowrap`), so it is LOCKED to row 1; the v5.33
  titlebar-dots dressing is dead CSS, removed. (4) the RESIZE GROWTH fix:
  `.markup-mini-editor` had max-height 260 and no flex — now flex:1 (all
  siblings flex-shrink:0, EditorContent→ProseMirror flex chain, cursor
  text), so a taller window grows the FIELD (driver: 86→306px, 11px
  under Save). (5) the panel's Script/Window buttons merged into ONE
  "Filter" (`.markup-ctl-filter`, chip = both counts) whose dropdown
  (`.markup-filter-combined`) holds TWO `TypeGridSection`s — "Show in
  Script" (markupHiddenIcons/markupScriptDone) and "Show In Window"
  (markupFilters). TypeGridSection is the extracted section body with
  Derek's wording: "Status: " row + "Annotation Types: " grid, "Select
  one"/"Toggle visibility…" texts deleted; TypeGridPop is now a portal
  shell around one section (gridHelp prop gone — Navigator + ribbon
  callers updated; AnnotationShowMenu/ribbon unchanged otherwise). (6)
  View ▸ "Rulers" / "Scene Numbers" — "Show " prefix dropped.
- check-v542: 18 green (dots seat/lock, spacer gone, genuine-tight wrap
  via 6 probe combos — a 310px window with ONE combo legitimately fits,
  the first run's lesson — field growth, knob-driven paddings, combined
  Filter structure + per-section store writes, menu labels).

### v5.41 — previews, used order, compact draggable picker, ribbon fmt, move toast

- Derek's 7 (one turn): (1) "Displays as:" split into "In Navigator:"
  (nav-row classes, live) + "In Script:" (`.markup-margin-preview` — the
  round margin chip inline, border in the annotation's color). (2)
  MarkupUsedRow: CURRENT combo leads (always ringed), then the `+`, then
  "Used:" (`.markup-used-label`) + the other combos (cap 7, current
  excluded). (3+4) MarkupComboPicker: DRAGGABLE by `.markup-icon-pop-drag`
  (dragPos overrides the seat; reset when it closes) and COMPACT —
  `.markup-icon-pop-cols` puts icons LEFT / embedded ColorPicker RIGHT
  (520px wide, ~447px tall vs the old 560-capped ~700 stack; the color
  column is the height floor). (5) RIBBON FORMATTING drives the mini:
  markupsSlice.markupMiniEditor (unknown-typed, never persisted) is set
  while the window is open; Toolbar's isActive + B/I/U/S route to it
  (no locks/overrides — plain toggles) and the mini gained Underline.
  CRITICAL COMPANION FIX the driver caught: the outside-press saver now
  ignores `.toolbar-btn` presses — clicking ribbon Bold used to SAVE-CLOSE
  the window. (6) LIST annotations (markupIsList in markupActions —
  firstContentKind ∈ bullets/numbers/checklist) show NO icon in the
  Navigator or the nav preview; the script margin chip keeps it. (7)
  SHAPE_NOTES no longer renders at the panel foot (.tool-shape-note CSS
  gone) — the dock-row drag-out for a noted tool (markups/navigator/
  notebook) TOASTS the message at the drop and stays put (having a note
  IS the disallowed-move flag; setToolMode coercion remains the backstop).
- check-v541: 17 green (order probe of the head row, both previews, live
  icon-drop on checklist, ribbon bold hits mini not script + hand-back on
  close, side-by-side geometry + drag Δ, nav rows with/without icon,
  toast + mode still docked).

### v5.40 — CUSTOM PAGES (Derek's queue item 5; ruling: not numbered)

- MODEL (the title-page pattern — flat text*-only schema, v5.25 lesson):
  `customPage` node = ONE LINE, attrs {cpId}; a consecutive same-cpId run
  is one page. src/editor/extensions/CustomPage.ts: the Node, the
  `CustomPageKeymap` Extension (priority 1100 — the AvKeymap precedent;
  NEVER priority on the NODE or it becomes the schema defaultType and
  clearNodes crashes), and `insertCustomPage(editor)` (all three doors
  call it: Insert menu, ribbon palette builtin 'insertCustomPage'
  [FaRegFileAlt], Pages tool `+ Custom Page` / `.fs-pages-addcustom`).
- ENTER inside a line: hand-built node insert carrying cpId + the line's
  tail. splitBlock FAILS in this schema (end-of-block default-type path)
  and falling through hands Enter to the element cycler, which minted a
  customElement — the driver caught both stages.
- PAGINATION (computeBreaks, now exported for tests): entering a run
  pushes a break flagged `isCustomPage` (consumes NO pageNumber, header
  suppressed, measured-fill skipped BOTH sides — it shares its number
  with the next script page); leaving pushes `afterCustomPage` (footer
  for the custom page suppressed) numbered `scriptSeen ? pageNumber++ :
  1` — a LEADING custom run plays the title page's part. No overflow
  breaks inside a run (one page however long — renders tall). scriptSeen
  = any non-custom non-title-region node laid out. Overlay React keys
  now `${pageNumber}@${top}` (custom breaks share numbers). Continuous
  view labels the divide "Custom Page".
- computePageBlocks: bounds carry isCustom (leading-run case handled);
  PageContentInfo.isCustom → Pages tool thumbs labeled "Custom Page",
  `data-page` unique, go-to-page targets `!isCustom` pages only.
- EXPORT: fountainExporter skips customPage (§4 rule — no stray action
  lines in a collaborator's copy). Print: accent border stripped by the
  @media print reset in 06-editor-content.css.
- Tests: pagination.customPages.test.ts (5 — consecutive numbering, no
  count inflation, leading-run page-1, per-page block isolation,
  back-to-back distinct cpIds). NOTE learned writing it: the page BEFORE
  a custom page is legitimately cut short, so total PHYSICAL pages may
  grow — the invariant is the consecutive script numbering, not equal
  page counts. check-v540: 10 green (menu insert, same-id Enter lines,
  header sequence ["2.".."6."] with one headerless sep, export
  exclusion, Pages tool label + door).

### v5.39 — Title Page hand-grabber pan

- Derek's queue item 4. `tp-pan-toggle` (FaRegHandPaper, accent while
  armed) leads the preview zoom cluster; pan mode pointer-drags scroll
  `.tp-preview-scroll` (grab/grabbing cursors, user-select none).
- THE LAYOUT PREREQUISITE the first driver run exposed: `.tp-editor-body`
  scrolled as ONE grid, so the preview column just grew (clientHeight ==
  scrollHeight — nothing to pan, and the drag target's center sat off
  viewport). Now the body is overflow:hidden and each COLUMN scrolls
  itself (`.tp-editor-form` auto; preview min-height 0 so
  `.tp-preview-scroll` clamps) — the preview stays fully in view while
  the form scrolls. The ≤720px stack reverts to one body scroller with a
  60vh preview cap (stacked columns can't share the height).
- check-v539: 6 green (button seat, real overflow, off = no pan, grab
  cursor, Δ80/60 pan, off restores cursor).

### v5.38 — Scenes cards: metrics wrap instead of truncating the name

- Derek's queue item 3. `.index-card-top` wraps; the CRUX:
  `.index-card-heading` needed `flex: 1 1 auto` + min-width 0 — the old
  `flex: 1` is basis 0, so the row NEVER overflowed and the metas never
  dropped (first driver run caught it: Δtop 0). With basis auto the wrap
  decision uses the name's real one-line width: short names keep the metas
  beside them, long ones send metas (+ the expand button, which rides
  them) to row 2 and spend the freed width on a second text line.
- check-v538: 5 green (short same-row Δ0, long Δ33px drop, expand rides,
  2-line heading height).

### v5.37 — fullscreen joins the one-window rule; popover never over a takeover

- Derek's queue item 2. closeOtherFloats now ALSO lowers `fullscreenTool`
  and the Scrapbook surface (notebookOpen) — every float birth path gets
  it for free; the design early-return keeps Design from closing anything.
  Both fullscreen ENTRY paths close floats: openTool's fullscreen branch
  spreads `closeOtherFloats(s, tool)` before setting its own
  fullscreenTool (field composes — the literal after the spread wins), and
  enterToolFullscreen clears temp + floating slots (design excepted) before
  set. Docked opens still touch nothing.
- The ANNOTATION WINDOW needs the editor visible (Derek's addendum): a new
  MarkupPopover effect watches fullscreenTool + notebookOpen and SAVE-closes
  (outside-press semantics) the moment either rises. NavigatorTool's
  annotation-row click steps takeovers aside first (setFullscreenTool null
  + setNotebookOpen false) — the jump needs the editor anyway.
- Tests: toolModeMemory.test "v5.37: fullscreen joins the one-window rule"
  (6 cases: float lowers takeover, temp lowers takeover, entry closes
  floats, remembered-fullscreen path closes floats, docked opens don't,
  Design exempt both ways).
- check-v537: 12 green (DOM-level takeover removal, save-on-stand-down
  content proof, navigator step-aside opening the popover).

### v5.36 — Notes v2: one rich card kind, equal-height rows, real drag fix

- Derek's queue item 1 (flag answered: "your assumption is correct" — old
  checklist cards become notes whose content IS a task list; titles stay).
  The tool is "Notes" (id 'sticky' NEVER changes — persisted). ONE card
  kind: a rich TipTap body per card (StickyCard's NoteBody — StarterKit +
  Link[protocols scrapbook] + Image + TaskList/TaskItem + Placeholder),
  toolbar shown via `.swn-card:focus-within`. Cards store `content` (JSON)
  + `text` (plain mirror — search/snippets/old-build safety). Migration:
  utils/shelfMigrate.ts (migrateShelfCards), applied at the ONE load door
  (ScreenplayEditor `_shelf` parse) and reused by NoteBody for unmigrated
  strays; idempotent, unit-tested.
- GONE: "+ Add Checklist", the kind TABS (useStickyTabs/reorderStickyTabs
  deleted; stickyKindFilter/stickyTabOrder store fields removed — the old
  viewState key just goes unread), the Type sort ('manual' is default),
  the v4.37 card-height grabber (equal rows made it meaningless — its CSS
  cleaned from 22-tools-extra + the 20-tool-dock grip selector list).
- LAYOUT: `.swn-grid` is a real GRID again (repeat(--sticky-cols,
  minmax(0,1fr)), align-items stretch) — rows equalize height natively;
  cards are flex-column with the body flex:1 so the foot pins. Stepper
  label: "Notes per row:". The v5.24 masonry (and its second-column
  misalignment artifact) is gone.
- THE DRAG FIX (root cause at last): setting dragId in onDragStart
  re-rendered the list (drop zones mount) and WEBKIT ABORTS a drag whose
  DOM mutates during dragstart — Chrome tolerates it, so the v5.24
  setData fix looked complete in a browser and stayed broken in the app.
  The dragId write is DEFERRED one tick (setTimeout 0) in both lists.
- Driver lesson: Playwright's page.dragAndDrop HANGS on HTML5 draggables
  headless — dispatch synthetic DragEvents (with new DataTransfer()) at
  the handler chain instead; select cards by querySelectorAll INDEX (an
  nth-of-type on .swn-card returned null in the takeover).
- check-v536: 16 green (rename, one add button, no tabs, 4 rich bodies,
  migrated checklist renders real boxes, stepper wording, 2-col grid,
  per-row top AND height equality, drag reorder → dabc + Manual snap,
  typing updates content+mirror, focus toolbar, checklist toggle).

### v5.35 — docked panel tools survive script clicks

- Derek: "if there is a tool in a side panel toggled open, and i click
  into the script, that tool window should stay open." ToolDock's
  v1.77-era document pointerdown (target inside `.editor-center` →
  setActive(null)) predates docked-vs-floating and closed both. It now
  stands down unless `toolMode[active.id] === 'floating'`, read LIVE at
  event time (drag-out can change the mode while open). FLOATING slot
  windows and temp windows still dismiss on script clicks;
  keepOpenOnEditorClick (Typewriter) still survives everything.
- check-v535: 9 green — both docks stay through real clicks; floating
  slot + temp window still close (pinned so the dismiss rule can't
  silently vanish). Driver note: Playwright refuses clicks the temp
  window intercepts — click uncovered editor coordinates via mouse.click.

### v5.34 — "Change Order"

- Derek: any button labelled "Reorder" → "Change Order". Exactly ONE
  existed: the Scenes tool's ScenesReorderControl (one component shared by
  the window chrome and the fullscreen takeover, so both changed at once).
  Label + its test pin updated. The scenesReorderMode flag and
  scene-reorder-btn class keep their names — internal identifiers.

### v5.33 — icon-anchored seating, resizable windows, real scrapbook links

- Derek's batch (11 items, most added mid-turn): (1) the edit window SEATS
  under the annotation's on-script margin icon with its RIGHT edge on the
  side panel's left edge (`.tool-dock-wrap.tool-dock-right`, width>0 guard);
  no right panel → centered under the icon. `.markup-margin-icon` now
  carries `data-markup-icon` for the lookup; icon missing (type hidden,
  layer off) → highlight/block rect stands in; orphan → screen-center as
  before. A ResizeObserver re-runs place() when the SIZE changes, so a user
  resize keeps the right edge pinned and grows the box LEFTWARD (drag +
  maximize still override everything). (2) both the edit window and the
  combined icon/color picker are resizable (CSS resize:both; the window's
  width lives in CSS, not React style, so the handle's inline w/h survive
  re-renders). (3) the ⋮ menu rides the TITLE BAR left of fullscreen
  (`.markup-titlebar-dots` wrapper stopPropagations pointerdown or the bar
  would start a drag); the head row's spacer moved BETWEEN the Icon and
  Highlight groups — flex base-size math wraps the Highlight group to a
  second row exactly when the Used combos leave no room. (4) "Displays as:"
  under the note text: the LIVE Navigator-row preview (icon + lines),
  rendered with the REAL row's classes and fed by `markupNavLines` in
  markupActions — the ONE capper (6 lines × 60 chars + …) the Navigator now
  uses too; the mini's 'update' event drives it keystroke-live. (5) the ⋮
  hide-type item shows the annotation's ICON, not its name
  (`.markup-dots-hidetype`). (6) scrapbook links: tiptap Link ≥2.11 STRIPS
  hrefs of unknown schemes at RENDER (anchor stays, href="") — fixed with
  `Link.configure({ protocols: ['scrapbook'] })` + linkScrapPage inserts a
  text node with a real link MARK (the old HTML string landed as plain
  text). (7) navigator list annotations STACK (`.fs-nav-anno-lines` column
  CSS — the v5.30 component named classes that were never written). (8)
  panel labels renamed by WHERE they filter: Show→"Script", Filter→"Window".
  (9) `.markup-hl-clear` gets fixed DARK ink scoped to `.fs-markup-popover`
  (the --fd-text hover flipped "Link Script Text" white on the light
  surface). (10) ribbon Show/Hide Annotations = the SAME FaMarker as the
  side panel tool (Toolbar case + TOOLBAR_ICONS registry, both), pressed
  state carries on/off — the eye/eye-slash pair is gone.
- DRIVER LESSONS: a dock-row click TOGGLES an open tool and the Navigator
  docks LEFT — Annotations stayed open on the right, so a blind
  openTool('Annotations') CLOSED it (guard with an existence check).
  And never inject store content while the popover is open — save-on-close
  writes the mini editor's JSON over it; type through the mini instead.
- check-v533: 25 green (edge/center seating deltas, titlebar order, wrap
  by measured tops, live preview lines, real <a href="scrapbook:…">,
  resize sticks + edge re-pins, 3 stacked nav rows, labels).

### v5.32 — one-row nav header, unmistakable active icon, Design exempt

- Derek: (1) the Navigator header is ONE row (Filter + Search only); the
  Annotations filter button + Scene Numbers toggle moved into the BODY's
  first row (`NavActionRow`, `.fs-nav-action-row`) as BLUE buttons —
  dialog-btn-primary; Scene Numbers is primary only while ON (state reads
  through the fill). The v5.28 `.tool-ctl-break` is retired.
- (2) the ACTIVE icon chip in the edit window wears a 2px accent border +
  glow ring, and MarkupUsedRow guarantees the active combo is IN the capped
  row (swaps into the last slot when the cap would hide it).
- (3) DESIGN is exempt from the one-window rule BOTH ways: closeOtherFloats
  early-returns for keep==='design' and never closes a design float — AND
  openTool's slot branch had a HARDCODED `tempTool: null` outside
  closeOtherFloats that closed the temp window anyway (the store test
  caught it; the exemption must live in BOTH spots). Pinned in
  toolModeMemory.test ("Design neither closes other windows nor is closed
  by them") — 858 tests now.
- Driver note: the Navigator's Filter and the Search button sit 1px apart
  vertically — assert one-row with a ≤2px spread, not exact equality.
- check-v532: 9 green.

### v5.31 — highlight conversions, inline Used row, combined picker

- Derek's batch (+3 mid-turn adds): (1) title bar darker (rgba .22) and the
  fullscreen/× are FULL-HEIGHT header buttons (the .tool-window-close
  format: 30px wide, align-self stretch, square, flush right with a
  matching top-right radius). (2) HIDE-highlight is GONE — replaced by
  DELETE: `convertMarkupToPoint` (markupActions) strips the mark and
  re-anchors the annotation as a block anchor on the SAME element (occupied
  block → anchorless orphan, still editable); the inverse,
  `convertMarkupToRange`, powers "Link Script Text" (label Derek asked to
  shorten from "Add Highlighted Text in Script") — a PICK MODE: the window
  stays open (pickingRef makes the outside-press saver stand down; Escape
  cancels the pick only), the next real selection converts point→range
  with the yellow default. (3) the Icon row shows the USED combos INLINE
  (MarkupUsedRow, cap 8) ending in a + (MarkupComboPicker — the old icon
  window + an EMBEDDED ColorPicker in ONE popover; bare icon picks keep it
  open so a color can follow; preset/used combos close).
- ColorPicker gained `embedded` — its own outside-MOUSEDOWN closer fired on
  clicks in the host's icon grid and closed the whole combined window (the
  first driver run caught it). Embedded = the host owns dismissal.
- NAVIGATOR is panel-locked too now (PANEL_LOCKED_TOOLS + NO_FULLSCREEN +
  its own SHAPE_NOTE).
- DRIVER LESSON: to close a sub-popover mid-test use ESCAPE, not a body
  press — the body press is an outside-press for the EDIT WINDOW as well
  and save-closes it under you. check-v531: 18 green (computed bar color,
  full-height buttons by rect, keep-open pick, both conversions with
  doc-level span/block proofs, stay-open pick mode).

### v5.30 — the edit window becomes a WINDOW; tool locked to panel

- Derek's batch (+3 mid-turn adds): (1) the Annotations TOOL is LOCKED to
  the side bar — PANEL_LOCKED_TOOLS in editorStore; setToolMode COERCES
  every write to 'docked' (drag-out, remembered shapes, all paths) and
  enterToolFullscreen early-returns; NO_FULLSCREEN_TOOLS hides the button.
  SHAPE_NOTES (ToolDock) prints the limitation at the panel window's foot
  ("This window only appears in the side panel"; Scrapbook: "only appears
  in full-screen mode") — limits are SAID, not silently missing.
- (2) The EDIT window is a real window: `.markup-pop-titlebar` (sticky,
  drag-move via pointer capture — dragPos overrides seating and an
  overrideRef makes the scroll/resize re-seat STAND DOWN), FullscreenIcon
  button (maximized = fixed inset 48px), × = close WITHOUT saving — dirty
  check against a snapshot taken at open (content JSON + icon/color/
  highlight/done); dirty → confirmDialog("Are you sure you want to close
  this annotation without saving?") then RESTORES the snapshot fields +
  setMarkupHighlight (content was never written). The popover's outside-
  press/Escape saver must IGNORE .fs-confirm-overlay or the dialog's own
  buttons would save-and-close underneath it.
- (3) Its OWN THEME: --anno-win-bg/-win-text/-field-bg/-field-text — :root
  (dark bases) = light-gray #d6d8dc window + WHITE field; [data-theme=
  light] = #e2e4e8; THEME_VARS gains an "Annotations" group so every theme
  (custom included, via seedVarsFromBase) can restyle it. 27-markups.css
  interior chrome moved off --fd-* onto inherit/rgba-black so it reads on
  the light surface.
- NAVIGATOR adds: empty annotation = icon only (no "(empty annotation)");
  list content renders AS a list (markupContentLines in markupActions —
  paragraph lines + •/n./☐☑ item lines, cap 6); the Annotations button now
  opens the SHARED filter popover (markupFilters — same state as the panel
  Filter) and the navigator rows OBEY it; it sits beside Scene Numbers on
  row 2 (Scene Numbers carries the lead margin to eat trailing width).
- check-v530: 19 green (lock coercion, helper notes, computed theme colors,
  drag + no-re-seat, maximize, clean vs dirty ×, discard proof, icon-only
  and list rows, same-row buttons, shared-filter drive).

### v5.29 — picker Used sections, legible chips, head row, icon import

- Derek's batch: (1) RECENT → USED in both pickers, derived LIVE from
  `markups` (no stored lists — markupRecentColors/Icons fields deleted;
  old viewState keys ignored). Color picker `used` prop (was `recent`,
  label "Used"); icon picker Used row = unique icon+color COMBOS rendered
  in their own colors; picking one sets both. (2) LEGIBILITY: isDarkColor
  (markupIcons, luminance < .42) puts `.markup-light-chip` behind icon
  buttons drawn in dark colors (his screenshot: near-black on dark chrome).
  (3) HEAD ROW: one row — "Icon:" group (icon+color swatches) ·
  "Highlight:" group (EYE toggle, title "Hide (or show) highlight in
  script", replacing the checkbox + color swatch) · ⋮. Three cssVar Design
  knobs: --dz-anno-head-gap 6 / --dz-anno-group-gap 14 / --dz-anno-head-pad
  0 (Design ▸ Annotations). (4) IMPORT ICON: file input in the icon picker
  — image/* only, 2 MB cap, canvas contain-fit to a 48px PNG data URL,
  stored in viewPrefs.markupCustomIcons ({id,data}[], persisted), icon key
  `custom:<id>`; MarkupIcon renders customs via a store lookup (img
  .markup-custom-icon; margin chip sizes it 72%).
- WATCH FOR: an Edit once wrote a NUL byte into MarkupPickers.tsx (file
  became "data" to grep/file and would have broken the build) — caught by
  `file`; stripped with python. If grep calls a source file BINARY, look
  for \x00.
- check-v529: 19 green (labels/row geometry, eye toggle, Design var drives
  computed gap, Used rows from live state, chip bg computed, real file
  import via setInputFiles → registry + swatch + margin img).

### v5.28 — annotation view controls everywhere + navigator polish

- Derek's batch: (1) View ▸ Annotations SUBMENU — master toggle, status
  check items (markupScriptDone), a per-type check item for each icon in
  use (dynamic from `markups` via a MenuBar useMemo), Show/Hide All Types.
  (2) Ribbon palette builtin `annotationsMenu` ("Annotation Visibility") —
  opens the SAME script-visibility popover as the window's Show button.
  (3-5) Navigator: annotation rows indent (26px) + text in the icon's
  color; an "Annotations" tool-ctl toggle (navShowKinds.markup, the lead
  slot); the scene-number toggle moved to ROW 2 left (a `.tool-ctl-break`
  flex-basis:100% span forces the wrap; the button gained a "Scene
  Numbers" label) and numbers render as `.scene-number-badge` (the Scenes
  circle, `.fs-nav-num-badge` sizes it 18px) BEFORE the heading — the old
  right-edge `.fs-nav-scene-num` span + CSS are gone.
- SINGLE SOURCE move: DONE_LABELS / useTypesInUse / TypeGridPop now live in
  MarkupPickers.tsx, plus `AnnotationShowMenu` — a self-contained trigger +
  script-visibility popover used by BOTH the panel's Show button and the
  ribbon builtin (the panel's Filter keeps its local-filter copy of the
  popover with its own bindings). Mutual exclusion between panel popovers
  now emerges from outside-press dismissal — no cross-wiring.
- DRIVER LESSON (check-v528, 19 green): a `.menu-dropdown-item.has-children`
  contains its submenu's TEXT — `:has-text("Annotations")` matched Working
  Notes (whose child says "Show Annotations in Script") before the real
  entry. Target the label span with `span:text-is(...)` for menu items.


### v5.27 — solid icons, colored rings, segmented toggles

- Derek's polish batch + two mid-turn refinements: MARKUP_ICONS flipped to
  SOLID Fa glyphs (colored fills, not outlines); the on-script chip's ring
  is 2px in the ANNOTATION'S color (inline from the layer; base rule keeps
  the neutral fallback); chip size is a Design knob — markupIconScalePct in
  viewPrefs (persisted), store-bound token 'markupIconScale' in a NEW
  Design ▸ Annotations group (the layer needs the NUMBER for centering, so
  a CSS var can't drive it). Glyph font-size inherits from the button.
- Tool icon: FaRegFlag → FaMarker in ALL FIVE identity spots (ALL_TOOLS,
  TOOLBAR_ICONS.markupScript, Toolbar case, View-menu row, Settings'
  CUSTOMIZE_TABS).
- ⋮ menu: Status is a same-row Open|Complete toggle (`.markup-seg`, the
  joined-buttons row); "Delete" → "Delete Annotation". Card checkbox
  REMOVED (status lives in ⋮; the panel test pins the absence). Header eye
  REMOVED (MarkupsWindowActions deleted; View menu + ribbon toggle + Show
  cover it).
- "Show in Script" → "Show": no icon, LEFT-seated via .tool-ctl-lead
  (margin-right:auto pushes the rest right), and it gained its OWN
  Open/Complete/All row — viewPrefs.markupScriptDone (persisted, default
  'all') filters the SCRIPT by status: the icon layer skips filtered
  annotations, the span-neutralize sync covers them (scriptFiltered =
  hidden-type OR status mismatch), and the highlight click-guard ignores
  them. Helper texts: Filter grid = "Toggle visibility in tool window",
  Show grid = "Toggle visibility in script", both state rows = "Select
  one" (TypeGridPop takes gridHelp; both popovers now always show state).
- check-v527.mjs: 18 checks green (ring width/color computed, 150% → 33px
  chip, same-row toggles by rect tops, helper-text strings, left seating).
- ColorPicker.test updated to the v5.26 source-arg contract (Apply →
  ('#hex','wheel'), preset → (color,'preset')) — the pinned exact-args
  assertions were the only callers that noticed.


### v5.26 — ANNOTATIONS: rename + the 14-item polish batch

- Derek's batch on v5.25's tool: RENAMED "Annotations" (labels only — tool id
  'markups', builtin keys, context-menu id, `_markups`, all persisted names
  STAY). Every create control reads "Add Annotation".
- CURSOR-ADD ALWAYS WORKS (#3): point annotations are a BLOCK ATTRIBUTE now
  (`MarkupBlockAnchor`, a global attribute `markupId` on every element type,
  renderHTML data-markup-block, keepOnSplit:false) — works on an EMPTY line,
  which the whole-element mark could not (no text to carry it). The v5.25
  refusal toast is GONE. Range annotations stay the scriptMarkup mark and
  now AUTO-APPLY the yellow default highlight (DEFAULT_MARKUP_HIGHLIGHT in
  markupsSlice) at creation; the popover checkbox is the INVERSE — "Hide
  highlights in script" (+ color swatch when shown). If an element already
  carries an annotation, Add OPENS it instead of stacking a duplicate.
- POPOVER (#4-#9,#11): icon + color are single SWATCHES opening picker
  windows (MarkupPickers.tsx): color = the Theme ColorPicker + a Recent row
  (onChange gained a `source` arg — 'wheel' Applies record to viewPrefs
  markupRecentColors; presets don't. ColorPicker.test updated to the new
  contract); icon = presets · recent (markupRecentIcons, grid picks only) ·
  full grid. Any hand pick sets iconManual — AUTO-ICON (firstContentKind in
  markupActions + AUTO_ICON map in markupIcons: numbers→hashtag, checklist→
  check, bullets→dot, link→link, image→image, note→comment; NEW link/image
  icons) runs live on the mini editor and never overwrites a manual choice.
  A paragraph is 'link' only when ALL its text is linked. Links in the body
  are clickable (scrapbook: → selectPage + openTool('notebook'), saving
  first; http → window.open). The ⋮ menu (MarkupDotsMenu) carries Status
  Open/Complete, Hide/Show "<type>" in script, Delete — footer is Save only.
- SUB-POPOVER RULE: every picker/menu portals to body as `.markup-subpop`,
  and the annotation popover's save-on-close treats presses inside ANY
  .markup-subpop as inside itself (else picking a color closes the window).
- SEAT FIX (#2): the popover CLAMPS top into the viewport and seats
  SCREEN-CENTER when no anchor rect exists — off-viewport anchors used to
  seat the window off-screen (the "can't edit some items" glitch) and
  orphans never opened at all.
- MARGIN ICONS (#12): ON the page, centered in the right-margin band
  (rightMargin×96×scale from the rendered page width), vertically CENTERED
  on the selection's span union for ranges / the element's first line for
  block anchors. Paper-light chip styling (page is always white).
- PANEL (#11,#13,#14 + mid-turn adds): dbl-click = requestEditorScroll THEN
  setMarkupEditorId after 160ms (jump + open; pencil/trash gone, ⋮ + quick
  checkbox stay). Header: Filter (two sections with helper text "Select one"
  / "Select all that you want visible" — state rows + a GRID of in-use
  types with Show/Hide all; markupFilters is now {hiddenIcons, done}),
  "Show in Script" (same grid → viewPrefs markupHiddenIcons, PERSISTED,
  shared with the ⋮ toggles; hides margin icons in JS and neutralizes
  highlights via a .markup-type-hidden class the ICON LAYER syncs onto
  spans — the span only knows its id), and Search (markupSearch in the
  slice). Distinct trigger classes .markup-ctl-filter / .markup-ctl-script
  (the Navigator's Filter matches :has-text and steals driver clicks).
- NAVIGATOR (#10): annotation rows SORT INTO the outline by findMarkupPos
  (ties keep the landmark first); orphans + notes still append. The markup
  branch in handleClick must run BEFORE the plain-jump branch — rows carry
  pos now.
- check-v526.mjs: 34 checks green (geometry to the pixel). Driver lessons:
  a dock-row click TOGGLES an open tool (guard with a .markups-panel
  existence check), and an annotation on the doc's LAST line legitimately
  sorts to the outline's bottom — assert interleaving, not "not last".


### v5.25 — MARKUPS: the annotation tool

- Derek's redesign brief: ONE tool for annotating the script, set to replace
  notes / to-dos / sections / markers on the page plus script highlighting.
  "Markup Script" creates over a selection ('range' — highlight color offered)
  or at a bare cursor ('point' — the mark spans the WHOLE current element, the
  createScriptNoteAtSelection rule); a rich-text popover edits it; its
  icon+color sits in the RIGHT margin. REPLACEMENT IS PHASE 2 — deferred until
  Derek shakes the core down; the old tools are untouched this build. His
  naming question (Markups vs Annotations etc.) was answered in chat with
  options; NO rename done — note 'markups' is now a SHIPPED tool id, so any
  future rename is label-only.
- BOTH anchor flavors are ONE mechanism: the `scriptMarkup` MARK. The first
  cut used a zero-width inline `markupAnchor` ATOM for point markups — and
  the LIVE DRIVER caught what tsc/vitest couldn't: every screenplay element
  is `content: 'text*'`, an inline node is invalid EVERYWHERE, and
  ProseMirror's replace-fitter DROPS it silently — store got a markup, doc
  got nothing (a phantom: no icon, no anchor, the silent-no-op sin). Marks
  don't touch content structure, so they're the only anchor this schema
  permits. Empty element + cursor → toast, no markup (never a phantom).
- The model is scriptNote's, deliberately: the doc carries only ids (mark
  attrs markupId+highlight), data lives in markupsSlice keyed by id,
  persisted as `_markups` (composeSaveContent + BOTH hand-written load blocks
  in ScreenplayEditor + the history destructure). Exporters keep marked text
  and drop the mark (fountain/fdx/pdf/docx verified); pagination reads
  textContent only, untouched by marks — the fountain half is pinned by
  tests.
- New files: stores/slices/markupsSlice.ts (data + DEFAULT_MARKUP_PRESETS),
  editor/extensions/ScriptMarkup.ts, components/markupIcons.tsx (24 icons +
  24 emoji + color rows), utils/markupActions.ts (create/find/setHighlight/
  remove/sceneHeadingBefore/pageForPos/kinds/preview), MarkupIconLayer.tsx
  (margin icons INSIDE editor-main, doc-tick repaint — not scroll-driven),
  MarkupPopover.tsx (mini TipTap: StarterKit + Link + Image + TaskList/Item;
  save-on-close; Scrapbook page links as scrapbook:<id> hrefs),
  MarkupsPanel.tsx (cards: page # via computePageBlocks + sceneHeadingBefore;
  double-click jump via requestEditorScroll; OPEN-only default filter),
  MarkupsCustomizeTab.tsx, styles/screenplay/27-markups.css.
- Entry points: ribbon builtins `markupScript` + `toggleMarkups` (palette-
  only, like scriptNotes/tags); context-menu `markupScript` (flips to Edit/
  Delete on an existing markup; passes savedSelection — the script-note
  rule); View ▸ Working Notes check item + Show All/Hide All; the window eye
  (TagsWindowActions pattern); a highlight-click handler in ScreenplayEditor.
  markupsVisible (viewPrefs, persisted) unmounts margin icons in JS and
  neutralizes highlights via .markups-hidden on .page; 16-print.css kills
  highlight + icons + popover unconditionally.
- Customize ▸ Markups: markupPresets (persisted viewState) — chips DRAG to
  reorder (grip sets dataTransfer, the footgun), build a combo from the full
  grid + color dots, floor of ONE preset, Reset to Default. The tab is in
  BOTH CustomizePanelsDialog's rail and Settings' CUSTOMIZE_TABS sidebar
  (soloCategory unions widened in both files).
- Deps: @tiptap/extension-link, -image, -task-list, -task-item @^2.27.2
  (popover mini-editor only; the script schema is untouched).
- Tests (13 new, 848 green): markupsSlice CRUD/filter-default/presets,
  markupActions kinds/preview/pageForPos, fountain exclusion pair (mark
  text survives mark-less; atom vanishes), MarkupsPanel rendered via the
  createRoot harness (open-only default, icon filter, orphan location line,
  complete-drops-card, empty state).


### v5.24 — columns not rows, the drag that never started, tab washes

- Derek's batch (his screenshot showed HIS working checklist — those items
  are his queue, not instructions): (1) "thinking in terms of rows leaves
  odd gaps" → "# of Columns:" label AND a real column MASONRY; (2) card
  drag-reorder dead; (3) window Design knobs; (4) card Design knobs;
  (5, mid-turn) non-active header tabs get a visible button background.
- (2) THE DRAG BUG was the house footgun itself (CLAUDE.md §4): StickyCard's
  grip passed onDragStart straight through, and since v5.22 the consumers
  pass bare closures — NOBODY called dataTransfer.setData, so WebKit refused
  the drag (fine in Chromium's tolerance, dead on the Mac). Fix at the ROOT:
  the grip sets its own payload ('text/plain', card.id) before delegating —
  no consumer can forget again. CardList (Snippets) had the same latent hole.
- (1) `.swn-scroll.swn-grid` is CSS MULTICOL now (column-count:
  var(--sticky-cols)), not grid — cards stack down columns, break-inside:
  avoid, no row alignment. DOM order unchanged (drag/sort semantics intact);
  reading order snakes down columns, which IS the sticky-wall look.
- (3)(4) Token groups: 'stickyWindow' ("Sticky Notes": stickyPadX 12 — the
  side gutter MOVED off the card margins onto the scroller so it's one knob;
  stickyPadTop 6 / Bottom 4, col/row gaps 10/10 — row gap = the sticky-
  scoped card margin-bottom; btn-row pad-top 6 / pad-x 8 as sticky-scoped
  .tool-action-row overrides). 'cards' group RELABELLED "Sticky Note Cards":
  cardPad KEEPS its id (it always drove the TOP edge — persisted overrides
  survive) + new cardPadX 10 / cardPadBottom 10 / cardHeadGap 6 /
  cardFootGap 6 / cardActionsGap 6.
- (5) `.tool-chrome-tab { background: var(--fd-overlay-light) }` (+ medium
  on hover) — one class, every tabbed window (Characters included).
- DRIVER LESSON (recorded the hard way): pointer-driven HTML5 dnd hangs
  under Playwright when dragstart MUTATES the DOM around the pointer (our
  drop zones render on dragstart; both mouse-sequence and page.dragAndDrop
  stall). Dispatch DragEvents with a shared DataTransfer instead — and
  YIELD between dragstart and drop (same-tick dispatch reads stale React
  state; the drop no-ops). The tab drag (no DOM change on start) is why
  v5.22's dragAndDrop worked.
- check-v524.mjs (10 checks): payload-set proof, drop reorders [a,b,c] →
  [b,a,c] + Sort snaps Manual, masonry columnCount, tab wash, four token
  spot-checks driving computed styles.


### v5.23 — compact buttons, the anchored-resize truth, per-row right

- Derek's batch: smaller add buttons; Manual LAST in Sort; the bottom-left
  resize corner moved the wrong edge; "Items per row:" for popped/fullscreen
  Sticky Notes; ALL per-row steppers right-aligned with former right
  occupants swapping left (Pages Go-to, Scenes Reorder).
- THE RESIZE BUG (root cause, ToolDock startResize): the grip and the width
  math follow the tool's HOME side, but the ANCHOR follows position — a
  right-docked window is right-anchored only until startDrag writes `left`
  + `right:'auto'` (its comment even said "until dragged"; resize never
  learned). Fix: `leftGrip = side==='right'`, `anchoredRight` read off the
  inline styles at grab time; a left grip on a LEFT-anchored box hands the
  width change to the left edge (el.style.left = startLeft + (startW − w)),
  applied AFTER the v0.85 slack shrink so the edge tracks the final width.
  Driver-proven with real mouse drags: left edge −80px, right edge ±1.
- Sticky "Items per row:" — stickyPerRow (ephemeral, clamp 1–8, DEFAULT 1
  so nothing moves until touched). Gate: popped = fullscreenTool==='sticky'
  || tempTool==='sticky' || toolMode.sticky==='floating'; docked renders
  plain (no stepper, forced 1 col). Grid via `.swn-scroll.swn-grid` +
  inline --sticky-per-row (class only when >1 → the 1-col rendering is
  byte-identical to before); hint + drop zones span `grid-column: 1 / -1`.
- Add buttons: `.sticky-add-btn { height: 26px; padding: 0 12px; font-size:
  12px }` — dialog-primary COLORS kept, box compacted (wins the tie with
  .dialog-btn on source order). check-sticky-v522's probe check now
  compares colors/radius only, height is deliberately different.
- KNOWN-BY-DESIGN rediscovered while driving: clicking into the script
  MINIMIZES the open tool window (v1.77, keepOpenOnEditorClick exempts
  Typewriter) — drivers must not "click empty space" in the editor to
  dismiss menus; press document.body instead. Also ControlDropdown closes
  on outside PRESS, not Escape (only the filter popover listens for
  Escape).
- check-v523.mjs (9 checks): 26px buttons, sort order, right-aligned
  stepper + 2-across grid in the floating shape, the two resize-edge
  checks, docked has no stepper, Pages swap geometry. check-scenes-v520
  updated to the swapped row (Reorder left ≤14px, stepper right ≤12px).


### v5.22 — Sticky Notes: one interleaved list, reorderable tabs, blank check row

- Derek's refinement of the v5.21 merge: (1) "do not force separating" —
  ONE interleaved list; Sort gains 'type' (default: notes before checklists)
  while 'created' sorts BOTH kinds together; (2) blue add buttons; (3)
  "+ Add Note" / "+ Add Checklist"; (4) To-Do → "Checklist" wording; (5) a
  blank check row replaces the dashed add-field on checklist cards; (6) the
  Filter dropdown became All · Notes · Checklists header TABS, drag-
  reorderable, order persisted, FIRST tab = the view the tool opens on.
  NOTE: his item 5 ended mid-sentence ("move the ") — flagged, awaiting the
  rest.
- Manual sort IS the shelfCards array order now (the Snippets model — drag
  any card anywhere, cross-kind; a drop snaps Sort to 'manual'). CASUALTIES,
  all single-consumer: notesSort/todoSort/noteOrder/todoOrder store fields,
  ScriptNotesContent (ScriptNotes.tsx keeps the color helpers/renderers the
  popover imports), ListControls' arrangeEntries/reorderKeys/entryDragProps/
  ListEntry (file now = cardMatchesSearch + StickySort labels), and the CSS
  for .fs-notes-list/.fs-todo-*/.script-notes-list/.sticky-group-label.
  viewState keys noteOrder/todoOrder linger unread (house pattern).
- New store: stickySort ('type'|'manual'|'created', ephemeral, default
  'type'), stickyTabOrder (persisted); stickyKindFilter INITIALIZES from
  stickyTabOrder[0] — that is what "their preference is first in line" does.
- Tabs: ChromeTabs gained an OPTIONAL onReorder (HTML5 drag; setData is
  mandatory — the WebKit footgun); ToolChrome.onTabReorder wires it
  (Characters passes nothing and stays fixed). In a NARROW docked panel the
  strip collapses to the Section dropdown (v4.53 behavior) — the dropdown
  can't reorder; tabs reorder in fullscreen/wide shapes. Driver runs the tab
  checks in the takeover for exactly that reason.
- Blank check row (StickyCard): a .swn-todo-item.swn-todo-blank with an
  inert checkbox + borderless input; Enter OR blur-with-text commits and
  re-blanks. .swn-todo-new (dashed divider) removed.
- Add buttons wear `dialog-btn dialog-btn-primary sticky-add-btn` — the
  v5.19 Reorder precedent; driver proves computed equality to a probe.
- Drivers: check-sticky-v522.mjs (9 checks: both sort orders exact, probe
  equality, tab wording/click/DRAG — page.dragAndDrop does real HTML5 dnd
  in Chromium — persistence in store+viewState, blank-row commit).
  check-tools-v521.mjs updated to the new labels/tabs reality.
- Rename SCOPE: the sticky window only — the script's own to-do lists
  (Insert → To-Do List, Navigator) keep their name until Derek says
  otherwise.


### v5.21 — the seven-pack: Sticky Notes merge, fullscreen Title Page, one window, and the zombie Window menu

- Derek's queue, all shipped in one batch: (1) Title Page always fullscreen
  "the same as the scrapbook"; (2) Notes + To-Do merged into "Sticky Notes"
  (+ Note / + To-Do in the body's action row, Filter/Sort/Search in the
  header); (3) Locations-style faint separators on the scene list;
  (4) "show one tool window at a time"; (5) "remove the window menu";
  (6) Pages fullscreen floors per-row at 2; (7) Airtable dev panel removed.
- (1) `FULLSCREEN_ONLY_TOOLS = ['titlepage']` (editorStore) — openTool's
  remembered-mode branch takes the fullscreen path for these UNCONDITIONALLY;
  NO_FULLSCREEN_TOOLS is down to ['notebook']. The takeover hides its
  shrink-to-window button and the generic fullscreen button drops
  (ToolDock). toolModeMemory.test's old "Title Page never fullscreens" pin
  is FLIPPED.
- (2) The merge is PRESENTATION ONLY: id 'sticky' kept (label "Sticky
  Notes"), 'todo' retired via the indexcards recipe — RETIRED_TOOL_IDS map
  drives migrateToolOrder/migrateToolConfig (workspace snapshots included),
  activeTool/Right init mapping, and an openTool legacy remap. Card data was
  always one `_shelf` list. Each list keeps its own sort+manual order
  (notesSort+noteOrder / todoSort+todoOrder); ONE header Sort sets both
  ("Mixed" shown if pre-merge state diverged). New store fields stickySearch
  + stickyKindFilter (ephemeral); cardMatchesSearch in ListControls is the
  ONE search predicate (title, text, to-do item lines). Counts: each list
  publishes its own (sticky/todo), StickyTitleExtra SUMS; the body zeroes a
  filtered-out list's count (it's unmounted and can't publish).
- (4) closeOtherFloats(s, keep) in editorStore — a floating WINDOW is the
  temp slot or a panel-slot tool in 'floating' mode (visible panel);
  docked/fullscreen are NOT windows. Called where floats are BORN: all four
  openTool float branches + setToolMode('floating') (drag-out, shrink-from-
  fullscreen). Spread the patch BEFORE the branch's own fields.
- (5) THE WINDOW MENU WAS A ZOMBIE: the JS menu sync dropped it in v4.28,
  but Rust's rebuild_window_menu (lib.rs) re-appended a fresh "Window"
  submenu on every set_window_title and window Destroyed event. Removed:
  that fn, both call sites, the window-list- menu-event handler, and the
  boot menu's Window submenu. VERIFIED as far as this sandbox allows —
  rustfmt parse + zero remaining references; cargo check CANNOT run here
  (Linux GTK headers absent; macOS target needs a real mac toolchain), so
  the first `tauri dev` on the Mac is the compile gate. Pure removals.
- (6) Pages: `pagesPerRow` render value = max(floor, raw) with floor 2 only
  when fullscreenTool === 'pages'; the STORE keeps the raw value, so leaving
  fullscreen restores 1. The minus button disables at the floor.
- (7) The v4.95 Airtable dev panel followed its own in-file removal list
  (file, ALL_TOOLS spread, body case, CSS block; ToolId member stays as a
  legacy union entry; Feedback's Airtable embed untouched, no npm lib —
  no About-list change).
- Driver kit: `window.__scStore` (the store) now rides beside __scEditor,
  DEV-only — drivers set up state deterministically. check-tools-v521.mjs:
  18 checks across all items (takeover shape, dock labels, + buttons, kind
  filter, summed count, separators, one-window rule, fullscreen floor with
  raw store value pinned at 1).


### v5.20 — the Scenes four-pack: contained popover, Cards per row, one menu, lighter cards

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

### v5.16 — 0 means 0; bar side-padding knobs

Derek: "I'll set it to 0 (lets say for padding), but then there is still
significant padding space. make sure that 0 is actually 0 for all options."
The audit grep — `calc(var(--dz-*pad|gap|spacing*) + N)` — plus a manual
sweep found FOUR liars, all fixed:
- the bar's between-section gap AND the big-button row gap both carried a
  hidden `+3px` on top of Section spacing (so 0 rendered 5, and Derek's
  stored 2 rendered 5 — after the fix the same value is 3px tighter, called
  out in the changelog);
- `.rib-sec-title` kept a hard `2px` side inset (survived Side padding 0);
- the bar's right padding was pinned by a later `padding-right: 12px`
  literal that would have silently beaten the new knob (now the knob's
  DEFAULT is 12 and the literal is the var's fallback);
- `.char-profile-detail` padding used `+2/+4` offsets — now ×1.25/×1.5
  RATIOS (identical at the default 8, true zero at zero).
Also (Derek, mid-batch): **Bar left / Bar right padding knobs** (defaults
8/12). The LEFT one must beat the v2.72 auto menu-bar alignment, which
writes an INLINE padding-left that would out-rank any CSS var — Toolbar.tsx
now skips the inline value when `designVars.ribPadLeft` is set; Reset
restores auto-align. (That inline-beats-var trap is the same silent-no-op
class as the fullscreen close bug — check for inline writers before adding
any chrome knob.)
`check-ribbon-zero.mjs` (17 checks): every knob seeded 0 → computed 0
everywhere, bar height == content height exactly, sections TOUCH their
dividers (driver lesson: pair each section with the correct SIDE of the
divider — the first pairing was backwards and false-failed).

### v5.15 — the ribbon Design reorg, and the 1px lie

Derek's spec, delivered verbatim: FOUR Design groups — Ribbon (bar-level:
section spacing, bar top/bottom padding, button radius), Titled Sections
(side/top/bottom padding, row spacing, horizontal button spacing, space
between title and buttons, title font, title alignment, section scale),
Untitled Sections (same minus title knobs), Single-Row Sections (side/top/
bottom padding, icon size, label font size — icon/label were the existing
toolbarBigIcon/toolbarBigLabel, relocated).

**Removed as redundant:** global ribBtnGap + ribRowGap (per-kind now, via a
`--rib-btn-gap-k` / `--rib-row-gap-k` cascade set on the kind classes),
ribTitlePad (the band's own bottom padding did the same job as ribTitleGap —
merged; titleGap default 2→5 so stock geometry is unchanged, band stays 16),
and the two ribPadY* (split top/bottom). Stale designVars keys for removed
ids are simply ignored. Single-row sections are their OWN padding kind —
titled/untitled pad rules carry :not(.rib-single).

**The 1px lie (real bug, pre-existing):** the bar's min-height is BORDER-BOX
and the old formula counted its own 5+2px padding against the content, so
every row was flex-squeezed ~1px SILENTLY and uniformly — invisible until
the per-kind scales made the squeeze asymmetric (titled rows measured
26.75px when only the untitled knob moved; driver caught it inside the 1.5px
tolerance, and the ribsqueeze probe pinned it: bar 78 = pad 7 + 71 for 72px
of content). min-height now adds the padding vars on top of --rib-content-h,
and .rib-row/.rib-sec-title carry flex-shrink: 0 — a mis-sized bar must
OVERFLOW, never silently squeeze. The bar is 1px taller than before at
defaults; that pixel was always owed.

Driver (check-ribbon-kinds.mjs, 15 checks): geometry exact (33→105 both
kinds, titled rows exactly 28 under foreign knobs), one knob per category
verified end-to-end. New driver lessons: Design GROUP heads TOGGLE (make
openGroup idempotent), and per-kind knobs share labels — scope
.dz-group-first, then .dz-row.

### v5.14 — per-kind ribbon geometry

Derek: mixed titled/untitled sections left "a gap where the title is" over
the untitled ones (the v4.5 invisible reserved band). His option (a) shipped:
**untitled two-row sections stretch to a titled section's total height** —
bases level, button tops level with the titled TITLE's top. Plus, mid-batch:
separate Design scale + padding knobs per kind.

- **`ribbonKindVars()` in toolbarBuiltins.ts is the single source** — pure,
  6 tests. Returns kTitled/kUntitled (NUMBERS) + contentH. kUntitled carries
  the auto-fill ((2·rowh+band)/(2·rowh)); the % knobs multiply on top.
  band = titleFont+1.5+titlePad+titleGap and MUST match .rib-sec-title's CSS.
- Toolbar.tsx puts `--rib-k-t` / `--rib-k-u` / `--rib-content-h` on the bar's
  inline style (numbers, so CSS can `calc(base * factor)`) and stamps
  `.rib-kind-titled` / `.rib-kind-untitled` on sections AND groups.
- CSS multiplies row height, small-button box/font, `--rib-itemh` (via a new
  `--rib-itemh-base` so bar-level consumers stay unscaled), and the titled
  band itself by `--rib-k`. The bar's min-heights now read
  `--rib-content-h` so scaled-up sections grow the bar instead of clipping.
- The untitled empty band is `display: none` in a MIXED bar (superseding the
  v4.5 reserve-the-band alignment for exactly that case); `rib-no-titles`
  bars are untouched (no auto-fill — kU = scale% only).
- Scale knobs are STORE-BOUND tokens (`ribScaleTitledPct/UntitledPct` in
  editorStore, persisted in viewState) — the token registry test enforces
  css-var XOR store-bound, and the fallback test requires every cssVar to be
  consumed, so a designVars-only token is not an option. The 4 padding knobs
  are ordinary css-var tokens (defaults 0 = no visual change until used).
- Driver `check-ribbon-kinds.mjs` (10 checks): tops/bases level (Δ≤1.5px),
  buttons grew, knobs move only their kind, padding lands. THREE driver
  lessons, all now encoded there: (1) seed localStorage via addInitScript —
  seeding after a first goto RACES the live app's autosaves, which clobbered
  the seed two different ways; (2) set ALL ten `opendraft:toolbar*NNN`
  migration flags or a migration rewrites the seeded bar; (3) Playwright
  hasText strings are case-INSENSITIVE — "Titled sections" matches inside
  "Untitled sections"; use word-boundary regexes.

### v5.13 — title page out of Pages; the Design field you can type in

- **Pages, title page removed** (Derek reverses his v5.01 ask). The leading
  `titlePage` run is still CARVED off page 1's bound — that split is the
  v4.95 "strange spacing" fix and it stays — but the carved bound is now
  DISCARDED instead of emitted as page 0, and the per-node guard skips
  `titlePage` nodes on every page. A doc that is ONLY a title page previews
  as zero pages (the tool's own empty state). pageThumbnails.test.ts
  rewritten to pin the reversal in both visibility modes.
- **Design number fields committed (and CLAMPED) every keystroke** — Derek:
  "i was trying to type 650 … it immediately changes to 300." A leading "6"
  hit the 300 minimum before the "5" landed; unnoticed until scenesTableMin
  became the first token whose min exceeds one digit. The field now holds an
  unclamped DRAFT while focused; clamp+commit on blur/Enter, Escape abandons.
  Sliders keep instant commit (drag can't leave range). Driver-verified:
  type 650 → 650; Escape reverts; 50 clamps to 300 on commit only.
- **Reorder** wears the exact active-dock-row pair (accent border + accent
  text + grey wash — compared computed against a probe `.tool-dock-item.active`
  in the driver); active reorder stays amber.
- Driver note: Design panel GROUPS render collapsed — expand
  "Navigator & Outline" before looking for `.dz-row`s.

### v5.12 — the table↔caret line is Derek's slider

Derek's ~570px pop-out screenshot: "the window should have already moved the
synopsis field by the time it was this small. add a minimum size option in
the design tool." The hard 520 became `scenesTableMinW` — store field in
sceneNavSlice (persisted via viewState), default 700, driven by a
STORE-BOUND Design token ("Scenes: min width for full table", Navigator &
Outline, 300–2000).
- 700 because: his ~570px pop-out must compress under the DEFAULT, and his
  fullscreen (~1000px of tool width) must keep the table per v5.09.
- SceneNavigator now keeps the measured WIDTH in state and derives
  `navNarrow = navW > 0 && navW < scenesTableMinW` — width from the RO,
  threshold from the store, so moving the slider re-decides the layout LIVE
  with no resize (an RO-only design would sit stale until the next resize).
- Verified: jsdom tests flip the mode by moving the threshold across the
  stubbed 300px width both directions; kit run at exactly 570px shows 4
  carets / 0 inline fields; both existing drivers pass unchanged at the
  default (docked 277 narrow, fullscreen 900 table).

### v5.11 — caret-only again, but a caret you can hit

Derek reverted v5.10 same-day: "revert back to the caret being the only thing
you click to make it expand, but make the clickable area of the caret larger."
- The row's onClick is gone; the caret's hit area is the full row height and
  ~32px wide: 24px track (was 16) + `align-self: stretch` + negative-margin
  padding reaching into the row's left padding. The GLYPH stays 10px — only
  the invisible button grew. Driver measures the box ≥24×36.
- Lesson for the log: v5.10 shipped exactly what was asked and lasted hours.
  When a click target feels too small, offer the bigger-target option next to
  the bigger-behaviour option before building the behaviour.
- Also Derek, same batch: ONE colour for the time estimate in both Scenes
  views — the card time now wears the same `.scene-metric-time` class the
  list uses (accent); the per-card green→red `getTimingColor` scale is gone
  from cards (`getTimingColor` remains in use in the status bar / modal).
  Driver asserts computed equality: rgb(74,158,255) in both.
- The mid-audit rollback also reverted `node_modules` — `npm install` brought
  `playwright-core` back BECAUSE it is a devDependency now; the kit survived
  its first rollback by design.

### v5.10 — the whole row is the caret

Derek: "i should be able to click anywhere on the scene line to open the
hidden info, not just the caret… single click opens the info below" — the
dock-row convention. The toggle went on the narrow ROW
(`.scene-row-narrow`), deliberately NOT on `.scene-info`: the sub-item lives
inside `.scene-info`, so a container-level handler would slam the fold shut
on any click inside it (the metrics line, the padding). The caret keeps its
own handler with stopPropagation — without it a caret click would toggle
TWICE through the row and read as dead. Double-click still jumps: its two
clicks toggle twice (net unchanged, a brief flicker) and then the jump
fires; the driver pins "fold as it was" after a dblclick. 3 new jsdom tests
+ 5 new driver checks (21 total in check-scene-narrow.mjs).

### v5.09 — narrow Scenes fold behind a caret; the isolate:false lesson

**Scenes narrow mode** (Derek): under 520px of tool width the synopsis field,
page length and runtime fold into a per-scene sub-item behind a caret; wide
keeps the five-column table untouched.
- Narrow is a JS fact (ResizeObserver on `.scene-navigator`), NOT a container
  query — the two modes need DIFFERENT DOM (a caret button, a collapsible
  sub-row) and CSS cannot conjure elements. The old `@container scenelist`
  rules are deleted.
- The row's cells are built ONCE per scene and composed per mode, so the
  sub-item is the SAME synopsis input and the SAME metrics — not copies.
- jsdom has no ResizeObserver → tests default to wide (all v5.02+ tests
  unchanged); the narrow tests stub RO and REMOUNT (the observer effect has
  [] deps — re-rendering the mounted instance never observes again; that
  remount was a real first-attempt failure).
- Cards view: the time estimate always renders, `?? 0` → 0:00 (Derek,
  mid-batch ask). The meta strip no longer vanishes on timeless scenes.
- Driver `check-scene-narrow.mjs` (16 checks): docked carets/fold/type-
  persist, fullscreen table intact, cards times. Two driver lessons: the
  View dropdown trigger COMPACTS to its current value ("List") when the
  header is tight — match /^(View|List|Cards)/; dropdown items are
  `.tool-ctl-menu-item` in a `.tool-ctl-menu`.

**The isolate:false story (READ before touching vitest.config.ts).** The
speed audit set `isolate: false` (suite 34–50s → ~10s). Within hours the
gate flaked: Scrapbook caret/focus tests red only under certain worker
cohabitations, 2-of-3 runs. Found and FIXED two real leaks
(`src/test/sharedEnvReset.ts`, kept: document junk + notebookStore pages
accumulating across files) — still 1-of-5 flaky, so the config went BACK to
full isolation. The suite is ~34s, deterministic, run ONCE before commit;
iteration lives on `npx vitest related <files> --run` (~3s). Do not re-try
isolate:false without hunting the remaining leak to extinction first.

### v5.08 — Pages controls say what they mean

Derek's four Pages asks, all landed:
- **"Pages per row: N"** replaces the − Zoom + pair. The store field is now
  `pagesPerRow` (1–8, clamped in the slice, default 3) and the grid is
  `repeat(var(--pages-per-row), 1fr)` — the count IS the model, not a derived
  effect of a column min-width (`pagesThumbPx` and the `--pages-thumb-w`
  minmax grid are GONE). The ResizeObserver text-scaling pipeline is untouched
  — thumbnails still size to their rendered column. Readout is
  `.tool-action-count` (fixed min-width + tabular digits so the row doesn't
  shuffle at 9→10... at 8, rather).
- **"Go to page:"** label; the `#` placeholder is removed.
- **Air below each page**: `.page-thumb-wrapper { margin-bottom:
  var(--dz-pages-row-gap, 14px) }` — the label sits ABOVE its page, so the
  wrapper's bottom margin is exactly "between the bottom of a page and the
  next page's number". Exposed in Design ▸ Navigator & Outline as
  `pagesRowGap` ("Pages: space below each page"); the def-equals-fallback
  test pins 14.
- Verified with the kit (`devtools/check-pages-controls.mjs`, 13 checks):
  labels, no placeholder, count↔grid-columns lockstep at default/floor/
  ceiling, buttons disable at the clamps, and the token drives the computed
  margin end-to-end. Kit fix along the way: `fullscreen()` now waits on the
  generic `.fs-tool-takeover`, not a Scenes-only class.
- Old `pagesThumbPx` in a persisted viewState is simply ignored (the key was
  session-only anyway — no migration needed).

### v5.07 — resize bars split the difference

Derek: "make the column adjustment bars less visible (halfway in between the
original format and the current format)." Original = 1px --fd-hairline
(invisible, #2a2a2a on #2b2b2b); v5.04 = 2px --fd-text-muted at 0.65.
Halfway = 1px, same muted colour, opacity 0.32; the hover/active accent stays
full strength, which is where findability now lives. Verified computed style
via the kit (1px / 0.32 / rgb(153,153,153)); geometry checks all Δ0.0px.

### v5.06 — a column is what the eye groups

Derek's marked-up screenshot (red lines): "the titles are still not centered,
and the column adjustment bars are still not in the right place." His marks
define the COLUMNS as the eye reads them — Scene = number badge + heading,
Length = figures + icon — while v5.05 had centred each title on its single
grid track, which is why both sat visibly off his centre lines.

- `.scene-col-title-head` spans `num-start / head-end`, `.scene-col-title-met`
  spans `metrics-start / icon-end` — grid-template-areas NAMES those lines, so
  the spans stay glued to the template. The grips didn't move: each title's
  spanning edge at the gutter is the same physical edge as before.
- First delivery driven by the speed-audit kit: `devtools/check-scene-header.mjs`
  printed all five geometry checks (3 title centres vs region midpoints, 2 bar
  centres vs gutter midpoints) at Δ0.0px in **4.4s** — the old-style driver
  took ~100s per run. `vitest related` mid-loop (3s), full suite once (12s).

### v5.05 — where an element SITS is its format

- **Column titles.** Derek: "the titles are not centered over the columns.
  make the column titles have the same format." They were nested inside the
  data cells — `.scene-heading-text` sets 14px + `--screenplay-font`,
  `.scene-metrics` sets 11px — so the three titles inherited three different
  fonts and no rule on `.scene-col-title` could undo a font it never set.
  They are siblings of one class now, direct children of the header, each
  assigned its grid area (`.scene-col-title-head/-syn/-met`). One inherited
  format, `text-align: center`, done. A test asserts `parentElement === header`
  for all three — that IS the format guarantee.
- **The resize bars** are centred ON the gutter, and the gutter is now a
  variable: `--scene-col-gap: 22px` drives `column-gap` AND the grips'
  `right/left: calc(-1 * (var(--scene-col-gap)/2 + 5.5px))`. It was 10px
  before, and a 2px bar centred in a 10px gutter has 4px of air either side —
  arithmetically centred, visually flush against the next column, which is what
  Derek was reporting. Measured after: gutter 681→703, midpoint 692, bar at
  692; second gutter 1022→1044, midpoint 1033, bar at 1033.
- **Double-click to jump** (`onDoubleClick` on `.scene-info`, no `onClick`).
  A test reads the fiber props and fails if an `onClick` comes back.
- Careful when measuring a centred label in a driver: `selectNodeContents` on
  the title span unions the absolutely-positioned GRIP inside it, and reported
  "Scene" 79px off centre when it was exact. Range over the text node only.

### v5.04 — "clicking it doesn't do anything"

Derek: "the items in the list are still clickable, even though clicking it
doesn't do anything anymore (it changes the cursor to the pointer finger)."

**The real fault was full screen, and it was in TWO places.** A fullscreen tool
OWNS the editor area — the editor is not mounted behind it and the scroll
container is null. Both scene lists tried to finish the jump themselves:
- SceneNavigator captured `scrollContainer` in goToScene's closure — the null
  from while the takeover was up.
- IndexCards had a comment saying "the prop is captured null while the takeover
  renders — re-query", and then didn't re-query. Its only working path was a
  `document.querySelector('.editor-main')` fallback that had drifted away.

And the deeper reason a component CAN'T finish the job: lowering the takeover
unmounts the panel that asked. A pending target held in that component dies
with it. I tried exactly that first (a local `pendingScrollPos` + effect) and
it measured scrollTop 0 — worth remembering before reaching for it again.

- **`requestEditorScroll(pos)` / `pendingEditorScroll` / `clearEditorScroll`**
  are store actions now. ScreenplayEditor — which always lives and owns both
  the editor and the container — consumes the request in an effect keyed on
  `[pendingEditorScroll, editor, editorMainEl]`, so it fires the moment the
  editor area comes back. Both lists just say WHERE. Two copies became none.
- **`editorMainEl` is state, not `editorMainRef.current`.** Reading a ref
  during render to pass as a prop is wrong on principle — null on first render,
  and a ref changing never re-renders. A callback ref feeds both the ref (still
  used imperatively in ~8 places) and the state the tools receive.
  IndexCards no longer takes a `scrollContainer` prop at all.
- Verified: docked list click 4563 → 65 → 4609; fullscreen click lowers the
  takeover, mounts the editor and lands at 2833 (was 0); a Cards click from
  fullscreen lands at 1257.
- **Note on what fullscreen does now:** lowering the takeover CLOSES the tool
  (enterToolFullscreen had cleared its panel slot). Clicking a scene therefore
  shows you the script at that scene and the Scenes tool goes away. Flagged to
  Derek — if he wants the tool to stay, it needs the slot restored on exit.

**Also (Derek, same batch):** the synopsis helper text is gone from both views;
the column resize grabbers are visible (they were `--fd-hairline`, i.e.
`--fd-border` #2a2a2a on a #2b2b2b header — right for a passive chrome edge,
wrong for something you must find and grab; now `--fd-text-muted`, 2px, full
header height, accent on hover); column names are centred over their columns
and Reorder is left-aligned again; and the Cards expand button moved into the
card's top row. **That last one needed a CSS change, not just a JSX move** — it
was `position: absolute`, so after the move it anchored to a different
ancestor and rendered OUTSIDE the card (x=1178 on a card ending at 742). It is
a flex item with `margin-left: auto` now.

### v5.03 — resizable scene columns; the full-screen close bug

**The bug worth remembering.** Derek: "clicking on the tool name in the side
panel should close it, including if it is in full screen mode." It didn't.
`enterToolFullscreen` CLEARS the tool's panel slot and raises a separate
`fullscreenTool` field — so the dock's own close test, `activeId === t.id`,
saw a fullscreen tool as CLOSED. The click fell through to the open path and
re-entered the fullscreen it was already in. A live-looking control writing
into the void. `toggleTool` had known the right test all along (it checks all
four slots); the dock had grown a second, narrower copy of the question.
- `isToolOpen(id)` and `closeTool(id)` are now store actions and THE answer.
  `toggleTool` delegates to them; so do the dock row, its caret and highlight,
  and the collapsed icon rail (which used to DOCK a fullscreen tool instead of
  closing it). 10 tests in `stores/isToolOpen.test.ts`.
- ToolDock takes them off its existing whole-store `useEditorStore()`
  destructure on purpose: `useEditorStore((s) => s.isToolOpen)` subscribes to a
  STABLE function identity and would never re-render when `fullscreenTool`
  changed, leaving a stale chevron.

**Scenes list (Derek's four follow-ups to v5.02).**
- **Click-to-expand is GONE.** Everything the panel showed — page count,
  runtime, synopsis — is on the row now. Clicking a scene jumps to it, full
  stop. `.scene-synopsis-expanded` / `-text` / `-empty` / `-edit-btn`,
  `.scene-detail-meta`, `.scene-meta-item` and `.navigator-scene.expanded` are
  all deleted.
  - **CONSEQUENCE, flagged to Derek:** that panel's Edit / + Add button was the
    List view's ONLY entry point to `SynopsisModal`, so scene COLOUR and the
    runtime override are Cards-view-only for now. The modal itself is alive
    (IndexCards opens it); SceneNavigator's unreachable copy was removed.
- **Resizable columns.** `sceneColWidths: {head, metrics}` in the store,
  persisted in viewState, reaching the grid as `--scene-col-head` /
  `--scene-metrics-w` on the navigator root. The synopsis column takes the
  slack, so two numbers describe the whole table. The header row wears
  `.scene-heading-row` ITSELF — same template as the data rows, so a resized
  column cannot line up in one and miss in the other. During a drag the CSS
  var is written straight to the element; the store commits on release.
  - **The grip that couldn't be grabbed:** `.scene-metrics` clips its text
    (`overflow: hidden`) and the metrics grip hangs off that cell's LEFT edge
    at -9px, so it was clipped away entirely. The drag reported zero movement
    until `.scene-list-header .scene-metrics { overflow: visible }`. Found by
    driving it, not by reading it.
- **The container moved from `.navigator-list` to `.scene-navigator`.** A
  container query only reaches its container's DESCENDANTS, and the column
  header is a SIBLING of the list — anchored on the list, the rows collapsed
  to two lines while the header went on drawing five columns above them.
- **Both figures on every row**, `0:00` included, with runtimes in the accent
  colour and page counts in muted text (Derek: "make all of the times a
  different color than the page count").
- **Reorder** is bigger, centred (`margin-inline: auto` in the flex action
  row), with its own resting fill and AMBER while active — "on" must not look
  like "available" when it is holding an unapplied order.

### v5.02 — the Scenes list is a TABLE

Derek posted a mockup: "this is what i want the scene list page to look like.
spacing and alignment is not exact here. make spacing and alignment uniform."

- **Five columns, the same five on every row**: number · heading · synopsis
  field · "0.19 page 0:10" metrics · length icon. `.scene-heading-row` is a
  GRID with `grid-template-areas`, and every cell renders unconditionally —
  an unnumbered scene still gets its `.scene-num-cell`, a scene with no page
  length still gets its `.scene-length`. v5.01's `.scene-synopsis-col`
  rendered only when a synopsis existed, so the column was there on some rows
  and absent on others. That class is gone.
- **THE RULE THAT MAKES IT LINE UP: no track may size to its own content.**
  Each row is its own grid box — they are separate elements, not a table — so
  an `auto` track measures THAT row's text and the columns land at different
  x on every line. Number, metrics and icon are fixed widths; only the two
  text columns are `fr`. Measured in Chromium: every column now reports one
  distinct x and width across all rows (before: synopsis fields at 126px and
  132px). A test reads the stylesheet and fails on `auto` / `min-content` /
  `max-content` / `fit-content` in either template.
- **The synopsis is editable in the row.** Uncontrolled `<input>`, `key`d on
  `${id}:${synopsis}` so it re-seeds when the stored value changes; commits on
  blur/Enter, reverts on Escape, stops click propagation so it doesn't expand
  the row and jump the editor. Clearing it writes `''` — it does not silently
  keep the old text.
- **One write path**: `setSceneHeadingAttrs(sceneIdx, attrs)` +
  `writeSceneSynopsis(sceneIdx, id, text)`. `handleSaveSynopsis` (the modal)
  was inlining its own doc walk; both go through the helpers now, so the
  inline field and the modal cannot drift. Store AND document, together —
  writing only the store loses the text at the next scene rescan.
- **Field styling comes from `--fd-input-bg` + `--fd-border`**, the pair every
  other input in the app uses. My first pass set `background: transparent`,
  and since `--fd-border` is `#2a2a2a` against a `#2b2b2b` row the field was
  invisible — it read as plain text with no affordance. Caught in a
  screenshot, not in the source.
- **Narrow fallback**: `.navigator-list` is a `container-type: inline-size`
  container named `scenelist`. Docked, the list is ~277px and five columns
  leave the synopsis 34px — a stump. Under 520px the row wraps to two lines
  (heading + icon, then synopsis + metrics), still with fixed tracks. The
  WIDE layout is the default so a renderer without container-query support
  falls back to what Derek asked for, not to the compromise.
- The `.scene-length` hover tooltip is gone: it said "0.19 page · 0:04", which
  the metrics column now prints on the row in plain sight.
- 19 new tests (`SceneNavigator.row.test.tsx`). Note for whoever writes the
  next one: React 17+ maps `onBlur` to the native **focusout**; dispatching
  `blur` fires nothing and the commit assertions pass vacuously. That happened
  here and the tests only went green after switching to `focusout`.

### v5.01 — tool action rows; Scenes synopsis column; Pages title page

- **`ToolActionRow`** (ToolControls) is the new home for a tool's OWN actions:
  the first row of its BODY, left-aligned, buttons wearing `.tool-action-btn`
  (real shape + fill). The window HEADER keeps only what every tool shares —
  Filter / Sort / View / Search. Renders nothing with no children, so a tool
  without actions gains no empty strip. Adopted so far by SCENES (Reorder) and
  PAGES (Zoom, Go to). The other candidates, if Derek wants them moved:
  Scrapbook's create/declutter, Feedback's screenshot pair, Tags' eye,
  Outline's Arrangement, Navigator's numbers toggle.
- `.tool-action-right` uses `margin-left: auto` for the right-aligned group
  (Pages' "Go to:"), so it holds the edge at any panel width.
- **Scenes synopsis is a COLUMN** (`.scene-synopsis-col`), not a second line.
  `flex: 0 1 45%` and rendered ONLY when a synopsis exists — a column that
  claimed its share on every row truncated every heading in a docked panel to
  pay for summaries that weren't there.
- **The Pages title page is back, as its own page** (pageNumber 0, labelled
  "Title Page"). v4.95 had removed it to stop it printing on top of page 1;
  the split is on the page BOUNDS now, which fixes the bleed AND keeps the
  page. `breaks[].nodeIndex` indexes the node list, so the nodes are never
  filtered — only the bounds are carved. 6 tests, both visibility modes.
- Page labels moved ABOVE their page; the separating border went with them (a
  rule under a caption would divide it from the page it names).

### v5.00 — the screenshot drag is REMOVED

- Derek, final word: "dragging screenshots does not work. remove that language
  and just make it so i can copy/paste the file or download/upload." WKWebView
  never carried a File out of a dragstart, so on the desktop app the gesture
  could only fail.
- GONE: `attachShotToDrag`, `probeFileDrag`, `canDragFiles`, the chip's
  draggable/dragstart/setDragImage, `.feedback-shot-draggable`, the
  `attachShotToDrag.test.ts` file, and every "drag" string in the tool —
  including the two header screenshot tooltips. A test asserts the rendered
  chip contains no "drag" anywhere, so the language can't creep back.
- TWO routes remain, both the user's own gesture INSIDE the cross-origin form:
  **Copy → paste** (`copyCanvasToClipboard`) and **Download → upload**
  (`saveScreenshotCanvas`). Verified in Chromium: no drag attributes, and Copy
  still puts a real 78KB image/png on the clipboard.
- Reintroducing a drag would need a NATIVE one — write the PNG to disk at
  capture and drive it from Rust (a Tauri drag plugin + the deferred fs-scope
  work). Don't re-add the DOM version; it is a control that cannot work here.

### v4.99 — the drag is offered only where it can work

- Derek confirmed it: "drag still doesn't work, but copy and pasting
  screenshots work." WKWebView will not carry a File out of a dragstart.
- `probeFileDrag(make)` / `canDragFiles()` in FeedbackTool ask the engine the
  same question the real drag asks — `items.add(File)`, then does `types`
  report `Files`? — on a throwaway DataTransfer at first use, no user gesture
  needed. Where the answer is no, the chip is not `draggable`, gets no grab
  cursor, no drag title, and the hint leads with Copy. CLAUDE.md §3: a control
  that looks like it works and does nothing is worse than a missing control.
- Two layers, deliberately: the static probe decides whether to OFFER the
  drag; `attachShotToDrag`'s return value still catches an engine that
  advertises the capability and then refuses, and flips the hint for good.
- **A v4.70 test had to change**: it asserted `setData('text/plain', name)` on
  every drag. That is now the no-file FALLBACK only — setting text up front
  advertises a TEXT drag, and a dropzone that sniffs `types` then ignores the
  image, which is half of why this never worked. Replaced with cases pinning
  the new contract (not draggable where files can't be carried; Copy present).
- If a native drag is ever wanted: write the PNG to disk at capture and use a
  Tauri drag plugin. Needs the deferred fs-scope work and is untestable here.

### v4.98 — Feedback capture: Copy/paste route

- Derek: "screenshot dragging is not working" — i.e. WKWebView will not carry
  the file, the case v4.97's probe was built for and the one this sandbox
  cannot test (no WebKit here).
- **`copyCanvasToClipboard()`** in utils/screenshot is the route that does not
  depend on drag support at all: the paste happens INSIDE the cross-origin
  form, by the user's own gesture, so it reaches where our drag can't.
  Verified end to end in Chromium — clicking Copy put a real 78KB `image/png`
  on the system clipboard, read back with `navigator.clipboard.read()`.
- **The load-bearing detail** (6 tests, one dedicated to it): the ClipboardItem
  value must be the PENDING `toBlob` promise, not an awaited Blob. Awaiting
  first spends the user activation and WebKit refuses the write as "not
  triggered by the user". Chromium accepts either, so this shape is right for
  both — do not "simplify" it to `await`.
- The chip remembers a refused drag and says so in its hint line for good; a
  toast alone was missable, and "it just doesn't work" is the worst thing this
  chip could say.
- STILL OPEN if Copy also fails on his machine: write the PNG to disk on
  capture and start a NATIVE drag (needs a Tauri drag plugin + the deferred fs
  scope work). Not attempted — untestable here, and a dependency add.

### v4.97 — Feedback capture drags as a real file

- `attachShotToDrag(dt, file, url)` (exported, 7 tests) loads a dragstart:
  `items.add(file)` FIRST — the only call that makes the drop target see
  `dataTransfer.files` — then Blink's `DownloadURL` descriptor, and
  `text/plain` ONLY if no file attached. Setting text up front advertises a
  text drag, and a dropzone that sniffs `types` takes the text branch and
  ignores the image.
- It RETURNS whether the file took (`types` includes 'Files' after the add),
  and the chip toasts when it didn't — a webview without outgoing file drags
  now says so instead of dragging nothing.
- Whole chip is the drag handle; buttons opt out with
  `draggable={false}` + `onDragStart preventDefault`.
- **Verified in Chromium through a real DataTransfer**: types
  `["downloadurl","Files"]`, 1 file, correct name/`image/png`/~240KB, no
  `text/plain`. NOT verifiable here for WKWebView — no WebKit in the sandbox,
  which is exactly why the probe-and-report path exists.
- Gotcha for future drag tests: `effectAllowed` CANNOT be set on a synthetic
  DataTransfer — a bare `new DataTransfer()` set to 'copy' reads back
  'none'. That is the harness, not the code; don't chase it.

### v4.95 — Pages fixes, Feedback CSP, Airtable dev panel

- **The Feedback form was CSP-blocked in release builds.** FeedbackTool has
  framed an airtable.com form since v4.23, but `app.security.csp`'s
  `frame-src` never listed the host — a blocked frame is a silent empty box,
  so it would have read as "the panel is blank", not as an error. Found while
  checking the dev panel below stays out of shipped builds. `frame-src` now
  includes `https://airtable.com` — **that entry belongs to FEEDBACK; do not
  strip it with the dev panel.**
- **Page 1's "strange spacing"**: `computePageBlocks` emitted `titlePage`
  nodes as ordinary blocks even when `visibilityOpts.hideTitlePage` was on, so
  the preview drew the title page on top of page 1's script while the editor
  showed neither. Skipped in the block loop, NOT filtered out of `nodes` —
  `breaks[].nodeIndex` indexes that list, so dropping entries would shift
  every page boundary. 5 tests over a stub doc.
- **Scaling left the text behind**: the thumbnail ResizeObserver watched only
  the scroll container, whose width never changes when the grid's COLUMN width
  does. It observes the first thumbnail now (and `pagesThumbPx` is a dep).
  Verified: 123px→0.148, 253px→0.308, 79px→0.094.
- **Airtable dev panel** (`src/dev/AirtableDevTool.tsx`) — TEMPORARY, dev
  only, removal checklist in the audit doc. Kept out of release builds by the
  `import.meta.env.DEV` guard on its ALL_TOOLS entry; confirmed against a
  production bundle that the component tree-shakes away entirely.

### v4.94 — Pages search + preview scaling

- `pagesMatching()` in SceneNavigator is the search rule (6 tests). An empty
  query returns the SAME array, not a copy — the thumbnail grid re-renders
  otherwise. Filtering keeps real page numbers: renumbering survivors 1..n
  would be a lie about the script, and clicking a thumbnail jumps to that page.
- Scaling is `pagesThumbPx` (80–320 by 40, clamped in the SETTER so no caller
  can push it out of range), applied as `--pages-thumb-w` on the grid's
  `auto-fill, minmax(...)`. The thumbnails already size to their column via a
  ResizeObserver, so one number drives both preview size and columns-per-row.
- Buttons reuse `CircleMinusIcon` / `CirclePlusIcon` — the toolbar's own zoom
  glyphs, so "make it bigger" wears one face across the app.
- Watch hook ORDER here: the `shownPages` memo must sit after the
  `pageContent` memo it reads. Placing it with the other store reads near the
  top of the component was a use-before-declaration tsc error.

### v4.93 — Locations "Scene order" sort

- Derek asked to ADD "scene order" to the Locations sort. The existing
  default, "Script order", already WAS that ordering (first appearance), and
  the app names the same idea "Scene #" in the Notes/To-Do sorts — so it was
  RENAMED, not duplicated. A second entry sorting the list identically is two
  controls doing one job, which is the drift this codebase keeps re-learning.
  The union member went `script` → `scene` to match (ephemeral state, not
  persisted, so the rename is free).

### v4.92 — Locations controls, scene-scan gate fix

- **The v4.82 rescan gate was wrong.** `scenesNeeded` listed Scenes,
  Navigator and Characters — but Pages, Locations and Structure are
  SceneNavigator VIEWS under their own tool ids and render from
  `store.scenes` too. Open one on its own and the scan stayed gated off, so
  the tool sat on an empty list ("No locations yet") forever; it only ever
  looked right when another scenes-reading tool happened to be open. The list
  is the named constant `SCENES_READERS` now — one place to add a reader.
  **Found by driving the app, not by reading the code**: the Locations list
  came back empty in the driver and the gate was the reason.
- `visibleLocations()` in SceneNavigator is the pure Filter/Sort/Search rule
  (8 tests). INT/EXT tests "has any scene of this kind", so "INT./EXT. CAR"
  and a location shot both ways survive either filter — a location list is
  about places, not about one heading.
- State lives in sceneNavSlice (`locationSearch` / `locationFilter` /
  `locationSort`) because the controls render in the window CHROME
  (`TOOL_CHROME.locations.Controls`) and the list in the body — two
  components, one state, so no control can be decorative.
- The location caret leads the row; `.location-chevron` gets a fixed 10px
  width because the down and right glyphs differ, and without it every name
  shifted sideways on expand.

### v4.91 — header tabs re-expand, icon centering

- **`naturalWidth` must never count a LEFT margin.** `.tool-chrome-right`
  carries `margin-left: auto` as the row's spacer, and `getComputedStyle`
  resolves an auto margin to its USED value — the row's entire leftover
  space. So `need` grew in lockstep with the row and the fit test could never
  succeed: once the tabs collapsed to a dropdown they stayed collapsed at any
  window size. **v4.67 misdiagnosed this** as a stale ResizeObserver and
  re-bound the observer; the observer was firing the whole time, the
  arithmetic was self-defeating. Now counts `marginRight` only (which is what
  the real spacing in this row is — the title's `--dz-toolwin-title-gap`).
  `naturalWidth` is exported and has 5 tests over stubbed layout.
- **Icon centering**: the header icons shipped at 11px in a 30px button —
  9.5px a side, a half pixel the renderer rounds one way or the other
  depending on the button's own fractional x, so the glyph crept as the
  window resized. Now 12px (a whole 9px a side), scoped to
  `.tool-chrome-actions svg`. The separator is an **inset box-shadow**, not a
  `border-left`: with border-box sizing the border ate 1px of the 30px, so the
  bordered button's icon sat half a pixel off its unbordered neighbour's.
  Measured dx/dy = 0 for both buttons at four fractional window widths.

### v4.90 — one edge line, docked close button

- **`--fd-hairline` is now `var(--fd-border)` at `--fd-hairline-w: 1px`** —
  i.e. the status bar's own line. Derek: every seam should match the
  horizontal line above the footer, which the brighter 0.5px text-derived
  hairline (v4.40) did not. `.status-bar` reads the tokens now instead of
  spelling out `1px solid var(--fd-border)`, so the reference and the copies
  can't drift.
- **The ONE exception is `.tool-window`'s own border**: `--fd-border`
  (#2a2a2a) against `--fd-bg` (#2b2b2b) is a one-value difference, and a
  floating window has the SAME colour on both sides of its edge — which is
  why it was invisible in the first place. It stays mixed from `--fd-text`,
  now at 10% (the quietest weight that still reads).
- **The docked strip carries a close ×** beside its fullscreen button, both
  in the shared pinned `.tool-chrome-actions` box. The v4.40 editor-facing
  placement is retired — with a close button beside it, the pair belongs
  where every window's buttons are.
- **Watch the padding SHORTHAND**: `.tool-inline-header`'s `padding:` lives in
  22-tools-extra.css, which loads AFTER 20-tool-dock.css, so a `padding-right`
  rule in the latter silently lost — and the controls ran under the pinned
  buttons with their labels clipped. The action-width reservation rides the
  shorthand now.
- The docked controls need `min-width: 0` (shrink and wrap INSIDE), the
  opposite of `.tool-chrome-right`'s `max-content` in a window header: that
  band wraps to a second row because a title shares its line, while the strip
  has no title and is the only in-flow item, so it has nothing to wrap against.

### v4.89 — header fullscreen button height

- `.char-profiles-fullscreen-btn` carries `align-self: center` from
  10-character-profiles.css (v4.42, when it was a small centered glyph), and
  a child’s `align-self` BEATS the parent’s `align-items: stretch` — so the
  close button filled the header and the fullscreen button did not. The
  shared action-button rule sets `align-self: stretch` explicitly now.
  Lesson: my v4.87 driver measured the icon inside its button and the actions
  CONTAINER against the header, but never each button against the header —
  so it passed while the thing Derek could see was wrong.

### v4.88 — per-character custom fields, character-record cleanup

- **`CharacterCustomField.owner?: string`** (upper-cased character name).
  Absent = shared by everyone, which is what every pre-v4.88 field is — so
  nothing migrates and old data behaves identically. `characterFieldsFor()`
  in characterSlice is the one place the rule lives; CharacterProfiles calls
  it rather than filtering inline.
- **`promptWithCheckbox()`** added to ConfirmDialog (not a bespoke dialog —
  the shell, Escape/Enter handling and fail-safe stay shared). The checkbox
  state is mirrored into a REF because `answer` is a stable useCallback;
  reading the state there resolves the value the checkbox had when the dialog
  opened, which looks exactly like a working checkbox that does nothing.
  Five render tests pin it, including that hazard.
- Character record: the bottom swatch row is gone (the picker beside the name
  was always the other half of a two-controls-one-value pair). The List view's
  enlarge button is gone too — the caret already opens the full profile there.
  CARDS view keeps it: a card shows essentials only, so it is the only route
  to the whole record.

### v4.87 — header corner actions, softer window edge

- **`.tool-chrome-actions`** (new span in `HeaderRightCluster`) holds
  fullscreen · shrink · close and is PINNED by CSS to `.tool-window-header`'s
  top-right corner (`position: absolute; top/right/bottom: 0`). The header
  reserves the width as `padding-right` via `--tool-actions-w`, set by three
  `:has()` rules of increasing specificity (30/60/90px = buttons actually
  rendered). Watch that reservation: the FULLSCREEN TAKEOVER has no
  fullscreen button, and my first pass mis-sized it, which is why the
  controls ran under the buttons instead of wrapping.
- **Why pinned, not in flow**: right-aligning an item mid-sequence means
  consuming the line's free space, which forces the tabs/controls onto a
  second row in EVERY window. Pinned, they stay in the corner and only the
  flow content wraps — which is exactly Derek's rule (name + count + those
  buttons on row 1, everything else below).
- **`.tool-chrome-right { min-width: max-content; max-width: 100% }`** is the
  piece that makes the wrap actually happen — flexbox only wraps an item it
  is not allowed to squeeze. `max-width` keeps the escape hatch for a band
  too wide even for its own row.
- Separator is a `border-left` drawn by `+` sibling selectors, so a window
  without a fullscreen button gets no stray edge. Icons: `svg { display:
  block }` takes them off the text baseline.
- The DOCKED strip (`.tool-inline-header`) is deliberately NOT part of this:
  one editor-facing fullscreen button, no close (ToolDock ~line 1091). It
  keeps the in-flow full-height treatment.
- Window edge softened 32% → 18% of `--fd-text`; 0.5px is already the
  thinnest a border renders, so contrast was the only lever.
- Character custom fields render `.char-profile-textarea rows={2}` — the
  same control as the built-in fields, not the one-line `.char-profile-input`.

### v4.86 — menu check items, hidden panels, header buttons

- **Scrapbook first run**: `seedFirstRun()` in notebookStore gives a
  never-used Scrapbook one section holding one page, selected. Seeded ONLY
  when `localStorage.getItem('opendraft:notebook')` is `null` — a notebook
  the user EMPTIED stays empty (re-seeding there resurrects deleted work).
  `load` is exported as `loadNotebook` so the branch is unit-tested.
- **Menu Show/Hide → check items** (Derek): Scene Numbers + all five
  Working Notes items keep a stable "Show …" label and carry `checked`,
  matching Show Rulers. v4.22 had gone the other way; the rule for anything
  added to those menus is stable label + `checked`, never a flipping label.
- **View menu loses Customize… and Design…** — both are tools with their
  own buttons; View is about what you're looking at.
- **Native menu ampersands** (root cause): muda reads `&` as a mnemonic and
  strips it, so "Spelling & Grammar" rendered as "Spelling  Grammar".
  `nativeText()` in nativeMenuSync doubles `&` on EVERY native `text:` —
  fixed at the sync boundary, not in the labels, because the same labels
  feed the in-window menu bar where `&` is just an ampersand.
- **A hidden side panel stays hidden** (Derek): `openTool` floats a tool
  whose home panel is hidden instead of re-opening the panel, clearing the
  stale panel slot so the tool can't end up open twice. It does NOT write
  `toolMode` (v4.81's rule), so the tool docks again once the panel returns.
  `toggleTool`'s "open" test now requires the panel to be SHOWING — a tool
  stranded in a hidden panel was making the ribbon button a silent no-op.
- **Window action buttons** are full-height plates on their own background
  (`align-self: stretch` + negative margins over the header padding, 30px
  wide, color-mixed off `--fd-navigator-bg`). Scoped to fullscreen/shrink/
  close ONLY — Derek's explicit line is that filter/sort/view/search stay
  small centered controls. `.fs-nb-close` opts back out (no header there).
- **Popped-out windows get a visible edge**: `.tool-window` border is a
  0.5px line mixed from `--fd-text`, since the window and the editor behind
  it share `--fd-bg` and `--fd-border` was invisible between them.

### v4.85 — ribbon title groups, tool toggles, Scrapbook close

- **Title spans a joined block** (Derek): sections separated by a REMOVED
  divider (v4.75 `nd:`) render as one `.rib-group` — a single title band
  above a `.rib-group-body` row of `.rib-section-ingroup` children, whose
  own bands are suppressed (`liveSectionInner(s, withTitle=false)`).
  `groupSections()` builds maximal runs joined by `noSepBefore`; the
  group's title is the first non-empty one in the run. Driver v56:
  titleCenter === bodyCenter, one band, sections 2.
- **Tool buttons toggle**: new `toggleTool(id)` in editorStore (open in
  ANY shape → close everywhere; else openTool). Wired to both toolbar
  button forms and the pinned productionTags command (which also
  reports `active` now).
- **Fullscreen Return-to-Editor removed** — the takeover header's ×
  already returns you. The SCRAPBOOK keeps its ribbon Return (its
  surface has no header) and gained its own `.fs-nb-close` × in the
  top-right, styled by the shared `.tool-window-close` rules.
- Scrapbook empty tree copy → "No items. / Create a page or section to
  begin." (NOTE: there are TWO `.fs-nb-empty` elements — the tree panel's
  and the surface's "Select or create a page…"; this changed the tree's.)

### v4.84 — element revert, shape-memory fix, chrome items

- **BUG (Derek): "none of the windows are remembering the correct
  position."** v4.81's dock-row handler forced `setToolMode('docked')` on
  every open. Replaced by `openFromRow(t)` in ToolDock: clicking an open
  tool closes it; otherwise it reads `toolMode` and either
  `enterToolFullscreen` (fullscreen) or `setActive` (docked/floating —
  the frame picks the shape). NOTHING in an open path writes the mode.
  toolModeMemory.test.ts pins that contract.
- **"Dialogue (Name)" REMOVED** (Derek reverting v4.61/v4.63):
  `character` is back in NON_PICKABLE, its label is 'Character' again in
  ELEMENT_LABELS and all six template rules, and
  `resolvePickedElement(picked, prevType)` is BACK in
  screenplayEditorConstants — picking Dialogue gives the name line
  UNLESS the previous block is character/parenthetical/dualDialogue
  (where a second name would be nonsense). Used by the picker AND the
  toolbar dropdown, so they can't drift. `allowedElementsAfter` maps a
  row that allows 'character' to also allow 'dialogue' — the rules
  table still speaks in name-line terms, which is correct: that IS the
  grammar's concept. Driver: picker shows Action/Dialogue/Dual Dialogue;
  Dialogue → character node → Enter → dialogue.
- **Focus "keep focus on current element"**: a speech (character +
  parentheticals + dialogue) is ONE focused unit — the name no longer
  dims while writing the line (TypewriterScroll.dimDecorations).
- Editor View select: `text-align`/`text-align-last: center` (options
  stay left — a centered list is hard to scan).
- Design ▸ Toolbar: `ribTitleGap` → `--dz-rib-title-gap` (the
  title→buttons margin; `ribTitlePad` remains the padding INSIDE the band).
- Presets panel: Workspaces row (export writes _workspaces.json; import
  accepts our export, a bare map, or another project's .odraft via the
  store's own `importWorkspaces`).
- Native View menu: Minimize removed (nativeMenuSync `windowItems`).

### v4.82 — gated rescans + react-router v8

- **Rescans** (ScreenplayEditor): `openToolKey` = activeTool |
  activeToolRight | tempTool | fullscreenTool → `toolIsOpen(id)`.
  scenesNeeded = sceneNumbersVisible || Scenes || Navigator || Characters
  open; charsNeeded = Navigator || Characters. Doc changes set
  scenesDirty/charsDirty; the scan runs when needed and catches up on
  open. TWO traps handled, both of which would have been silent:
  scene numbers are STAMPED INTO THE DOC (so visible numbers keep the
  scan live regardless of tools), and knownCharacters feeds the
  autocomplete (so ENTERING a character node refreshes when dirty even
  with everything closed — driver-verified).
- **react-router**: npm's `audit fix --force` wanted a DOWNGRADE to
  7.11.0. Real fix: react-router-dom is dead at 7.18.1 (v8 = the merged
  `react-router` package), advisory range is 7.12.0–8.2.0, so we went
  FORWARD to react-router@8.3.0, rewrote 9 imports, uninstalled
  react-router-dom. `npm audit --omit=dev` = 0 vulnerabilities.
  Driver-verified routes: /, /settings, /reset-password,
  /verify?email&code, /project/:projectId/edit/:scriptId.
  NOTE for drivers: the verify route is `/verify`, NOT `/verify-email`.
- **fs scope + CSP**: written up in docs/AUDIT-2026-07-26.md (v4.82
  follow-up). fs scope deliberately deferred WITH a plan and a test list
  — it rewrites the save path and no Tauri runtime exists here.

### v4.81 — a tool reopens in its last-used shape

- `toolMode` gained `'fullscreen'` (editorStore + viewState types). Every
  transition writes it: dock-row open → 'docked', drag-out/dock-drop →
  'floating'/'docked', enterToolFullscreen → 'fullscreen', the v4.78
  shrink → 'floating'.
- `openTool` honors it: a remembered-fullscreen tool reopens INTO the
  takeover, clearing its panel/temp slots inline (it can't call
  enterToolFullscreen from inside set()). Guarded by NO_FULLSCREEN_TOOLS,
  which MOVED to editorStore so ToolDock's button and this branch read the
  same list — the classic two-lists bug, pre-empted.
- fullscreenTool itself is still session-only, so a relaunch never opens
  straight into a takeover; the memory applies when you OPEN the tool.
- Escape now closes the Start a Script launcher (it was the one dialog
  you could only leave with the mouse).
- Tests: toolModeMemory.test.ts — each shape, the no-double-open
  invariant, and the NO_FULLSCREEN exemption.

### v4.80 — new-script launcher + Guided Setup wizard

- **NewScriptLauncher.tsx** fronts every New Script entry (File ▸ New
  Script, the newScreenplay command, and the launch-with-nothing-to-open
  path): Manual / Guided / Open Script / Import File. The unsaved-work
  guard (confirmOrRun) still runs BEFORE it, so the branches act directly.
- **NewScriptDialog**: Open/Import buttons GONE (they're on the launcher);
  gained a "Save to" field and "Customize from a file", plus ← Back.
- **GuidedSetupDialog.tsx**: 9 steps — Name / Where it saves / What kind
  of script / then one page per Customize tab (themes, elements, toolbar,
  panels, qat, context) from `GUIDED_CUSTOMIZE_STEPS`. Each customize step
  EMBEDS the live tab (`<CustomizePanelsDialog open embedded
  soloCategory=…>`) under a plain-language heading — Derek's "if I change
  Customize, the wizard updates too" is satisfied BY CONSTRUCTION, not by
  syncing. Every step has Skip for now + Next; the footer always reads
  "All of these options can be changed at a later time."
- **setupFields.tsx** holds the two controls both setups render —
  SaveLocationsField (writes through the SAME settingsStore setters as
  Settings ▸ Save Options, which is why it already shows what the last
  script used) and CustomizeFromFileField (calls v4.79's
  applyCustomizeExport — no second copy of the apply logic).
- DRIVER BURN (again, sharper): NEVER `.remove()` a dialog overlay in a
  driver — it rips a React-managed node out and every later render fails,
  which reads as "the feature is broken". Dismiss with Escape or the real
  button. Cost two failed runs before the penny dropped.

### v4.79 — presets: export/import everything

- **utils/presets.ts** is the core: `buildCustomizeExport` /
  `applyCustomizeExport` (chrome via capture/restoreCustomizations +
  themes + element/transition visibility & order + Mores & Continueds),
  `buildFullPreset` / `applyFullPreset` (gatherSettings — so it can
  never under-collect, and credentials are excluded BY CONSTRUCTION),
  and `typedExportName(base, type)` — the ONE filename builder.
- **Filename rule (Derek)**: every preset export ends `_<type>.json` —
  _preset, _customize, _settings, _theme, _themes, _outline-presets.
  Swept: settingsBackup.downloadBackup, ThemesTab.exportThemes,
  BeatBoard outline presets, and everything new.
- **PresetsPanel.tsx** renders the rows; three hosts, zero copies:
  File ▸ Import/Export ▸ Presets… (PresetsDialog), Settings ▸ Presets
  (new tab), and the Customize footer's Export…/Import… (which call the
  exported `exportCustomizationsFlow` / `importCustomizationsFlow`).
  Import always confirms first (Derek's override warning).
- **BUG FOUND BY THE ROUND-TRIP TEST**: `CUSTOMIZATION_FIELDS` (the list
  Customize's Cancel reverts) had drifted — contextMenuHidden,
  suggestionRules, suggestionMode, panelItemScale, panelNameCase were
  all missing, so Cancel quietly KEPT those edits. Added. Anything a
  new Customize tab persists MUST join that list.
- **File menu** (Derek): Open has no submenu — it opens the Open window,
  which gained "Browse This Computer…" (dispatches the `importLocal`
  command MenuBar already owns — one import path). Import moved down
  beside Export; both carry Presets….
- Tests: presets.test.ts — filename convention, full customize
  round-trip (export → clobber → import → identical), M&C carry,
  foreign-file refusal, credential exclusion.

### v4.73–v4.78 — the crash hotfix and the rest of Derek's stream

- **v4.73 (HOTFIX)** — What's New CRASHED (Derek's screenshot): every
  changelog entry since v4.53 was appended as `changes: [strings]` while
  the dialog's contract is `items: [{title, detail}]`, and the export
  was a blind cast. data/changelog.ts now normalizes BOTH shapes
  (strings split at first ': ' or ' — '); changelog.test.ts walks the
  whole JSON so one malformed entry can never take the window down
  again. Ship rule burned in: the WIP TitlePageEditor was `git stash`ed
  so the hotfix went out alone.
- **v4.74 Title Page batch** — Sync above the Title row; embedded
  caption dedup (.fs-modal-as-panel .tp-editor-dialog > .dialog-header
  hidden); PLACE IMAGE row → char-tool "+ Add Image" placeholder
  opening the SHARED ImageSourceMenu (onAssets optional now — hidden
  without a project, never dead) + CharacterImagePickerDialog reuse;
  per-image Top/Bottom = the placement UI; both size selects lead with
  "Default" (applies 12 then reads numeric); preview is TO SCALE — a
  real 8.5×11in .tp-scale-page rendered from the SAME
  titlePageBlockSpecs Apply inserts, scaled, with −/Fit/+ zoom.
  DRIVER BURN: never .remove() a React-portalled node (crashed React on
  unmount) — close menus with a real outside pointerdown.
- **v4.75 ribbon dividers** — boundary dividers removable: new `nd:`
  boundary token (parse/serialize round-trip, clone carries
  noSepBefore — clone is field-by-field, new fields MUST be added
  there); live zones skip the sep; edit mode: hover-× on the sep /
  dashed ghost restores; + menu: "Divider — one row" (d:) and
  "Divider — two rows" (2!d:).
- **v4.76 About** — links route through openInBrowser (raw
  target=_blank stalled in the WebView; Rust open_url exists); credits
  audited: html2canvas-pro + pdf.js added, everything else verified
  live; CLAUDE.md standing rule: dependency changes update the list in
  the same change.
- **v4.77 spell squiggles by default** — the wavy red underline and the
  ALL-CAPS skip already existed (SpellCheck.ts shouldSkipWord) but
  spellCheckByDefault defaulted OFF and every save stamped
  _spellCheckEnabled:false into the doc. Now: default ON ('0' =
  opt-out); explicit user choice persisted as _spellCheckChoice
  ('on'/'off', recorded ONLY by toggleSpellCheck); loads use ONE rule —
  resolveSpellCheckOnLoad (choice > legacy true > setting default;
  legacy false = stamp noise) — on BOTH load paths (the local-file path
  used to ignore the setting). spellCheckResolve.test.ts pins the
  matrix.
- **v4.78** — fullscreen header gains a shrink button (RestoreIcon,
  bordered 20×20 family, LEFT of ×) → setFullscreenTool(null) +
  setToolMode('floating') + openTool; closed dock rows drag out
  (startDockDragOut attached regardless of open, height from stored/
  default size, release also setActive).

### v4.72 — page-number position (Derek's margin diagram) + ruler tail

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

