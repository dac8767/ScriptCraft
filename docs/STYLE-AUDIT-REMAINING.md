# What's Left From the Style Audit — in plain language

> **STATUS (v7.02):** Derek said "proceed with all of your recommendations", so
> items **1-10, 14, 15, 16 and 18** are DONE. What remains is at the bottom under
> "Still open after v7.02" — items 11, 13, 17, 19 plus a documented judgement
> call inside item 2.

Everything here was outstanding as of v7.01. Each item says **what's wrong**,
**where you'll see it in the app**, and **how it gets fixed**. No jargon.

Two parts:

- **Part 1 — I need a decision from you.** These change how something *looks*.
  Nothing is broken; it's inconsistent, and making it consistent means picking a
  winner. I've marked my recommendation on each.
- **Part 2 — No decision needed.** I can just do these. They're either invisible
  cleanups or clear-cut fixes.

---

# PART 1 — Decisions I need from you

## 1. Buttons at the bottom of windows are eight different sizes

**What's wrong.** The "OK / Cancel / Apply" style buttons at the bottom of
windows aren't the same size from window to window. They range from 28 pixels
tall up to 34, with text from 12pt up to 14pt. Side by side you'd see it
immediately; one window at a time, it just feels slightly *off*.

**Where you'll see it.** Open these and look at the buttons along the bottom:

| Window | How to open it | Button size today |
|---|---|---|
| Most dialogs | e.g. File ▸ Rename | 34px tall, 14pt — **the house standard** |
| New Script | File ▸ New Script… | 32px tall, 13pt |
| Guided Setup | the setup wizard | 32px tall, 13pt |
| Start screen | the launcher when no script is open | 30px tall, 13pt |
| Spell Check | Tools ▸ Spelling & Grammar ▸ Spell Check… | 30px tall, 12pt |
| Find & Replace | Edit ▸ Find & Replace | 28px tall, 12pt |
| "Are you sure?" boxes | any delete confirmation | 13pt, sized by padding |
| Annotation icon picker | Annotations ▸ pick an icon | 26px tall, 12pt |
| Rewrite tool key box | the Rewrite tool | 26px tall, 12pt |

**The fix.** Make them all the house standard (34px / 14pt).

**Your decision.** Two of these are arguably deliberate: Find & Replace is a
small floating panel, and the two popups are small by nature — full-size buttons
might crowd them. So:

- **Option A (my recommendation):** everything goes to 34/14, *except* Find &
  Replace and the two popups, which get an officially-named "compact" size
  (26px) that other small popups can also use. Two sizes total, each with a
  reason, instead of eight by accident.
- **Option B:** all nine go to 34/14, no exceptions.
- **Option C:** leave it.

---

## 2. Dropdown menus are seven different sizes

**What's wrong.** Every dropdown (the little menus you pick from) is its own
size — seven different heights, font sizes from 11pt to 13.5pt, and three
different corner roundings. There's no shared definition, so each one was
sized by hand whenever it was built.

**Where you'll see it.**

| Dropdown | Where | Height today |
|---|---|---|
| Element / Font / Size | the main toolbar | 22px |
| Scene filter | Navigator panel | 24px |
| View style | main toolbar | 26px |
| Toolbar "add item" | Settings ▸ Customize ▸ Toolbar | 26px |
| Page size fields | File ▸ Page Setup… | 28px |
| Sort | Characters tool | 28px |
| Filter | Asset Manager | 28px |
| Type | Help ▸ Feedback… | 30px |
| Settings dropdowns | Settings ▸ General | 32px |
| Scene filter | Scenes tool | 36px |

**The fix.** One shared dropdown definition, with a compact version for the
toolbar (where 22px is genuinely needed to fit the row). Everything else lands
on one size. I'd also add a proper focus outline — most dropdowns currently show
no highlight at all when you tab to them in the dark themes.

**Your decision.** Which size wins for the non-toolbar ones? I'd say **28px**,
because it's already the most common and it won't make the Settings window grow.
Say the word if you'd rather they all match Settings at 32px.

---

## 3. Text boxes inside dialogs come in two heights

**What's wrong.** Two ways of building a text field exist side by side: one is
34px tall and fixed, the other is 36px and adjustable from the Design window.
Same kind of field, two answers.

**Where you'll see it.** Anywhere you type into a dialog — Rename, Go To Page,
Save As. The difference is small but it means the Design window's "Input height"
slider only moves *some* of them.

**The fix.** Make both use the adjustable one, so your Design slider controls
every dialog text box. I'd keep 36px as the number since that's what the slider
already defaults to.

**Your decision.** Just confirm 36px is the height you want, or name another.

---

## 4. Window and section titles use fourteen different sizes

**What's wrong.** There's no title scale. Panel titles, window titles and the
smaller headings inside windows were each sized individually, so they don't form
a clear hierarchy — some section headings are *larger* than the window title
above them.

**Where you'll see it.** Panel/tool titles:

- Notes, Characters, Production Tags, Beat Board — 12pt
- Navigator, Locations — 13pt
- Outline bar — 11pt

Window titles:

- Standard dialogs — 16pt *(this one is already consistent everywhere)*
- Feedback window, Guided Setup — 15pt
- "Are you sure?" boxes — 14pt
- Start screen — 13pt

Section headings *inside* windows:

- Settings sections — 11.5pt, gray
- Customize sections — 13pt, full white
- About window sections — 13pt
- Preview sidebar, Page Setup lists, Customize toolbar zones — 11pt
- Design window — 13pt

**The fix.** Pick three sizes — one for window titles, one for panel titles, one
for section headings inside a window — and put every title on one of the three.

**Your decision.** I'd suggest **16pt window / 13pt panel / 11.5pt section**,
keeping the 16pt dialog title you already have. Also: section headings are
currently split about 50/50 between gray and full-white — pick one. I'd go gray,
since it keeps the heading quieter than the content under it.

---

## 5. There's a second, older Settings screen still in the app

**What's wrong.** An older full-page Settings screen still ships. Nothing in the
current app links to it, but the code and its styling are still there, and it
has its own look — 18pt section titles (vs 11.5pt in the real Settings window)
and its own "Reset Everything" button in a *different* red from the one on the
Defaults tab.

**Where you'll see it.** You can't reach it from the UI anymore — it's only at
the web address `/settings`. It's invisible dead weight rather than a visible
bug.

**The fix.** Delete it, along with its stylesheet.

**Your decision.** Delete it, or keep it for some reason I don't know about? I'd
delete — it's a second source of truth for settings, which is exactly the thing
that causes drift later.

---

## 6. Two icon families are mixed

**What's wrong.** The app draws icons from two sets: one heavier/solid, one
lighter/line-style. Twelve files pull from both. I already fixed the one place
where the *same* icon came from both sets (the Thesaurus search icon).

**Where you'll see it.** The magnifying-glass zoom buttons — on the Title Page
editor's preview and in View ▸ Scale to Max Width — are from the heavier set,
while most other line icons around them come from the lighter set. Side by side
the stroke weight differs.

**The fix.** Move the zoom magnifiers to the lighter set, and write down a rule
("solid icons for X, line icons for Y") so it stops drifting.

**Your decision.** Do you want the zoom magnifiers switched? And what's the
rule — I'd suggest line-style for everything in the chrome, solid only where an
icon is a colored marker (like the annotation glyphs).

---

## 7. Corner roundness varies on the same kinds of buttons

**What's wrong.** Most buttons have a 4-5px corner radius. Six kinds don't, for
no particular reason.

**Where you'll see it.**

- The tool icons down the side rail — 7px (rounder)
- Zoom panel buttons — 8px
- Welcome screen choices — 8px
- Sticky Notes "add" button — 6px
- Settings sidebar tabs — 6px
- Production Tags "create" button — 6px

**The fix.** Put them all on the house radius. (I'd leave the deliberate pill
shapes alone — the "Buy me a coffee" button and the round "?" help buttons.)

**Your decision.** Confirm you want them unified, and whether the house radius
is 4px or 5px. I'd say 5px — slightly softer, and it's what the newer parts of
the app already use.

---

## 8. The little up/down arrows exist as four separate copies

**What's wrong.** The tiny stacked up/down arrow control was built four separate
times. Two of the copies draw their arrows at 7px and two at 8px, so the same
control is visibly different depending on which window you're in.

**Where you'll see it.**

- Tool window controls (the number steppers) — 8px arrows
- Workspaces window, reordering saved layouts — 7px arrows
- *(the other two copies turn out to be dead code — see Part 2, item 16)*

**The fix.** One shared control at one size, used in both places.

**Your decision.** Just confirm — and whether you prefer the 7px or 8px arrows.
I'd take 8px; the 7px ones are hard to hit.

---

# PART 2 — No decision needed, I can just do these

## 9. Buttons in the dictionary windows are raw browser buttons

**What's wrong.** Fifteen buttons in the two dictionary windows were never given
the app's styling. In the dark themes they render as the operating system's own
gray buttons. (They *do* pick up a background in the Light theme only — which is
why this survived so long: someone checked in Light and it looked fine.)

**Where you'll see it.** Settings ▸ General ▸ **Grammar & Spelling** — the panel
that opens, plus the Dictionary Library window inside it. Switch to any dark
theme and the buttons look like they belong to a different application.

**The fix.** Give them the app's button styling, same as everywhere else.

---

## 10. Nine more unstyled buttons scattered around

**What's wrong.** Same problem as above, in smaller places.

**Where you'll see it.**

- The crash screen (if the app ever errors out)
- The demo banner
- Settings ▸ Customize ▸ Toolbar — the spacer-width buttons
- The mobile format panel
- The Grammar Rules panel header

**The fix.** Same — give them the standard button styling.

---

## 11. Controls don't inherit the app's text size

**What's wrong.** I fixed the *typeface* in v7.01 — every dropdown and text box
now uses the app's font. The *size* is still inconsistent: any control that
doesn't set its own size falls back to the browser's default, which is a hair
larger than the app's text.

**Where you'll see it.** Subtle. The clearest example is the Feedback window,
where the "Type" dropdown text sits slightly larger than the description box
beside it.

**The fix.** Force every control to inherit the app's text size. The reason I
didn't do it in v7.01: it resizes *every* control in the app at once, including
many that currently depend on the browser default, so it needs a careful pass
with fresh eyes on each window afterward. Best done as its own version so if
something shifts oddly you know exactly what caused it.

---

## 12. Two settings windows style their contents by hand

**What's wrong.** The two dictionary windows do their layout with styling
written inline, one element at a time — 68 separate hand-written blocks between
them — instead of using the app's stylesheet. That's why they drift: they're not
connected to the shared definitions, so they don't follow along when anything
changes.

**Where you'll see it.** Settings ▸ General ▸ Grammar & Spelling, and the
Dictionary Library. Same windows as item 9.

**The fix.** Move that styling into the stylesheet where everything else lives.
Best done together with item 9 since it's the same two files.

---

## 13. Six more windows have smaller amounts of the same problem

**What's wrong.** Same as item 12, less severe — hand-written styling that
should come from the stylesheet.

**Where you'll see it.** Notebook (22 spots), Title Page editor (13), the menu
bar (12), About window (12), Grammar Rules (11), Relationship Map and Beat Board
(10 each).

**The fix.** Same treatment. Lower priority — these are mostly positioning,
which is a legitimate reason to write styling inline.

---

## 14. Custom themes can't be checked for completeness

**What's wrong.** I added eleven more colors to the Themes editor in v7.01 so
custom themes can reach input fields, dialogs and the new state colors. But
there's nothing stopping the *next* color from being added to the app and
forgotten in the editor — which is exactly how the original gap happened.

**Where you'll see it.** You wouldn't — it's a guard against future drift.

**The fix.** A test that fails the build if a color exists in the app but isn't
editable in Themes (or isn't explicitly marked as deliberately not editable).

---

## 15. The new Themes entries need grouping

**What's wrong.** My eleven additions in v7.01 landed in the editor's list, but
the list is getting long.

**Where you'll see it.** Settings ▸ Customize ▸ Themes, editing a custom theme.

**The fix.** Group them under headings — Application, Text, Surfaces, State —
so it reads as a short set of sections instead of one long column.

---

## 16. Dead styling for controls that no longer exist

**What's wrong.** Two of the four up/down arrow copies from item 8 turn out to
have no code using them at all — the styling is orphaned. There are likely more
like this; nothing checks.

**Where you'll see it.** Nowhere — that's the point. It's weight in the file
that looks authoritative when you're reading the code.

**The fix.** Delete the orphans, and add a check that flags styling with nothing
using it, so this stops accumulating.

---

## 17. Overrides that may no longer be needed

**What's wrong.** In 80 places the styling uses a "force this, ignore everything
else" flag. Some are legitimate (printing genuinely needs it). Others were
band-aids for problems that the v7.01 token work has now fixed properly — they're
just sitting there, and each one makes the next change harder to reason about.

**Where you'll see it.** Not visible directly; it shows up as "why won't this
change take effect" later.

**The fix.** Go through the 43 in the responsive/mobile rules and the 21 in the
toolbar rules, remove the ones that are no longer doing anything, and note the
print ones as deliberate.

---

## 18. The two dropdown *menu* systems

**What's wrong.** The menu bar's dropdowns and the "script actions" dropdowns
are two separate systems with slightly different padding and their own red for
delete items. Each is internally consistent, so this is minor.

**Where you'll see it.** Compare the File menu against the ⋯ menu on a script
card.

**The fix.** Either converge them, or leave them and note that they're
deliberately different. I lean toward leaving them — they serve different
purposes and neither looks wrong.

---

## 19. Write the results down

**What's wrong.** Once items 1-8 are decided, the sizes and scales exist only in
my head and in the code.

**The fix.** Write the button sizes, dropdown size, title scale and corner
radius into the project notes, so the next change conforms instead of inventing
a new value. I already added the color and button rules there in v7.01.

---

## Suggested order

1. **Items 9, 10, 12** together — the dictionary windows are the worst-looking
   thing left, and they're all the same two files.
2. **Item 16** — deleting dead styling is free and makes everything after it
   easier to read.
3. **Whatever you decide from Part 1**, in whatever order you care about.
4. **Item 11** on its own — it touches every control in the app, so it deserves
   its own version.
5. **Items 14, 15, 17, 19** — the guards and the write-up, last.


---

# Still open after v7.02

**Item 11 — controls don't inherit the app's text size.** Deliberately left for
its own version: forcing it resizes every control in the app at once, including
the many that depend on the browser default today. It needs a window-by-window
look afterward, which is not something to bundle with sixteen other changes.

**Item 13 — the six windows with smaller amounts of hand-written styling**
(Notebook, Title Page editor, menu bar, About, Grammar Rules, Relationship Map,
Beat Board). The two worst offenders — the dictionary windows — are done. These
are mostly positioning, which is a legitimate reason to write styling inline, so
the payoff is smaller.

**Item 17 — the 80 "force this" override flags.** Needs case-by-case judgement
about which are still load-bearing after the v7.01 token work; a blind sweep
would break things silently.

**Item 19 — write the agreed scales into the project notes.** Waiting until the
numbers settle after you've seen v7.02 in the app.

**Inside item 2, one judgement call I made:** the Characters tool's profile
fields sit at 26px while the house dropdown is 28px. They're a coherent set that
track each other inside the profile meta rows, and a v4.26 note says the split
was deliberate, so changing them alters that tool's density rather than fixing
an inconsistency. I fixed the genuine bug there instead — the sort dropdown was
rendering at 22px in one place and 28px in another, the same control at two
sizes. Say the word if you want the profile fields moved to 28 as well.

**A finding from building the dead-styling check (item 16):** it reported **309**
styled classes that no component mentions — a hundred versions of accumulated
CSS. Deleting them is its own project and doing it blind is how you delete
something that turns out to be assembled at runtime, so the check records the
backlog and fails only on NEW dead styling. Three of the title rules I edited
for item 4 turned out to be in that backlog (`.script-notes-title`,
`.beat-board-title`, `.fs-tbzone-title`) — harmless, but they had no effect.
