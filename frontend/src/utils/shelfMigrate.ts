/**
 * v5.36 — Notes v2 migration. Derek: one kind of card, a rich-text body
 * "like the annotation window", no note/checklist distinction. Old data has
 * two shapes: comment cards carrying plain `text`, and todo cards carrying
 * `items`. Both become a rich note (`content`, TipTap JSON) — a checklist
 * card becomes a note whose content IS a task list (Derek confirmed this
 * conversion). Titles are kept. Snippets pass through untouched.
 *
 * Runs where saved files enter the store (ScreenplayEditor's load path), so
 * scripts of any age open into the new shape. Idempotent: already-migrated
 * cards (content set, no items) come back unchanged.
 */
import type { ShelfCard } from '../stores/editorStore';

const para = (t: string) =>
  ({ type: 'paragraph', ...(t ? { content: [{ type: 'text', text: t }] } : {}) });

/** Plain text of a note's rich content — the search/snippet mirror. */
export function shelfContentText(content: unknown): string {
  const parts: string[] = [];
  const walk = (n: unknown) => {
    if (!n || typeof n !== 'object') return;
    const node = n as { type?: string; text?: string; content?: unknown[] };
    if (node.type === 'text' && node.text) parts.push(node.text);
    node.content?.forEach(walk);
  };
  walk(content);
  return parts.join(' ').trim();
}

export function migrateShelfCards(cards: ShelfCard[]): ShelfCard[] {
  return cards.map((c) => {
    if (c.type === 'snippet') return c;
    if (c.type === 'todo') {
      const items = c.items ?? [];
      const content = {
        type: 'doc',
        content: [{
          type: 'taskList',
          content: items.map((it) => ({
            type: 'taskItem',
            attrs: { checked: !!it.done },
            content: [para(it.text)],
          })),
        }],
      };
      const { items: _drop, ...rest } = c;
      return { ...rest, type: 'comment' as const, content, text: items.map((i) => i.text).join('\n') };
    }
    // legacy plain-text note → paragraph doc (empty text stays content-less)
    if (c.content == null && (c.text ?? '') !== '') {
      const content = { type: 'doc', content: (c.text ?? '').split('\n').map(para) };
      return { ...c, content };
    }
    return c;
  });
}
