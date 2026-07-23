/**
 * Script structure — the act / sequence hierarchy the Scenes tab and Outline use
 * for act badges and "jump to Act N". Untested until now; these pin act
 * numbering, the implicit PROLOGUE for scenes before any act, sequence grouping,
 * and the scene→act map.
 */
import { describe, it, expect } from 'vitest';
import type { JSONContent } from '@tiptap/react';
import { computeScriptStructure, defaultActName, sceneActLabel } from './scriptStructure';

const el = (type: string, text: string, attrs?: Record<string, unknown>): JSONContent =>
  ({ type, content: [{ type: 'text', text }], ...(attrs ? { attrs } : {}) });
const bare = (type: string, attrs?: Record<string, unknown>): JSONContent => ({ type, ...(attrs ? { attrs } : {}) });

describe('defaultActName', () => {
  it('names the first ten acts and falls back past that', () => {
    expect(defaultActName(1)).toBe('ACT ONE');
    expect(defaultActName(3)).toBe('ACT THREE');
    expect(defaultActName(10)).toBe('ACT TEN');
    expect(defaultActName(11)).toBe('ACT 11');
  });
});

describe('computeScriptStructure — with acts and sequences', () => {
  const doc: JSONContent = {
    type: 'doc',
    attrs: { sequences: [{ id: 'seq1', name: 'Setup', color: '#ff0000' }] },
    content: [
      bare('newAct'),                                        // → ACT ONE (implicit number)
      el('sceneHeading', 'INT. A', { sequenceId: 'seq1' }),  // scene 0 → act 1, sequence Setup
      el('sceneHeading', 'INT. B'),                          // scene 1 → act 1, orphan
      bare('newAct', { actNumber: 2, customName: 'The Twist' }),
      el('sceneHeading', 'INT. C'),                          // scene 2 → act 2
    ],
  };
  const s = computeScriptStructure(doc);

  it('splits into acts with numbers, default and custom names', () => {
    expect(s.acts).toHaveLength(2);
    expect(s.acts[0]).toMatchObject({ actNumber: 1, actName: 'ACT ONE', customName: '' });
    expect(s.acts[1]).toMatchObject({ actNumber: 2, actName: 'ACT TWO', customName: 'The Twist' });
  });

  it('assigns scenes to their act and groups by sequence', () => {
    expect(s.acts[0].scenes.map((sc) => sc.heading)).toEqual(['INT. A', 'INT. B']);
    expect(s.acts[0].sequences).toHaveLength(1);
    expect(s.acts[0].sequences[0]).toMatchObject({ id: 'seq1', name: 'Setup', color: '#ff0000' });
    expect(s.acts[0].sequences[0].scenes.map((sc) => sc.heading)).toEqual(['INT. A']);
    expect(s.acts[0].orphanScenes.map((sc) => sc.heading)).toEqual(['INT. B']); // no sequenceId
    expect(s.acts[1].scenes.map((sc) => sc.heading)).toEqual(['INT. C']);
  });

  it('maps scene index → act number and labels it', () => {
    expect(s.totalScenes).toBe(3);
    expect(s.sceneActMap.get(0)).toBe(1);
    expect(s.sceneActMap.get(2)).toBe(2);
    expect(sceneActLabel(s, 0)).toBe('A1');
    expect(sceneActLabel(s, 2)).toBe('A2');
  });
});

describe('computeScriptStructure — no acts', () => {
  const doc = { type: 'doc', content: [el('sceneHeading', 'S1'), el('sceneHeading', 'S2')] };
  const s = computeScriptStructure(doc);

  it('puts pre-act scenes in an implicit PROLOGUE and maps them to null', () => {
    expect(s.acts).toHaveLength(1);
    expect(s.acts[0]).toMatchObject({ actNumber: 0, actName: 'PROLOGUE' });
    expect(s.acts[0].scenes).toHaveLength(2);
    expect(s.sceneActMap.get(0)).toBeNull();
    expect(sceneActLabel(s, 0)).toBe('');   // no badge when there are no real acts
  });
});
