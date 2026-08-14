# ScriptCraft Full Style Audit — 2026-08-14 (app state: v7.00, e73d048)

Requested by Derek: *"do a full style audit… check every window, every tool, every
menu item. everything! do not take any actions, but create a thorough report of all
things that are not as they should be."*

**No app code was changed.** This document is the deliverable.

## Method (three passes; every finding checked in all three)

1. **Static inventory** — a scripted parse of all 29 `src/styles/screenplay/*.css`
   files pulled every rule touching buttons, selects, inputs and headers
   (642 rule lines), plus histograms of hex colors, custom properties,
   `!important`, font families, and scans of every `.tsx` for unclassed
   controls, inline styles, emoji and icon imports.
2. **Live probe** — Playwright drove the real app and read *computed* styles:
   Settings (five tabs), the File and Help menus, the About dialog, the
   Feedback form, plus hover-state measurements and theme-switch measurements
   in dark / light / sepia.
3. **Source re-verification** — every finding was traced back to an exact
   file:line before being written down, and re-verified a third time against a
   freshly restored clean checkout of e73d048. Findings that did not survive
   (e.g. "`dialog-primary` has no CSS rule", "`fb-input` has no focus style")
   are **not** in this report.

Severity: **S1** = broken outright (computes to nothing, or wrong behavior).
**S2** = systemic inconsistency (same role, different look, app-wide).
**S3** = local drift and hygiene.

---

## S1 — Broken, not merely inconsistent

### 1. Six theme tokens are consumed but defined in NO theme

Every theme block (dark, light, sepia, paper, nord, dracula, solarized ×2, …)
was searched: these `--fd-*` custom properties are referenced by the
stylesheets but **never defined anywhere**, so each no-fallback use computes to
nothing — background → transparent, color → inherited full-strength text.

| Token | No-fallback uses | What actually breaks |
|---|---|---|
| `--fd-toolbar-hover` | 9 | Hovering any standard dialog button paints its background **transparent**. Probe-proven: the Settings footer **Save** button goes `rgb(74,158,255)` → `rgba(0,0,0,0)` on hover. Also `.dialog-footer button:hover` (07:189), `.settings-back-btn:hover` (17:43), `.template-add-btn:hover` (18:197), `.template-style-btn:hover` (18:267), `.fs-aiwriter-remove:hover` (20:1229), `.prefs-inline-btn:hover` (24:1335), `.fs-updown-btn:hover` (05:977) — and worst, `.template-element-item.selected` (18:214): the **selected row in the Element Templates editor has an invisible highlight**, only its accent left-border shows. |
| `--fd-hover-bg` | 17 | Hover feedback silently missing on zoom-menu rows (03:1114/1127/1137), Title Page preview zoom (06:384), character image-upload menu (10:1498), custom-field remove (10:1538), **title-bar quick-action buttons** (20:87), About "What's New" (20:170), Customize global buttons (20:193), panel expand (20:249), **every tool-window ⋯ control-menu row** (20:621), workspace actions (22:1912), dev Airtable link (22:1921), ribbon "+Add back" (24:801), ribbon help (24:959), tab-info (25:523), Design-panel choice rows (26:128). |
| `--fd-background` | 4 | `.script-diff-view` and its container (04:69/75) and `.treatment-editor-root` (04:268) — full-surface backgrounds computing to **transparent** — plus `.treatment-element-select` (04:319), a select with a transparent body. |
| `--fd-text-dim` | 18 | Every "dim" hint in 18-elements-templates.css (template-editor hints, Template-Select dialog hints, descriptions, categories, empty states) inherits **full text color** — hints don't read as hints. |
| `--fd-text-secondary` | 8 | Notebook color-pop titles (24:1317/1350) plus inline styles in AboutDialog.tsx (92/117), DiagnosticsDialog.tsx (11/55/98) and MenuBar.tsx (2223). |
| `--fd-hover` | 1 | `.fs-pages-pop-item:hover` (05:1036) — no hover highlight. |

**These are not set from JavaScript either.** `themes.ts`'s `applyThemeToDom()`
writes only keys listed in `THEME_VARS` (themes.ts:40–63), and none of the six
appear there. Nothing in the app — CSS or JS — ever gives them a value.

Several more are referenced only *with* fallbacks, so nothing breaks today, but
the fallback always wins and **themes can never influence them**: `--fd-danger`
(6 uses — precisely the token the red scatter in S2-4 is begging for),
`--fd-accent-bg`, `--fd-bg-dim`, `--fd-tooltip-bg`/`-text`, `--fd-canvas-bg`,
`--fd-bg-hover`, `--fd-panel-bg`.

Contrast the governed side: **all 128 `--dz-*` design-panel variables consumed
in CSS are registered in `designTokens.ts` — a perfect 128/128.** The
`designTokens.test.ts` discipline works. The `--fd-*` theme tokens have no
equivalent gate, and this table is the result.

### 2. Primary dialog buttons lose their fill on hover — even after that token is fixed

`.dialog-btn:hover` (specificity 0-2-0, 07:235) sets `background`;
`.dialog-btn-primary` (0-1-0, 07:236) cannot outrank it, and the primary's own
`:hover` (07:239) sets only `opacity`. So in **every dark theme** a hovered
`dialog-btn dialog-btn-primary` takes the *plain* hover background — currently
transparent (bug above), and after that fix it will flip accent-blue → gray.
Light mode escapes only because of an explicit
`[data-theme="light"] .dialog-btn-primary:hover { background:#104d8f }`
(01:283). The other primary idiom (`.dialog-primary`, S2-1) keeps its fill via
`!important` and dims to opacity .9 — so the app's two primary-button systems
have **different hover behavior, one of them broken**.

### 3. Native (unstyled) form controls inside styled windows

There is no global reset giving form controls the app's font or appearance — no
`button, input, select { font: inherit }` anywhere — and **no `color-scheme`
declaration**, so WebKit renders native widgets in *light* style even in dark
themes. Probe-measured in Settings, dark theme:

- **Settings ▸ General** — the four bare `<select>`s in `prefs-check-row`s
  (*Window on launch, Units, Date format, Time format*;
  PreferencesDialog.tsx:616/687/709/724) render native: **19px tall, 13.33px UA
  font, light-gray `#efefef` body, 0px radius** — beside the house select style
  (`.prefs-field-row select`: 32px, 13.5px, `--fd-input-bg`, 4px radius) used
  elsewhere in the same window.
- **Settings ▸ General ▸ Draft Number** (PreferencesDialog.tsx:267–284) — the
  text input is a native **white** field (unclassed, 19px), "Apply" is
  `dialog-primary` accent paint over a *native 19px button*, and **"Set as
  Default" carries no class at all**: a stock UA gray button in the middle of
  the app's flagship settings surface.
- **Guided Setup wizard** (setupFields.tsx:100) — the "Save a version every"
  `<select>` is bare, same native rendering.
- PreferencesDialog.tsx:503/529 (the cloud Connect/Disconnect buttons) are also
  unclassed; `prefs-field-row` styles selects but not buttons.

### 4. Template delete confirm fires without waiting for an answer

TemplateSelectDialog.tsx:182 uses **native `confirm()`** for
`Delete template "…"?`. ConfirmDialog.tsx's own header documents why that is
forbidden here: in the Tauri app `window.confirm` is an **async IPC shim
returning a Promise**, and a Promise is always truthy — so the delete branch
runs regardless of the answer. Every other destructive action in the app uses
the house `confirmDialog`. (Behavioral, found during the style sweep; no fix
applied, per your instruction.)

---

## S2 — Systemic inconsistencies

### 1. Two competing primary-button systems, plus outliers

- **`dialog-btn dialog-btn-primary`** — 32 usages. Full base: 34px tall, 14px
  font, 4px radius, accent fill.
- **bare `dialog-primary`** — 30 usages (07:229), an `!important` accent paint
  with **no size or base of its own**. Inside a `.dialog-actions` row it
  inherits that row's 34px base and looks identical; outside one it paints
  whatever is underneath. Probe: About "Close" = 34px, Settings "Apply" =
  **19px native**. Same class, two heights.
- Both idioms appear **in the same window** — Settings footer Save
  (`dialog-btn-primary`) vs. Draft Number Apply / GDrive / OneDrive Connect
  (bare). PageSetupDialog.tsx:358 Apply is bare too.
- Outlier primaries: `.fs-btn-primary` builds on the *theme button* tokens
  (`--fd-btn-bg`) instead of accent; `.fs-presets-btn-primary` is accent at
  12px / 5px radius; `.ws-save-btn` and `.pv-exit-btn` are a third language
  entirely (transparent body, accent border + text).
- **Accent fallback drift** — `var(--fd-accent, …)` is written with four
  different fallbacks: `#4a90d9` (46×), `#4a9eff`, `#3b82f6`, and **`#8b5cf6`
  (purple)** in `.char-profile-rel-form-btn-primary` and `.rel-map-btn-primary`
  (10-character-profiles.css). If the token ever failed, Character
  relationship primaries would go purple while everything else went blue.

### 2. Button size matrix — same role, different metrics per surface

| Surface | Class | Height | Font |
|---|---|---|---|
| Standard dialogs | `.dialog-btn` / `.dialog-actions button` | 34px (token) | 14px |
| New Script dialog | `.fs-newscript-actions button` | 32px | 13px |
| Guided Setup | `.fs-guided-actions button` | 32px | 13px |
| Launcher foot | `.fs-launcher-foot button` | 30px | 13px |
| Spell modal | `.spell-modal-actions button` | 30px | 12px |
| Search bar | `.search-actions button` | 28px | 12px |
| Confirm dialog | `.fs-confirm-actions button` | padding-sized | 13px |
| Markups / Rewrite popovers | locally-shrunk `.dialog-btn` | 26px | 12px |

`.dialog-btn` is not even one size: `.markup-icon-pop-foot .dialog-btn` (27:361)
and `.rw-key-actions .dialog-btn` (29:365) redefine it to 26px/12px.

**`dialog-btn-sm` does not actually shrink.** 18-elements-templates.css:233
forces `font-size:12px !important; padding:4px 8px !important` but never
overrides the 34px height locked by the base class — probe: Page Setup tab
"View" and Defaults "Reset" measure **34px tall with 12px text**. On the
Defaults tab the per-row Reset (34px) sits directly above "Reset All"
(`.fs-reset-all-btn`, 26px): two reset buttons, two sizes, one screen.

Settings alone contains **six** distinct button treatments (probe-measured):
rail tabs 31px/13px/r6, footer `dialog-btn` 34/14/r4, `dialog-btn-sm` 34/12,
`prefs-inline-btn` "Choose Folder…" 20/12/r4, `fs-reset-all-btn` 26/12/r5,
`swn-add-btn` 28/12/r6 — plus the native controls from S1-3.

### 3. `swn-add-btn` reused across domains

The Settings buttons "Grammar & Spelling", "Export Settings…" and
"Import Settings…" are styled by **`.swn-add-btn` — the Sticky-Notes
add-button class** (19-sticky-notes.css:241). It happens to look fine, but
editing the Notes button now restyles Settings: the single-source-of-truth
violation CLAUDE.md §3 warns about, running in the opposite direction.

### 4. Danger-red scatter — ten reds for one meaning

`#c62828`, `#e57373`, `#ff4444` (template delete, `.dialog-btn-danger`),
`#ff6b6b` (project delete, dropdown danger), `#c0392b` (14× — version-delete
hovers, note delete), `#e05656` (`.ws-icon-btn.ws-danger`) — whose hover in the
*other* `.ws-icon-btn` block is `#d05050` — `#ef5350` (rel-map), `#ef4444`
(char custom remove), `#c0564f` (`.fs-reset-all-btn`), `#e06060` (11×), plus
the save-failure trio `#7a3a3a` / `#e0a0a0` / `#4a2a2a`. Six rules already ask
for `var(--fd-danger, …)`; the token exists in spirit and is defined nowhere
(S1-1). Smaller parallel scatters: success greens (`#2d8a4e`, `#4caf50`,
`#6abf69`, `#27ae60`) and warning ambers (`#e5a50a`, `#f59e0b`, `#d97706`,
`#e8994f`).

### 5. Hardcoded near-black controls break the light-warm themes

These hardcode dark backgrounds instead of `--fd-input-bg`:
`.char-profiles-search-input`, `.char-sort-select`, `.asset-filter-select`,
`.asset-filter-input`, `.asset-tag-input`, `.asset-tags-edit-input`,
`.tags-add-input` (all `#222`, several with `#555` borders) and
`.language-selector` (`#2a2a2a`, border `#555`; 06:392 — used in
Settings ▸ Languages). Probe on **sepia** (page `#efe6d5`): they render as
`rgb(34,34,34)` / `rgb(42,42,42)` boxes while a tokenized control correctly
shows `rgba(0,0,0,0.06)`. The **light** theme survives only because of the
global `[data-theme="light"] … !important` patch (01:246), which
sepia / paper / solarized-light do not have. Also mobile:
`15-responsive.css` `.toolbar-btn.active { background:#555 }`.

### 6. Custom themes can't reach half the surface

`THEME_VARS` exposes 15 `--fd-*` colors in the Themes customizer, but the theme
blocks define 25. Not editable: **`--fd-input-bg`**, **`--fd-dialog-bg`**,
`--fd-overlay-subtle/light/medium`, `--fd-shadow`, `--fd-chrome-separator`,
`--fd-chrome-shadow`, `--fd-hairline`, `--fd-hairline-w`. A custom light-ish
theme built on a dark base keeps **dark input fields and dark dialog
backgrounds** with no way to change them.

### 7. Form controls opt out of the app font

With no `font: inherit` reset, every `<select>` / `<input>` / `<button>` that
doesn't set its own `font-size` falls to the UA default (13.33px measured), and
none inherit the app's font-family. Probe: the Feedback **Type** dropdown
renders **13.33px Arial** beside a textarea explicitly set to 12.5px
`-apple-system` (the only control in that form with `font-family: inherit`). On
Derek's Mac the family lands on the system font by luck; the size drift is real
everywhere. `.fb-select` and `.fb-input` set height but no font-size.

### 8. Select styling matrix

Heights in current use: 19 (native), 22 (`.element-selector`), 24
(`.language-selector`, `.fs-nav-scnf-select`), 26 (`.view-style-selector`, zone
adders), 28 (page-setup rows, char sort, asset filter), 30 (`.fb-select`,
format panel), 32 (`.prefs-field-row select`, projects sort). Fonts run 11 →
13.5px in half-point steps; radii 3 / 4 / 5. Nothing shares a token — compare
the dialog side, where `--dz-dialog-btn-h` exists precisely so dialog buttons
stay uniform.

### 9. Dialog input height fork

`.dialog-row input` = `var(--dz-dialog-input-h, 36px)` (07:175) but
`.dialog-input` = hardcoded `34px` (07:242). Two heights for the same "input in
a dialog" idiom, only one of them reachable from the Design panel.

### 10. `ws-icon-btn` is defined twice in one file

22-tools-extra.css:873 (bordered, 28px, `--fd-menu-hover` hover, danger
`#d05050`) vs 22-tools-extra.css:1715 (borderless, 26px, overlay hover, danger
`#e05656`). Same specificity — the later block silently wins wherever they
conflict, leaving the earlier one half-dead. Two generations of one class.

### 11. The reorder up/down widget exists as four copies at two sizes

`.fs-updown-btn` (8px glyphs), `.fs-customize-order button` (7px),
`.ws-order button` (7px), `.fs-pin-order button` (8px) — the identical
up/down-arrow control, four separate implementations, two font sizes.

---

## S3 — Local drift & hygiene

1. **Titles have no shared scale.** Tool/panel titles: `.tool-window-title`
   12/700, `.navigator-title` 13/700, `.script-notes-title` /
   `.char-profiles-title` / `.tags-panel-title` / `.beat-board-title` 12/600,
   `.location-db-title` 13/700, `.fs-ob-title` 11/700. Window titles:
   `.dialog-header` 16/600 (tokenized — this one *is* consistent),
   `.fs-confirm-title` 14, `.fb-title` 15, `.fs-guided-title` 15,
   `.fs-launcher-title` 13. Section heads: `.prefs-general h3` 11.5/700 muted,
   `.fs-customize-body h3` 13 full-color, `.about-section-title` 13/600,
   `.pv-section-title` / `.pst-listhead` / `.fs-tbzone-title` 11/700,
   `.dz-title` 13/600, `.settings-section-title` 18/700.
2. **The legacy `/settings` route still ships** (App.tsx:37 → SettingsPage.tsx)
   — a second settings surface with its own idiom (18px section titles,
   `.settings-back-btn`, `.settings-reset-all-btn` in `#e57373` vs the Defaults
   tab's `#c0564f`). Nothing in the v7.00 UI links to it.
3. **Dead CSS:** the `.prefs-subtabs` block (23:321) — no `.tsx` has referenced
   it since the v7.00 rail rebuild. `--fd-panel-bg` appears only as an
   unreachable inner fallback.
4. **Icon families:** `react-icons/fa` (51 files) + `react-icons/lu` (15
   files); 12 files import both. The same *concept* comes from both sets:
   **`FaSearch`** (ThesaurusTool, TitlePageEditor, MenuBar) vs **`LuSearch`**
   (17 uses elsewhere) — the line weights visibly differ. `LuRotateCcw` (12×)
   is the house reset glyph, but Fa equivalents appear in Fa-only files.
   Emoji rule: **clean** — no emoji in UI chrome (markupIcons.tsx's set is the
   deliberate v5.27 Markups feature; `← Back` and `Copied ✓` are text, not
   icons).
5. **Inline-style islands bypass the stylesheet:** DictionaryConfigPanel (48
   `style={{…}}` blocks), NotebookTool (22), DictionaryLibrary (20),
   ScreenplayEditor (14), TitlePageEditor (13), MenuBar (12), AboutDialog (12),
   GrammarRulesPanel (11). The two Dictionary panels are essentially unthemed —
   their unclassed buttons are styled ad-hoc inline. ScriptNotePopover.tsx:322
   does danger via inline `background:'#c0392b'` on a `dialog-primary`.
6. **Radius scatter on same-role controls:** house buttons are 4–5px, but
   `.tool-dock-iconbtn` 7px, `.zoom-panel-btn` 8px, `.welcome-choice-btn` 8px,
   `.swn-add-btn` 6px, `.prefs-tab` 6px, `.tags-entity-create-btn` 6px.
   (Pills — `.fs-bmc-btn` 11/17px, `.fs-help-btn` 50% — read as deliberate.)
7. **`.diff-block-label`** (04:193) hardcodes `font-family: sans-serif` — the
   one UI label outside the app font stack (Script History diff view).
8. **Focus treatment is uneven.** Most text inputs get an accent border on
   `:focus` (`.dialog-input`, `.fb-input`, `.fb-text`, the filters — the house
   pattern, and it works), but `.fb-select` and most selects outside the
   toolbar have no focus style at all in dark themes; the global focus override
   exists only under `[data-theme="light"]`.
9. **Menu idioms:** the menubar dropdown (13px, 5×16 padding) and the projects
   "script actions" dropdown (13px, 8×14, danger `#ff6b6b`) are separate
   systems. Each is internally consistent — the probe found menubar items
   uniform at 13px text / 11px icons across menus.
10. **`!important` density** (a change-resistance signal): 15-responsive.css
    43×, 16-print.css 28× (print legitimately needs it), 03-toolbar.css 21×,
    22-tools-extra.css 16×.

---

## Checked and found CONSISTENT (so you know it was looked at)

- **`--dz-*` design-token registry** — 128/128 consumed vars registered; no
  dead knobs, no unregistered vars. The test suite enforces it and it holds.
- **`.dialog-header`** — 16px/600, tokenized, uniform across standard dialogs.
- **Menubar dropdown items** — 13px text / 11px icons everywhere (probe).
- **Emoji-in-chrome rule (v2.08)** — holds; monotone react-icons only.
- **Feedback form controls** — consistent with each other (30px,
  `--fd-input-bg`, r4) apart from the S2-7 font gap; its action buttons are
  proper `dialog-btn`s and its Submit is a proper `dialog-btn-primary`.
- **Tool-window chrome** (header, close, fullscreen) — one shared
  implementation, consistent metrics (probe: 26px, color-mix backgrounds).
- **`.about-actions .fs-bmc-btn`** — a deliberate 1.6× scale-up of the
  title-bar original, same colors and shape.

## Suggested repair order (nothing applied)

1. Define the six missing `--fd-*` tokens per theme — one line each, and it
   repairs ~50 hover / selected / background sites at once. Then add a
   `designTokens.test.ts`-style gate: every `var(--fd-…)` must resolve.
2. Give `.dialog-btn-primary:hover` its own background (kills the specificity
   trap in every dark theme).
3. Add `color-scheme` + a `button/input/select/textarea { font: inherit }`
   reset, then class the five native controls (S1-3).
4. Replace TemplateSelectDialog's `confirm()` with the house `confirmDialog`
   — it currently deletes without waiting for an answer.
5. Collapse bare `dialog-primary` → `dialog-btn dialog-btn-primary` (30 sites,
   mechanical), fix `dialog-btn-sm`'s height, merge the two `ws-icon-btn`
   blocks.
6. Introduce `--fd-danger` (already half-adopted) and sweep the ten reds;
   tokenize the `#222` controls so sepia/paper stop showing black boxes;
   add `--fd-input-bg` and `--fd-dialog-bg` to `THEME_VARS`.
7. Longer-term: one shared select style, one title scale, and folding the two
   Dictionary panels into the stylesheet.
