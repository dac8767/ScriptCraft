// PDF exporter using jsPDF — renders script with Final Draft formatting
// All constants match pagination.ts and screenplay.css for exact visual parity
import jsPDF from 'jspdf';
import { isLeftTransition } from './transitions';
import type { JSONContent } from '@tiptap/react';
import { DEFAULT_HEADER_CONTENT, DEFAULT_FOOTER_CONTENT, resolveMoresContds } from '../stores/editorStore';
import type { PageLayout, HeaderFooterContent } from '../stores/editorStore';
import { resolveImageUrl, loadImageData } from './imageAsset';
import { isWorkingNoteNode } from './workingNotes';
import { stackTitlePageBlocks } from './titlePageLayout';
import {
  LINE_HEIGHT_PT, PTS_PER_INCH, FD_CHAR_WIDTH_PT, SPACE_BEFORE, columnFor,
} from './screenplayMetrics';

/* v6.32, Derek ("the text exports as Courier Std"): jsPDF's builtin
   'courier' is the PDF-standard font — viewers substitute Courier Std,
   which is NOT the face the app shows. The app's bundled Courier Prime
   TTFs (public/fonts, all four weights) are embedded into every export so
   paper matches screen. charSpace derives from getTextWidth('M'), so the
   10-cpi grid (screenplayMetrics, v6.33) holds whatever face installs. If
   the font files can't load (shouldn't happen — same origin), the builtin
   stays as a fallback rather than failing the export. */
const PRIME_STYLES: [string, string][] = [
  ['CourierPrime-Regular.ttf', 'normal'],
  ['CourierPrime-Bold.ttf', 'bold'],
  ['CourierPrime-Italic.ttf', 'italic'],
  ['CourierPrime-BoldItalic.ttf', 'bolditalic'],
];
let primeFontsB64: Map<string, string> | null | undefined;
async function loadPrimeFonts(): Promise<Map<string, string> | null> {
  if (primeFontsB64 !== undefined) return primeFontsB64;
  try {
    const entries = await Promise.all(PRIME_STYLES.map(async ([file]) => {
      const res = await fetch(`/fonts/${file}`);
      if (!res.ok) throw new Error(`${file}: ${res.status}`);
      const buf = new Uint8Array(await res.arrayBuffer());
      let bin = '';
      const CHUNK = 0x8000;
      for (let i = 0; i < buf.length; i += CHUNK) {
        bin += String.fromCharCode(...buf.subarray(i, i + CHUNK));
      }
      return [file, btoa(bin)] as [string, string];
    }));
    primeFontsB64 = new Map(entries);
  } catch (err) {
    console.warn('Courier Prime embed unavailable — exports fall back to builtin Courier:', err);
    primeFontsB64 = null;
  }
  return primeFontsB64;
}

/** Register Courier Prime on a jsPDF instance; returns the font NAME to use. */
async function installExportFont(pdf: jsPDF): Promise<string> {
  const fonts = await loadPrimeFonts();
  if (!fonts) return 'courier';
  for (const [file, style] of PRIME_STYLES) {
    pdf.addFileToVFS(file, fonts.get(file)!);
    pdf.addFont(file, 'CourierPrime', style);
  }
  return 'CourierPrime';
}

// --- Text geometry: ONE source, shared with the paginator (v6.33) ---
// src/utils/screenplayMetrics.ts holds the measured numbers: true 10 cpi
// Courier (7.2pt per character), full-width columns 1.5"→7.8" (63 chars —
// Derek's reference page, measured). columnFor() clamps those columns to the
// document's page layout, so imported/custom margins wrap identically here,
// on screen, and in the page count.

// Types that render in uppercase (CSS text-transform: uppercase)
const UPPERCASE_TYPES = new Set([
  'sceneHeading', 'character', 'transition', 'shot', 'newAct', 'endOfAct', 'castList',
]);

// Types that are centered (CSS text-align: center)
const CENTERED_TYPES = new Set(['newAct', 'endOfAct', 'showEpisode']);

// Types that are right-aligned (CSS text-align: right)
const RIGHT_ALIGNED_TYPES = new Set(['transition']);

// Types with inherent CSS styles applied by element class
const BOLD_TYPES = new Set(['sceneHeading', 'newAct', 'endOfAct', 'showEpisode']);
const ITALIC_TYPES = new Set(['lyrics']);
const UNDERLINE_TYPES = new Set(['newAct']);

// Dialogue-family types
const DIALOGUE_BLOCK_TYPES = new Set(['dialogue', 'parenthetical', 'lyrics']);

// --- Text run types ---

export interface TextRun {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

interface NodeInfo {
  typeName: string;
  runs: TextRun[];
  plainText: string;
  attrs?: Record<string, unknown>;
}

// --- Helpers ---

function extractRuns(node: JSONContent): TextRun[] {
  if (!node.content || node.content.length === 0) {
    return [{ text: '', bold: false, italic: false, underline: false }];
  }
  return node.content.map((child) => {
    const text = child.text || '';
    let bold = false, italic = false, underline = false;
    if (child.marks) {
      for (const mark of child.marks) {
        if (mark.type === 'bold') bold = true;
        if (mark.type === 'italic') italic = true;
        if (mark.type === 'underline') underline = true;
      }
    }
    return { text, bold, italic, underline };
  });
}

/** Apply type-level CSS styles (bold, italic, underline) to runs */
function applyTypeStyles(runs: TextRun[], typeName: string): TextRun[] {
  const forceBold = BOLD_TYPES.has(typeName);
  const forceItalic = ITALIC_TYPES.has(typeName);
  const forceUnderline = UNDERLINE_TYPES.has(typeName);
  if (!forceBold && !forceItalic && !forceUnderline) return runs;
  return runs.map(r => ({
    ...r,
    bold: r.bold || forceBold,
    italic: r.italic || forceItalic,
    underline: r.underline || forceUnderline,
  }));
}

function getPlainText(runs: TextRun[]): string {
  return runs.map((r) => r.text).join('');
}

/** The face every export text call uses — CourierPrime once installed,
 *  builtin courier only as the load-failure fallback (installExportFont). */
let EXPORT_FONT = 'courier';

function setFontStyle(pdf: jsPDF, bold: boolean, italic: boolean): void {
  if (bold && italic) {
    pdf.setFont(EXPORT_FONT, 'bolditalic');
  } else if (bold) {
    pdf.setFont(EXPORT_FONT, 'bold');
  } else if (italic) {
    pdf.setFont(EXPORT_FONT, 'italic');
  } else {
    pdf.setFont(EXPORT_FONT, 'normal');
  }
}

/**
 * Word-wrap text runs using character counting (monospace).
 * Same greedy fit as screenplayMetrics.getTextLines — the paginator's count
 * and these rendered lines must never disagree.
 */
export function wordWrapRuns(
  runs: TextRun[],
  maxChars: number,
  forceUppercase: boolean,
): TextRun[][] {
  interface Word {
    text: string;
    bold: boolean;
    italic: boolean;
    underline: boolean;
  }

  const words: Word[] = [];
  for (const run of runs) {
    const text = forceUppercase ? run.text.toUpperCase() : run.text;
    const parts = text.split(' ');
    for (let i = 0; i < parts.length; i++) {
      if (i > 0 && words.length > 0) {
        words[words.length - 1].text += ' ';
      }
      if (parts[i].length > 0) {
        words.push({
          text: parts[i],
          bold: run.bold,
          italic: run.italic,
          underline: run.underline,
        });
      }
    }
  }

  if (words.length === 0) {
    return [[{ text: '', bold: false, italic: false, underline: false }]];
  }

  const lines: TextRun[][] = [];
  let currentLine: TextRun[] = [];
  let currentLineChars = 0;

  const pushLine = () => {
    if (currentLine.length > 0) {
      const lastRun = currentLine[currentLine.length - 1];
      lastRun.text = lastRun.text.replace(/ +$/, '');
    }
    lines.push(currentLine);
    currentLine = [];
    currentLineChars = 0;
  };

  for (const word of words) {
    /* Each word carries its trailing space (the gap to the NEXT word), so the
       fit decision must use the VISIBLE length only. Counting that space made
       every full line wrap one word early (v6.33, Derek's "of" on a third
       row) — the paginator's getTextLines never counted it. */
    const visLen = word.text.replace(/ +$/, '').length;
    if (currentLine.length > 0 && currentLineChars + visLen > maxChars) {
      pushLine();
    }
    let text = currentLine.length === 0 ? word.text.replace(/^ +/, '') : word.text;
    // A single word longer than the column hard-splits — the paginator counts
    // it that way, and a browser breaks the overflow too.
    while (currentLine.length === 0 && text.replace(/ +$/, '').length > maxChars) {
      lines.push([{ text: text.slice(0, maxChars), bold: word.bold, italic: word.italic, underline: word.underline }]);
      text = text.slice(maxChars);
    }
    if (text.replace(/ +$/, '').length === 0 && currentLine.length === 0) continue;
    const last = currentLine[currentLine.length - 1];
    if (last && last.bold === word.bold && last.italic === word.italic && last.underline === word.underline) {
      last.text += text;
    } else {
      currentLine.push({ text, bold: word.bold, italic: word.italic, underline: word.underline });
    }
    currentLineChars += text.length;
  }

  if (currentLine.length > 0) pushLine();

  return lines.length > 0 ? lines : [[{ text: '', bold: false, italic: false, underline: false }]];
}

/**
 * Render a line of TextRun segments at (x, y), using FD Courier character spacing.
 */
function renderLine(
  pdf: jsPDF,
  lineRuns: TextRun[],
  x: number,
  y: number,
  charSpace: number,
): void {
  let cursorX = x;
  for (const run of lineRuns) {
    if (run.text.length === 0) continue;
    setFontStyle(pdf, run.bold, run.italic);
    pdf.text(run.text, cursorX, y, { charSpace });
    const w = run.text.length * FD_CHAR_WIDTH_PT;
    if (run.underline) {
      const ulY = y + 1.5;
      pdf.setLineWidth(0.5);
      pdf.line(cursorX, ulY, cursorX + w, ulY);
    }
    cursorX += w;
  }
}

// --- Main export function ---

export interface PDFExportOptions {
  sceneNumbersVisible?: boolean;
  /** Document title for header/footer {title} field */
  documentTitle?: string;
  /** Current revision color for {revision} field */
  revisionColor?: string;
  /** v6.29, Derek ("printing a page shrinks the actual page down"): PRINT
   *  through this exporter instead of window.print(). WKWebView ignores the
   *  print stylesheet's `@page margin: 0`, so the OS dialog laid our full
   *  page inside its own printer margins and scaled it to fit (his sample:
   *  everything ×0.74, "double margins"). With `print`, the SAME
   *  exact-layout PDF opens with the print dialog queued instead of saving
   *  to a file — one rendering path for paper and file. */
  print?: boolean;
}

/** Resolve dynamic field placeholders in header/footer text */
function resolveFields(
  text: string,
  pageNum: number,
  totalPages: number,
  title: string,
  revisionColor: string,
): string {
  if (!text) return '';
  return text
    .replace(/\{page\}/gi, String(pageNum))
    .replace(/\{pages\}/gi, String(totalPages))
    .replace(/\{title\}/gi, title)
    .replace(/\{date\}/gi, new Date().toLocaleDateString())
    .replace(/\{revision\}/gi, revisionColor);
}

export async function exportPDF(doc: JSONContent, title: string, layout: PageLayout, options?: PDFExportOptions): Promise<void> {
  const { saveFile } = await import('./fileOps');
  const filename = `${sanitizeFilename(title)}.pdf`;

  if (!doc || !doc.content || doc.content.length === 0) {
    const pdf = new jsPDF({
      unit: 'pt',
      format: [layout.pageWidth * PTS_PER_INCH, layout.pageHeight * PTS_PER_INCH],
    });
    await saveFile(new Uint8Array(pdf.output('arraybuffer')), filename, [{ name: 'PDF', extensions: ['pdf'] }]);
    return;
  }

  const pageWidthPt = layout.pageWidth * PTS_PER_INCH;
  const pageHeightPt = layout.pageHeight * PTS_PER_INCH;
  const topMarginPt = layout.topMargin;
  const bottomMarginPt = layout.bottomMargin;
  const usableBottomPt = pageHeightPt - bottomMarginPt;
  // "Mores & Continueds" config for page-break (MORE)/(CONT'D) markers.
  const mc = resolveMoresContds(layout);

  const pdf = new jsPDF({
    unit: 'pt',
    format: [pageWidthPt, pageHeightPt],
  });

  // Embed Courier Prime BEFORE anything measures — charSpace derives from
  // getTextWidth below, so the layout adapts to whichever face installed.
  EXPORT_FONT = await installExportFont(pdf);
  pdf.setFont(EXPORT_FONT, 'normal');
  pdf.setFontSize(12);

  // Character pitch: true 10 cpi (7.2pt/char, the measured reference). With
  // Courier Prime's natural 0.6em advance this is 0 — no tracking. It stays
  // a derivation so a fallback face with different metrics still lands on
  // the exact 10-cpi grid the layout math assumes.
  const baseCharWidth = pdf.getTextWidth('M');
  const charSpace = FD_CHAR_WIDTH_PT - baseCharWidth;

  // Build the body node list, separating the title-page region: the leading run
  // of titlePage + image nodes. The title page renders its nodes in DOCUMENT
  // ORDER (free-flow / WYSIWYG), matching the editor and DOCX.
  const nodes: NodeInfo[] = [];
  interface TitleItem { kind: 'text' | 'image'; field?: string; text?: string; titleSize?: number; attrs?: Record<string, unknown>; }
  const titleItems: TitleItem[] = [];
  let inLeadingRegion = true;
  let hasTitlePage = false;
  for (const node of doc.content) {
    const typeName = node.type || 'general';
    if (inLeadingRegion && (typeName === 'titlePage' || typeName === 'screenplayImage')) {
      if (typeName === 'titlePage') {
        if (node.attrs?.field === 'title' && node.attrs?.tpTitle) hasTitlePage = true;
        titleItems.push({
          kind: 'text',
          field: (node.attrs?.field as string) || 'title',
          text: getPlainText(extractRuns(node)),
          titleSize: Number(node.attrs?.tpTitleFontSize) || 12,
        });
      } else {
        titleItems.push({ kind: 'image', attrs: (node.attrs || {}) as Record<string, unknown> });
      }
      continue;
    }
    inLeadingRegion = false;
    // Working notes (# sections, ⚑ markers, [ ] to-dos) never export — §4.
    if (isWorkingNoteNode(node)) continue;
    const rawRuns = extractRuns(node);
    const runs = applyTypeStyles(rawRuns, typeName);
    nodes.push({
      typeName,
      runs,
      plainText: getPlainText(rawRuns),
      attrs: node.attrs as Record<string, unknown> | undefined,
    });
  }
  // No real title page → leading images are top-of-body content; restore them.
  if (!hasTitlePage && titleItems.length > 0) {
    const restored: NodeInfo[] = titleItems
      .filter((it) => it.kind === 'image')
      .map((it) => ({ typeName: 'screenplayImage', runs: [], plainText: '', attrs: it.attrs }));
    nodes.unshift(...restored);
    titleItems.length = 0;
  }

  let currentY = topMarginPt;
  let pageNumber = 1;
  let isFirstElement = true;

  // Pre-load title-page images (rendered in document order).
  const titleImgData = new Map<number, { dataUrl: string; wPt: number; hPt: number }>();
  if (hasTitlePage) {
    const contentW = pageWidthPt - (layout.leftMargin + layout.rightMargin) * PTS_PER_INCH;
    for (let k = 0; k < titleItems.length; k++) {
      const it = titleItems[k];
      if (it.kind !== 'image') continue;
      const url = resolveImageUrl(it.attrs || {});
      if (!url) continue;
      const d = await loadImageData(url);
      if (!d) continue;
      const widthPx = Number(it.attrs?.width) || 0;
      let wPt = widthPx > 0 ? widthPx * 0.75 : Math.min(d.width * 0.75, contentW * 0.6);
      wPt = Math.min(wPt, contentW);
      titleImgData.set(k, { dataUrl: d.dataUrl, wPt, hPt: wPt * (d.height / (d.width || 1)) });
    }
  }

  // Render the title page in document order (free-flow), top-to-bottom.
  if (hasTitlePage) {
    const centerX = pageWidthPt / 2;
    const leftX = layout.leftMargin * PTS_PER_INCH;
    const rightX = pageWidthPt - layout.rightMargin * PTS_PER_INCH;
    const bottom = pageHeightPt - bottomMarginPt;

    /* v7.09, Derek ("i exported a title page as a pdf and it did not export
       all of the information"): the title page is a LINE GRID — the builder
       in utils/titlePageLayout positions everything by emitting blank lines.
       This loop used to add 4pt "a small gap between elements" after EVERY
       block, blanks included: ~180pt across a title page's ~45 blocks, which
       slid the draft / contact / copyright / notes block off the bottom,
       where the fit check below dropped it without a word. The stacking is
       stackTitlePageBlocks' job now — one grid walk, shared with its test —
       and this loop only draws. */
    const lineHOf = (it: TitleItem) => (it.field === 'title' ? (it.titleSize || 12) : LINE_HEIGHT_PT);
    const placed = stackTitlePageBlocks(
      titleItems.map((it, k) => {
        if (it.kind === 'image') {
          const im = titleImgData.get(k);
          return { blank: false, heightPt: im ? im.hPt + 6 : 0 };
        }
        const lines = Math.max(1, (it.text || '').split('\n').length);
        return { blank: !(it.text || '').trim(), heightPt: lines * lineHOf(it) };
      }),
      bottom - topMarginPt,
      LINE_HEIGHT_PT,
    );

    for (let k = 0; k < titleItems.length; k++) {
      if (placed[k].skipped) continue;
      const it = titleItems[k];
      let y = topMarginPt + placed[k].y;
      if (it.kind === 'image') {
        const im = titleImgData.get(k);
        if (!im || y + im.hPt > bottom) continue;
        const align = (it.attrs?.align as string) || 'center';
        const x = align === 'left' ? leftX : align === 'right' ? rightX - im.wPt : centerX - im.wPt / 2;
        pdf.addImage(im.dataUrl, 'PNG', x, y, im.wPt, im.hPt);
      } else {
        const isTitle = it.field === 'title';
        const align: 'left' | 'center' | 'right' =
          it.field === 'draft' ? 'left' : (it.field === 'contact' || it.field === 'copyright') ? 'right' : 'center';
        const lineH = lineHOf(it);
        pdf.setFont(EXPORT_FONT, isTitle ? 'bold' : 'normal');
        pdf.setFontSize(isTitle ? (it.titleSize || 12) : 12);
        const x = align === 'left' ? leftX : align === 'right' ? rightX : centerX;
        for (const line of (it.text || '').split('\n')) {
          if (line && y + lineH <= bottom) pdf.text(isTitle ? line.toUpperCase() : line, x, y + lineH, { align });
          y += lineH;
        }
        pdf.setFontSize(12);
      }
    }

    // Start page 2 for the script
    pdf.addPage([pageWidthPt, pageHeightPt]);
    pageNumber = 2;
    currentY = topMarginPt;
  }

  function newPage(): void {
    pdf.addPage([pageWidthPt, pageHeightPt]);
    pageNumber++;
    currentY = topMarginPt;
  }

  // Pre-load inserted images (async) so the render loop below stays synchronous.
  const contentWidthPt = pageWidthPt - (layout.leftMargin + layout.rightMargin) * PTS_PER_INCH;
  const imageMap = new Map<number, { dataUrl: string; wPt: number; hPt: number; align: string }>();
  for (let k = 0; k < nodes.length; k++) {
    if (nodes[k].typeName !== 'screenplayImage') continue;
    const attrs = (nodes[k].attrs || {}) as Record<string, unknown>;
    const url = resolveImageUrl(attrs);
    if (!url) continue;
    const d = await loadImageData(url);
    if (!d) continue;
    const widthPx = Number(attrs.width) || 0;
    let wPt = widthPx > 0 ? widthPx * 0.75 : Math.min(d.width * 0.75, contentWidthPt * 0.9);
    wPt = Math.min(wPt, contentWidthPt);
    const hPt = wPt * (d.height / (d.width || 1));
    imageMap.set(k, { dataUrl: d.dataUrl, wPt, hPt, align: (attrs.align as string) || 'center' });
  }

  // Process each node
  let i = 0;
  while (i < nodes.length) {
    const node = nodes[i];
    const typeName = node.typeName;

    // Inserted image — place it, paginating if it doesn't fit.
    if (typeName === 'screenplayImage') {
      const img = imageMap.get(i);
      if (img) {
        const sbPt = isFirstElement ? 0 : LINE_HEIGHT_PT;
        if (currentY + sbPt + img.hPt > pageHeightPt - bottomMarginPt && currentY > topMarginPt) {
          newPage();
        } else {
          currentY += sbPt;
        }
        const contentLeft = layout.leftMargin * PTS_PER_INCH;
        const contentRight = pageWidthPt - layout.rightMargin * PTS_PER_INCH;
        let x = contentLeft;
        if (img.align === 'center') x = (contentLeft + contentRight) / 2 - img.wPt / 2;
        else if (img.align === 'right') x = contentRight - img.wPt;
        pdf.addImage(img.dataUrl, 'PNG', x, currentY, img.wPt, img.hPt);
        currentY += img.hPt;
        isFirstElement = false;
      }
      i++;
      continue;
    }
    /* v6.30: FADE IN: is the OPENING transition — action margin, action
       width, left-aligned (utils/transitions; the editor decoration and
       this branch share the predicate). Every other transition keeps the
       5.5in column and right alignment. */
    const fadeIn = typeName === 'transition'
      && isLeftTransition(node.runs.map((r) => r.text).join(''));
    const col = columnFor(fadeIn ? 'action' : typeName, layout);
    const leftPt = col.leftIn * PTS_PER_INCH;
    const rightPt = col.rightIn * PTS_PER_INCH;
    const maxChars = col.chars;
    const forceUpper = UPPERCASE_TYPES.has(typeName);

    const spaceBefore = isFirstElement ? 0 : (SPACE_BEFORE[typeName] ?? 0);
    const spaceBeforePt = spaceBefore * LINE_HEIGHT_PT;

    const wrappedLines = wordWrapRuns(node.runs, maxChars, forceUpper);
    const elementHeightPt = wrappedLines.length * LINE_HEIGHT_PT;
    const totalHeightPt = spaceBeforePt + elementHeightPt;

    // Check if this is a character node starting a dialogue block
    let isDialogueBlock = false;
    let dialogueBlockNodes: number[] = [];
    let dialogueBlockHeight = totalHeightPt;

    if (typeName === 'character') {
      isDialogueBlock = true;
      dialogueBlockNodes = [i];
      let j = i + 1;
      while (j < nodes.length && DIALOGUE_BLOCK_TYPES.has(nodes[j].typeName)) {
        const dNode = nodes[j];
        const dMaxChars = columnFor(dNode.typeName, layout).chars;
        const dSb = (SPACE_BEFORE[dNode.typeName] ?? 0) * LINE_HEIGHT_PT;
        const dLines = wordWrapRuns(dNode.runs, dMaxChars, UPPERCASE_TYPES.has(dNode.typeName));
        dialogueBlockHeight += dSb + dLines.length * LINE_HEIGHT_PT;
        dialogueBlockNodes.push(j);
        j++;
      }
    }

    // Scene heading: try to keep with the next element
    let keepWithNext = false;
    let nextElementHeight = 0;
    if (typeName === 'sceneHeading' && i + 1 < nodes.length) {
      keepWithNext = true;
      const nNode = nodes[i + 1];
      const nMaxChars = columnFor(nNode.typeName, layout).chars;
      const nSb = (SPACE_BEFORE[nNode.typeName] ?? 0) * LINE_HEIGHT_PT;
      const nLines = wordWrapRuns(nNode.runs, nMaxChars, UPPERCASE_TYPES.has(nNode.typeName));
      nextElementHeight = nSb + nLines.length * LINE_HEIGHT_PT;
    }

    // Determine if we need a page break
    const projectedY = currentY + spaceBeforePt + elementHeightPt;

    if (isDialogueBlock && currentY + dialogueBlockHeight > usableBottomPt && currentY > topMarginPt + LINE_HEIGHT_PT) {
      // Try to split dialogue block across pages
      const remaining = usableBottomPt - currentY;

      // Can we fit at least the character name + 2 lines of dialogue?
      const charHeight = spaceBeforePt + elementHeightPt;
      const MIN_DIALOGUE_LINES = 2;
      const minSplitHeight = charHeight + MIN_DIALOGUE_LINES * LINE_HEIGHT_PT;

      if (remaining >= minSplitHeight) {
        // Render character name
        currentY += spaceBeforePt;
        renderElement(pdf, wrappedLines, leftPt, rightPt, currentY, typeName, charSpace);
        currentY += elementHeightPt;
        isFirstElement = false;

        // Render as many dialogue/parenthetical nodes as fit
        let dIdx = 1;

        while (dIdx < dialogueBlockNodes.length) {
          const dNodeIdx = dialogueBlockNodes[dIdx];
          const dNode = nodes[dNodeIdx];
          const dCol = columnFor(dNode.typeName, layout);
          const dLeftPt = dCol.leftIn * PTS_PER_INCH;
          const dRightPt = dCol.rightIn * PTS_PER_INCH;
          const dMaxChars = dCol.chars;
          const dSb = (SPACE_BEFORE[dNode.typeName] ?? 0) * LINE_HEIGHT_PT;
          const dWrapped = wordWrapRuns(dNode.runs, dMaxChars, UPPERCASE_TYPES.has(dNode.typeName));
          const dHeight = dSb + dWrapped.length * LINE_HEIGHT_PT;

          if (currentY + dHeight > usableBottomPt) {
            break;
          }

          currentY += dSb;
          renderElement(pdf, dWrapped, dLeftPt, dRightPt, currentY, dNode.typeName, charSpace);
          currentY += dWrapped.length * LINE_HEIGHT_PT;
          dIdx++;
        }

        // Check if we still have dialogue nodes to render on next page
        if (dIdx < dialogueBlockNodes.length) {
          // Render (MORE) indicator
          const moreLeftPt = columnFor('character', layout).leftIn * PTS_PER_INCH;
          if (mc.dialogueBreakContd && currentY + LINE_HEIGHT_PT <= usableBottomPt) {
            setFontStyle(pdf, false, false);
            pdf.text(mc.moreText, moreLeftPt, currentY + LINE_HEIGHT_PT, { charSpace });
          }

          newPage();

          // Render CONT'D character name
          const charName = node.plainText.trim().toUpperCase();
          const contdLeftPt = columnFor('character', layout).leftIn * PTS_PER_INCH;
          if (mc.dialogueBreakContd) {
            setFontStyle(pdf, false, false);
            pdf.text(`${charName} ${mc.contdText}`, contdLeftPt, currentY + LINE_HEIGHT_PT, { charSpace });
            currentY += LINE_HEIGHT_PT;
          }

          // Render remaining dialogue nodes
          while (dIdx < dialogueBlockNodes.length) {
            const dNodeIdx = dialogueBlockNodes[dIdx];
            const dNode = nodes[dNodeIdx];
            const dCol = columnFor(dNode.typeName, layout);
            const dLeftPt = dCol.leftIn * PTS_PER_INCH;
            const dRightPt = dCol.rightIn * PTS_PER_INCH;
            const dMaxChars = dCol.chars;
            const dSb = (SPACE_BEFORE[dNode.typeName] ?? 0) * LINE_HEIGHT_PT;
            const dWrapped = wordWrapRuns(dNode.runs, dMaxChars, UPPERCASE_TYPES.has(dNode.typeName));
            const dHeight = dSb + dWrapped.length * LINE_HEIGHT_PT;

            // Check for another page break within continued dialogue
            if (currentY + dHeight > usableBottomPt) {
              if (mc.dialogueBreakContd && currentY + LINE_HEIGHT_PT <= usableBottomPt) {
                setFontStyle(pdf, false, false);
                pdf.text(mc.moreText, contdLeftPt, currentY + LINE_HEIGHT_PT, { charSpace });
              }
              newPage();
              if (mc.dialogueBreakContd) {
                setFontStyle(pdf, false, false);
                pdf.text(`${charName} ${mc.contdText}`, contdLeftPt, currentY + LINE_HEIGHT_PT, { charSpace });
                currentY += LINE_HEIGHT_PT;
              }
            }

            currentY += dSb;
            renderElement(pdf, dWrapped, dLeftPt, dRightPt, currentY, dNode.typeName, charSpace);
            currentY += dWrapped.length * LINE_HEIGHT_PT;
            dIdx++;
          }
        }

        // Skip past all dialogue block nodes
        i = dialogueBlockNodes[dialogueBlockNodes.length - 1] + 1;
        continue;
      } else {
        // Not enough room to split — push entire block to next page
        newPage();
      }
    } else if (keepWithNext && projectedY + nextElementHeight > usableBottomPt && currentY > topMarginPt + LINE_HEIGHT_PT) {
      // Scene heading won't fit with at least its next element — push to next page
      newPage();
    } else if (projectedY > usableBottomPt && currentY > topMarginPt + LINE_HEIGHT_PT) {
      // Regular page break
      newPage();
    }

    // Apply space before
    if (!isFirstElement) {
      currentY += spaceBeforePt;
    }

    // Render the element
    renderElement(pdf, wrappedLines, leftPt, rightPt, currentY, typeName, charSpace);

    // Render scene numbers on both sides if enabled
    if (typeName === 'sceneHeading' && options?.sceneNumbersVisible && node.attrs?.sceneNumber) {
      const sceneNum = String(node.attrs.sceneNumber);
      const y = currentY + LINE_HEIGHT_PT; // baseline of first line
      setFontStyle(pdf, true, false); // bold like scene heading
      pdf.setFontSize(12);
      // Both sides anchor 0.15in off the heading column — the same geometry
      // as the editor's ::before/::after scene numbers.
      const hCol = columnFor('sceneHeading', layout);
      const numWidth = sceneNum.length * FD_CHAR_WIDTH_PT;
      const leftNumX = (hCol.leftIn - 0.15) * PTS_PER_INCH - numWidth;
      pdf.text(sceneNum, leftNumX, y, { charSpace });
      const rightNumX = (hCol.rightIn + 0.15) * PTS_PER_INCH;
      pdf.text(sceneNum, rightNumX, y, { charSpace });
    }

    currentY += elementHeightPt;
    isFirstElement = false;

    // If this is a dialogue block, render the rest of the block
    if (isDialogueBlock && dialogueBlockNodes.length > 1) {
      for (let dIdx = 1; dIdx < dialogueBlockNodes.length; dIdx++) {
        const dNodeIdx = dialogueBlockNodes[dIdx];
        const dNode = nodes[dNodeIdx];
        const dCol = columnFor(dNode.typeName, layout);
        const dLeftPt = dCol.leftIn * PTS_PER_INCH;
        const dRightPt = dCol.rightIn * PTS_PER_INCH;
        const dMaxChars = dCol.chars;
        const dSb = (SPACE_BEFORE[dNode.typeName] ?? 0) * LINE_HEIGHT_PT;
        const dWrapped = wordWrapRuns(dNode.runs, dMaxChars, UPPERCASE_TYPES.has(dNode.typeName));

        currentY += dSb;
        renderElement(pdf, dWrapped, dLeftPt, dRightPt, currentY, dNode.typeName, charSpace);
        currentY += dWrapped.length * LINE_HEIGHT_PT;
      }
      i = dialogueBlockNodes[dialogueBlockNodes.length - 1] + 1;
      continue;
    }

    i++;
  }

  // Final pass: render headers and footers on all pages (now that totalPages is known)
  const totalPages = pageNumber;
  const hContent = layout.headerContent || DEFAULT_HEADER_CONTENT;
  const fContent = layout.footerContent || DEFAULT_FOOTER_CONTENT;
  const hStart = layout.headerStartPage ?? 2;
  const fStart = layout.footerStartPage ?? 1;
  const docTitle = options?.documentTitle || title;
  const revColor = options?.revisionColor || '';

  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);
    // Header
    if (p >= hStart && (hContent.left || hContent.center || hContent.right)) {
      // v4.72, Derek's margin diagram: jsPDF's y is the BASELINE, and the
      // page number sits ON the header line (headerMargin — half the top
      // margin, 0.5in by default). The old +12 treated y as the text top and
      // pushed the number 12pt below the line.
      const headerY = layout.headerMargin;
      renderHFLine(pdf, hContent, p, totalPages, docTitle, revColor, headerY, layout, charSpace);
    }
    // Footer
    if (p >= fStart && (fContent.left || fContent.center || fContent.right)) {
      const footerY = pageHeightPt - layout.footerMargin;
      renderHFLine(pdf, fContent, p, totalPages, docTitle, revColor, footerY, layout, charSpace);
    }
  }

  if (options?.print) {
    pdf.autoPrint();
    const url = String(pdf.output('bloburl'));   // jsPDF types this as URL; DOM wants string
    /* v6.30, Derek ("clicking File > Print does nothing"): Tauri BLOCKS
       window.open — it returns null WITHOUT throwing, so v6.29's popup
       silently vanished there (fine in a browser). Cascade, nothing silent:
       (1) popup where allowed; (2) blocked → a hidden iframe holds the SAME
       PDF and prints it — WebKit prints a PDF frame at the PDF's own page
       size, not reflowed HTML, so no shrink; (3) the frame never loads →
       save the print copy through the proven export dialog and SAY SO. */
    /* The Tauri print saga, in order (each step was Derek-rejected):
       v6.29 popup → window.open returns null silently; v6.30 iframe →
       WKWebView renders no PDFs in frames; v6.32 save+toast → "did not
       open the print menu"; v6.33 openPath → "it opens it in a pdf view
       first. it should not do that."
       v6.36: the shell's print_pdf_dialog command runs the REAL macOS
       print dialog on the just-written export via PDFKit — no viewer in
       between. Fallbacks, nothing silent: command refuses (non-mac /
       stale shell) → openPath into the OS viewer + toast; that fails →
       the save dialog + toast. (Browsers keep the real popup print
       below.) */
    const { isDesktopTauri } = await import('../services/platform');
    if (isDesktopTauri()) {
      const { showToast } = await import('../components/Toast');
      try {
        const [{ writeFile, mkdir, exists, BaseDirectory }, { appDataDir }] = await Promise.all([
          import('@tauri-apps/plugin-fs'),
          import('@tauri-apps/api/path'),
        ]);
        if (!(await exists('print', { baseDir: BaseDirectory.AppData }))) {
          await mkdir('print', { baseDir: BaseDirectory.AppData, recursive: true });
        }
        await writeFile(`print/${filename}`, new Uint8Array(pdf.output('arraybuffer')), { baseDir: BaseDirectory.AppData });
        const fullPath = `${await appDataDir()}/print/${filename}`;
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          await invoke('print_pdf_dialog', { path: fullPath });
          return; // the system print dialog is up — nothing else to say
        } catch (e) {
          console.error('Native print dialog unavailable, opening the viewer instead:', e);
          const { openPath } = await import('@tauri-apps/plugin-opener');
          await openPath(fullPath);
          showToast('Opened in your PDF viewer — press ⌘P there to print.', 'info');
        }
      } catch (e) {
        console.error('Print open failed, falling back to the save dialog:', e);
        await saveFile(new Uint8Array(pdf.output('arraybuffer')), filename, [{ name: 'PDF', extensions: ['pdf'] }]);
        showToast('Print-ready PDF saved — open it and press ⌘P to print.', 'info');
      }
      return;
    }
    const win = window.open(url, '_blank');
    if (win) return;
    await new Promise<void>((resolve) => {
      const frame = document.createElement('iframe');
      frame.setAttribute('data-print-frame', '1');
      frame.style.cssText = 'position:fixed;right:0;bottom:0;width:2px;height:2px;visibility:hidden;';
      let settled = false;
      const giveUp = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        frame.remove();
        void saveFile(new Uint8Array(pdf.output('arraybuffer')), filename, [{ name: 'PDF', extensions: ['pdf'] }])
          .then(async () => {
            const { showToast } = await import('../components/Toast');
            showToast('Print preview unavailable — saved a print-ready PDF instead. Open it and press ⌘P.', 'info');
          })
          .finally(() => resolve());
      }, 2500);
      frame.onload = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(giveUp);
        try {
          frame.contentWindow?.focus();
          frame.contentWindow?.print();
        } catch {
          frame.remove();
        }
        resolve();
      };
      frame.src = url;
      document.body.appendChild(frame);
    });
    return;
  }
  await saveFile(new Uint8Array(pdf.output('arraybuffer')), filename, [{ name: 'PDF', extensions: ['pdf'] }]);
}

// --- Render helpers ---

/** Render a three-part header or footer line (left, center, right) */
function renderHFLine(
  pdf: jsPDF,
  content: HeaderFooterContent,
  pageNum: number,
  totalPages: number,
  title: string,
  revisionColor: string,
  y: number,
  layout: PageLayout,
  charSpace: number,
): void {
  const leftMarginPt = layout.leftMargin * PTS_PER_INCH;
  const rightMarginPt = (layout.pageWidth - layout.rightMargin) * PTS_PER_INCH;
  const centerPt = (leftMarginPt + rightMarginPt) / 2;

  setFontStyle(pdf, false, false);
  pdf.setFontSize(12);

  // Left
  const leftText = resolveFields(content.left, pageNum, totalPages, title, revisionColor);
  if (leftText) {
    pdf.text(leftText, leftMarginPt, y, { charSpace });
  }

  // Center
  const centerText = resolveFields(content.center, pageNum, totalPages, title, revisionColor);
  if (centerText) {
    const cWidth = centerText.length * FD_CHAR_WIDTH_PT;
    pdf.text(centerText, centerPt - cWidth / 2, y, { charSpace });
  }

  // Right — the page-number slot. v4.72, Derek's diagram: the right margin
  // splits in half too; the field is CENTERED between the margin line and
  // the line 0.5in from the page edge (0.75in from the edge at the default
  // 1in margin). Same rule as .page-sep-hf-right in the editor.
  const rightText = resolveFields(content.right, pageNum, totalPages, title, revisionColor);
  if (rightText) {
    const rWidth = rightText.length * FD_CHAR_WIDTH_PT;
    const pageWidthPt = layout.pageWidth * PTS_PER_INCH;
    const bandCenter = pageWidthPt - ((layout.rightMargin + 0.5) / 2) * PTS_PER_INCH;
    pdf.text(rightText, bandCenter - rWidth / 2, y, { charSpace });
  }
}


function renderElement(
  pdf: jsPDF,
  wrappedLines: TextRun[][],
  leftPt: number,
  rightPt: number,
  startY: number,
  typeName: string,
  charSpace: number,
): void {
  const isCentered = CENTERED_TYPES.has(typeName);
  /* v6.30: FADE IN: is the opening transition — LEFT margin (same
     predicate as the editor's decoration, utils/transitions). */
  const firstLineText = wrappedLines[0]?.map((r) => r.text).join('') ?? '';
  const isRightAligned = RIGHT_ALIGNED_TYPES.has(typeName) && !isLeftTransition(firstLineText);
  const maxWidthPt = rightPt - leftPt;

  for (let lineIdx = 0; lineIdx < wrappedLines.length; lineIdx++) {
    const lineRuns = wrappedLines[lineIdx];
    const y = startY + (lineIdx + 1) * LINE_HEIGHT_PT; // +1 because jsPDF text baseline

    if (isCentered) {
      const totalChars = lineRuns.reduce((sum, r) => sum + r.text.length, 0);
      const totalWidth = totalChars * FD_CHAR_WIDTH_PT;
      const centerX = leftPt + (maxWidthPt - totalWidth) / 2;
      renderLine(pdf, lineRuns, centerX, y, charSpace);
    } else if (isRightAligned) {
      const totalChars = lineRuns.reduce((sum, r) => sum + r.text.length, 0);
      const totalWidth = totalChars * FD_CHAR_WIDTH_PT;
      const rightX = rightPt - totalWidth;
      renderLine(pdf, lineRuns, rightX, y, charSpace);
    } else {
      renderLine(pdf, lineRuns, leftPt, y, charSpace);
    }
  }
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\- ]/g, '') || 'Untitled';
}
