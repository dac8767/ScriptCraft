# ScriptCraft — continuation brief (current as of v3.54)

Read `CLAUDE.md` and `docs/HANDOFF.md` first for the durable footguns, architecture
map and Derek's working style. This file is the **fresh-chat catch-up**: the current
state, the workflow *this* environment uses, and what shipped recently — so a new
session picks up without re-deriving it. Update this file (not just append) when it
drifts.

> Why this exists: the previous chat grew long and slow. Starting fresh keeps each
> turn fast; this doc + `CLAUDE.md` carry everything forward.

---

## 0. This environment & workflow (IMPORTANT — differs from HANDOFF.md §1)

You are **not** editing Derek's Mac directly. You run in a **remote sandbox with a
fresh clone** of `github.com/dac8767/FreeScript`. So:

- **Dual-branch push.** Develop on your designated feature branch (this era it was
  `claude/app-handoff-review-qt9cn4`), and push **every release to BOTH** that branch
  and `claude/v0_32`:
  ```
  git push -u origin <feature-branch>
  git push origin <feature-branch>:claude/v0_32
  ```
  `claude/v0_32` is the branch Derek's clone tracks; the feature branch is this
  session's. Follow whatever branch your own task/system prompt names, but keep the
  push-to-`v0_32` step.
- **Git remote MUST stay the `dac8767/FreeScript` path.** The renamed
  `dac8767/ScriptCraft` path 403s in this environment. (The repo/app are "ScriptCraft"
  everywhere user-facing; only the git remote URL keeps the old name.)
- **Never `main`** (stale v0.6). Never force-push.
- **Model identity:** never put the model id in commits, PR bodies, code, or the
  changelog — chat replies only. Commit trailer style:
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_...
  ```

### The gates (run before claiming anything works)
```bash
cd frontend
npx tsc -b        # 0 errors — gates the .dmg build; an unused import breaks release
npm test          # 271 tests as of v3.54, all green
npm run build     # tsc -b && vite build
```
Plus **Playwright live checks** for UI work (see §4). Write a real regression test for
anything with logic — the repo's habit is "render it and read back what it produced".

### Per batch
- **One version per batch.** Bump `APP_VERSION` in `frontend/src/data/changelog.ts`
  and add a hand-written, newest-first changelog entry describing the change.
- **End delivery messages with:** `cd /Users/dcarl/ScriptCraft && npm run desktop`

---

## 1. What shipped this run (v3.38 → v3.54)

Ribbon / toolbar customization, then a Customize-window pass, then two chrome refactors:

- **v3.38–v3.47** — ribbon in-place "+ Add", per-section titles (iterated), QAT
  dividers/spacers, panel-toggle commands, element autofill (character/scene/
  transition), scene-heading auto-uppercase, title-page phantom-page fix, zoom/
  editor-view toolbar polish.
- **v3.48** — inline zoom % editing; one-shot ribbon commands blur so "Fit" doesn't
  stay lit.
- **v3.49** — Customize window **Save/Cancel** with full revert; X-with-changes prompts
  Save / Don't Save / Cancel.
- **v3.50** — a **title field over every ribbon section** (blank ⇒ nothing on the bar);
  dropped the v3.49 title drag.
- **v3.51** — visible spacers while editing the toolbar; 50%-taller Editor View
  dropdown; no caret on the big Zoom button.
- **v3.52** — palette **de-dups by label** (Title Page was ×3); Lock All/Reset All into
  the Customize footer; toolbar search 300px right-aligned; Outline Bar rows reorder by
  drag; context menu "Copy to Snippets" → **"Move to Snippets"** (actually moves).
- **v3.53** — **Outline Bar is no longer customizable** — Customize > Outline Bar tab
  removed; the bar is fixed to the four default rows.
- **v3.54** — **Scenes tool** count+filter → window header, search → footer; scene-
  heading uppercase now **edits-only** (opening a script doesn't dirty it).

**Nothing is parked/deferred** right now.

---

## 2. Key architecture touched (so you don't re-derive it)

- **Ribbon** (`components/toolbarBuiltins.ts`, `Toolbar.tsx`, `ribbonDrag.ts`): a token
  string list in `toolbarLeft` is the single source of truth. `parseRibbon` /
  `serializeRibbon` ↔ `RibbonModel {sections, splitAt}`. Tokens: `b:`builtin, `c:`command,
  `t:`tool, `s:`spacer, `d:`divider, `2!d:`section divider, `a:`align split, `r:`/`rl:`row
  break, `st:`section title. The ribbon is **edited in place on the real bar** (the
  Customize > Toolbar tab is just the palette); drag controller + `ribEdit` store state
  in `ribbonDrag.ts`. `buildRibbonPalette` (`ribbonPaletteData.ts`) de-dups by label.
- **Customize dialog** (`components/CustomizePanelsDialog.tsx`): edits apply LIVE, so
  **Save just closes and Cancel reverts** to an open-time snapshot —
  `captureCustomizations` / `restoreCustomizations` in the store, both walking ONE
  `CUSTOMIZATION_FIELDS` list (add a field to that list, not to two places). Three-way
  `saveDialog` lives in `ConfirmDialog.tsx`. Lock All/Reset All render in the footer
  (modal) / tab rail (embedded/Settings).
- **Tool window chrome slots** (`components/ToolDock.tsx`): `TOOL_HEADER_EXTRAS` and
  `TOOL_FOOTERS` register a tool's controls into the window **header** / **footer**.
  Because those render OUTSIDE the tool body, lift the shared state into the store
  (pattern: Navigator `navFilter`; Scenes `sceneSearch` / `sceneFilters` /
  `sceneNavData`, the body publishes the derived option-lists + count). Tools render
  **inline in a panel** (`.tool-inline-*`) or **floating** (`.tool-window-*`); clicking
  into the editor MINIMIZES an open tool window (by design).
- **Editor extensions** (`editor/extensions/`): `SceneHeading` uppercases scene-heading
  text on **user edits only** — it skips transactions carrying `preventUpdate`
  (setContent / loads), which is what stopped "opening a script marks it dirty".
  `Parenthetical` auto-inserts `()` with the caret between. Element autocomplete
  (character / scene / transition, plus locations after INT./EXT.) lives in
  `ScreenplayEditor.tsx`.
- **Outline Bar** (`components/OutlineBar.tsx`): renders `DEFAULT_OUTLINE_BAR_ROWS`
  directly (v3.53 — no longer user-customizable). Sections = acts = `beatColumns`;
  beats link to acts via `columnId`.

---

## 3. Recommended next: split the big files (perf)

Iteration got slow largely because a few files are huge. Highest-value refactor:

- **`frontend/src/styles/screenplay.css` ≈ 18k lines** — split into area files
  (`toolbar.css`, `customize.css`, `outline.css`, `tools.css`, …) imported from one
  index; run the gates so nothing shifts visually. This was going to be **v3.55**.
- Later, one at a time (bigger regression risk): slice `stores/editorStore.ts` (~2.6k)
  into feature slices, and peel subcomponents off `Toolbar.tsx` (~1.9k) and
  `CustomizePanelsDialog.tsx` (~1.2k).

---

## 4. Playwright live-check recipe (what tripped me up)

- Launch: `chromium` at `executablePath: '/opt/pw-browsers/chromium'`; dev server
  `npx vite --port 5199` (curl-poll for 200 before driving).
- On load a **"New Script" dialog** blocks the UI — click its **Create** button first.
- Open Customize with `window.dispatchEvent(new CustomEvent('scriptcraft:command',
  { detail: 'customize' }))` rather than menu-hunting.
- Seed state via `localStorage['opendraft:viewState']` in `addInitScript`. To keep a
  **seeded ribbon verbatim**, also set the one-time migration flags
  (`opendraft:toolbar*NNN`) so load-time migrations don't rewrite it.
- Tools render **inline** by default → selectors are `.tool-inline-header-extra`,
  `.tool-window-footer`, etc. Clicking `.ProseMirror` **minimizes** an open tool.
- A `<select>`/`<input>` inside a portalled popover steals focus from the editor; and
  React controlled fields need the native-setter trick in unit tests
  (see `SceneNavigator.test.tsx`).

---

## 5. Standing release blockers (unchanged, from HANDOFF.md §5)

Brand art (`src-tauri/icons/`, splash, favicon); Apple Developer + signing identity in
`build-desktop.sh`; rehost `languageCatalog.ts` dictionaries; Courier Prime + dictionary
licenses; trademark clearance; `macos-private-api` on ⇒ no Mac App Store (signed `.dmg`
plan); rotate the embedded GitHub PAT.
