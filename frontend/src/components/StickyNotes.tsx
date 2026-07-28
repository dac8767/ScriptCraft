/**
 * StickyNotes — the ScriptCraft sticky-card system, two right-dock tools:
 *   - StickyNotesTool ("Sticky Notes"): note cards AND to-do cards in one
 *     window. v5.21, Derek: "combine the notes and to-do tools" — + Note /
 *     + To-Do lead the body's action row; Filter (kind) / Sort / Search live
 *     in the window header (StickyControls below). The tool KEEPS the id
 *     'sticky' (persisted layouts) and the retired 'todo' id migrates onto
 *     it in editorStore; the card data was always one `_shelf` list, so the
 *     merge is pure presentation.
 *   - FragmentsTool ("Snippets"): text sent from the
 *     editor via ⌥⌘X (cut) / ⌥⌘C (copy) — bound in ScreenplayEditor.
 * v4.33, Derek: both lists hold ONLY non-script items. Script notes and
 * script [ ] to-do lists live in the Navigator (which jumps to them); note
 * text is edited in the popover on the highlight itself.
 * Cards keep sticky colors, drag-reorder, editable title headers (type name
 * as placeholder), and creation dates. Data persists per script as the
 * `_shelf` key of the saved content JSON and syncs in collab via collabSync.
 */
import { useState, useEffect } from 'react';
import type { Editor } from '@tiptap/react';
import {
  useEditorStore,
  SHELF_DEFAULT_COLOR,
  type ShelfCard,
  type ShelfCardType,
} from '../stores/editorStore';
import { ScriptNotesContent } from './ScriptNotes';
import React from 'react';
import { StickyCard } from './StickyCard';
import {
  arrangeEntries, reorderKeys, entryDragProps, cardMatchesSearch, SORT_LABEL,
  type ListEntry, type ListSort,
} from './ListControls';
import { ControlDropdown, ControlSearch, ToolActionRow } from './ToolControls';
import { uuid } from '../utils/uuid';


const EMPTY_HINTS: Record<ShelfCardType, string> = {
  comment: 'Notes to self, research links, themes to keep present. Hit + Note above.',
  todo: 'To-do lists for anything outside the script. Hit + To-Do above.',
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
 * v5.21, Derek: "combine the notes and to-do tools… two buttons: '+ Note',
 * and '+ To-Do'… at the top row of the window body. add search and filter to
 * the window header."
 *
 * ONE window, both lists, stacked under group labels (labels only while the
 * header filter shows All — a narrowed view IS its label). Each list keeps
 * its own sort/manual-order machinery (notesSort+noteOrder, todoSort+
 * todoOrder) — the merge is presentation, not a data migration. The header
 * search runs through cardMatchesSearch (ListControls) in both lists.
 * A filtered-out list is unmounted, so this body zeroes its published count
 * — the title's "· N" (StickyTitleExtra sums both) must count what's shown.
 */
export function StickyNotesTool(_props: EditorToolProps) {
  const { add } = useCardOps();
  const kind = useEditorStore((s) => s.stickyKindFilter);
  useEffect(() => {
    const st = useEditorStore.getState();
    if (kind === 'note') st.setToolCount('todo', 0);
    if (kind === 'todo') st.setToolCount('sticky', 0);
  }, [kind]);
  return (
    <div className="fs-sticky-tool">
      <ToolActionRow>
        <button className="tool-action-btn" onClick={() => add('comment')}>+ Note</button>
        <button className="tool-action-btn" onClick={() => add('todo')}>+ To-Do</button>
      </ToolActionRow>
      <div className="fs-notes-list">
        {kind !== 'todo' && (
          <>
            {kind === 'all' && <div className="sticky-group-label">Notes</div>}
            <ScriptNotesContent />
          </>
        )}
        {kind !== 'note' && (
          <>
            {kind === 'all' && <div className="sticky-group-label">To-Do</div>}
            <TodoListContent />
          </>
        )}
      </div>
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

/* ═══════════ The To-Do list (inside Sticky Notes since v5.21) ═══════════ */

/**
 * v4.33, Derek — general to-do cards ONLY. Script [ ] lists left this window:
 * they live in the script itself (edit them there) and in the Navigator
 * (tick them there, click to jump).
 * v5.21: no longer a tool of its own — this is the To-Do half of the merged
 * Sticky Notes body. Same store pair (todoSort, todoOrder), same cards.
 */
function TodoListContent() {
  const { shelfCards, setShelfCards, todoOrder, setTodoOrder } = useEditorStore();
  const sort = useEditorStore((s) => s.todoSort);
  const setSort = useEditorStore((s) => s.setTodoSort);
  const search = useEditorStore((s) => s.stickySearch);
  const [dragKey, setDragKey] = useState<string | null>(null);

  const entries: ListEntry[] = shelfCards
    .filter((c) => c.type === 'todo' && cardMatchesSearch(c, search))
    .map((card) => ({
      key: `card:${card.id}`,
      createdAt: card.createdAt,
      render: () => {
        const dp = entryDragProps(`card:${card.id}`, sort === 'manual', dragKey, setDragKey, onDropKey);
        return (
          <div {...dp.card}>
            <StickyCard
              card={card}
              dragging={dragKey === `card:${card.id}`}
              onDragStart={dp.grip.onDragStart}
              onDragEnd={dp.grip.onDragEnd}
              onDropHere={() => {}}
              onUpdate={(patch) => setShelfCards(shelfCards.map((c) => (c.id === card.id ? { ...c, ...patch } : c)))}
              onRemove={() => setShelfCards(shelfCards.filter((c) => c.id !== card.id))}
            />
          </div>
        );
      },
    }));
  const allKeys = entries.map((e) => e.key);
  function onDropKey(from: string, to: string) {
    setSort('manual');
    setTodoOrder(reorderKeys(todoOrder, allKeys, from, to));
  }
  const visible = arrangeEntries(entries, sort, todoOrder);

  // v4.32: publish the count this list is showing so the window chrome's
  // title (StickyTitleExtra sums notes + to-dos) displays the same number —
  // displayed there, never recomputed (charListCount's no-drift rule).
  useEffect(() => {
    useEditorStore.getState().setToolCount('todo', visible.length);
  }, [visible.length]);

  return (
    <div className="script-notes-list">
      {visible.length === 0 ? (
        <div className="fs-nav-empty fs-todo-hint">
          {search.trim()
            ? 'No to-dos match the search.'
            : 'No to-dos yet. Add one with + To-Do above. (To-do lists IN the script live in the Navigator — use Insert → To-Do List.)'}
        </div>
      ) : (
        visible.map((e) => <React.Fragment key={e.key}>{e.render()}</React.Fragment>)
      )}
    </div>
  );
}

/* ═══════════ Window chrome (v4.32, Derek's window template) ═══════════ */

/** TOOL_CHROME slots for Sticky Notes, wired in ToolDock. The "· N" count is
 *  the SUM of what the two lists are showing — each publishes its own count
 *  (setToolCount 'sticky'/'todo'), displayed here, never recomputed. Filter,
 *  sort and search live in the store, so the chrome and the lists can't
 *  drift. */
export function StickyTitleExtra() {
  const notes = useEditorStore((s) => s.toolCounts['sticky'] ?? 0);
  const todos = useEditorStore((s) => s.toolCounts['todo'] ?? 0);
  return <span className="tool-title-count">· {notes + todos}</span>;
}

/** Snippets' count comes straight off the store list — the body (CardList)
 *  shows every snippet card, no filter, so there's nothing to publish. */
export function SnippetsTitleExtra() {
  const count = useEditorStore((s) => s.shelfCards.filter((c) => c.type === 'snippet').length);
  return <span className="tool-title-count">· {count}</span>;
}

const STICKY_KINDS = [
  { id: 'all', label: 'All' },
  { id: 'note', label: 'Notes' },
  { id: 'todo', label: 'To-Dos' },
] as const;

/** v5.21, Derek: the merged window's header cluster — Filter (kind) · Sort ·
 *  Search. ONE Sort control drives BOTH lists' sort fields; they can only
 *  diverge through pre-merge state, shown as "Mixed" until it's set once. */
export function StickyControls() {
  const kind = useEditorStore((s) => s.stickyKindFilter);
  const setKind = useEditorStore((s) => s.setStickyKindFilter);
  const notesSort = useEditorStore((s) => s.notesSort);
  const todoSort = useEditorStore((s) => s.todoSort);
  const search = useEditorStore((s) => s.stickySearch);
  const setSearch = useEditorStore((s) => s.setStickySearch);
  const setBothSorts = (v: ListSort) => {
    const st = useEditorStore.getState();
    st.setNotesSort(v);
    st.setTodoSort(v);
  };
  return (
    <>
      <ControlDropdown
        label="Filter"
        chip={kind === 'all' ? 0 : 1}
        current={kind === 'all' ? undefined : STICKY_KINDS.find((k) => k.id === kind)?.label}
        title="Show notes, to-dos, or both"
        items={STICKY_KINDS.map((k) => ({ label: k.label, active: kind === k.id, onSelect: () => setKind(k.id) }))}
      />
      <ControlDropdown
        label="Sort"
        title="Manual lets you drag items into any order you like"
        current={notesSort === todoSort ? undefined : 'Mixed'}
        items={(['manual', 'created'] as ListSort[]).map((v) => ({
          label: SORT_LABEL[v], active: notesSort === v && todoSort === v, onSelect: () => setBothSorts(v),
        }))}
      />
      <ControlSearch value={search} onChange={setSearch} placeholder="Search notes & to-dos…" />
    </>
  );
}

