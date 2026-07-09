/**
 * StickyNotes — the unified Sticky Notes pane ("the Shelf"), ported from
 * FreeScript v5.5 and extended to house OpenDraft's note systems.
 *
 * Top-level tabs: Notes / To-Do / Snippets. The Notes tab has two sub-views:
 *   - General: free-form sticky cards (the former Comments tab)
 *   - Script:  OpenDraft's anchored notes (filters, click-to-navigate),
 *              rendered by ScriptNotesContent
 * Every card header shows its type as placeholder text and is editable as a
 * title. The 🔍 search spans everything — all card types plus Script notes;
 * clicking a Script hit jumps to Notes → Script focused on that note.
 *
 * Snippets are created from the editor via ⌥⌘X (cut selection to sticky) and
 * ⌥⌘C (copy selection to sticky) — bound in ScreenplayEditor.
 *
 * Sticky cards persist per script as the `_shelf` top-level key of the saved
 * content JSON, and sync in collab via collabSync. The active tab and Notes
 * sub-view persist in view state (`shelfTab`, `notesSubTab`).
 */
import React, { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { useDelayedUnmount, useSwipeDismiss } from '../hooks/useTouch';
import {
  useEditorStore,
  SHELF_COLORS,
  SHELF_DEFAULT_COLOR,
  NOTE_COLORS,
  type ShelfCard,
  type ShelfCardType,
  type ShelfTopTab,
  type NotesSubTab,
  type NoteColor,
} from '../stores/editorStore';
import { ScriptNotesContent } from './ScriptNotes';
import { uuid } from '../utils/uuid';

const TABS: [ShelfTopTab, string][] = [
  ['notes', 'Notes'],
  ['todo', 'To-Do'],
  ['snippet', 'Snippets'],
];

const SUB_TABS: [NotesSubTab, string][] = [
  ['general', 'General'],
  ['script', 'Script'],
];

/** The card type each top-level tab shows (Notes → General shows 'comment' cards). */
const TAB_CARD_TYPE: Record<ShelfTopTab, ShelfCardType> = {
  notes: 'comment',
  todo: 'todo',
  snippet: 'snippet',
};

/** Placeholder header text per card type — shown until the user types a title. */
const CARD_PLACEHOLDERS: Record<ShelfCardType, string> = {
  comment: '💬 Note',
  todo: '✓ To-Do',
  snippet: '📄 Snippet',
};

const EMPTY_HINTS: Record<ShelfCardType, string> = {
  comment: 'Notes to self, research links, themes to keep present. Hit + Add below.',
  todo: 'Running checklists that stay out of the Navigator. Hit + Add below.',
  snippet: 'Select text in the Editor and press ⌥⌘X to cut it here, or ⌥⌘C to copy it over.',
};

/** Build a snippet card from editor text (used by the capture shortcuts). */
export function makeSnippetCard(text: string): ShelfCard {
  return { id: uuid(), type: 'snippet', text, color: SHELF_DEFAULT_COLOR };
}

const cardText = (c: ShelfCard): string => {
  const body = c.type === 'todo' ? (c.items || []).map((i) => i.text).join('\n') : c.text || '';
  return c.title ? `${c.title}\n${body}` : body;
};

const noteColorHex = (name: NoteColor): string => {
  const c = NOTE_COLORS.find((nc) => nc.name === name);
  return c ? c.hex : NOTE_COLORS[0].hex;
};

interface StickyNotesProps {
  editor: Editor | null;
  style?: React.CSSProperties;
}

export default function StickyNotes({ editor, style }: StickyNotesProps) {
  const {
    shelfOpen, toggleShelf, shelfCards, setShelfCards,
    shelfTab: tab, setShelfTab,
    notesSubTab, setNotesSubTab,
    notes, noteFilter, setNoteFilter,
  } = useEditorStore();
  const cards = shelfCards;

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [startArmed, setStartArmed] = useState(false);
  const [endArmed, setEndArmed] = useState(false);

  const { shouldRender, animationState } = useDelayedUnmount(shelfOpen, 250);
  const panelRef = useRef<HTMLDivElement>(null);
  useSwipeDismiss(panelRef, { direction: 'right', onDismiss: toggleShelf, enabled: shouldRender });

  // When something external (context menu, toolbar, ⌥-click on a highlight)
  // filters to a script note, land on Notes → Script.
  useEffect(() => {
    if (noteFilter.noteId || noteFilter.elementType || noteFilter.contextLabel || noteFilter.color) {
      setShelfTab('notes');
      setNotesSubTab('script');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteFilter]);

  if (!shouldRender) return null;

  const panelClass = animationState === 'entered'
    ? 'panel-open' : animationState === 'exiting' ? 'panel-closing' : '';

  const q = query.trim().toLowerCase();
  const searching = searchOpen && q.length > 0;
  const cardType = TAB_CARD_TYPE[tab];
  const showingCards = tab !== 'notes' || notesSubTab === 'general';

  // search spans everything; otherwise the active tab decides what renders
  const stickyMatches = searching
    ? cards.filter((c) => cardText(c).toLowerCase().includes(q))
    : showingCards ? cards.filter((c) => c.type === cardType) : [];
  const scriptMatches = searching
    ? notes.filter((n) =>
        `${n.content}\n${n.anchorText || ''}\n${n.contextLabel || ''}`.toLowerCase().includes(q))
    : [];
  const totalMatches = stickyMatches.length + scriptMatches.length;

  const closeSearch = () => { setQuery(''); setSearchOpen(false); };

  const jumpToScript = (noteId: string) => {
    closeSearch();
    setNoteFilter({ elementType: null, contextLabel: null, color: null, noteId });
    setShelfTab('notes');
    setNotesSubTab('script');
  };

  const update = (id: string, patch: Partial<ShelfCard>) =>
    setShelfCards(cards.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const remove = (id: string) => setShelfCards(cards.filter((c) => c.id !== id));
  const add = () => {
    const base: ShelfCard = { id: uuid(), type: cardType, color: SHELF_DEFAULT_COLOR };
    if (cardType === 'comment') base.text = '';
    if (cardType === 'todo') base.items = [];
    setShelfCards([...cards, base]);
  };

  const dropOn = (targetId: string) => {
    if (!dragId || dragId === targetId) { setDragId(null); return; }
    const arr = [...cards];
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
    const arr = [...cards];
    const from = arr.findIndex((c) => c.id === dragId);
    if (from === -1) { setDragId(null); return; }
    const [moved] = arr.splice(from, 1);
    const firstIdx = arr.findIndex((c) => c.type === cardType);
    arr.splice(firstIdx === -1 ? arr.length : firstIdx, 0, moved);
    setShelfCards(arr);
    setDragId(null);
    setStartArmed(false);
  };
  const dropAtEnd = () => {
    if (!dragId) return;
    const arr = [...cards];
    const from = arr.findIndex((c) => c.id === dragId);
    if (from === -1) { setDragId(null); return; }
    const [moved] = arr.splice(from, 1);
    arr.push(moved);
    setShelfCards(arr);
    setDragId(null);
    setEndArmed(false);
  };

  const tabCount = (key: ShelfTopTab): number => {
    const cardCount = cards.filter((c) => c.type === TAB_CARD_TYPE[key]).length;
    return key === 'notes' ? cardCount + notes.length : cardCount;
  };

  const showAddRow = !searching && (tab === 'todo' || (tab === 'notes' && notesSubTab === 'general'));

  return (
    <div ref={panelRef} className={`script-notes-panel sticky-notes-panel ${panelClass}`} style={style}>
      <div className="script-notes-header">
        <span className="script-notes-title">Sticky Notes</span>
        <button
          className="swn-search-btn"
          title={searchOpen ? 'Close search' : 'Search all sticky notes'}
          onClick={() => { if (searchOpen) setQuery(''); setSearchOpen((o) => !o); }}
        >{searchOpen ? '✕' : '🔍'}</button>
        <button className="script-notes-close" onClick={toggleShelf} title="Close">
          &times;
        </button>
      </div>

      {searchOpen && (
        <div className="swn-search-row">
          <input
            autoFocus
            value={query}
            placeholder="Search all tabs…"
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}

      {!searching && (
        <div className="swn-tabs">
          {TABS.map(([key, label]) => {
            const count = tabCount(key);
            return (
              <button key={key} className={'swn-tab' + (tab === key ? ' active' : '')} onClick={() => setShelfTab(key)}>
                {label}{count > 0 ? ` (${count})` : ''}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Notes tab: General / Script sub-switcher ── */}
      {!searching && tab === 'notes' && (
        <div className="swn-subtabs">
          {SUB_TABS.map(([key, label]) => {
            const count = key === 'general'
              ? cards.filter((c) => c.type === 'comment').length
              : notes.length;
            return (
              <button
                key={key}
                className={'swn-subtab' + (notesSubTab === key ? ' active' : '')}
                onClick={() => setNotesSubTab(key)}
              >
                {label}{count > 0 ? ` (${count})` : ''}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Search results: everything at once ── */}
      {searching && (
        <div className="swn-scroll">
          <div className="swn-hint">
            {totalMatches === 0
              ? 'No sticky notes match.'
              : `${totalMatches} match${totalMatches === 1 ? '' : 'es'} across all tabs`}
          </div>
          {stickyMatches.map((card) => (
            <StickyCard
              key={card.id}
              card={card}
              dragging={false}
              onDragStart={() => {}}
              onDragEnd={() => {}}
              onDropHere={() => {}}
              onUpdate={(p) => update(card.id, p)}
              onRemove={() => remove(card.id)}
            />
          ))}
          {scriptMatches.length > 0 && <div className="swn-group-label">Script Notes</div>}
          {scriptMatches.map((n) => (
            <div
              key={n.id}
              className="swn-note-hit"
              style={{ borderLeftColor: noteColorHex(n.color) }}
              onClick={() => jumpToScript(n.id)}
              title="Open in Notes → Script"
            >
              {n.anchorText && <div className="swn-note-hit-title">&ldquo;{n.anchorText}&rdquo;</div>}
              <div className="swn-note-hit-snippet">{n.content.slice(0, 140) || 'No note text yet'}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Card lists (Notes → General, To-Do, Snippets) ── */}
      {!searching && showingCards && (
        <div className="swn-scroll">
          {stickyMatches.length === 0 && (
            <div className="swn-hint">{EMPTY_HINTS[cardType]}</div>
          )}
          {dragId && stickyMatches.length > 0 && (
            <div
              className={'swn-drop-zone' + (startArmed ? ' armed' : '')}
              onDragOver={(e) => { e.preventDefault(); setStartArmed(true); }}
              onDragLeave={() => setStartArmed(false)}
              onDrop={dropAtStart}
            />
          )}
          {stickyMatches.map((card) => (
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
          {dragId && stickyMatches.length > 0 && (
            <div
              className={'swn-drop-zone' + (endArmed ? ' armed' : '')}
              onDragOver={(e) => { e.preventDefault(); setEndArmed(true); }}
              onDragLeave={() => setEndArmed(false)}
              onDrop={dropAtEnd}
            />
          )}
        </div>
      )}

      {/* ── Notes → Script: OpenDraft's anchored notes ── */}
      {!searching && tab === 'notes' && notesSubTab === 'script' && (
        <ScriptNotesContent editor={editor} />
      )}

      {showAddRow && (
        <div className="swn-add-row">
          <button className="swn-add-btn" onClick={add}>+ Add</button>
        </div>
      )}
    </div>
  );
}

function ColorDots({ card, onUpdate }: { card: ShelfCard; onUpdate: (p: Partial<ShelfCard>) => void }) {
  const [open, setOpen] = useState(false);
  const cur = card.color || SHELF_DEFAULT_COLOR;
  // when open, the trigger dot joins the row: the current color sits rightmost,
  // exactly where the single circle was, and the rest fan out to the LEFT so
  // the row always stays inside the pane
  const ordered = [...SHELF_COLORS.filter(([c]) => c !== cur), ...SHELF_COLORS.filter(([c]) => c === cur)];
  return (
    <span
      className="swn-color-pick"
      onClick={(e) => e.stopPropagation()}
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
    >
      <span
        className="swn-dot"
        style={{ background: cur, visibility: open ? 'hidden' : 'visible' }}
        title="Sticky color"
        onClick={() => setOpen(true)}
      />
      {open && (
        <span className="swn-color-pop" onMouseLeave={() => setOpen(false)}>
          {ordered.map(([c, name]) => (
            <span
              key={c}
              className="swn-dot"
              title={name}
              style={{ background: c, outline: c === cur ? '2px solid #666' : 'none' }}
              onClick={() => { onUpdate({ color: c }); setOpen(false); }}
            />
          ))}
        </span>
      )}
    </span>
  );
}

interface StickyCardProps {
  card: ShelfCard;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDropHere: () => void;
  onUpdate: (p: Partial<ShelfCard>) => void;
  onRemove: () => void;
}

function StickyCard({ card, dragging, onDragStart, onDragEnd, onDropHere, onUpdate, onRemove }: StickyCardProps) {
  // Header: ⠿ grip drags; the type name is placeholder text in an editable title
  const head = (extra?: React.ReactNode) => (
    <h5 className="swn-card-head">
      <span
        className="swn-drag-grip"
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        title="Drag to reorder"
      >⠿</span>
      <input
        className="swn-card-title"
        value={card.title || ''}
        placeholder={CARD_PLACEHOLDERS[card.type]}
        onChange={(e) => onUpdate({ title: e.target.value })}
      />
      <span className="swn-card-actions">
        <ColorDots card={card} onUpdate={onUpdate} />
        {extra}
        <button className="swn-x" title="Delete" onClick={onRemove}>✕</button>
      </span>
    </h5>
  );

  const wrap = (children: React.ReactNode) => (
    <div
      className={'swn-card' + (dragging ? ' dragging' : '')}
      style={{ background: card.color || SHELF_DEFAULT_COLOR }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDropHere}
    >
      {children}
    </div>
  );

  if (card.type === 'comment') {
    return wrap(<>
      {head()}
      <textarea
        className="swn-comment-input"
        value={card.text || ''}
        placeholder="Research links, themes to keep present, notes to self…"
        onChange={(e) => onUpdate({ text: e.target.value })}
      />
    </>);
  }

  if (card.type === 'todo') {
    const items = card.items || [];
    return wrap(<>
      {head((
        <button
          className="swn-x"
          title="Clear completed"
          onClick={() => onUpdate({ items: items.filter((i) => !i.done) })}
        >⌫</button>
      ))}
      {items.map((it, i) => (
        <label key={i} className="swn-todo-item">
          <input
            type="checkbox"
            checked={it.done}
            onChange={() =>
              onUpdate({ items: items.map((x, j) => (j === i ? { ...x, done: !x.done } : x)) })}
          />
          <span style={{ textDecoration: it.done ? 'line-through' : 'none', color: it.done ? '#8a8a7a' : '#333' }}>
            {it.text}
          </span>
        </label>
      ))}
      <input
        className="swn-todo-new"
        placeholder="New to-do…"
        onKeyDown={(e) => {
          const el = e.target as HTMLInputElement;
          if (e.key === 'Enter' && el.value.trim()) {
            onUpdate({ items: [...items, { text: el.value.trim(), done: false }] });
            el.value = '';
          }
        }}
      />
    </>);
  }

  if (card.type === 'snippet') {
    return wrap(<>
      {head((
        <button
          className="swn-x"
          title="Copy to clipboard"
          onClick={() => { if (navigator.clipboard) navigator.clipboard.writeText(card.text || ''); }}
        >⧉</button>
      ))}
      <div className="swn-snippet">{card.text}</div>
    </>);
  }
  return null;
}
