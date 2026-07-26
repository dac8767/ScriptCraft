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
import { COLLAB_COLORS, randomCollabColor, DEFAULT_NEXT_TYPE, ALL_ELEMENT_TYPES, allowedElementsAfter } from './screenplayEditorConstants';

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

  it("matches Derek's table row for row", () => {
    expect(allowedSet('sceneHeading')).toEqual(['action', 'character', 'dualDialogue']);
    expect(allowedSet('action')).toEqual(['action', 'character', 'dualDialogue', 'sceneHeading', 'transition']);
    expect(allowedSet('character')).toEqual(['dialogue', 'parenthetical']);
    expect(allowedSet('parenthetical')).toEqual(['dialogue']);
    // v4.68: parenthetical is allowed after dialogue (mid-speech beats).
    expect(allowedSet('dialogue')).toEqual(['action', 'character', 'dualDialogue', 'parenthetical', 'sceneHeading', 'transition']);
    expect(allowedSet('transition')).toEqual(['action', 'sceneHeading']);
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

describe('randomCollabColor', () => {
  it('always returns a color from the palette', () => {
    for (let i = 0; i < 50; i++) {
      expect(COLLAB_COLORS).toContain(randomCollabColor());
    }
  });
});
