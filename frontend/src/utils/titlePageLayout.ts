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
  const byLine = data.tpWrittenBy
    ? (data.tpBasedOn ? `Written by ${data.tpWrittenBy}\n${data.tpBasedOn}` : `Written by ${data.tpWrittenBy}`)
    : '';
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
  if (byLine) { blocks.push(blank(), blank(), text('author', byLine)); used += 3; }

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
