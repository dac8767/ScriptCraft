/**
 * ListControls (v1.0) — the Filter / Sort bar and the ordering rules shared by
 * Notes and To-Do.
 *
 * Both lists now hold script-anchored items and window items TOGETHER, so both
 * need the same three questions answered the same way: what am I looking at
 * (filter), in what order (sort), and — when sort is blank — where did I drag
 * this (manual order). Written once so the two windows can't answer them
 * differently.
 */
import React from 'react';
import AddMenu from './AddMenu';

export type ListFilter = 'all' | 'script' | 'general';
export type ListSort = 'manual' | 'created' | 'script';

/** One row in either list, whatever it actually is underneath. */
export interface ListEntry {
  /** Stable key, also the manual-order key: note:<id> | card:<id> | todo:<id> */
  key: string;
  /** Anchored in the script, or living only in the window? */
  linked: boolean;
  /** Document position — sorts by where it falls in the script. */
  pos?: number;
  createdAt?: string;
  render: () => React.ReactNode;
}

const FILTER_LABEL: Record<ListFilter, string> = {
  all: 'All',
  script: 'In the Script',
  general: 'General',
};
const SORT_LABEL: Record<ListSort, string> = {
  manual: 'Manual',
  created: 'Date Created',
  script: 'Script Page',
};

export function ListToolbar({ filter, setFilter, sort, setSort, count, noun }: {
  filter: ListFilter; setFilter: (f: ListFilter) => void;
  sort: ListSort; setSort: (s: ListSort) => void;
  count: number; noun: string;
}) {
  return (
    <div className="fs-list-toolbar">
      <span className="fs-list-count">{count} {noun}{count === 1 ? '' : 's'}</span>
      <AddMenu
        label={`Filter: ${FILTER_LABEL[filter]}`}
        title="Show only script-linked items, only general ones, or everything"
        onPick={(v) => setFilter(v as ListFilter)}
        groups={[{
          label: 'Show',
          options: (['all', 'script', 'general'] as ListFilter[])
            .map((f) => ({ value: f, label: FILTER_LABEL[f] })),
        }]}
      />
      <AddMenu
        label={`Sort: ${SORT_LABEL[sort]}`}
        title="Manual lets you drag items into any order you like"
        onPick={(v) => setSort(v as ListSort)}
        groups={[{
          label: 'Sort by',
          options: (['manual', 'created', 'script'] as ListSort[])
            .map((s) => ({ value: s, label: SORT_LABEL[s] })),
        }]}
      />
    </div>
  );
}

/** Filter, then order. Manual order is only honoured when Sort is Manual. */
export function arrangeEntries(
  entries: ListEntry[],
  filter: ListFilter,
  sort: ListSort,
  manualOrder: string[],
): ListEntry[] {
  const visible = entries.filter((e) =>
    filter === 'all' ? true : filter === 'script' ? e.linked : !e.linked);

  if (sort === 'created') {
    return [...visible].sort((a, b) =>
      (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));   // newest first
  }
  if (sort === 'script') {
    // By position in the script. Items with no place in it have no page number,
    // so they fall to the bottom rather than being given a fake one.
    return [...visible].sort((a, b) => {
      if (a.pos == null && b.pos == null) return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
      if (a.pos == null) return 1;
      if (b.pos == null) return -1;
      return a.pos - b.pos;
    });
  }
  // Manual: the user's order, with anything they haven't touched (a brand-new
  // note, say) kept in its natural place at the end rather than vanishing.
  const rank = new Map(manualOrder.map((k, i) => [k, i]));
  return [...visible].sort((a, b) => {
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
