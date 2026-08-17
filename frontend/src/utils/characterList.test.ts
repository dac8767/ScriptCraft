// @vitest-environment jsdom
//   — the has-description filter runs stripHtml, which sanitizes through
//   DOMPurify and needs a DOM. Everything else here is plain data.
import { describe, it, expect } from 'vitest';
import { selectCharacterList, type CharacterListOptions, type CharStats } from './characterList';

const stats = (d: Partial<CharStats>): CharStats =>
  ({ dialogueCount: 0, sceneCount: 0, scenes: [], appearanceOrder: 999, ...d });

const opts = (o: Partial<CharacterListOptions> = {}): CharacterListOptions => ({
  characterProfiles: [],
  scriptCharacterNames: new Set(),
  searchQuery: '',
  sortBy: 'name',
  charStats: new Map(),
  filterInScript: false,
  filterHasImage: false,
  filterHasDesc: false,
  ...o,
});

describe('selectCharacterList: where the names come from', () => {
  it('unions saved profiles with the cues in the script', () => {
    expect(selectCharacterList(opts({
      characterProfiles: [{ name: 'ADA' }, { name: 'BEN' }],
      scriptCharacterNames: new Set(['BEN', 'CHO']),
    }))).toEqual(['ADA', 'BEN', 'CHO']);
  });

  it('never lists a name twice when it is in both', () => {
    const out = selectCharacterList(opts({
      characterProfiles: [{ name: 'ADA' }],
      scriptCharacterNames: new Set(['ADA']),
    }));
    expect(out).toEqual(['ADA']);
  });

  /* THE REGRESSION THIS FUNCTION'S SHAPE EXISTS FOR. A profile the writer
     deleted must stay gone even while the script still cues the name — and a
     cue must appear even with no profile. Those two together are what make the
     union the right answer and a third, lagging source the wrong one: pulling
     from a stale `characters` list re-added removed names, so Remove looked
     like it did nothing. */
  it('a deleted profile stays gone unless the script still cues it', () => {
    // profile removed, no cue -> absent
    expect(selectCharacterList(opts({
      characterProfiles: [],
      scriptCharacterNames: new Set(['BEN']),
    }))).toEqual(['BEN']);
    expect(selectCharacterList(opts({
      characterProfiles: [],
      scriptCharacterNames: new Set(),
    }))).toEqual([]);
  });

  it('an orphaned profile still shows — a character can outlive its cue', () => {
    expect(selectCharacterList(opts({
      characterProfiles: [{ name: 'GHOST' }],
      scriptCharacterNames: new Set(),
    }))).toEqual(['GHOST']);
  });
});

describe('selectCharacterList: filters', () => {
  const base = {
    characterProfiles: [
      { name: 'ADA', images: ['a.png'], description: '<p>lead</p>' },
      { name: 'BEN', images: [], description: '' },
      { name: 'CHO', images: [], description: '<p></p>' },
    ],
    scriptCharacterNames: new Set(['ADA', 'BEN']),
  };

  it('search matches as an uppercase substring', () => {
    expect(selectCharacterList(opts({ ...base, searchQuery: 'a' }))).toEqual(['ADA']);
    expect(selectCharacterList(opts({ ...base, searchQuery: 'o' }))).toEqual(['CHO']);
  });

  it('in-script drops the orphans', () => {
    expect(selectCharacterList(opts({ ...base, filterInScript: true }))).toEqual(['ADA', 'BEN']);
  });

  it('has-image keeps only profiles with one', () => {
    expect(selectCharacterList(opts({ ...base, filterHasImage: true }))).toEqual(['ADA']);
  });

  /* Description is HTML, so "has a description" is about TEXT — an empty <p>
     is what a rich-text field leaves behind after you clear it, and it must
     not count as content. */
  it('has-description ignores empty markup', () => {
    expect(selectCharacterList(opts({ ...base, filterHasDesc: true }))).toEqual(['ADA']);
  });

  it('filters combine rather than replace each other', () => {
    const out = selectCharacterList(opts({
      ...base, filterInScript: true, filterHasImage: true,
    }));
    expect(out).toEqual(['ADA']);
  });
});

describe('selectCharacterList: sort orders', () => {
  const characterProfiles = [{ name: 'ADA' }, { name: 'BEN' }, { name: 'CHO' }];
  const charStats = new Map<string, CharStats>([
    ['ADA', stats({ sceneCount: 1, dialogueCount: 9, appearanceOrder: 3 })],
    ['BEN', stats({ sceneCount: 8, dialogueCount: 1, appearanceOrder: 1 })],
    ['CHO', stats({ sceneCount: 2, dialogueCount: 2, appearanceOrder: 2 })],
  ]);
  const run = (sortBy: CharacterListOptions['sortBy']) =>
    selectCharacterList(opts({ characterProfiles, charStats, sortBy }));

  it('by name, alphabetically', () => expect(run('name')).toEqual(['ADA', 'BEN', 'CHO']));

  // importance is scenes + dialogues, so it is neither of the two alone:
  // ADA 10, BEN 9, CHO 4
  it('by importance, scenes plus dialogues descending', () =>
    expect(run('importance')).toEqual(['ADA', 'BEN', 'CHO']));

  it('by scenes descending', () => expect(run('scenes')).toEqual(['BEN', 'CHO', 'ADA']));
  it('by dialogues descending', () => expect(run('dialogues')).toEqual(['ADA', 'CHO', 'BEN']));
  it('by first appearance', () => expect(run('appearance')).toEqual(['BEN', 'CHO', 'ADA']));

  /* A name with no stats is common — a profile created before the script
     mentions it. It must sort last rather than crash or jump to the front. */
  it('a character with no stats sorts last, not first', () => {
    const out = selectCharacterList(opts({
      characterProfiles: [...characterProfiles, { name: 'NEW' }],
      charStats, sortBy: 'appearance',
    }));
    expect(out[out.length - 1]).toBe('NEW');
    const byScenes = selectCharacterList(opts({
      characterProfiles: [...characterProfiles, { name: 'NEW' }],
      charStats, sortBy: 'scenes',
    }));
    expect(byScenes[byScenes.length - 1]).toBe('NEW');
  });
});
