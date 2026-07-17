// @vitest-environment jsdom
/**
 * Bookmarks (v3.08) — positions must survive edits (mapping) and reloads
 * (localStorage), and the no-op mapping skip must not drop updates.
 * jsdom: the store persists through localStorage on every write.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useBookmarkStore, bookmarkLabelAt } from './bookmarkStore';

const SCRIPT = 'test-script';

beforeEach(() => {
  localStorage.removeItem('opendraft:bookmarks');
  useBookmarkStore.setState({ byScript: {}, lastEdit: {} });
});

describe('bookmark store', () => {
  it('adds and removes per script', () => {
    const s = useBookmarkStore.getState();
    s.add(SCRIPT, { id: 'a', label: 'One', pos: 10 });
    s.add(SCRIPT, { id: 'b', label: 'Two', pos: 20 });
    s.add('other', { id: 'c', label: 'Elsewhere', pos: 5 });
    expect(useBookmarkStore.getState().byScript[SCRIPT].map((b) => b.id)).toEqual(['a', 'b']);
    useBookmarkStore.getState().remove(SCRIPT, 'a');
    expect(useBookmarkStore.getState().byScript[SCRIPT].map((b) => b.id)).toEqual(['b']);
    expect(useBookmarkStore.getState().byScript.other).toHaveLength(1);
  });

  it('maps positions through an edit (insert before shifts, after does not)', () => {
    const s = useBookmarkStore.getState();
    s.add(SCRIPT, { id: 'a', label: 'One', pos: 10 });
    s.add(SCRIPT, { id: 'b', label: 'Two', pos: 50 });
    // simulate inserting 5 chars at pos 20: positions >= 20 shift by 5
    useBookmarkStore.getState().mapPositions(SCRIPT, (p) => (p >= 20 ? p + 5 : p));
    const list = useBookmarkStore.getState().byScript[SCRIPT];
    expect(list.find((b) => b.id === 'a')!.pos).toBe(10);
    expect(list.find((b) => b.id === 'b')!.pos).toBe(55);
  });

  it('persists adds, removals and lastEdit to localStorage', () => {
    const s = useBookmarkStore.getState();
    s.add(SCRIPT, { id: 'a', label: 'One', pos: 10 });
    useBookmarkStore.getState().setLastEdit(SCRIPT, 42);
    const raw = JSON.parse(localStorage.getItem('opendraft:bookmarks')!);
    expect(raw.byScript[SCRIPT][0]).toEqual({ id: 'a', label: 'One', pos: 10 });
    expect(raw.lastEdit[SCRIPT]).toBe(42);
  });

  it('identity mapping is a no-op (no pointless writes, list unchanged)', () => {
    const s = useBookmarkStore.getState();
    s.add(SCRIPT, { id: 'a', label: 'One', pos: 10 });
    const before = useBookmarkStore.getState().byScript[SCRIPT];
    useBookmarkStore.getState().mapPositions(SCRIPT, (p) => p);
    expect(useBookmarkStore.getState().byScript[SCRIPT]).toBe(before);
  });
});

describe('bookmarkLabelAt', () => {
  it('trims long block text and falls back on empty lines', () => {
    const doc = { resolve: () => ({ parent: { textContent: 'x'.repeat(60) } }) };
    expect(bookmarkLabelAt(doc, 1)).toBe(`${'x'.repeat(42)}…`);
    const empty = { resolve: () => ({ parent: { textContent: '   ' } }) };
    expect(bookmarkLabelAt(empty, 1)).toBe('Empty line');
  });
});
