// @vitest-environment jsdom
/**
 * v5.40, Derek: custom pages "do not count in page numbering." A cpId run is
 * ONE page of its own: the break opening it consumes no number, the script
 * page after it keeps the number it would have had, and the script pageCount
 * ignores the run entirely. A LEADING custom run plays the title page's part
 * (the body still opens page 1).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Text from '@tiptap/extension-text';
import { Action } from './extensions/Action';
import { CustomPage } from './extensions/CustomPage';
import { computeBreaks, computePageBlocks } from './pagination';
import { DEFAULT_PAGE_LAYOUT } from '../stores/editorStore';

let editor: Editor | null = null;
let host: HTMLElement | null = null;

import type { JSONContent } from '@tiptap/core';

function docOf(content: JSONContent[]): Editor {
  host = document.createElement('div');
  document.body.appendChild(host);
  editor = new Editor({
    element: host,
    extensions: [Document, Text, Action, CustomPage],
    content: { type: 'doc', content },
  });
  return editor;
}
afterEach(() => {
  editor?.destroy();
  editor = null;
  host?.remove();
  host = null;
});

const action = (t: string) => ({ type: 'action', content: [{ type: 'text', text: t }] });
const cpLine = (t: string, cpId = 'cp1') => ({ type: 'customPage', attrs: { cpId }, content: [{ type: 'text', text: t }] });
const actions = (n: number) => Array.from({ length: n }, (_, i) => action(`Action line ${i} with a normal amount of words on it.`));

describe('custom pages and the paginator', () => {
  it('a mid-script custom run is one unnumbered page; numbering flows past it', () => {
    const body = [...actions(10), cpLine('a quote'), cpLine('another line'), ...actions(60)];
    const ed = docOf(body);
    const { breaks } = computeBreaks(ed.state.doc, DEFAULT_PAGE_LAYOUT);
    const enter = breaks.find((b) => b.isCustomPage);
    const leave = breaks.find((b) => b.afterCustomPage);
    expect(enter).toBeTruthy();
    expect(leave).toBeTruthy();
    // the custom page consumed NO number — the script page after it takes
    // the same number the entering break was holding
    expect(leave!.pageNumber).toBe(enter!.pageNumber);
    // and later breaks keep counting from there
    const later = breaks.filter((b) => !b.isCustomPage && !b.afterCustomPage);
    expect(later[0].pageNumber).toBe(leave!.pageNumber + 1);
  });

  it('script page numbers stay consecutive — the custom page adds no number', () => {
    const ed = docOf([...actions(10), cpLine('x'), cpLine('y'), cpLine('z'), ...actions(60)]);
    const { breaks, pageCount } = computeBreaks(ed.state.doc, DEFAULT_PAGE_LAYOUT);
    // every number-consuming break, in order (page 1 is implicit)
    const scriptNumbers = breaks.filter((b) => !b.isCustomPage && !b.isTitlePage).map((b) => b.pageNumber);
    expect(scriptNumbers).toEqual(Array.from({ length: scriptNumbers.length }, (_, i) => i + 2));
    // and the reported count is the last script number — customs never inflate it
    expect(pageCount).toBe(scriptNumbers[scriptNumbers.length - 1]);
  });

  it('a LEADING custom run leaves the body starting on page 1', () => {
    const ed = docOf([cpLine('cover quote'), ...actions(40)]);
    const { breaks } = computeBreaks(ed.state.doc, DEFAULT_PAGE_LAYOUT);
    const leave = breaks.find((b) => b.afterCustomPage);
    expect(leave).toBeTruthy();
    expect(leave!.pageNumber).toBe(1);   // the body's first page is page 1
    expect(leave!.isTitlePage).toBe(true); // no number consumed (title-page rule)
  });

  it('computePageBlocks marks the custom page and keeps its lines off script pages', () => {
    const ed = docOf([...actions(10), cpLine('list line one'), cpLine('list line two'), ...actions(20)]);
    const pages = computePageBlocks(ed.state.doc, DEFAULT_PAGE_LAYOUT);
    const customPages = pages.filter((p) => p.isCustom);
    expect(customPages).toHaveLength(1);
    expect(customPages[0].blocks.every((bl) => bl.typeName === 'customPage')).toBe(true);
    for (const p of pages.filter((x) => !x.isCustom)) {
      expect(p.blocks.some((bl) => bl.typeName === 'customPage')).toBe(false);
    }
  });

  it('two back-to-back custom pages (different cpIds) each get their own page', () => {
    const ed = docOf([...actions(10), cpLine('one', 'cpA'), cpLine('two', 'cpB'), ...actions(20)]);
    const { breaks } = computeBreaks(ed.state.doc, DEFAULT_PAGE_LAYOUT);
    expect(breaks.filter((b) => b.isCustomPage)).toHaveLength(2);
  });

  // v5.44: the Pages tool's drag / Move / Delete address a run by cpId — the
  // page entry must carry it (and script pages must not).
  it('computePageBlocks carries each custom page\'s cpId; script pages carry none', () => {
    const ed = docOf([...actions(10), cpLine('one', 'cpA'), cpLine('two', 'cpB'), ...actions(20)]);
    const pages = computePageBlocks(ed.state.doc, DEFAULT_PAGE_LAYOUT);
    expect(pages.filter((p) => p.isCustom).map((p) => p.cpId)).toEqual(['cpA', 'cpB']);
    expect(pages.filter((p) => !p.isCustom).every((p) => p.cpId === undefined)).toBe(true);
  });
});
