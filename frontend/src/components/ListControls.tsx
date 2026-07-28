/**
 * ListControls (v1.0) — the option labels and shared predicates of the Sticky
 * Notes window.
 *
 * v5.22, Derek: "do not force separating the notes and to-do items" — the
 * window is ONE interleaved list now, so the per-list machinery this file
 * used to hold (arrangeEntries over ListEntry[], reorderKeys, the grip/card
 * entryDragProps pair) died with the split lists. Manual order is the
 * shelfCards array itself (the Snippets model); the sort and search live
 * here so the header controls and the list can't disagree.
 */

export type StickySort = 'type' | 'manual' | 'created';

export const STICKY_SORT_LABEL: Record<StickySort, string> = {
  type: 'Type',
  manual: 'Manual',
  created: 'Date Created',
};

/** The merged window's header search — ONE predicate for notes and
 *  checklists, so they can't disagree about what matches. Covers the
 *  editable title, a note's text, and every checklist item line. */
export function cardMatchesSearch(
  card: { title?: string; text?: string; items?: { text: string }[] },
  q: string,
): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  if (card.title?.toLowerCase().includes(needle)) return true;
  if (card.text?.toLowerCase().includes(needle)) return true;
  return !!card.items?.some((it) => it.text.toLowerCase().includes(needle));
}
