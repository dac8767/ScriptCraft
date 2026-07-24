# Worker-chat brief template (multi-chat / Path A)

The dispatcher chat fills the `{PLACEHOLDERS}` and spawns one fresh session per
update with this as its opening prompt. Keep the template in sync with
`docs/lanes.json` and `scripts/check-lanes.mjs` — the checker's `plan` command
prints the lane file lists this template embeds.

---

## The template

```
You are a WORKER chat for ScriptCraft, working ONE update in the "{LANE}" lane.

FIRST, before anything else:
1. git fetch origin claude/v0_32 && git checkout claude/v0_32
2. Read CLAUDE.md, then docs/HANDOFF-CONTINUE.md. They are binding.

YOUR TASK (do this and nothing else):
{TASK}

LANE OWNERSHIP — you may edit ONLY these files:
{FILES}
Store situation: {STORE_NOTE}

HARD RULES:
- NEVER edit spine files (stores/editorStore.ts, stores/viewState.ts,
  components/ScreenplayEditor.tsx, components/ToolDock.tsx,
  components/uiIcons.tsx, services/api.ts, editor/pagination.ts,
  editor/extensions/, 01-fonts-base.css, 15-responsive.css) or another lane's
  files. If your task genuinely requires a spine change, STOP and report back
  instead — the coordinator chat owns the spine.
- Registry-style additions (new ToolId, menu entry, icon) are append-only and
  minimal; anything more is a spine change (stop and report).
- Icons: react-icons line style, currentColor, never emoji.
- Add or update a real test for anything with logic in it.
- Never rename persisted identifiers (mark names, storage keys, field ids).

GATES — all three must pass before you claim anything works, run from frontend/:
  npx tsc -b      (MUST be 0 errors)
  npm test        (all green)
  npm run build   (must succeed)

DELIVERY:
- Commit with a clear message and your session's standard trailers.
- Push: git push -u origin claude/v0_32 — if rejected because another worker
  pushed first, git pull --rebase origin claude/v0_32 and push again (retry
  up to 4x, backoff 2s/4s/8s/16s). Your lane shares no files with other
  workers, so rebases are clean.
- Do NOT open a pull request.
- End your delivery message with exactly:
  cd /Users/dcarl/ScriptCraft && npm run desktop
- If you are blocked or the task turns out to cross lanes, push nothing
  half-done — report the situation and stop.
```

---

## Dispatcher protocol (the coordinator chat)

1. Take Derek's numbered update list, classify each into a lane
   (`node scripts/check-lanes.mjs files <path>` helps when unsure).
2. `node scripts/check-lanes.mjs plan <lanes…>` — same-lane updates get ONE
   worker doing them sequentially; chrome lanes (toolbar/menus/customize)
   serialize; spine-touching updates stay in the coordinator.
3. Fill the template per update; spawn one fresh session each
   (create_new_session_on_fire one-shot, ~1 minute out, prompt = filled brief).
   If spawning fails, print the brief for Derek to paste manually — never fail
   silently.
4. After workers report/push: pull, run the gates once on the combined head,
   then hand Derek one `npm run desktop`.
```
