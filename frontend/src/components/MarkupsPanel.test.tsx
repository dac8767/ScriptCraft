// @vitest-environment jsdom
/**
 * v5.25: the Markups tool window rendered for real — the two worst bug
 * classes here are a filter that silently shows the wrong set and a card
 * that renders without its location line. Editor-less render (editor: null)
 * is also the orphan path: every markup shows, marked "location removed".
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import MarkupsPanel from './MarkupsPanel';
import { useEditorStore } from '../stores/editorStore';
import { EMPTY_MARKUP_FILTERS, type ScriptMarkup } from '../stores/slices/markupsSlice';

const mk = (id: string, over: Partial<ScriptMarkup> = {}): ScriptMarkup => ({
  id, content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: `text of ${id}` }] }] },
  icon: 'flag', color: '#e05555', highlight: null,
  anchor: 'point', done: false, createdAt: '2026-07-29T00:00:00.000Z', ...over,
});

let container: HTMLDivElement;
let root: Root;

const renderPanel = () => act(() => { root.render(<MarkupsPanel editor={null} />); });
const cardTexts = () =>
  [...container.querySelectorAll('.markup-card-text')].map((el) => el.textContent);

describe('MarkupsPanel', () => {
  beforeEach(() => {
    useEditorStore.setState({ markups: [], markupEditorId: null, markupFilters: EMPTY_MARKUP_FILTERS });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('shows only OPEN markups by default; All reveals completed ones', () => {
    useEditorStore.setState({ markups: [mk('a'), mk('b', { done: true })] });
    renderPanel();
    expect(cardTexts()).toEqual(['text of a']);

    act(() => { useEditorStore.setState({ markupFilters: { ...EMPTY_MARKUP_FILTERS, done: 'all' } }); });
    expect(cardTexts()).toEqual(['text of a', 'text of b']);
  });

  it('filters by icon', () => {
    useEditorStore.setState({
      markups: [mk('a'), mk('b', { icon: 'star' })],
      markupFilters: { ...EMPTY_MARKUP_FILTERS, icons: ['star'] },
    });
    renderPanel();
    expect(cardTexts()).toEqual(['text of b']);
  });

  it('without an editor a markup is listed with its orphan location line', () => {
    useEditorStore.setState({ markups: [mk('a')] });
    renderPanel();
    expect(container.querySelector('.markup-card-meta')?.textContent).toBe('location removed from script');
  });

  it('the checkbox completes a markup (and the open-only view drops it)', () => {
    useEditorStore.setState({ markups: [mk('a')] });
    renderPanel();
    const check = container.querySelector('.markup-card-check') as HTMLInputElement;
    act(() => { check.click(); });
    expect(useEditorStore.getState().markups[0].done).toBe(true);
    expect(cardTexts()).toEqual([]);
  });

  it('the empty state invites the first markup', () => {
    renderPanel();
    expect(container.querySelector('.markups-empty')?.textContent).toMatch(/markups collect here/i);
  });
});
