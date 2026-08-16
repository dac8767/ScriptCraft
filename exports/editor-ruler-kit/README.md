# Editor Ruler Kit

Word/Docs-style rulers for a scrolling page editor, extracted from ScriptCraft
(a screenwriting app) so another app can reproduce them exactly.

**If you are a Claude session that has just been handed this folder: read this
file top to bottom before writing code.** The component is only 380 lines and
it will look like you could rewrite it from the screenshot. You could not. The
vertical ruler's numbering rules were corrected a dozen times against a real
screenwriting app, and at least four of them look like bugs until you know why
they are there. They are listed in §5.

```
EditorRulers.tsx     the component — React + TypeScript, no other dependencies
editor-rulers.css    the complete stylesheet, four rules
example-host.tsx     the minimum host that makes it correct
README.md            this
```

---

## 1. What it is

Two `<canvas>` rulers pinned to the top and left edges of a scrolling page
editor. The horizontal one measures the page across; the vertical one numbers
each page down and restarts at every page, like Word.

Everything is **measured off the live DOM** — the ruler duplicates none of the
host's layout math. It reads the page element's rect against the scroll
container's rect, and the page-break separators' rects, and derives every mark
from those. That is why it stays correct through scrolling, zooming, page-size
changes, and content edits without being told about any of them.

It is **read-only chrome**: no drag handles, no indent markers, no
interaction. `aria-hidden`, and it never takes pointer events.

## 2. Drop-in usage

```tsx
import EditorRulers from './EditorRulers';
import './editor-rulers.css';

<div className="editor-main" ref={scrollRef}>      {/* position: relative! */}
  <EditorRulers
    container={scrollRef}
    continuous={viewMode === 'continuous'}
    layout={{ pageWidth: 8.5, pageHeight: 11,
              topMargin: 72, bottomMargin: 72,     // POINTS
              leftMargin: 1.5, rightMargin: 0.7 }} // INCHES
    zoom={100}
    units="in"
    pageCount={pages.length}
  />
  <div className="page-sizer"> …your pages… </div>
</div>
```

**The units asymmetry is real and deliberate**: `topMargin`/`bottomMargin` are
in POINTS (72/inch), `leftMargin`/`rightMargin` are in INCHES. It comes from
the file format this was built for. The component divides the vertical pair by
72 and multiplies the horizontal pair directly. If your app stores all four the
same way, convert at the call site — do NOT "fix" it inside the component
without changing both uses, or the vertical margins land 72× wrong and the
shading covers the whole page.

## 3. The host contract

The ruler measures these. Every one is a selector you can override via the
`selectors` prop, but the SEMANTICS are fixed — get these wrong and the ruler
is confidently, invisibly wrong.

| Selector | Must be | Why the ruler needs it |
|---|---|---|
| `.page-sizer` | The element whose **top-left corner is page 1's top-left corner** | The origin for every mark, x and y |
| `.page-sep` | One per page boundary, positioned at that page's **end of content** — the top of its bottom margin, NOT the page's bottom edge | Page view: each page's scale is anchored to its measured boundary, so no drift accumulates over 120 pages |
| `.page-sep-line` | One per compressed gap in continuous view, spanning **last row of a page → first row of the next** | Continuous view: where the numbering restarts |
| `.ol-section, .ol-marker, .ol-todo` | Rows that occupy screen space but are **dropped from the printed document** | The count pauses over them (§5.3) |

Also required:

- **The scroll container is `position: relative`** and is the element that
  actually scrolls (`overflow-y: auto`).
- **The ruler is the FIRST child** of the scroll container, before the pages.
  It is `position: sticky`; if it comes after the content its sticky origin is
  wrong and it will drift as you scroll.
- If your app has no equivalent of the note rows, pass a selector that matches
  nothing (`selectors={{ noteRows: '.nothing' }}`) rather than deleting the
  code — the band logic is load-bearing for the rest of the scale.

## 4. The geometry, stated plainly

- `inPx = 96 * zoom` — CSS pixels per inch. 96 is the CSS definition of an
  inch and does not vary by display; device pixel ratio is handled separately,
  by scaling the canvas backing store (`c.width = w * dpr` + `setTransform`).
- `unitPx = inches ? inPx : inPx / 2.54`, minor ticks at ¼ unit for inches and
  ½ unit for centimetres.
- Tick lengths from the ruler's inner edge: whole = a NUMBER (not a tick),
  half = 7px, quarter = 4px. Numbers are 9px `system-ui`, centred in the
  20px band.
- Everything is drawn at `Math.round(v) + 0.5` so a 1px line lands on a pixel
  boundary instead of straddling two and rendering as a 2px blur.
- Margin zones are shaded `rgba(127,127,127,0.16)` — a grey that reads
  correctly on both light and dark themes without knowing which it is on.
- Tick/number colour is `getComputedStyle(canvas).color`. A canvas cannot read
  CSS custom properties, so the CSS sets `color` on `.fs-ruler` and the
  component inherits the theme through it. **Restyle via the CSS.**

### The two vertical models

**Page view** — each page gets a full `0..pageHeight` scale. Top and bottom
margins are shaded ON TOP of that numbering, not added to it: an 11" page
reads 0 at the paper's top edge and 11 at its bottom edge, with 0–1 and 10–11
greyed. Page tops come from `previous page's separator + bottomMargin + gap`,
all measured.

**Continuous view** — inter-page margins are compressed to a dashed gap, so
the first text row of every page sits at the **1" mark**: each region numbers
1, 2, 3… down to ~10 at the content bottom. The dashed divide sits 0.25"
below that "10", and the next page's "1" sits 0.25" below the divide — a 0.5"
breather so consecutive pages never visually stack. Page 1 is the exception: it
renders its real top margin, so it also shows 0" at the physical top with 0–1"
shaded. **No other shading in continuous** — deliberate, keep it clean.

## 5. The four things that look like bugs

Do not "clean these up".

**5.1 The terminal label escapes the clip.** In `drawTicks`, when a mark falls
past `clipBottom`, the loop still draws it if it is a whole unit within 0.4"
of the boundary — but never a tick, and never the next number. Without this,
sub-pixel rounding drops the last number ("11" in page view, "10" in
continuous) on *some* pages and not others, so the ruler looks fine until you
scroll to the page where it doesn't. The `terminal` flag exists so this only
applies to a region's final segment.

**5.2 The continuous tail invents page divides.** After the last real
`.page-sep-line`, the numbering used to run 11, 12, 13… down the trailing
whitespace forever. Instead the tail continues the *rhythm*: virtual divides at
the span the real pages actually measured (falling back to the layout's content
height when the document has no divides yet), each resetting the count exactly
like a real page, each drawing its own dotted line. The 400-iteration guard is
a runaway stop, not a limit you should raise.

**5.3 The scale skips "note" rows.** Rows that are dropped from the printed
document take screen space but no page space, so the ruler greys that band,
*pauses* the count over it, and resumes underneath with the value it left off
at. A band starts at the **previous element's bottom edge**, not the row's own
top, so the leading gap the row introduces is skipped with it. Adjacent bands
merge. Rows hidden by a view toggle have a zero-height rect and drop out on
their own.

**5.4 The pin counter-transform.** Every frame, the component sets the pin's
transform to `none`, measures it, and then translates it by the difference
between the container's corner and the pin's flow position. This looks
redundant. It is not: a sticky element's flow position starts at the
container's **content** edge, inside its padding, so with any padding-top the
rulers sit that far down the page at rest and only snap to the corner once
sticky engages. Measuring the drift each frame is what makes it hug the corner
in both states, at any zoom.

## 6. Repaint triggers

Cheap to get wrong, and the symptom is a stale ruler rather than a crash:

- `scroll` on the container (passive)
- `ResizeObserver` on the container **and on the sizer** — the sizer grows as
  content is added, which is how the ruler learns about new pages
- `MutationObserver` on the sizer (`childList`, `subtree`, `class`) — switching
  Page ⇄ Continuous *swaps the separator elements*, which is not a resize, so
  without this the old ruler lingers until the next scroll
- a burst of repaints at 0/80/200/400ms after any of the above, because
  pagination re-measures a frame or two later

All of it is `requestAnimationFrame`-coalesced, so a scroll costs one paint per
frame at most.

## 7. Acceptance checks

Reproduce these against the original before calling it done. Each one caught a
real defect during development.

1. **Zoom 50% → 200%**: numbers stay on the inch marks; the margin shading
   still lines up with the page's own margins.
2. **Scroll to page 5+ in page view**: every page shows its full 0…11 with
   *both* the 10 and the 11 present. Not 9 and 10 on some pages.
3. **Continuous view**: every page's first text row is at "1"; the dotted line
   in the ruler is level with the page-break line in the document.
4. **Scroll past the end of the document in continuous**: the numbers keep
   resetting on the same rhythm — they never run 12, 13, 14…
5. **Switch Page ⇄ Continuous**: the ruler changes model immediately, without
   needing a scroll to repaint.
6. **cm units**: ticks at half-centimetres, numbers at whole centimetres, and
   an 8.5" page reads to ~21.6.
7. **Retina and non-retina**: lines are crisp, never 2px and grey.
8. **Container with padding-top**: rulers hug the corner both before and after
   the first scroll (§5.4).

## 8. Provenance

ScriptCraft, `frontend/src/components/EditorRulers.tsx` (v2.95 introduced,
v4.22 the canonical vertical spec, v4.54 note bands, v4.73 the continuous
tail). The only edit made for this kit was replacing two Zustand store reads
with props; the drawing code is unchanged. The store values were read *inside*
the paint function rather than closed over, so the port keeps them in a ref
that is refreshed on every render — `pageCount` in particular changes as the
writer types, with no other signal to repaint on.
