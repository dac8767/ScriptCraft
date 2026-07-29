/**
 * StickyNotes — the ScriptCraft note-card system, two right-dock tools:
 *   - StickyNotesTool ("Notes", v5.36): ONE kind of card — a rich-text note
 *     (the annotation window's field: lists, checklists, links, images).
 *     Derek's Notes v2: the note/checklist distinction is gone ("+ Add
 *     Checklist", the kind tabs and the Type sort went with it; old
 *     checklist cards migrate into notes whose content IS a task list —
 *     shelfMigrate.ts). Sort is Manual (the shelfCards array order, drag
 *     any card anywhere — the default) or Date Created. Popped-out and
 *     fullscreen shapes get a "Notes per row:" stepper over an equal-height
 *     row GRID (the v5.24 masonry is gone; equal rows were the fix for its
 *     odd gaps AND the second-column misalignment).
 *     The tool keeps the id 'sticky' — a persisted identifier.
 *   - FragmentsTool ("Snippets"): text sent from the
 *     editor via ⌥⌘X (cut) / ⌥⌘C (copy) — bound in ScreenplayEditor.
 * v4.33, Derek: both kinds hold ONLY non-script items. Script notes and
 * script [ ] checklists live in the Navigator (which jumps to them); note
 * text is edited in the popover on the highlight itself.
 * Data persists per script as the `_shelf` key of the saved content JSON and
 * syncs in collab via collabSync.
 */
import { useState, useEffect, type CSSProperties } from 'react';
import type { Editor } from '@tiptap/react';
import {
  useEditorStore,
  SHELF_DEFAULT_COLOR,
  type ShelfCard,
} from '../stores/editorStore';
import { StickyCard } from './StickyCard';
import { cardMatchesSearch, STICKY_SORT_LABEL, type StickySort } from './ListControls';
import { ControlDropdown, ControlSearch, ToolActionRow } from './ToolControls';
import { CircleMinusIcon, CirclePlusIcon } from './uiIcons';
import { uuid } from '../utils/uuid';


const NOTE_HINT = 'Notes to self, research links, themes to keep present. Hit + Add Note above.';
const SNIPPET_HINT = 'Select text in the Editor and press ⌥⌘X to cut it here, or ⌥⌘C to copy it over.';

/** Build a snippet card from editor text (used by the capture shortcuts). */
export function makeSnippetCard(text: string): ShelfCard {
  return { id: uuid(), type: 'snippet', text, color: SHELF_DEFAULT_COLOR, createdAt: new Date().toISOString() };
}

function useCardOps() {
  const { shelfCards, setShelfCards } = useEditorStore();
  const update = (id: string, patch: Partial<ShelfCard>) =>
    setShelfCards(shelfCards.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const remove = (id: string) => setShelfCards(shelfCards.filter((c) => c.id !== id));
  const add = () => {
    setShelfCards([...shelfCards, {
      id: uuid(), type: 'comment', color: SHELF_DEFAULT_COLOR, createdAt: new Date().toISOString(), text: '',
    }]);
  };
  return { shelfCards, setShelfCards, update, remove, add };
}

/* ═══════════ Snippets list (drag reorder within the kind) ═══════════ */

function SnippetList() {
  const { shelfCards, setShelfCards, update, remove } = useCardOps();
  const [dragId, setDragId] = useState<string | null>(null);
  const [startArmed, setStartArmed] = useState(false);
  const [endArmed, setEndArmed] = useState(false);

  const visible = shelfCards.filter((c) => c.type === 'snippet');

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
    const firstIdx = arr.findIndex((c) => c.type === 'snippet');
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
      {visible.length === 0 && <div className="swn-hint">{SNIPPET_HINT}</div>}
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
          // DEFERRED: setting dragId re-renders the list (drop zones appear),
          // and WebKit ABORTS a drag whose source DOM mutates during
          // dragstart — Chrome doesn't care, which is why "drag isn't
          // working" survived the v5.24 setData fix. Next tick is safe.
          onDragStart={() => { window.setTimeout(() => setDragId(card.id), 0); }}
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

/* ═══════════ Tool: Notes (Sticky Notes v2, one rich kind) ═══════════ */

interface EditorToolProps {
  editor: Editor | null;
}

/**
 * v5.36: one flat list of rich notes. Sorting:
 *   - 'manual' (default): the shelfCards ARRAY order (the Snippets model) —
 *     drag any card anywhere.
 *   - 'created': newest first.
 * Search runs through cardMatchesSearch (title + the plain-text mirror).
 * The count published is exactly what's rendered.
 */
function NotesList({ perRow = 1 }: { perRow?: number }) {
  const { shelfCards, setShelfCards, update, remove } = useCardOps();
  const sort = useEditorStore((s) => s.stickySort);
  const setSort = useEditorStore((s) => s.setStickySort);
  const search = useEditorStore((s) => s.stickySearch);
  const [dragId, setDragId] = useState<string | null>(null);
  const [startArmed, setStartArmed] = useState(false);
  const [endArmed, setEndArmed] = useState(false);

  const filtered = shelfCards.filter((c) =>
    (c.type === 'comment' || c.type === 'todo') && cardMatchesSearch(c, search));
  const visible = sort === 'created'
    ? [...filtered].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
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

  const emptyHint = search.trim() ? 'Nothing matches the search.' : NOTE_HINT;

  return (
    <div
      className={'swn-scroll' + (perRow > 1 ? ' swn-grid' : '')}
      style={perRow > 1 ? ({ '--sticky-cols': perRow } as CSSProperties) : undefined}
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
          // DEFERRED: setting dragId re-renders the list (drop zones appear),
          // and WebKit ABORTS a drag whose source DOM mutates during
          // dragstart — Chrome doesn't care, which is why "drag isn't
          // working" survived the v5.24 setData fix. Next tick is safe.
          onDragStart={() => { window.setTimeout(() => setDragId(card.id), 0); }}
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

/** v5.36: ONE blue "+ Add Note" (the checklist button is gone — a checklist
 *  is content now, made with the card's own toolbar). Popped-out and
 *  fullscreen shapes keep the right-aligned stepper, back under Derek's
 *  original name: "Notes per row:". Docked panels stay one column. */
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
        <button className="dialog-btn dialog-btn-primary sticky-add-btn" onClick={add}>+ Add Note</button>
        {popped && (
          <span className="tool-action-group tool-action-right">
            <span className="tool-action-label" id="sticky-cols-label">Notes per row:</span>
            <button
              className="tool-action-btn tool-action-icon"
              title="Fewer notes per row (bigger cards)"
              disabled={perRow <= 1}
              onClick={() => setPerRow(perRow - 1)}
            ><CircleMinusIcon /></button>
            <span className="tool-action-count" aria-labelledby="sticky-cols-label">{perRow}</span>
            <button
              className="tool-action-btn tool-action-icon"
              title="More notes per row (smaller cards)"
              disabled={perRow >= 8}
              onClick={() => setPerRow(perRow + 1)}
            ><CirclePlusIcon /></button>
          </span>
        )}
      </ToolActionRow>
      {/* .swn-scroll is the ONE scroller (the Snippets model) — no wrapper,
          or the panel would nest two scrollbars. */}
      <NotesList perRow={popped ? perRow : 1} />
    </div>
  );
}

/* ═══════════ Tool: Snippets ═══════════ */

export function FragmentsTool(_props: EditorToolProps) {
  return (
    <div className="fs-sticky-tool">
      <SnippetList />
    </div>
  );
}

/* ═══════════ Window chrome (v4.32, Derek's window template) ═══════════ */

/** TOOL_CHROME slots for Notes, wired in ToolDock. The "· N" count is what
 *  the list is showing — published by the body, displayed here, never
 *  recomputed. Sort and search live in the store, so the chrome and the
 *  list can't drift. (v5.36: the v5.22 kind TABS are gone with the kinds.) */
export function StickyTitleExtra() {
  const count = useEditorStore((s) => s.toolCounts['sticky'] ?? 0);
  return <span className="tool-title-count">· {count}</span>;
}

/** Snippets' count comes straight off the store list — the body (SnippetList)
 *  shows every snippet card, no filter, so there's nothing to publish. */
export function SnippetsTitleExtra() {
  const count = useEditorStore((s) => s.shelfCards.filter((c) => c.type === 'snippet').length);
  return <span className="tool-title-count">· {count}</span>;
}

/** v5.36: the header cluster is Sort · Search. Manual (the drag order) is
 *  the default; Date Created is the one alternative — Type died with the
 *  kinds. */
export function StickyControls() {
  const sort = useEditorStore((s) => s.stickySort);
  const setSort = useEditorStore((s) => s.setStickySort);
  const search = useEditorStore((s) => s.stickySearch);
  const setSearch = useEditorStore((s) => s.setStickySearch);
  return (
    <>
      <ControlDropdown
        label="Sort"
        title="Manual lets you drag any order; Date Created shows newest first"
        current={sort === 'manual' ? undefined : STICKY_SORT_LABEL[sort]}
        items={(['manual', 'created'] as StickySort[]).map((v) => ({
          label: STICKY_SORT_LABEL[v], active: sort === v, onSelect: () => setSort(v),
        }))}
      />
      <ControlSearch value={search} onChange={setSearch} placeholder="Search notes…" />
    </>
  );
}
