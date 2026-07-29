# Action Rewrite — design rationale & verification (v5.54)

Integrated from Derek's design-chat handoff (four files: the system prompt,
`rewrite.rs`, an `actionRewrite.ts` written for a flat element model, and a
HANDOFF.md whose decisions this file preserves). The feature: select action
lines, get three craft-guided rewrites — **cut** / **sharpen** /
**restructure** — each with a one-line note teaching the principle. Dialogue
is never touched.

## Where things live

| Piece | Path |
|---|---|
| The system prompt (**the product** — Derek's craft rules + calibration examples) | `src-tauri/prompts/action_line_rewrite.md` |
| API call + keychain key management (Tauri commands) | `src-tauri/src/rewrite.rs` |
| Projection, range/context resolution, stale-guarded apply | `frontend/src/utils/actionRewrite.ts` |
| The panel | `frontend/src/components/RewriteTool.tsx` |

## Decisions that must not get "fixed"

- **The system prompt is `include_str!`'d, never templated.** Prompt caching
  matches an exact prefix; any per-call variation in the system block is a
  cache miss on every request. Everything that varies goes in the user turn.
- **Do not rewrite the prompt's craft content unasked.** It is the output of
  a design conversation with Derek (his calibration examples: prison cell,
  Griffin battlefield, journal, mahogany desk, fog). The queued improvement
  is swapping calibration examples for before/afters from Derek's own
  scripts — deferred, not forgotten. Deliberate non-goal: no screenwriting
  books/corpora embedded (cost without signal + legal exposure).
- **Three variants are three strategies** (cut 40–60%, sharpen same-shape,
  restructure re-broken), sorted into fixed order Rust-side. Without this
  the model returns three near-identical rewordings.
- **`temperature: 1.0`** — the variants must diverge. Don't lower it.
- **`assessment: "already_strong"`** softens the UI — a tool that churns on
  good writing loses trust. Don't hide or dramatize it.
- **BYO key, OS keychain, Rust-side only** (service `com.freedraft.app`,
  user `anthropic_api_key`). The key never enters the webview. Mobile
  builds compile keyless stubs (no keychain store there).
- **Selection snaps to whole action paragraphs**; a range running into
  dialogue clamps and the UI says so (`adjustedReason`) — never silently
  do more than asked.
- **Separate module from any pure-adjacency rules code.** This feature is
  context-sensitive by nature; keep it out of formatting/rules engines.
- **Model `claude-sonnet-5`** for latency; `claude-opus-5` is a one-line
  swap in `rewrite.rs` if quality beats speed.

## The ProseMirror adaptation (the handoff's §5, answered)

ScriptCraft's document is TipTap/ProseMirror, so the flat `ScriptElement[]`
is a **projection**: `projectScript()` walks the top level (recursing into
`dualDialogue` columns), mapping node names (`sceneHeading` →
`scene_heading`) and carrying each element's PM span. The handoff's context
helpers run unchanged over that projection. Targets are PM ranges:

- `resolveEditorSelection(editor, intent)` → element indices → the ported
  `resolveSelection` → `pmTarget {from, to, text}`.
- `applyVariantToEditor` validates `doc.textBetween(from, to) === text`
  before writing (`targetIsCurrent`), then one `insertContentAt` — undo is
  the editor history. The panel additionally remaps the held target through
  every transaction (`mapping.map(from, 1)` / `map(to, -1)`), so edits
  elsewhere don't strand it; a true conflict flips it stale and blocks
  Use with a message.
- Applying a variant retargets onto the inserted text, so a second variant
  replaces the first rather than being refused as stale.

## Context sent per request (each field changes the output)

sceneHeading · preceding/following (≤3 action paragraphs, stopping at scene
boundaries) · characters (cues since scene start) · precedingDialogue
(lookback 3) · locationEstablished (same location key earlier ⇒ cut
establishing description) · firstAppearances (drives intro caps) · intent
(tighten/visual/verbs/plain). Empty `preceding` is sent as
`POSITION: opens the scene` — the absence is meaningful.

## Verification on the desktop app (this sandbox can't make API calls)

Rust compiles: `cargo check` passes on Linux here; macOS/Windows keyring
feature wiring is the crate's documented standard set. Then, on the Mac:

1. Save a key in the panel → survives an app restart (it's in Keychain
   Access under `com.freedraft.app`).
2. Select one action paragraph → three distinctly different variants.
3. Selection spanning action + dialogue → range clamps, notice shown.
4. Dialogue-only selection → button disabled with the craft reason.
5. Log `usage` on two consecutive requests → the second shows
   `cache_read_input_tokens` (a second `cache_creation` means something
   per-call leaked into the system block).
6. Accept a variant → paragraphs replaced; ⌘Z restores the original.
7. Edit above the target mid-request → Use blocked with the stale notice.
8. Rewrite in a location seen earlier → the `cut` variant drops
   establishing description rather than rephrasing it.
