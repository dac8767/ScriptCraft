import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PmNode } from '@tiptap/pm/model';
import type { PageLayout } from '../stores/editorStore';
import { resolveMoresContds } from '../stores/editorStore';

export const paginationPluginKey = new PluginKey('pagination');

/** Print mode: instead of pushing content down with pixel margins (which the
 * printer's own page geometry turns into drift and mid-page gaps), each page's
 * first node gets the `fd-print-break` class — CSS turns that into a real
 * `break-before: page` plus the top margin, so printed pages match the editor's
 * pagination exactly. Toggled from beforeprint/afterprint in ScreenplayEditor. */
let printMode = false;
export function setPaginationPrintMode(v: boolean): void {
  printMode = v;
}

/** Continuous view (View > Editor Style): the page MARGINS are removed, but each
 * page is still filled to a uniform height (the whitespace fill stays), so every
 * page is the same size — page 1 is 1" taller only because it keeps its real top
 * margin (from the .page padding). Between pages sits a 0.5" divide gap: 0.25"
 * of blank, the dashed page-divide line, 0.25" of blank — so the last row of one
 * page and the first row of the next never stack. (v4.22, Derek: 0.25" each
 * side.) Page 1 reads 0..10.25"; every later page reads 0.75..10.25". The
 * .page-sep-line hairline is centered in the gap (0.25" below the "10"). */
export const CONTINUOUS_GAP_PX = 48; // 0.5" = 0.25" each side of the divide
let continuousMode = false;
export function setPaginationContinuousMode(v: boolean): void {
  continuousMode = v;
}
export function isPaginationContinuous(): boolean {
  return continuousMode;
}

/** Visibility-aware pagination (v0.29): outline lines hidden via the Preview
 * sidebar (or preview mode defaults) render display:none, so they must count
 * as ZERO lines — otherwise every page break lands lower than the visible
 * content and the white sheets drift out of alignment. Double-spaced scene
 * headers (a Preview template option) add one extra line per heading. */
const visibilityOpts = { hideSections: false, hideTodos: false, doubleSpaceHeaders: false, hideTitlePage: false };
export function setPaginationVisibility(opts: Partial<typeof visibilityOpts>): void {
  Object.assign(visibilityOpts, opts);
}

/** Template hints that influence pagination — supplied by the active FormattingTemplate. */
export interface TemplateHints {
  /** Element ids that must start on a new page (e.g. sitcom: every sceneHeading). */
  forceBreakBefore: Set<string>;
  /** Per-element line-height multiplier (e.g. dialogue: 2.0 for double-spaced sitcom). */
  lineHeightMultiplier: Record<string, number>;
}

const EMPTY_HINTS: TemplateHints = {
  forceBreakBefore: new Set(),
  lineHeightMultiplier: {},
};

/** Resolve the effective element id for a top-level node (built-in name or customTypeId). */
function getElementId(node: PmNode): string {
  if (node.type.name === 'customElement') {
    const t = (node.attrs as { customTypeId?: string }).customTypeId;
    if (t) return t;
  }
  return node.type.name;
}

const LINE_HEIGHT_PT = 12;

// Final Draft Courier ≈ 10.33 chars/inch
const FD_CPI = 10.33;

// Final Draft absolute indents from page edge (inches)
const FD_INDENTS: Record<string, [number, number]> = {
  sceneHeading: [1.50, 7.50], action: [1.50, 7.50], character: [3.50, 7.50],
  dialogue: [2.50, 6.00], parenthetical: [3.00, 5.50], transition: [5.50, 7.50],
  general: [1.50, 7.50], shot: [1.50, 7.50], newAct: [1.50, 7.50],
  endOfAct: [1.50, 7.50], lyrics: [2.50, 6.00], showEpisode: [1.50, 7.50],
  castList: [1.50, 7.50],
};

const CHARS_PER_LINE: Record<string, number> = {};
for (const [type, [l, r]] of Object.entries(FD_INDENTS)) {
  CHARS_PER_LINE[type] = Math.round((r - l) * FD_CPI);
}

// Space before each element type in lines
const SPACE_BEFORE: Record<string, number> = {
  sceneHeading: 1, action: 1, character: 1, dialogue: 0,
  parenthetical: 0, transition: 1, general: 0, shot: 1,
  newAct: 2, endOfAct: 2, lyrics: 0, showEpisode: 1, castList: 0,
  // titlePage intentionally 0: title-page blocks have no CSS margin (the CSS
  // was carrying a 12pt margin the estimator couldn't see — removed), so each
  // block is exactly its text lines. Spacing comes from blank spacer blocks.
};

const DIALOGUE_BLOCK_TYPES = new Set(['dialogue', 'parenthetical', 'lyrics']);

export function getPageMetrics(layout: PageLayout) {
  const contentHeightPt = layout.pageHeight * 72 - layout.topMargin - layout.bottomMargin;
  const linesPerPage = Math.floor(contentHeightPt / LINE_HEIGHT_PT);
  const lineHeightPx = LINE_HEIGHT_PT * (96 / 72);
  const pageContentPx = linesPerPage * lineHeightPx;
  const sepHeightPx = Math.round(
    (layout.bottomMargin / 72) * 96 + 40 + (layout.topMargin / 72) * 96
  );
  const contentStartPx = (layout.topMargin / 72) * 96;
  return { linesPerPage, pageContentPx, sepHeightPx, contentStartPx };
}

export interface BreakInfo {
  nodeIndex: number;
  offset: number;
  nodeSize: number;
  pageNumber: number;
  linesOnPage: number;
  isDialogueSplit: boolean;
  characterName: string;
  /** True for the break that separates the title page from the script body.
   *  The title page is its own unnumbered page and is not part of the script
   *  page count, so this break does not consume a page number. */
  isTitlePage: boolean;
}

export interface PaginationState {
  pageCount: number;
  breaks: BreakInfo[];
}

export function createPaginationPlugin(
  onUpdate: (state: PaginationState) => void,
  getLayout: () => PageLayout,
  getHints: () => TemplateHints = () => EMPTY_HINTS,
) {
  return new Plugin({
    key: paginationPluginKey,
    state: {
      init(_, state) {
        const result = computeBreaks(state.doc, getLayout(), getHints());
        setTimeout(() => onUpdate(result), 0);
        return result;
      },
      apply(tr, oldState, _oldEditorState, newEditorState) {
        if (!tr.docChanged && !tr.getMeta('forceRepaginate')) return oldState;
        const result = computeBreaks(newEditorState.doc, getLayout(), getHints());
        onUpdate(result);
        return result;
      },
    },
    props: {
      decorations(state) {
        const ps = paginationPluginKey.getState(state) as PaginationState | undefined;
        if (!ps || ps.breaks.length === 0) return DecorationSet.empty;
        const layout = getLayout();
        const { linesPerPage, sepHeightPx } = getPageMetrics(layout);
        const lineHeightPx = LINE_HEIGHT_PT * (96 / 72);
        // Only reserve room for the CONT'D label when the marker is actually shown.
        const showDialogueBreakContd = resolveMoresContds(layout).dialogueBreakContd;
        const decos: Decoration[] = [];
        for (const brk of ps.breaks) {
          const whitespacePx = Math.max(0, linesPerPage - brk.linesOnPage) * lineHeightPx;
          // Dialogue splits need extra space for the CONT'D label on the next page
          const contdPx = brk.isDialogueSplit && showDialogueBreakContd ? lineHeightPx : 0;
          const marginTop = continuousMode
            // Fill the page to a uniform height (whitespacePx), then add the
            // 2-row divide gap — no page margins. Uniform pages, small breather.
            ? Math.round(whitespacePx + CONTINUOUS_GAP_PX)
            : Math.round(whitespacePx + sepHeightPx + contdPx);
          decos.push(
            printMode
              ? Decoration.node(brk.offset, brk.offset + brk.nodeSize, {
                  class: 'fd-print-break',
                })
              : Decoration.node(brk.offset, brk.offset + brk.nodeSize, {
                  style: `margin-top: ${marginTop}px !important`,
                })
          );
        }
        return DecorationSet.create(state.doc, decos);
      },
    },
  });
}

function getTextLines(text: string, cpl: number): number {
  return text.length === 0 ? 1 : Math.ceil(text.length / cpl);
}

/** Title-page blocks span the full printable width (~62 chars at 12pt). */
const TITLE_CPL = 62;

/**
 * Line cost of a title-page block at a given font size, in 12pt line slots.
 * The geometry contract (v0.45): the title-page builder, this paginator, and
 * the rendered DOM (TitlePage renderHTML snaps line-height to a whole number
 * of 12pt slots) must all agree, or an enlarged title silently pushes the
 * bottom fields past the title page and offsets every page after it.
 */
export function titlePageBlockLines(text: string, sizePt: number): number {
  const size = Number(sizePt) || 12;
  if (size <= 12) return getTextLines(text, TITLE_CPL);
  const slotsPerLine = Math.ceil(size / 12);
  // Courier width scales linearly with size, so chars-per-line shrinks 12/size.
  const cpl = Math.max(8, Math.floor(TITLE_CPL * (12 / size)));
  return getTextLines(text, cpl) * slotsPerLine;
}

function computeBreaks(doc: PmNode, layout: PageLayout, hints: TemplateHints = EMPTY_HINTS): PaginationState {
  const { linesPerPage } = getPageMetrics(layout);

  interface NodeInfo {
    typeName: string; elementId: string; spaceBefore: number; text: string;
    offset: number; nodeSize: number; lineMul: number; fixedLines?: number;
  }
  const nodes: NodeInfo[] = [];
  let isFirst = true;
  doc.forEach((node, offset) => {
    const typeName = node.type.name;
    const elementId = getElementId(node);
    let sb = isFirst ? 0 : (SPACE_BEFORE[typeName] ?? 0);
    const lineMul = hints.lineHeightMultiplier[elementId] ?? 1;
    // Images occupy a fixed estimated number of lines (no text to wrap).
    let fixedLines = typeName === 'screenplayImage'
      ? Math.max(1, Number(node.attrs?.heightLines) || 8)
      : undefined;
    // Title/title2 blocks with a custom font size occupy ceil(size/12) line
    // slots per wrapped line — must match TitlePage renderHTML's snapped
    // line-height and the title-page builder's line budget.
    if (typeName === 'titlePage') {
      const field = (node.attrs as { field?: string })?.field;
      if (field === 'title' || field === 'title2') {
        const size = Number((node.attrs as { tpTitleFontSize?: number })?.tpTitleFontSize) || 12;
        if (size > 12) fixedLines = titlePageBlockLines(node.textContent || '', size);
      }
    }
    // v1.2: the title page belongs to the finished script, not to the draft you're
    // typing in — so it only appears in Preview. Hidden here it renders
    // display:none, and must take up NO lines, or every page number after it
    // would be off by a page while the page itself wasn't there to see.
    if (typeName === 'titlePage' && visibilityOpts.hideTitlePage) {
      fixedLines = 0;
      sb = 0;
    }
    // Outline lines hidden by the Preview options render display:none — they
    // occupy zero lines and contribute no leading space.
    if (typeName === 'general') {
      const text = node.textContent || '';
      const isSectionish = /^#+\s/.test(text) || text.startsWith('\u2691');
      const isTodo = /^\[[ x]\]/.test(text);
      if ((visibilityOpts.hideSections && isSectionish) || (visibilityOpts.hideTodos && isTodo)) {
        fixedLines = 0;
        sb = 0;
      }
    }
    // Double-spaced scene headers (Preview template option) take one extra line.
    if (typeName === 'sceneHeading' && visibilityOpts.doubleSpaceHeaders && !isFirst) {
      sb += 1;
    }
    nodes.push({ typeName, elementId, spaceBefore: sb, text: node.textContent || '', offset, nodeSize: node.nodeSize, lineMul, fixedLines });
    isFirst = false;
  });

  const breaks: BreakInfo[] = [];
  let lineCount = 0;
  let pageNumber = 2;
  let i = 0;
  // Title page handling: a leading run of `titlePage` nodes forms a separate,
  // unnumbered page. Force the script body onto its own page after them.
  let sawTitlePage = false;
  let titleBroken = false;

  while (i < nodes.length) {
    const node = nodes[i];

    if (node.typeName === 'titlePage') sawTitlePage = true;
    // Leading images (when a title page exists) belong to the title page, so they
    // don't trigger the body break and stay on the title page.
    const isTitleRegionNode = node.typeName === 'titlePage' || node.typeName === 'screenplayImage';
    // v3.43, Derek: only force the body onto a fresh page when the title page is
    // actually SHOWN (Preview/print). While it's hidden (Page/Continuous) it
    // takes 0 lines, so the old `lineCount > 0` guard fired this break one node
    // late — stranding the first body element alone on a blank page 1. Hidden,
    // there is no title page to break away from, so skip it entirely.
    if (!titleBroken && sawTitlePage && !visibilityOpts.hideTitlePage && !isTitleRegionNode && lineCount > 0) {
      // First script element after the title page → start it on a fresh page.
      // pageNumber stays at its current value (the title page does not consume a
      // number); the body's first page remains the implicit unnumbered page 1.
      titleBroken = true;
      breaks.push({
        nodeIndex: i,
        offset: node.offset, nodeSize: node.nodeSize,
        pageNumber: 1, linesOnPage: lineCount,
        isDialogueSplit: false, characterName: '', isTitlePage: true,
      });
      lineCount = 0; // fall through and lay this node out at the top of the body page
    }

    const cpl = CHARS_PER_LINE[node.typeName] || 62;
    const textLines = node.fixedLines !== undefined
      ? node.fixedLines
      : getTextLines(node.text, cpl) * node.lineMul;
    const totalLines = node.spaceBefore + textLines;

    // Build character+dialogue block
    let blockLines = totalLines;
    let blockEnd = i;

    if (node.typeName === 'character' && i + 1 < nodes.length) {
      let j = i + 1;
      while (j < nodes.length && DIALOGUE_BLOCK_TYPES.has(nodes[j].typeName)) {
        const dn = nodes[j];
        const dc = CHARS_PER_LINE[dn.typeName] || 36;
        blockLines += dn.spaceBefore + getTextLines(dn.text, dc) * dn.lineMul;
        j++;
      }
      blockEnd = j - 1;
    } else if (node.typeName === 'sceneHeading' && i + 1 < nodes.length) {
      const nn = nodes[i + 1];
      const nc = CHARS_PER_LINE[nn.typeName] || 62;
      blockLines += nn.spaceBefore + getTextLines(nn.text, nc) * nn.lineMul;
      blockEnd = i + 1;
    }

    // Force break: template can require certain elements to start a new page (e.g. sitcom sceneHeading).
    const forceBreak = lineCount > 0 && hints.forceBreakBefore.has(node.elementId);

    // The leading title region is a single unnumbered page by definition —
    // never emit page breaks inside it (spacer blocks position its content).
    const inTitleRegion = !titleBroken && sawTitlePage && isTitleRegionNode;

    if (!inTitleRegion && (forceBreak || lineCount + blockLines > linesPerPage) && lineCount > 0) {
      const remaining = linesPerPage - lineCount;

      // Try to split character+dialogue blocks
      if (node.typeName === 'character' && blockEnd > i) {
        const charLines = node.spaceBefore + getTextLines(node.text, CHARS_PER_LINE[node.typeName] || 41);

        const MIN_DL = 2; // FD: at least 2 lines of dialogue on each side of split

        // Can we fit character + at least 2 lines of dialogue?
        if (remaining >= charLines + MIN_DL) {
          let fittedLines = charLines;
          let lastFittedNode = i;
          let fittedDL = 0;
          for (let j = i + 1; j <= blockEnd; j++) {
            const dn = nodes[j];
            const dc = CHARS_PER_LINE[dn.typeName] || 36;
            const dl = getTextLines(dn.text, dc);
            const dnTotal = dn.spaceBefore + dl;
            if (fittedLines + dnTotal <= remaining) {
              fittedLines += dnTotal;
              fittedDL += dl;
              lastFittedNode = j;
            } else {
              break;
            }
          }

          // Check remaining dialogue lines on next page >= 2
          let remainDL = 0;
          for (let j = lastFittedNode + 1; j <= blockEnd; j++) {
            const dn = nodes[j];
            const dc = CHARS_PER_LINE[dn.typeName] || 36;
            remainDL += getTextLines(dn.text, dc);
          }

          if (lastFittedNode > i && fittedDL >= MIN_DL && remainDL >= MIN_DL) {
            lineCount += fittedLines;
            const splitIdx = lastFittedNode + 1;
            const splitNode = splitIdx < nodes.length ? nodes[splitIdx] : nodes[blockEnd];
            breaks.push({
              nodeIndex: Math.min(splitIdx, nodes.length - 1),
              offset: splitNode.offset, nodeSize: splitNode.nodeSize,
              pageNumber, linesOnPage: lineCount,
              isDialogueSplit: true,
              characterName: node.text.trim(),
              isTitlePage: false,
            });
            pageNumber++;
            lineCount = 1; // CONT'D line
            for (let j = splitIdx; j <= blockEnd; j++) {
              if (j >= nodes.length) break;
              const dn = nodes[j];
              const dc = CHARS_PER_LINE[dn.typeName] || 36;
              lineCount += (j === splitIdx ? getTextLines(dn.text, dc) : dn.spaceBefore + getTextLines(dn.text, dc));
            }
            i = blockEnd + 1;
            continue;
          }
        }
      }

      // Default: push entire block to next page
      breaks.push({
        nodeIndex: i,
        offset: node.offset, nodeSize: node.nodeSize,
        pageNumber, linesOnPage: lineCount,
        isDialogueSplit: false, characterName: '', isTitlePage: false,
      });
      pageNumber++;
      lineCount = blockLines - node.spaceBefore;
    } else {
      lineCount += blockLines;
    }

    i = blockEnd + 1;
  }

  return { pageCount: pageNumber - 1, breaks };
}

// ── Scene length computation ────────────────────────────────────────────

/**
 * Compute the length of each scene in pages (decimal).
 * Returns an array of page lengths, one per scene heading in document order.
 */
export function computeSceneLengths(doc: PmNode, layout: PageLayout): number[] {
  const { linesPerPage } = getPageMetrics(layout);
  const lengths: number[] = [];
  let sceneLines = 0;
  let inScene = false;
  let nodeIdx = 0;

  doc.forEach((node) => {
    const typeName = node.type.name;
    const cpl = CHARS_PER_LINE[typeName] || 62;
    const textLines = getTextLines(node.textContent || '', cpl);
    const sb = nodeIdx === 0 ? 0 : (SPACE_BEFORE[typeName] ?? 0);

    if (typeName === 'sceneHeading') {
      if (inScene) lengths.push(sceneLines / linesPerPage);
      sceneLines = sb + textLines;
      inScene = true;
    } else if (inScene) {
      sceneLines += sb + textLines;
    }
    nodeIdx++;
  });
  if (inScene) lengths.push(sceneLines / linesPerPage);
  return lengths;
}

// ── Page block computation for page preview ─────────────────────────────

export interface PageBlockInfo {
  typeName: string;
  lineStart: number;
  lineCount: number;
  docPos: number;
  text: string;
}

export interface PageContentInfo {
  pageNumber: number;
  blocks: PageBlockInfo[];
  linesPerPage: number;
}

/**
 * Compute content blocks per page for page-preview thumbnails.
 * Uses the same break algorithm as the pagination plugin for accuracy.
 */
export function computePageBlocks(doc: PmNode, layout: PageLayout): PageContentInfo[] {
  const { linesPerPage } = getPageMetrics(layout);
  const { breaks } = computeBreaks(doc, layout);

  // Collect top-level nodes
  const nodes: { typeName: string; text: string; offset: number }[] = [];
  doc.forEach((node, offset) => {
    nodes.push({ typeName: node.type.name, text: node.textContent || '', offset });
  });

  if (nodes.length === 0) return [];

  // Determine page boundaries from breaks
  const pageBounds: { pageNumber: number; startNode: number; endNode: number; dialogueSplit: boolean }[] = [];

  if (breaks.length === 0) {
    pageBounds.push({ pageNumber: 1, startNode: 0, endNode: nodes.length - 1, dialogueSplit: false });
  } else {
    // Page 1
    if (breaks[0].nodeIndex > 0) {
      pageBounds.push({ pageNumber: 1, startNode: 0, endNode: breaks[0].nodeIndex - 1, dialogueSplit: false });
    }
    // Pages from breaks
    for (let i = 0; i < breaks.length; i++) {
      const endNode = i + 1 < breaks.length ? breaks[i + 1].nodeIndex - 1 : nodes.length - 1;
      pageBounds.push({
        pageNumber: breaks[i].pageNumber,
        startNode: breaks[i].nodeIndex,
        endNode,
        dialogueSplit: breaks[i].isDialogueSplit,
      });
    }
  }

  // Build page content
  const pages: PageContentInfo[] = [];

  for (const pb of pageBounds) {
    if (pb.startNode > pb.endNode || pb.startNode >= nodes.length) continue;
    const blocks: PageBlockInfo[] = [];
    let lineOnPage = pb.dialogueSplit ? 1 : 0; // 1 for CONT'D overhead
    let firstOnPage = true;

    for (let i = pb.startNode; i <= Math.min(pb.endNode, nodes.length - 1); i++) {
      const node = nodes[i];
      const cpl = CHARS_PER_LINE[node.typeName] || 62;
      const textLines = getTextLines(node.text, cpl);
      const sb = firstOnPage ? 0 : (SPACE_BEFORE[node.typeName] ?? 0);
      firstOnPage = false;

      blocks.push({
        typeName: node.typeName,
        lineStart: lineOnPage + sb,
        lineCount: textLines,
        docPos: node.offset,
        text: node.text,
      });
      lineOnPage += sb + textLines;
    }

    pages.push({ pageNumber: pb.pageNumber, blocks, linesPerPage });
  }

  return pages;
}
