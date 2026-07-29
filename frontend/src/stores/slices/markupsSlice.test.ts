// @vitest-environment jsdom
/**
 * v5.25: the Markups store slice — CRUD, the popover-open id, and the tool
 * window's filter state (OPEN-only is the contracted default view).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '../editorStore';
import { EMPTY_MARKUP_FILTERS, DEFAULT_MARKUP_PRESETS, type ScriptMarkup } from './markupsSlice';

const st = () => useEditorStore.getState();

const mk = (id: string, over: Partial<ScriptMarkup> = {}): ScriptMarkup => ({
  id, content: null, icon: 'flag', color: '#e05555', highlight: null,
  anchor: 'point', done: false, createdAt: '2026-07-29T00:00:00.000Z', ...over,
});

describe('markups slice', () => {
  beforeEach(() => {
    useEditorStore.setState({ markups: [], markupEditorId: null, markupFilters: EMPTY_MARKUP_FILTERS });
  });

  it('add / update / remove round-trip', () => {
    st().addMarkup(mk('a'));
    st().addMarkup(mk('b', { icon: 'star' }));
    expect(st().markups.map((m) => m.id)).toEqual(['a', 'b']);

    st().updateMarkup('a', { done: true, color: '#123456' });
    const a = st().markups.find((m) => m.id === 'a')!;
    expect(a.done).toBe(true);
    expect(a.color).toBe('#123456');
    // untouched fields survive a patch
    expect(a.icon).toBe('flag');

    st().removeMarkup('a');
    expect(st().markups.map((m) => m.id)).toEqual(['b']);
  });

  it('the popover id opens and clears', () => {
    st().setMarkupEditorId('a');
    expect(st().markupEditorId).toBe('a');
    st().setMarkupEditorId(null);
    expect(st().markupEditorId).toBeNull();
  });

  it('the default filter view is OPEN markups only', () => {
    expect(st().markupFilters.done).toBe('open');
    expect(st().markupFilters.icons).toEqual([]);
    expect(st().markupFilters.kinds).toEqual([]);
  });

  it('the six default presets are Derek’s spec order, flag first', () => {
    expect(DEFAULT_MARKUP_PRESETS).toHaveLength(6);
    expect(DEFAULT_MARKUP_PRESETS[0].icon).toBe('flag');
    expect(st().markupPresets).toEqual(DEFAULT_MARKUP_PRESETS);
  });
});
