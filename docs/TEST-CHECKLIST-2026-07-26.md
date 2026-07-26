# Manual test checklist — 2026-07-26

**136 changes across 50 versions** (v4.37 → v4.86).
Generated from `frontend/src/data/changelog.json` — every shipped line appears
here exactly once, so nothing can be quietly left off the list.

```
cd /Users/dcarl/ScriptCraft && npm run desktop
```

Tick as you go. If something is wrong, note the version number beside it —
that is enough to find the change and the reasoning behind it.

## v4.86

- [ ] A brand-new Scrapbook starts with one section holding one page, ready to write in — a Scrapbook you emptied yourself stays empty
- [ ] Menus: "Show …" items keep a stable label and carry a checkmark when they are on, instead of flipping between Show and Hide (Scene Numbers and all five Working Notes items now match Show Rulers)
- [ ] View menu: Customize… and Design… are gone — Customize is on the ribbon and Design is in the Tools list
- [ ] Fix: ampersands vanished from the native menu bar — "Spelling & Grammar" read as "Spelling  Grammar", "Find & Replace…" as "Find Replace…". Every menu label with an & is correct now
- [ ] A hidden side panel stays hidden: opening a tool that lives there floats it as a window instead of re-opening the panel, and it docks again once the panel is back
- [ ] Fix: clicking a ribbon tool button whose panel was hidden did nothing at all — it now opens the tool
- [ ] Window headers: fullscreen, shrink and close are full-height buttons on their own background — the whole strip is clickable, not a small square in the middle
- [ ] Popped-out windows have a visible hairline edge, so you can see where the window ends and the editor behind it begins

## v4.85

- [ ] A ribbon section title spans everything between two full-height dividers — join a two-row and a one-row section and the title centers over the whole block
- [ ] Toolbar tool buttons toggle: press once to open the tool, press again to close it
- [ ] The fullscreen "Return to Editor" button is gone — the window's × already does that
- [ ] The Scrapbook has a close × in its top-right corner like every other window (it still always fills the editor)
- [ ] Scrapbook: the empty list now reads "No items. Create a page or section to begin."

## v4.84

- [ ] Fix: reopening a tool from the side panel list forced it back into the panel, so no window ever remembered being popped out or fullscreen — the list now opens each tool in the shape you left it
- [ ] "Dialogue (Name)" is gone as its own element: the element list offers Dialogue and Dual Dialogue, and choosing Dialogue starts at the character name — Enter carries you into the speech
- [ ] Focus ▸ keep focus on current element treats a whole speech as one element, so the character name no longer dims while you write their line
- [ ] The Editor View value is centered in its dropdown
- [ ] Design ▸ Toolbar / Ribbon: a new "Space below section title" knob for the gap between a section's title and its buttons
- [ ] Presets: Workspaces can be exported and imported like the other presets
- [ ] View menu: Minimize is gone — it is window management, not a view of the script, and the yellow traffic light and Cmd-M still do it

## v4.83

- [ ] "Customize from a file" now also accepts an existing ScriptCraft script and copies its themes, page layout and format — it says which of those it found rather than implying it copied everything
- [ ] Guided Setup gained three steps: a safety-net step for auto-saved versions, a page setup step (paper and margins), and a preview on the format step showing how that kind of script actually reads

## v4.82

- [ ] Speed: the scene and character lists only rescan the script while a tool that shows them is open — they catch up the moment you open one, so typing in a long script does less work
- [ ] Scene numbers still update live whenever they're switched on, and character autocomplete still knows every name even with all tools closed
- [ ] Security: the last two dependency advisories are gone — react-router moved forward to v8 (npm's suggested fix was a downgrade to a version that is also affected)

## v4.81

- [ ] Tools reopen in the shape you last used them — side panel, floating window, or fullscreen
- [ ] The Start a Script window closes with Escape like every other dialog

## v4.80

- [ ] New Script now starts with a chooser: New Script (Manual Setup), New Script (Guided Setup), Open Script, or Import File
- [ ] Guided Setup walks you through naming, save locations, format, and one friendly page per Customize tab — with Next or "Skip for now" on every step, and a reminder that all of it can be changed later
- [ ] The Guided Setup's customize pages show the REAL Customize controls under plain-language explanations, so anything you change in Customize appears here automatically
- [ ] Manual Setup gained a "Save to" field (pre-filled with the destinations your last script used) and lost the Open/Import buttons — those live on the chooser now
- [ ] Both setups can copy a look and layout from a customizations preset file

## v4.79

- [ ] New Presets window (File ▸ Export ▸ Presets… and File ▸ Import ▸ Presets…) and a matching Settings ▸ Presets tab: export or import a Full Preset (everything the app remembers), Customizations, Settings, Themes, and Outline Presets
- [ ] Customize footer: Export… and Import… buttons — the import warns first, because it replaces every current customization choice
- [ ] Every preset export names its type at the end of the file — _preset, _customize, _settings, _theme, _themes, _outline-presets
- [ ] File ▸ Open no longer has a submenu: it opens the Open window, which gained a "Browse This Computer…" button; Import and Export now sit next to each other
- [ ] Fix: the Customize window's Cancel silently kept context-menu, element-suggestion, panel-scale and panel-name changes — its revert list had drifted behind the tabs

## v4.78

- [ ] Fullscreen tool windows have a shrink button (left of the ×, title-bar style) that drops them back to a floating window
- [ ] A closed tool can be dragged straight out of the side panel into a floating window — it no longer needs to be open first

## v4.77

- [ ] Spelling: misspelled words get the standard red squiggly underline as you type, ON by default — turn it off per script (Tools ▸ Spell Check) or app-wide (Settings ▸ General)
- [ ] Spelling: words in ALL CAPS — character names, scene headings, locations — are never spell-checked
- [ ] Fix: opening a script from a local file ignored the app-wide spell-check default; both open paths now follow one rule

## v4.76

- [ ] About: every link opens in your default browser, instantly — they used to stall (or never open) inside the app window
- [ ] About: the open-source credits are audited against the real dependencies — html2canvas-pro (screenshots) and pdf.js (PDF import) joined the list, and keeping it current is now part of adding or removing a library

## v4.75

- [ ] Ribbon: the vertical divider between sections is removable (edit mode: hover it, click the ×) — a two-row and a one-row section can sit flush; a dashed ghost in edit mode brings the divider back
- [ ] Ribbon + menu: "Divider — one row" and "Divider — two rows" replace the single Divider entry

## v4.74

- [ ] Title Page: "Sync Title from Project" sits above the Title row, and the duplicated "Title Page" caption inside the window is gone (the window's own header keeps the name)
- [ ] Title Page: the PLACE IMAGE row is replaced by the character tool's "+ Add Image" box — clicking offers the same sources (local device, and Asset Manager when a project is open); each image's Top/Bottom placement appears once it exists
- [ ] Title Page: both Title Size menus lead with "Default", which applies the built-in size and then reads as the number
- [ ] Title Page: the preview is TO SCALE now — a real 8.5×11 page built from the exact blocks Apply inserts — with zoom in/out and Fit buttons

## v4.73

- [ ] Fix: opening Help ▸ What's New crashed the app — every entry written since v4.53 was in a newer list format the window didn't understand; it now reads both formats

## v4.72

- [ ] Page numbers sit exactly where the margin diagram says: resting on the line half an inch from the top of the page, centered between the right margin line and the half-inch line (0.75" from the right page edge)
- [ ] PDF export places the page number on those same lines (it was 12 points low and hugged the margin line)
- [ ] Header and footer lines follow the live Page Setup margins — they were anchored to a stale fixed-layout value
- [ ] Continuous view: the ruler's numbering now resets each page-length through the trailing white space after the script's last line, with the same dotted divide, instead of counting up forever

## v4.71

- [ ] Ribbon toolbar: toggle buttons (panels, rulers, scene numbers and their lock, revision mode, track changes) now highlight while they're on — the same treatment Bold and Italic get
- [ ] Ribbon toolbar: section titles are gray
- [ ] Design tool: ribbon section title size, alignment, and padding are adjustable (Toolbar / Ribbon group)
- [ ] New in Settings ▸ General: "Reopen windows on their last used tab" — tabbed windows (Settings with its Customize tabs, Characters, Production Tags) come back where you left them; turn it off to always open on the first tab

## v4.70

- [ ] Feedback window: screenshot buttons in its header — the capture appears as a chip above the form, and dragging its thumbnail into the form's attachment field uploads it (the form is an embedded page, so that one drag is the direct path in); Save keeps the PNG as a fallback
- [ ] Screenshots work again everywhere: the capture library couldn't read the app's modern CSS colors and every capture failed — replaced with a maintained fork

## v4.69

- [ ] Window headers: the vertical divider is gone — fullscreen and close are now distinct bordered buttons, title-bar style
- [ ] The close × is scaled so its drawn ink matches the fullscreen square's height

## v4.68

- [ ] Parenthetical is allowed after dialogue in the default suggestions — a (beat) can sit between dialogue lines
- [ ] Typing ( while writing dialogue starts a parenthetical: on the next line at the end of a written line, in place on an empty one; mid-text it stays a normal character

## v4.67

- [ ] The condensed tab dropdown now wears the same blue active-tab pill, showing the active tab's name
- [ ] Widening a window or panel reliably restores the full tab strip (the width watcher could get orphaned by a header re-render)

## v4.66

- [ ] Every Shown/Hidden table in Customize: Show All sits right-aligned in the Shown header, Hide All in the Hidden header (created where they were missing; the old standalone buttons moved up)

## v4.65

- [ ] Every Customize tab ends in a Reset to Default section (Reset Size / Reset Items, plus the content resets in Editor); the scattered reset buttons moved there
- [ ] Fixed: resetting the side panels now restores the panel width AND the vertical tool scaling
- [ ] New Settings > Defaults tab compiling every reset in one place — Reset All moved there from the Customize globals
- [ ] Enter at the end of a dialogue line no longer auto-opens the element suggestions — the new Action line just waits; a second Enter brings them up
- [ ] Tab on an empty line converts it in place — no more stray blank row between a character name and the parenthetical Tab creates

## v4.64

- [ ] Settings: the Customize tabs are listed directly in the sidebar under a Customize heading — one less submenu level (the old Customize tab is gone)
- [ ] Element Suggestions: hidden elements lose their table column; a Show: label fronts the Script-Aware / All Elements toggle
- [ ] Customize > Editor: Mores & Continueds changes apply live — the Apply button is gone
- [ ] Locking customizations now also locks content below the fold (the Element Suggestions table included)
- [ ] Dragging a tool out of the side panel snaps it to the classic popped position, touching the panel edge

## v4.63

- [ ] "Dialogue (character)" is now "Dialogue (Name)" everywhere
- [ ] The Element Suggestions rules are a real table — one row per element, one check cell per allowed follower
- [ ] Customize > Editor: Mores & Continueds moved to the top of the tab

## v4.62

- [ ] Stability and security pass: dependency security fixes, a crash-recovery screen with a Reload button instead of a white screen, and a cleaner build (see docs/AUDIT-2026-07-26.md)

## v4.61

- [ ] Three explicit dialogue options everywhere: Dialogue, Dialogue (character) — the name line, shown where Character used to be — and Dual Dialogue
- [ ] Picks now apply their element directly: choosing Dialogue gives dialogue, choosing Dialogue (character) gives the name prompt (the implicit conversion is retired); Tab on an empty line still starts at the name

## v4.60

- [ ] Customize > Editor: the Editor Views section is removed, and the Elements section moved into its place — the two element sections now sit together

## v4.59

- [ ] The element suggestions now follow the full follows-what grammar table (Scene Heading → Action/Dialogue/Dual Dialogue; Action → those plus Scene Heading and Transition; after a name → Parenthetical/Dialogue; after a parenthetical → Dialogue; after dialogue → Action/Scene Heading/Dialogue/Dual Dialogue/Transition; after a transition → Scene Heading/Action)
- [ ] Customize > Editor > Element Suggestions: choose Script-Aware (the pared-down list) or All Elements, and edit the follows-what rules yourself — the table above is the default, with a Reset to Default

## v4.58

- [ ] The element suggestions now follow script grammar: after a scene heading only Action, Dialogue and Dual Dialogue are offered; Parenthetical only right after a character name; Transition only after action or dialogue (dual or single)
- [ ] Working-note lines (sections, markers, to-dos) are skipped when reading that context — the suggestions key on the real script element above

## v4.57

- [ ] Enter at the end of a written dialogue line skips a line and immediately shows the element options
- [ ] Tab on an empty far-left line moves the cursor over and starts a dialogue — beginning at the character-name prompt, per the couplet rule

## v4.56

- [ ] When the caret is in an empty dialogue line right under a character name, the Enter-key element list leads with Parenthetical

## v4.55

- [ ] Deleting either paren of a parenthetical now removes the whole row (typing over the selected row still re-wraps, and undo restores the row in one step)
- [ ] Backspace at the start of the line below a parenthetical no longer merges it into the row — the boundary is locked
- [ ] Fixed: the character-name autofill did not appear when Dialogue was chosen from the Enter-key element picker (the opening click was dismissing it instantly)

## v4.54

- [ ] Parenthetical rows keep their parens as the first and last characters — Enter (and Tab) now drop straight into a fresh dialogue line below instead of dragging the closing paren down; deleting an edge paren repairs it in place
- [ ] Character is no longer an element option: choosing Dialogue on an empty line starts at the character-name prompt (a name always precedes its dialogue) — the in-script flow is unchanged
- [ ] The ruler grays out sections, markers and to-do lines (they take no space in the final document) and resumes its numbering right where it left off beneath them
- [ ] Section / marker / to-do line styling now updates live as you type the token (was stale until the line re-rendered)

## v4.53

- [ ] Tool-specific controls now lead the window control cluster — Scenes reads Reorder, Filter, View, Search
- [ ] Two-stage header overflow: tabs condense into a dropdown first, and the row only wraps to a second line if it is still too crowded
- [ ] Distinct Toggle Left Panel / Toggle Right Panel icons (filled-side pair) so the two are no longer identical

## v4.52

- [ ] **One color scheme in every shape — for real this time** — The Scenes family (Scenes, Pages, Locations) painted the side-panel shade inside windows while fullscreen showed the body shade. Tool embeds paint nothing of their own now — the window body's surface is the one background docked, popped out, and fullscreen. A full tool-by-shape audit drove the fix.
- [ ] **Scene rows center their content** — The scene number and heading were hugging the top of the row's highlight; they sit dead-center now (expanded rows keep the badge beside the heading).
- [ ] **Narrow windows stay floating** — The old rule that popped a floating window back into the side panel whenever it was resized narrow enough is retired. Where a window lives is explicit now — it only docks when you drop it on a panel, and only floats when you pull it out. Existing windows keep their current homes.
- [ ] **Characters: 'Script' tab** — The 'From Script' tab is named 'Script' now, and the redundant 'Scan Script (0)' heading line is gone — the explainer text carries the context.

## v4.51

- [ ] **Scenes cards fill the window** — The cards area was capped at half the screen height — a relic of the old cards-strip-above-the-editor layout — leaving dead space between the content and the window's edge. It now fills whatever hosts it (window, dock, or fullscreen) exactly, scrolling inside.

## v4.50

- [ ] **Character cards size to their content — and the view scrolls** — In cards view the grid rows were binding to the window height, slicing every card to an equal clipped share of the editor area (worst in fullscreen) with no way to scroll. Rows now size to their content: cards are as tall as they need to be, and the view scrolls vertically when it's longer than the window. The 'min card height' Design knob is back too — as a minimum content can always exceed, with 0 meaning purely content-sized.

## v4.49

- [ ] **One surface pattern across every theme** — The dark theme's lightness ladder — status bar darkest, then panels and window headers, then the body and editor canvas, then cards, menus, and the ribbon toolbar lightest — now holds in every theme. Light and Solarized Light had panels lighter than the body, Sepia and Dracula had the toolbar darker than it, and the Light theme's editor canvas was a special-cased gray; all corrected in each theme's own hue, and a test now fails any future theme edit that inverts a relationship.

## v4.48

- [ ] **Window header color** — Window headers wear the side-panel surface (#252525 in the dark theme) — the matching token keeps every other theme coherent.

## v4.47

- [ ] **Name-to-tabs spacing knob; darker headers** — Design → Panels & Windows gained 'Space after window name' — the air between a window's title and its tabs. And window headers now wear the status bar's surface color instead of the ribbon's, giving the top of every window (floating and fullscreen) the app's darkest chrome shade.

## v4.46

- [ ] **Header padding: four individual sides** — The Design tool's window-header padding is four knobs now — top, bottom, left, and right, each on its own slider — driving the header in every shape (the docked strip keeps its slightly tighter defaults until a knob moves). A previously saved value of the old single knob carries over into top and bottom automatically.
- [ ] **Half-pixel hairlines** — All the faint edge lines — panel edges, ribbon top/bottom, header dividers, the controls divider — are 0.5px now: a single hardware pixel on Retina displays. One width token drives them all.

## v4.45

- [ ] **Three new Design knobs for window chrome** — Panels & Windows grew: 'Space above window content' (the air between the header bar and the first item — docked, popped out, and fullscreen alike), 'Header bar font size' (the Filter/Sort/View controls and tabs; the title keeps its own knob), and the existing header-padding knob now also drives the docked window's header strip.
- [ ] **Divider in the docked header too** — The line between the search/controls cluster and the fullscreen button now appears in the side-panel window's header strip, matching the popped-out and fullscreen headers.

## v4.44

- [ ] **Fullscreen sits flush** — The gaps beside and above a fullscreened window are gone: the panels' 6px breathing margin (there for the editor's scrollbar and grab edge) is suspended while a tool owns the editor area, and the menu/toolbar resize strip no longer paints its faint band across the top — it's invisible until hovered, with the same grab area.
- [ ] **Window bodies match the editor area** — Window backgrounds moved from the side-panel shade (#252525 in the dark theme) to the editor area's shade (#2b2b2b) — in fullscreen, popped out, and docked alike, so all three shapes stay identical.

## v4.43

- [ ] **Fullscreen and close, finally level** — The close button was a font glyph seated by the system font's baseline — beside the geometric fullscreen square it drifted a hair on the Mac no matter how the boxes lined up. It's an SVG twin of the × now, and both buttons share one fixed 20×20 box with the icon dead-centered: pure geometry, identical on every platform, with a matching honest hit area.

## v4.42

- [ ] **Header polish** — The fullscreen button's icon sat on the text baseline, a hair low next to the close button — it's flex-centered now, dead level with the ×. And window headers wear the same surface color as the ribbon toolbar.

## v4.41

- [ ] **Drag-out you can see** — Pulling a docked window out shows a title-bar ghost riding the cursor. Over the editor area it arms with the accent color — release there and the window lands right where you dropped it. Release anywhere short and the tool stays docked. Both the accordion row and the window's header strip are grab handles now (with the cursor to match), and no more text gets highlighted mid-drag — selection is suppressed for the whole gesture, with the WebKit-prefixed rule the Mac build needed.
- [ ] **Characters looks the same in every shape** — The fullscreen Characters view had its own flat, borderless, darker styling. That restyle is gone: docked, popped out, and fullscreen all render the same bordered rows and cards on the same background. The cards view is one responsive grid — one column in a narrow panel, more columns as the window widens. (The fullscreen-only 'min card height' Design knob retired with it.)
- [ ] **Ribbon hairlines** — The same faint edge line the side panels wear now runs along the top and bottom of the ribbon toolbar.

## v4.40

- [ ] **Side-panel windows look like themselves again** — The v4.39 merged header cramped everything onto the accordion row in the panels — docked windows are back to the compact row (name and count) with tabs and controls on their own strip inside the window. The strip wraps when the column is narrow. Floating windows and fullscreen keep the new single-row header.
- [ ] **Undocking takes a real drag now** — A docked window only pops out when you drag its header all the way into the editor area — a small tug does nothing and it stays in the panel. Dropping a floating window on a panel still docks it.
- [ ] **The faint lines are actually visible** — The sidebar's outer edge and the line between a window's header and its body were drawn in a border color nearly identical to the surfaces — invisible. They now use a hairline derived from each theme's text color, so the seams read faintly in every theme, Airtable-style. Also: more space between the window name and the tabs, and between the controls and the fullscreen/close buttons.

## v4.39

- [ ] **One-row window headers** — The two chrome rows in every window are now one: tool name, count, and tabs on the left; Filter / Sort / View / Search, a divider line, then Fullscreen and Close on the right. The same row appears docked, popped out, and in fullscreen. When the window is too narrow, excess items wrap onto a second line instead of collapsing into a dropdown.
- [ ] **Dock and undock by dragging** — The pop-in and pop-out buttons are gone. Grab a docked window's header and pull it out of the panel to float it; drag a floating window over either side panel — the panel highlights — and release to dock it there (even a window that lived on the other side, or one opened from the Tools menu).
- [ ] **Panel edges and header dividers** — Side panels keep a faint edge line against the editor and every window header is divided from its body by the same line, Airtable-style. Unselected tab labels went back to the muted gray.

## v4.38

- [ ] **Fullscreen is a square; expand is arrows** — The fullscreen button in every window and dock header now wears the square four-corners icon (the audit's former option), while the diagonal arrows are reserved for controls that enlarge one piece of content — expanding a character card, a synopsis, or an Outline section. Two different verbs, two different faces.

## v4.37

- [ ] **The note color picker is readable on any card** — The little color circle used to vanish on dark note cards (a dark fill on a dark background). It now wears a contrast ring picked by the same dark/light system the Outline's cards use for their text: white outline on a dark surface, near-black on a light one. The script-note popover's picker gets the same treatment.
- [ ] **Note card foot: date left, resize grabber right** — The created date moved to the left end of the card's foot and a proper resize grabber sits at the right end — drag it to make the writing area taller. The grabber paints the shared corner-stripes indicator, inked black or white to stay visible on whatever color the card is.
- [ ] **One color scheme for every window shape** — A window now looks the same docked, popped out, and fullscreen: the title row is the darker app shade and everything below it sits on the panel shade. Before, the fullscreen takeover's body went darker than the same tool's window, and the windowed title bar didn't have the fullscreen header's contrast.
- [ ] **A window can never be open twice** — Opening a tool that already owns the fullscreen view no longer floats a second copy of it — the open lands on the fullscreen it already has. Explicitly seating that tool in a side panel brings it out of fullscreen instead of duplicating it, and applying a workspace always returns to the regular layout first.
- [ ] **Quieter, brighter window toolbars** — The ⌄ carets are gone from the in-window dropdown triggers (Sort, Filter, View, Cards…), and the toolbar controls and tabs now use the full text color for each theme instead of the muted gray.
- [ ] **Apply closes the theme color picker** — In Customize Themes, clicking Apply commits the custom color and closes the picker popover in one go. The preset swatches still keep it open so colors can be tried live.
- [ ] **No gap between the ribbon and the side panels** — The 6px strip under the toolbar (the drag handle for resizing the menu bar and toolbar together) no longer takes up a band of its own — it overlays the top edge of the panels, so they sit flush under the ribbon and the handle is still grabbable when unlocked.

