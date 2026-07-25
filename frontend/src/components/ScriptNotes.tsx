/**
 * ScriptNotes — ScriptNotesContent: the Notes window's list body.
 *
 * v4.33, Derek: general (non-script) notes ONLY. Script-anchored notes left
 * this window — they are listed in the Navigator (which jumps to them) and
 * edited in the popover on their highlight (ScriptNotePopover.tsx). The
 * media/@asset rendering helpers stay here and are exported for the popover,
 * so both surfaces render note content identically.
 */
import React, { useState, useEffect } from 'react';
import {
  useEditorStore,
  NOTE_COLORS,
  type NoteColor,
  type ShelfCard,
  SHELF_COLORS,
} from '../stores/editorStore';
import { StickyCard, formatDate } from './StickyCard';
export { formatDate };
import {
  arrangeEntries, reorderKeys, entryDragProps,
  type ListEntry,
} from './ListControls';
import { type Asset } from '../stores/assetStore';
import { api } from '../services/api';
import { isTauri } from '../services/platform';
/* v3.12: the URL opener moved to services/external.ts — one copy, shared
   with the Help menu's donate link and the titlebar button. */
import { openInBrowser } from '../services/external';


/**
 * v0.96 — the card's colour dots speak SHELF_COLORS (pastel card backgrounds);
 * a note stores a NoteColor name. Both palettes are the same six colours in the
 * same order, so they bridge by LABEL — not by comparing hexes, which would
 * silently pick the wrong one the day either palette is retuned.
 * v4.35 (batch-v9 #5): a note may instead carry an arbitrary '#rrggbb' from the
 * custom picker — persisted, so every bridge must pass a hex through untouched.
 */
export const shelfHexForNote = (color: NoteColor | string): string => {
  if (color.startsWith('#')) return color;
  const i = NOTE_COLORS.findIndex((c) => c.name === color);
  return SHELF_COLORS[i >= 0 ? i : 0][0];
};
export const noteColorForShelfHex = (hex: string): NoteColor | string => {
  const i = SHELF_COLORS.findIndex(([h]) => h === hex);
  // Unknown hex = a custom pick: keep it verbatim. Yellow was only ever the
  // fallback for the fixed palette, never a snap target.
  return i >= 0 ? NOTE_COLORS[i].name : hex;
};

/** Resolve a note color (name or '#rrggbb') to its full-strength hex. */
export const getNoteColorHex = (color: NoteColor | string): string => {
  if (color.startsWith('#')) return color;
  const c = NOTE_COLORS.find((nc) => nc.name === color);
  return c ? c.hex : NOTE_COLORS[0].hex;
};

/** Sticky-card pastel backgrounds per note color (matches SHELF_COLORS). */
export const NOTE_STICKY_BG: Record<NoteColor, string> = {
  Yellow: '#fff9c4', Red: '#ffd9e7', Blue: '#d6ecff',
  Green: '#dcf5dc', Orange: '#ffe4c4', Purple: '#e9defa',
};

/** Sticky background for ANY note color. Names keep the exact NOTE_STICKY_BG
 *  values (saved scripts must not shift); a custom hex gets a pastel of the
 *  same weight computed per channel — blended 78% toward white, emitted as a
 *  plain '#rrggbb' so it works in inline styles with no color-mix(). */
export const noteStickyBg = (color: NoteColor | string): string => {
  if (!color.startsWith('#')) return NOTE_STICKY_BG[color as NoteColor] || NOTE_STICKY_BG.Yellow;
  const n = parseInt(color.slice(1, 7), 16);
  const tint = (c: number) => Math.round(c + (255 - c) * 0.78);
  const r = tint((n >> 16) & 255);
  const g = tint((n >> 8) & 255);
  const b = tint(n & 255);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
};

/** Check if a string looks like an image URL */
const isImageUrl = (url: string) =>
  /\.(png|jpe?g|gif|webp|svg|bmp|ico)(\?.*)?$/i.test(url);

/** Check if a string looks like a video URL */
const isVideoUrl = (url: string) =>
  /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url) ||
  /youtube\.com\/watch|youtu\.be\/|vimeo\.com\//i.test(url);

/** Convert YouTube/Vimeo URL to embeddable URL */
const toEmbedUrl = (url: string): string | null => {
  // YouTube
  let m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (m) return `https://www.youtube-nocookie.com/embed/${m[1]}`;
  // Vimeo
  m = url.match(/vimeo\.com\/(\d+)/);
  if (m) return `https://player.vimeo.com/video/${m[1]}`;
  return null;
};


/** Does the note contain anything the plain text box can't show — a media URL,
 *  a link, or an @asset reference? Only then is the rendered block worth adding
 *  below it. */
export const hasRichContent = (text: string) =>
  /@\S+/.test(text) || /https?:\/\//i.test(text);

/**
 * Render note content with media embeds and @asset references.
 * - URLs on their own line that look like images render as <img>
 * - URLs that look like videos render as <video> or iframe embed
 * - @AssetName references render as clickable asset links
 */
export const NoteContentDisplay: React.FC<{
  content: string;
  assets: Asset[];
  projectId: string | null;
}> = ({ content, assets, projectId }) => {
  if (!content) return null;

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Image URL on its own line
    if (isImageUrl(line) && /^https?:\/\//.test(line)) {
      elements.push(
        <div key={i} className="note-media-embed">
          <img src={line} alt="" loading="lazy" />
        </div>,
      );
      continue;
    }

    // Video URL on its own line
    if (isVideoUrl(line) && /^https?:\/\//.test(line)) {
      const embedUrl = toEmbedUrl(line);
      if (embedUrl) {
        if (isTauri()) {
          // In Tauri, YouTube/Vimeo iframes don't work (origin restriction).
          // Show as a clickable link that opens in the default browser.
          elements.push(
            <div key={i} className="note-media-embed note-media-video">
              <a
                href={line}
                target="_blank"
                rel="noreferrer"
                className="note-video-link"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); openInBrowser(line); }}
              >
                {line}
              </a>
            </div>,
          );
        } else {
          elements.push(
            <div key={i} className="note-media-embed note-media-video">
              <iframe src={embedUrl} allowFullScreen title="video" />
            </div>,
          );
        }
      } else {
        elements.push(
          <div key={i} className="note-media-embed">
            <video src={line} controls preload="metadata" />
          </div>,
        );
      }
      continue;
    }

    // Parse @asset references inline
    const parts = line.split(/(@\S+)/g);
    const lineElements: React.ReactNode[] = [];
    for (let j = 0; j < parts.length; j++) {
      const part = parts[j];
      if (part.startsWith('@')) {
        const assetName = part.slice(1);
        const asset = assets.find(
          (a) => a.original_name.toLowerCase() === assetName.toLowerCase() ||
                 a.original_name.replace(/\s+/g, '_').toLowerCase() === assetName.toLowerCase(),
        );
        if (asset) {
          const isImg = asset.mime_type.startsWith('image/');
          const url = projectId
            ? api.getAssetUrl(projectId, asset.id)
            : '#';
          if (isImg) {
            lineElements.push(
              <span key={j} className="note-asset-ref">
                <img src={url} alt={asset.original_name} className="note-asset-thumb" loading="lazy" />
                <span className="note-asset-name">{part}</span>
              </span>,
            );
          } else {
            lineElements.push(
              <a key={j} className="note-asset-ref note-asset-link" href={url} target="_blank" rel="noreferrer">
                {part}
              </a>,
            );
          }
        } else {
          lineElements.push(
            <span key={j} className="note-asset-ref note-asset-unresolved">{part}</span>,
          );
        }
      } else {
        // Detect URLs in plain text and render as clickable links
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const textParts = part.split(urlRegex);
        for (let k = 0; k < textParts.length; k++) {
          const tp = textParts[k];
          if (urlRegex.test(tp)) {
            const handleClick = (e: React.MouseEvent) => {
              e.stopPropagation();
              e.preventDefault();
              openInBrowser(tp);
            };
            lineElements.push(
              <a key={`${j}-${k}`} href={tp} target="_blank" rel="noreferrer" className="note-inline-link" onClick={handleClick}>
                {tp}
              </a>,
            );
          } else if (tp) {
            lineElements.push(<span key={`${j}-${k}`}>{tp}</span>);
          }
          // Reset regex lastIndex since we reuse it
          urlRegex.lastIndex = 0;
        }
      }
    }

    elements.push(
      <div key={i} className="note-content-line">
        {lineElements}
      </div>,
    );
  }

  return <div className="note-content-rendered">{elements}</div>;
};

/**
 * The Notes window's list: general note cards, sorted by the window chrome's
 * Sort control (manual drag order or date created).
 */
export const ScriptNotesContent: React.FC = () => {
  const { shelfCards, setShelfCards, noteOrder, setNoteOrder } = useEditorStore();
  const sort = useEditorStore((s) => s.notesSort);
  const setSort = useEditorStore((s) => s.setNotesSort);
  const [dragKey, setDragKey] = useState<string | null>(null);

  const onDropKey = (from: string, to: string) => {
    setSort('manual');
    setNoteOrder(reorderKeys(noteOrder, allKeys, from, to));
  };

  const renderGeneralNote = (card: ShelfCard) => {
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
  };

  const entries: ListEntry[] = shelfCards
    .filter((c) => c.type === 'comment')
    .map((card) => ({
      key: `card:${card.id}`,
      createdAt: card.createdAt,
      render: () => renderGeneralNote(card),
    }));
  const allKeys = entries.map((e) => e.key);
  const visible = arrangeEntries(entries, sort, noteOrder);

  // v4.32: publish the count this list is showing so the window chrome's
  // title (StickyTitleExtra) displays the same number — displayed there,
  // never recomputed (charListCount's no-drift rule).
  useEffect(() => {
    useEditorStore.getState().setToolCount('sticky', visible.length);
  }, [visible.length]);

  return (
    <div className="script-notes-list">
      {visible.length === 0 ? (
        <div className="script-notes-empty">
          No notes yet. Add one below.
        </div>
      ) : (
        visible.map((e) => <React.Fragment key={e.key}>{e.render()}</React.Fragment>)
      )}
    </div>
  );
};
