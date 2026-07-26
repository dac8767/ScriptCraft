// @vitest-environment jsdom
/**
 * The canonical pickable-element list (v0.84) — invariants.
 *
 * v4.61, Derek: `character` IS pickable again — it is one of the three
 * dialogue options, labeled "Dialogue (character)" (ELEMENT_LABELS), never
 * plain "Character" in any list.
 */
import { describe, it, expect } from 'vitest';
import { useFormattingTemplateStore, NON_PICKABLE } from './formattingTemplateStore';
import { ELEMENT_LABELS } from './editorStore';

describe('getPickableElements', () => {
  const ids = () => useFormattingTemplateStore.getState().getPickableElements().map((r) => r.id);

  it('offers character, labeled "Dialogue (character)"', () => {
    expect(ids()).toContain('character');
    expect(NON_PICKABLE).not.toContain('character');
    expect(ELEMENT_LABELS['character']).toBe('Dialogue (character)');
  });

  it('offers dialogue too, and the character rule survives', () => {
    expect(ids()).toContain('dialogue');
    const rules = useFormattingTemplateStore.getState().getEffectiveRules();
    expect(rules['character']).toBeTruthy();
    expect(rules['character'].enabled).toBe(true);
  });

  it('offers none of the structural non-pickables', () => {
    const list = ids();
    for (const id of NON_PICKABLE) expect(list).not.toContain(id);
  });
});
