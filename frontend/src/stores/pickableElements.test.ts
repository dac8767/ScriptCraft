// @vitest-environment jsdom
/**
 * The canonical pickable-element list (v0.84) — invariants.
 *
 * v4.54, Derek: `character` is NOT pickable. The name is initiated by picking
 * Dialogue (resolvePickedElement maps it), so no element list may offer
 * Character — while the character RULE must keep existing, because every
 * script's name lines still are character elements.
 */
import { describe, it, expect } from 'vitest';
import { useFormattingTemplateStore, NON_PICKABLE } from './formattingTemplateStore';

describe('getPickableElements', () => {
  const ids = () => useFormattingTemplateStore.getState().getPickableElements().map((r) => r.id);

  it('does not offer character (Dialogue initiates the name instead)', () => {
    expect(ids()).not.toContain('character');
    expect(NON_PICKABLE).toContain('character');
  });

  it('still offers dialogue, and the character rule itself survives', () => {
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
