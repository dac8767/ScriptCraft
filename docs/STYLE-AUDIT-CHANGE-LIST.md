# Style Audit — Full Change List

> **STATUS (v7.01):** the items marked ✅ below shipped in v7.01 and are
> verified by `devtools/check-v701.mjs` (16 computed-style asserts) plus
> `src/styles/tokenResolve.test.ts` (7 asserts). Everything unmarked is still
> open — either not yet done, or waiting on a decision from Derek where the
> change alters how something looks rather than fixing something broken.
> Those are collected under "Still open" at the bottom.


Companion to `docs/STYLE-AUDIT-2026-08-14.md`. Every discrete change is its own
numbered item.

Ordering is by dependency, not by importance: items that unblock other items come
first. Group headers are navigation only — each numbered item stands alone.

---

## A. Missing theme tokens (unblocks ~50 broken sites)

The six tokens need a value. Defining each **once in `:root` as an alias** covers
all 11 theme blocks: `[data-theme]` sits on `<html>`, the same element as `:root`,
so the alias resolves against whichever theme is active — including custom themes,
which write their vars to that element too. Six items, not sixty-six.

1. ✅ `01-fonts-base.css` `:root` — add `--fd-toolbar-hover: var(--fd-menu-hover);`
2. ✅ `01-fonts-base.css` `:root` — add `--fd-hover-bg: var(--fd-menu-hover);`
3. ✅ `01-fonts-base.css` `:root` — add `--fd-hover: var(--fd-menu-hover);`
4. ✅ `01-fonts-base.css` `:root` — add `--fd-background: var(--fd-bg);`
5. ✅ `01-fonts-base.css` `:root` — add `--fd-text-dim: var(--fd-text-muted);`
6. ✅ `01-fonts-base.css` `:root` — add `--fd-text-secondary: var(--fd-text-muted);`
7. ✅ Decide per-theme overrides for `--fd-hover-bg` where `--fd-menu-hover` reads too
   strong on the light-warm themes (sepia `#ddd0b8`, paper, solarized-light) — one
   override line each, only if the alias looks wrong on test.
8. ✅ `01-fonts-base.css` `:root` — add `--fd-danger: #e06060;` (the most-used red, 11
   sites) so items 60–104 have a target.
9. ✅ `01-fonts-base.css` `[data-theme="light"]` — add `--fd-danger: #c62828;` (the red
   already used by the light-theme rules).
10. ✅ Add `--fd-danger` overrides for sepia / paper / solarized-light where `#e06060`
    fails contrast on a warm background.
11. ✅ Delete the now-redundant fallbacks in the six existing `var(--fd-danger, …)`
    call sites once the token exists (05-scene-navigator.css, 25-confirm-outline-tabs.css).
12. ✅ New test `src/styles/tokenResolve.test.ts` — parse every `var(--fd-…)` in
    `src/styles/**/*.css` and every `.tsx` inline style, assert each name is defined
    in `:root`; fail the suite otherwise. This is the `--fd` equivalent of the
    `designTokens.test.ts` gate that already keeps `--dz` at 128/128.
13. ✅ Extend that test to assert no `var(--fd-…)` is used **without** a fallback unless
    it is defined in `:root` (catches the next one before it ships).

## B. Verify the token fix reached each broken site

Each is a separate visual check after items 1–6; each may need its own follow-up if
the alias reads wrong there.

14. ✅ `07-dialogs-search.css:235` `.dialog-btn:hover` — hover background returns.
15. ✅ `07-dialogs-search.css:189` `.dialog-footer button:hover` — same.
16. ✅ `17-settings.css:43` `.settings-back-btn:hover` — same.
17. ✅ `18-elements-templates.css:197` `.template-add-btn:hover` — same.
18. ✅ `18-elements-templates.css:267` `.template-style-btn:hover` — same.
19. ✅ `18-elements-templates.css:214` `.template-element-item.selected` — **the
    selected row in the Element Templates editor becomes visible.** Highest-value
    single fix in this section.
20. ✅ `20-tool-dock.css:1229` `.fs-aiwriter-remove:hover` — same.
21. ✅ `24-notebook.css:1335` `.prefs-inline-btn:hover` — same.
22. ✅ `05-scene-navigator.css:977` `.fs-updown-btn:hover:not(:disabled)` — same.
23. ✅ `03-toolbar.css:1114` `.zoom-step:hover:not(:disabled)` — hover returns.
24. ✅ `03-toolbar.css:1127` `.zoom-menu-value .zoom-label:hover` — same.
25. ✅ `03-toolbar.css:1137` `.zoom-menu-item:hover:not(:disabled)` — same.
26. ✅ `06-editor-content.css:384` `.tp-preview-zoom button:hover` — same.
27. ✅ `10-character-profiles.css:1498` `.char-upload-menu-item:hover` — same.
28. ✅ `10-character-profiles.css:1538` `.char-profile-custom-remove:hover` — same.
29. ✅ `20-tool-dock.css:87` `.fs-titlebar-btn:hover` — title-bar quick actions.
30. ✅ `20-tool-dock.css:170` `.about-whatsnew:hover` — same.
31. ✅ `20-tool-dock.css:193` `.fs-customize-globals button:hover` — same.
32. ✅ `20-tool-dock.css:249` `.fs-panel-expand:hover` — same.
33. ✅ `20-tool-dock.css:621` `.tool-ctl-menu-item:hover` — **every tool-window ⋯ menu
    row gets hover feedback.**
34. ✅ `22-tools-extra.css:1912` `.ws-action-btn:hover:not(:disabled)` — same.
35. ✅ `22-tools-extra.css:1921` `.fs-devairtable-open:hover` — same.
36. ✅ `24-notebook.css:801` `.rib-add-back:hover` — same.
37. ✅ `24-notebook.css:959` `.ribed-help-btn:hover` — same.
38. ✅ `25-confirm-outline-tabs.css:523` `.fs-tabinfo-btn:hover/.active` — same.
39. ✅ `26-design-panel.css:128` `.dz-choice:hover` — same.
40. ✅ `05-scene-navigator.css:1036` `.fs-pages-pop-item:hover` — same.
41. ✅ `04-editor-panels.css:69` — Script History diff container gets a background.
42. ✅ `04-editor-panels.css:75` `.script-diff-view` — same.
43. ✅ `04-editor-panels.css:268` `.treatment-editor-root` — same.
44. ✅ `04-editor-panels.css:319` `.treatment-element-select` — select body opaque.
45. ✅ `18-elements-templates.css:140` `.template-editor-hint` — hint dims correctly.
46. ✅ `18-elements-templates.css:180` — same block, dim text.
47. ✅ `18-elements-templates.css:228` — same.
48. ✅ `18-elements-templates.css:249` — same.
49. ✅ `18-elements-templates.css:295` — same.
50. ✅ `18-elements-templates.css:322` — same.
51. ✅ `18-elements-templates.css:380` `.template-select-hint` — same.
52. ✅ `18-elements-templates.css:437` — same.
53. ✅ `18-elements-templates.css:451` — same.
54. ✅ `18-elements-templates.css:458` — same.
55. ✅ `18-elements-templates.css:563` / `:567` / `:575` — same.
56. ✅ `18-elements-templates.css:616` / `:632` — same.
57. ✅ `18-elements-templates.css:673` / `:695` — same.
58. ✅ `24-notebook.css:1317` and `:1350` — Notebook color-pop secondary text.
59. ✅ `AboutDialog.tsx:92` / `:117`, `DiagnosticsDialog.tsx:11` / `:55` / `:98`,
    `MenuBar.tsx:2223` — inline `var(--fd-text-secondary)` now resolves.

## C. The primary-button hover trap

60. ✅ `07-dialogs-search.css:239` — give `.dialog-btn-primary:hover` its own
    `background` (e.g. `color-mix(in srgb, var(--fd-accent) 88%, black)`) instead of
    only `opacity`, so it outranks `.dialog-btn:hover` (0-2-0 beats 0-1-0).
61. ✅ `01-fonts-base.css:283` — reconcile or delete the light-theme-only
    `.dialog-btn-primary:hover { background:#104d8f }` once item 60 lands, so one
    rule governs both themes.
62. ✅ `07-dialogs-search.css:230` — align `.dialog-primary:hover` with item 60 so the
    two primary idioms behave identically while both still exist.
63. ✅ Add a check-driver assert: hovered primary stays accent-tinted in dark **and**
    light (this class of bug is invisible without a computed-style read).

## D. Native / unstyled controls

64. ✅ Add `color-scheme: dark light;` to `:root` (and per-theme where a theme is
    strictly one or the other) — without it WebKit paints native widgets in light
    style inside dark themes.
65. ◐ PARTLY DONE (v7.01): shipped `button, input, select, textarea, optgroup
    { font-family: inherit; }`. The FAMILY is fixed everywhere; the SIZE is not.
    Forcing `font: inherit` would resize every control in the app in one go,
    including the many that depend on their own font-size today, so the controls
    that lacked a size were given one individually instead. Full `font: inherit`
    remains open and needs item 66 done with it.
66. Re-measure every control after item 65 — anything that relied on the UA size
    will shift; this is a deliberate sweep, not a side effect to discover later.
67. ✅ `PreferencesDialog.tsx:616` — class the **Window on launch** `<select>`
    (`prefs-field-row` select style or a new shared class from item 118).
68. ✅ `PreferencesDialog.tsx:687` — class the **Units** `<select>`.
69. ✅ `PreferencesDialog.tsx:709` — class the **Date format** `<select>`.
70. ✅ `PreferencesDialog.tsx:724` — class the **Time format** `<select>`.
71. ✅ `PreferencesDialog.tsx:268-275` — class the Draft Number text input
    (`dialog-input` or the shared input class); it currently renders native white.
72. ✅ `PreferencesDialog.tsx:277` — Draft Number **Apply**: `dialog-primary` →
    `dialog-btn dialog-btn-primary` so it gets a height instead of painting a 19px
    native button.
73. ✅ `PreferencesDialog.tsx:281` — Draft Number **Set as Default** has no class at
    all; give it `dialog-btn`.
74. ✅ `PreferencesDialog.tsx:503` — Google Drive Connect button: class it.
75. ✅ `PreferencesDialog.tsx:529` — OneDrive Connect button: class it.
76. ✅ `setupFields.tsx:100` — Guided Setup "Save a version every" `<select>`: class it.
77. `01-fonts-base.css:165` — `.dialog-body select` exists **only** under
    `[data-theme="light"]`; add the dark-theme equivalent, or delete it in favor of
    classing the controls (items 78–92).
78. `DictionaryConfigPanel.tsx:59` — unclassed button, native in dark themes.
79. `DictionaryConfigPanel.tsx:113` — same.
80. `DictionaryConfigPanel.tsx:145` — same.
81. `DictionaryConfigPanel.tsx:311` — same.
82. `DictionaryConfigPanel.tsx:329` — same.
83. `DictionaryConfigPanel.tsx:375` — same.
84. `DictionaryConfigPanel.tsx:451` — same.
85. `DictionaryConfigPanel.tsx:467` — same.
86. `DictionaryConfigPanel.tsx:487` — same.
87. `DictionaryConfigPanel.tsx:543` — same.
88. `DictionaryLibrary.tsx:118` — same.
89. `DictionaryLibrary.tsx:155` — same.
90. `DictionaryLibrary.tsx:156` — same.
91. `DictionaryLibrary.tsx:188` — same.
92. `DictionaryLibrary.tsx:217` — same.
93. `AppErrorBoundary.tsx:41` — unclassed button (error screen; low traffic, still
    native).
94. `DemoBanner.tsx:91` — unclassed button.
95. `CustomizePanelsDialog.tsx:755` — unclassed spacer-size button.
96. `CustomizePanelsDialog.tsx:759` — same.
97. `FormatPanel.tsx:245` — unclassed button in a format row.
98. `GrammarRulesPanel.tsx:114` — unclassed button in the dialog header.
99. `SpellCheckModal.tsx:309/399/400/404/409` — verify `.spell-modal-actions-col`
    inherits the `.spell-modal-actions button` rule; class them if not.
100. `WritingSuggestionsModal.tsx:304/305/306/309` — same verification.

## E. `dialog-primary` → `dialog-btn dialog-btn-primary`

Mechanical, one site per item. Each needs a visual check because bare
`dialog-primary` currently inherits whatever container it sits in.

101. ✅ `NewScriptDialog.tsx:162` (Create)
102. ✅ `GoToPage.tsx:66` (Go)
103. ✅ `WorkspaceDialogs.tsx:72` (Save)
104. ✅ `WorkspaceDialogs.tsx:232` (Done)
105. ✅ `GrammarRulesPanel.tsx:143` (Done)
106. ✅ `VersionHistory.tsx:499` (Restore)
107. ✅ `CharacterProfiles.tsx:1734`
108. ✅ `RenameDialog.tsx:93` (Apply)
109. ✅ `DiagnosticsDialog.tsx:109` (Close)
110. ✅ `SpellCheckModal.tsx:282` (Close)
111. ✅ `SpellCheckModal.tsx:312` (Close)
112. ✅ `SpellCheckModal.tsx:417` (Change)
113. ✅ `SaveAsDialog.tsx:527`
114. ✅ `PreferencesDialog.tsx:277` — same site as item 72; do it once.
115. ✅ `PreferencesDialog.tsx:505` (Drive Connect)
116. ✅ `PreferencesDialog.tsx:531` (OneDrive Connect)
117. ✅ `PageSetupDialog.tsx:358` (Apply)
118. ✅ `GuidedSetupDialog.tsx:277` (Next)
119. ✅ `AboutDialog.tsx:159` (Close)
120. ✅ `ScriptNotePopover.tsx:322` (Delete) — also item 105 in the danger sweep; the
     inline `background:'#c0392b'` becomes `dialog-btn-danger`.
121. ✅ `MenuBar.tsx:2296`
122. ✅ `MenuBar.tsx:2409` (Save & Continue)
123. ✅ `MenuBar.tsx:2441` (Continue)
124. ✅ `DictionaryLibrary.tsx:241` (Done)
125. ✅ `WritingSuggestionsModal.tsx:215` (Close)
126. ✅ `WritingSuggestionsModal.tsx:310` (Next)
127. ✅ `DictionaryConfigPanel.tsx:388` (Done)
128. ✅ `TitlePageEditor.tsx:770` (Apply)
129. ✅ `SetDraftDialog.tsx:137` (Apply)
130. ✅ `MoresContdsDialog.tsx:186` (Apply)
131. ✅ `07-dialogs-search.css:229-230` — delete the `.dialog-primary` rule once items
     101–130 are done, so only one primary idiom remains.
132. ✅ Add a lint/test assert that `className="dialog-primary"` never reappears.

## F. Button sizing

133. ✅ `18-elements-templates.css:233` — `.dialog-btn-sm` sets font and padding but not
     height; add `height: 26px` (it currently renders 34px tall with 12px text).
134. Re-check Settings ▸ Page Setup "View" after 133.
135. Re-check Settings ▸ Defaults per-row "Reset" after 133 — it should stop towering
     over "Reset All".
136. `22-tools-extra.css` `.fs-reset-all-btn` (26px) vs `.dialog-btn-sm` (26px after
     133) — confirm they now match, or fold `fs-reset-all-btn` into `dialog-btn-sm`
     plus a danger modifier.
137. ✅ Introduce `--dz-dialog-btn-h-sm` so the small size is Design-panel governed like
     the standard one.
138. `23-toolbar-zones.css:325` `.fs-newscript-actions button` (32/13) → adopt the
     dialog button token.
139. `23-toolbar-zones.css:328` `.fs-guided-actions button` (32/13) → same.
140. `23-toolbar-zones.css:327` `.fs-launcher-foot button` (30/13) → same.
141. `11-spell-grammar-history.css:160` `.spell-modal-actions button` (30/12) → same.
142. `07-dialogs-search.css:102` `.search-actions button` (28/12) → same, or declare
     it a deliberate compact variant and name it as one.
143. `25-confirm-outline-tabs.css:339` `.fs-confirm-actions button` (padding-sized,
     13px) → same.
144. `27-markups.css:361` `.markup-icon-pop-foot .dialog-btn` (26/12) → replace the
     local override with `dialog-btn-sm` from item 133.
145. `29-rewrite.css:365` `.rw-key-actions .dialog-btn` (26/12) → same.
146. `15-responsive.css:200` `.dialog-actions button` (40px on mobile) — confirm it
     still tracks after the token work.
147. `22-tools-extra.css` — stop using `.swn-add-btn` for the three Settings buttons
     (Grammar & Spelling, Export Settings…, Import Settings…); give Settings its own
     class or use `dialog-btn`.
148. `19-sticky-notes.css:241` — once 147 lands, `.swn-add-btn` belongs to Sticky
     Notes only; verify nothing else borrows it.

## G. Danger red → `--fd-danger`

One item per selector. All depend on items 8–10.

149. ✅ `11-spell-grammar-history.css:235` `.version-delete-btn:hover`
150. ✅ `11-spell-grammar-history.css:254` `.version-deleteall-btn:hover`
151. ✅ `20-tool-dock.css:1082`
152. ✅ `22-tools-extra.css:1845`
153. ✅ `25-confirm-outline-tabs.css:53-54`
154. ✅ `25-confirm-outline-tabs.css:59-60`
155. ✅ `27-markups.css:186`
156. ✅ `27-markups.css:262`
157. ✅ `01-fonts-base.css:303` (`#c62828`, light-theme revoke)
158. ✅ `03-toolbar.css:87` (`#c62828` + `#e57373` in the same block)
159. ✅ `07-dialogs-search.css:69/73/79` (`#c62828`, save-failure light theme)
160. ✅ `07-dialogs-search.css:27/47/55` — the save-failure trio `#7a3a3a` / `#e0a0a0` /
     `#4a2a2a`; needs a danger-surface token, not just danger-text.
161. ✅ `08-index-cards-beatboard.css:388` (`#ff6b6b`)
162. ✅ `08-index-cards-beatboard.css:702` (`#ff6b6b`)
163. ✅ `11-spell-grammar-history.css:291` (`#ff6b6b`)
164. ✅ `11-spell-grammar-history.css:506` (`#ff6b6b`)
165. ✅ `11-spell-grammar-history.css:533` (`#ff6b6b`)
166. ✅ `11-spell-grammar-history.css:543` (`#ff6b6b`)
167. ✅ `11-spell-grammar-history.css:546` (`#ff6b6b`)
168. ✅ `11-spell-grammar-history.css:596` (`#ff6b6b`)
169. ✅ `12-projects-assets.css:80` (`#ff6b6b`)
170. ✅ `12-projects-assets.css:201` (`#ff6b6b` `.delete-btn:hover`)
171. ✅ `12-projects-assets.css:557` (`#ff6b6b` `.dropdown-item-danger`)
172. ✅ `13-production-tags.css:300` (`#ff6b6b`)
173. ✅ `13-production-tags.css:385` (`#ff6b6b`)
174. ✅ `18-elements-templates.css:233` (`#ff4444` `.dialog-btn-danger`)
175. ✅ `18-elements-templates.css:299` (`#ff4444`)
176. ✅ `18-elements-templates.css:352` (`#ff4444` `.template-delete-btn:hover`)
177. ✅ `04-editor-panels.css:161` (`#ef4444`)
178. ✅ `04-editor-panels.css:205` (`#ef4444`)
179. ✅ `04-editor-panels.css:517` (`#ef4444`)
180. ✅ `07-dialogs-search.css:35` (`#ef4444`)
181. ✅ `07-dialogs-search.css:85` (`#ef4444`)
182. ✅ `10-character-profiles.css:1538` (`#ef4444`)
183. ✅ `10-character-profiles.css:798` (`#ef5350`)
184. ✅ `10-character-profiles.css:975-976` (`#ef5350` `.rel-map-btn-danger`)
185. ✅ `03-toolbar.css:906/910/918` (`#e06060`)
186. ✅ `10-character-profiles.css:331` (`#e06060`)
187. ✅ `10-character-profiles.css:400/405/407` (`#e06060`)
188. ✅ `25-confirm-outline-tabs.css:499` (`#e06060`)
189. ✅ `29-rewrite.css:73` (`#e06060`)
190. ✅ `05-scene-navigator.css:1365` (`#e05252`)
191. ✅ `05-scene-navigator.css:1449` (`#e05252`)
192. ✅ `05-scene-navigator.css:1469` (`#e05252`)
193. ✅ `05-scene-navigator.css:1514` (`#e05252`)
194. ✅ `22-tools-extra.css:889/891` (`#d05050`, first `.ws-icon-btn` block)
195. ✅ `22-tools-extra.css:1663` (`#d05050`)
196. ✅ `22-tools-extra.css:1723` (`#e05656`, second `.ws-icon-btn` block)
197. ✅ `20-tool-dock.css:819-820` (`#c0564f`)
198. ✅ `22-tools-extra.css:359/361` (`#c0564f` `.fs-reset-all-btn`)
199. ✅ `CharacterProfiles.tsx:1735` — inline `#c0392b`
200. ✅ `DictionaryConfigPanel.tsx:256` — inline `#c0392b`
201. ✅ `DictionaryLibrary.tsx:159` — inline `#c0392b`
202. ✅ `ScriptNotePopover.tsx:322` — inline `#c0392b`
203. ✅ `TitlePageEditor.tsx:764` — inline `#c0392b`
204. ✅ `Toast.tsx:56` — inline `#c0392b`
205. ✅ `NotebookTool.tsx:668` — inline `#e06060`
206. ✅ `AppErrorBoundary.tsx:33/49` — inline `#ff6b6b`
207. ✅ `SaveAsDialog.tsx:511` — inline `#ff6b6b`
208. ✅ `27-markups.css:418/523/805` + `markupIcons.tsx:71` (`#e05555`) — this is the
     Markups **palette**, a user-facing color choice, not chrome. Leave it; noting it
     so it is not swept by mistake.
209. ✅ `BeatBoard.tsx:44/49`, `CharacterProfiles.tsx:29`, `RelationshipMap.tsx:72`,
     `ScriptStatistics.tsx:26` (`#ef4444`) — same: data palettes, leave.

## H. Success / warning scatter (same treatment, lower priority)

210. ✅ Add `--fd-success` to `:root` (candidates in use: `#2d8a4e`, `#4caf50`,
     `#6abf69`, `#27ae60`).
211. `08-index-cards-beatboard.css` `.ic-apply-btn.active` (`#2d8a4e`) → token.
212. `22-tools-extra.css` `.fb-sent-msg` (`#27ae60`) → token.
213. Sweep remaining `#4caf50` / `#6abf69` sites → token.
214. ✅ Add `--fd-warning` to `:root` (`#e5a50a`, `#f59e0b`, `#d97706`, `#e8994f` in use).
215. `11-spell-grammar-history.css` `.version-view-btn:hover` (`#e5a50a`) → token.
216. `18-elements-templates.css` `.template-select-mode-enforce` (`#f59e0b`) → token.
217. Sweep remaining `#d97706` / `#e8994f` sites → token.

## I. Accent fallback drift

218. ✅ `10-character-profiles.css:881` and the 5 other `var(--fd-accent, #8b5cf6)` sites
     — **purple** fallback; change to `#4a90d9` so a token failure can't turn
     Character relationship primaries purple while everything else stays blue.
219. ✅ `06-editor-content.css:202` + 5 more `var(--fd-accent, #3b82f6)` → `#4a90d9`.
220. ✅ `12-projects-assets.css:711` + 2 more `var(--fd-accent, #4a6fa5)` → `#4a90d9`.
221. ✅ `18-elements-templates.css:154` + 1 more `var(--fd-accent, #4a9eff)` → `#4a90d9`.
222. ✅ `22-tools-extra.css:804` `var(--fd-accent, #1565c0)` → `#4a90d9`.
223. ✅ `09-script-notes.css:111` `var(--fd-accent, #6ea0f7)` → `#4a90d9`.
224. ✅ The single `var(--fd-accent, #2e7dd7)` site → `#4a90d9`.
225. ✅ Better still: drop all fallbacks once item 12's gate proves `--fd-accent` is
     always defined — one value, no drift possible.
226. ✅ Same treatment for the `var(--fd-accent-bg, …)` sites (4) — define the token or
     unify the fallback.
227. ✅ Same for `var(--fd-bg-dim, …)` (3), `var(--fd-tooltip-bg/-text, …)`,
     `var(--fd-canvas-bg, …)`, `var(--fd-bg-hover, …)`, `var(--fd-panel-bg, …)`.

## J. Hardcoded dark controls (sepia / paper / solarized-light)

228. ✅ `06-editor-content.css:460` `.language-selector` — `#2a2a2a` → `var(--fd-input-bg)`.
229. ✅ `06-editor-content.css:462` `.language-selector` — border `#555` → `var(--fd-border)`.
230. ✅ `10-character-profiles.css:119` `.char-profiles-search-input` — `#222` → token.
231. ✅ `10-character-profiles.css:194` `.char-sort-select` — `#222` → token.
232. ✅ `12-projects-assets.css:388` `.asset-tag-input` — `#222` → token.
233. ✅ `12-projects-assets.css:390` `.asset-tag-input` — border `#555` → token.
234. ✅ `12-projects-assets.css:406` `.asset-filter-input` — `#222` → token.
235. ✅ `12-projects-assets.css:408` `.asset-filter-input` — border `#555` → token.
236. ✅ `12-projects-assets.css:417` `.asset-filter-select` — `#222` → token.
237. ✅ `12-projects-assets.css:419` `.asset-filter-select` — border `#555` → token.
238. ✅ `12-projects-assets.css:523` `.asset-tags-edit-input` — `#222` → token.
239. ✅ `12-projects-assets.css:807` — border `#555` → token.
240. ✅ `13-production-tags.css:491` `.tags-add-input` — `#222` → token.
241. ✅ `15-responsive.css` `.toolbar-btn.active { background:#555 }` → token (mobile).
242. `01-fonts-base.css:246` — once 228–241 land, re-evaluate whether the
     `[data-theme="light"] input/select/textarea { … !important }` patch is still
     needed; it currently masks exactly these bugs in one theme out of eleven.
243. Add a check-driver assert that walks sepia and paper and fails on any control
     whose computed background is darker than the page background.

## K. Themes customizer coverage

244. ✅ `themes.ts` `THEME_VARS` — add `--fd-input-bg` (Input fields).
245. ✅ `themes.ts` `THEME_VARS` — add `--fd-dialog-bg` (Dialog surface).
246. ✅ `themes.ts` `THEME_VARS` — add `--fd-overlay-subtle`.
247. ✅ `themes.ts` `THEME_VARS` — add `--fd-overlay-light`.
248. ✅ `themes.ts` `THEME_VARS` — add `--fd-overlay-medium`.
249. ✅ `themes.ts` `THEME_VARS` — add `--fd-shadow`.
250. ✅ `themes.ts` `THEME_VARS` — add `--fd-chrome-separator`.
251. ✅ `themes.ts` `THEME_VARS` — add `--fd-chrome-shadow`.
252. ✅ `themes.ts` `THEME_VARS` — add `--fd-hairline`.
253. ✅ `themes.ts` `THEME_VARS` — decide whether `--fd-hairline-w` (a width, not a
     color) belongs in a color editor or in the Design panel instead.
254. ✅ `themes.ts` `THEME_VARS` — add `--fd-danger` / `--fd-success` / `--fd-warning`
     once items 8, 210, 214 land.
255. Add a test that every `--fd-*` color defined in `:root` is either in
     `THEME_VARS` or explicitly listed as intentionally non-editable — so the next
     token added doesn't silently become unreachable.
256. Group the new keys sensibly in the customizer UI (Application / Text / Surfaces)
     rather than appending twelve rows to one list.

## L. Duplicate and dead rules

257. ✅ `22-tools-extra.css:873` vs `:1715` — merge the two `.ws-icon-btn` blocks; the
     later one silently wins today.
258. ✅ Decide the surviving `.ws-icon-btn` height (28px vs 26px).
259. ✅ Decide the surviving `.ws-icon-btn` border (1px vs none).
260. ✅ Decide the surviving `.ws-icon-btn` hover (`--fd-menu-hover` vs `--fd-overlay-light`).
261. ✅ Decide the surviving `.ws-icon-btn.ws-danger` red (`#d05050` vs `#e05656`) — then
     it feeds item 194/196.
262. ✅ `23-toolbar-zones.css:321` — delete the dead `.prefs-subtabs` block (no `.tsx`
     has referenced it since the v7.00 rail rebuild).
263. ✅ `23-toolbar-zones.css:322` — delete `.prefs-subtabs button.active` with it.
264. Sweep for other CSS classes with zero `.tsx` references; the `--dz`/helper
     catalogs have gates, plain classes do not.
265. Add a dead-CSS check to `check-all.mjs` so this doesn't re-accumulate.

## M. Select unification

266. Define one `.fs-select` base (height, font, radius, border, background) as the
     single source of truth.
267. Add `--dz-select-h` so the Design panel governs select height the way it governs
     dialog button height.
268. `03-toolbar.css:382` `.element-selector` / `.font-selector` / `.font-size-selector`
     (22px) → adopt base + a compact modifier.
269. `06-editor-content.css:460` `.language-selector` (24px) → base.
270. `27-markups.css` `.fs-nav-scnf-select` (24px) → base.
271. `22-tools-extra.css` `.view-style-selector` (26px) → base.
272. `23-toolbar-zones.css` `.fs-tbzone-adders select` (26px) → base.
273. `07-dialogs-search.css:393` `.page-setup-row select` (28px) → base.
274. `10-character-profiles.css:194` `.char-sort-select` (28px) → base.
275. `12-projects-assets.css:417` `.asset-filter-select` (28px) → base.
276. `22-tools-extra.css` `.fb-select` (30px) → base.
277. `14-mobile-format.css` `.format-size-select` (30px) → base.
278. `22-tools-extra.css:451` `.prefs-field-row select` (32px) → base.
279. `12-projects-assets.css:408` `.sort-select` (32px) → base.
280. `05-scene-navigator.css` `.scene-filter-select` (36px min-height) → base.
281. Give the base a `:focus` rule (accent border) — most selects have none in dark
     themes today; the light-theme override at `01-fonts-base.css:250` is the only
     focus styling many of them get.
282. Verify `.fb-select` focus specifically (it has none).
283. Add a custom dropdown arrow to the base so selects stop showing the OS arrow at
     varying sizes.

## N. Input unification

284. `07-dialogs-search.css:175` vs `:242` — `.dialog-row input` is
     `var(--dz-dialog-input-h, 36px)`, `.dialog-input` is a hardcoded 34px. Pick one.
285. Route `.dialog-input` through `--dz-dialog-input-h`.
286. Audit the other input heights against the chosen base: 24 (`.fs-divider-label-input`),
     26 (`.prefs-num-input`, `.thes-input`, `.rw-key-input`, `.tags-add-input`),
     28 (several), 30 (`.props-input`, `.fb-input`, `.ws-rename-input`), 32
     (`.spell-modal-input`), 34 (`.dialog-input`), 36 (`.dialog-row input`).
287. `22-tools-extra.css` `.fb-input` — add an explicit `font-size` (it sets height
     only, so it inherits the UA size until item 65).
288. `22-tools-extra.css` `.fb-select` — same.

## O. Title / heading scale

289. Define a documented scale (e.g. window 16 / section 13 / sub-section 11.5) with
     tokens, rather than 14 ad-hoc sizes.
290. `20-tool-dock.css` `.tool-window-title` (12/700) → scale.
291. `05-scene-navigator.css` `.navigator-title` (13/700) → scale.
292. `09-script-notes.css` `.script-notes-title` (12/600) → scale.
293. `10-character-profiles.css` `.char-profiles-title` (12/600) → scale.
294. `13-production-tags.css` `.tags-panel-title` (12/600) → scale.
295. `08-index-cards-beatboard.css` `.beat-board-title` (12/600) → scale.
296. `04-editor-panels.css` `.location-db-title` (13/700) → scale.
297. `21-outline-bar.css` `.fs-ob-title` (11/700) → scale.
298. `25-confirm-outline-tabs.css` `.fs-confirm-title` (14/600) → scale.
299. `22-tools-extra.css` `.fb-title` (15) → scale.
300. `23-toolbar-zones.css` `.fs-guided-title` (15/600) → scale.
301. `23-toolbar-zones.css` `.fs-launcher-title` (13/600) → scale.
302. `22-tools-extra.css` `.prefs-general h3` (11.5/700 muted) → scale.
303. `22-tools-extra.css` `.fs-customize-body h3` (13, full color) → scale — it and
     302 are the same rank in the same window and don't match.
304. `07-dialogs-search.css` `.about-section-title` (13/600) → scale.
305. `07-dialogs-search.css` `.about-subsection-title` (12/600) → scale.
306. `22-tools-extra.css` `.pv-section-title` (11/700) → scale.
307. `22-tools-extra.css` `.pst-listhead` (11/700) → scale.
308. `23-toolbar-zones.css` `.fs-tbzone-title` (11/700) → scale.
309. `26-design-panel.css` `.dz-title` (13/600) → scale.
310. `17-settings.css` `.settings-section-title` (18/700) → scale, or delete with
     item 316.
311. Decide one convention for muted vs full-color section heads and apply it
     everywhere (today it splits roughly 50/50).
312. `18-elements-templates.css:598` `.fmt-dialog .dialog-header` duplicates the
     standard `.dialog-header` values — delete the duplicate, inherit the token.

## P. Legacy surfaces

313. `App.tsx:37` — decide the fate of the `/settings` route; nothing in the v7.00 UI
     links to it.
314. If removed: delete `SettingsPage.tsx`.
315. If removed: delete `17-settings.css` (or the parts only it uses).
316. If kept: reconcile `.settings-section-title` (18/700) with the Settings window's
     `h3` (11.5/700).
317. If kept: reconcile `.settings-reset-all-btn` red `#e57373` with
     `.fs-reset-all-btn` `#c0564f` — two "reset everything" buttons, two reds.
318. `ScriptFormatPreferencesDialog.tsx` — the standalone first-run/Format-menu
     dialog still uses the old checkbox UI over the same `enabledScriptFormats` the
     Page Setup tab now manages with Shown/Hidden lists. Same data, two idioms.

## Q. Icons

319. ✅ `ThesaurusTool.tsx:212` — `FaSearch` where the rest of the app uses `LuSearch`
     (17 uses); switch it. This is the only true search-icon mismatch.
320. `TitlePageEditor.tsx:705/707` and `MenuBar.tsx:1553` use `FaSearchPlus` /
     `FaSearchMinus` for **zoom** — a different concept, but still Fa line-weight
     next to Lu icons. Decide whether zoom magnifiers move to Lu.
321. `markupIcons.tsx:43` `FaSearch` — a user-pickable markup glyph, deliberate.
     Leave; listed so it isn't swept.
322. Audit the 12 files that import from both `react-icons/fa` and `react-icons/lu`
     and pick one family per file.
323. Decide the house rule (Fa for solid/filled, Lu for line?) and write it into
     `CLAUDE.md` §3 so it stops drifting.
324. `uiIcons.tsx` — confirm every new icon goes through the shared registry rather
     than being imported directly in a component.

## R. Inline-style islands

325. `DictionaryConfigPanel.tsx` — 48 inline `style={{…}}` blocks; move to CSS.
326. `NotebookTool.tsx` — 22 inline blocks.
327. `DictionaryLibrary.tsx` — 20 inline blocks.
328. `ScreenplayEditor.tsx` — 14 inline blocks.
329. `TitlePageEditor.tsx` — 13 inline blocks.
330. `MenuBar.tsx` — 12 inline blocks.
331. `AboutDialog.tsx` — 12 inline blocks.
332. `GrammarRulesPanel.tsx` — 11 inline blocks.
333. `RelationshipMap.tsx` / `BeatBoard.tsx` — 10 each.
334. Rule of thumb to adopt: inline styles only for computed values (positions,
     measured sizes); anything static belongs in CSS.

## S. Radius

335. Pick the house radius (4–5px is the plurality) and token it.
336. `22-tools-extra.css` `.tool-dock-iconbtn` (7px) → token or justify.
337. `03-toolbar.css` `.zoom-panel-btn` (8px) → token or justify.
338. `12-projects-assets.css` `.welcome-choice-btn` (8px) → token or justify.
339. `19-sticky-notes.css` `.swn-add-btn` (6px) → token.
340. `22-tools-extra.css` `.prefs-tab` (6px) → token.
341. `13-production-tags.css` `.tags-entity-create-btn` (6px) → token.
342. `22-tools-extra.css` `.pv-export-btn` / `.pv-exit-btn` (6px) → token.
343. Leave the deliberate pills: `.fs-bmc-btn` (11/17px), `.fs-help-btn` (50%),
     `.fs-tabinfo-btn` (50%).

## T. Reorder widget consolidation

344. Pick one up/down control implementation.
345. `05-scene-navigator.css` `.fs-updown-btn` (8px glyphs) → shared.
346. `22-tools-extra.css` `.fs-customize-order button` (7px) → shared.
347. `22-tools-extra.css` `.ws-order button` (7px) → shared.
348. `22-tools-extra.css` `.fs-pin-order button` (8px) → shared.
349. Update `ToolControls.tsx:48/54` and `WorkspaceDialogs.tsx:155` to the shared
     class.

## U. Behavior (found during the sweep)

350. ✅ `TemplateSelectDialog.tsx:182` — replace native `confirm()` with the house
     `confirmDialog`. In Tauri `window.confirm` returns a **Promise** (always truthy),
     so the template is deleted regardless of the answer.
351. ✅ Add a test that asserts no `confirm(` / `alert(` / `prompt(` appears outside
     `ConfirmDialog.tsx` — the header there already documents the rule; nothing
     enforces it.

## V. Misc

352. ✅ `04-editor-panels.css:193` `.diff-block-label` — `font-family: sans-serif` is the
     only UI label outside the app font stack; change to `inherit`.
353. `15-responsive.css` — 43 `!important` declarations; audit which are still needed
     now that the desktop rules use tokens.
354. `03-toolbar.css` — 21 `!important` declarations; same audit.
355. `22-tools-extra.css` — 16 `!important` declarations; same audit.
356. `16-print.css` — 28 `!important`; these are legitimate, note them as exempt.
357. `12-projects-assets.css` `.dropdown-item` (8×14 padding) vs
     `02-menubar.css` `.menu-dropdown-item` (5×16) — decide whether the two menu
     systems should converge or stay deliberately distinct.
358. `12-projects-assets.css:557` `.dropdown-item-danger` — after item 171, confirm
     it matches the menubar's danger treatment.
359. Document the resulting button / select / input / title scales in
     `docs/` so the next change has something to conform to.
360. Add the style rules to `CLAUDE.md` §3 as standing practice, the way the About
     open-source list and Helper Text catalog rules are recorded.

---

## Suggested batching (if you want it shipped incrementally)

- **Batch 1 — items 1-13, 60-63:** tokens + the hover trap + the gate test. Biggest
  visible repair per line changed; nothing else depends on decisions.
- **Batch 2 — items 64-100:** native controls. Self-contained, high visibility in
  Settings.
- **Batch 3 — items 101-132:** the `dialog-primary` collapse. Mechanical but wide;
  worth its own version so a regression is easy to bisect.
- **Batch 4 — items 133-148:** button sizing.
- **Batch 5 — items 149-227:** color tokens. Large but low-risk.
- **Batch 6 — items 228-256:** theme coverage and the hardcoded controls.
- **Batch 7 — items 257-360:** unification and hygiene, in whatever order suits.


---

## Still open after v7.01

Two kinds, kept apart on purpose.

### Waiting on a decision from Derek (they change how things LOOK)

- **F138-146** — make every dialog's action buttons one size. Today they run
  28/30/32/34px per surface. Unifying means New Script, Guided Setup, the
  Launcher, the spell modal and the search bar all change height.
- **M266-283** — one select style. Seven heights are in use; unifying resizes
  controls in the toolbar, Characters, Assets and the Feedback form.
- **N284-288** — one dialog input height (34 vs 36 today).
- **O289-312** — one title scale. Fourteen sizes across tool titles, window
  titles and section heads; picking a scale changes most panel headers.
- **P313-318** — the legacy `/settings` route: delete it, or keep and reconcile
  it? Nothing in the v7.00 UI links to it.
- **Q320-324** — do the zoom magnifiers move from Fa to Lu, and what is the
  house rule for icon families?
- **S335-343** — one corner radius for same-role controls (4-5px is the
  plurality; six classes sit at 6-8px).
- **T344-349** — collapse the four copies of the up/down reorder widget into one.

### Not yet done, no decision needed

- **D66** — the full `font: inherit` sweep (see item 65 above).
- **D77-D100** — 24 unclassed buttons, mostly the two Dictionary panels, which
  are styled inline rather than by the stylesheet. Their buttons are native in
  dark themes because `.dialog-body button` exists only under
  `[data-theme="light"]`. Worth doing together with R325-334.
- **L264-265** — sweep for other zero-reference CSS classes and add a dead-CSS
  check to `check-all`.
- **K255-256** — the test that every `:root` color is either editable in Themes
  or explicitly exempt, and grouping the new keys in the customizer UI.
- **R325-334** — the inline-style islands (DictionaryConfigPanel 48 blocks,
  NotebookTool 22, DictionaryLibrary 20, …).
- **V353-360** — the `!important` audits, the two dropdown systems, and writing
  the resulting scales into `CLAUDE.md` §3.
