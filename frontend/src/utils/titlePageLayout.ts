/**
 * titlePageLayout (v2.25) — THE classic title-page layout, as pure data.
 *
 * One builder produces the block sequence (spacers, title ~⅓ down, credit
 * line, bottom block pushed down by a gap); the Title Page editor turns the
 * specs into ProseMirror nodes and the FDX/Fountain importers turn them
 * into TipTap JSON. Before this, the importers emitted a single bare
 * `titlePage` node — which renders as one small line at the top of an
 * otherwise blank page, nothing like the title page the app builds itself.
 *
 * The line budget mirrors the paginator's accounting (titlePageBlockLines)
 * so the whole layout stays on exactly one unnumbered page.
 */
import type { CSSProperties } from 'react';
import { titlePageBlockLines } from '../editor/pagination';

export interface TitlePageData {
  tpTitle: string;
  tpTitle2: string;
  tpTitle2FontSize: number;
  tpWrittenBy: string;
  tpBasedOn: string;
  tpDraft: string;
  tpDraftDate: string;
  tpContact: string;
  tpCopyright: string;
  tpWgaRegistration: string;
  tpNotes: string;
  tpTitleFontSize: number;
}

export const EMPTY_TITLE_PAGE: TitlePageData = {
  tpTitle: '',
  tpTitle2: '',
  tpTitle2FontSize: 12,
  tpWrittenBy: '',
  tpBasedOn: '',
  tpDraft: '',
  tpDraftDate: '',
  tpContact: '',
  tpCopyright: '',
  tpWgaRegistration: '',
  tpNotes: '',
  tpTitleFontSize: 12,
};

/** Derive the rendered credit lines from the structured fields. */
export function deriveTitleFields(data: TitlePageData) {
  // Each credit part stands on its own: a lone "based on" (no "written by")
  // still reaches the page — it used to be dropped entirely.
  const byParts: string[] = [];
  if (data.tpWrittenBy) byParts.push(`Written by ${data.tpWrittenBy}`);
  if (data.tpBasedOn) byParts.push(data.tpBasedOn);
  const byLine = byParts.join('\n');
  const draftLine = (data.tpDraft || data.tpDraftDate) ? [data.tpDraft, data.tpDraftDate].filter(Boolean).join(' - ') : '';
  const copyrightLine = (data.tpCopyright || data.tpWgaRegistration) ? [data.tpCopyright, data.tpWgaRegistration].filter(Boolean).join('\n') : '';
  return { byLine, draftLine, copyrightLine };
}

export interface TitleBlockSpec {
  field: string;
  text: string;
  /** Full attrs for the node — the title block carries the structured data. */
  attrs: Record<string, unknown>;
}

/**
 * The classic layout as an ordered list of titlePage block specs.
 * `aboveLines` / `belowLines` are the line heights of any title-page images
 * the caller will place before/after these blocks (0 when there are none).
 */
export function titlePageBlockSpecs(data: TitlePageData, aboveLines = 0, belowLines = 0): TitleBlockSpec[] {
  const { byLine, draftLine, copyrightLine } = deriveTitleFields(data);
  const blank = (): TitleBlockSpec => ({ field: 'blank', text: '', attrs: { field: 'blank' } });
  const text = (field: string, t: string): TitleBlockSpec => ({
    field,
    text: t,
    attrs: field === 'title' ? { field: 'title', ...data }
      : field === 'title2' ? { field: 'title2', tpTitleFontSize: data.tpTitle2FontSize }
      : { field },
  });

  const TITLE_LINE = 15;       // title sits ~⅓ down (line ~15 of ~54)
  const PAGE_LINES = 50;       // bottom content ends near here

  const blocks: TitleBlockSpec[] = [];
  const topSpacers = Math.max(2, TITLE_LINE - 1 - aboveLines);
  for (let i = 0; i < topSpacers; i++) blocks.push(blank());
  blocks.push(text('title', data.tpTitle || ''));
  // An enlarged title occupies ceil(size/12) line slots per wrapped line —
  // budget its real height so the bottom block's spacer gap shrinks to match
  // and everything stays on the title page (same math as the paginator).
  let used = aboveLines + topSpacers + titlePageBlockLines(data.tpTitle || '', data.tpTitleFontSize);
  if (data.tpTitle2) {
    blocks.push(text('title2', data.tpTitle2));
    used += titlePageBlockLines(data.tpTitle2, data.tpTitle2FontSize);
  }
  // 2 blank spacers + the byLine's REAL height (it renders one line per \n
  // part — a flat +3 under-budgeted the two-line "Written by X\nBased on Y"
  // case and pushed the bottom block one line past its slot).
  if (byLine) { blocks.push(blank(), blank(), text('author', byLine)); used += 2 + byLine.split('\n').length; }

  const bottom: [string, string][] = [];
  if (draftLine) bottom.push(['draft', draftLine]);
  if (data.tpContact) bottom.push(['contact', data.tpContact]);
  if (copyrightLine) bottom.push(['copyright', copyrightLine]);
  if (data.tpNotes) bottom.push(['date', data.tpNotes]);
  const bottomLines = bottom.reduce((s, [, t]) => s + t.split('\n').length, 0);
  if (bottom.length || belowLines > 0) {
    // Gap pushes the bottom block + bottom images to the bottom of the page.
    const gap = Math.max(2, PAGE_LINES - used - bottomLines - belowLines);
    for (let i = 0; i < gap; i++) blocks.push(blank());
    for (const [f, t] of bottom) blocks.push(text(f, t));
  }
  return blocks;
}

/** The specs as TipTap JSON nodes — what the importers splice into the doc. */
export function titlePageJsonNodes(data: TitlePageData): Array<{ type: string; attrs: Record<string, unknown>; content?: Array<{ type: string; text: string }> }> {
  return titlePageBlockSpecs(data).map((s) => ({
    type: 'titlePage',
    attrs: s.attrs,
    ...(s.text ? { content: [{ type: 'text', text: s.text }] } : {}),
  }));
}

// ── How a title-page line LOOKS (v5.74) ─────────────────────────────────

/**
 * Derek: "the title page in the title page tool, and the title page in the
 * Page > All view still do not match."
 *
 * They were three hand-written renderings of one page — the editor's
 * `.title-page-<field>` CSS, the Title tab's live preview, and the Pages
 * thumbnail — and they disagreed about weight, caps, size and centering.
 * THIS is the single definition; the preview and the thumbnail both call
 * it, and the editor CSS is kept in step by hand (it can't call JS).
 *
 * `sizePt` is the block's own point size, which every consumer of a title
 * NODE reads from `tpTitleFontSize` — including title2 (the layout builder
 * writes title2's size into that attr, and TitlePage's renderHTML, the
 * paginator and the PDF exporter all read it there). The Title tab passes
 * its form value instead, because it renders before any node exists.
 *
 * `shiftPx` is the container's paper-centering correction: a screenplay
 * page's printable box is asymmetric (1.5in left vs 0.76in right), so text
 * centered in that box lands (left-right)/2 right of the paper's true
 * centre. Anchored fields (draft left, contact/copyright right) keep the
 * body margins and never take the shift.
 */
export function titleLineStyle(
  field: string,
  { sizePt, shiftPx = 0 }: { sizePt?: number; shiftPx?: number } = {},
): CSSProperties {
  const isTitle = field === 'title' || field === 'title2';
  const anchored = field === 'draft' || field === 'contact' || field === 'copyright';
  const size = isTitle ? Math.max(1, Math.round(sizePt || 12)) : 12;
  return {
    textAlign: field === 'draft' ? 'left'
      : field === 'contact' || field === 'copyright' ? 'right'
      : 'center',
    ...(isTitle ? { fontWeight: 700, textTransform: 'uppercase' as const } : null),
    // An enlarged title snaps to whole 12pt line slots so its rendered
    // height matches the line budget the paginator and the builder count.
    ...(isTitle && size !== 12
      ? { fontSize: `${size}pt`, lineHeight: `${Math.ceil(size / 12) * 12}pt` }
      : null),
    ...(shiftPx && !anchored ? { marginLeft: `${shiftPx}px`, marginRight: `${-shiftPx}px` } : null),
    // Credit and contact blocks hold real newlines — the page breaks at
    // them, so every preview of the page must too.
    whiteSpace: 'pre-wrap',
    minHeight: '12pt',
  };
}

/** The paper-centering shift for `titleLineStyle`, in CSS px, for a page
 *  laid out with these margins. 0 when the printable box is symmetric. */
export function titlePaperShiftPx(layout: { leftMargin: number; rightMargin: number }): number {
  return ((layout.rightMargin - layout.leftMargin) / 2) * 96;
}
