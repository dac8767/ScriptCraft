/**
 * StickyNotes — the ScriptCraft sticky-card system, now split into three
 * right-dock tools:
 *   - StickyNotesTool ("Notes"): general note cards.
 *   - FragmentsTool ("Snippets"): text sent from the
 *     editor via ⌥⌘X (cut) / ⌥⌘C (copy) — bound in ScreenplayEditor.
 *   - TodoTool ("To-Do"): general to-do list cards.
 * v4.33, Derek: both Notes and To-Do hold ONLY non-script items now. Script
 * notes and script [ ] to-do lists live in the Navigator (which jumps to
 * them); note text is edited in the popover on the highlight itself.
 * Cards keep sticky colors, drag-reorder, editable title headers (type name
 * as placeholder), and creation dates. Data persists per script as the
 * `_shelf` key of the saved content JSON and syncs in collab via collabSync.
 * v4.32 batch-v8 #12: Notes and To-Do wear the window template — the "· N"
 * count and the Sort dropdown live in the chrome (the slots at the
 * bottom of this file), not in the list bodies.
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
  arrangeEntries, reorderKeys, entryDragProps, SORT_LABEL,
  type ListEntry, type ListSort,
} from './ListControls';
import { ControlDropdown } from './ToolControls';
import { uuid } from '../utils/uuid';


const EMPTY_HINTS: Record<ShelfCardType, string> = {
  comment: 'Notes to self, research links, themes to keep present. Hit + Add below.',
  todo: 'To-do lists for anything outside the script. Hit + Add below.',
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

/* ═══════════ Tool: Notes ═══════════ */

interface EditorToolProps {
  editor: Editor | null;
}

/**
 * v0.93 — ONE list, no sub-types (same move as To-Do in v0.92).
 *
 * General vs Script was a filing system you had to understand before you could
 * find a note. What actually distinguishes them isn't a type, it's whether the
 * note is LINKED to something in the script — so both now sit in one list, and
 * the link is shown on the note itself: a script note carries the scene or
 * character it's anchored to (and the text it's attached to), while a standalone
 * note shows nothing there. Blank is the signal.
 */
export function StickyNotesTool(_props: EditorToolProps) {
  const { add } = useCardOps();
  return (
    <div className="fs-sticky-tool">
      {/* v4.33: general note cards only — script notes live in the Navigator
          and edit on their highlight. Sort sits in the window chrome. */}
      <div className="fs-notes-list">
        <ScriptNotesContent />
      </div>
      <div className="swn-add-row">
        <button className="swn-add-btn" onClick={() => add('comment')}>+ Add</button>
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

/* ═══════════ Tool: To-Do ═══════════ */

/**
 * v4.33, Derek — general to-do cards ONLY. Script [ ] lists left this window:
 * they live in the script itself (edit them there) and in the Navigator
 * (tick them there, click to jump). No Location column, no filter — nothing
 * here has a script location any more.
 */
export function TodoTool(_props: EditorToolProps) {
  const { add } = useCardOps();
  const { shelfCards, setShelfCards, todoOrder, setTodoOrder } = useEditorStore();
  // v4.32 batch-v8 #12: sort lives in the STORE (todoSort) so the window
  // chrome's row-2 cluster (TodoControls) drives it — the in-body bar is
  // gone. A drag still snaps Sort back to Manual.
  const sort = useEditorStore((s) => s.todoSort);
  const setSort = useEditorStore((s) => s.setTodoSort);
  const [dragKey, setDragKey] = useState<string | null>(null);

  const entries: ListEntry[] = shelfCards.filter((c) => c.type === 'todo').map((card) => ({
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
  // title (TodoTitleExtra) displays the same number — displayed there,
  // never recomputed (charListCount's no-drift rule).
  useEffect(() => {
    useEditorStore.getState().setToolCount('todo', visible.length);
  }, [visible.length]);

  return (
    <div className="fs-sticky-tool">
      <div className="fs-todo-list">
        {visible.length === 0 ? (
          <div className="fs-nav-empty fs-todo-hint">
            Add a to-do below. (To-do lists IN the script live in the
            Navigator — use Insert → To-Do List to add one there.)
          </div>
        ) : (
          visible.map((e) => <React.Fragment key={e.key}>{e.render()}</React.Fragment>)
        )}
      </div>
      <div className="swn-add-row">
        <button className="swn-add-btn" onClick={() => add('todo')}>+ Add</button>
      </div>
    </div>
  );
}

/* ═══════════ Window chrome (v4.32, Derek's window template) ═══════════ */

/** TOOL_CHROME slots for Notes and To-Do, wired in ToolDock: the "· N" count
 *  beside the centered row-1 title, and the row-2 Filter / Sort cluster.
 *  Counts are published by the list bodies (setToolCount) — displayed here,
 *  never recomputed — and filter/sort live in the store, so the chrome and
 *  the lists can't drift. */
export function StickyTitleExtra() {
  const count = useEditorStore((s) => s.toolCounts['sticky'] ?? 0);
  return <span className="tool-title-count">· {count}</span>;
}

export function TodoTitleExtra() {
  const count = useEditorStore((s) => s.toolCounts['todo'] ?? 0);
  return <span className="tool-title-count">· {count}</span>;
}

/** Snippets' count comes straight off the store list — the body (CardList)
 *  shows every snippet card, no filter, so there's nothing to publish. */
export function SnippetsTitleExtra() {
  const count = useEditorStore((s) => s.shelfCards.filter((c) => c.type === 'snippet').length);
  return <span className="tool-title-count">· {count}</span>;
}

/** The cluster both windows share, differing only in which store pair it
 *  drives. v4.33: Sort only — the General/In-Script filter died when script
 *  items left these windows. Option labels come from ListControls' map so
 *  the two windows can't drift apart. */
function ListChromeControls({ sort, setSort }: {
  sort: ListSort; setSort: (s: ListSort) => void;
}) {
  return (
    <ControlDropdown
      label="Sort"
      title="Manual lets you drag items into any order you like"
      items={(['manual', 'created'] as ListSort[]).map((v) => ({
        label: SORT_LABEL[v], active: sort === v, onSelect: () => setSort(v),
      }))}
    />
  );
}

export function StickyControls() {
  const sort = useEditorStore((s) => s.notesSort);
  const setSort = useEditorStore((s) => s.setNotesSort);
  return <ListChromeControls sort={sort} setSort={setSort} />;
}

export function TodoControls() {
  const sort = useEditorStore((s) => s.todoSort);
  const setSort = useEditorStore((s) => s.setTodoSort);
  return <ListChromeControls sort={sort} setSort={setSort} />;
}

