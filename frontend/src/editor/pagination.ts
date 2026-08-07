import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PmNode } from '@tiptap/pm/model';
import type { PageLayout } from '../stores/editorStore';
import { resolveMoresContds } from '../stores/editorStore';
import { workingNoteKind } from '../utils/workingNotes';
import {
  LINE_HEIGHT_PT, CHARS_PER_LINE, SPACE_BEFORE, columnFor, getTextLines,
} from '../utils/screenplayMetrics';

// Re-export: getTextLines lived here before v6.33; its test and callers
// still import it from this module.
export { getTextLines };

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

/** v4.22, Derek: MEASURED page fill. The budget estimate (linesPerPage −
 * linesOnPage) can be a line or two off from what the browser actually
 * renders, so pages drifted a hair past their real height. After layout,
 * ScreenplayEditor measures each page's true rendered content height and
 * supplies the exact whitespace (px) needed to make it exactly one page tall —
 * keyed by the break's page number (stable across edits, unlike offsets). A key
 * that doesn't match yet simply misses and falls back to the budget estimate,
 * then the next measure refreshes it. This makes every page exactly the size
 * set in Settings, independent of estimator accuracy. */
let measuredFills: Map<number, number> = new Map();
export function setMeasuredFills(m: Map<number, number>): void { measuredFills = m; }

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

// Text geometry — LINE_HEIGHT_PT, CHARS_PER_LINE, SPACE_BEFORE, columnFor
// and getTextLines all come from utils/screenplayMetrics (v6.33): ONE source
// shared with the PDF exporter, measured against Derek's reference page
// (true 10 cpi Courier, full-width columns 1.5"→7.8" = 63 chars).

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
  /** v5.40: this break OPENS a custom page (Derek: custom pages do not count
   *  in page numbering — no number is consumed, no header renders, and the
   *  measured-fill path skips it). */
  isCustomPage?: boolean;
  /** v5.40: the page BEFORE this break is a custom page — the footer that
   *  would describe it is suppressed (it has no number to print). */
  afterCustomPage?: boolean;
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
          // Prefer the measured fill; fall back to the line-budget estimate until
          // the first measurement lands (keyed by page number, set by React).
          // v5.40: a break OPENING a custom page shares its pageNumber with
          // the script page after it — it keeps the budget fill so the two
          // can't cross wires (its own fill is never recorded either).
          const measured = brk.isCustomPage ? undefined : measuredFills.get(brk.pageNumber);
          const whitespacePx = measured !== undefined
            ? measured
            : Math.max(0, linesPerPage - brk.linesOnPage) * lineHeightPx;
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

/**
 * Wrapped line count for a run of text at `cpl` chars per line.
 *
 * v4.22, Derek: this was `ceil(len / cpl)`, which assumes text packs perfectly
 * across the line. The browser word-wraps — it breaks at spaces, so every line
 * stops at a word boundary and leaves a ragged right edge. A 141-char dialogue
 * block that "should" be 4 lines (141/36) actually renders as 5. The estimate
 * therefore ran a line short on most multi-line blocks, the paginator packed
 * more onto a page than fit, and the page overflowed past its height. This does
 * the real greedy wrap instead, so the count matches what renders. A word longer
 * than the line wraps within itself (rare in screenplay text; over-counting it
 * only makes a page break a hair early, which the measured fill then tops up).
 */
/** Title-page blocks span the full printable width, but they RESET the
 *  break-spaces phantom-space allowance (mostly centered — see
 *  06-editor-content), so their soft-wrap capacity is one below the action
 *  column's. */
const TITLE_CPL = CHARS_PER_LINE.action - 1;

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

export function computeBreaks(doc: PmNode, layout: PageLayout, hints: TemplateHints = EMPTY_HINTS): PaginationState {
  const { linesPerPage } = getPageMetrics(layout);
  const cplFor = (t: string) => columnFor(t, layout).chars;

  interface NodeInfo {
    typeName: string; elementId: string; spaceBefore: number; text: string;
    offset: number; nodeSize: number; lineMul: number; fixedLines?: number;
    /** v5.40: which custom page a customPage line belongs to */
    cpId?: string;
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
      // Same classification the exporters and the editor's ol- classes use.
      const kind = workingNoteKind(node.textContent || '');
      const isSectionish = kind === 'section' || kind === 'marker';
      const isTodo = kind === 'todo';
      if ((visibilityOpts.hideSections && isSectionish) || (visibilityOpts.hideTodos && isTodo)) {
        fixedLines = 0;
        sb = 0;
      }
    }
    // Double-spaced scene headers (Preview template option) take one extra line.
    if (typeName === 'sceneHeading' && visibilityOpts.doubleSpaceHeaders && !isFirst) {
      sb += 1;
    }
    nodes.push({
      typeName, elementId, spaceBefore: sb, text: node.textContent || '',
      offset, nodeSize: node.nodeSize, lineMul, fixedLines,
      cpId: typeName === 'customPage' ? String((node.attrs as { cpId?: string })?.cpId ?? '') : undefined,
    });
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
  // v5.40: custom pages — a consecutive run of customPage lines sharing a
  // cpId is ONE page of its own, OUTSIDE the numbering (Derek: custom pages
  // do not count — the script page after one keeps the number it would have
  // had). `customRun` is the run's id while inside it; `scriptSeen` says
  // whether any script content was laid out before the run (a LEADING
  // custom page plays the title page's part: the body still opens page 1).
  let customRun: string | null = null;
  let scriptSeen = false;

  while (i < nodes.length) {
    const node = nodes[i];

    if (node.typeName === 'titlePage') sawTitlePage = true;
    const isCustomNode = node.typeName === 'customPage';
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

    // v5.40: custom pages — a consecutive run of customPage lines sharing a
    // cpId is ONE page of its own, OUTSIDE the numbering (Derek: custom
    // pages do not count — the script page after one keeps the number it
    // would have had). Runs after the title handling so a custom page
    // directly after the title region rides that break, not a second one.
    if (isCustomNode && customRun !== (node.cpId ?? '')) {
      // entering a custom run (or a different one back-to-back)
      if (lineCount > 0) {
        breaks.push({
          nodeIndex: i, offset: node.offset, nodeSize: node.nodeSize,
          pageNumber, linesOnPage: lineCount,
          isDialogueSplit: false, characterName: '', isTitlePage: false,
          isCustomPage: true,   // opens an unnumbered page — no number consumed
        });
        lineCount = 0;
      }
      customRun = node.cpId ?? '';
    } else if (!isCustomNode && customRun !== null) {
      // leaving the run — this node starts the next SCRIPT page, which keeps
      // the number it would have had without the custom page in between
      breaks.push({
        nodeIndex: i, offset: node.offset, nodeSize: node.nodeSize,
        pageNumber: scriptSeen ? pageNumber : 1,
        linesOnPage: lineCount,
        isDialogueSplit: false, characterName: '',
        isTitlePage: !scriptSeen,
        afterCustomPage: true,
      });
      if (scriptSeen) pageNumber++;
      lineCount = 0;
      customRun = null;
    }

    const cpl = cplFor(node.typeName);
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
        const dc = cplFor(dn.typeName);
        blockLines += dn.spaceBefore + getTextLines(dn.text, dc) * dn.lineMul;
        j++;
      }
      blockEnd = j - 1;
    } else if (node.typeName === 'sceneHeading' && i + 1 < nodes.length) {
      const nn = nodes[i + 1];
      const nc = cplFor(nn.typeName);
      blockLines += nn.spaceBefore + getTextLines(nn.text, nc) * nn.lineMul;
      blockEnd = i + 1;
    }

    // Force break: template can require certain elements to start a new page (e.g. sitcom sceneHeading).
    const forceBreak = lineCount > 0 && hints.forceBreakBefore.has(node.elementId);

    // The leading title region is a single unnumbered page by definition —
    // never emit page breaks inside it (spacer blocks position its content).
    const inTitleRegion = !titleBroken && sawTitlePage && isTitleRegionNode;
    // v5.40: same rule inside a custom page — it is ONE page, however long
    // its content runs (overflow renders tall rather than splitting).
    const inCustomRegion = isCustomNode && customRun !== null;

    if (!inTitleRegion && !inCustomRegion && (forceBreak || lineCount + blockLines > linesPerPage) && lineCount > 0) {
      const remaining = linesPerPage - lineCount;

      // Try to split character+dialogue blocks
      if (node.typeName === 'character' && blockEnd > i) {
        const charLines = node.spaceBefore + getTextLines(node.text, cplFor(node.typeName));

        const MIN_DL = 2; // FD: at least 2 lines of dialogue on each side of split

        // Can we fit character + at least 2 lines of dialogue?
        if (remaining >= charLines + MIN_DL) {
          let fittedLines = charLines;
          let lastFittedNode = i;
          let fittedDL = 0;
          for (let j = i + 1; j <= blockEnd; j++) {
            const dn = nodes[j];
            const dc = cplFor(dn.typeName);
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
            const dc = cplFor(dn.typeName);
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
              const dc = cplFor(dn.typeName);
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

    // v5.40: script content (anything that isn't a custom-page line or the
    // title region) marks the numbering as started — a custom run BEFORE any
    // of it plays the title page's part instead.
    if (!isCustomNode && !isTitleRegionNode) scriptSeen = true;

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
    const cpl = columnFor(typeName, layout).chars;
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
  /** v5.73: titlePage blocks only — which field this is ('title', 'title2',
   *  'author', 'draft', 'contact', 'copyright', 'date', 'blank'…). A preview
   *  needs it to reproduce the per-field alignment/weight the editor's
   *  `.title-page-<field>` CSS applies; without it a title page previews as
   *  body-indented left-aligned text. */
  titleField?: string;
  /** v5.73: the title/title2 custom point size when it isn't the default 12
   *  — the same attr TitlePage's renderHTML reads. */
  fontSizePt?: number;
  /** v5.73: screenplayImage blocks — the line budget the paginator gave the
   *  image, so a preview can reserve its real height instead of collapsing
   *  it to one blank line. */
  imageLines?: number;
}

export interface PageContentInfo {
  pageNumber: number;
  blocks: PageBlockInfo[];
  linesPerPage: number;
  /** v5.40: this page is a CUSTOM page — unnumbered; the Pages tool labels
   *  it "Custom" instead of a number. */
  isCustom?: boolean;
  /** v5.44: the custom page's run id — the Pages tool's drag / move /
   *  delete all address the run by this, never by position. */
  cpId?: string;
  /** v5.71: this page is the TITLE page — unnumbered (pageNumber 0), only
   *  emitted when the caller opts in (the Pages tool's All Pages tab).
   *  The default output keeps v5.13's rule: no title entry at all. */
  isTitle?: boolean;
}

/** v6.05: "after script page N" as a doc position — the next page's first
 *  block (doc end when N is the last page); 0 = before script page 1. The
 *  v5.44 boundary math, extracted PURE so the Pages tool and the Insert
 *  menu's Custom Page dialog resolve positions through ONE function. Null
 *  when no such script page exists. */
export function posAfterScriptPageIn(pages: PageContentInfo[], n: number, docEnd: number): number | null {
  const script = pages.filter((p) => !p.isTitle);
  if (n === 0) {
    const first = script.find((p) => p.blocks.length > 0);
    return first ? first.blocks[0].docPos : 0;
  }
  const idx = script.findIndex((p) => !p.isCustom && p.pageNumber === n);
  if (idx < 0) return null;
  for (let i = idx + 1; i < script.length; i++) {
    if (script[i].blocks.length > 0) return script[i].blocks[0].docPos;
  }
  return docEnd;
}

/**
 * Compute content blocks per page for page-preview thumbnails.
 * Uses the same break algorithm as the pagination plugin for accuracy.
 * `opts.includeTitlePage` (v5.71) re-emits the leading title region as an
 * unnumbered first page (isTitle, pageNumber 0) instead of discarding it.
 */
export function computePageBlocks(doc: PmNode, layout: PageLayout, opts?: { includeTitlePage?: boolean }): PageContentInfo[] {
  const { linesPerPage } = getPageMetrics(layout);
  const { breaks } = computeBreaks(doc, layout);

  // Collect top-level nodes. v5.73: title-page field + size and the image
  // line budget ride along — a preview can't reproduce the real title-page
  // layout from type name and text alone.
  const nodes: {
    typeName: string; text: string; offset: number; cpId?: string;
    titleField?: string; fontSizePt?: number; imageLines?: number;
  }[] = [];
  doc.forEach((node, offset) => {
    const typeName = node.type.name;
    const a = node.attrs as {
      cpId?: string; field?: string; tpTitleFontSize?: number;
      tpTitle2FontSize?: number; heightLines?: number;
    };
    const titleField = typeName === 'titlePage' ? (a?.field || 'title') : undefined;
    nodes.push({
      typeName,
      text: node.textContent || '',
      offset,
      cpId: typeName === 'customPage' ? (a?.cpId || undefined) : undefined,
      titleField,
      // v5.74: BOTH title and title2 keep their size in tpTitleFontSize —
      // that's what the layout builder writes onto a title2 node, and what
      // TitlePage's renderHTML, computeBreaks' line budget and the PDF
      // exporter all read. (v5.73 read title2's tpTitle2FontSize, which on a
      // real node is the untouched default: title2 previewed at 12pt.)
      fontSizePt: titleField === 'title' || titleField === 'title2'
        ? (Number(a?.tpTitleFontSize) || undefined) : undefined,
      imageLines: typeName === 'screenplayImage' ? Math.max(1, Number(a?.heightLines) || 8) : undefined,
    });
  });

  if (nodes.length === 0) return [];

  // Determine page boundaries from breaks
  const pageBounds: { pageNumber: number; startNode: number; endNode: number; dialogueSplit: boolean; isCustom?: boolean; isTitle?: boolean }[] = [];

  // v5.40: a leading custom run has no entering break — page 1 IS custom.
  const leadingCustom = nodes.length > 0 && nodes[0].typeName === 'customPage';

  if (breaks.length === 0) {
    pageBounds.push({ pageNumber: 1, startNode: 0, endNode: nodes.length - 1, dialogueSplit: false, isCustom: leadingCustom });
  } else {
    // Page 1
    if (breaks[0].nodeIndex > 0) {
      pageBounds.push({ pageNumber: 1, startNode: 0, endNode: breaks[0].nodeIndex - 1, dialogueSplit: false, isCustom: leadingCustom });
    }
    // Pages from breaks
    for (let i = 0; i < breaks.length; i++) {
      const endNode = i + 1 < breaks.length ? breaks[i + 1].nodeIndex - 1 : nodes.length - 1;
      pageBounds.push({
        pageNumber: breaks[i].pageNumber,
        startNode: breaks[i].nodeIndex,
        endNode,
        dialogueSplit: breaks[i].isDialogueSplit,
        isCustom: breaks[i].isCustomPage === true,
      });
    }
  }

  /* v5.13, Derek: "remove title page from the page tool" — reversing v5.01's
     "show the title page in Pages tool". The leading titlePage run is still
     CARVED off the front of page 1's bound (that split is what fixed the
     v4.95 "strange spacing" — title text laid out on top of the script's
     first page), but the carved bound is now DISCARDED instead of emitted as
     a page 0. The per-node guard below keeps stray titlePage nodes out of
     every script page either way.

     The split happens on the BOUNDS, not on `nodes`: breaks[].nodeIndex
     indexes that list, so removing entries would shift every later page. */
  /* v5.73: the region is the leading run of TITLE-REGION nodes — titlePage
     lines AND the images among them — which is exactly what computeBreaks
     treats as the title page (isTitleRegionNode: "leading images, when a
     title page exists, belong to the title page"). Scanning only titlePage
     nodes left a title-page logo on script page 1 in the preview while the
     editor drew it on the title page. The at-least-one-titlePage guard keeps
     a leading image in a title-less script exactly where it is: page 1. */
  let titleRunEnd = -1;
  let sawTitleNode = false;
  for (let i = 0; i < nodes.length; i++) {
    const t = nodes[i].typeName;
    if (t !== 'titlePage' && t !== 'screenplayImage') break;
    if (t === 'titlePage') sawTitleNode = true;
    titleRunEnd = i;
  }
  if (!sawTitleNode) titleRunEnd = -1;
  if (titleRunEnd >= 0 && pageBounds.length > 0 && pageBounds[0].startNode === 0) {
    const first = pageBounds[0];
    // In Preview the title page already HAS its own bound (computeBreaks
    // emits the title break) — drop it; otherwise trim the title run off the
    // front of page 1's bound.
    pageBounds.splice(0, 1, ...(first.endNode <= titleRunEnd ? [] : [{ ...first, startNode: titleRunEnd + 1 }]));
    // v5.71 opt-in: the carved region comes BACK as an unnumbered title
    // page — same carve, one more consumer, so the two can't disagree.
    if (opts?.includeTitlePage) {
      pageBounds.unshift({ pageNumber: 0, startNode: 0, endNode: titleRunEnd, dialogueSplit: false, isTitle: true });
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
      // No title-page node renders on any SCRIPT page (v5.13). This guard is
      // what stops one bleeding into script page 1 — the v4.95 "strange
      // spacing" — including titlePage nodes that sit mid-document. The
      // v5.71 title bound is the one place they DO render.
      if (node.typeName === 'titlePage' && !pb.isTitle) continue;
      const cpl = columnFor(node.typeName, layout).chars;
      const textLines = getTextLines(node.text, cpl);
      const sb = firstOnPage ? 0 : (SPACE_BEFORE[node.typeName] ?? 0);
      firstOnPage = false;

      blocks.push({
        typeName: node.typeName,
        lineStart: lineOnPage + sb,
        lineCount: textLines,
        docPos: node.offset,
        text: node.text,
        titleField: node.titleField,
        fontSizePt: node.fontSizePt,
        imageLines: node.imageLines,
      });
      lineOnPage += sb + textLines;
    }

    pages.push({
      pageNumber: pb.pageNumber,
      blocks,
      linesPerPage,
      isCustom: pb.isCustom,
      cpId: pb.isCustom ? nodes[pb.startNode]?.cpId : undefined,
      isTitle: pb.isTitle,
    });
  }

  return pages;
}
