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
import React, { useRef, useState } from 'react';
import { FaCopy, FaRegTrashAlt } from 'react-icons/fa';
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

// v1.2: the title is an editable field, and "Note" / "To-Do" read like a label
// for the card rather than an invitation to type. The ellipsis says "your turn".
export const CARD_PLACEHOLDERS: Record<ShelfCardType, string> = {
  comment: 'Note Title...',
  todo: '✓ List Title...',
  snippet: 'Snippet',
};

export function ColorDots({ card, onUpdate }: { card: ShelfCard; onUpdate: (p: Partial<ShelfCard>) => void }) {
  const [open, setOpen] = useState(false);
  // v4.35 (batch-v9 #5): while the NATIVE color panel is up the pointer is off
  // the row — the pop must not close under it, or the <input> unmounts and
  // every pick lands in the void. Blur (next click anywhere) closes instead.
  const picking = useRef(false);
  const cur = card.color || SHELF_DEFAULT_COLOR;
  const isPreset = SHELF_COLORS.some(([c]) => c === cur);
  // the pop is right-anchored, so the row fans out to the LEFT of the trigger
  // and always stays inside the pane; the current preset keeps the slot next
  // to the custom swatch, nearest where the single circle was
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
        <span className="swn-color-pop" onMouseLeave={() => { if (!picking.current) setOpen(false); }}>
          {ordered.map(([c, name]) => (
            <span
              key={c}
              className="swn-dot"
              title={name}
              style={{ background: c, outline: c === cur ? '2px solid #666' : 'none' }}
              onClick={() => { onUpdate({ color: c }); setOpen(false); }}
            />
          ))}
          {/* Custom color — the Characters-row dashed swatch, dot-sized. When
              the current color is a custom hex it shows here as the fill. */}
          <label
            className="swn-color-custom"
            title="Custom color"
            style={isPreset ? undefined : { background: cur, outline: '2px solid #666' }}
          >
            <input
              type="color"
              value={cur}
              onFocus={() => { picking.current = true; }}
              onBlur={() => { picking.current = false; setOpen(false); }}
              onChange={(e) => onUpdate({ color: e.target.value })}
            />
            {isPreset && <span>+</span>}
          </label>
        </span>
      )}
    </span>
  );
}

interface StickyCardProps {
  card: ShelfCard;
  dragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDropHere: () => void;
  onUpdate: (p: Partial<ShelfCard>) => void;
  onRemove: () => void;
  /** Replace the card's body while keeping the identical shell. */
  children?: React.ReactNode;
}

// v4.33: the `anchor` foot ("Linked to Scene 14" / "General") is gone — every
// card in these windows is general now, so there was nothing left to
// distinguish. Script notes/to-dos live in the Navigator instead.
export function StickyCard({ card, dragging, onDragStart, onDragEnd, onDropHere, onUpdate, onRemove, children }: StickyCardProps) {
  // Header: ⋮⋮ grip drags; the type name is placeholder text in an editable title
  const head = (extra?: React.ReactNode) => (
    <h5 className="swn-card-head">
      <span
        className="swn-drag-grip"
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        title="Drag to reorder"
      >⋮⋮</span>
      <input
        className="swn-card-title"
        value={card.title || ''}
        placeholder={CARD_PLACEHOLDERS[card.type]}
        onChange={(e) => onUpdate({ title: e.target.value })}
      />
      <span className="swn-card-actions">
        <ColorDots card={card} onUpdate={onUpdate} />
        {extra}
        <button className="swn-x" title="Delete" onClick={onRemove}><FaRegTrashAlt /></button>
      </span>
    </h5>
  );

  const wrap = (inner: React.ReactNode) => (
    <div
      className={'swn-card' + (dragging ? ' dragging' : '')}
      style={{ background: card.color || SHELF_DEFAULT_COLOR }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDropHere}
    >
      {inner}
      {/* v1.2: the foot of the card is ONE row, date on the right. */}
      <div className="swn-card-foot">
        <span />
        {card.createdAt && <span className="swn-card-date">{formatDate(card.createdAt)}</span>}
      </div>
    </div>
  );

  // A caller can supply the body while keeping the identical shell — this is how
  // a script note gets the same card as a window note without losing its own
  // editor (asset autocomplete, media).
  if (children) return wrap(<>{head()}{children}</>);

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
        ><FaCopy /></button>
      ))}
      <div className="swn-snippet">{card.text}</div>
    </>);
  }
  return null;
}
