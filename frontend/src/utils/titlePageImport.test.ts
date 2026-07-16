// @vitest-environment jsdom
/**
 * Imported title pages (v2.25) — pins the three fixes for Derek's import:
 *  1. FDX/Fountain importers emit the CLASSIC title-page layout (the same
 *     titlePageBlockSpecs the Title Page editor uses), not a single bare
 *     node that rendered as one line on a blank page.
 *  2. Leading body paragraphs that duplicate the title page (converters
 *     love doing this) are dropped, so the script no longer starts with a
 *     second title page glued to page 1.
 *  3. A combined "Written by X from the novel by Y" line survives.
 */
import { describe, it, expect } from 'vitest';
import { parseFDXFull } from './fdxParser';
import { parseFountain, parseFountainTitleBlock } from './fountainParser';
import { titlePageBlockSpecs, EMPTY_TITLE_PAGE } from './titlePageLayout';

const tpText = (n: { type: string; content?: Array<{ text?: string }> }) =>
  (n.content || []).map((c) => c.text || '').join('');

function fdx(titleParas: string[], bodyParas: Array<[string, string]>): string {
  const tp = titleParas.map((t) => `<Paragraph><Text>${t}</Text></Paragraph>`).join('');
  const body = bodyParas.map(([type, t]) => `<Paragraph Type="${type}"><Text>${t}</Text></Paragraph>`).join('');
  return `<?xml version="1.0"?><FinalDraft DocumentType="Script"><Content>${body}</Content><TitlePage><Content>${tp}</Content></TitlePage></FinalDraft>`;
}

describe('FDX title page import', () => {
  const TITLE = 'Star Wars - Episode X - Invasion of the Vong';
  const BYLINE = 'Written by Derek Carl from the novel by R. A. Salvatore';
  const DRAFT = '1st Draft - 2026-07-09';

  it('emits the classic layout: title ~1/3 down, draft pushed to the bottom', () => {
    const { doc } = parseFDXFull(fdx([TITLE, BYLINE, DRAFT], [['Scene Heading', 'EXT. SPACE - BELKADAN']]));
    const content = doc.content!;
    const tpNodes = content.filter((n) => n.type === 'titlePage');
    expect(tpNodes.length).toBeGreaterThan(20);              // spacers + fields, not one bare node
    const fields = tpNodes.map((n) => (n.attrs as { field: string }).field);
    expect(fields).toContain('title');
    expect(fields).toContain('author');
    expect(fields).toContain('draft');
    const titleIdx = fields.indexOf('title');
    expect(titleIdx).toBeGreaterThanOrEqual(10);             // pushed down by spacers
    const titleNode = tpNodes[titleIdx];
    expect(tpText(titleNode)).toBe(TITLE);
    // v2.25: the combined byline no longer vanishes.
    expect(tpText(tpNodes[fields.indexOf('author')])).toBe(BYLINE);
    expect(tpText(tpNodes[fields.indexOf('draft')])).toBe(DRAFT);
    // The structured attrs ride on the title node for the Title Page editor.
    expect((titleNode.attrs as { tpWrittenBy: string }).tpWrittenBy).toBe('Derek Carl from the novel by R. A. Salvatore');
  });

  it('drops leading body paragraphs that duplicate the title page', () => {
    const { doc } = parseFDXFull(fdx(
      [TITLE, BYLINE, DRAFT],
      [
        ['Action', ''], ['Action', TITLE], ['Action', ''], ['Action', BYLINE],
        ['Action', ''], ['Action', DRAFT],
        ['Action', 'OPENING SCROLL'],
        ['Scene Heading', 'EXT. SPACE - BELKADAN'],
        ['Action', 'The camera tilts down.'],
      ],
    ));
    const body = doc.content!.filter((n) => n.type !== 'titlePage');
    expect(tpText(body[0])).toBe('OPENING SCROLL');           // dupes + blanks gone
    expect(body.some((n) => tpText(n) === TITLE)).toBe(false);
    expect(body.some((n) => tpText(n) === 'The camera tilts down.')).toBe(true);
  });

  it('never drops genuine opening action', () => {
    const { doc } = parseFDXFull(fdx(
      [TITLE],
      [['Action', 'A hard rain falls.'], ['Scene Heading', 'INT. HOUSE - NIGHT']],
    ));
    const body = doc.content!.filter((n) => n.type !== 'titlePage');
    expect(tpText(body[0])).toBe('A hard rain falls.');
  });

  it('a file with no TitlePage imports unchanged', () => {
    const { doc } = parseFDXFull('<?xml version="1.0"?><FinalDraft><Content><Paragraph Type="Scene Heading"><Text>INT. A - DAY</Text></Paragraph></Content></FinalDraft>');
    expect(doc.content!.filter((n) => n.type === 'titlePage')).toHaveLength(0);
    expect(tpText(doc.content![0])).toBe('INT. A - DAY');
  });
});

describe('Fountain title block import', () => {
  it('parses the key/value block including indented continuations', () => {
    const { data, consumed } = parseFountainTitleBlock([
      'Title: Big Fish',
      'Credit: written by',
      'Author: John August',
      'Source: based on the novel by Daniel Wallace',
      'Draft date: First Draft',
      'Contact:',
      '    John August',
      '    august@example.com',
      '',
      'INT. HOUSE - DAY',
    ]);
    expect(consumed).toBe(9);                                 // through the blank line
    expect(data!.tpTitle).toBe('Big Fish');
    expect(data!.tpWrittenBy).toBe('John August');
    expect(data!.tpBasedOn).toBe('based on the novel by Daniel Wallace');
    expect(data!.tpDraft).toBe('First Draft');
    expect(data!.tpContact).toBe('John August\naugust@example.com');
  });

  it('a script with no title block is untouched', () => {
    expect(parseFountainTitleBlock(['INT. HOUSE - DAY', ''])).toEqual({ data: null, consumed: 0 });
    const doc = parseFountain('INT. HOUSE - DAY\n\nAction line.');
    expect(doc.content!.filter((n) => n.type === 'titlePage')).toHaveLength(0);
  });

  it('parseFountain puts the classic title page before the script body', () => {
    const doc = parseFountain('Title: Big Fish\nAuthor: John August\n\nINT. HOUSE - DAY\n\nAction line.');
    const content = doc.content!;
    const tpNodes = content.filter((n) => n.type === 'titlePage');
    expect(tpNodes.length).toBeGreaterThan(10);
    expect(content[0].type).toBe('titlePage');
    const firstBody = content.find((n) => n.type !== 'titlePage')!;
    expect(tpText(firstBody)).toBe('INT. HOUSE - DAY');
    expect(firstBody.type).toBe('sceneHeading');
  });
});

describe('titlePageBlockSpecs layout contract', () => {
  it('fits one page and keeps the bottom block at the bottom', () => {
    const specs = titlePageBlockSpecs({
      ...EMPTY_TITLE_PAGE,
      tpTitle: 'A Title', tpWrittenBy: 'Someone', tpDraft: '1st Draft', tpContact: 'a@b.com',
    });
    expect(specs.length).toBeLessThanOrEqual(54);              // one page of 12pt slots
    expect(specs[0].field).toBe('blank');
    expect(specs.map((s) => s.field).indexOf('title')).toBe(14);   // line ~15
    const draftIdx = specs.findIndex((s) => s.field === 'draft');
    expect(draftIdx).toBeGreaterThan(specs.length - 5);        // pushed to the bottom
  });
});
