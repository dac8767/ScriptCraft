# ScriptCraft — efficiency audit & cleanup backlog (2026-07)

Findings from a full read-only scan (four parallel explorers over components,
stores/utils/services, CSS, and backend/build/deps) plus manual spot-checks of the
top items. Tick items off as they land. Each is meant to be its **own small,
verified, individually-pushed commit** so Derek can test and revert per step.

Lane tags (see `docs/AREA-MAP.md`) show which chat should own each item.

> **Verified by spot-check:** 80 zips / 7.6 MB; `MobileAccessoryBar`,
> `CharacterConnectionsGraph`, `zipExport/zipImport` have zero live refs; `d3` has a
> single consumer; `project-list-page` CSS has zero TS/TSX hits.

---

## Tier 1 — delete now (zero / near-zero risk)

### Dead component files (~1,110 lines) — lane: `character` / `spelling` / spine
- [ ] `components/MobileAccessoryBar.tsx` (265) — only ref is a "removed" tombstone comment in `ScreenplayEditor.tsx:78`
- [ ] `components/CharacterConnectionsGraph.tsx` + `CharacterConnectionsGraph.test.ts` (294) — superseded by `RelationshipMap`; **sole `d3` consumer** (`character`)
- [ ] `components/SpellCheckContextMenu.tsx` (181) — zero refs (`spelling`)
- [ ] `components/LanguageSelector.tsx` (81) — zero refs (`spelling`)
- [ ] `utils/zipExport.ts` + `utils/zipImport.ts` (~175) — zero importers (`importexport`)
- [x] `editor/sceneReorder.ts` (127) — zero importers (spine/schema)
- [~] `editor/extensions/index.ts` — NOT dead after all: imported by `ScreenplayEditor.tsx:35` via the directory path `../editor/extensions`. Kept.

### Dead functions / store actions (~180 lines)
- [ ] `getEffectiveFormatting` `utils/effectiveFormatting.ts:102` (~64) — `templates`
- [ ] wrappers: `parseFDX` (`fdxParser.ts`), `downloadPDF` (`pdfExporter.ts`), `getCompat` (`services/compat.ts`), `demoMessage` (`demoInfo.ts`), `hasCustomTitlebar` (`platform.ts`), `isPaginationContinuous` (`pagination.ts`), `jsdelivrUrls` (`languageCatalog.ts`), `vomitLockActive` (`vomitStore.ts`)
- [ ] ~13 never-called `editorStore` actions: `addCharacter`, `add/update/deleteGeneralNote`, `setShelfTab`, `toggleBeatBoard`, `clearMirrorStatuses`, `clearReferredTag`, and the unused `setToolbar*` setters (keep the *fields*, drop the setters) — spine
- [ ] dead branches: `'scriptnotes'` (`Toolbar.tsx:634,1276`, `editorStore.ts`), unreachable `case 'structure'` (`ToolDock.tsx`)

### Repo hygiene
- [ ] Delete the **80 `freescript-v0_*.zip`** (7.6 MB) from the working tree — referenced by nothing but "don't use these" docs. *(History purge to shrink the 63 MB `.git` is a separate, optional op — needs a force-push + re-clone on the Mac.)*
- [ ] Backend sidecar remnants: `backend/desktop_entry.py`, `backend/opendraft-api.spec`, `pyinstaller` in `backend/requirements.txt` (Docker already strips it)
- [ ] Vestigial root `package-lock.json` (89-byte, still named "FreeScript")

### npm — lane: `importexport` / build
- [ ] Drop `d3` (after deleting `CharacterConnectionsGraph`)
- [ ] Drop test-only `esbuild` + `@xmldom/xmldom` (used only by `test-script/*.mjs`); verify-then-drop `@types/dompurify`
- [ ] **Move `html2canvas` from devDependencies → dependencies** — it's imported by production `utils/screenshot.ts` (real packaging bug)

### Stale / mis-branded docs & scripts
- [x] `docs/desktop-build.md` — defunct Python-sidecar build; **deleted**, README link repointed to `DESKTOP-RELEASE.md`
- [~] `docs/UPSTREAM-OPENDRAFT-NOTES.md` — **kept**: CLAUDE.md intentionally references it as the archived upstream notes
- [ ] Reconcile `docs/RELEASE.md` (OpenDraft-branded) vs `docs/DESKTOP-RELEASE.md`
- [x] `release.sh` — repo constant fixed to `dac8767/ScriptCraft`
- [x] Misleading "backend on port 8000" toast at `ScreenplayEditor.tsx` — genericised

---

## Tier 2 — dead CSS (~3,000 lines, ~15%) — DEFERRED, needs a visual pass

**Status: deferred on purpose.** Re-verification during the cleanup run found the
dead selectors are *interleaved with live ones* inside the flagged ranges — e.g.
`.drag-handle`, `.delete-btn`, `.color-picker-swatch`, `.sort-select` sit inside the
"Projects hub" block in `12`, and `.fs-timefield` (the live TimeField) sits inside
the `fs-vomit` block in `22`. The substring-absence method also had a confirmed
**false positive**: the `ribed-*` / `rib-edit-*` ribbon-editor cluster was flagged
dead but has 14–26 live TS/TSX references — it is **live, do not remove**.

Because dead and live rules are interleaved and CSS changes can't be caught by
`tsc`/`test`, this needs **per-rule removal with a visual check on the running app**
(the Playwright live-check recipe in `HANDOFF-CONTINUE.md`, or Derek watching a
build). Do it as its own focused pass; do NOT bulk-delete ranges. Verified-dead
prefixes so far (0 TS/TSX hits — safe to remove *as individual rules*):
`script-notes-panel`, `sn-*`, `general-notes-*`, `note-item-*`, `fs-vomit-*`,
`fs-projects-*`/`fs-project-*`, `project-*`, `props-*`, `source-badge`, `script-card-*`,
`open-project-group-header`.

- [x] `12-projects-assets.css` — DONE: 83 rules removed per-rule (1350→854) via the
  postcss triple-gate filter + live pixel-diff (0 px across 4 surfaces). The
  `props-field/label/input/textarea` cluster proved LIVE (current properties
  dialog) and stays — `props-*` was partly live, same lesson as `ribed-*`.
- [x] `03-toolbar.css` projects part — DONE: 25 rules (the `.fs-pm-embedded`
  duplicate block + `fs-project-*` chooser), 1256→1218.
- [x] `15-responsive.css` tail — DONE: 45 rules, 801→714.
- [x] `22-tools-extra.css` — DONE: 36 rules (1847→1642). `fs-vomit-*` confirmed
  orphaned: the vomit feature lives in GoalsTool rendering `fs-goal-*` classes.
  `.fs-timefield` (live) untouched; `note-item-flash`/`note-item-media` proved
  LIVE and stay.
- [x] `09-script-notes.css` — DONE: 47 rules (501→229).
- [ ] `24-notebook.css` — ~313 (old ribbon editor `ribed-*`/`ruv-*`) (`notebook`)
- [ ] `10-character-profiles.css` — ~203 (`character`)
- [ ] `03-toolbar.css` — ~182 (mostly the duplicate project block + `zoom-menu-*`) (`toolbar`)
- [ ] smaller: `19-sticky-notes.css`, `05-scene-navigator.css`, `13-production-tags.css`, `18-elements-templates.css`, `06-editor-content.css`, `25-confirm-outline-tabs.css`, `20-tool-dock.css`, `23-toolbar-zones.css`

Confirmed still USED (do **not** remove): `.rel-map-toolbar-label`, `.rel-map-toolbar-hint`.

---

## Tier 3 — simplify / dedup (single-source-of-truth)

- [ ] One shared `<Modal>` shell — ~30 dialogs hand-roll overlay + Escape + backdrop (34 Escape handlers) — spine/shell
- [x] `uuid()`: `formattingTemplateStore` now imports `utils/uuid` (its identical local copy removed). The 3 storage-backend copies are intentionally standalone (zero-dep fallback chain) — left as-is. Added a module-local `clamp()` in `editorStore.ts` replacing 12 inline `Math.min/​max` copies.
- [~] Color palettes → `utils/palettes.ts` created; the scene-color set (duplicated between `SceneNavigator` and `SynopsisModal`, differing only in `''` position) is now the shared `SCENE_SWATCH_COLORS`. The broader ~14 palettes are mostly *different* palettes for different purposes (highlight vs note vs beat colors) — consolidate case-by-case as genuinely-shared ones appear.
- [ ] ~10 hand-rolled positioned popup/context menus → a `<PopupMenu>`/`usePopup` primitive
- [ ] 4 storage backends share a ~40-method interface (all **live** — SQLite→file→localStorage fallback chain) → extract shared interface/helpers, not deletion
- [ ] Dormant generic-plugin scaffolding in `plugins/registry.ts` (~130 lines; only the grammar-provider half is live, and this repo has no Pro-plugin split) — confirm intent, then trim to the grammar registry

---

## Tier 4 — split the monoliths (the real speed fix)

Do incrementally, one extraction per commit. This is also what unblocks parallel
chats (see `docs/AREA-MAP.md`).

- [ ] **`stores/editorStore.ts` (3,099)** → per-domain slices. Start with the 3 fattest/most-independent: **chrome-customization**, **beats/outline**, **spell/grammar**. Then update `docs/lanes.json` (`editorStore:<domain>` → `own:<slice>`) so the checker frees those lanes.
- [ ] **`components/ScreenplayEditor.tsx` (4,558)** → extract hooks: `useCollaboration`, `useTouchGestures`, `usePanelResize`, `useFileDrop`, `useFileAssociation`; one `<EditorDialogs>` host for the modal cluster
- [x] **`data/changelog.ts` (2,783 → 72)** → data array moved to `changelog.json` (359 versions / 573 items), imported statically; the file is now just types + tag logic + `APP_VERSION`. Source-scanning win done. *(Optional follow-up: make it a lazy `import()` in MenuBar to also drop it from the initial bundle — deferred as it touches the MenuBar spine file.)*
- [ ] **`components/MenuBar.tsx` (2,824)** → per-menu builder modules + a `menuActions` module + split out Diagnostics
- [ ] **`components/Toolbar.tsx` (2,078)** → the 32-case render switch → a token→renderer map module
- [ ] **`components/CharacterProfiles.tsx` (1,931)** → one component per tab + `useCharacterScan` + a shared asset-media module

---

## Suggested sequence

1. Tier 1 repo hygiene (zips, docs, sidecar remnants, npm) — instant clone win, near-zero risk
2. Tier 1 dead files + dead functions/actions — ~1,300 lines gone
3. `changelog` → JSON + lazy-load (Tier 4) — removes 2.7k from the hot path
4. Tier 2 dead CSS, cluster-by-cluster
5. Tier 3 `<Modal>` + small dedups
6. Slice `editorStore` + extract `ScreenplayEditor` hooks (Tier 4) — unlocks full parallelism

---

## v5.85 — why a round takes as long as it does (measured, 4-core box)

Derek: "updates are getting slow again."

| step | cost |
|---|---|
| `npx tsc -b` | 17s |
| `npm test` (1055 tests) | 39s |
| `npm run build` (runs tsc again) | 21s |
| ONE browser check, 3 assertions | 7.3s — of which ~6s is fixed boot |
| all 66 `check-*.mjs`, serially | ~15 min |

**The fixed cost is the whole story.** Every check launches a browser, loads
the app, seeds a script and opens a tool before it asserts anything — about
6s — and there are 66 of them. The assertions themselves are nearly free.

### What changed

- **`devtools/check-all.mjs`** runs the files CONCURRENTLY and warms the dev
  server first (Vite compiles on demand; without a warm-up several checks
  each pay the same cold compile). 933s of work → 490s wall.
- **Targeted runs**: `node devtools/check-all.mjs v581 v585` — 6 files in 77s
  instead of 15 minutes. Iterate targeted; run the suite once before pushing.
- **The suite's wall time is its slowest FILE**, not its total. check-v582
  drove seven browser sessions back to back and set the floor at 62s; its
  independent scenarios now run together — 39s, and the whole suite's floor
  drops with it. Keep a check file to one browser session, or Promise.all
  the sessions inside it.
- Concurrency past ~4 buys nothing here (77s at 4 jobs, 80s at 6): the long
  pole is one file, not the queue.

### Still on the table

- **~6s of boot per check, 66 times over.** One browser serving many checks
  from a pre-seeded snapshot would take a large bite out of ~400s of pure
  setup. It means reworking every check's preamble, so it wants doing once,
  deliberately.
- **48 assertions across the older checks fail because the app deliberately
  changed** (Pages tabs in v567/v571, the display-name-in-the-list that v5.85
  reverses). Each stale selector costs a 30s timeout as well as trust. Triage:
  repair what still describes the app, retire what does not.
- `npm run build` re-runs `tsc -b`. Running both is 17s of duplicate work —
  build alone is the gate.
