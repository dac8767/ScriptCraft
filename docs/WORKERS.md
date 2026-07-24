# WORKERS.md — the multi-worker playbook (v4.24)

One page, one truth: how ScriptCraft work gets parallelized, what broke the first
attempt, and the exact briefs to use. Replaces `WORKER-BRIEF.md`.

There are three tiers. **Tier 1 is the default** — it is the only one proven
end-to-end. The others exist for scale-out and as fallback.

---

## Tier 1 — In-chat parallel workers (DEFAULT, proven)

The Dispatcher chat (the one Derek talks to) spawns N background subagents via
the Agent tool, **in one message so they run concurrently**. Each gets a tight
brief (template below). They edit the shared working tree on **disjoint lanes**;
the Dispatcher integrates, runs the gates ONCE, live-verifies, commits, pushes.

Why this is the default:
- No cross-session infrastructure to fail — workers run inside this session's
  container and report back automatically.
- Derek talks to ONE chat and gets one delivery message.
- The Dispatcher sees every diff before anything is committed.

Rules that make it safe:
1. **Disjoint lanes only.** Before spawning, check the planned file sets against
   `docs/lanes.json` (`node scripts/check-lanes.mjs plan <lanes...>`). Two
   workers may never edit the same file in the same wave. Spine files
   (editorStore, viewState, ScreenplayEditor, ToolDock, uiIcons, api,
   pagination, extensions, screenplaySaveContent, 01-fonts-base.css,
   15-responsive.css) belong to the Dispatcher — workers STOP and report if a
   task needs one.
2. **Workers never run repo-wide commands.** No `tsc -b`, no `vitest`, no
   `npm run build`, no dev server — concurrent runs clobber shared state
   (`.tsbuildinfo`, ports). The Dispatcher runs all three gates once, after
   integration.
3. **Workers never commit or push.** The Dispatcher reviews `git diff`, runs
   gates, commits (one commit per worker task or one per wave), pushes.
4. **Briefs are self-contained** — task, exact file allowlist, hard rules,
   "report instead of improvising" escape hatch.
5. Overlapping-lane work is NOT parallel work. Sequence it, or (rarely) use
   Agent worktree isolation — note a fresh worktree has no `node_modules`, so
   isolated workers can't verify anything anyway; treat isolation as a
   conflict-avoidance tool, not a verification environment.

### Tier-1 worker brief template

```
You are Worker {N} in the ScriptCraft repo at /home/user/ScriptCraft, on branch
claude/v0_32 (already checked out). Read CLAUDE.md first — its conventions are
binding (single source of truth, no silent no-ops, monotone icons, match
surrounding code style).

YOUR ONE TASK:
{TASK — Derek's words quoted verbatim where applicable, plus the concrete plan}

MAP (where the relevant code lives today):
{FILE:LINE pointers the Dispatcher scouted}

HARD RULES:
- Edit ONLY: {FILE ALLOWLIST}. If the task turns out to require any other file,
  STOP and report why instead of touching it.
- Zero behavior change unless the task says otherwise; keep classNames/strings
  identical on refactors. CSS off-limits unless listed.
- Do NOT run npx tsc / npm test / npm run build / dev servers — the Dispatcher
  runs all gates after integration (concurrent runs clobber shared state).
- Do NOT git add/commit/push. No PRs.
- Icons monotone react-icons; never emoji. Never rename persisted identifiers.

When done, report: what you changed (files + line ranges), decisions taken, and
any risk you noticed. Your final text is the report.
```

### Dispatcher integration checklist (after workers report)

1. `git status` / `git diff` — review every worker's changes; lanes respected?
2. Gates, from `frontend/`: `npx tsc -b` (0 errors) → `npx vitest run` (all
   green) → `npm run build`.
3. Live-verify anything user-visible (Playwright recipe in HANDOFF-CONTINUE §4).
4. Commit per task with trailers, push `claude/v0_32`, deliver with the desktop
   command.
5. A worker's report is a claim, not a fact — the gates and your diff review are
   the verification.

---

## Tier 2 — Fresh-session spawns via Routines (scale-out; use with care)

`create_trigger` (claude-code-remote MCP) with `create_new_session_on_fire:
true`, then `fire_trigger`. Each firing creates a brand-new session in this
environment with the prompt as its opening message. Useful when work must
outlive this chat's context or Derek wants independent sessions he can watch.

**What broke on 2026-07-24, first attempt:** two spawns fired simultaneously
(05:00:06 and 05:00:10) while the Dispatcher's container was active; no session
did any observable work and none appeared in Derek's session list. A single
follow-up spawn test (this playbook's protocol) DID return a session id
immediately. Operating rules derived from that:

1. **One spawn at a time, staggered** — fire the next only after the previous
   session shows life (its heartbeat commit).
2. **Heartbeat-first prompts.** The spawned session's FIRST action must be an
   observable artifact: append a line to `docs/worker-heartbeat.md`, commit,
   push. A worker that spawns dead is then visible within minutes instead of
   silently absent.
3. **Fully standalone prompts.** A fresh clone sits on stale `main` with the
   WRONG (ancient upstream) CLAUDE.md. The prompt's step 1 is always:
   `git fetch origin claude/v0_32 && git checkout claude/v0_32`, THEN read
   CLAUDE.md. Never reference files that only exist on claude/v0_32 before that
   checkout.
4. **Permissions ride the repo.** `.claude/settings.json` (committed) carries
   the allowlist for git/npm/npx/node/etc., so an unattended fresh session
   doesn't stall on its first permission prompt.
5. Tier-2 workers push their own commits (they outlive the Dispatcher's turn),
   so their briefs DO include gates + push, like the old worker-chat template —
   the Dispatcher still re-verifies on pull.
6. Clean up finished Routines (`delete_trigger`) — fired one-shots are dead
   weight in the trigger list.

## Path B — manual worker chats (always-works fallback)

Derek opens fresh chats himself and pastes a brief (Tier-1 template plus the
Tier-2 additions: the checkout preamble, gates, push instructions). Zero
infrastructure; costs Derek the copy-paste.

---

## Lane system (shared by every tier)

- `docs/AREA-MAP.md` — lane map + spine list.
- `docs/lanes.json` — machine-readable file→lane truth.
- `scripts/check-lanes.mjs` — `npm run check-lanes`; `plan <lanes...>` prints
  waves; `--selftest` after editing lanes.json.

When Derek queues multiple updates: classify each into a lane, run the planner,
spawn one Tier-1 worker per parallel-safe lane, keep spine work in the
Dispatcher, and report the wave plan before starting.
