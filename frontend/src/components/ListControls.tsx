/**
 * ListControls (v1.0) — the ordering rules and option labels shared by Notes
 * and To-Do.
 *
 * v4.33, Derek: both windows hold ONLY general (non-script) items now — script
 * notes and script to-do lists live in the Navigator, and note text is edited
 * in a popover on the highlight itself. The filter (All/General/In Script) and
 * the Scene # sort died with the split: with one kind of item there is nothing
 * to filter, and nothing here has a script position to sort by. What remains —
 * sort rules and drag plumbing — is still written once so the two windows
 * can't answer "in what order" differently.
 */
import React from 'react';

export type ListSort = 'manual' | 'created';

/** One row in either list, whatever it actually is underneath. */
export interface ListEntry {
  /** Stable key, also the manual-order key: card:<id> */
  key: string;
  createdAt?: string;
  render: () => React.ReactNode;
}

export const SORT_LABEL: Record<ListSort, string> = {
  manual: 'Manual',
  created: 'Date Created',
};

/** v5.21: the merged Sticky Notes window's header search — ONE predicate for
 *  the notes and to-do lists, so they can't disagree about what matches.
 *  Covers the editable title, a note's text, and every to-do item line. */
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

/** Order the list. Manual order is only honoured when Sort is Manual. */
export function arrangeEntries(
  entries: ListEntry[],
  sort: ListSort,
  manualOrder: string[],
): ListEntry[] {
  if (sort === 'created') {
    return [...entries].sort((a, b) =>
      (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));   // newest first
  }
  // Manual: the user's order, with anything they haven't touched (a brand-new
  // note, say) kept in its natural place at the end rather than vanishing.
  const rank = new Map(manualOrder.map((k, i) => [k, i]));
  return [...entries].sort((a, b) => {
    const ra = rank.has(a.key) ? rank.get(a.key)! : Number.MAX_SAFE_INTEGER;
    const rb = rank.has(b.key) ? rank.get(b.key)! : Number.MAX_SAFE_INTEGER;
    return ra - rb;
  });
}

/** Move `from` to where `to` currently sits, and return the full new order. */
export function reorderKeys(order: string[], allKeys: string[], from: string, to: string): string[] {
  // Start from the order as displayed, so a first-ever drag doesn't scramble
  // everything that had no stored position yet.
  const base = [...order.filter((k) => allKeys.includes(k))];
  for (const k of allKeys) if (!base.includes(k)) base.push(k);
  const fi = base.indexOf(from);
  const ti = base.indexOf(to);
  if (fi < 0 || ti < 0 || fi === ti) return base;
  const [moved] = base.splice(fi, 1);
  base.splice(ti, 0, moved);
  return base;
}

/**
 * Drag props for a card. The grip is the draggable element; the card is the drop
 * target.
 *
 * setData is NOT optional: WebKit (which is what Tauri runs on the Mac) refuses
 * to start a drag without it, which is precisely why the grip on a Notes card
 * looked draggable and did nothing.
 */
export function entryDragProps(
  key: string,
  enabled: boolean,
  dragKey: string | null,
  setDragKey: (k: string | null) => void,
  onDrop: (from: string, to: string) => void,
) {
  return {
    grip: {
      onDragStart: (e: React.DragEvent) => {
        if (!enabled) { e.preventDefault(); return; }
        e.dataTransfer.setData('text/plain', key);   // required by WebKit
        e.dataTransfer.effectAllowed = 'move';
        setDragKey(key);
      },
      onDragEnd: () => setDragKey(null),
    },
    card: {
      onDragOver: (e: React.DragEvent) => { if (enabled && dragKey) e.preventDefault(); },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        if (enabled && dragKey && dragKey !== key) onDrop(dragKey, key);
        setDragKey(null);
      },
    },
  };
}
