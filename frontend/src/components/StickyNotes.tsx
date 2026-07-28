/**
 * StickyNotes — the ScriptCraft sticky-card system, two right-dock tools:
 *   - StickyNotesTool ("Sticky Notes"): note cards AND checklist cards in
 *     ONE interleaved list. v5.21 merged the tools; v5.22, Derek: "do not
 *     force separating the notes and to-do items" — the stacked groups are
 *     gone. Sort is Type (notes first — the default) / Manual (the
 *     shelfCards ARRAY order, drag any card anywhere, the Snippets model) /
 *     Date Created (newest first across both kinds). The header carries
 *     All · Notes · Checklists TABS (user-reorderable, persisted — the
 *     first tab is the view the tool opens on) plus Sort and Search.
 *     The tool keeps the id 'sticky'; 'todo' remains a retired id that
 *     migrates onto it (editorStore). Card data was always one `_shelf`
 *     list, so all of this is presentation.
 *   - FragmentsTool ("Snippets"): text sent from the
 *     editor via ⌥⌘X (cut) / ⌥⌘C (copy) — bound in ScreenplayEditor.
 * v4.33, Derek: both kinds hold ONLY non-script items. Script notes and
 * script [ ] checklists live in the Navigator (which jumps to them); note
 * text is edited in the popover on the highlight itself.
 * Cards keep sticky colors, drag-reorder, editable title headers (type name
 * as placeholder), and creation dates. Data persists per script as the
 * `_shelf` key of the saved content JSON and syncs in collab via collabSync.
 */
import { useState, useEffect, type CSSProperties } from 'react';
import type { Editor } from '@tiptap/react';
import {
  useEditorStore,
  SHELF_DEFAULT_COLOR,
  type ShelfCard,
  type ShelfCardType,
} from '../stores/editorStore';
import { StickyCard } from './StickyCard';
import { cardMatchesSearch, STICKY_SORT_LABEL, type StickySort } from './ListControls';
import { ControlDropdown, ControlSearch, ToolActionRow, type ToolChromeTab } from './ToolControls';
import { CircleMinusIcon, CirclePlusIcon } from './uiIcons';
import { uuid } from '../utils/uuid';


const EMPTY_HINTS: Record<ShelfCardType, string> = {
  comment: 'Notes to self, research links, themes to keep present. Hit + Add Note above.',
  todo: 'Checklists for anything outside the script. Hit + Add Checklist above.',
  snippet: 'Select text in the Editor and press ⌥⌘X to cut it here, or ⌥⌘C to copy it over.',
};

/** Build a snippet card from editor text (used by the capture shortcuts). */
export function makeSnippetCard(text: string): ShelfCard {
  return { id: uuid(), type: 'snippet', text, color: SHELF_DEFAULT_COLOR, createdAt: new Date().toISOString() };
}

/* ═══════════ Shared card list (per card type) with drag reorder ═══════════ */

function useCardOps() {
  const { shelfCards, setShelfCards } = useEditorStore();
  const update = (id: string, patch: Partial<ShelfCard>) =>
    setShelfCards(shelfCards.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const remove = (id: string) => setShelfCards(shelfCards.filter((c) => c.id !== id));
  const add = (type: ShelfCardType) => {
    const base: ShelfCard = { id: uuid(), type, color: SHELF_DEFAULT_COLOR, createdAt: new Date().toISOString() };
    if (type === 'comment') base.text = '';
    if (type === 'todo') base.items = [];
    setShelfCards([...shelfCards, base]);
  };
  return { shelfCards, setShelfCards, update, remove, add };
}

interface CardListProps {
  type: ShelfCardType;
  /** already-filtered cards to show (search); defaults to all of this type */
  cards?: ShelfCard[];
}

function CardList({ type, cards }: CardListProps) {
  const { shelfCards, setShelfCards, update, remove } = useCardOps();
  const [dragId, setDragId] = useState<string | null>(null);
  const [startArmed, setStartArmed] = useState(false);
  const [endArmed, setEndArmed] = useState(false);

  const visible = cards ?? shelfCards.filter((c) => c.type === type);

  const dropOn = (targetId: string) => {
    if (!dragId || dragId === targetId) { setDragId(null); return; }
    const arr = [...shelfCards];
    const from = arr.findIndex((c) => c.id === dragId);
    if (from === -1) { setDragId(null); return; }
    const [moved] = arr.splice(from, 1);
    const to = arr.findIndex((c) => c.id === targetId);
    arr.splice(to === -1 ? arr.length : to, 0, moved);
    setShelfCards(arr);
    setDragId(null);
  };
  const dropAtStart = () => {
    if (!dragId) return;
    const arr = [...shelfCards];
    const from = arr.findIndex((c) => c.id === dragId);
    if (from === -1) { setDragId(null); return; }
    const [moved] = arr.splice(from, 1);
    const firstIdx = arr.findIndex((c) => c.type === type);
    arr.splice(firstIdx === -1 ? arr.length : firstIdx, 0, moved);
    setShelfCards(arr);
    setDragId(null);
    setStartArmed(false);
  };
  const dropAtEnd = () => {
    if (!dragId) return;
    const arr = [...shelfCards];
    const from = arr.findIndex((c) => c.id === dragId);
    if (from === -1) { setDragId(null); return; }
    const [moved] = arr.splice(from, 1);
    arr.push(moved);
    setShelfCards(arr);
    setDragId(null);
    setEndArmed(false);
  };

  return (
    <div className="swn-scroll">
      {visible.length === 0 && <div className="swn-hint">{EMPTY_HINTS[type]}</div>}
      {dragId && visible.length > 0 && (
        <div
          className={'swn-drop-zone' + (startArmed ? ' armed' : '')}
          onDragOver={(e) => { e.preventDefault(); setStartArmed(true); }}
          onDragLeave={() => setStartArmed(false)}
          onDrop={dropAtStart}
        />
      )}
      {visible.map((card) => (
        <StickyCard
          key={card.id}
          card={card}
          dragging={dragId === card.id}
          onDragStart={() => setDragId(card.id)}
          onDragEnd={() => { setDragId(null); setStartArmed(false); setEndArmed(false); }}
          onDropHere={() => dropOn(card.id)}
          onUpdate={(p) => update(card.id, p)}
          onRemove={() => remove(card.id)}
        />
      ))}
      {dragId && visible.length > 0 && (
        <div
          className={'swn-drop-zone' + (endArmed ? ' armed' : '')}
          onDragOver={(e) => { e.preventDefault(); setEndArmed(true); }}
          onDragLeave={() => setEndArmed(false)}
          onDrop={dropAtEnd}
        />
      )}
    </div>
  );
}

/* ═══════════ Tool: Sticky Notes (Notes + To-Do, merged v5.21) ═══════════ */

interface EditorToolProps {
  editor: Editor | null;
}

/**
 * v5.22, Derek: one INTERLEAVED list — "do not force separating the notes
 * and to-do items." Sorting:
 *   - 'type' (default): notes before checklists, each kind in array order —
 *     the old grouped look, now just a sort you can leave.
 *   - 'manual': the shelfCards ARRAY order (the Snippets model) — drag any
 *     card anywhere, including between kinds. A drop snaps Sort to Manual
 *     so what you arranged is what you see.
 *   - 'created': newest first across both kinds.
 * The header tabs narrow to a kind; search runs through cardMatchesSearch.
 * The count published is exactly what's rendered.
 */
function MergedStickyList({ perRow = 1 }: { perRow?: number }) {
  const { shelfCards, setShelfCards, update, remove } = useCardOps();
  const kind = useEditorStore((s) => s.stickyKindFilter);
  const sort = useEditorStore((s) => s.stickySort);
  const setSort = useEditorStore((s) => s.setStickySort);
  const search = useEditorStore((s) => s.stickySearch);
  const [dragId, setDragId] = useState<string | null>(null);
  const [startArmed, setStartArmed] = useState(false);
  const [endArmed, setEndArmed] = useState(false);

  const filtered = shelfCards.filter((c) =>
    (c.type === 'comment' || c.type === 'todo')
    && (kind === 'all' || (kind === 'note' ? c.type === 'comment' : c.type === 'todo'))
    && cardMatchesSearch(c, search));
  const visible = sort === 'created'
    ? [...filtered].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
    : sort === 'type'
      ? [...filtered.filter((c) => c.type === 'comment'), ...filtered.filter((c) => c.type === 'todo')]
      : filtered;   // manual = the array order itself

  useEffect(() => {
    useEditorStore.getState().setToolCount('sticky', visible.length);
  }, [visible.length]);

  // Drops land in the ARRAY (the manual order) and snap Sort to Manual.
  const dropOn = (targetId: string) => {
    if (!dragId || dragId === targetId) { setDragId(null); return; }
    const arr = [...shelfCards];
    const from = arr.findIndex((c) => c.id === dragId);
    if (from === -1) { setDragId(null); return; }
    const [moved] = arr.splice(from, 1);
    const to = arr.findIndex((c) => c.id === targetId);
    arr.splice(to === -1 ? arr.length : to, 0, moved);
    setShelfCards(arr);
    setSort('manual');
    setDragId(null);
  };
  const dropAtEdge = (edge: 'start' | 'end') => {
    if (!dragId) return;
    const arr = [...shelfCards];
    const from = arr.findIndex((c) => c.id === dragId);
    if (from === -1) { setDragId(null); return; }
    const [moved] = arr.splice(from, 1);
    const anchors = visible.filter((c) => c.id !== dragId);
    const anchor = edge === 'start' ? anchors[0] : anchors[anchors.length - 1];
    const idx = anchor ? arr.findIndex((c) => c.id === anchor.id) + (edge === 'end' ? 1 : 0) : arr.length;
    arr.splice(idx, 0, moved);
    setShelfCards(arr);
    setSort('manual');
    setDragId(null);
    setStartArmed(false);
    setEndArmed(false);
  };

  const emptyHint = search.trim()
    ? 'Nothing matches the search.'
    : kind === 'note' ? EMPTY_HINTS.comment
      : kind === 'todo' ? EMPTY_HINTS.todo
        : 'No notes or checklists yet. Add one above.';

  return (
    <div
      className={'swn-scroll' + (perRow > 1 ? ' swn-grid' : '')}
      style={perRow > 1 ? ({ '--sticky-per-row': perRow } as CSSProperties) : undefined}
    >
      {visible.length === 0 && <div className="swn-hint">{emptyHint}</div>}
      {dragId && visible.length > 0 && (
        <div
          className={'swn-drop-zone' + (startArmed ? ' armed' : '')}
          onDragOver={(e) => { e.preventDefault(); setStartArmed(true); }}
          onDragLeave={() => setStartArmed(false)}
          onDrop={() => dropAtEdge('start')}
        />
      )}
      {visible.map((card) => (
        <StickyCard
          key={card.id}
          card={card}
          dragging={dragId === card.id}
          onDragStart={() => setDragId(card.id)}
          onDragEnd={() => { setDragId(null); setStartArmed(false); setEndArmed(false); }}
          onDropHere={() => dropOn(card.id)}
          onUpdate={(p) => update(card.id, p)}
          onRemove={() => remove(card.id)}
        />
      ))}
      {dragId && visible.length > 0 && (
        <div
          className={'swn-drop-zone' + (endArmed ? ' armed' : '')}
          onDragOver={(e) => { e.preventDefault(); setEndArmed(true); }}
          onDragLeave={() => setEndArmed(false)}
          onDrop={() => dropAtEdge('end')}
        />
      )}
    </div>
  );
}

/** v5.21 merged window; v5.22, Derek: blue add buttons ("+ Add Note" /
 *  "+ Add Checklist" — the dialogs' primary COLORS; v5.23: compact box).
 *  v5.23, Derek: popped-out and fullscreen shapes gain a right-aligned
 *  "Items per row:" stepper (the Pages model); docked panels stay one
 *  column and don't show it. */
export function StickyNotesTool(_props: EditorToolProps) {
  const { add } = useCardOps();
  const perRow = useEditorStore((s) => s.stickyPerRow);
  const setPerRow = useEditorStore((s) => s.setStickyPerRow);
  const fs = useEditorStore((s) => s.fullscreenTool === 'sticky');
  const temp = useEditorStore((s) => s.tempTool === 'sticky');
  const mode = useEditorStore((s) => s.toolMode.sticky);
  const popped = fs || temp || mode === 'floating';
  return (
    <div className="fs-sticky-tool">
      <ToolActionRow>
        <button className="dialog-btn dialog-btn-primary sticky-add-btn" onClick={() => add('comment')}>+ Add Note</button>
        <button className="dialog-btn dialog-btn-primary sticky-add-btn" onClick={() => add('todo')}>+ Add Checklist</button>
        {popped && (
          <span className="tool-action-group tool-action-right">
            <span className="tool-action-label" id="sticky-perrow-label">Items per row:</span>
            <button
              className="tool-action-btn tool-action-icon"
              title="Fewer items per row (bigger cards)"
              disabled={perRow <= 1}
              onClick={() => setPerRow(perRow - 1)}
            ><CircleMinusIcon /></button>
            <span className="tool-action-count" aria-labelledby="sticky-perrow-label">{perRow}</span>
            <button
              className="tool-action-btn tool-action-icon"
              title="More items per row (smaller cards)"
              disabled={perRow >= 8}
              onClick={() => setPerRow(perRow + 1)}
            ><CirclePlusIcon /></button>
          </span>
        )}
      </ToolActionRow>
      {/* .swn-scroll is the ONE scroller (the Snippets model) — no wrapper,
          or the panel would nest two scrollbars. */}
      <MergedStickyList perRow={popped ? perRow : 1} />
    </div>
  );
}

/* ═══════════ Tool: Snippets ═══════════ */

export function FragmentsTool(_props: EditorToolProps) {
  return (
    <div className="fs-sticky-tool">
      <CardList type="snippet" />
    </div>
  );
}

/* (v5.22: TodoListContent and ScriptNotesContent are gone — one interleaved
   MergedStickyList above replaced the two stacked lists.) */

/* ═══════════ Window chrome (v4.32, Derek's window template) ═══════════ */

/** TOOL_CHROME slots for Sticky Notes, wired in ToolDock. The "· N" count is
 *  what the one merged list is showing — published by the body, displayed
 *  here, never recomputed. Tabs, sort and search live in the store, so the
 *  chrome and the list can't drift. */
export function StickyTitleExtra() {
  const count = useEditorStore((s) => s.toolCounts['sticky'] ?? 0);
  return <span className="tool-title-count">· {count}</span>;
}

/** Snippets' count comes straight off the store list — the body (CardList)
 *  shows every snippet card, no filter, so there's nothing to publish. */
export function SnippetsTitleExtra() {
  const count = useEditorStore((s) => s.shelfCards.filter((c) => c.type === 'snippet').length);
  return <span className="tool-title-count">· {count}</span>;
}

const STICKY_TAB_LABEL: Record<'all' | 'note' | 'todo', string> = {
  all: 'All',
  note: 'Notes',
  todo: 'Checklists',
};

/** v5.22, Derek: the Filter dropdown became header TABS — All · Notes ·
 *  Checklists, in the user's own order (drag a tab to rearrange; persisted,
 *  and the FIRST tab is the view the tool opens on). */
export function useStickyTabs(): ToolChromeTab[] {
  const order = useEditorStore((s) => s.stickyTabOrder);
  const kind = useEditorStore((s) => s.stickyKindFilter);
  const setKind = useEditorStore((s) => s.setStickyKindFilter);
  return order.map((k) => ({
    label: STICKY_TAB_LABEL[k],
    active: kind === k,
    onSelect: () => setKind(k),
  }));
}

/** The tabs' drag-reorder handler (ChromeTabs calls it with tab indices). */
export function reorderStickyTabs(from: number, to: number) {
  const st = useEditorStore.getState();
  const order = [...st.stickyTabOrder];
  if (from < 0 || from >= order.length || to < 0 || to >= order.length) return;
  const [moved] = order.splice(from, 1);
  order.splice(to, 0, moved);
  st.setStickyTabOrder(order);
}

/** v5.22: the header cluster is Sort · Search (the kind moved to the tabs).
 *  v5.23, Derek: Manual is the LAST option. */
export function StickyControls() {
  const sort = useEditorStore((s) => s.stickySort);
  const setSort = useEditorStore((s) => s.setStickySort);
  const search = useEditorStore((s) => s.stickySearch);
  const setSearch = useEditorStore((s) => s.setStickySearch);
  return (
    <>
      <ControlDropdown
        label="Sort"
        title="Type groups notes before checklists; Manual lets you drag any order"
        current={sort === 'type' ? undefined : STICKY_SORT_LABEL[sort]}
        items={(['type', 'created', 'manual'] as StickySort[]).map((v) => ({
          label: STICKY_SORT_LABEL[v], active: sort === v, onSelect: () => setSort(v),
        }))}
      />
      <ControlSearch value={search} onChange={setSearch} placeholder="Search notes & checklists…" />
    </>
  );
}

