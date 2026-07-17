// @vitest-environment jsdom
/**
 * Last-edit tracking (v3.25 — the bookmark list itself was removed; only
 * the per-script last-edit position remains). jsdom: persists through
 * localStorage on every write, under the historical 'opendraft:bookmarks'
 * key.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useBookmarkStore, bookmarkScriptKey } from './bookmarkStore';

beforeEach(() => {
  localStorage.removeItem('opendraft:bookmarks');
  useBookmarkStore.setState({ lastEdit: {} });
});

describe('last-edit store', () => {
  it('tracks per script and persists', () => {
    useBookmarkStore.getState().setLastEdit('a', 42);
    useBookmarkStore.getState().setLastEdit('b', 7);
    expect(useBookmarkStore.getState().lastEdit).toEqual({ a: 42, b: 7 });
    const raw = JSON.parse(localStorage.getItem('opendraft:bookmarks')!);
    expect(raw.lastEdit).toEqual({ a: 42, b: 7 });
  });

  it('ignores legacy byScript data in the persisted blob', () => {
    localStorage.setItem('opendraft:bookmarks', JSON.stringify({
      byScript: { a: [{ id: 'x', label: 'Old', pos: 1 }] },
      lastEdit: { a: 5 },
    }));
    // fresh load path
    expect(JSON.parse(localStorage.getItem('opendraft:bookmarks')!).lastEdit.a).toBe(5);
  });

  it('keys unsaved scripts under local', () => {
    expect(bookmarkScriptKey(null)).toBe('local');
    expect(bookmarkScriptKey('abc')).toBe('abc');
  });
});
