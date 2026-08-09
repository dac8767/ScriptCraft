// @vitest-environment jsdom
/**
 * v6.49, Derek: the Outline header carries the standard Filter · View ·
 * Search cluster (the Arrangement toggle and the "Show beat color on all
 * tabs" checkbox are gone), and the search/color filter hide non-matching
 * beats through one shared predicate.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { beatMatchesFilter, OutlineHeaderControls, OutlineBeatCount } from './BeatBoard';
import { useEditorStore } from '../stores/editorStore';

const BEAT = { title: 'Midpoint reversal', description: 'Ellie learns the truth', color: '#ef4444' };

describe('beatMatchesFilter', () => {
  it('matches on title OR description, case-insensitively', () => {
    expect(beatMatchesFilter(BEAT, 'midpoint', [])).toBe(true);
    expect(beatMatchesFilter(BEAT, 'ELLIE', [])).toBe(true);
    expect(beatMatchesFilter(BEAT, 'climax', [])).toBe(false);
    expect(beatMatchesFilter(BEAT, '', [])).toBe(true);
  });

  it('color filter: empty = all; entries restrict; "" means uncolored', () => {
    expect(beatMatchesFilter(BEAT, '', ['#ef4444'])).toBe(true);
    expect(beatMatchesFilter(BEAT, '', ['#2563eb'])).toBe(false);
    expect(beatMatchesFilter({ ...BEAT, color: '' }, '', [''])).toBe(true);
    expect(beatMatchesFilter(BEAT, '', [''])).toBe(false);
  });

  it('search and color must BOTH match', () => {
    expect(beatMatchesFilter(BEAT, 'ellie', ['#ef4444'])).toBe(true);
    expect(beatMatchesFilter(BEAT, 'ellie', ['#2563eb'])).toBe(false);
    expect(beatMatchesFilter(BEAT, 'climax', ['#ef4444'])).toBe(false);
  });
});

describe('OutlineHeaderControls (v6.49 cluster)', () => {
  let host: HTMLElement;
  let root: Root;

  beforeEach(() => {
    useEditorStore.getState().resetOutlineTabs();
    useEditorStore.getState().setBeatSearch('');
    useEditorStore.getState().clearBeatColorFilter();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  });

  it('renders Filter, View (current arrangement) and Search — no Arrangement toggle, no color checkbox, no bar checkbox', () => {
    act(() => { root.render(<OutlineHeaderControls />); });
    const labels = [...host.querySelectorAll('.tool-ctl .tool-ctl-label')].map((el) => el.textContent);
    expect(labels).toContain('Filter');
    // v6.50, Derek: the View trigger shows only the CURRENT view's icon +
    // name (no "View" word) — the slot stamp comes from the title.
    const view = host.querySelector('[data-ctl="view"]');
    expect(view).toBeTruthy();
    expect(view?.textContent).toBe('Sections');
    expect(view?.querySelector('svg')).toBeTruthy();
    expect(view?.textContent).not.toContain('View');
    expect(host.querySelector('[data-ctl="search"], .tool-ctl-search-field')).toBeTruthy();
    expect(host.querySelector('.beat-mode-center')).toBeNull();
    expect(host.querySelector('.beat-mode-btn')).toBeNull();
    expect(host.querySelector('.beat-color-alltabs')).toBeNull();
    expect(host.querySelector('.beat-bar-check')).toBeNull();   // body row's job now
  });

  /* v6.52, Derek: the count lives BESIDE the tab strip (OutlineBeatCount),
     not in the right-hand cluster. */
  it('shows "M of N beats" while a search narrows the board', () => {
    const st = useEditorStore.getState();
    const colId = st.addBeatColumn('Act I');
    st.addBeat('Opening image', colId);
    st.addBeat('Midpoint', colId);
    act(() => { root.render(<OutlineBeatCount />); });
    expect(host.querySelector('.beat-board-info')?.textContent).toBe('2 beats');
    act(() => { useEditorStore.getState().setBeatSearch('mid'); });
    expect(host.querySelector('.beat-board-info')?.textContent).toBe('1 of 2 beats');
  });

  it('the cluster no longer carries the count', () => {
    act(() => { root.render(<OutlineHeaderControls />); });
    expect(host.querySelector('.beat-board-info')).toBeNull();
  });
});
