/**
 * Screenplay-aware version diff (DiffViewer / version history). Node-level, not
 * line-level, so changes read as script elements. Untested until now; these pin
 * add / delete / modify classification, the word-level diff inside a modified
 * block, scene-change tracking, and the per-character dialogue delta.
 */
import { describe, it, expect } from 'vitest';
import type { JSONContent } from '@tiptap/react';
import { computeScriptDiff } from './scriptDiff';

const el = (type: string, text: string): JSONContent => ({ type, content: [{ type: 'text', text }] });
const doc = (...content: JSONContent[]): JSONContent => ({ type: 'doc', content });

describe('computeScriptDiff', () => {
  it('marks everything unchanged for identical docs', () => {
    const d = doc(el('sceneHeading', 'INT. A'), el('action', 'X'));
    const r = computeScriptDiff(d, d);
    expect(r.blocks.every((b) => b.type === 'unchanged')).toBe(true);
    expect(r.summary).toMatchObject({ totalAdded: 0, totalDeleted: 0, totalModified: 0, scenesChanged: [] });
  });

  it('detects a pure addition and attributes it to its scene', () => {
    const a = doc(el('sceneHeading', 'INT. A'), el('action', 'X'));
    const b = doc(el('sceneHeading', 'INT. A'), el('action', 'X'), el('action', 'Y'));
    const r = computeScriptDiff(a, b);
    expect(r.summary.totalAdded).toBe(1);
    expect(r.summary.totalDeleted).toBe(0);
    expect(r.summary.scenesChanged).toEqual(['INT. A']);
    const added = r.blocks.find((x) => x.type === 'added')!;
    expect(added).toMatchObject({ elementType: 'action', newText: 'Y', oldText: null, oldIndex: -1 });
  });

  it('detects a pure deletion', () => {
    const a = doc(el('sceneHeading', 'INT. A'), el('action', 'X'), el('action', 'Y'));
    const b = doc(el('sceneHeading', 'INT. A'), el('action', 'X'));
    const r = computeScriptDiff(a, b);
    expect(r.summary.totalDeleted).toBe(1);
    expect(r.summary.totalAdded).toBe(0);
    const del = r.blocks.find((x) => x.type === 'deleted')!;
    expect(del).toMatchObject({ elementType: 'action', oldText: 'Y', newText: null, newIndex: -1 });
  });

  it('surfaces a same-type edit — currently as delete+add, NOT a merged modification', () => {
    // KNOWN LIMITATION (flagged to Derek): the LCS backtrack unshifts leftover
    // adds ahead of removes, so the remove→add adjacency the modification
    // heuristic looks for never forms for a simple edit. diffWords /
    // isLikelyModification are therefore unreached for typical edits, and a small
    // wording change renders as a full delete+add instead of an inline word diff.
    // This pins the ACTUAL behavior so a future fix trips the test intentionally.
    const a = doc(el('action', 'The cat sat on the mat'));
    const b = doc(el('action', 'The cat sat on the rug'));
    const r = computeScriptDiff(a, b);
    expect(r.summary.totalModified).toBe(0);
    expect(r.summary.totalAdded).toBe(1);
    expect(r.summary.totalDeleted).toBe(1);
    expect(r.blocks.find((x) => x.type === 'deleted')?.oldText).toBe('The cat sat on the mat');
    expect(r.blocks.find((x) => x.type === 'added')?.newText).toBe('The cat sat on the rug');
  });

  it('rolls dialogue changes up per character', () => {
    const a = doc(el('character', 'SARAH'), el('dialogue', 'Hello'));
    const b = doc(el('character', 'SARAH'), el('dialogue', 'Hello'), el('dialogue', 'Bye'));
    const r = computeScriptDiff(a, b);
    expect(r.summary.dialogueDelta).toEqual([{ character: 'SARAH', added: 1, removed: 0 }]);
  });
});
