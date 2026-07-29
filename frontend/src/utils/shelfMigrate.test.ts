// @vitest-environment jsdom
/**
 * v5.36 — Notes v2 migration. A checklist card becomes a rich note whose
 * content IS a task list (Derek confirmed); a plain-text note becomes a
 * paragraph doc; snippets and already-migrated cards pass through.
 * (jsdom because the store import chain reads localStorage at module scope.)
 */
import { describe, it, expect } from 'vitest';
import { migrateShelfCards, shelfContentText } from './shelfMigrate';
import type { ShelfCard } from '../stores/editorStore';

const base = { color: '#fff8b8', createdAt: '2026-01-01T00:00:00Z' };

describe('migrateShelfCards', () => {
  it('a todo card becomes a note whose content is a task list, checks kept', () => {
    const [out] = migrateShelfCards([
      { id: 't1', type: 'todo', ...base, title: 'Chores', items: [{ text: 'email agent', done: false }, { text: 'print draft', done: true }] } as ShelfCard,
    ]);
    expect(out.type).toBe('comment');
    expect(out.title).toBe('Chores');
    expect(out.items).toBeUndefined();
    const doc = out.content as { content: { type: string; content: { attrs: { checked: boolean } }[] }[] };
    expect(doc.content[0].type).toBe('taskList');
    expect(doc.content[0].content.map((i) => i.attrs.checked)).toEqual([false, true]);
    expect(out.text).toBe('email agent\nprint draft');   // search mirror
  });

  it('a plain-text note becomes a paragraph doc, one per line', () => {
    const [out] = migrateShelfCards([
      { id: 'n1', type: 'comment', ...base, text: 'line one\nline two' } as ShelfCard,
    ]);
    const doc = out.content as { content: { type: string }[] };
    expect(doc.content).toHaveLength(2);
    expect(doc.content.every((n) => n.type === 'paragraph')).toBe(true);
    expect(shelfContentText(out.content)).toBe('line one line two');
  });

  it('snippets and already-migrated notes pass through unchanged', () => {
    const snip: ShelfCard = { id: 's1', type: 'snippet', ...base, text: 'INT. HOUSE' };
    const rich: ShelfCard = { id: 'n2', type: 'comment', ...base, text: 'x', content: { type: 'doc', content: [] } };
    const out = migrateShelfCards([snip, rich]);
    expect(out[0]).toBe(snip);
    expect(out[1]).toBe(rich);
  });

  it('is idempotent — migrating twice equals migrating once', () => {
    const cards = [
      { id: 't1', type: 'todo', ...base, items: [{ text: 'a', done: false }] } as ShelfCard,
      { id: 'n1', type: 'comment', ...base, text: 'hello' } as ShelfCard,
    ];
    const once = migrateShelfCards(cards);
    const twice = migrateShelfCards(once);
    expect(twice).toEqual(once);
  });
});
