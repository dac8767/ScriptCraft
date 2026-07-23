# ScriptCraft — area map & parallel-chat lanes

This is how the codebase divides into independently-ownable **lanes** so that
separate Claude chats can work in parallel without stepping on each other, and so
that any single chat loads only its slice (faster, cheaper, fewer mistakes).

- **Machine-readable source of truth:** `docs/lanes.json` (edited when files move,
  a lane is added, or the store is sliced).
- **Checker/dispatcher tool:** `scripts/check-lanes.mjs` (or `npm run check-lanes`).
- **Cleanup backlog:** `docs/EFFICIENCY-AUDIT.md`.

> Two chats collide when they edit the **same file** — git can't merge a live
> conflict on one file, so I have to stop and reconcile. The whole point of lanes
> is to hand each chat a set of files that doesn't overlap anyone else's.

---

## The shared spine (no lane owns these)

Nearly everything routes through these. **Only one chat edits a spine file at a
time**, and edits to the registries stay small and append-only so they merge cleanly.

| Spine file | Why it's shared |
|---|---|
| `stores/editorStore.ts` | Holds 13 domains' state + the `ToolId` union |
| `components/ScreenplayEditor.tsx` | The editor shell every feature mounts into |
| `components/ToolDock.tsx` | `ALL_TOOLS` registry — every dockable tool registers here |
| `components/uiIcons.tsx` | `MENU_ICONS` / `TOOLBAR_ICONS` — one icon registry |
| `services/api.ts` + storage backends | The persistence facade |
| `editor/pagination.ts` + `editor/extensions/*` | The document schema (a change ripples to paginator + exporters + toolbar) |
| `styles/screenplay/01-fonts-base.css`, `15-responsive.css` | Cross-cutting CSS |

Splitting the first two (slice `editorStore`, extract `ScreenplayEditor` hooks) is
what converts most lanes from "blocked" to "parallel-safe" — see below.

---

## The lanes

Full file lists live in `docs/lanes.json`. **State** shows whether a lane already
has its own store (independent now) or still lives in `editorStore` (frees up once
that domain is sliced out). **Parallel-ready** is the honest read for *today*.

| Lane | What it owns (headline files) | CSS | State | Parallel-ready? |
|---|---|---|---|---|
| `character` | `CharacterProfiles`, `RelationshipMap`, `characterScan` | 10 | `editorStore:characters` | after slice |
| `scenes` | `SceneNavigator`, `OutlineBar`, `IndexCards`, `SynopsisModal` | 05,21,08,25 | `editorStore:scenes` + own preset/bookmark stores | after slice |
| `beatboard` | `BeatBoard` | 08 | `editorStore:beats` | after slice (shares 08 w/ `scenes`) |
| `notes` | `ScriptNotes`, `StickyNotes`, `StickyCard`, `ListControls` | 09,19 | `editorStore:notes` | after slice |
| `notebook` | `NotebookTool` | 24 | own `notebookStore` | **now** |
| `toolbar` | `Toolbar`, `RibbonPalette`, `FontPicker`, `ColorPicker`, `FormatPanel` | 03,23 | `editorStore:chrome` | after slice |
| `menus` | `MenuBar`, `ScriptContextMenu`, `AddMenu`, `KeyboardShortcutsTab` | 02 | `editorStore:chrome` + own `shortcutStore` | after slice |
| `customize` | `CustomizePanelsDialog`, `DesignPanel`, `ThemesTab`, `WorkspacesTool` | 23,26 | `editorStore:chrome` + own `themeStore` | after slice |
| `spelling` | `SpellCheck*`, `Dictionary*`, `GrammarRulesPanel`, `grammar/*` | 11 | `editorStore:spellGrammar` | after slice |
| `importexport` | `*Exporter`/`*Importer`, `fountain*`, `fdx*`, `pdf*`, `OpenFile`, `SaveAsDialog` | — | none | **now** |
| `templates` | `formattingTemplateStore`, `Template*Dialog`, `EditElementsDialog`, `ElementPicker` | 18 | own `formattingTemplateStore` | **now** |
| `tags` | `TagsPanel`, `LocationDatabase` | 13 | `editorStore:tags` | after slice |
| `titlepage` | `TitlePageEditor`, `TitlePagePanel`, `titlePageLayout` | — | none | **now** |
| `stats` | `ScriptStatistics`, `DiffViewer`, `VersionHistory`, `scriptDiff` | 11 | none (read-only over doc) | **now** |
| `tools` | `GoalsTool`, `HighlightsTool`, `TypewriterTool`, `FeedbackTool`, `AiWriterTool` | 20,22 | `editorStore:tools` | after slice |
| `collab` | `Auth*`, `Collab*`, `ShareDialog`, `SettingsPage`, `cloudApi`, `collabSync` | 17 | own `settingsStore` | **now** (separate product surface) |

**Parallel-ready today** (own store or no store): `notebook`, `importexport`,
`templates`, `titlepage`, `stats`, `collab`. You can run chats on any mix of these
at once right now.

**Blocked until `editorStore` is sliced:** `character`, `scenes`, `beatboard`,
`notes`, `toolbar`, `menus`, `customize`, `spelling`, `tags`, `tools` — they all
write `editorStore.ts`, so two of them in parallel collide there today.

---

## The overlap checker / dispatcher — `scripts/check-lanes.mjs`

```
npm run check-lanes -- lane character notes beatboard      # do these overlap?
npm run check-lanes -- plan character notes importexport stats collab   # split into parallel waves
npm run check-lanes -- plan --sliced <lanes...>            # ...as it'll be after the store split
npm run check-lanes -- files path/to/File.tsx [...]        # which lane(s) own these files
npm run check-lanes -- diff                                # classify the current git diff
npm run check-lanes -- lanes                               # list every lane
node scripts/check-lanes.mjs --selftest                    # assertions
```

(You can also call `node scripts/check-lanes.mjs <cmd>` directly.)

- **`lane`** answers *"if I run these updates at once, do they collide?"* and prints
  why (shared file, or shared `editorStore.ts` until sliced).
- **`plan`** partitions your chosen lanes into **waves** — each wave is a set of
  lanes with zero overlap, safe to run in parallel — and prints a copy-paste brief
  per lane for the worker chats. `--sliced` shows how many waves collapse once the
  store is split (usually most of them).

---

## The "Dispatcher chat" workflow

Instead of scoping lanes by hand, use one **coordinator chat**: paste your desired
updates in plain English; it maps each to a lane, runs `plan`, and hands you the
per-lane briefs to drop into worker chats.

Paste this to start a dispatcher chat:

```
You are the DISPATCHER. Do not write app code.
1. Read docs/AREA-MAP.md and docs/lanes.json.
2. I'll give you a list of updates I want. Map each to exactly one lane.
3. Run: node scripts/check-lanes.mjs plan <the lanes>   (add --sliced only if I say the store is already sliced)
4. Show me the waves, and for each update print a ready-to-paste brief for a worker
   chat: the lane, the exact files it may touch, the spine rules, and the update text.
5. Flag any update that spans two lanes or touches the spine — tell me it needs to be
   one chat or split, and why.

My updates:
- <update 1>
- <update 2>
- ...
```

Each worker chat then gets: *"You own lane `<x>` — only these files: […]. Don't touch
other lanes or the spine; registries are append-only; run the gates; push to
`claude/v0_32`."* Because their file sets don't overlap, their pushes merge cleanly
and one `npm run desktop` pulls all of their work.

---

## Keeping this current

`docs/lanes.json` is the source of truth. Update it when:
- a file moves or a new component/util is added to a lane,
- a new lane is created,
- **`editorStore` is sliced** — change the affected lanes' `store` from
  `editorStore:<domain>` to `own:<newSliceFile>`; the checker will then treat those
  lanes as independent automatically.

`scripts/check-lanes.mjs --selftest` guards the core logic; run it after editing the
manifest.
