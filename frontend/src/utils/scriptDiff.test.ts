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

  it('merges a similar same-type edit into a modification with a word diff', () => {
    // Regression guard for the once-unreachable modification path: the LCS
    // backtrack emits substitutions as add-then-remove, and the merge now
    // handles both adjacency orders.
    const a = doc(el('action', 'The cat sat on the mat'));
    const b = doc(el('action', 'The cat sat on the rug'));
    const r = computeScriptDiff(a, b);
    expect(r.summary.totalModified).toBe(1);
    expect(r.summary.totalAdded).toBe(0);
    expect(r.summary.totalDeleted).toBe(0);
    const mod = r.blocks.find((x) => x.type === 'modified')!;
    expect(mod.oldText).toBe('The cat sat on the mat');
    expect(mod.newText).toBe('The cat sat on the rug');
    expect(mod.wordDiffs!.some((w) => w.kind === 'removed' && w.text === 'mat')).toBe(true);
    expect(mod.wordDiffs!.some((w) => w.kind === 'added' && w.text === 'rug')).toBe(true);
    expect(mod.wordDiffs!.some((w) => w.kind === 'same' && w.text === 'cat')).toBe(true);
  });

  it('a dissimilar same-type replacement stays delete+add (similarity gate holds)', () => {
    const a = doc(el('action', 'The cat sat on the mat'));
    const b = doc(el('action', 'Thunder rolls across distant hills'));
    const r = computeScriptDiff(a, b);
    expect(r.summary.totalModified).toBe(0);
    expect(r.summary.totalAdded).toBe(1);
    expect(r.summary.totalDeleted).toBe(1);
  });

  it('rolls dialogue changes up per character', () => {
    const a = doc(el('character', 'SARAH'), el('dialogue', 'Hello'));
    const b = doc(el('character', 'SARAH'), el('dialogue', 'Hello'), el('dialogue', 'Bye'));
    const r = computeScriptDiff(a, b);
    expect(r.summary.dialogueDelta).toEqual([{ character: 'SARAH', added: 1, removed: 0 }]);
  });
});
