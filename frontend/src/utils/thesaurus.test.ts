/**
 * v5.53: the Thesaurus data layer — the file walk/parse, the qualifier
 * grammar, the lookup fallback ordering ("hoping" must reach "hope" before
 * "hop"), and the editor-side helpers (word at caret, case dressing).
 * v6.03: the format grew a GLOSS as each sense line's first field (WordNet
 * definitions) — field[1] is the definition, synonyms follow.
 */
import { describe, it, expect } from 'vitest';
import {
  buildThesaurusIndex, readThesaurusEntry, createThesaurus,
  lookupCandidates, wordAt, matchCase,
} from './thesaurus';

const FIXTURE = [
  'UTF-8',
  'big|2',
  '(adj)|above average in size|large|sizable (similar term)|small (antonym)',
  '(noun)||bigness (generic term)',
  'café|1',
  '(noun)|a small restaurant selling drinks|coffeehouse|coffee shop (generic term)',
  'hop|1',
  '(verb)|jump lightly|skip|bounce (similar term)',
  'hope|1',
  '(verb)|expect and wish|trust|desire (generic term)',
  'run|1',
  '(verb)|move fast on foot|sprint|dash (similar term)',
  'walk|1',
  '(verb)|advance on foot|amble|stroll (similar term)',
  "o'clock|1",
  '(adv)|according to the clock|of the clock',
  'ort|1',
  '(noun)|a scrap of leftover food',
].join('\n');

describe('buildThesaurusIndex + readThesaurusEntry', () => {
  const idx = buildThesaurusIndex(FIXTURE);

  it('indexes every head word and none of the sense lines', () => {
    expect([...idx.keys()].sort()).toEqual(
      ['big', 'café', 'hop', 'hope', "o'clock", 'ort', 'run', 'walk'].sort());
  });

  it('parses senses with pos labels and strips the qualifier suffixes', () => {
    const entry = readThesaurusEntry(FIXTURE, idx.get('big')!)!;
    expect(entry.word).toBe('big');
    expect(entry.senses).toHaveLength(2);
    expect(entry.senses[0].pos).toBe('(adj)');
    expect(entry.senses[0].words.map((w) => w.word)).toEqual(['large', 'sizable', 'small']);
    expect(entry.senses[1].words).toEqual([{ word: 'bigness' }]);
  });

  it('carries each sense\'s definition, and an empty gloss stays empty', () => {
    const entry = readThesaurusEntry(FIXTURE, idx.get('big')!)!;
    expect(entry.senses[0].gloss).toBe('above average in size');
    expect(entry.senses[1].gloss).toBe('');
  });

  it('keeps a gloss-only sense — the definition is content on its own', () => {
    const entry = readThesaurusEntry(FIXTURE, idx.get('ort')!)!;
    expect(entry.senses).toHaveLength(1);
    expect(entry.senses[0].gloss).toBe('a scrap of leftover food');
    expect(entry.senses[0].words).toEqual([]);
  });

  it('keeps the antonym flag and only that qualifier', () => {
    const entry = readThesaurusEntry(FIXTURE, idx.get('big')!)!;
    const flags = Object.fromEntries(entry.senses[0].words.map((w) => [w.word, !!w.antonym]));
    expect(flags).toEqual({ large: false, sizable: false, small: true });
  });

  it('handles non-ASCII heads and apostrophes in words', () => {
    expect(readThesaurusEntry(FIXTURE, idx.get('café')!)!.senses[0].words[0].word)
      .toBe('coffeehouse');
    expect(readThesaurusEntry(FIXTURE, idx.get("o'clock")!)!.senses[0].words[0].word)
      .toBe('of the clock');
  });
});

describe('lookupCandidates ordering', () => {
  const heads = (raw: string) => lookupCandidates(raw);

  it('exact and lowercased forms lead', () => {
    expect(heads('Big').slice(0, 2)).toEqual(['Big', 'big']);
  });

  it('“hoping” reaches “hope” before “hop”', () => {
    const c = heads('hoping');
    expect(c.indexOf('hope')).toBeGreaterThan(-1);
    expect(c.indexOf('hope')).toBeLessThan(c.indexOf('hop'));
  });

  it('covers plural and -ed/-ing families', () => {
    expect(heads('cities')).toContain('city');
    expect(heads('glasses')).toContain('glass');
    expect(heads('dogs')).toContain('dog');
    expect(heads('walked')).toContain('walk');
    expect(heads('stopped')).toContain('stop');
    expect(heads('running')).toContain('run');
    expect(heads('walking')).toContain('walk');
  });

  it('strips edge quotes and punctuation', () => {
    expect(heads('“walk,”')[0]).toBe('walk');
    expect(heads('—big…')[0]).toBe('big');
    expect(heads('   ')).toEqual([]);
  });
});

describe('createThesaurus (the API the tool uses)', () => {
  const api = createThesaurus(FIXTURE);

  it('reports its size and resolves direct hits', () => {
    expect(api.size).toBe(8);
    expect(api.lookup('walk')!.entry.senses[0].words[0].word).toBe('amble');
  });

  it('falls back and reports which head matched', () => {
    const hit = api.lookup('Hoping')!;
    expect(hit.matched).toBe('hope');
    expect(hit.entry.senses[0].words.map((w) => w.word)).toEqual(['trust', 'desire']);
  });

  it('misses cleanly', () => {
    expect(api.lookup('zzzqqq')).toBeNull();
    expect(api.lookup('')).toBeNull();
  });
});

describe('wordAt', () => {
  const text = 'He walked—“slowly” down the hall.';

  it('finds the word around a mid-word caret', () => {
    const at = text.indexOf('alked');
    expect(wordAt(text, at)).toEqual({ start: 3, end: 9, word: 'walked' });
  });

  it('a caret at a word END still counts; punctuation gaps do not', () => {
    expect(wordAt(text, 9)!.word).toBe('walked');       // right after "walked", on the dash
    expect(wordAt(text, text.indexOf('“'))).toBeNull(); // beyond the dash — touches no word
    expect(wordAt('a  b', 2)).toBeNull();               // between two spaces
  });

  it('trims edge apostrophes but keeps internal ones', () => {
    const t = "‘twas o'clock";
    const w = wordAt(t, t.indexOf('clock'));
    expect(w!.word).toBe("o'clock");
    const q = "'quoted'";
    expect(wordAt(q, 3)!.word).toBe('quoted');
  });
});

describe('matchCase', () => {
  it('dresses the replacement in the original case', () => {
    expect(matchCase('WALK', 'amble')).toBe('AMBLE');
    expect(matchCase('Walk', 'amble')).toBe('Amble');
    expect(matchCase('walk', 'amble')).toBe('amble');
    expect(matchCase('I', 'me')).toBe('Me');   // single capital = Capitalized, not ALL-CAPS
  });
});
