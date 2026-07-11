/**
 * StickyCard (v0.96) — THE card. One component for every card in Notes and To-Do,
 * whether the thing was made in the window or in the script.
 *
 * It used to live inside StickyNotes, so anything outside that file could only
 * imitate it — which is exactly how script to-dos and script notes ended up as
 * second-class lookalikes with a different shape. Extracted here so there is one
 * card and both callers render it instead of reproducing it.
 *
 * It also breaks an import cycle: ScriptNotes needs the card, and StickyNotes
 * needs ScriptNotes. formatDate lives here now, so nothing imports backwards.
 */
import React, { useState } from 'react';
import type { ShelfCard, ShelfCardType } from '../stores/editorStore';
import { SHELF_COLORS, SHELF_DEFAULT_COLOR } from '../stores/editorStore';

/** Shared date formatter for card headers. */
export const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const CARD_PLACEHOLDERS: Record<ShelfCardType, string> = {
  comment: '💬 Note',
  todo: '✓ To-Do',
  snippet: '📄 Snippet',
};

export function ColorDots({ card, onUpdate }: { card: ShelfCard; onUpdate: (p: Partial<ShelfCard>) => void }) {
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
  /**
   * v0.96: a card anchored in the script. EXACTLY the same card — same title,
   * same colours, same items, same delete — with one honest difference: it can't
   * be dragged into an arbitrary order (it follows the script), so the grip's
   * slot holds a link to it instead.
   */
  link?: { label: string; onClick: () => void };
}

export function StickyCard({ card, dragging, onDragStart, onDragEnd, onDropHere, onUpdate, onRemove, link }: StickyCardProps) {
  // Header: ⠿ grip drags; the type name is placeholder text in an editable title
  const head = (extra?: React.ReactNode) => (
    <h5 className="swn-card-head">
      {link ? (
        <button
          className="swn-card-jump"
          title={`Go to this in the script — ${link.label}`}
          onClick={link.onClick}
        >↗</button>
      ) : (
      <span
        className="swn-drag-grip"
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        title="Drag to reorder"
      >⠿</span>
      )}
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
      {link && (
        <button className="fs-script-link" onClick={link.onClick}>{link.label}</button>
      )}
      {card.createdAt && <div className="swn-card-date">{formatDate(card.createdAt)}</div>}
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
