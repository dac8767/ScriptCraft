/**
 * screenplayMetrics — THE single source for screenplay text geometry.
 *
 * Consumed by the paginator (editor page counting), the PDF exporter, and the
 * v6.33 wrap checks. Before v6.33 the paginator and exporter each carried
 * their own copies of these tables and they had drifted (round vs trailing-
 * space accounting), so the same paragraph wrapped differently on screen, in
 * the page count, and on paper.
 *
 * The numbers are MEASURED, not folklore. Derek's reference page (another
 * screenwriting program, v6.33 side-by-side) measures out to:
 *   - true 10.0 characters per inch — 12pt Courier at its natural 0.6em
 *     advance (7.2pt per character), no tracking;
 *   - action column 1.5" → 7.8" = 6.3" = exactly 63 characters. Both of its
 *     63-char lines end ink at ~7.79", and CUT TO: right-aligns to 7.8".
 * The old FD_CPI of 10.33 (and the editor's -0.31px letter-spacing squeeze)
 * came from assuming 62 chars in a 6.0" column; the reference actually keeps
 * the natural pitch and widens the column instead.
 */

export const LINE_HEIGHT_PT = 12;
export const PTS_PER_INCH = 72;

/** Courier at 12pt: 10 characters per inch (7.2pt per character). */
export const FD_CPI = 10.0;
export const FD_CHAR_WIDTH_PT = PTS_PER_INCH / FD_CPI; // 7.2pt

/**
 * Absolute element columns in inches from the left page edge, [left, right].
 * Right edge 7.80 = the content edge on the default layout (8.5" page,
 * 0.7" right margin) — see columnFor() for how custom layouts clamp these.
 */
export const FD_INDENTS: Record<string, [number, number]> = {
  sceneHeading: [1.50, 7.80], action: [1.50, 7.80], character: [3.50, 7.80],
  dialogue: [2.50, 6.00], parenthetical: [3.00, 5.50], transition: [5.50, 7.80],
  general: [1.50, 7.80], shot: [1.50, 7.80], newAct: [1.50, 7.80],
  endOfAct: [1.50, 7.80], lyrics: [2.50, 6.00], showEpisode: [1.50, 7.80],
  castList: [1.50, 7.80],
};

/** Characters per line for each element type on the DEFAULT page layout. */
export const CHARS_PER_LINE: Record<string, number> = {};
for (const [type, [l, r]] of Object.entries(FD_INDENTS)) {
  CHARS_PER_LINE[type] = Math.round((r - l) * FD_CPI);
}

/** Space before each element type, in 12pt lines. sceneHeading is 2 — the
 *  spec-standard double blank line (v6.30). */
export const SPACE_BEFORE: Record<string, number> = {
  sceneHeading: 2, action: 1, character: 1, dialogue: 0,
  parenthetical: 0, transition: 1, general: 0, shot: 1,
  newAct: 2, endOfAct: 2, lyrics: 0, showEpisode: 1, castList: 0,
  // titlePage intentionally absent (0): title-page blocks have no CSS margin,
  // so each block is exactly its text lines. Spacing comes from spacer blocks.
};

export interface PageLayoutLike {
  pageWidth: number;
  leftMargin: number;
  rightMargin: number;
}

export interface ElementColumn {
  /** inches from the page's left edge */
  leftIn: number;
  rightIn: number;
  /** greedy-wrap capacity of the column */
  chars: number;
}

/**
 * The element's real column on a given page layout: the absolute FD indents,
 * clamped to the layout's content box. On the default layout this returns the
 * FD_INDENTS values verbatim; an imported FDX (or custom Page Setup) with a
 * 1.0" right margin clamps full-width columns to 7.5" (60 chars) — exactly
 * what the editor CSS renders, because element padding is calc()'d against
 * the same margins. One geometry, three renderers.
 */
export function columnFor(typeName: string, layout: PageLayoutLike): ElementColumn {
  const [l, r] = FD_INDENTS[typeName] ?? FD_INDENTS.general;
  const leftIn = Math.max(l, layout.leftMargin);
  const rightIn = Math.min(r, layout.pageWidth - layout.rightMargin);
  const chars = Math.max(1, Math.round((rightIn - leftIn) * FD_CPI));
  return { leftIn, rightIn, chars };
}

/**
 * Wrapped-line count of a text at a column width — the greedy word wrap all
 * three renderers agree on. A word's own trailing space never forces a break
 * (only the gap BETWEEN kept words counts), and a word longer than the column
 * hard-splits, both matching browser behavior for monospace text.
 */
export function getTextLines(text: string, cpl: number): number {
  if (text.length === 0) return 1;
  if (cpl <= 0) return 1;
  let lines = 1;
  let col = 0;
  for (const word of text.split(' ')) {
    const w = word.length;
    if (col !== 0 && col + 1 + w > cpl) { lines++; col = w; }
    else { col = col === 0 ? w : col + 1 + w; }
    while (col > cpl) { lines++; col -= cpl; }
  }
  return lines;
}
