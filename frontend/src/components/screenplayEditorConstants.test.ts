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
import { COLLAB_COLORS, randomCollabColor, DEFAULT_NEXT_TYPE, ALL_ELEMENT_TYPES, resolvePickedElement, allowedElementsAfter } from './screenplayEditorConstants';

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
 * v4.54, Derek: Character is not offered in the element lists — picking
 * Dialogue on an empty line starts the couplet at the character-name prompt.
 * Every pick surface routes through this one resolver.
 */
describe('resolvePickedElement', () => {
  it('Dialogue on an empty line starts at the character name', () => {
    expect(resolvePickedElement('dialogue', 'action', true)).toBe('character');
    expect(resolvePickedElement('dialogue', 'sceneHeading', true)).toBe('character');
    expect(resolvePickedElement('dialogue', 'character', true)).toBe('character');
  });

  it('Dialogue on a non-empty line converts directly (its text is dialogue)', () => {
    expect(resolvePickedElement('dialogue', 'action', false)).toBe('dialogue');
  });

  it('an empty line that is already dialogue stays dialogue', () => {
    expect(resolvePickedElement('dialogue', 'dialogue', true)).toBe('dialogue');
  });

  it('every other pick passes through unchanged', () => {
    for (const t of ALL_ELEMENT_TYPES) {
      if (t === 'dialogue') continue;
      expect(resolvePickedElement(t, 'action', true)).toBe(t);
      expect(resolvePickedElement(t, 'action', false)).toBe(t);
    }
  });
});

/**
 * v4.59 — Derek's full follows-what grammar table, keyed on the element
 * above the line being chosen. His "Character"/"Dual Character" entries
 * surface in the dropdown as "Dialogue"/"Dual Dialogue" (the couplet cue).
 */
describe('allowedElementsAfter', () => {
  const CANDIDATES = ['action', 'dialogue', 'dualDialogue', 'sceneHeading', 'transition', 'parenthetical', 'general', 'shot', 'lyrics', 'showEpisode'];
  const allowedSet = (prev: string | null) =>
    CANDIDATES.filter((id) => allowedElementsAfter(prev)(id)).sort();

  it("matches Derek's table row for row", () => {
    expect(allowedSet('sceneHeading')).toEqual(['action', 'dialogue', 'dualDialogue']);
    expect(allowedSet('action')).toEqual(['action', 'dialogue', 'dualDialogue', 'sceneHeading', 'transition']);
    expect(allowedSet('character')).toEqual(['dialogue', 'parenthetical']);
    expect(allowedSet('parenthetical')).toEqual(['dialogue']);
    expect(allowedSet('dialogue')).toEqual(['action', 'dialogue', 'dualDialogue', 'sceneHeading', 'transition']);
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
