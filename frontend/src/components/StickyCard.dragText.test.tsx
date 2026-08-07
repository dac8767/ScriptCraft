// @vitest-environment jsdom
/**
 * cardDragText (v6.17) — the drag payload is the card's TEXT, not its id.
 * Dropping a card in the script pastes text/plain verbatim (ProseMirror's
 * default drop), so a UUID payload put UUIDs in the script — Derek dragged a
 * snippet in and got "0d855902-f95d-4227-b7ce-39e146b8f1e5". These pin the
 * payload rules; the reorder path never reads the payload (dragId state).
 */
import { describe, it, expect } from 'vitest';
import { cardDragText } from './StickyCard';
import type { ShelfCard } from '../stores/editorStore';

const base = { id: 'aaaa-1111', color: '#f4d35e', createdAt: '2026-08-07T00:00:00.000Z' };
const snippet = (text: string): ShelfCard => ({ ...base, type: 'snippet', text });
const note = (text: string): ShelfCard => ({ ...base, type: 'comment', text });

describe('cardDragText', () => {
  it('a snippet carries its script text verbatim, never its id', () => {
    const c = snippet('INT. BRIDGE - NIGHT\nThe co-pilot summons a hologram.');
    expect(cardDragText(c)).toBe('INT. BRIDGE - NIGHT\nThe co-pilot summons a hologram.');
    expect(cardDragText(c)).not.toContain(c.id);
  });

  it('multi-line snippet text keeps its line breaks (they become blocks on drop)', () => {
    expect(cardDragText(snippet('one\ntwo\nthree'))).toBe('one\ntwo\nthree');
  });

  it('a note flattens its rich HTML to readable text', () => {
    const c = note('<p>Check the <strong>timeline</strong></p><p>&mdash; again</p>');
    const out = cardDragText(c);
    expect(out).toContain('Check the timeline');
    expect(out).not.toContain('<');
    expect(out).toContain('—');
  });

  it('an empty card still yields a non-empty payload (WebKit refuses a dataless drag)', () => {
    expect(cardDragText(snippet('')).length).toBeGreaterThan(0);
    expect(cardDragText(note('')).length).toBeGreaterThan(0);
  });
});
