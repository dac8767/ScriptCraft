import { describe, it, expect } from 'vitest';
import { extractCharacterIntro, buildScanList, filterScanList } from './characterScan';

describe('extractCharacterIntro', () => {
  it('pulls the introducing sentence and a parenthetical age', () => {
    const actions = ['SARAH CHEN (30s, sharp eyes) sits alone at the bar.'];
    const { description, age } = extractCharacterIntro(actions, 'SARAH CHEN');
    expect(description).toBe('SARAH CHEN (30s, sharp eyes) sits alone at the bar.');
    expect(age).toBe('30s');
  });

  it('reads a bare numeric age after a comma', () => {
    const actions = ['MARCUS, 40, weathered and tired, leans on the railing.'];
    expect(extractCharacterIntro(actions, 'MARCUS').age).toBe('40');
  });

  it('reads a parenthesised exact age', () => {
    const actions = ['DETECTIVE RAY (25) flashes a badge nobody asked to see.'];
    expect(extractCharacterIntro(actions, 'DETECTIVE RAY').age).toBe('25');
  });

  it('returns no age when none is stated', () => {
    const actions = ['NADIA storms through the door, coat soaked.'];
    const { description, age } = extractCharacterIntro(actions, 'NADIA');
    expect(description).toBe('NADIA storms through the door, coat soaked.');
    expect(age).toBe('');
  });

  it('only matches the name as a standalone ALL-CAPS token', () => {
    // "SARAHS" and lowercase "sarah" must not count as the character SARAH.
    const actions = ['The SARAHS argue while sarah watches from the window.'];
    expect(extractCharacterIntro(actions, 'SARAH')).toEqual({ description: '', age: '' });
  });

  it('grabs only the sentence containing the name, not the whole paragraph', () => {
    const actions = ['Rain falls. JOHN (50s) steps out. A car passes.'];
    expect(extractCharacterIntro(actions, 'JOHN').description).toBe('JOHN (50s) steps out.');
  });

  it('skips a too-short first mention and uses a later descriptive one', () => {
    const actions = ['LIV.', 'LIV (20s) paints the fence a violent shade of green.'];
    const { description, age } = extractCharacterIntro(actions, 'LIV');
    expect(description).toBe('LIV (20s) paints the fence a violent shade of green.');
    expect(age).toBe('20s');
  });

  it('returns empty when the name never appears in the action', () => {
    expect(extractCharacterIntro(['A quiet street at dawn.'], 'GHOST')).toEqual({
      description: '',
      age: '',
    });
  });
});

describe('buildScanList', () => {
  const actions = [
    'SARAH (30s) wipes down the counter.',
    'A MOTHER shouts from the balcony above.',
  ];

  it('lists cue characters first, then referred, tagging each source', () => {
    const list = buildScanList(actions, ['SARAH'], ['MOTHER']);
    expect(list.map((c) => [c.name, c.source])).toEqual([
      ['SARAH', 'cue'],
      ['MOTHER', 'referred'],
    ]);
    expect(list[0].age).toBe('30s');
    expect(list[1].description).toBe('A MOTHER shouts from the balcony above.');
  });

  it('de-duplicates a name, keeping the cue over a referred mention', () => {
    const list = buildScanList(actions, ['SARAH'], ['SARAH', 'MOTHER']);
    expect(list.map((c) => c.name)).toEqual(['SARAH', 'MOTHER']);
    expect(list.find((c) => c.name === 'SARAH')!.source).toBe('cue');
  });

  it('keeps found characters even when no intro description exists', () => {
    const list = buildScanList([], ['SARAH'], []);
    expect(list).toEqual([{ name: 'SARAH', source: 'cue', description: '', age: '' }]);
  });
});

describe('filterScanList (v4.24 — the From Script visible list)', () => {
  const results = [
    { name: 'SARAH', description: 'sharp eyes', age: '30s', source: 'cue' as const },
    { name: 'MARCUS', description: '', age: '', source: 'cue' as const },
    { name: 'NIGHTFALL', description: '', age: '', source: 'referred' as const },
    { name: 'REEVES', description: '', age: '', source: 'referred' as const },
  ];

  it('drops names that already have a character entry', () => {
    const out = filterScanList(results, {}, new Set(['SARAH']));
    expect(out.map((r) => r.name)).toEqual(['MARCUS', 'NIGHTFALL', 'REEVES']);
  });

  it('drops referred names the writer classified, keeps unclassified ones', () => {
    const out = filterScanList(results, { NIGHTFALL: { kind: 'other' } }, new Set());
    expect(out.map((r) => r.name)).toEqual(['SARAH', 'MARCUS', 'REEVES']);
  });

  it('a classification only hides REFERRED names — a cue name with a stray tag stays', () => {
    const out = filterScanList(results, { SARAH: { kind: 'other' } }, new Set());
    expect(out.map((r) => r.name)).toContain('SARAH');
  });

  it('null results → empty list', () => {
    expect(filterScanList(null, {}, new Set())).toEqual([]);
  });
});
