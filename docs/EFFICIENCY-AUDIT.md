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

- [ ] `12-projects-assets.css` — ~692 lines (old Projects hub) + its **duplicate** in `03-toolbar.css:259-294` + responsive tail in `15-responsive.css` (`importexport`-ish / spine)
- [ ] `22-tools-extra.css` — ~442 (`fs-vomit-*`, `fs-projects-*`, duplicate `note-item-*`) (`tools`)
- [ ] `09-script-notes.css` — ~347 (67% of file; old script-notes panel) (`notes`)
- [ ] `24-notebook.css` — ~313 (old ribbon editor `ribed-*`/`ruv-*`) (`notebook`)
- [ ] `10-character-profiles.css` — ~203 (`character`)
- [ ] `03-toolbar.css` — ~182 (mostly the duplicate project block + `zoom-menu-*`) (`toolbar`)
- [ ] smaller: `19-sticky-notes.css`, `05-scene-navigator.css`, `13-production-tags.css`, `18-elements-templates.css`, `06-editor-content.css`, `25-confirm-outline-tabs.css`, `20-tool-dock.css`, `23-toolbar-zones.css`

Confirmed still USED (do **not** remove): `.rel-map-toolbar-label`, `.rel-map-toolbar-hint`.

---

## Tier 3 — simplify / dedup (single-source-of-truth)

- [ ] One shared `<Modal>` shell — ~30 dialogs hand-roll overlay + Escape + backdrop (34 Escape handlers) — spine/shell
- [ ] `uuid()` reimplemented 5× → import `utils/uuid` (at least in `formattingTemplateStore`); add a shared `clamp()` (8 inline copies in `editorStore.ts`)
- [ ] ~15 scattered color palettes → one `palettes.ts` (incl. scene-color set duplicated verbatim between `SceneNavigator` and `SynopsisModal`) — `scenes`
- [ ] ~10 hand-rolled positioned popup/context menus → a `<PopupMenu>`/`usePopup` primitive
- [ ] 4 storage backends share a ~40-method interface (all **live** — SQLite→file→localStorage fallback chain) → extract shared interface/helpers, not deletion
- [ ] Dormant generic-plugin scaffolding in `plugins/registry.ts` (~130 lines; only the grammar-provider half is live, and this repo has no Pro-plugin split) — confirm intent, then trim to the grammar registry

---

## Tier 4 — split the monoliths (the real speed fix)

Do incrementally, one extraction per commit. This is also what unblocks parallel
chats (see `docs/AREA-MAP.md`).

- [ ] **`stores/editorStore.ts` (3,099)** → per-domain slices. Start with the 3 fattest/most-independent: **chrome-customization**, **beats/outline**, **spell/grammar**. Then update `docs/lanes.json` (`editorStore:<domain>` → `own:<slice>`) so the checker frees those lanes.
- [ ] **`components/ScreenplayEditor.tsx` (4,558)** → extract hooks: `useCollaboration`, `useTouchGestures`, `usePanelResize`, `useFileDrop`, `useFileAssociation`; one `<EditorDialogs>` host for the modal cluster
- [ ] **`data/changelog.ts` (2,783)** → move the data array to `changelog.json` + **lazy-import** only when the Changelog dialog opens (out of source scanning *and* the initial bundle)
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
