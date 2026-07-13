# ScriptCraft — handoff to Claude Code

You are picking up a project with **100 shipped versions**, currently at **v1.21**
(commit `9091599`, branch `claude/v0_32`). Derek is the product owner and sole
tester. Read `/CLAUDE.md` first — it carries the footguns and architecture map.
This document covers what that one doesn't: **the workflow you should run**, why it
exists, and the state of things right now.

---

## 1. Your workflow — and why it's better than the one that came before

Until now, most changes came from a Claude in a chat window, running in a sandboxed
container with its own clone of the GitHub repo. Its only route to Derek's Mac was:

```
edit in sandbox → commit → push to GitHub → Derek pulls → Derek restarts the app
```

That loop worked, but every one of its moving parts failed at least once: delivery
zips committed to the repo as a file-transfer workaround; a personal access token
embedded in a remote URL that leaked into terminal output and had to be revoked and
rotated; a rebase conflict when the chat-Claude and a local Claude Code both edited
`DevPickerTool.tsx` from different bases; and a stretch where Derek pushed and the
sandbox hadn't pulled, so the next delivery would have clobbered his commit.

**You have none of those constraints. You are editing the real repo on Derek's Mac
(`/Users/dcarl/FreeScript`). The change is just *there*.** So:

1. **Start every session with** `git pull --rebase` (pull.rebase is already set
   globally, so plain `git pull` also rebases). The chat-Claude can still push to
   `claude/v0_32`; starting stale is how the DevPickerTool conflict happened.
2. **Edit files directly.** No zips — ever. The `freescript-vX_Y-*.zip` files in the
   repo root are historical artifacts of the old constraint; do not add more.
3. **Run the gates** (§2) before telling Derek anything works.
4. **Commit with a real message** (see the git log for the house style: state WHAT
   changed, then WHY, and name any root cause plainly — including your own mistakes).
5. **Push promptly** — `git push origin claude/v0_32`. Derek's credentials are cached
   in the macOS keychain; if a push prompts, stop and let Derek handle it rather than
   guessing at auth. Pushing matters even though you edit locally: it's how the
   chat-Claude's sandbox stays in sync, and an unpushed commit is exactly the
   divergence that caused the rebase mess.
6. **Never touch `main`.** It's a stale v0.6 baseline. Everything lives on
   `claude/v0_32`.
7. **End your message with the restart command.** Derek tests every change:

   ```
   cd /Users/dcarl/FreeScript && npm run app
   ```

   (`npm run app` launches without pulling — right when you've just edited his
   working copy. `npm run desktop` = pull + npm install + launch, for when changes
   came from GitHub.)

### Coordinating with the chat-Claude

Both of you write to the same branch. The rules that keep that safe:

- Pull-rebase before starting; push when done. Small, complete commits.
- If a pull hits a conflict, resolve it **keeping both features** unless one
  plainly supersedes the other — then run the gates before continuing.
- Derek is the arbiter. If you're unsure whether the other side is mid-change,
  ask him; don't force-push, ever.

---

## 2. The verification gates — not optional

```bash
cd frontend
npx tsc -b        # MUST be 0 errors. Not "baseline". Zero.
npm test          # currently 61 tests, all green
npm run build     # tsc -b && vite build — must pass
```

Why the third one is sacred: Tauri's `beforeBuildCommand` runs `npm run build`,
which begins with `tsc -b`. Eight "harmless" unused-variable errors once sat there
for weeks — and silently made it **impossible to build the .dmg at all**, because
`tauri dev` never runs tsc so nobody noticed. An unused import in this repo is not
a lint nit; it breaks the release build.

Write real tests for anything with logic. Vitest is wired for jsdom
(`src/**/*.test.tsx`); several of the worst bugs here were found by rendering the
component in a test and reading back what it actually produced. When you fix a bug,
pin it with a regression test that encodes the failure — the git log is full of
examples (search "pinned").

---

## 3. How Derek works — the practices that are actually enforced

- **Root cause, not symptom.** Diagnose before patching. He notices patches.
- **One source of truth.** Nearly every historical bug here is two lists that
  drifted: `openTool` doing its own config lookup while the dock used
  `toolConfigFor()` (v1.10); a menu icon map that didn't match the menu; a save
  dialog asking a question Settings had already answered (v1.16). Before adding a
  second copy of anything — don't.
- **Silent no-ops are the cardinal sin.** A control that looks like it works and
  writes into the void is worse than no control. Corollary: if you accept a prop or
  a setting, it must *do* something — the compiler flagging it unused is a design
  smell, not a nuisance.
- **Tell the truth about failures.** A failed secondary copy once raised "your work
  may be lost" when the script had saved fine (fixed v1.18). Error messages must
  say what actually failed, to whom it matters, and keep the underlying error text
  (`utils/errText.ts` exists because Tauri throws plain strings and
  `(err as Error).message` came back `undefined`).
- **Honest scope calls.** If something is risky, say so and defer with a reason.
  If you got something wrong, say that plainly, then fix it. Both are respected;
  quiet failure is not.
- **He renames constantly.** When he does, rename everywhere, immediately.
- **Never comment on the time of day or suggest he sleep.**

---

## 4. Where the product is right now (v1.9 → v1.21, the part CLAUDE.md predates)

- **Projects are GONE from the product** (v1.14). A ScriptCraft file is one script.
  No Project Manager, no project screens/routes, Save As asks for a title not a
  project, Open is a flat list. **The storage spine still keys on a container id**
  — `services/scriptLibrary.ts` provides the one invisible container new scripts
  land in ("My Scripts"); it must NEVER adopt an old container (that bug named a
  new script "Test", v1.15). The **Project menu is unrelated and untouched** — it
  groups tools, not scripts. Don't "clean it up".
- **Save / Save As** (v1.15–v1.21): Save on a saved script just saves + toast;
  Save on a never-saved script opens Save As; File > Save As opens the dialog
  (it was mis-wired to the .odraft *export* — same word, wrong job). The dialog is
  a label/control grid: Script Name, Draft+Version on one row, then "Folder on
  this device" (clickable path; picking it write-probes the folder with a
  **non-hidden** file — Tauri's glob scope refuses dotfiles, which manufactured a
  false "can't write" error in v1.19) and "Additional save locations:" with a
  button that opens Settings **on the Save Options tab** (`openPreferences('saveloc')`
  — scrolling to a section was useless because Settings has tabs and unrendered
  sections can't be scrolled to).
- **Tauri fs scope** (`src-tauri/capabilities/default.json`): the allow-list is
  attached to **each** fs permission (not just the global `fs:scope`), covering
  `$HOME`, `$DOCUMENT`, `$DESKTOP`, `$DOWNLOAD`, `/Volumes`, in both `X/*` and
  `X/**` forms. If you edit this file, **validate it against
  `src-tauri/gen/schemas/macOS-schema.json`** — a malformed capabilities file
  doesn't degrade, it stops the app from booting.
- **Dev Picker** (`src/dev/`, DEV-only, absent from production builds — verify with
  a bundle grep if you touch its imports): Inspect passes clicks through; ⌥-click
  captures an element's real internal name; ⌥C/F8 capture without a click;
  screenshots + `.md` export bundle; saved phrases. If Derek pastes names like
  "Notes — Right Panel" or "toolbar key: bold", they came from here and are exact.
- **Menus:** Diagnostics lives under Help > Developer (the Developer *group* ships;
  only Dev Picker inside it is DEV-gated — gating the group would have deleted
  Diagnostics from release builds). Customize > Side Panels is Show/Hide only;
  width is the drag-edge's job.

---

## 5. Open items (release blockers and deferred work)

- Replace all OpenDraft brand art (`src-tauri/icons/`, splash, favicon) — biggest.
- Apple Developer Program; swap the Proteus signing identity in `build-desktop.sh`.
- `languageCatalog.ts` fetches dictionaries from GitHub **at runtime** — rehost.
- Courier Prime + dictionary licenses; trademark clearance on "ScriptCraft".
- `macos-private-api` is on → **no Mac App Store**; the plan is a signed `.dmg`.
- npm audit: 12 known vulnerabilities, pre-existing, untriaged.
- Deferred by explicit decision (don't start without Derek): Lock Pages; the
  Templates tab full editor; toolbar flattening; ripping the container id out of
  the storage schema (works, invisible, and removing it means migrating every
  saved script for zero visible gain).

---

## 6. The short version

1. `git pull` first, always. Push when done. Never `main`, never force-push.
2. Edit files directly. No zips.
3. `tsc -b` = 0, `npm test` green, `npm run build` passes — before "it works".
4. One source of truth. No silent no-ops. Root cause, not patch.
5. Pin every bug fix with a test.
6. End with: `cd /Users/dcarl/FreeScript && npm run app`
