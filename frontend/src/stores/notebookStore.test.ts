// @vitest-environment jsdom
/**
 * notebookStore (v1.87) — pins the sidebar tree operations ported from
 * Derek's Airtable Notebook extension: reconcile, remove/insert round-trips,
 * the ancestor guard, and the store-level move/delete behaviors.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  reconcileTree, removeNode, insertNode, isAncestor, pageIdsInTree,
  useNotebookStore, type NbNode,
} from './notebookStore';

const sec = (id: string, children: NbNode[] = [], name = id): NbNode =>
  ({ type: 'section', id, name, collapsed: false, children });
const pg = (id: string): NbNode => ({ type: 'page', id });

describe('notebook tree helpers', () => {
  it('reconcileTree drops dead pages and appends unplaced ones top-level', () => {
    const stored: NbNode[] = [sec('s1', [pg('a'), pg('dead')]), pg('b')];
    const out = reconcileTree(stored, ['a', 'b', 'new']);
    expect([...pageIdsInTree(out)].sort()).toEqual(['a', 'b', 'new']);
    const s1 = out[0] as Extract<NbNode, { type: 'section' }>;
    expect(s1.children).toEqual([pg('a')]);          // 'dead' pruned
    expect(out[2]).toEqual(pg('new'));               // appended at top level
  });

  it('removeNode + insertNode round-trips a nested page before/after/into', () => {
    const tree: NbNode[] = [sec('s1', [pg('a'), pg('b')]), pg('c')];
    const [without, node] = removeNode(tree, 'a');
    expect(node).toEqual(pg('a'));
    expect(pageIdsInTree(without).has('a')).toBe(false);

    const before = insertNode(without, node!, { kind: 'before', id: 'c' });
    expect(before.map((n) => n.id)).toEqual(['s1', 'a', 'c']);

    const into = insertNode(without, node!, { kind: 'into', id: 's1' });
    const s1 = into[0] as Extract<NbNode, { type: 'section' }>;
    expect(s1.children.map((n) => n.id)).toEqual(['b', 'a']);

    const after = insertNode(without, node!, { kind: 'after', id: 'c' });
    expect(after.map((n) => n.id)).toEqual(['s1', 'c', 'a']);
  });

  it('isAncestor sees itself and deep descendants, not siblings', () => {
    const tree: NbNode[] = [sec('s1', [sec('s2', [pg('deep')])]), pg('side')];
    expect(isAncestor(tree, 's1', 's1')).toBe(true);
    expect(isAncestor(tree, 's1', 'deep')).toBe(true);
    expect(isAncestor(tree, 's2', 'deep')).toBe(true);
    expect(isAncestor(tree, 's1', 'side')).toBe(false);
  });
});

describe('notebookStore actions', () => {
  beforeEach(() => {
    localStorage.clear();
    useNotebookStore.setState({ pages: {}, tree: [], selectedPageId: null });
  });

  it('addPage selects it; deletePage falls back to another page', () => {
    const s = useNotebookStore.getState();
    const p1 = s.addPage('flow');
    const p2 = s.addPage('canvas');
    expect(useNotebookStore.getState().selectedPageId).toBe(p2);
    useNotebookStore.getState().deletePage(p2);
    const after = useNotebookStore.getState();
    expect(after.selectedPageId).toBe(p1);
    expect(pageIdsInTree(after.tree).has(p2)).toBe(false);
  });

  it('moveNode refuses to drop a section into its own descendant', () => {
    useNotebookStore.setState({ tree: [sec('s1', [sec('s2')])] });
    useNotebookStore.getState().moveNode('s1', { kind: 'into', id: 's2' });
    const t = useNotebookStore.getState().tree;
    expect(t).toHaveLength(1);
    expect(t[0].id).toBe('s1');                      // unchanged
  });

  it('deleteSection frees descendant pages back to the top level', () => {
    const s = useNotebookStore.getState();
    const p1 = s.addPage('flow');
    useNotebookStore.setState({ tree: [sec('s1', [sec('s2', [pg(p1)])])] });
    useNotebookStore.getState().deleteSection('s1');
    const t = useNotebookStore.getState().tree;
    expect(t).toEqual([pg(p1)]);                     // page survives, sections gone
    expect(useNotebookStore.getState().pages[p1]).toBeTruthy();
  });
});
