/**
 * PDF import (v2.79) — turn a screenplay PDF's text layer back into an
 * editable script.
 *
 * A PDF has no elements, only positioned glyphs — so this is a
 * reconstruction, not a lossless read:
 *   1. pdf.js extracts text runs with x/y positions (worker bundled locally,
 *      nothing fetched — the desktop app must work offline).
 *   2. Runs are grouped into visual lines by y, lines into paragraphs by
 *      vertical gaps.
 *   3. Each paragraph is classified by its INDENT relative to the document's
 *      dominant left margin — the standard screenplay layout puts dialogue
 *      ~1.0" right of action, parentheticals ~1.5", characters ~2.0",
 *      transitions far right. Scene headings are caught by prefix.
 * Scanned PDFs have no text layer at all — that surfaces as a clear error,
 * not an empty script.
 */
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { classifyParagraph } from './pdfClassify';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

interface PdfLine { x: number; y: number; page: number; text: string; h: number }

export interface PdfImportResult {
  doc: { type: 'doc'; content: Array<{ type: string; content?: Array<{ type: 'text'; text: string }> }> };
  warnings: string[];
  pages: number;
}

function node(type: string, text: string) {
  return text
    ? { type, content: [{ type: 'text' as const, text }] }
    : { type };
}

export async function parsePdfScreenplay(data: ArrayBuffer): Promise<PdfImportResult> {
  const warnings: string[] = [];
  const pdf = await pdfjs.getDocument({ data }).promise;

  // ── 1. text runs → visual lines ──
  const lines: PdfLine[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    // Bucket runs by rounded y; PDFs place each word (or fragment) separately.
    const byY = new Map<number, { x: number; text: string; h: number }[]>();
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      const x = item.transform[4];
      const y = Math.round(item.transform[5] / 3) * 3;   // 3pt buckets absorb baseline jitter
      if (!byY.has(y)) byY.set(y, []);
      byY.get(y)!.push({ x, text: item.str, h: item.height || 12 });
    }
    for (const [y, runs] of byY) {
      runs.sort((a, b) => a.x - b.x);
      const text = runs.map((r) => r.text).join(' ').replace(/\s+/g, ' ').trim();
      if (!text) continue;
      lines.push({ x: runs[0].x, y, page: p, text, h: runs[0].h });
    }
  }
  if (lines.length === 0) {
    throw new Error('This PDF has no selectable text — it is likely a scan. OCR it first, then import.');
  }

  // Reading order: page, then top-to-bottom (PDF y grows upward).
  lines.sort((a, b) => (a.page - b.page) || (b.y - a.y));

  // Drop page numbers and MORE/CONT'D artifacts.
  const body = lines.filter((l) => {
    if (/^\d+\.?$/.test(l.text)) return false;
    if (/^\(?(MORE|CONT'D|CONTINUED:?)\)?\.?$/i.test(l.text)) return false;
    return true;
  });

  // ── 2. the action margin = the most common left x ──
  const xCounts = new Map<number, number>();
  for (const l of body) {
    const bucket = Math.round(l.x / 4) * 4;
    xCounts.set(bucket, (xCounts.get(bucket) ?? 0) + 1);
  }
  let margin = 108;   // 1.5" — the standard, as a fallback
  let best = 0;
  for (const [x, n] of xCounts) if (n > best) { best = n; margin = x; }

  // ── 3. lines → paragraphs (vertical gap = break), then classify ──
  const content: PdfImportResult['doc']['content'] = [];
  let prevType: string | null = null;
  let para: PdfLine[] = [];
  const flush = () => {
    if (para.length === 0) return;
    const text = para.map((l) => l.text).join(' ');
    const type = classifyParagraph(para[0].x - margin, text, prevType);
    content.push(node(type, text));
    prevType = type;
    para = [];
  };
  for (let i = 0; i < body.length; i++) {
    const l = body[i];
    const prev = body[i - 1];
    if (prev) {
      const gap = prev.page !== l.page ? Infinity : prev.y - l.y;
      const lineH = Math.max(prev.h, 10);
      // A new paragraph on: a blank-line gap, an indent change, or a page turn.
      if (gap > lineH * 1.6 || Math.abs(l.x - (para[para.length - 1]?.x ?? l.x)) > 8) flush();
    }
    para.push(l);
    // Character cues and scene headings are single-line — never merge into them.
    const soFar = para.map((x) => x.text).join(' ');
    const t = classifyParagraph(para[0].x - margin, soFar, prevType);
    if (t === 'character' || t === 'sceneHeading' || t === 'transition') flush();
  }
  flush();

  if (content.length === 0) content.push(node('action', ''));
  const sceneCount = content.filter((n) => n.type === 'sceneHeading').length;
  if (sceneCount === 0) {
    warnings.push('No scene headings were recognized — the PDF may not use standard screenplay margins. Everything imported; review element types.');
  }

  return { doc: { type: 'doc', content }, warnings, pages: pdf.numPages };
}
