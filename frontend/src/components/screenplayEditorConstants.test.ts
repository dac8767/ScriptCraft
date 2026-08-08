/**
 * Editor static-config invariants.
 *
 * DEFAULT_NEXT_TYPE (what Enter turns each element into) and ALL_ELEMENT_TYPES
 * (the built-in element set) are two hand-maintained lists that must agree —
 * exactly the "two lists that drift apart" bug class this repo keeps getting
 * bitten by (CLAUDE.md §3). If someone adds an element type but forgets its
 * Enter target, or points a next-type at a name that doesn't exist, these
 * catch it at test time instead of as a dead Enter key in the running app.
 */
import { describe, it, expect } from 'vitest';
import { DEFAULT_NEXT_TYPE, ALL_ELEMENT_TYPES, allowedElementsAfter, resolvePickedElement } from './screenplayEditorConstants';

describe('element-type maps stay in sync', () => {
  it('every built-in element type has an Enter → next-type mapping', () => {
    for (const type of ALL_ELEMENT_TYPES) {
      expect(DEFAULT_NEXT_TYPE[type], `no DEFAULT_NEXT_TYPE entry for "${type}"`).toBeTruthy();
    }
  });

  it('every DEFAULT_NEXT_TYPE key is a real element type', () => {
    for (const key of Object.keys(DEFAULT_NEXT_TYPE)) {
      expect(ALL_ELEMENT_TYPES, `"${key}" is not in ALL_ELEMENT_TYPES`).toContain(key);
    }
  });

  it('every Enter target lands on a real element type', () => {
    for (const [from, to] of Object.entries(DEFAULT_NEXT_TYPE)) {
      expect(ALL_ELEMENT_TYPES, `${from} → "${to}" points at a nonexistent type`).toContain(to);
    }
  });

  it('ALL_ELEMENT_TYPES has no duplicates', () => {
    expect(new Set(ALL_ELEMENT_TYPES).size).toBe(ALL_ELEMENT_TYPES.length);
  });
});

/**
 * v4.59 — Derek's full follows-what grammar table, keyed on the element
 * above the line being chosen. v4.61: stored VERBATIM — `character` is one
 * of the three dialogue options, labeled "Dialogue (Name)".
 */
describe('allowedElementsAfter', () => {
  const CANDIDATES = ['action', 'character', 'dialogue', 'dualDialogue', 'sceneHeading', 'transition', 'parenthetical', 'general', 'shot', 'lyrics', 'showEpisode'];
  const allowedSet = (prev: string | null) =>
    CANDIDATES.filter((id) => allowedElementsAfter(prev)(id)).sort();

  // v4.84, Derek: 'character' is no longer OFFERED, but it is still the
  // grammar's name-line concept — so a row that allows a name line also
  // allows 'dialogue', which starts at the name. Both appear here because
  // CANDIDATES asks about every id, not just the pickable ones.
  it("matches Derek's table row for row", () => {
    expect(allowedSet('sceneHeading')).toEqual(['action', 'character', 'dialogue', 'dualDialogue']);
    expect(allowedSet('action')).toEqual(['action', 'character', 'dialogue', 'dualDialogue', 'sceneHeading', 'transition']);
    expect(allowedSet('character')).toEqual(['dialogue', 'parenthetical']);
    expect(allowedSet('parenthetical')).toEqual(['dialogue']);
    // v4.68: parenthetical is allowed after dialogue (mid-speech beats).
    expect(allowedSet('dialogue')).toEqual(['action', 'character', 'dialogue', 'dualDialogue', 'parenthetical', 'sceneHeading', 'transition']);
    expect(allowedSet('transition')).toEqual(['action', 'sceneHeading']);
  });

  // The resolver that makes "Dialogue" mean the name line at the top of a
  // speech and the speech itself underneath one.
  it('resolvePickedElement: Dialogue starts at the name, except under a name', () => {
    expect(resolvePickedElement('dialogue', 'sceneHeading')).toBe('character');
    expect(resolvePickedElement('dialogue', 'action')).toBe('character');
    expect(resolvePickedElement('dialogue', null)).toBe('character');
    expect(resolvePickedElement('dialogue', 'character')).toBe('dialogue');
    expect(resolvePickedElement('dialogue', 'parenthetical')).toBe('dialogue');
    // everything else passes straight through
    expect(resolvePickedElement('action', 'character')).toBe('action');
    expect(resolvePickedElement('transition', null)).toBe('transition');
  });

  it('a dual-dialogue block behaves like dialogue', () => {
    expect(allowedSet('dualDialogue')).toEqual(allowedSet('dialogue'));
  });

  it('unlisted contexts allow everything except parenthetical and transition', () => {
    for (const prev of [null, 'shot', 'general', 'lyrics']) {
      const set = allowedSet(prev);
      expect(set, String(prev)).not.toContain('parenthetical');
      expect(set, String(prev)).not.toContain('transition');
      expect(set, String(prev)).toContain('action');
      expect(set, String(prev)).toContain('sceneHeading');
      expect(set, String(prev)).toContain('general');
    }
  });

  it('a user-edited table overrides the default (v4.59)', () => {
    const custom = { sceneHeading: ['shot'], dialogue: ['dialogue', 'parenthetical'] };
    expect(allowedElementsAfter('sceneHeading', custom)('shot')).toBe(true);
    expect(allowedElementsAfter('sceneHeading', custom)('action')).toBe(false);
    expect(allowedElementsAfter('dialogue', custom)('parenthetical')).toBe(true);
    // dual dialogue above uses the user's dialogue row too
    expect(allowedElementsAfter('dualDialogue', custom)('parenthetical')).toBe(true);
    // unlisted prevs still use the generic fallback
    expect(allowedElementsAfter('shot', custom)('action')).toBe(true);
    expect(allowedElementsAfter('shot', custom)('parenthetical')).toBe(false);
  });
});
