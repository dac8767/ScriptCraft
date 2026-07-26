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
 * v4.58, Derek: the Enter-key suggestions follow script grammar, keyed on the
 * element above the line being chosen.
 */
describe('allowedElementsAfter', () => {
  const after = (prev: string | null, id: string) => allowedElementsAfter(prev)(id);

  it('after a scene heading only Action, Dialogue, Dual Dialogue remain', () => {
    for (const id of ['action', 'dialogue', 'dualDialogue']) {
      expect(after('sceneHeading', id), id).toBe(true);
    }
    for (const id of ['transition', 'parenthetical', 'general', 'shot', 'sceneHeading', 'lyrics']) {
      expect(after('sceneHeading', id), id).toBe(false);
    }
  });

  it('parenthetical is offered only right after a character name', () => {
    expect(after('character', 'parenthetical')).toBe(true);
    for (const prev of ['action', 'dialogue', 'dualDialogue', 'parenthetical', 'transition', null]) {
      expect(after(prev, 'parenthetical'), String(prev)).toBe(false);
    }
  });

  it('transition is offered only after action or dialogue (dual or single)', () => {
    for (const prev of ['action', 'dialogue', 'dualDialogue']) {
      expect(after(prev, 'transition'), prev).toBe(true);
    }
    for (const prev of ['character', 'parenthetical', 'transition', 'shot', null]) {
      expect(after(prev, 'transition'), String(prev)).toBe(false);
    }
  });

  it('everything else passes through outside the scene-heading rule', () => {
    for (const prev of ['action', 'dialogue', 'character', null]) {
      for (const id of ['action', 'dialogue', 'dualDialogue', 'general', 'shot', 'sceneHeading']) {
        expect(after(prev, id), `${prev} → ${id}`).toBe(true);
      }
    }
  });
});

describe('randomCollabColor', () => {
  it('always returns a color from the palette', () => {
    for (let i = 0; i < 50; i++) {
      expect(COLLAB_COLORS).toContain(randomCollabColor());
    }
  });
});
