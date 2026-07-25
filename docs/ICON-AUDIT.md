# ICON-AUDIT — every function served by two or more different icons

> ## DECIDED (Derek, 2026-07-25) — applied in v4.31
> 1 fullscreen: **C** (now `FullscreenIcon`/`ExitFullscreenIcon` in uiIcons) ·
> 2 close: **A** (×) · 3 search: **B** (LuSearch) · 4 add: **B** (ASCII +) ·
> 5 delete: **B** (FaRegTrashAlt) · 6 caret: **B** (Lu chevrons) ·
> 7 rename: **B** (FaEdit) · 8 settings: **B** (FaWrench) · 9 check: **A**
> (FaCheck) · 10 copy: **A** (FaCopy) · 11 visibility: **B** (outline eyes) ·
> 12 undo: **A** (FaUndo/FaRedo) · 13 reset: **B** (LuRotateCcw) ·
> 14 zoom: **B** (circled ±) · 15 grip: **B** (⋮⋮) · 16 help: **B**
> (FaRegQuestionCircle) · 17 back: **B** (←) · 18 utility: **B** (via the
> UTILITY_ICONS registry).
>
> Scope judgements made while applying (flag if wrong):
> - **delete**: only actions that DESTROY data got the trash; ×/✕ that merely
>   hide, cancel a pending state, or deselect a filter chip stayed × — that
>   preserves the close-vs-delete distinction the audit flagged.
> - **check**: icon checkmarks unified on FaCheck; "✓ " STRING prefixes inside
>   menu labels stayed text (they're label content, not control faces).
> - **settings**: the whole settings/customize family wears FaWrench now
>   (File > Settings, View > Customize, tab icons); the Design TOOL keeps
>   FaSlidersH — it's the tool's identity, not a settings entry.
> - **zoom**: in/out/percent controls wear the circled ±; "Scale to Fit/Max
>   Width/Actual Size" kept FaSearchPlus/Minus — fit is a different verb.
> - **back**: ‹/◀ became ←, and their paired forward twins became →.

> Companion to **`docs/icon-audit.html`** (open it in a browser — it renders every
> candidate side by side at 16px/28px on app-dark tiles; reply with e.g.
> "fullscreen: B" per group).
>
> **Snapshot:** all file:line references were taken in one pass on 2026-07-25
> against the working tree at commit `9951f3d` **with other workers' uncommitted
> edits present**. `CharacterProfiles.tsx`, `ToolControls.tsx` and `ToolDock.tsx`
> were being edited concurrently — line numbers in those three can drift by a few
> lines; the class names / titles quoted with each reference are stable anchors.
>
> Scope: everything under `frontend/src` — react-icons components, text-glyph
> buttons, and inline `<svg>` control faces. Data visualizations (relationship
> map, mind-map lines, completeness ring, scene-length page icon
> SceneNavigator.tsx:158) and one-off illustrations (Hidden Mode intro
> MenuBar.tsx:2314, Google brand logo CollabLoginDialog.tsx:507 /
> SettingsPage.tsx:860, coffee cup AboutDialog.tsx:125) are not control faces and
> were excluded.

All paths below are relative to `frontend/src/components/` unless noted.

---

## 1. fullscreen — Fullscreen / expand (4 icons)

Same visual verb at three scopes (window takeover, card enlarge, section
maximize). Flagged together per the judgement rule; the scope notes are on each
entry so you can keep a distinction on purpose if you want one.

| Option | Identity | Used at |
|---|---|---|
| A | `⛶` text glyph (U+26F6) | Characters window/dock header action "Fullscreen" — CharacterProfiles.tsx:73 (`CharWindowActions`, rendered by ToolDock.tsx:431 window header and :750 dock row); legacy slide-in overlay "Fullscreen" — CharacterProfiles.tsx:1342 |
| B | react-icons/fa `FaExpandAlt` | Character card "Expand this character into a larger window" — CharacterProfiles.tsx:1540 (`char-profile-enlarge-btn`) |
| C | inline SVG, diagonal arrows out | Scenes—Cards board "Fullscreen" — IndexCards.tsx:626 (`ic-fullscreen-btn`); 12px variant "Expand synopsis" — IndexCards.tsx:718 |
| D | `⤢` text glyph (U+2922) | Outline "Maximize section" — BeatBoard.tsx:1502 (`beat-column-maximize`) |

Exit faces are equally scattered (not separate picker options — whichever enter
icon wins should get a matching exit): diagonal-arrows-in SVG "Exit fullscreen"
IndexCards.tsx:621; `⧉` (U+29C9) "Restore section" BeatBoard.tsx:1502; `×`
"Return to editor" CharacterProfiles.tsx:1321; `LuUndo2` "Return to Editor"
ribbon section Toolbar.tsx:1940 and 1959 (Scrapbook and Characters takeovers).

## 2. close — Close / dismiss (4 icons)

| Option | Identity | Used at |
|---|---|---|
| A | `×` text glyph (U+00D7; written as `×` or `&times;`) | Every tool window "Close" — ToolDock.tsx:433 (`tool-window-close`); dialog corner `fs-dialog-x` — PreferencesDialog.tsx:691, MenuBar.tsx:2404 (help form), HelpReferenceDialog.tsx:137, CustomizePanelsDialog.tsx:970, ChangelogDialog.tsx:24, EditElementsDialog.tsx:345 + 384; ScriptStatistics.tsx:67; LocationDatabase.tsx:210; ScriptDiffView.tsx:71; TagsPanel.tsx:431 (panel) + 564, 596 (cancel pending); AssetViewer.tsx:69; AssetManager.tsx:353; FormatPanel.tsx:227 + 284; ScreenplayEditor.tsx:3947 (collab activity) + 4007 (save-failure dismiss); CharacterProfiles.tsx:1344 (overlay), 1644 (char modal), 1321 ("Return to editor"); CharacterImageOverlays.tsx:31; BeatBoard.tsx:1375 (close outline tab, `beat-tab-x`) |
| B | `✕` text glyph (U+2715) | Find & Replace bar close — SearchReplace.tsx:366 (`search-close-btn`) |
| C | react-icons/fa `FaTimes` | Zoom panel "Close" — ZoomPanel.tsx:62; Workspaces "Cancel"/"Keep it" — WorkspacesTool.tsx:76, 89; WorkspaceDialogs.tsx:187, 207 |
| D | react-icons/lu `LuX` | Design panel "Close" — DesignPanel.tsx:226 (`dz-close`); collapse the tool-window search field — ToolControls.tsx:226 |

## 3. search — Search (2 icons)

| Option | Identity | Used at |
|---|---|---|
| A | react-icons/fa `FaSearch` | Toolbar "Find & Replace (⌘F)" — Toolbar.tsx:1263 (registry uiIcons.tsx:184); TitleBar.tsx:42; Edit menu — MenuBar.tsx:1389; Open File search-field glass — OpenFile.tsx:198; (oddity, see §Oddities) View > Zoom % rows — MenuBar.tsx:1550–1556 |
| B | react-icons/lu `LuSearch` | `ControlSearch` magnifier in every tool window's Filter/Sort/View/Search cluster (Scenes, Characters, Notes, To-Do, …) — ToolControls.tsx:203, 209; Design panel search — DesignPanel.tsx:127 |

## 4. add — Add / new (3 icons + 2 scoped one-offs)

| Option | Identity | Used at |
|---|---|---|
| A | react-icons/fa `FaPlus` | File > New Script… — MenuBar.tsx:1303; Insert menu icon — uiIcons.tsx:153; Template editor "Add custom element" — TemplateEditorDialog.tsx:163 |
| B | `+` ASCII text | Customize "Show …" restore buttons — ContextMenuTab.tsx:81, ThemesTab.tsx:265, EditElementsDialog.tsx:186 + 248 + 315, CustomizePanelsDialog.tsx:469 + 863; ribbon edit "+ Add" / per-section "+" — Toolbar.tsx:1781, 1803; custom color "+" — CharacterProfiles.tsx:1254, SynopsisModal.tsx:150; "+ Label" text buttons — AddMenu.tsx:23 (default "+ Add Item"), StickyNotes.tsx:169 + 382, BeatBoard.tsx:1102 + 1104 + 1513, CharacterRelationshipsTab.tsx:53, CharacterProfiles.tsx:1096 + 1114, HighlightsTool.tsx:110, ThemesTab.tsx:305, CustomizePanelsDialog.tsx:523 + 528 |
| C | `＋` full-width plus (U+FF0B) | Outline Bar "Add a section or a beat" — OutlineBar.tsx:505 (also named in its empty-state copy, OutlineBar.tsx:639); Outline "New outline variation" tab — BeatBoard.tsx:1379 |

Scoped one-offs in the same family: `FaFolderPlus` "New section"
(NotebookTool.tsx:892) is a reasonable scoped add; `FaRegEdit` "New page"
(NotebookTool.tsx:893) is an ADD wearing an EDIT icon — see §Oddities.

## 5. delete — Delete / remove an item (4 icons)

The big collision: `×` and `✕` mean *delete* here and *close* in group 2 — the
same glyph closes a window and destroys a beat.

| Option | Identity | Used at |
|---|---|---|
| A | react-icons/fa `FaTrash` | Workspaces "Delete" — WorkspacesTool.tsx:94, WorkspaceDialogs.tsx:220; Template editor "Remove element" — TemplateEditorDialog.tsx:189 |
| B | react-icons/fa `FaRegTrashAlt` (outline) | Scrapbook tree delete (hover + context) — NotebookTool.tsx:763, 831 |
| C | `✕` text glyph (U+2715) | Note/To-Do card "Delete" — StickyCard.tsx:112, ScriptNotes.tsx:552; Scrapbook box delete — NotebookTool.tsx:385, 440, 494; Asset manager "Delete" — AssetManager.tsx:319; Title page remove image — TitlePageEditor.tsx:560–561 |
| D | `×` text glyph (U+00D7) | Outline "Delete beat"/"Delete section"/"Remove image"/"Remove preview" — BeatBoard.tsx:513, 1504, 561, 582, 245; character profile removes (voice/custom field/relationship) — CharacterProfiles.tsx:986, 1075, 1129; CharacterRelationshipsTab.tsx:83; Tags deletes (category/entity/occurrence) — TagsPanel.tsx:687, 723, 768; "Remove this highlight" — HighlightsTool.tsx:132; scene filter chip — SceneNavigator.tsx:1012; ribbon edit removes (item/align split/section/row split) — Toolbar.tsx:1740, 1815, 1836, 1873; Customize hide/remove rows — CustomizePanelsDialog.tsx:445, 843; EditElementsDialog.tsx:169, 232, 298; ContextMenuTab.tsx:66; ThemesTab.tsx:246 |

## 6. caret — Expand/collapse caret, disclosure (4 icons)

| Option | Identity | Used at |
|---|---|---|
| A | react-icons/fa `FaChevronRight`/`FaChevronDown` | Tool dock accordion — ToolDock.tsx:742; Scrapbook tree — NotebookTool.tsx:810; character profile sections — CharacterProfiles.tsx:1452 |
| B | react-icons/lu `LuChevronRight`/`LuChevronDown` | Every `ControlDropdown` trigger — ToolControls.tsx:79; Design panel groups — DesignPanel.tsx:144 |
| C | `▸` / `▾` text glyphs (U+25B8/U+25BE) | Menu-bar submenu arrows — MenuBar.tsx:2249; Scrapbook context submenu — NotebookTool.tsx:1252; script context submenu — ScriptContextMenu.tsx:865; Dictionary "Install from custom URL" disclosure — DictionaryConfigPanel.tsx:343; toolbar zoom-options caret (`▾`) — Toolbar.tsx:1334 |
| D | `▴` / `▾` text glyphs (U+25B4/U+25BE) | Tags: show/hide an entity's occurrences — TagsPanel.tsx:512 |

## 7. rename — Rename / edit (2 icons)

| Option | Identity | Used at |
|---|---|---|
| A | react-icons/fa `FaPencilAlt` | Workspaces "Rename" — WorkspacesTool.tsx:93, WorkspaceDialogs.tsx:213. (Also the Edit-menu icon uiIcons.tsx:148 and "Go to Last Edited" MenuBar.tsx:1393 / toolbarCommands.tsx:86.) |
| B | react-icons/fa `FaEdit` | File > Rename… — MenuBar.tsx:1340; toolbar "Rename" — toolbarCommands.tsx:33 |

## 8. settings — Settings / customize family (3 icons)

Overlapping territory rather than one exact action. The crisp collision:
**Customize** wears `FaWrench` on the toolbar button but `FaSlidersH` in every
menu entry. `FaCog` = Settings is internally consistent.

| Option | Identity | Used at |
|---|---|---|
| A | react-icons/fa `FaCog` | File > Settings… — MenuBar.tsx:1373; toolbar Settings — toolbarCommands.tsx:60; Settings "System" tab — PreferencesDialog.tsx:47 |
| B | react-icons/fa `FaWrench` | Tools menu — uiIcons.tsx:152; toolbar "Customize" big button — uiIcons.tsx:160 |
| C | react-icons/fa `FaSlidersH` | View > Customize… — MenuBar.tsx:1402; "Customize Themes…" / "Customize Elements…" — MenuBar.tsx:1536, 1589; Settings "General" tab — PreferencesDialog.tsx:42; Design tool icon — ToolDock.tsx:131 |

## 9. check — Confirm / checkmark (3 icons)

| Option | Identity | Used at |
|---|---|---|
| A | react-icons/fa `FaCheck` | Workspaces "Save name"/"Confirm delete" — WorkspacesTool.tsx:75, 88; WorkspaceDialogs.tsx:184, 204 |
| B | react-icons/lu `LuCheck` | Design panel "Copied" state — DesignPanel.tsx:159 |
| C | `✓` text glyph (U+2713) | custom menu checkmarks — MenuBar.tsx:2278, 2296; "✓ " label prefixes on checked menu items — MenuBar.tsx:1362, 1438–1440, 1550–1556, 1700; NotebookTool.tsx:1141, 1199; ScriptContextMenu.tsx:743; "Copied ✓" — DiagnosticsDialog.tsx:107; "✓ Add here" — DictionaryConfigPanel.tsx:74; completeness tooltip ✓/✗ — CharacterProfiles.tsx:1528; mobile format sheet CSS — `styles/screenplay/14-mobile-format.css:147, 217` |

## 10. copy — Copy (3 icons)

| Option | Identity | Used at |
|---|---|---|
| A | react-icons/fa `FaCopy` | Edit > Copy — MenuBar.tsx:1385; toolbar Copy — toolbarCommands.tsx:66 |
| B | react-icons/lu `LuCopy` | Design panel "Copy CSS" — DesignPanel.tsx:159 |
| C | `⧉` text glyph (U+29C9) | Snippet card "Copy to clipboard" — StickyCard.tsx:206. (Same glyph means "Restore section" in BeatBoard.tsx:1502 — a glyph serving two functions.) |

## 11. visibility — Show / hide, the eye (3 icons)

| Option | Identity | Used at |
|---|---|---|
| A | react-icons/fa `FaEye`/`FaEyeSlash` (solid) | password reveals — CollabLoginDialog.tsx:381, 446, 467; ResetPasswordRoute.tsx:122, 144; View menu icon — uiIcons.tsx:151; Preview — MenuBar.tsx:1440, TitleBar.tsx:39, toolbarCommands.tsx:55; Working Notes show/hide — MenuBar.tsx:1478, 1508, 1516 |
| B | react-icons/fa `FaRegEye`/`FaRegEyeSlash` (outline) | Scrapbook declutter toggle — NotebookTool.tsx:890 |
| C | inline SVG eye / eye-slash | Tags panel show/hide tag highlights — TagsPanel.tsx:420, 422 |

## 12. undo — Undo / redo (2 icons)

| Option | Identity | Used at |
|---|---|---|
| A | react-icons/fa `FaUndo`/`FaRedo` | Toolbar — Toolbar.tsx:931, 945; Edit menu — MenuBar.tsx:1381, 1382; title bar — TitleBar.tsx:36, 37; registry — uiIcons.tsx:161, 162 |
| B | inline SVG undo/redo arrows | Scenes—Cards reorder mode "Undo (Ctrl+Z)"/"Redo (Ctrl+Shift+Z)" — IndexCards.tsx:574, 585 |

Related, left alone: `LuUndo2` is "Return to Editor" (Toolbar.tsx:1940, 1959) —
a different verb wearing an undo arrow.

## 13. reset — Reset / refresh (4 icons)

| Option | Identity | Used at |
|---|---|---|
| A | react-icons/fi `FiRefreshCw` | toolbar "resetSizes" (reset all sizes/spacing; Derek picked this one in v2.87 from a reference image) — uiIcons.tsx:198 |
| B | react-icons/lu `LuRotateCcw` | Design panel per-token reset + "Reset all" — DesignPanel.tsx:62, 156 |
| C | `↺` text glyph (U+21BA) | Outline card "Reset image size" — BeatBoard.tsx:555 |
| D | `⟳` text glyph (U+27F3) | Location DB "⟳ Discover" (rescan) — LocationDatabase.tsx:208 |

## 14. zoom — Zoom in / out (2 icon families)

| Option | Identity | Used at |
|---|---|---|
| A | react-icons/fa `FaSearchPlus`/`FaSearchMinus` | Zoom panel — ZoomPanel.tsx:55, 32; View > Zoom menu — MenuBar.tsx:1541, 1543, 1544, 1548; toolbar zoom % indicator — Toolbar.tsx:1305; mobile zoom — Toolbar.tsx:1532; fit/actual-size commands — toolbarCommands.tsx:78–80; registry — uiIcons.tsx:188 |
| B | `CirclePlusIcon`/`CircleMinusIcon` (app SVGs, uiIcons.tsx:88–97 — Derek's own artwork, v1.38) | toolbar zoom stepper "Zoom in"/"Zoom out" — Toolbar.tsx:1341, 1303 |

## 15. grip — Drag handle (3 icons)

| Option | Identity | Used at |
|---|---|---|
| A | `⠿` text glyph (U+283F braille) | Note/To-Do card grip — StickyCard.tsx:102, ScriptNotes.tsx:536; Customize rows "Drag to move" — CustomizePanelsDialog.tsx:237 |
| B | `⋮⋮` text glyph (U+22EE ×2) | Scrapbook boxes — NotebookTool.tsx:384, 439, 493; Scrapbook tree grabber — NotebookTool.tsx:743, 812 |
| C | `☰` text glyph (U+2630) | Outline beat card grip — BeatBoard.tsx:502, 536, 833 |

## 16. help — Help (2 icons)

| Option | Identity | Used at |
|---|---|---|
| A | react-icons/fa `FaQuestionCircle` (solid) | Help menu — uiIcons.tsx:155 |
| B | react-icons/fa `FaRegQuestionCircle` (outline) | Outline "How to use" — BeatBoard.tsx:1174; Goals "About" — GoalsTool.tsx:142; Customize help — CustomizePanelsDialog.tsx:72 |

## 17. back — Back / previous (4 icons)

| Option | Identity | Used at |
|---|---|---|
| A | react-icons/fa `FaArrowLeft` | Treatment editor back — TreatmentEditor.tsx:163 |
| B | `←` text glyph (`&larr;`) | Settings page "Go back" — SettingsPage.tsx:521–522; Tags "← Back to categories" — TagsPanel.tsx:651 |
| C | `‹` text glyph (U+2039) | ribbon add-menu "‹ Back" — Toolbar.tsx:2058 (its forward twin: "Add Item ›" — Toolbar.tsx:2054) |
| D | `◀` text glyph (U+25C0) | Find & Replace "◀ Prev" — SearchReplace.tsx:435 (paired "Next ▶" — :442) |

## 18. utility — Toolbar Divider / Spacer row icons (2 icon pairs)

A two-lists drift inside one dialog — exactly the pattern CLAUDE.md warns
about. The Panels/Toolbar tabs read the shared `UTILITY_ICONS` registry; the
Quick Access Toolbar tab hardcodes a different pair for the same two concepts.

| Option | Identity | Used at |
|---|---|---|
| A | `UTILITY_ICONS` registry: `FaMinus` (Divider) / `FaArrowsAltV` (Spacer) | uiIcons.tsx:27–30, read at CustomizePanelsDialog.tsx:420 (Panels & Toolbar tabs) |
| B | hardcoded: `FaGripLinesVertical` (Divider) / `FaArrowsAltH` (Spacer) | CustomizePanelsDialog.tsx:836, 837 (Quick Access Toolbar tab) |

---

## Intentionally different — confirmed rules, left alone

- **Double chevron `»` vs single chevron.** `DoubleChevronIcon` (uiIcons.tsx:45)
  means *move the window through the panel boundary*: pop-in ToolDock.tsx:417,
  pop-out ToolDock.tsx:715, collapsed-panel expand strips
  ScreenplayEditor.tsx:4074, 4242. The single chevron means *open/close in
  place* (dock accordion ToolDock.tsx:742 — the comment at ToolDock.tsx:740–741
  states the rule). Kept; group 6 only covers the single-chevron family.
- **`FaSave` vs `FaRegSave`** = Save vs Save As — solid/outline as a deliberate
  pair (TitleBar.tsx:32–33; toolbarCommands.tsx:52–53).
- **`FaDotCircle` / `FaRegCircle`** = active/inactive radio in the outline-tab
  pickers, consistent in both places (OutlineBar.tsx:546; BeatBoard.tsx:1353).
- **`FilterIcon`** funnel is already single-source (uiIcons.tsx:65) and used
  consistently (NavigatorTool.tsx:92; ListControls.tsx:50).
- **`LuLayoutGrid` / `LuList` / `LuWaypoints`** view-mode icons are consistent
  across Characters and Scenes (CharacterProfiles.tsx:113, 130;
  SceneNavigator.tsx:1065).
- **Red "A" text-color icon** — Derek's stated exception to monotone
  (uiIcons.tsx:176–178).
- **`FaLock` / `FaUnlock`** sizing-lock swap (uiIcons.tsx:194–195) and
  **UTILITY_ICONS** divider/spacer (uiIcons.tsx:27–30) — single-source.
- **`◀ Prev` / `Next ▶`** in Find & Replace are a matched prev/next pair;
  flagged only via group 17 because ◀ overlaps the "back" verb.

## Oddities and one-offs (not duplicate-function, but worth a look)

- **`FaRegEdit` = "New page"** (NotebookTool.tsx:893) — an add action wearing an
  edit icon, next to `FaFolderPlus` "New section" (:892).
- **View > Zoom % rows wear `FaSearch`** — the Find magnifier, not
  `FaSearchPlus` (MenuBar.tsx:1550–1556).
- **Emoji in UI** despite the monotone/no-emoji rule:
  - NavigatorTool.tsx:233 — note rows prefixed with the memo emoji (U+1F4DD).
  - AssetManager.tsx:163–168 — file-type emoji (frame/notes/clapper/page/memo/folder);
    :194 upload area (hourglass U+23F3 / up arrow U+2B06); :311 download button
    (U+2B07); :319 hourglass while deleting.
  - StickyCard.tsx:31, 33 — card title placeholders carry U+1F4AC and U+1F4C4
    (placeholder text, but visible in the UI).
- **`⊞` / `⊟`** (U+229E/U+229F) one-offs on Outline card images: "Fill card" /
  "Default size" — BeatBoard.tsx:549, 577.
- **`⌫` "Clear completed"** on To-Do cards — StickyCard.tsx:170 (backspace glyph
  meaning bulk-delete).
- **`✗`** (U+2717) in the completeness tooltip — CharacterProfiles.tsx:1528; the
  only ✗ in the app (everything else uses ×/✕).
- **`FaChevronUp`/`FaChevronDown` as "Move up"/"Move down"** (reorder, not
  disclosure) — WorkspaceDialogs.tsx:158, 161.
- **`▶ Start`** on Goals — GoalsTool.tsx:328, 348 (only media-play glyph in the
  app).
- **`FaBars`** floating menu button (hidden-mode FAB) — MenuBar.tsx:2196; and
  `FaEllipsisV` toolbar overflow "More formatting options" — Toolbar.tsx:1988.
  Two different "more/menu" glyphs, each used once.
- **Reverse duplicates** (one icon, several functions — the mirror problem):
  - `FaExchangeAlt`: Track Changes (MenuBar.tsx:1698; toolbarCommands.tsx:43)
    AND the ribbon Align Split marker (Toolbar.tsx:1814).
  - `⧉`: copy snippet (StickyCard.tsx:206) AND restore section
    (BeatBoard.tsx:1502).
  - `FaStream`: Outline tool icon (ToolDock.tsx:84), Outline Bar toggle
    (uiIcons.tsx:192; MenuBar.tsx:1450), View > Continuous (MenuBar.tsx:1439),
    Outline Bar's "open the Outline window" button (OutlineBar.tsx:532).
  - `FaSearchPlus`: zoom in AND "Scale to Max Width"/"Fit Page"
    (MenuBar.tsx:1548; toolbarCommands.tsx:78–79).
  - `FaColumns`: Project menu, Workspaces (all entries), Editor, Toolbars,
    panel toggles, Settings Customize tab (MenuBar.tsx:1413–1448;
    PreferencesDialog.tsx:44; uiIcons.tsx:154) — the everything-icon.
  - `FaListOl`: toolbar insertSection (uiIcons.tsx:164), Element submenu
    (MenuBar.tsx:1565), Insert Section AND Insert Marker (MenuBar.tsx:1594,
    1595).
  - `FaArrowsAltH`: Outline Bar "Fit" (OutlineBar.tsx:568) AND the QAT tab's
    Spacer row icon (CustomizePanelsDialog.tsx:837).

## Consistent already (checked, no flag)

Sort/Filter/View dropdowns (shared `ControlDropdown`/`AddMenu` text triggers),
the `swn-add-btn` "+ Label" convention inside panels (all ASCII +), scene
number `#` (`FaHashtag`) for Go to Page, `FaPaperclip` attach (BeatBoard.tsx:512),
`FaLink` link-beat-to-scene (BeatBoard.tsx:823), `FaFileExport` "Send to Script"
(OutlineBar.tsx:561), and the menu registry (`MENU_ICONS`/`TOOLBAR_ICONS`)
which is single-source by design.
