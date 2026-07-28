// @vitest-environment jsdom
/**
 * v5.21, Derek: the merged Sticky Notes window — "+ Note" / "+ To-Do" lead
 * the body's action row; the header's kind filter and search narrow BOTH
 * lists; the title count is the sum of what the two lists are showing.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { StickyNotesTool, StickyTitleExtra } from './StickyNotes';
import { useEditorStore } from '../stores/editorStore';

let host: HTMLElement;
let root: Root;

beforeEach(() => {
  useEditorStore.setState({
    shelfCards: [
      { id: 'n1', type: 'comment', color: '#fff8b8', text: 'find the harbor scene', createdAt: '2026-01-01T00:00:00Z' },
      { id: 't1', type: 'todo', color: '#fff8b8', items: [{ text: 'email agent', done: false }], createdAt: '2026-01-02T00:00:00Z' },
    ],
    stickySearch: '',
    stickyKindFilter: 'all',
    notesSort: 'manual',
    todoSort: 'manual',
    noteOrder: [],
    todoOrder: [],
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

describe('v5.21: the merged Sticky Notes body', () => {
  it('+ Note and + To-Do lead the action row and add their card kinds', () => {
    act(() => root.render(<StickyNotesTool editor={null} />));
    const row = host.querySelector('.tool-action-row');
    expect(row).not.toBeNull();
    const btns = Array.from(row!.querySelectorAll('button.tool-action-btn'));
    expect(btns.map((b) => b.textContent)).toEqual(['+ Note', '+ To-Do']);
    act(() => { (btns[0] as HTMLButtonElement).click(); });
    expect(useEditorStore.getState().shelfCards.filter((c) => c.type === 'comment').length).toBe(2);
    act(() => { (btns[1] as HTMLButtonElement).click(); });
    expect(useEditorStore.getState().shelfCards.filter((c) => c.type === 'todo').length).toBe(2);
  });

  it('group labels show under All; the kind filter narrows and drops them', () => {
    act(() => root.render(<StickyNotesTool editor={null} />));
    expect(Array.from(host.querySelectorAll('.sticky-group-label')).map((e) => e.textContent))
      .toEqual(['Notes', 'To-Do']);
    act(() => { useEditorStore.setState({ stickyKindFilter: 'note' }); });
    expect(host.querySelectorAll('.sticky-group-label').length).toBe(0);
    expect(host.textContent).toContain('find the harbor scene');
    expect(host.textContent).not.toContain('email agent');
  });

  it('the header search reaches into to-do ITEM text and both empty hints', () => {
    act(() => root.render(<StickyNotesTool editor={null} />));
    act(() => { useEditorStore.setState({ stickySearch: 'email' }); });
    expect(host.textContent).toContain('No notes match the search.');
    expect(host.textContent).toContain('email agent');
    act(() => { useEditorStore.setState({ stickySearch: 'zzz-nothing' }); });
    expect(host.textContent).toContain('No notes match the search.');
    expect(host.textContent).toContain('No to-dos match the search.');
  });

  it('the title count sums both lists and follows the kind filter', () => {
    act(() => root.render(<><StickyNotesTool editor={null} /><StickyTitleExtra /></>));
    expect(host.querySelector('.tool-title-count')!.textContent).toBe('· 2');
    act(() => { useEditorStore.setState({ stickyKindFilter: 'todo' }); });
    expect(host.querySelector('.tool-title-count')!.textContent).toBe('· 1');
  });
});
