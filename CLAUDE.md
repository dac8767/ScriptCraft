# ScriptCraft — working notes for Claude

> **Naming history:** OpenDraft (upstream) → FreeScript (repo name) → FreeDraft
> (v0.5–v1.33) → **ScriptCraft** (v1.34, Derek's rename). v3.14: the repo and
> Derek's clone are renamed to ScriptCraft too (`dac8767/ScriptCraft`,
> `/Users/dcarl/ScriptCraft` — GitHub redirects the old URLs). The
> `.odraft` format, the `com.freedraft.app` bundle id and the `opendraft:*`
> storage keys STILL keep their old names on purpose — renaming identifiers
> that persist data or define the app's identity orphans user data.

Read this before touching anything. It is the residue of 100 shipped versions, and
most of it is the kind of thing you only learn by getting it wrong first.

> The previous `CLAUDE.md` was inherited from upstream Proteus OpenDraft and
> describes a different project (an open-core/Pro split that does not exist here, a
> Mac App Store path that is ruled out). It is archived at
> `docs/UPSTREAM-OPENDRAFT-NOTES.md` with a warning header. Don't follow it blindly.

---

> **Fresh chat? Read `docs/HANDOFF-CONTINUE.md` first** — the current state (v3.54),
> the dual-branch push workflow this environment uses, what shipped recently, and the
> live architecture. Then **`docs/HANDOFF.md`** for the working process and history
> (v1.9–v1.21: projects removed, Save/Save As rebuilt, the Tauri fs scope, the Dev
> Picker's shape) — its §1 workflow is superseded by HANDOFF-CONTINUE.md §0, but its
> footguns and Derek-practices sections still hold.

## 0. The thing you are probably confused about

**There is no Codespace connection. There never was.**

If you went looking for how a previous Claude "connected to the Codespace and added a
zip," you were chasing a ghost. What actually happened:

- That Claude ran in a **sandboxed container of its own**, holding its own clone of
  `github.com/dac8767/FreeScript`, authenticated by a PAT in the remote URL.
- It **could not touch Derek's machine.** Not the Codespace, not the Mac. No shell, no
  filesystem, no network path to either.
- So it worked the only way it could: edit files in its own clone → commit → **push to
  `claude/v0_32`** → Derek runs `git pull` on his Mac.
- The `freescript-vX_Y-*.zip` files in the repo root are **committed artifacts**, not a
  transfer mechanism. A chat window can't hand someone a file, so a zip of the changed
  files got committed alongside each change.

**You are not in that situation.** You have direct filesystem access to the repo on
Derek's Mac. Therefore:

- **Do not create delivery zips.** They were a workaround for a constraint you don't
  have. The existing ones are historical — leave them, don't add more.
- Edit files directly, verify, commit, and tell Derek to restart the app.

---

## 1. What this is

A professional screenwriting desktop app, forked from Proteus's OpenDraft.

| | |
|---|---|
| **Frontend** | React 19 + TypeScript + Vite, TipTap editor (`frontend/`) |
| **Backend** | FastAPI, SQLite, dulwich for script history |
| **Desktop** | Tauri (WebKit on macOS), shipping as a signed `.dmg` |
| **Repo** | `dac8767/ScriptCraft` (renamed from FreeScript in v3.14; old URLs redirect), branch **`claude/v0_32`** |
| **Derek's clone** | `/Users/dcarl/ScriptCraft` |

**`main` is a stale v0.6 baseline. Never commit to it.** All work is on `claude/v0_32`.

Derek is the product owner and the only tester. He gives direction, tests each build on
his Mac, and reports back. Claude writes all the code.

---

## 2. The verification gates — run these before claiming anything works

```bash
cd frontend
npx tsc -b     # MUST be 0 errors. Not "baseline", not "pre-existing". Zero.
npm test       # currently 61 tests, all must pass
npm run build  # tsc -b && vite build — must succeed
```

**Why `npm run build` matters, and why skipping it is not harmless.** Tauri's
`beforeBuildCommand` is `cd frontend && npm run build`, which starts with `tsc -b`. For
weeks there were eight "harmless" unused-variable errors that everyone — including me —
treated as an acceptable baseline. They were not a baseline. They were failing the tsc
gate, which meant **`tauri build` could not produce a `.dmg` at all.** The release was
blocked in plain sight, and nobody noticed, because `tauri dev` doesn't run tsc.

They are fixed. Typecheck is clean at zero. **Keep it there.** An unused import is not a
lint nit in this repo; it breaks the release build.

**Write real tests for anything with logic in it.** `vitest` is wired for jsdom, so
components can be rendered and inspected (`src/**/*.test.tsx`). Two of the worst bugs in
this project's history were found by rendering the thing in a test and reading back what
it actually produced — not by staring at the source and reasoning.

---

## 3. How Derek works, and what he expects

- **Root cause, not symptom.** "Why is it doing that" before "make it stop doing that."
  He spots patches and dislikes them.
- **Single source of truth.** If something appears in two places, it must be driven by
  one shared source. Nearly every bug in this codebase's history is two lists that
  drifted apart: a menu icon map that didn't match the menu, a card component copied
  instead of shared, a hardcoded shortcut list that ignored the user's rebindings.
  Before adding a second copy of anything, don't.
- **Silent no-ops are the cardinal sin.** A control that looks like it works and writes
  into the void is worse than a missing control. Several examples in §4.
- **Honest risk assessment.** If something is too risky, say so and say why. Deferring
  with a reason is respected; quiet failure is not. If you got something wrong, say that
  too — plainly, and then fix it.
- **He renames things constantly.** When he does, rename everywhere, immediately.
- **The About window's open-source list tracks the real dependencies** (v4.76,
  Derek's standing rule): removing a tool that retires a library — or adding or
  swapping one — updates the "Made possible by open source" list in
  `AboutDialog.tsx` as part of the SAME change.
- **The Helper Text window tracks the real helper text** (v6.51, Derek's
  standing rule): any change that adds, removes, or rewords helper text
  (tooltips, placeholders, `ht()` hints) reruns
  `node devtools/build-helper-catalog.mjs` as part of the SAME change, so the
  Helper Text window's list always matches the app. `check-helper-catalog`
  fails the suite when the committed catalog drifts — and since v6.51 the
  builder harvests string literals out of dynamic `title={…}` expressions
  too, so ternary tooltips are covered, not just literal attributes.
- **Icons are always monotone** (react-icons line style, currentColor). Never emoji
  in UI chrome — v2.08 swept the Scrapbook's 📄🗂🗑 for exactly this.
- **Colors come from tokens, never from a hex literal** (v7.01, after the style
  audit). Chrome reads `--fd-danger` / `--fd-success` / `--fd-warning` /
  `--fd-accent` and the surface tokens; a raw `#c0392b` in a component or a
  stylesheet is a bug. `src/styles/tokenResolve.test.ts` fails the suite if a
  `var(--fd-…)` names a token no theme defines — the exact failure that left ~50
  hover and selected states painting nothing through v7.00. A NEW token must be
  defined in `:root` **and** added to `THEME_VARS` (themes.ts) or custom themes
  can't reach it. The exception is a user-facing color PALETTE (annotation
  colors, index-card colors): those are choices, not states, and stay literal.
- **Buttons: `dialog-btn` + a modifier, never a paint-only class** (v7.01). The
  retired `dialog-primary` set a color but no size, so it looked right in a
  dialog's button row and like a native browser button anywhere else. The test
  above fails the suite if it reappears.
- **Never `window.confirm` / `alert` / `prompt`** — in Tauri they are async IPC
  shims that return a Promise, and a Promise is always truthy, so `if (confirm(…))`
  runs whatever the user answers. Use `confirmDialog` / `promptDialog`. Enforced
  by the same test file.
- **Never comment on the time of day or suggest he sleep.**

End any message that delivers a change with:

```
cd /Users/dcarl/ScriptCraft && npm run desktop
```

`npm run desktop` = restore `src-tauri/Cargo.lock` (v5.55 — a local `tauri dev`
rewrites that generated file and a dirty copy aborted `git pull`; the committed
lockfile is canonical) → `git pull` → `npm install` (a no-op unless deps changed — this is
what stops the baffling "Cannot find package" after a pull) → launch the Tauri app.
It's `&&`-chained, so a failed pull stops rather than launching a half-merged tree.
`npm run app` launches without pulling.

(If you edited his working copy directly he may not need `git pull` — but he does need
to restart the app.)

---

## 4. The footguns — read this section twice

Every one of these shipped as a real bug. Each cost hours.

### WebKit / Tauri
- **Drag-and-drop silently does nothing unless you call `dataTransfer.setData()`.**
  WebKit refuses to start a drag without it; Chrome doesn't care. So it looks perfect in
  a browser and is stone dead in the app. Every drag handler must call it.
- **`position: fixed` + only `bottom` + `max-height` + `overflow: auto` collapses the box
  to a sliver.** Anchor floating things by measured `top`/`left`. Never by `bottom`.
- **An absolutely-positioned child cannot escape an ancestor's stacking context or
  `overflow`, no matter its z-index.** Menus inside side panels must be portalled to
  `document.body` and positioned with fixed coordinates measured from their trigger.
  (See `AddMenu.tsx` and `AddMenu.placement.test.tsx`.)

### TipTap / ProseMirror / pagination
- **`showOnlyCurrent: false` on the Placeholder extension makes EVERY empty element in
  the document display its hint simultaneously.** It was set that way to light up both
  columns of a dual dialogue; the cost was three "Describe the action..." prompts stacked
  down the page.
- **The pagination plugin's `apply()` ignores transactions without `docChanged`** unless
  they carry `setMeta('forceRepaginate', true)`. Every refresh dispatch must set it.
- **If you hide something in the script visually, tell the paginator too.** `display: none`
  alone leaves a phantom page in the count and shifts every subsequent page number by one.
  See `hideTitlePage` in `editor/pagination.ts`.
- **Never rename the `scriptNote` mark or the tool ids.** User-visible strings were renamed
  ("Script Note" → "Note"), but the internal mark name is what every note in every saved
  script points at. Rename it and you orphan them all.

### React / Node
- **Hooks must never appear below an early return** in dialog components → "Rendered more
  hooks than during the previous render" crash.
- **`IncomingMessage` emits `'close'` when the request body has been fully READ**, not when
  the client disconnects. Cleanup hung on `req.on('close')` kills the thing you just
  started. Use `res.on('close')` with a `finished` guard.

### Working notes must never leave the app
Sections (`# ...`), markers (`⚑ ...`), script to-do lines (`[ ] ...`) and note highlights are
scaffolding for the writer, not part of the script. They are **hidden in Preview,
suppressed unconditionally in print, and filtered out of the Fountain exporter.** The
exporter used to write them into the file verbatim — drafts went to collaborators carrying
Derek's private to-do list. If you add a new kind of working note, it must be excluded from
all three.

---

## 5. Architecture map

| File | What lives there |
|---|---|
| `stores/editorStore.ts` | `ToolId`, tool config/order, `SHELF_COLORS`/`NOTE_COLORS`, script-visibility flags, `ALWAYS_FLOAT`, `DEV_TOOLS`, view-state persistence |
| `stores/formattingTemplateStore.ts` | `getPickableElements()` — the canonical element list |
| `components/ToolDock.tsx` | `ALL_TOOLS` (the tool registry), `WINDOW_IDS`, docking, drag-to-resize panel edge |
| `components/StickyCard.tsx` | **THE** card. Notes and To-Do both render it. Do not fork it. |
| `components/ListControls.tsx` | Filter / sort / manual-order shared by Notes and To-Do |
| `components/AddMenu.tsx` | Portalled dropdown used throughout Customize |
| `components/uiIcons.tsx` | `MENU_ICONS` / `TOOLBAR_ICONS` — one registry, read by the UI *and* Customize |
| `components/CustomizePanelsDialog.tsx` | Customize tabs. **Hide = remove-and-stash**, in every tab. |
| `editor/pagination.ts` | Page breaking, `visibilityOpts` |
| `utils/fountainExporter.ts` | Export — filters working notes |
| `styles/screenplay.css` | All styling. One large file. |

**The Dev Picker is GONE** (removed v3.25 at Derek's request — it lived in `src/dev/`,
DEV-only). It let him click a UI element and get its *real internal name* into a note —
`Notes — Right Panel`, `toolbar key: bold`. **If he pastes names in that form, they came
from there (an older build) and they are exact.** Recover it from git history if he ever
wants it back.

---

## 6. Open items

- **Rotate the GitHub PAT** — embedded in a remote URL and has appeared in terminal output.
- **Replace all OpenDraft brand art** (`src-tauri/icons/`, splash, favicon) — biggest release
  blocker.
- Apple Developer Program membership; swap the Proteus signing identity in `build-desktop.sh`.
- `languageCatalog.ts` fetches dictionaries from Proteus's CDN — rehost before release.
- Dictionary + Courier Prime license files; trademark clearance on "ScriptCraft".
- `macos-private-api` is enabled in `src-tauri/Cargo.toml` — this **rules out the Mac App
  Store**. Fine for the `.dmg` plan, but know it.

---

## 7. Summary for the impatient

1. There was never a Codespace connection. **Don't make zips.**
2. Branch `claude/v0_32`. Never `main`.
3. `npx tsc -b` must be **zero** errors — it gates the release build.
4. `npm test` and `npm run build` must pass before you claim anything works.
5. One source of truth for anything that appears twice.
6. Call `dataTransfer.setData()`. Portal your menus. Position by `top`, never `bottom`.
7. Root cause, not patch. Be honest when something is risky — or when you got it wrong.
