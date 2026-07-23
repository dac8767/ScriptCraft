// @vitest-environment jsdom
/**
 * Fountain import — the parser that turns a .fountain file into the editor doc
 * (MenuBar "Open" and drag-drop route through it). Untested until now; these pin
 * the element detection so a regex tweak can't silently turn dialogue into action.
 */
import { describe, it, expect } from 'vitest';
import { parseFountain, parseFountainTitleBlock } from './fountainParser';
import { exportFountain } from './fountainExporter';

interface N { type?: string; content?: { type?: string; text?: string }[]; attrs?: Record<string, unknown> }
const flat = (nodes: N[]) => nodes.map((n) => ({
  type: n.type,
  text: (n.content || []).filter((c) => c.type === 'text').map((c) => c.text).join(''),
}));

describe('parseFountain — element detection', () => {
  it('maps scene heading, action, cue + parenthetical + dialogue, and transition', () => {
    const doc = parseFountain(
      'INT. DINER - DAY\n\nSarah sips coffee.\n\nSARAH\n(quietly)\nWe should go.\n\nCUT TO:',
    );
    expect(flat(doc.content as N[])).toEqual([
      { type: 'sceneHeading', text: 'INT. DINER - DAY' },
      { type: 'action', text: 'Sarah sips coffee.' },
      { type: 'character', text: 'SARAH' },
      { type: 'parenthetical', text: '(quietly)' },
      { type: 'dialogue', text: 'We should go.' },
      { type: 'transition', text: 'CUT TO:' },
    ]);
  });

  it('honors forced scene headings (.) and forced transitions (>)', () => {
    expect(flat(parseFountain('.TEASER').content as N[])).toEqual([{ type: 'sceneHeading', text: 'TEASER' }]);
    expect(flat(parseFountain('>FADE OUT').content as N[])).toEqual([{ type: 'transition', text: 'FADE OUT' }]);
  });

  it('attaches a = synopsis line to the preceding scene heading', () => {
    const doc = parseFountain('INT. ROOM - DAY\n= Sarah’s world unravels.');
    const body = doc.content as N[];
    expect(body).toHaveLength(1);
    expect(body[0].type).toBe('sceneHeading');
    expect(body[0].attrs?.synopsis).toBe('Sarah’s world unravels.');
  });

  it('consumes forced page breaks (===) without emitting a literal node', () => {
    const doc = parseFountain('Action one.\n\n===\n\nAction two.');
    expect(flat(doc.content as N[])).toEqual([
      { type: 'action', text: 'Action one.' },
      { type: 'action', text: 'Action two.' },
    ]);
  });

  it('does NOT treat a lone all-caps line as a character cue', () => {
    // Needs a following dialogue line to be a cue — otherwise it is action.
    const doc = parseFountain('OPENING SCROLL');
    expect(flat(doc.content as N[])).toEqual([{ type: 'action', text: 'OPENING SCROLL' }]);
  });

  it('returns a single empty action for empty input', () => {
    const doc = parseFountain('');
    const body = doc.content as N[];
    expect(body).toHaveLength(1);
    expect(body[0].type).toBe('action');
  });
});

describe('parseFountainTitleBlock', () => {
  it('extracts recognized title keys and reports lines consumed', () => {
    const { data, consumed } = parseFountainTitleBlock(['Title: NIGHTFALL', '']);
    expect(data?.tpTitle).toBe('NIGHTFALL');
    expect(consumed).toBe(2);
  });

  it('strips Fountain emphasis markup from title values', () => {
    const { data } = parseFountainTitleBlock(['Title: _**STAR WARS**_', '']);
    expect(data?.tpTitle).toBe('STAR WARS');
  });

  it('returns null when the first line is not a title key', () => {
    expect(parseFountainTitleBlock(['INT. ROOM - DAY']).data).toBeNull();
  });

  it('prepends title-page nodes to the parsed body', () => {
    const withTitle = parseFountain('Title: NIGHTFALL\n\nINT. ROOM - DAY\n\nAction.').content as N[];
    const noTitle = parseFountain('INT. ROOM - DAY\n\nAction.').content as N[];
    expect(withTitle.length).toBeGreaterThan(noTitle.length);   // title nodes added
    expect(withTitle.some((n) => n.type === 'titlePage')).toBe(true);
  });
});

describe('Fountain round-trip (export → parse)', () => {
  it('recovers the core elements after a save-and-reopen cycle', () => {
    // The integration guard the separate exporter/parser unit tests can't give:
    // if the exporter ever emits a shape the parser can't read back, this fails.
    const el = (type: string, text: string) => ({ type, content: [{ type: 'text', text }] });
    const original = [
      el('sceneHeading', 'INT. DINER - DAY'),
      el('action', 'Sarah sips coffee.'),
      el('character', 'SARAH'),
      el('dialogue', 'We should go.'),
      el('transition', 'CUT TO:'),
    ];
    const fountain = exportFountain({ type: 'doc', content: original });
    const body = parseFountain(fountain).content as N[];
    expect(flat(body)).toEqual([
      { type: 'sceneHeading', text: 'INT. DINER - DAY' },
      { type: 'action', text: 'Sarah sips coffee.' },
      { type: 'character', text: 'SARAH' },
      { type: 'dialogue', text: 'We should go.' },
      { type: 'transition', text: 'CUT TO:' },
    ]);
  });
});
