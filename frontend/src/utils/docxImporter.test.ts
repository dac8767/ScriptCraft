// @vitest-environment jsdom
/**
 * .docx import — parseDocx fed real in-memory .docx zips built with JSZip (the
 * same library the importer uses to unzip). Pins the layered classifier exactly
 * as documented at the top of docxImporter.ts, first hit wins:
 *
 *   1. style name  (word/styles.xml w:pStyle → "Scene Heading" etc.)
 *   2. indent      (FD layout ±0.25", made ABSOLUTE by adding sectPr pgMar left)
 *   3. text shape  (INT./EXT., TO:, parens — the regexes shared with fountainParser)
 *   4. sequencing  (prose after a confirmed cue is promoted to dialogue)
 *   5. fallback    action + a "Line N … defaulted to action" warning
 *
 * Also pins: run marks (and their stripping on types whose renderer provides
 * them), w:caps uppercasing, title-page detection consuming the centered block,
 * dual-dialogue tables, the two invalid-docx throws, and the empty-doc placeholder.
 *
 * jsdom is required: the importer uses the browser DOMParser, and the import
 * chain (titlePageLayout → editor/pagination → editorStore) touches localStorage.
 */
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { parseDocx, type DocxParseResult } from './docxImporter';
import { EMPTY_TITLE_PAGE } from './titlePageLayout';

type DocNode = NonNullable<DocxParseResult['doc']['content']>[number];

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

/** word/document.xml around a body payload. */
const docXml = (bodyInner: string): string =>
  `<?xml version="1.0" encoding="UTF-8"?>` +
  `<w:document xmlns:w="${W}"><w:body>${bodyInner}</w:body></w:document>`;

/** A single-run paragraph, with optional raw pPr / rPr inner XML. */
const para = (text: string, pPr = '', rPr = ''): string =>
  `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ''}` +
  `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ''}<w:t>${text}</w:t></w:r></w:p>`;

async function buildDocx(files: Record<string, string>): Promise<ArrayBuffer> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) zip.file(path, content);
  return zip.generateAsync({ type: 'arraybuffer' });
}

const docxWithBody = (bodyInner: string): Promise<ArrayBuffer> =>
  buildDocx({ 'word/document.xml': docXml(bodyInner) });

/** Collapse nodes to { type, joined text } for readable exact assertions. */
const flat = (nodes: DocNode[]) =>
  nodes.map((n) => ({
    type: n.type,
    text: (n.content ?? []).map((c) => c.text ?? '').join(''),
  }));

const body = (r: DocxParseResult): DocNode[] => r.doc.content ?? [];

// ---------------------------------------------------------------------------

describe('parseDocx — text-pattern classification (unstyled, no indents)', () => {
  // No styles.xml and no w:ind, so layers 1-2 pass and layers 3-5 decide:
  // scene heading + transition by regex, SARAH by the all-caps cue heuristic,
  // "We should go." promoted to dialogue by the sequencing pass, "Sarah enters."
  // left as fallback action. The empty <w:p/> is preserved as a blank action.
  const fixture = () =>
    docxWithBody(
      [
        para('INT. DINER - DAY'),
        para('Sarah enters.'),
        para('SARAH'),
        para('We should go.'),
        '<w:p/>',
        para('CUT TO:'),
      ].join(''),
    );

  it('classifies scene heading, action, cue, dialogue and transition', async () => {
    const r = await parseDocx(await fixture());
    expect(r.doc.type).toBe('doc');
    expect(flat(body(r))).toEqual([
      { type: 'sceneHeading', text: 'INT. DINER - DAY' },
      { type: 'action', text: 'Sarah enters.' },
      { type: 'character', text: 'SARAH' },
      { type: 'dialogue', text: 'We should go.' },
      { type: 'action', text: '' }, // blank paragraph preserved
      { type: 'transition', text: 'CUT TO:' },
    ]);
    // The blank line is an action with an EMPTY content array (not missing).
    expect(body(r)[4]).toEqual({ type: 'action', content: [] });
    // No docProps/core.xml and no title page → no title recovered.
    expect(r.scriptTitle).toBe('');
  });

  it('reports the ambiguous fallbacks, including lines later promoted to dialogue', async () => {
    const r = await parseDocx(await fixture());
    // KNOWN LIMITATION: "We should go." is counted and warned as "defaulted to
    // action" by pass 1, then pass 2 promotes it to dialogue — but the warning
    // and ambiguousCount are never retracted, so a correctly-imported dialogue
    // line is still reported to the user as an ambiguous action.
    expect(r.ambiguousCount).toBe(2);
    expect(r.warnings).toEqual([
      '2 paragraph(s) auto-classified as Action — review and re-tag any that should be a different element type.',
      'Line 2: "Sarah enters." — defaulted to action',
      'Line 4: "We should go." — defaulted to action',
    ]);
  });
});

describe('parseDocx — style-name classification (word/styles.xml)', () => {
  it('trusts the style name over text shape, and reads dc:title from core.xml', async () => {
    const stylesXml =
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<w:styles xmlns:w="${W}">` +
      `<w:style w:styleId="SH"><w:name w:val="Scene Heading"/></w:style>` +
      `<w:style w:styleId="CH"><w:name w:val="Character"/></w:style>` +
      `<w:style w:styleId="DL"><w:name w:val="Dialogue"/></w:style>` +
      `<w:style w:styleId="AC"><w:name w:val="Action"/></w:style>` +
      `</w:styles>`;
    const coreXml =
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<cp:coreProperties` +
      ` xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"` +
      ` xmlns:dc="http://purl.org/dc/elements/1.1/">` +
      `<dc:title>Style Test</dc:title></cp:coreProperties>`;
    const buf = await buildDocx({
      'word/document.xml': docXml(
        [
          // None of these would classify by text (lowercase, no INT./TO:),
          // so a correct result proves the style layer did the work.
          para('the diner at night', '<w:pStyle w:val="SH"/>'),
          para('bob', '<w:pStyle w:val="CH"/>'),
          para('We should go.', '<w:pStyle w:val="DL"/>'),
          para('Sarah exits.', '<w:pStyle w:val="AC"/>'),
        ].join(''),
      ),
      'word/styles.xml': stylesXml,
      'docProps/core.xml': coreXml,
    });
    const r = await parseDocx(buf);
    expect(flat(body(r))).toEqual([
      { type: 'sceneHeading', text: 'the diner at night' },
      { type: 'character', text: 'bob' },
      { type: 'dialogue', text: 'We should go.' },
      { type: 'action', text: 'Sarah exits.' },
    ]);
    expect(r.scriptTitle).toBe('Style Test');
    expect(r.ambiguousCount).toBe(0);
    expect(r.warnings).toEqual([]);
  });
});

describe('parseDocx — indent classification (FD layout + page margin)', () => {
  it('adds the sectPr left margin to indents before comparing to FD positions', async () => {
    // pgMar left = 1440 twips = 1". Word indents are relative to the text
    // area, so 3600 twips (2.5") + 1" margin = 3.5" absolute → character;
    // 2880 (2") + 1" = 3.0" → parenthetical; 2160 (1.5") + 1" = 2.5" → dialogue.
    // Right alignment alone is a transition, whatever the text says.
    const buf = await docxWithBody(
      [
        para('BOB', '<w:ind w:left="3600"/>'),
        para('(soft)', '<w:ind w:left="2880"/>'),
        para('Hello there.', '<w:ind w:left="2160"/>'),
        para('Back at the ranch', '<w:jc w:val="right"/>'),
        `<w:sectPr><w:pgMar w:left="1440" w:right="1440"/></w:sectPr>`,
      ].join(''),
    );
    const r = await parseDocx(buf);
    expect(flat(body(r))).toEqual([
      { type: 'character', text: 'BOB' },
      { type: 'parenthetical', text: '(soft)' },
      { type: 'dialogue', text: 'Hello there.' },
      { type: 'transition', text: 'Back at the ranch' },
    ]);
    expect(r.ambiguousCount).toBe(0);
    expect(r.warnings).toEqual([]);
  });
});

describe('parseDocx — run formatting marks', () => {
  it('keeps bold/italic/underline marks on action but strips renderer-provided bold from scene headings', async () => {
    const buf = await docxWithBody(
      [
        para('INT. HOUSE - DAY', '', '<w:b/>'),
        `<w:p>` +
          `<w:r><w:t>He waves </w:t></w:r>` +
          `<w:r><w:rPr><w:b/><w:i/></w:rPr><w:t>frantically</w:t></w:r>` +
          `<w:r><w:rPr><w:u w:val="single"/></w:rPr><w:t> now</w:t></w:r>` +
          `</w:p>`,
      ].join(''),
    );
    const r = await parseDocx(buf);
    // sceneHeading is in TYPE_PROVIDED_BOLD → the run's bold is NOT re-emitted.
    expect(body(r)[0]).toEqual({
      type: 'sceneHeading',
      content: [{ type: 'text', text: 'INT. HOUSE - DAY' }],
    });
    expect(body(r)[1]).toEqual({
      type: 'action',
      content: [
        { type: 'text', text: 'He waves ' },
        { type: 'text', text: 'frantically', marks: [{ type: 'bold' }, { type: 'italic' }] },
        { type: 'text', text: ' now', marks: [{ type: 'underline' }] },
      ],
    });
    expect(r.ambiguousCount).toBe(1); // the mixed-run prose line fell back to action
  });

  it('applies w:caps to the text, and demotes a trailing cue with no dialogue to action', async () => {
    const buf = await docxWithBody(para('shouting', '', '<w:caps/>'));
    const r = await parseDocx(buf);
    // 'shouting' is uppercased by w:caps, then looks like a character cue —
    // but a cue with nothing after it is demoted back to action by pass 2.
    expect(body(r))
      .toEqual([{ type: 'action', content: [{ type: 'text', text: 'SHOUTING' }] }]);
    // The looksLikeCharacter path never counts as ambiguous, even when demoted.
    expect(r.ambiguousCount).toBe(0);
    expect(r.warnings).toEqual([]);
  });
});

describe('parseDocx — title-page detection', () => {
  const fixture = () =>
    docxWithBody(
      [
        para('MY SCRIPT', '<w:jc w:val="center"/>'),
        para('written by', '<w:jc w:val="center"/>'),
        para('Derek Carl', '<w:jc w:val="center"/>'),
        para('INT. HOUSE - DAY'),
      ].join(''),
    );

  it('consumes the centered block and emits the classic titlePage layout', async () => {
    const r = await parseDocx(await fixture());
    const nodes = body(r);
    // titlePageBlockSpecs math for {title, writtenBy} only:
    // max(2, 15-1) = 14 top blanks + title + 2 blanks + author = 18 blocks.
    expect(nodes.filter((n) => n.type === 'titlePage')).toHaveLength(18);
    expect(nodes[0]).toEqual({ type: 'titlePage', attrs: { field: 'blank' } });
    expect(nodes[14]).toEqual({
      type: 'titlePage',
      attrs: { field: 'title', ...EMPTY_TITLE_PAGE, tpTitle: 'MY SCRIPT', tpWrittenBy: 'Derek Carl' },
      content: [{ type: 'text', text: 'MY SCRIPT' }],
    });
    expect(nodes[17]).toEqual({
      type: 'titlePage',
      attrs: { field: 'author' },
      content: [{ type: 'text', text: 'Written by Derek Carl' }],
    });
    // The three consumed paragraphs do NOT reappear in the body.
    expect(flat(nodes.slice(18))).toEqual([{ type: 'sceneHeading', text: 'INT. HOUSE - DAY' }]);
  });

  it('uses the detected title as scriptTitle when core.xml has none', async () => {
    const r = await parseDocx(await fixture());
    expect(r.scriptTitle).toBe('MY SCRIPT');
  });
});

describe('parseDocx — tables', () => {
  it('turns a 2-column table row into a dualDialogue node', async () => {
    const buf = await docxWithBody(
      `<w:tbl><w:tr>` +
        `<w:tc>${para('BOB')}${para('Hi there.')}</w:tc>` +
        `<w:tc>${para('ALICE')}${para('Hello.')}</w:tc>` +
        `</w:tr></w:tbl>`,
    );
    const r = await parseDocx(buf);
    expect(body(r)).toHaveLength(1);
    expect(body(r)[0].type).toBe('dualDialogue');
    expect(flat(body(r)[0].content ?? [])).toEqual([
      { type: 'character', text: 'BOB' },
      { type: 'dialogue', text: 'Hi there.' },
      { type: 'character', text: 'ALICE' },
      { type: 'dialogue', text: 'Hello.' },
    ]);
    // KNOWN LIMITATION: both dialogue lines were pass-1 fallbacks later promoted,
    // so they still count as ambiguous (same non-retraction as the linear case).
    expect(r.ambiguousCount).toBe(2);
  });

  it('flattens a non-2-column table into paragraphs and warns once', async () => {
    const buf = await docxWithBody(
      `<w:tbl><w:tr><w:tc>${para('Some note text.')}</w:tc></w:tr></w:tbl>`,
    );
    const r = await parseDocx(buf);
    expect(flat(body(r))).toEqual([{ type: 'action', text: 'Some note text.' }]);
    // Table warning is recorded during flattening, so it lands between the
    // unshifted summary and the per-line fallback warning.
    expect(r.warnings).toEqual([
      '1 paragraph(s) auto-classified as Action — review and re-tag any that should be a different element type.',
      'Encountered a table that is not a dual-dialogue layout — flattened cells into action.',
      'Line 1: "Some note text." — defaulted to action',
    ]);
    expect(r.ambiguousCount).toBe(1);
  });
});

describe('parseDocx — invalid and empty input', () => {
  it('rejects a zip without word/document.xml', async () => {
    const buf = await buildDocx({ 'not-a-docx.txt': 'hello' });
    await expect(parseDocx(buf)).rejects.toThrow(
      'Not a valid .docx file: missing word/document.xml',
    );
  });

  it('rejects a document.xml without a <w:body>', async () => {
    const buf = await buildDocx({
      'word/document.xml': `<?xml version="1.0"?><w:document xmlns:w="${W}"><w:p/></w:document>`,
    });
    await expect(parseDocx(buf)).rejects.toThrow('Not a valid .docx file: missing <w:body>');
  });

  it('emits a single empty action placeholder for an empty body', async () => {
    const r = await parseDocx(await docxWithBody(''));
    expect(r.doc).toEqual({ type: 'doc', content: [{ type: 'action', content: [] }] });
    expect(r.warnings).toEqual([]);
    expect(r.ambiguousCount).toBe(0);
    expect(r.scriptTitle).toBe('');
  });
});
