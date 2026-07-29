// @vitest-environment jsdom
/**
 * v5.36, Derek's Notes v2: ONE kind of card — a rich-text note (the
 * annotation window's field). "+ Add Checklist", the kind tabs and the Type
 * sort are gone; Manual (the drag order) is the default sort; popped-out /
 * fullscreen shapes carry a "Notes per row:" stepper over an equal-height
 * row grid. (The v5.21/v5.22 merged-list tests this file held died with the
 * kinds; shelfMigrate.test.ts covers the old data's conversion.)
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { StickyNotesTool, StickyTitleExtra } from './StickyNotes';
import { useEditorStore, type ShelfCard } from '../stores/editorStore';

let host: HTMLElement;
let root: Root;

const doc = (t: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: t }] }] });
const note = (id: string, t: string, createdAt: string): ShelfCard =>
  ({ id, type: 'comment', color: '#fff8b8', content: doc(t), text: t, createdAt });

beforeEach(() => {
  useEditorStore.setState({
    shelfCards: [
      note('n1', 'find the harbor scene', '2026-01-01T00:00:00Z'),
      note('n2', 'act two sag', '2026-01-03T00:00:00Z'),
      note('n3', 'email agent', '2026-01-02T00:00:00Z'),
    ],
    stickySearch: '',
    stickySort: 'manual',
    toolCounts: {},
    fullscreenTool: null,
    tempTool: null,
    toolMode: {},
  });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('v5.36: one rich note kind', () => {
  it('ONE blue + Add Note button — the checklist button is gone', () => {
    act(() => root.render(<StickyNotesTool editor={null} />));
    const btns = Array.from(host.querySelectorAll('.tool-action-row button'));
    expect(btns.map((b) => b.textContent)).toEqual(['+ Add Note']);
    expect(btns[0].className).toContain('dialog-btn-primary');
    act(() => { (btns[0] as HTMLButtonElement).click(); });
    const cards = useEditorStore.getState().shelfCards;
    expect(cards).toHaveLength(4);
    expect(cards[3].type).toBe('comment');
  });

  it('every card body is the rich editor (ProseMirror), checklists included', () => {
    act(() => root.render(<StickyNotesTool editor={null} />));
    expect(host.querySelectorAll('.swn-note-editor .ProseMirror').length).toBe(3);
    // the rich toolbar exists per card (CSS shows it on focus)
    expect(host.querySelectorAll('.swn-mini-bar').length).toBe(3);
  });

  it('Manual (the array order) is the default sort', () => {
    act(() => root.render(<StickyNotesTool editor={null} />));
    expect(useEditorStore.getState().stickySort).toBe('manual');
    const text = host.querySelector('.swn-scroll')!.textContent!;
    expect(text.indexOf('find the harbor scene')).toBeLessThan(text.indexOf('act two sag'));
    expect(text.indexOf('act two sag')).toBeLessThan(text.indexOf('email agent'));
  });

  it('Date Created sorts newest first', () => {
    act(() => { useEditorStore.setState({ stickySort: 'created' }); });
    act(() => root.render(<StickyNotesTool editor={null} />));
    const text = host.querySelector('.swn-scroll')!.textContent!;
    // n2 (Jan 3) → n3 (Jan 2) → n1 (Jan 1)
    expect(text.indexOf('act two sag')).toBeLessThan(text.indexOf('email agent'));
    expect(text.indexOf('email agent')).toBeLessThan(text.indexOf('find the harbor scene'));
  });

  it('search reads the plain-text mirror and the title count follows', () => {
    act(() => root.render(<><StickyNotesTool editor={null} /><StickyTitleExtra /></>));
    expect(host.querySelector('.tool-title-count')!.textContent).toBe('· 3');
    act(() => { useEditorStore.setState({ stickySearch: 'email' }); });
    expect(host.textContent).toContain('email agent');
    expect(host.textContent).not.toContain('harbor');
    expect(host.querySelector('.tool-title-count')!.textContent).toBe('· 1');
  });
});

/** v5.23 gating, v5.36 wording: the stepper is "Notes per row:" and exists
 *  only in the popped-out / fullscreen shapes; docked stays one column. */
describe('Notes per row', () => {
  it('fullscreen shows the right-aligned stepper and drives the grid', () => {
    act(() => { useEditorStore.setState({ fullscreenTool: 'sticky', stickyPerRow: 3 }); });
    act(() => root.render(<StickyNotesTool editor={null} />));
    const group = host.querySelector('.tool-action-group.tool-action-right');
    expect(group).not.toBeNull();
    expect(group!.textContent).toContain('Notes per row:');
    const scroll = host.querySelector('.swn-scroll') as HTMLElement;
    expect(scroll.className).toContain('swn-grid');
    expect(scroll.style.getPropertyValue('--sticky-cols')).toBe('3');
  });

  it('docked shows no stepper and stays one column whatever the count says', () => {
    act(() => { useEditorStore.setState({ fullscreenTool: null, tempTool: null, toolMode: {}, stickyPerRow: 3 }); });
    act(() => root.render(<StickyNotesTool editor={null} />));
    expect(host.querySelector('.tool-action-group.tool-action-right')).toBeNull();
    expect((host.querySelector('.swn-scroll') as HTMLElement).className).not.toContain('swn-grid');
  });

  it('setStickyPerRow clamps to 1–8', () => {
    useEditorStore.getState().setStickyPerRow(99);
    expect(useEditorStore.getState().stickyPerRow).toBe(8);
    useEditorStore.getState().setStickyPerRow(0);
    expect(useEditorStore.getState().stickyPerRow).toBe(1);
  });
});
