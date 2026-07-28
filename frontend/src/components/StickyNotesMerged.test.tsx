// @vitest-environment jsdom
/**
 * v5.21 merged the Notes and To-Do tools; v5.22, Derek's refinement: ONE
 * interleaved list (no forced groups) with a Type sort defaulting on open,
 * blue "+ Add Note" / "+ Add Checklist" buttons, reorderable All / Notes /
 * Checklists header tabs, and search across both kinds.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { StickyNotesTool, StickyTitleExtra, useStickyTabs, reorderStickyTabs } from './StickyNotes';
import { useEditorStore } from '../stores/editorStore';

let host: HTMLElement;
let root: Root;

beforeEach(() => {
  useEditorStore.setState({
    shelfCards: [
      { id: 't1', type: 'todo', color: '#fff8b8', items: [{ text: 'email agent', done: false }], createdAt: '2026-01-02T00:00:00Z' },
      { id: 'n1', type: 'comment', color: '#fff8b8', text: 'find the harbor scene', createdAt: '2026-01-01T00:00:00Z' },
      { id: 'n2', type: 'comment', color: '#fff8b8', text: 'act two sag', createdAt: '2026-01-03T00:00:00Z' },
    ],
    stickySearch: '',
    stickyKindFilter: 'all',
    stickySort: 'type',
    stickyTabOrder: ['all', 'note', 'todo'],
    toolCounts: {},
  });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('v5.22: one interleaved Sticky Notes list', () => {
  it('blue + Add Note / + Add Checklist lead the body and add their kinds', () => {
    act(() => root.render(<StickyNotesTool editor={null} />));
    const btns = Array.from(host.querySelectorAll('.tool-action-row button'));
    expect(btns.map((b) => b.textContent)).toEqual(['+ Add Note', '+ Add Checklist']);
    // the format is the dialogs' filled primary — the Reorder precedent
    for (const b of btns) expect(b.className).toContain('dialog-btn-primary');
    act(() => { (btns[1] as HTMLButtonElement).click(); });
    expect(useEditorStore.getState().shelfCards.filter((c) => c.type === 'todo').length).toBe(2);
  });

  it('Type sort is the default and groups notes before checklists — no group headers', () => {
    act(() => root.render(<StickyNotesTool editor={null} />));
    expect(useEditorStore.getState().stickySort).toBe('type');
    expect(host.querySelectorAll('.sticky-group-label').length).toBe(0);
    const text = host.querySelector('.swn-scroll')!.textContent!;
    // both notes precede the checklist under Type sort
    expect(text.indexOf('find the harbor scene')).toBeLessThan(text.indexOf('email agent'));
    expect(text.indexOf('act two sag')).toBeLessThan(text.indexOf('email agent'));
  });

  it('Date Created sorts ALL cards together, newest first', () => {
    act(() => { useEditorStore.setState({ stickySort: 'created' }); });
    act(() => root.render(<StickyNotesTool editor={null} />));
    const text = host.querySelector('.swn-scroll')!.textContent!;
    // n2 (Jan 3) → t1 (Jan 2) → n1 (Jan 1): the checklist lands BETWEEN notes
    expect(text.indexOf('act two sag')).toBeLessThan(text.indexOf('email agent'));
    expect(text.indexOf('email agent')).toBeLessThan(text.indexOf('find the harbor scene'));
  });

  it('the tabs narrow the list and the title count follows', () => {
    act(() => root.render(<><StickyNotesTool editor={null} /><StickyTitleExtra /></>));
    expect(host.querySelector('.tool-title-count')!.textContent).toBe('· 3');
    act(() => { useEditorStore.setState({ stickyKindFilter: 'todo' }); });
    expect(host.textContent).toContain('email agent');
    expect(host.textContent).not.toContain('harbor');
    expect(host.querySelector('.tool-title-count')!.textContent).toBe('· 1');
  });

  it('search matches checklist item text across the merged list', () => {
    act(() => root.render(<StickyNotesTool editor={null} />));
    act(() => { useEditorStore.setState({ stickySearch: 'email' }); });
    expect(host.textContent).toContain('email agent');
    expect(host.textContent).not.toContain('harbor');
  });
});

describe('v5.22: reorderable header tabs', () => {
  it('renders in the stored order with Checklists wording', () => {
    function Probe() {
      const tabs = useStickyTabs();
      return <>{tabs.map((t) => <button key={t.label} className={t.active ? 'on' : ''}>{t.label}</button>)}</>;
    }
    act(() => { useEditorStore.setState({ stickyTabOrder: ['todo', 'all', 'note'] }); });
    act(() => root.render(<Probe />));
    expect(Array.from(host.querySelectorAll('button')).map((b) => b.textContent))
      .toEqual(['Checklists', 'All', 'Notes']);
  });

  it('reorderStickyTabs persists the move and the first tab is the open view', () => {
    reorderStickyTabs(2, 0);   // move 'todo' to the front
    expect(useEditorStore.getState().stickyTabOrder).toEqual(['todo', 'all', 'note']);
    // the persisted [0] seeds which view the tool opens on (store init reads it)
    expect(JSON.parse(localStorage.getItem('opendraft:viewState') ?? '{}').stickyTabOrder)
      .toEqual(['todo', 'all', 'note']);
  });
});
