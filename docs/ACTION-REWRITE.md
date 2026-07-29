# Action Rewrite — design rationale & verification (v5.54, revised v5.57)

Integrated from Derek's design-chat handoff (four files: the system prompt,
`rewrite.rs`, an `actionRewrite.ts` written for a flat element model, and a
HANDOFF.md whose decisions this file preserves; a SECOND handoff drop revised
the design — see "The three variants" below). The feature: select action
lines, get three craft-guided rewrites — **faithful** / **compressed** /
**reimagined** — each with a one-line note teaching the principle. Dialogue
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
- **The three variants differ by LICENSE taken with the writer's shape, not
  by which craft rule they apply** (v5.57 revision — the reasoning matters):
  the original cut/sharpen/restructure trio made `sharpen` a deliberate
  under-application of the governing principle, forcing the writer to choose
  between a correct rewrite and a half-correct one. Now all three apply
  every rule in full: `faithful` (the writer's beats and order, cleaned up),
  `compressed` (fewest words, may drop a secondary detail, 40–60%),
  `reimagined` (re-broken, reordered, same facts). Sorted into that fixed
  order Rust-side — least license first. Divergence is still guaranteed:
  "closest to what you wrote" and "reshaped" cannot collapse into each
  other.
- **The intent steer is ONLY `tighten`** (v5.57): visual/verbs/plain were
  removed because they asked for what the hard rules already require and
  produced no observable change. Degree is the one axis orthogonal to the
  rules. Don't re-add the others without a reason.
- **Prompt cache stays on the 5-minute default TTL** (v5.57): a read is
  0.1×, a 5-min write 1.25×, a 1-hour write 2×. Break-even for the short
  tier is ~0.28 reads — one follow-up rewrite inside the window pays for
  the write; the 1-hour tier needs 2+ reads/hour to win and an idle hour
  on a 2× write is expensive. Writers polishing a scene fire clustered
  rewrites, so the short tier fits. An isolated rewrite costing 1.25× is
  the design working as intended — do NOT "fix" a cache miss after an idle
  gap; if rewrites ever prove typically isolated, reconsider caching
  entirely rather than reaching for the 1-hour tier.
- **`temperature: 1.0`** — the variants must diverge in interpretation.
  Don't lower it.
- **No em dashes is a HARD RULE in the prompt** (rule 8; also bans en
  dashes and `--` as punctuation, keeps compound-word hyphens), and the
  prompt's own prose deliberately avoids em dashes — models pick up
  punctuation habits from the prompt they're given. If you edit the file,
  keep its prose dash-free (the rule itself and the calibration example
  that demonstrates the fix are the two exceptions).
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
(`tighten` only). Empty `preceding` is sent as
`POSITION: opens the scene` — the absence is meaningful.

## Verification on the desktop app (this sandbox can't make API calls)

Rust compiles: `cargo check` passes on Linux here; macOS/Windows keyring
feature wiring is the crate's documented standard set. Then, on the Mac:

1. Save a key in the panel → survives an app restart (it's in Keychain
   Access under `com.freedraft.app`).
2. Select one action paragraph → three variants that differ in license
   taken (faithful / compressed / reimagined), not near-duplicates.
3. Selection spanning action + dialogue → range clamps, notice shown.
4. Dialogue-only selection → button disabled with the craft reason.
5. Log `usage` on two consecutive requests → the second shows
   `cache_read_input_tokens` (a second `cache_creation` means something
   per-call leaked into the system block).
6. Accept a variant → paragraphs replaced; ⌘Z restores the original.
7. Edit above the target mid-request → Use blocked with the stale notice.
8. Rewrite in a location seen earlier → all three variants drop
   establishing description rather than rephrasing it.
