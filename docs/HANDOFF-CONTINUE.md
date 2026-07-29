# ScriptCraft — continuation brief (current as of v5.47 — READ docs/SPEED-AUDIT-2026-07-28.md §3 before verifying anything; NOTE the isolate:false revert in §2)

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

### v5.47 — # goto in header, stacked stepper, Design DOCKS BACK, notes checklist fixes, edit-window force-show (HEAD)

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

### Older versions — one line each (full sections in `docs/HANDOFF-ARCHIVE.md`)

Newest first. When a version rolls out of the detailed set above, its section
moves verbatim to the archive and its line lands here.

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
