# ScriptCraft — continuation brief (current as of v7.20 — READ docs/SPEED-AUDIT-2026-07-28.md §3 before verifying anything; NOTE the isolate:false revert in §2)

> DELIVERED v7.05 — the ADD-ON track (all four items). Kept here as the record
> of what was asked and what was built:
> 1. Build an ADD-ON MODULE: a place add-ons can be installed into. (There is
>    already a `pluginRegistry` with `getRoutes()` wired in App.tsx — start by
>    reading it; this may be an extension of that rather than a new system.)
> 2. Convert the Action Rewrite tool INTO an add-on — Derek wants it as the
>    first real test of the add-on mechanism, and does not want that tool
>    widely distributed.
> 3. Then REMOVE Action Rewrite from the main app completely: reachable only
>    after installing the add-on. (Touches: RewriteTool.tsx, its ToolDock/
>    ALL_TOOLS registry entry, menu entries, shortcuts, `29-rewrite.css`.)
> 4. Move the DESIGN window into the Dev tab, and remove it as an option from
>    every toolbar and side panel. (`DEV_TOOLS` in editorStore is the existing
>    dev-only mechanism — the Design window should join it.)
>
> QUEUE — Derek, 2026-08-14 ("queue:"), **DELIVERED v7.15** — THE BRAND SWEEP.
> `devtools/brand-sweep.mjs` does it and `check-brand` guards it; §1's v7.15
> section lists every protection rule and why each exists. The analysis below
> is kept because it is still the map of what must never be renamed:
> "at some point recently you gave me terminal code that still had 'freedraft'
> in it. look through all code and make sure any instance of 'Freedraft' or
> 'OpenDraft' are removed (excluding the about page which actually talks about
> OpenDraft) and replaced with ScriptCraft"
>
> **185 files match. A blanket find-replace WOULD BREAK THE APP — read this
> before touching one of them.** Three groups, and only the third is safe:
>
> 1. **DATA-BEARING — DO NOT RENAME** (CLAUDE.md's opening note says this
>    explicitly, and it is the difference between a rename and data loss):
>    - **99 distinct `opendraft:*` localStorage keys.** Renaming them orphans
>      EVERY setting, workspace, theme, shortcut and layout Derek has — the app
>      would boot factory-fresh and his customisations would still be sitting
>      in storage under the old names.
>    - **the `.odraft` file format** (21 files reference it). Renaming it
>      orphans every saved script on disk.
>    - **`com.freedraft.app`** — the Tauri bundle identifier
>      (src-tauri/tauri.conf.json:5). It is the app's IDENTITY to macOS:
>      changing it makes the OS treat the build as a different application
>      (new preferences domain, new keychain entries, permissions re-prompted).
>    If these are ever to change it is a MIGRATION (read old key → write new →
>    keep reading old for N versions), not a rename, and it is its own project.
>
> 2. **DELIBERATE HISTORY — LEAVE** (he carved this out himself): the About
>    window credits OpenDraft as the upstream project, and
>    `docs/UPSTREAM-OPENDRAFT-NOTES.md` is the archived upstream doc. Code
>    comments citing "OpenDraft's inherited geometry" are provenance for a
>    decision — rewording them to ScriptCraft would make them false.
>
> 3. **SAFE TO RENAME — this is the actual job:** user-visible strings and
>    anything he could paste into a terminal. Start with what he actually hit:
>    **`setup.sh`, `deploy/deploy.sh`, `images/make_readme_gif.sh`** (terminal
>    code — this is the reported bug), then `SECURITY.md`, the 25
>    `user-manual/*.html` pages + `user-manual/style.css`, and the remaining
>    prose/labels in `frontend/src`. One real functional item hides in here:
>    `languageCatalog.ts:91` still fetches dictionaries from the Proteus
>    OpenDraft CDN — that is already a known release blocker (rehost), not a
>    string swap.
>
> Approach: NOT a global sed. Sweep group 3 by file, leave 1 and 2 alone, and
> add a check that fails if "freedraft"/"opendraft" appears anywhere outside an
> allow-list naming each permitted survivor — otherwise this recurs.

> QUEUE — Derek, 2026-08-13 ("add to queue"), **BOTH DELIVERED v7.16**:
> (Old #1 — Settings to File's bottom — was SUPERSEDED by his feedback row
> and DELIVERED v6.95: Settings sits in Help below About ScriptCraft.)
> 1. ~~The blank-line-before-a-scene-heading rule must NOT apply to the very
>    first scene heading on page 1~~ — v7.16. The rule's one source was
>    `isFirst ? 0 : SPACE_BEFORE[type]`, already honoured by the paginator,
>    the exporter and the thumbnails; the EDITOR said it for scene headings
>    only, so opening on FADE IN: began 12pt down. Now
>    `.screenplay-element:first-child`, once, for every element.
> 2. ~~Ribbon EDITOR item spacing/size ≠ the real ribbon bar's~~ — v7.16.
>    Three pieces of edit chrome each cost layout (section padding, an
>    auto-height wrapper that broke a two-row control's `height: 80%`, and
>    divider padding); check-v716 now diffs the whole bar in both modes.
> Also: Supabase ↔ Claude connectivity is LIVE in this remote environment
> (Derek opened the network policy and added SUPABASE_SECRET_KEY as an env
> var — v6.86/87 sessions read and can update real feedback rows via REST;
> never print the key, use $SUPABASE_SECRET_KEY). Sessions hold DATA rights
> only: schema changes (DDL) go through his dashboard's SQL editor — hand
> him a paste. His Mac's Claude Code could additionally add the official
> Supabase MCP server with a scoped PAT if he wants Claude doing schema.
> REPORT FORMAT (Derek, 2026-08-13, standing): EVERY report request gets
> the FULL list for EVERY incomplete item — in the turn's FINAL message,
> never as mid-turn text. (HARD LESSON: Derek's app does NOT display
> prose written between tool calls — tables emitted mid-turn to sit
> "above the card" were INVISIBLE to him; he saw only the screenshot and
> the list looked dropped. The final message is the only guaranteed
> render.) Each entry = label lines in this order, no numbering:
>   Status / From (name ONLY, no email) / Created / Category / Message /
>   App Version / Attachment
> Omit platform. ATTACHMENTS RENDER INLINE (Derek 2026-08-13: "that
> works"): `attachments` may hold SEVERAL comma-joined paths (v6.89) —
> split on ',', then for each path POST
> /storage/v1/object/sign/feedback-shots/<path> {"expiresIn":604800}
> with the secret key and put a markdown image of the FULL signed URL
> plus an "[Open attachment ↗](url)" link under that entry's lines. NO
> SendUserFile cards for reports (they can only stack above the final
> message — the confusion this replaced), never just the path, and NEVER
> Read the image in chat (it renders a stray copy; Read only when
> diagnosis needs eyes on it, and say so). DEFAULT FILTER: only INCOMPLETE items
> (`status=neq.Complete`) unless he explicitly asks for all/completed.
> READ the `feedback_report` VIEW (his date format baked in, US Eastern:
> "Aug 13, 2026 — 3:28 PM"); the raw table's timestamp column is
> `created` (NOT created_at) — write status updates to the TABLE, the
> view is read-only. Messages may carry list markers — print AS-IS.
> STATUS RULE (Derek 2026-08-14): when he TELLS a session to do a
> feedback item, mark that row Complete on shipping — he follows up
> with a NEW form if needed; don't wait for a retest.
> AUTO-IMPLEMENT RULE (Derek 2026-08-14, supersedes show-then-ask):
> feedback rows FROM DEREK (name Derek / derekcarl@pm.me) are BUILT as
> soon as a session pulls them up — "show feedback" = report THEN
> implement in the same turn, one version per pull, full gates once,
> mark Complete on shipping. Only pause to ask when a row is genuinely
> ambiguous or names a risk worth flagging first.

> READ FIRST — v4.84 fixed a v4.81 bug worth learning from: the window
> shape-memory was written correctly and then OVERWRITTEN by the dock-row
> click handler (`setToolMode(id,'docked')` on every open), so the
> commonest way to reopen a tool erased the memory. My driver had tested
> the Tools MENU path and passed; Derek hit the panel-row path. When a
> feature has several entry points, drive the one the user actually
> uses — the rule now lives in ToolDock's `openFromRow`: opening READS
> the mode, only explicit gestures WRITE it.


> QUEUE — **PARTLY DELIVERED, v6.63 + v6.70.** (a) the CHECKLIST producing
> ONE file and (b) WORKSPACES as a category are DONE — Settings ▸ Presets is
> the checklist, `PRESET_PARTS` in utils/presets.ts is the registry, and the
> file is `{kind:'preset-bundle', version:1, includes[], parts{}}`. v6.70
> took it to nine parts (annotation presets, shortcuts, design, helper text).
> STILL OPEN: **(c) every scattered export door opening THIS window** —
> Customize footer's Export (CustomizePanelsDialog:757), Settings ▸ System's
> "Export Settings…" (PreferencesDialog:758), Customize ▸ Themes' "Export
> Themes..." (ThemesTab:330) and the Outline's preset export
> (BeatBoard:1353) each still run their own flow. And the IMPORT side: the
> checklist governs export only; import applies everything in the file after
> a confirm naming it. `applyPresetFile(json, only?)` already takes the
> filter, so a mirror-image import checklist is a UI change away — Derek was
> asked and hasn't said. The original spec, verbatim:
>
> **ONE PRESET EXPORT WINDOW.** "I want to combine all of the various preset exports into one
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

### v7.20 — the copy filename, and the last two writers

Derek, reading what auto save produced — `Auto Save — Episode X — Auto save —
08-15-26 23.15.odraft`: "the filename shouldnt have spaces either. make
autosave filenames in this format: EpisodeX_autosave_08-15-26_23-15.odraft"

- **`copyFileBase(title, message, now)`** is the one name builder: no spaces
  anywhere, `_` between parts, `-` inside the date and the time. Note
  `safeName`'s "Untitled" fallback belongs to the TITLE only — applied to the
  kind it produced `EpisodeX_Untitled_…`, which a test caught.
- **The kind was in the name twice** — once from a hard-coded `Auto Save — `
  prefix, once from `message`. Worse, the prefix LIED for the other caller:
  File ▸ Take Snapshot goes through `mirrorSnapshot` too, so a snapshot the
  writer named himself came out labelled "Auto Save — …". The kind now comes
  only from `message` ('autosave' on a tick, the typed name otherwise).
- **The last two writers.** `snapshotToGDrive`/`snapshotToOneDrive` still
  wrote the bare document as `.json` — the v7.18 bug, missed by v7.19 because
  their filenames never contained "odraft" to grep for. Six writers, one
  serializer, found three at a time over three versions.
- **The guard that should have existed at v7.18** is now in
  `saveLocations.mirror.test.ts`: assertions over the MODULE, not a call —
  no `JSON.stringify(args.content)` anywhere, no copy named `.json`, and
  `odraftTextFor` used at least seven times (six writers + the definition).
  Negative-tested by regressing a writer; two assertions fired.
- **check-v642 had welded itself to the old name** (`"/Auto Saves/Auto Save
  — "`). It now asserts the FOLDER, which is what that check is about; the
  name's shape is pinned against the function that builds it.
- Gates: tsc 0, vitest 1229/139 (+9), build ok, check-all 1202/0.

### v7.19 — the same bug in the two cloud writers

Found while chasing v7.18's report (which turned out to be a stale running
app — Derek: "somehow an older version of the app was opened. when i restarted
scriptcraft it worked fine"). The grep that hunt required turned up two MORE
writers of the same broken file, in the same module:

- `saveToGDrive` and `saveToOneDrive` each wrote `JSON.stringify(args.content)`
  — the bare document — under a `<title>.odraft.json` name. A script fetched
  back out of Drive would not have opened either. Both now use
  `odraftTextFor`, so there are four copy writers and ONE serializer.
- Drive PATCHes send `name`, so an existing copy is renamed and corrected on
  its next save. OneDrive addresses by path, so the new name is a new file and
  the old one stays put — still openable, per v7.18's legacy tolerance.
- **The lesson is the count.** v7.18 fixed "the mirror" believing it was one
  writer; it was one of four, and the module was open in front of me the whole
  time. When a bug is "this feature writes the wrong file", grep for every
  writer of that file BEFORE fixing the one you were shown.
- Gates: tsc 0, vitest 1220/138, build ok, check-all 1202/0.

### v7.18 — the folder copy was never openable (found by v7.17's test list)

Derek, running step 1 on his Mac: "saved on desktop. it saved as Episode
X.odraft.json / it will not open in the app."

- **The bug, and it is not v7.17's.** Since v1.16 the Save As
  copy-in-a-folder wrote the BARE TipTap document under a `.odraft.json`
  name. A real `.odraft` is an envelope (`format: 'opendraft-script'`, a
  version, meta, then content), so `parseOdraft` rejected it — and it never
  got that far, because the name's last extension is `json`, which File ▸
  Open did not offer and `is_openable_file` refused. v7.17 changed only which
  mechanism did the writing. The v1.16 comment states the intention it never
  met: "a real file you can find, back up **and open**."
- **The auto-save mirror had been right since v6.42.** Same feature, same
  folder, two writers, one correct. `odraftTextFor` is now the one
  serializer and `mirrorPathFor` the one path rule; the copy is
  `<title>.odraft`.
- **The old files still open.** `parseOdraft` takes a bare doc node as legacy
  (`format === undefined && type === 'doc' && Array.isArray(content)`), and
  `json` joined the Open filter and `OPENABLE_EXTENSIONS`. Those copies may be
  the only record of what a folder held; orphaning them to tidy a format
  would be the same class of harm as renaming a storage key.
- **WHY NO TEST CAUGHT IT — the transferable part.** Two tests covered this
  naming (`saveBehaviour`, `saveNaming`) and both **reimplemented the rule**
  and asserted against their own copy, so they passed while the app wrote a
  file it could not read. saveBehaviour's own header says "a setting that
  looks like it does something and writes into the void is the worst kind of
  bug" — right about the risk, wrong about being protected from it. **A test
  that reimplements the thing it tests proves only that the copy agrees with
  itself.** Both now import `mirrorPathFor`, and
  `saveLocations.mirror.test.ts` asserts the round trip: write it, parse it,
  get the script back.
- The audit's step 1 is corrected as well — it said "reopen the file", which
  the app could not do even before v7.17, so the step made a pre-existing bug
  read as a regression.
- Gates: cargo check clean, tsc 0, vitest 1220/138 (+7), build ok,
  check-all 1202/0.

### v7.17 — the Tauri fs scope, narrowed to $APPDATA (audit item 3)

The one audit item that had been deliberately deferred since v4.82, because it
rewrites the save path and cannot be exercised in this sandbox. Derek: "continue
with Tauri fs scope."

- **What it was.** The capability granted `$HOME/**` — plus `$DOCUMENT`,
  `$DESKTOP`, `$DOWNLOAD` and `/Volumes` — for read, write, mkdir, remove and
  exists. The breadth existed for FOUR call sites that write to folders the
  USER picked, because Tauri v2's dialog plugin does not extend the fs scope
  to a picked path. The whole home directory, to serve four sites.
- **What it is now.** Those four go through Rust commands, which bypass the
  plugin scope by design; the capability is `$APPDATA/*` + `$APPDATA/**`.
  `SaveAsDialog`'s writability probe → `check_folder_writable` (new — it was
  the only thing that needed the plugin's `remove`); `saveLocations`' mirror
  copy → `save_text_to_path` (which the auto-save mirror eighty lines below
  already used); `screenshot` → `save_binary_to_path`; `AssetManager`'s
  drag-and-drop read → `read_binary_file`. Everything still on the plugin was
  AppData-based already.
- **THE SANDBOX HAS A RUST TOOLCHAIN.** `cd src-tauri && cargo check` runs and
  the crate compiles clean. Earlier sessions assumed the Rust half of a change
  could not be verified here at all — it can, and it should be from now on.
  Caveat, stated because it matters: it compiles for LINUX, so
  `#[cfg(target_os = "macos")]` paths are not covered. The new command has no
  cfg gates.
- **check-fs-scope (22)** holds the static invariants — the capability shape,
  who may import the plugin, that every remaining fs call names
  `BaseDirectory.AppData` (a call without it resolves against the CWD and
  fails at runtime only), and that every invoked Rust command exists AND is
  registered in `generate_handler!` (an unregistered command is a runtime-only
  "command not found" — exactly how this would break silently).
  - Its first cut passed `pdfExporter` **vacuously**: the import parser only
    understood `import {…} from` and `= await import(…)`, and pdfExporter
    destructures the plugin out of a `Promise.all` array, so it matched zero
    functions and reported "every fs call is AppData-based (0 fns)". It now
    matches bare calls (`(?<![.\w])name\(`, which excludes `el.remove()`) and
    **fails a file where it finds none**. Both negative tests — a `$HOME/**`
    put back in the capability, and one `BaseDirectory.AppData` swapped for
    `.Home` — were run and both failed the check as they should.
- **What is NOT verified, and cannot be here: the runtime.** No Tauri in the
  sandbox. `docs/AUDIT-2026-07-26.md` §3 carries the six-step test list for
  Derek's Mac; until those pass, treat this as shipped-but-unconfirmed.
- Gates: cargo check clean, tsc 0, vitest 1213, build ok, check-all 1202/0.
  The six-step Mac list, with what each step proves and how to revert just
  this change, is a table in `docs/AUDIT-2026-07-26.md` §3.

### v7.16 — the two queued formatting items, and two bugs found next door

Both were queued 2026-08-13. Both were "one rule, several renderers, and one
of them never got told" — the pattern §2 keeps logging.

- **Nothing sits below a blank on the first line of page 1.** The rule
  (`isFirst ? 0 : SPACE_BEFORE[type]`) was already in the paginator, the PDF
  exporter and the Pages thumbnails. The EDITOR only said it about scene
  headings — `.scene-heading:first-child { margin-top: 0 }` — so a script
  opening the normal way, on FADE IN:, started 12pt down, and one opening on
  ACT ONE started 24pt down. Now `.screenplay-element:first-child`, stated
  once for every element (`06-editor-content.css`). A custom template still
  overrides it through `templateCss`, which emits its own matching-weight
  `:first-child` per element.
- **The ribbon editor renders the live bar's geometry.** Three separate bits
  of edit-only chrome each cost layout, and they added up to Derek's two
  screenshots (`24-notebook.css`):
  1. `.rib-edit-section { padding: 0 2px }` — every section 4px wider, 2px
     left. Gone; the dashed ring moved to `outline-offset: 1px`, which costs
     nothing (v4.22 had already made it an outline for exactly this reason).
  2. `.rib-edit-item` wrapped controls in an auto-height inline-flex, which
     broke the `height: 80%` on a two-row control — a percentage with no
     definite base falls back to content height, and the Customize block went
     43px → 48px. `align-self: stretch` + `align-items: center` gives the row
     height back and centres like the live row does.
  3. `.rib-edit-sep { padding: 0 4px }` made each divider 10px against the
     live bar's 2px, so every section after the first drifted 8px right. The
     padding stays (a 2px divider is unclickable) and an equal negative margin
     cancels it — **at matching weight**: `.toolbar.toolbar-ribbon
     .rib-section-sep { margin: 0 }` (0-3-0) silently beat a plain
     `.rib-edit-sep` (0-1-0), so the first attempt looked applied and wasn't.
  - A `::before` overlay was tried first for (3) and was worse: it left the
    ELEMENT 2px wide and an adjacent × badge won the hit test. check-v683
    caught it. **Prefer changing the box you already have over adding an
    invisible one.**
- **Found while fixing (3): an invisible × was eating clicks.** `.rib-edit-x`
  is `opacity: 0` at rest and hangs 7px outside its item, so it was
  intercepting clicks meant for the divider beside it — you click the line,
  nothing happens, nothing says why. It is `pointer-events: none` until the
  hover that reveals it. check-v716 clicks it after hovering, so the badge
  can't quietly stop working.
- **Found while fixing (1): the Pages tool kept PRIVATE copies** of
  `FD_INDENTS` and `SPACE_BEFORE`, headed "same as pagination.ts". They
  weren't: scene headings still took ONE blank line (v6.30 made it two) and
  the right edge was still 7.50in (v6.33 measured 7.80). Imported from
  `utils/screenplayMetrics` now. **A comment claiming two things match is not
  a mechanism that makes them match.**
- check-v716 (18) covers all of it: five opening element types measured in
  the editor, the whole bar diffed live-vs-edit section by section and button
  by button, the × still removing, and the source-level assertions that the
  copies are gone. Gates: tsc 0, vitest 1213, build ok, check-all 1180/0.

### v7.15 — the brand sweep, Derek's thin-line gear, and the check that was lying

- **Brand sweep.** Derek: "look through all code and make sure any instance of
  'Freedraft' or 'OpenDraft' are removed (excluding the about page which
  actually talks about OpenDraft) and replaced with ScriptCraft."
  `devtools/brand-sweep.mjs` does it, and **refuses to touch anything that
  NAMES a thing**: the 224 `opendraft:` storage keys, `.odraft`,
  `com.freedraft.*`, `OPENDRAFT_*` env vars, service/volume/project slugs,
  asset filenames, opendraft domains, the upstream GitHub URL, and — the one
  that would have broken a build — the Android keystore's `-alias opendraft
  -storepass opendraft`, whose partner `${ANDROID_KEY_ALIAS:-opendraft}` sits
  fifteen lines below where a word-boundary rule can't see it. 61 files
  rewritten; two fixed by hand (README's `Try_ScriptCraft_Now` badge label,
  deploy.sh's example project names). `frontend/devtools/check-brand.mjs`
  runs `--check` in check-all so a new mention can't creep back.
  - **Every rule in `standsAlone` is a thing the tool broke on its first run
    and I caught by reading the diff.** In order: reverse-DNS identifiers
    (`package com.proteus.opendraft` in `android-src/MainActivity.kt`, whose
    directory the release workflow derives from it; the iOS
    PRODUCT_BUNDLE_IDENTIFIER; the entitlements keys; the Play Store URL; and
    `%APPDATA%\com.proteus.opendraft`, where a Windows writer's data lives).
    `cd OpenDraft` under a `git clone …/OpenDraft.git` (clone one folder,
    enter another). `depends_on: - opendraft` in the compose file, whose
    service key `opendraft:` the storage-key rule happened to protect.
    `DB_USER="opendraft"` twenty lines above `${DB_USER:-opendraft}` — the
    keystore bug again, in a second file. `images/ios-config/project.yml`, a
    stashed copy of the generated iOS project that must keep matching it.
    And `images/OpenDraft-1024x1024.png`, renamed by my own too-greedy rpm
    rule. **If you extend this tool, read the diff line by line — the check
    only proves nothing was MISSED, never that nothing was wrongly taken.**
- **The download names were stale and nobody had noticed.** `productName`
  became "ScriptCraft" at v1.34, so tauri has been emitting
  `ScriptCraft_0.19.0_aarch64.dmg` and `ScriptCraft.app` ever since — while
  `release.yml`, `release.sh`, the README table and the landing page all still
  asked for `OpenDraft_*`, and release.sh's Cargo.lock bump was `perl`-ing a
  package called `opendraft` that hasn't existed since v2.85 (silent no-op).
  Now derived consistently, as a second rule set inside brand-sweep so
  `--check` guards it. It went unseen because the pipeline never runs:
  `build-desktop.sh`, the script Derek actually uses, finds the .dmg by glob.
  **`frontend/src/` is swept BY HAND and skipped by the tool** — most of its
  mentions are provenance ("OpenDraft's inherited A4 geometry") and rewriting
  those makes true sentences false. Same reason KEEP_FILES holds the
  changelog, the handoffs, CLAUDE.md and AboutDialog.
  - The first run over-reached exactly that way — it rewrote provenance
    comments, changelog history, and a *search pattern*
    (`/scriptcraft|freedraft|opendraft/i` → three identical alternatives).
    Reverted with `git checkout -- .`, then tightened. If you extend this
    tool, re-read the reverted mistakes before trusting a diff of 60+ files.
- **The Settings gear.** Derek drew one, then sent the thin-line version plus
  a screenshot of the macOS ScriptCraft menu: "match the size and color of the
  gear icon to the icons in the screenshot." Now 12 teeth, `TOOTH = 0.52`,
  `FLANK = 0.10`, `R_TIP = 238`, `R_ROOT = 186`, stroke 16, inner circle
  r 128 — `GEAR_PATH`/`GearIcon` in `uiIcons.tsx`, and the SAME path
  rasterized at `rasterizeGear(32)` with `INSET = 0.88` for the native menu
  item. One path, two renderers.
- **check-v673 was failing, and it was the check that was wrong.** See §2 —
  this is the most transferable thing in the version.
- Gates: tsc 0, vitest 1213, build ok, check-all 1119/0. Catalog unchanged.

### v7.11–v7.14 — one line each (no separate sections; the changelog has the detail)

- **v7.14** — Lock All out of the Settings tabs (kept in the Customize window); Backup & Restore its own bottom tab carrying Presets; "Toolbar" → "Ribbon Toolbar"; the Downloads tab deleted with its two sections folded into Save Options (Screenshots last); feedback attach buttons aligned to the paperclip; the sent message favours the top; **"Saved" flashes in the Quick Access bar** (`utils/saveFlash.ts`, `SavedFlash` in `TitleBar.tsx`) instead of toasting from the corner.
- **v7.13** — the gear Derek drew, in white: `--fd-icon-strong` (white on dark themes, `var(--fd-text)` on light/sepia/solarized-light/paper), and the native menu item rasterizes the same path.
- **v7.12** — the Page Setup tab grew a template LIST at the top (View / Edit / Delete, delete on custom only) above the shared Shown/Hidden `DndColumns`; first cut of a gear for Settings.
- **v7.11** — built-in templates got editable page setups (`templatePageLayouts` override map in `formattingTemplateStore`, persisted to `opendraft:templatePageLayouts`, with `getTemplateBasePageLayout` for Reset); extensions put on hold at Derek's word.

### v7.10 — Action Rewrite removed, extensions on hold, page setup per template

**Action Rewrite is gone at every layer**, because Derek asked for it
"completely": the tool, `RewriteTarget`, `utils/actionRewrite`, `29-rewrite.css`,
the ToolId, the default tool config/order, the declutter setting, the Help ▸
Developer entry — and the Rust side (`rewrite.rs`, `rewrite_log.rs`, eight
tauri commands). **Removing a feature can retire a DEPENDENCY:** `keyring` had
exactly one user (the BYO key in the OS keychain), so the crate went with it and
the About window's open-source list dropped keyring-rs in the same commit, per
the standing rule. `cargo check` before/after: same two pre-existing warnings.

**Extensions are on hold — and the v7.05 registry was removed, not parked.**
Derek wants COMMUNITY extensions eventually; that is a different design from
the bundled catalog, so leaving `addonRegistry.ts` unwired would have been dead
code encoding a superseded model. Recover from git at `daf89df` if the
community design reuses any of it. The Extensions tab is out of Settings rather
than left offering an empty list.

**Page setup per template — and the built-ins are editable ("Built ins").**
Three things worth keeping:

- **ONE page of fields.** `PageSetupDialog` gained optional `value` / `onSave` /
  `resetTo`; without them it writes the document's layout exactly as before.
  `PageSetupTab`'s View hands it a template's. Do not fork it — twenty fields in
  two copies WILL drift.
- **The override lives in a store map, not on the template.** The six system
  templates are immutable constants, NOT rows in `templates[]`, so
  `updateTemplate()` on one is a SILENT NO-OP — the exact shape of the
  v0.63–v0.70 Show/Hide bug. `templatePageLayouts` + `getTemplatePageLayout`
  (defaults → the template's own → the override) is the same arrangement
  `elementHidden`/`elementOrder` already use for the element list.
- **Choosing a template applies its page setup.** Nothing read
  `template.pageLayout` before this — the field existed and did nothing. A page
  of fields that changes nothing is the failure mode this repo keeps finding.

**Two check lessons.** check-v710's first cut called
`setPreferencesOpen()`, which does not exist — Settings never opened, and
"no Extensions tab" PASSED against an empty list. *A removal assertion that can
pass vacuously is worse than no assertion:* assert the list is non-empty in the
same breath. And the import that made `templateMigration.test.ts` fail was one
line — the template store now reaches `editorStore`, which reads localStorage at
module scope, so that test needs jsdom.

### v7.09 — the title page PDF exported the title and lost the rest

Derek: "i exported a title page as a pdf and it did not export all of the
information." Title, subtitle and credit line were there; draft, contact,
copyright, WGA registration and notes were not.

**The cause is a grid and a renderer that disagreed about padding.** The title
page is laid out as LINES — `titlePageBlockSpecs` positions everything by
emitting blank blocks (~14 above the title, then a computed gap that lands the
bottom block on line ~50 of ~54). The PDF exporter added 4pt after every block,
blanks included. ~45 blocks × 4pt ≈ 180pt — two and a half inches — so the
bottom block fell past the page bottom and `y + lineH <= bottom` skipped it
silently. **Any per-block padding on a line grid is a bug, and the drift is
invisible until it crosses the page edge.**

**The stacking is one function now** — `stackTitlePageBlocks` in
`utils/titlePageLayout.ts`, beside the builder whose grid it walks, so a test
can drive it. The exporter only draws. Overflow trims BLANK lines (widest gap
first), never text: an export loses whitespace, not words.

**How it is verified: read the PDF back.** `devtools/check-v709.mjs` runs the
real exporter, takes the saved file, inflates the content streams and decodes
the hex glyph strings through the embedded font's own `/ToUnicode` CMap — the
same thing a PDF reader does. Asserting on `pdf.text()` calls was tried first
and does not work: jspdf v4 puts nothing on `jsPDF.prototype`/`API`, so the
hook recorded silence and every assertion "passed" against an empty list.
**A check that reads back the artifact beats one that watches the code make it.**

### v7.08 — four bugs from one feedback row

1. **FADE IN: right-aligned in the Pages tool.** The editor's left alignment is
   a live ProseMirror DECORATION; a thumbnail never runs decorations, and
   `SceneNavigator`'s own `FD_INDENTS` pinned every transition right. It calls
   `isLeftTransition` now — the predicate the decoration and the PDF exporter
   already shared. **Third copy of a rule found this month; look for the others
   before adding a fourth.** The editor rule also got `.page
   .screenplay-element` in its selector: a custom template injects that exact
   0-3-0 selector (`utils/templateCss`), which outranked the 0-2-0
   `.transition.transition-left` and would have flipped FADE IN: back on every
   template but Industry Standard.
2. **A ghost cast name.** The autocomplete filtered a CACHED array refreshed
   only when the cursor crossed a name line's edge, so a cue typed, left and
   then deleted stayed on offer. `collectCast()` reads the document, and skips
   the cue being typed. **A cache with narrow invalidation triggers is a stale
   list waiting to happen; read the doc.**
3. **Adding a line above a scene heading un-typed the heading.** Enter at
   offset 0 left the caret IN the heading, so the next keystroke — or the
   element picked from the dropdown — landed there. The caret goes on the new
   blank line now, and the type fix-up rides the SAME transaction as the split
   (it used to be a second `view.dispatch`, which made one Enter two undo
   steps). **Two dispatches for one gesture is always wrong.**
4. **Transition on an empty page.** `allowedElementsAfter` treated "nothing
   above" as "an unlisted element above" and hid it. The top of a script is
   where the opening transition lives.

**Flaky-check lesson:** check-v708's undo assertion seeded a fixture and
pressed Enter inside prosemirror-history's 500ms grouping window, so one undo
took the fixture away too and the check read the PREVIOUS document. Wait past
the group delay before testing undo.

### v7.05 — the add-on module; Action Rewrite becomes the first add-on

**What was built.** `src/addons/addonRegistry.ts` — a bundled catalog plus
install state persisted to `opendraft:addons:installed`. `Settings ▸ Add-ons`
installs and removes. Action Rewrite is the first add-on; the Design window is
`devOnly`.

**Be honest about what this is.** Nothing is downloaded or evaluated — the
add-on ships inside the app and is GATED. That is what Derek asked for (a
private tool he does not want widely distributed), and running fetched code
inside a desktop app with filesystem access is a decision to take deliberately.
The seam for remote add-ons is the catalog.

**THE bug worth remembering: gating a list is not enough.** `availableTools()`
covers the menus and the Customize/ribbon pickers, but the DOCK RAIL filters on
the persisted `toolConfig`, which remembers a tool that used to be enabled — so
Action Rewrite still had a rail row until the rail was gated too. "Removed from
the app" means every surface, and the surfaces do not share one list.

**And: install state is not store state.** The rail reads `gatedToolIds()`
during render, so nothing invalidated it — installing from Settings did not
refresh the rail until some unrelated re-render happened. `useAddonRevision()`
subscribes; any component reading the gate during render needs it.

**Three stale drivers surfaced, one badly.** check-v554 asserted the OLD
contract (Help ▸ Developer lists Action Rewrite) — inverted, and it plus five
others now call the new `installAddon(page, id)` driver helper. check-v549's
Design dock-seat asserts tested docking the tool no longer does (retired
explicitly). And its Pages block measured `.fs-pages-actions .tool-action-count`
— an element that exists nowhere in that tool at v7.04 either, so the block
threw and THREE of its eleven asserts had silently stopped running. It reported
"8 passed, 0 failed" and the suite called that green. **A driver that reports
fewer asserts than it contains is failing quietly** — worth a check of its own.

### v7.04 — dead-CSS sweep (309 → 223) + the last inline-styling islands

**Read this before writing another CSS-deleting script.** The first attempt
regex-matched `SELECTORS { BODY }` and broke the build: a multi-line COMMENT
containing a `{` was parsed as a selector, so the real selector below it got
deleted and a brace was orphaned. Reverted, rewritten with a parser that blanks
comment bodies first (preserving offsets) and tracks brace depth so `@media`
wrappers are descended into rather than treated as rules. 152 rules removed
cleanly, braces balanced, build green.

Also: the shell cwd resets to the REPO ROOT between calls. Both the "0 rules
matched" and the "Cannot find module devtools/…" in that same run were one
cause — the script ran from `/home/user/ScriptCraft`, not `frontend/`. Print a
sanity count (`stylesheets found: 28`) at the top of any such script.

**The backlog is 223, and that is a floor for this method.** Those names can be
assembled at runtime, so absence from the source proves nothing. Clearing them
needs instrumentation — record which classes the running app actually applies,
exercise every window, delete what never appears.

**`.fs-ob-title` was dead and carried a Design knob.** Deleting the rule
orphaned `obTitleFont`, the no-dead-knobs test failed instantly, and the knob is
now removed — the Design window had been offering a slider that moved nothing.
That test earns its keep.

**Item 13 closed with judgement, not completeness:** About ▸ Compatibility and
Grammar & Spelling Settings converted (static styling); Notebook, Title Page,
menu bar, Relationship Map, Beat Board keep theirs (computed positions —
legitimately inline). The conversion surfaced an error box hardcoded
light-on-white (unreadable in dark themes) and tabs wearing `dialog-btn` from
v7.02 that every inline rule overrode — adding a class is not the same as the
class taking effect.

### v7.03 — the two style-audit items that needed measuring first

**The lesson worth keeping.** I had deferred item 11 (make every control inherit
the app's text size) to its own version, on the grounds that it would resize
every control at once. That was true at v7.00. It was NOT true by v7.02 — the
work of classing controls had already given nearly everything an explicit size.
Measuring before scheduling the risk (a probe capturing all 112 visible controls
across the editor, six Settings tabs and ten tool windows, run before and after)
showed exactly TWO classes still on the browser default, and applying the reset
moved nothing. `button, input, select, textarea { font: inherit }` is in.

Watch out for a probe that reports "clean" because the surface never opened: the
first version used `window.__scStore.getState().setAboutOpen?.(true)` and similar
for four dialogs, and those setters do not exist — the optional call silently did
nothing and the surface reported clean. Verify the setter exists, or open the
window through its real door.

**Item 17, the highest-value flag.** The `[data-theme="light"] input/select/
textarea { … !important }` block is gone. It was the rescue that repainted the
hardcoded `#222` controls in the Light theme — which is precisely why that bug
lived so long: Light looked right while Sepia/Paper/Solarized Light showed black
boxes. v7.02 tokenized those controls, so the rescue had nothing left to do, and
while it stood its `!important` overrode legitimate per-control colours too.
Verified after removal: all ten of those controls still render white in Light.
The rest of the `!important` flags need case-by-case judgement and stay.

**Item 19:** the size scales are now a table in `CLAUDE.md` §3.

Still open from the audit: item 13 (six windows with modest amounts of inline
styling) and the 309-class dead-styling backlog, which `check-dead-css.mjs`
guards but has not cleared.

### v7.02 — the rest of the style audit ("proceed with all of your recommendations")

Derek asked for the remaining items translated into plain language
(`docs/STYLE-AUDIT-REMAINING.md`, 19 items with menu paths instead of CSS
selectors), then said to proceed with every recommendation in it. Items 1-10,
14, 15, 16 and 18 shipped; 11, 13, 17 and 19 are still open and listed at the
bottom of that doc with the reason.

**The dictionary windows were the real prize.** Settings ▸ General ▸ Grammar &
Spelling and the Dictionary Library each defined their own `buttonStyle` /
`inputStyle` objects in JS and 68 inline style blocks between them. Because
nothing connected them to the stylesheet, their buttons were NATIVE in every
dark theme — the one rule that gave them a background, `.dialog-body button`,
exists only under `[data-theme="light"]`. **That is why it survived: it looked
correct to anyone checking in Light.** Worth remembering as a review reflex —
check a dark theme before believing a control is styled.

**New tokens:** `--dz-select-h` (28) / `--dz-select-h-compact` (22) /
`--dz-select-font`, and `--dz-dialog-btn-radius` moved 4 → 5 (the house radius).
Remember the designTokens contract: a knob's `def` must equal the CSS fallback
literal — changing one without the other fails the suite, which is exactly what
caught the radius change here.

**Title scale:** 16 window / 13 panel / 11.5 section, section heads muted.
`.tool-window-title` is knob-driven, so its KNOB default moved 12 → 13 rather
than hardcoding past it.

**`devtools/check-dead-css.mjs` is new and found 309 orphaned classes.** It
BASELINES them (`dead-css-baseline.json`) and fails only on new ones — deleting
309 blind is how you remove something composed at runtime. Shrinking that
baseline is a real cleanup task waiting to be done. Three of the title rules
edited for item 4 turned out to be in the backlog, so those edits did nothing.

**Judgement call to know about:** the Characters tool's profile fields stay at
26px against the 28px house dropdown — a v4.26 note made that split deliberate
and they track each other inside the meta rows. The genuine bug there (the sort
dropdown rendering 22px in one place, 28px in another — same class) is fixed.

### v7.01 — the style audit's fixes (report → change list → shipped)

Derek: *"do a full style audit… make sure that things which should be the same
are actually the same"*, then *"give me the full suggested change list"*, then
*"continue with all suggestions that you can do on your own."*

- **`docs/STYLE-AUDIT-2026-08-14.md`** — the audit (3 passes: scripted CSS
  inventory, live computed-style probe, source re-verification).
- **`docs/STYLE-AUDIT-CHANGE-LIST.md`** — 360 itemized changes; 218 marked ✅
  shipped in v7.01, the rest split into "waiting on Derek" vs "not yet done".

**The headline bug.** Six `--fd-*` tokens were consumed by the stylesheets and
defined by NO theme (and not written by `themes.ts` either), so ~50 hover,
selected and background declarations computed to nothing. They are `:root`
ALIASES now — `[data-theme]` sits on the same element as `:root`, so one line
per token covers all 11 themes plus custom ones. **Do not inline them.**

**The trap worth remembering.** Fixing the primary-button hover took two goes:
adding a background to `.dialog-btn-primary:hover` fixed dark, but the light
theme has its own `[data-theme="light"] .dialog-btn:hover` at 0-3-0, which
outranks it. The fix is `:not(.dialog-btn-primary)` on BOTH plain-button hover
rules, so the plain rule can never target a primary. Source order alone was one
edit away from breaking again.

**Also in:** `color-scheme` + a font-family reset (native controls in Settings);
27 `dialog-primary` → `dialog-btn dialog-btn-primary`; `dialog-btn-sm` given a
real height; 117 hardcoded state colors → `--fd-danger`/`--fd-success`/
`--fd-warning`; 11 more keys in `THEME_VARS`; the `#222` controls tokenized so
sepia/paper stop showing black boxes; `TemplateSelectDialog`'s native
`confirm()` (which deleted regardless of the answer) → `confirmDialog`.

**New gates:** `src/styles/tokenResolve.test.ts` (7 asserts — undefined tokens,
fallback-only tokens, no `dialog-primary`, no native dialogs) and
`devtools/check-v701.mjs` (16 computed-style asserts across 11 themes).

**Three stale drivers found and fixed** — `check-v574`, `check-v673` (both
clicked the retired `.dialog-primary`) and `check-v677`, whose Defaults probe
had been looking for a `.swn-add-btn` labelled "Reset Items" since the **v7.00**
rebuild renamed those rows. v677 and v574 had been aborting mid-run, so ~14
asserts had not been running at all. If a driver "flakes", check whether it is
actually stale before believing the flake.

### v7.00 — Settings IA reorg + Defaults rebuild + per-template View

- FOUR feedback rows in one version (auto-implement rule).
- Sidebar CATEGORIES: System (general, saveloc, downloads NEW, languages
  NEW, keys), Page (page, presets, defaults), Customize. The 'system'
  tab is GONE (SettingsPage import dropped; the FILE stays — App.tsx
  still uses it). Languages = GeneralTab's LanguageSection in its own
  tab. Downloads = NEW `downloadFolder` in settingsStore (SL_KEYS
  idiom) wired into fileOps.saveFileTauri (save dialog defaultPath =
  folder/filename; browser build can't steer downloads) + the
  Screenshots section MOVED from Save Options. GOTCHA: v6.99 had
  silently left a DUPLICATE Screenshots section in the save tab (the
  move was append-without-delete); v7.00 removed both copies there.
- Defaults tab REBUILT: `.fs-defaults-row` rows (label + "Restores
  {what}." + Reset btn) in the standard boxes; the WINDOW resets joined
  CUSTOMIZE_RESETS ('design'/'helper'/'keys' pseudo-tab ids added to
  CustomizeTabId — ResetSection ignores them): designVars, helper
  overrides+hidden, shortcut overrides — all through runCustomizeReset.
- cz-toolbar: the v6.83 HANDOVER is REVERSED per Derek's row — the entry
  stays in Settings and embeds CustomizePanelsDialog(soloCategory
  toolbar); the 'scriptcraft:open-customize' listener remains (checks
  use it to arm live on-ribbon editing).
- Page Setup: embedded PageSetupDialog LEFT the tab (its Apply with it —
  File ▸ Page Setup… still owns current-script geometry); every row has
  View → TemplatePageInfo window (template.pageLayout over
  DEFAULT_PAGE_LAYOUT: size + margins).
- check-v642 35/0 (categorized rail, Downloads content, Defaults
  coverage, View window, both moved-out heads asserts); check-v683 12/0
  (embed instead of handover; arming via the event door needs
  waitForSelector — settle alone is too fast). check-v677 flaked once in
  the suite, green standalone (the recurring contention pattern).
- Gates: tsc 0, vitest 1205, build ok, check-all green (1 flake rerun).
  Catalog 488.

### v6.99 — Page Setup tab (templates managed like themes) + Save/Cancel

- Two feedback rows, built on the AUTO-IMPLEMENT rule above.
- 12:54 row: Draft Number → General (top section; GeneralTab now takes
  `editor`); Screenshots → LAST in Save Options; Settings footer =
  Cancel + primary Save (`.prefs-footer`). Settings apply LIVE, so Save
  just closes; Cancel restores the open-time snapshot through
  utils/settingsSnapshot (generic over every settingsStore field with a
  set<Field> twin — the setters carry the per-field localStorage writes,
  a bare setState would revert memory but not disk; unit-tested) plus
  editorStore's typewriterRestoreCursor.
- 1:01 row: the 'formats' (Templates) tab is GONE — `PageSetupTab.tsx`
  merges the template manager + embedded PageSetupDialog under the
  'page' tab id (openPreferences('page') callers unchanged; the
  windowTabMemory validity check drops stale 'formats' automatically).
  Templates manage like Themes: SHOWN/HIDDEN lists over the SAME
  `enabledScriptFormats` ids the old checkboxes wrote (no migration;
  empty = all shown; ≥1 rule kept), six system templates badge
  "Default" (no Edit/Delete), user templates get Edit/Delete
  (confirmDialog danger), New Template… = pick a base (any template) →
  duplicateTemplate → TemplateEditorDialog on the copy → shown.
  NewScriptDialog.formatOptions + ScriptFormatPickerDialog now include
  user templates (hidden ids stay out). The STANDALONE
  ScriptFormatPreferencesDialog (first-run + Format menu) still exists
  over the same store field — same data, second door, no drift.
- check-v642 31/0 (Draft-on-General, no Templates tab, Shown/Hidden
  manager, Hide shrinks the picker set, footer Cancel REVERTS the hide
  and closes, Screenshots-last). vitest 1205 (+settingsSnapshot pair).
- Gates: tsc 0, vitest 1205, build ok, check-all 1095/0. Catalog 487.

### v6.98 — titles into the boxes; aligned buttons; steadier lists

- Feedback row 12:19 AM (all four items, marked Complete on shipping —
  the new STATUS RULE above): (1) section h3 is IN-FLOW inside the box
  again (the v6.95 absolute inset + its bg-parity dance are GONE); (2)
  settingsWin grew prefsPadTop 12 (--dz-prefs-pad-top) and
  prefsTitleGap RETARGETED to the h3's margin-bottom (same id + var —
  persisted overrides keep meaning "title to items" — def 16→10);
  (3) list-continuation hardening: the onKeyDown now reads
  ta.value (the DOM), NOT the render-closure `message` — any lag
  between them made Enter silently skip (his "suddenly it started
  working"); bare "-"/"1." with no trailing space now counts as an
  empty item ("-word" stays text); (4) `.prefs-check-row
  .prefs-inline-btn { margin-left: auto }` right-aligns every Choose
  Folder… (spread 0px across 4 rows, asserted).
- check-v642 24/0 (title in-flow + within-box + button alignment;
  the h3-bg parity assert died with the inset design). check-v684 26/0.
  GOTCHA: a check driven while Vite is mid-HMR from fresh edits can
  fail on remounts — rerun once the compile settles before diagnosing.
- Gates: tsc 0, vitest 1203, build ok, check-all 1088/0.

### Older versions — one line each (full sections in `docs/HANDOFF-ARCHIVE.md`)

Newest first. When a version rolls out of the detailed set above, its section
moves verbatim to the archive and its line lands here.

- **v6.97** — settings-box knobs + fill (Design group `settingsWin`, one `.prefs-general section` rule for every tab); the v6.96 format buttons replaced by `continueListOnEnter` (typing "- "/"N. " then Enter continues the list)
- **v6.96** — formatting buttons in the feedback Description box (B/I/U/UL/OL wrap the live selection in markdown markers via `applyMarkdownFormat`; the box stays a plain textarea, `message` stays plain text)
- **v6.95** — settings clean pass (Auto Saves merged, helper text pruned, bordered group boxes) + Settings moved to Help below About ScriptCraft
- **v6.94** — the ? retired from the feedback form; "Description:"; five more Feedback knobs (13 total; fbHelpGap removed with the ?)
- **v6.93** — attach buttons joined the header row; Submit; the first nine Feedback design knobs (fb* group)
- **v6.92** — feedback window wording pass ×11: Name:/Type:/Description:, Full Screen button, Attach a Screenshot header, how-to behind a ? (retired v6.94)
- **v6.91** — feedback categories renamed: Bug Report / Suggestion / Feature Request / Other (Praise retired)
- **v6.90** — attachment area header renamed "Attach an Image" (v6.92 later made it "Attach a Screenshot")
- **v6.89** — multiple attachments (buttons stay, picks APPEND, comma-joined attachments column) + the sent blur-veil confirmation (3s, -webkit-backdrop-filter; checks must wait the veil away before the next fill)
- **v6.88** — the Feedback draft survives moving the window (module-level draft, mounts rehydrate; unmount no longer revokes shot URLs; resetFeedbackDraft for tests)
- **v6.87** — the Feedback ATTACHMENT AREA (the first request submitted through the form itself): labeled box + Browse…, real-format uploads, `attachments` + `status` enum columns (his SQL paste), sessions hold data-not-DDL rights
- **v6.86** — feedback SIMPLIFIED to the once-only tester profile (no verification, anon inserts; Derek's RLS paste); v6.84 auth in history at 0c9b43e
- **v6.85** — Settings ▸ Defaults joined the warn+undo wrapper (runCustomizeReset — one registry, both surfaces); Supabase env key + open network verified live in-session
- **v6.84** — NATIVE Feedback replaced the Airtable iframe: Supabase via plain fetch, email-code sign-in + sessions (retired v6.86 — code at 0c9b43e), screenshot upload, visible offline queue
- **v6.83** — ribbon editing ×4: dropdown horizontal resize in customize mode; dividers hide/show by plain click (no ×); Settings ▸ Customize toolbar hands over to the LIVE editor; right-of-split items right-align in edit mode
- **v6.82** — Show/hide Annotations ribbon icon → FaPenNib (distinct); "drag to move this section" tooltip removed; two-row ribbon sections show the Editor View dropdown bare
- **v6.81** — compare seating from FULLSCREEN entry (clear the takeover, then openTool); Take Snapshot + Compare share the accent style
- **v6.80** — the empty-summary mystery SOLVED (seat history DOCKED on compare); Compare… beside Take Snapshot, banner only in compare mode; changing the draft number auto-snapshots the PREVIOUS draft label
- **v6.79** — one-row snapshot list; the rows THEMSELVES are the compare pickers (no checkboxes)
- **v6.78** — plain EDITS in windows are undoable (the window-undo lane covers fields, 2.5s coalescing)
- **v6.77** — warning dialogs on major-change buttons (runMajorChange) + the window-action UNDO lane (smartUndo 3-lane routing) + Hidden view's Show/Hide all
- **v6.76** — Take Snapshot into the panel body; the panel survives entering compare (keepOpenOnEditorClick)
- **v6.75** — the compare flow humanized (four Derek items)
- **v6.71–74** — the snapshot/auto-save UNTANGLING (one arc, four versions)
- **v6.70** — four more preset parts (annotation presets, shortcuts, design, helper text → nine total)
- **v6.69** — Snapshots stopped hanging: api.ts gained cloudApi's empty-base guard + a 12s bounded wait with Try again
- **v6.68** — "Annotation Filter" rename + the plain View Annotations on/off toggle (new `viewAnnotations` key, migrated in beside the filter; NOT v6.41's retired toggleMarkups)
- **v6.67** — annotation icons follow zoom/resize (zoomLevel in the measure deps; chip size × measured page scale; ResizeObserver) — negative control proved the check
- **v6.64–66** — Send to Script writes LIVE annotations at real page tops (outlineScriptSync: one text builder, store-only mirror, freeAnchorPos with live-id set, paginator posForPage; v6.64's `# …` lines cleared by stamp)
- **v6.63** — Settings ▸ Presets became a CHECKLIST making ONE bundle file (PRESET_PARTS registry; readPresetFile accepts every legacy single-type file)
- **v6.62** — deleted column's beats now land in Unsorted ON SCREEN (position-vs-order layout lie; store asserts pass while the board lies — assert the UI)
- **v6.61** — Unsorted shares the default column width; every column edge drag-resizes
- **v6.60** — deleting an outline section moves its beats to Unsorted (farthest left); only the beat's own Delete deletes a beat
- **v6.59** — presets re-home existing beats (splitPages/distributeBeats/presetReuseOrder); page estimates went per-variation (beatSlots.span, barSetBeatSpan)
- **v6.58** — an outline tab is DELETED, not "closed" (the tab flow only; other Close buttons stay)
- **v6.57** — presets fill their sections at ~2 pages a beat with sums exact (presetBeatSpans); divider before the + button
- **v6.56** — the outline beat count left the tab pill (ToolChrome grew an AfterTabs slot outside the strip)
- **v6.55** — freeform beat titles shrunk (mindTitleSize 12–16, title width 46%) so the title bar has bare band to grab
- **v6.54** — freeform beat cards got real title bars (windowChrome in BeatCardContent), the ⋮⋮ grip retired in freeform
- **v6.53** — freeform header drag fixed (always preventDefault + tap-to-focus), any-edge resize, click-place-click links with edge anchors (mindAnchors)
- **v6.52** — beat count beside the tabs; card/board contrast (color-mix step); Helper Text became a real dockable TOOL; freeform link highlights + header drag
- **v6.51** — the Helper Text catalog covers DYNAMIC title/placeholder expressions (+97); applier arm-flip fix; the rebuild-the-catalog standing rule
- **v6.50** — Outline polish: bare View trigger (icon + current view), option icons, add button leads the body row
- **v6.49** — Outline header standardized: View/Filter/Search cluster, actions row in the body, "Show beat color on all tabs" retired
- **v6.48** — Themes menu label + click-to-apply; outline tabs into the window header (ChromeTabs grew rename/close/TabsExtra); Auto Save → Snapshot
- **v6.47** — three new built-in themes: Paper, Gruvbox Dark, Catppuccin Mocha (the theme-adding pattern lives in its archive section)
- **v6.46** — theme legibility pass (palette report S1/S2/S6: sepia/sol-light/dracula/light depth fixes, AA floors)
- **v6.45** — Upload Voice Clip tool removed from the character window (Voice Profile writing fields stay; AssetAudio deleted)
- **v6.44** — print round 4: sharedPrintInfo (nil-NSPrintInfo theory) + fsync breadcrumb log; Settings…→app menu above Quit
- **v6.43** — print round 3: ACTIVE_PRINT keep-alive (async sheet lifetime); Settings→File (reversed v6.44); standard window buttons on FloatingWindow
- **v6.42** — LOCAL-FIRST: account/cloud UI purged (service layer kept in code); Settings became a FloatingWindow; Auto Saves subfolder; Filter→Display
- **v6.41** — Save Options always editable; Local System (backup location); toolbar toggle retired
- **v6.40** — Collaboration removed end-to-end (account system KEPT then; see v6.42)
- **v6.39** — map rotation via Options any time; the map became a CANVAS (WKWebView vanish)
- **v6.38** — the ten-item batch: helper text window/blank overrides, snippet buttons, map floor + header Options + rail ⋮, panel zoom
- **v6.37** — print hotfix: async command + sheet + ObjC exception catch
- **v6.36** — Print = the real system dialog via PDFKit (crashed; fixed v6.37)
- **v6.35** — annotation icons moved to the LEFT margin band (0.75" center)
- **v6.34** — `npm run desktop` restores package-lock.json too; Cargo.toml dirt = unknown origin
- **v6.33** — the MEASURED wrap geometry (63 chars); the asset handler's cwd bug; Print opens
- **v6.32** — asset protocol ON; Tauri print = save+toast; Courier Prime embedded
- **v6.31** — Asset Manager: inline image thumbnails
- **v6.30** — formatting verified against the standard; Print's silent Tauri no-op
- **v6.29** — Print through the exporter; the goal chip's Header = the TITLE BAR
- **v6.28** — PDF import: the legacy pdf.js build for WKWebView
- **v6.27** — Title tab scales with its window; Asset Manager menu no-op
- **v6.26** — Title Page: the Contact field is 4 rows
- **v6.25** — Goals spacing: the phantom row was DOUBLE bottom padding
- **v6.24** — Helper Text: areas, on-screen found-in, hide, go-there, line breaks
- **v6.23** — Goals: ONE Start/Stop top-left; Show in beside it; count quick starts
- **v6.22** — Helper Text: its own window, with the control's face on every row
- **v6.21** — Goals: the current total on the Reach rows; one-row footer; Header/Footer
- **v6.20** — the Helper Text editor (Design window)
- **v6.19** — Thesaurus over the selection + context-menu entry; Analytics header tabs
- **v6.18** — paste fills the active element: action is the schema's fallback
- **v6.17** — a dragged snippet drops its TEXT into the script
- **v6.16** — collapsed tabs expand back; Working Notes menu gone
- **v6.15** — Goals: Show in Toolbar/Footer, relative count goals, footer
- **v6.14** — Derek's menu reorganization
- **v6.13** — Characters polish: flat list rows, quieter cards, List first
- **v6.12** — Characters header: Filter everywhere, Sort+Search on Relationships
- **v6.11** — the Characters list is the shared table
- **v6.10** — the Highlights tool is retired
- **v6.09** — Preview: Script Options + Include Annotations…
- **v6.08** — big ribbon buttons: one geometry, one hover box
- **v6.07** — the temp window's drag teleport
- **v6.06** — dropping Analytics on a panel actually docks it
- **v6.05** — the crushed-header fix (chrome-less windows)
- **v6.04** — locations toggle everywhere, the Insert menu diet, two dead-flow fixes
- **v6.03** — the Thesaurus is WordNet proper, with definitions
- **v6.02** — Goals tabs go left; Customize finally remembers its tab
- **v6.01** — one leading row: Map · Pin · Group
- **v6.00** — the rail's expanded rows carry the List view's details block
- **v5.99** — the fullscreen map's rail hangs under the Locations ROW
- **v5.79** — connect-to-location, the pin anchor, and cursor placement
- **v5.78** — Locations map: six follow-ups
- **v5.77** — Locations: a pin is a PLACE
- **v5.76** — the map image actually displays
- **v5.75** — Locations: List / Map tabs, with pins
- **v5.74** — ONE title page, three renderers reconciled
- **v5.73** — the title-page THUMBNAIL shows the true format
- **v5.72** — Pages tabs: Script / Title / Custom / All
- **v5.71** — All Pages tab, tab renames, the collapsed-tabs caret
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

- **A bare `import('/src/…')` inside `page.evaluate` gives you a SECOND copy of
  the module — use `window.__scImport(spec)` instead (v7.15).** Vite stamps an
  invalidated module with a cache-buster, so a dev server that has seen *any*
  edit serves the app `/src/services/api.ts?t=1786775615204` while the check's
  bare import gets `/src/services/api.ts`: different URL, different module,
  different state. check-v673 patched `api.getVersions` on its private copy,
  the Script History panel went on calling the real server, and the check
  failed with `waitForSelector: .version-item timed out` — which reads exactly
  like a regression in Script History. It wasn't; nothing was broken.
  - **The failure mode is the mild version.** When the second copy is only
    *read* from, nothing times out — the check quietly answers about a module
    nothing on screen is using, and passes. Five checks (v642, v684, v710,
    v711, v712) were doing that with `settingsStore`/`editorStore`/
    `feedbackBackend`; check-v642 even carried the comment "vite serves the
    module, so this is the app's own store instance". They all still pass, but
    they were passing by luck of timing.
  - `__scImport` lives in `driver.mjs`'s init script: it resolves the URL the
    app *actually* loaded from the resource timings (newest wins after HMR),
    and **throws** when the app never loaded that module, so a check can never
    silently get a private copy. It also raises the resource-timing buffer
    from its 250-entry default first — the app loads more modules than that.
  - Stateless utility modules (`pdfExporter`, `titlePageLayout`,
    `designTokens`, `saveFlash`) are still imported bare on purpose: a second
    copy of a pure function is the same function, and those modules are often
    not loaded by the app until the feature runs, which `__scImport` refuses.
    **The rule: anything with state — a store, a singleton, a cache — goes
    through `__scImport`.**
  - This is the same family as the trap logged for check-v712 last run
    (a driver-imported store that the mounted list never showed). It has now
    cost time twice. Prefer driving the app's own buttons; when you must reach
    a module, reach the app's.

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
