// @vitest-environment jsdom
/**
 * Per-character custom fields (v4.88, Derek: "add a checkbox that says 'Apply
 * to all characters?' ... if not, it will only appear on the current
 * character").
 *
 * The compatibility rule is the important one: a field made before v4.88 has
 * no owner, and MUST keep showing on every character. Nothing migrates, so
 * "no owner = shared" has to hold forever.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from './editorStore';
import { characterFieldsFor } from './slices/characterSlice';
import type { CharacterCustomField } from './editorStore';

const store = () => useEditorStore.getState();

describe('characterFieldsFor', () => {
  const shared: CharacterCustomField = { id: 'a', label: 'Motto' };
  const mayas: CharacterCustomField = { id: 'b', label: 'Scar', owner: 'MAYA' };
  const bens: CharacterCustomField = { id: 'c', label: 'Rank', owner: 'BEN' };
  const all = [shared, mayas, bens];

  it('gives a character the shared fields plus its own', () => {
    expect(characterFieldsFor(all, 'MAYA').map((f) => f.id)).toEqual(['a', 'b']);
    expect(characterFieldsFor(all, 'BEN').map((f) => f.id)).toEqual(['a', 'c']);
  });

  it('a character with no fields of its own still gets the shared ones', () => {
    expect(characterFieldsFor(all, 'CHORUS').map((f) => f.id)).toEqual(['a']);
  });

  it('matches on the upper-cased name, whatever case the caller passes', () => {
    expect(characterFieldsFor(all, 'maya').map((f) => f.id)).toEqual(['a', 'b']);
  });

  it('pre-v4.88 fields (no owner at all) show on everyone — no migration needed', () => {
    const legacy = [{ id: 'x', label: 'Age' }, { id: 'y', label: 'Job' }];
    expect(characterFieldsFor(legacy, 'ANYONE')).toHaveLength(2);
  });
});

describe('addCharacterCustomField', () => {
  beforeEach(() => { useEditorStore.setState({ characterCustomFields: [] }); });

  it('without an owner the field is shared', () => {
    store().addCharacterCustomField('Motto');
    const [f] = store().characterCustomFields;
    expect(f.label).toBe('Motto');
    expect(f.owner).toBeUndefined();
  });

  it('with an owner the field is scoped, and the name is upper-cased to match profiles', () => {
    store().addCharacterCustomField('Scar', 'maya');
    expect(store().characterCustomFields[0].owner).toBe('MAYA');
  });

  it('a blank label adds nothing', () => {
    store().addCharacterCustomField('   ', 'MAYA');
    expect(store().characterCustomFields).toHaveLength(0);
  });

  it('removing a scoped field drops it and its values everywhere', () => {
    useEditorStore.setState({
      characterProfiles: [{ name: 'MAYA', customFields: { keep: 'v', gone: 'v' } } as never],
    });
    store().addCharacterCustomField('Scar', 'MAYA');
    const id = store().characterCustomFields[0].id;
    useEditorStore.setState({
      characterProfiles: [{ name: 'MAYA', customFields: { [id]: 'a long scar' } } as never],
    });
    store().removeCharacterCustomField(id);
    expect(store().characterCustomFields).toHaveLength(0);
    expect(store().characterProfiles[0].customFields).toEqual({});
  });
});
