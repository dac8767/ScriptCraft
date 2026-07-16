import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  closestCenter,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
} from '@dnd-kit/core';
import type {
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  CollisionDetection,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FaRegCircle, FaDotCircle } from 'react-icons/fa';
import { useEditorStore, type BeatInfo, type BeatLinkPreview } from '../stores/editorStore';
import { useOutlinePresetStore } from '../stores/outlinePresetStore';
import { confirmDialog, promptDialog } from './ConfirmDialog';
import { showToast } from './Toast';
import { saveFile, openTextFile } from '../utils/fileOps';
import { api } from '../services/api';

/* v2.31: exported — the Outline Bar's right-click menu offers the SAME
   palette the board's color picker uses. One list. */
export const BEAT_COLORS = [
  '', '#8b5cf6', '#4f46e5', '#2563eb', '#059669',
  '#eab308', '#f97316', '#ef4444', '#000000', '#ffffff',
];

/* ─── Outline presets (v1.89) ───
   One list drives the Presets dropdown; applying one appends its columns in
   order. Exported (with the apply helper) so the test exercises the same
   data the UI reads. */
export interface OutlinePreset {
  id: string;
  name: string;
  columns: string[];
  /** v2.20: default page budget per section, parallel to `columns`. Where a
   *  structure has conventional page counts they're used; every entry is at
   *  least 1 — a blank budget can't be grabbed on the Outline Bar. */
  pages: number[];
}
export const OUTLINE_PRESETS: OutlinePreset[] = [
  // Derek's spec: 40 pages per act.
  { id: '3act', name: '3-Act Structure', columns: ['Act I', 'Act II', 'Act III'], pages: [40, 40, 40] },
  {
    id: 'savethecat', name: 'Save the Cat (15 beats)',
    columns: [
      'Opening Image', 'Theme Stated', 'Set-Up', 'Catalyst', 'Debate',
      'Break into Two', 'B Story', 'Fun and Games', 'Midpoint',
      'Bad Guys Close In', 'All Is Lost', 'Dark Night of the Soul',
      'Break into Three', 'Finale', 'Final Image',
    ],
    // Snyder's beat sheet is written for a 110-page script; these spans tile
    // his page numbers (Catalyst p12, Break into Two p25, Midpoint p55,
    // All Is Lost p75, Break into Three p85, Final Image p110) in order.
    pages: [1, 1, 8, 2, 13, 1, 4, 25, 1, 19, 1, 9, 1, 23, 1],
  },
  {
    id: 'herojourney', name: "The Hero's Journey (12 stages)",
    columns: [
      'Ordinary World', 'Call to Adventure', 'Refusal of the Call',
      'Meeting the Mentor', 'Crossing the Threshold', 'Tests, Allies, Enemies',
      'Approach to the Inmost Cave', 'The Ordeal', 'Reward',
      'The Road Back', 'Resurrection', 'Return with the Elixir',
    ],
    // Vogler's act mapping on a 120-page feature: stages 1–5 = Act I (30),
    // 6–9 = Act II (60), 10–12 = Act III (30).
    pages: [10, 5, 5, 5, 5, 25, 10, 10, 15, 10, 15, 5],
  },
  {
    id: 'storycircle', name: 'Story Circle (8 steps)',
    columns: ['You', 'Need', 'Go', 'Search', 'Find', 'Take', 'Return', 'Change'],
    // Harmon's circle is eight EQUAL arcs — even eighths of a 120-page
    // feature. Scale down for a TV episode.
    pages: [15, 15, 15, 15, 15, 15, 15, 15],
  },
  {
    id: 'sequences', name: 'Sequence Method (8 sequences)',
    columns: [
      'Seq 1: Status Quo', 'Seq 2: Predicament', 'Seq 3: First Obstacle',
      'Seq 4: Midpoint', 'Seq 5: Rising Action', 'Seq 6: Main Culmination',
      'Seq 7: New Tension', 'Seq 8: Resolution',
    ],
    // The classic reel-length sequence: eight ~15-page sequences ≈ 120.
    pages: [15, 15, 15, 15, 15, 15, 15, 15],
  },
];

/** v2.26: a preset id resolves to a built-in, or (as `custom:<id>`) to one
 *  of the user's saved presets — one lookup for apply/override alike. */
export function resolveOutlinePreset(presetId: string): { columns: string[]; pages: number[] } | undefined {
  if (presetId.startsWith('custom:')) {
    return useOutlinePresetStore.getState().presets.find((p) => p.id === presetId.slice(7));
  }
  return OUTLINE_PRESETS.find((p) => p.id === presetId);
}

export function applyOutlinePreset(presetId: string, mode: 'append' | 'override' = 'append'): void {
  const preset = resolveOutlinePreset(presetId);
  if (!preset) return;
  if (mode === 'override') {
    // v2.23: replace the SECTIONS, never the beats. Clearing the columns
    // orphans every existing beat; orphans render in the temporary
    // "Uncategorized" column until they're dragged into a new section.
    // No blank starter beats here — the user's own beats are waiting.
    useEditorStore.getState().setBeatColumns([]);
    const { addBeatColumn } = useEditorStore.getState();
    preset.columns.forEach((title, i) => addBeatColumn(title, preset.pages[i] ?? 1));
    return;
  }
  const { addBeatColumn, addBeat } = useEditorStore.getState();
  preset.columns.forEach((title, i) => {
    // v2.18: every preset section starts with one blank beat, ready to fill.
    // v2.20: each section carries its structure's page budget.
    addBeat('', addBeatColumn(title, preset.pages[i] ?? 1));
  });
}

/** v2.23: beats whose section no longer exists (a preset override cleared
 *  the columns). They live in the temporary "Uncategorized" column until
 *  dragged into a real section. Exported for the test. */
export function uncategorizedBeats(beats: BeatInfo[], columns: Array<{ id: string }>): BeatInfo[] {
  return beats
    .filter((b) => !columns.some((c) => c.id === b.columnId))
    .sort((a, b) => a.position - b.position);
}

/* ─── URL detection ─── */
const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;

function extractUrls(text: string): string[] {
  if (!text) return [];
  const matches = text.match(URL_REGEX);
  return matches ? [...new Set(matches)] : [];
}

/* ─── Link Preview fetcher with in-memory cache ─── */
const _previewCache = new Map<string, BeatLinkPreview | 'loading' | 'error'>();

function useLinkPreviews(
  beatId: string,
  description: string,
  existingPreviews: BeatLinkPreview[] | undefined,
  onUpdate: (id: string, updates: Partial<BeatInfo>) => void,
) {
  const urls = useMemo(() => extractUrls(description), [description]);

  useEffect(() => {
    if (urls.length === 0) return;

    // Find URLs that aren't already cached on the beat or in the in-memory cache
    const existingUrls = new Set((existingPreviews || []).map((p) => p.url));
    const newUrls = urls.filter((u) => !existingUrls.has(u) && _previewCache.get(u) !== 'loading');

    if (newUrls.length === 0) {
      // Check if any cached previews can fill in
      const cached = urls
        .map((u) => _previewCache.get(u))
        .filter((v): v is BeatLinkPreview => !!v && typeof v === 'object');
      if (cached.length > 0 && cached.length > (existingPreviews || []).length) {
        onUpdate(beatId, { linkPreviews: cached });
      }
      return;
    }

    for (const url of newUrls) {
      _previewCache.set(url, 'loading');
      api.fetchLinkPreview(url).then((resp) => {
        const preview: BeatLinkPreview = {
          url: resp.url,
          title: resp.title,
          description: resp.description,
          image: resp.image,
          siteName: resp.site_name,
        };
        _previewCache.set(url, preview);
        // Merge into beat's cached previews
        const store = useEditorStore.getState();
        const beat = store.beats.find((b) => b.id === beatId);
        const current = beat?.linkPreviews || [];
        if (!current.some((p) => p.url === url)) {
          onUpdate(beatId, { linkPreviews: [...current, preview] });
        }
      }).catch(() => {
        _previewCache.set(url, 'error');
      });
    }
  }, [beatId, urls, existingPreviews, onUpdate]);

  // Return only previews for URLs still in the description
  return useMemo(() => {
    return (existingPreviews || []).filter((p) => urls.includes(p.url));
  }, [existingPreviews, urls]);
}

/* ─── Link Preview Card ─── */
const LinkPreviewCard: React.FC<{
  preview: BeatLinkPreview;
  onRemove: () => void;
}> = ({ preview, onRemove }) => (
  <a
    className="beat-link-preview"
    href={preview.url}
    target="_blank"
    rel="noopener noreferrer"
    title={preview.url}
    onClick={(e) => e.stopPropagation()}
  >
    {preview.image && (
      <div className="beat-link-preview-image">
        <img src={preview.image} alt="" loading="lazy" />
      </div>
    )}
    <div className="beat-link-preview-body">
      {preview.siteName && <div className="beat-link-preview-site">{preview.siteName}</div>}
      <div className="beat-link-preview-title">{preview.title || preview.url}</div>
      {preview.description && <div className="beat-link-preview-desc">{preview.description}</div>}
    </div>
    <button
      className="beat-link-preview-remove"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(); }}
      title="Remove preview"
    >&times;</button>
  </a>
);

/* ─── Render description text with clickable links ─── */
const DescriptionWithLinks: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;
  const parts = text.split(URL_REGEX);
  const urls = text.match(URL_REGEX) || [];
  const elements: React.ReactNode[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (parts[i]) elements.push(<span key={`t${i}`}>{parts[i]}</span>);
    if (urls[i]) {
      elements.push(
        <a
          key={`u${i}`}
          className="beat-desc-link"
          href={urls[i]}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          {urls[i]}
        </a>,
      );
    }
  }
  return <div className="beat-card-description-rendered">{elements}</div>;
};

/* v2.17: the beat's page estimate — the SAME outlineSpan the Outline Bar
   draws, editable from the board card too. Whole pages only. */
const BeatPagesField: React.FC<{
  beat: BeatInfo; onUpdate: (id: string, updates: Partial<BeatInfo>) => void;
}> = ({ beat, onUpdate }) => (
  <label
    className="beat-card-pages"
    title="Page estimate — how many pages this beat spans on the Outline Bar"
    onClick={(e) => e.stopPropagation()}
  >
    {/* v2.20: never blank — a beat with no span can't be grabbed on the
        Outline Bar, so invalid input is ignored and blur restores the value. */}
    <input
      type="number"
      min={1}
      step={1}
      value={beat.outlineSpan ?? 1}
      onChange={(e) => {
        const n = Math.round(Number(e.target.value));
        if (Number.isFinite(n) && n >= 1) onUpdate(beat.id, { outlineSpan: n });
      }}
      onBlur={(e) => { if (!e.target.value) e.target.value = String(beat.outlineSpan ?? 1); }}
    />
    <span>pages</span>
  </label>
);

/* ─── Beat Card Resize Handle (pointer events for mouse + touch) ─── */
const useResizeHandle = (
  onResize: (dw: number, dh: number) => void,
) => {
  const startRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const el = (e.target as HTMLElement).closest('.beat-card') as HTMLElement;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      startRef.current = { x: e.clientX, y: e.clientY, w: rect.width, h: rect.height };

      const onMove = (ev: PointerEvent) => {
        if (!startRef.current) return;
        onResize(
          Math.max(160, startRef.current.w + (ev.clientX - startRef.current.x)),
          Math.max(80, startRef.current.h + (ev.clientY - startRef.current.y)),
        );
      };
      const onUp = () => {
        startRef.current = null;
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
      };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    },
    [onResize],
  );

  return onPointerDown;
};

/* ─── Column Resize Handle (pointer events for mouse + touch) ─── */
const useColumnResize = (onResize: (width: number) => void) => {
  const startRef = useRef<{ x: number; w: number } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const col = (e.target as HTMLElement).closest('.beat-column') as HTMLElement;
      if (!col) return;
      startRef.current = { x: e.clientX, w: col.getBoundingClientRect().width };

      const onMove = (ev: PointerEvent) => {
        if (!startRef.current) return;
        onResize(Math.max(200, startRef.current.w + (ev.clientX - startRef.current.x)));
      };
      const onUp = () => {
        startRef.current = null;
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
      };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    },
    [onResize],
  );

  return onPointerDown;
};

/* ─── Shared Beat Card Content (used in both auto and custom modes) ─── */
interface BeatCardContentProps {
  beat: BeatInfo;
  onUpdate: (id: string, updates: Partial<BeatInfo>) => void;
  onDelete: (id: string) => void;
  dragHandleProps?: Record<string, unknown>;
  resizePointerDown: (e: React.PointerEvent) => void;
}

const BeatCardContent: React.FC<BeatCardContentProps> = ({
  beat, onUpdate, onDelete, dragHandleProps, resizePointerDown,
}) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [descFocused, setDescFocused] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const descHeightRef = useRef<number | null>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const imgH = beat.imageHeight || 0;
  const isImgFull = imgH === -1; // -1 = full card

  // Fetch and cache link previews for URLs in description
  const linkPreviews = useLinkPreviews(beat.id, beat.description, beat.linkPreviews, onUpdate);

  const handleRemovePreview = useCallback(
    (url: string) => {
      const updated = (beat.linkPreviews || []).filter((p) => p.url !== url);
      onUpdate(beat.id, { linkPreviews: updated });
      _previewCache.set(url, 'error'); // prevent re-fetch
    },
    [beat.id, beat.linkPreviews, onUpdate],
  );

  const cardStyle: React.CSSProperties = {
    ...(beat.color ? { borderLeftColor: beat.color, borderLeftWidth: 4 } : {}),
    ...(beat.cardHeight ? { height: beat.cardHeight, overflow: 'auto' } : {}),
  };

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => onUpdate(beat.id, { imageUrl: reader.result as string });
      reader.readAsDataURL(file);
      e.target.value = '';
    },
    [beat.id, onUpdate],
  );

  /* Image resize via bottom-edge drag */
  const imgResizeRef = useRef<{ startY: number; startH: number } | null>(null);
  const onImgResizeDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const imgContainer = (e.target as HTMLElement).closest('.beat-card-image') as HTMLElement;
      if (!imgContainer) return;
      imgResizeRef.current = { startY: e.clientY, startH: imgContainer.getBoundingClientRect().height };

      const onMove = (ev: PointerEvent) => {
        if (!imgResizeRef.current) return;
        const newH = Math.max(40, imgResizeRef.current.startH + (ev.clientY - imgResizeRef.current.startY));
        onUpdate(beat.id, { imageHeight: newH });
      };
      const onUp = () => {
        imgResizeRef.current = null;
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
      };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    },
    [beat.id, onUpdate],
  );

  const imgStyle: React.CSSProperties = isImgFull
    ? { flex: 1, maxHeight: 'none' }
    : imgH > 0
      ? { height: imgH, maxHeight: 'none' }
      : {};

  const imgElStyle: React.CSSProperties = isImgFull
    ? { maxHeight: 'none', height: '100%' }
    : imgH > 0
      ? { maxHeight: imgH }
      : {};

  return (
    <div className={`beat-card${isImgFull ? ' beat-card-img-full' : ''}`} style={cardStyle}>
      {/* Floating drag handle over image */}
      {beat.imageUrl && (
        <span className="beat-drag-icon beat-drag-icon-floating" {...(dragHandleProps || {})} style={{ touchAction: 'none' }}>&#x2630;</span>
      )}
      {beat.imageUrl && (
        <>
          <div className="beat-card-image" style={imgStyle}>
            <img src={beat.imageUrl} alt="" style={imgElStyle} />
            {!isImgFull && (
              <>
                <div className="beat-card-image-actions">
                  <button
                    className="beat-card-image-action-btn"
                    onClick={() => onUpdate(beat.id, { imageHeight: -1 })}
                    title="Fill card"
                  >&#x229E;</button>
                  {imgH !== 0 && (
                    <button
                      className="beat-card-image-action-btn"
                      onClick={() => onUpdate(beat.id, { imageHeight: 0 })}
                      title="Reset image size"
                    >&#8634;</button>
                  )}
                  <button
                    className="beat-card-image-remove"
                    onClick={() => onUpdate(beat.id, { imageUrl: '', imageHeight: 0 })}
                    title="Remove image"
                  >&times;</button>
                </div>
                <div
                  className="beat-card-image-resize-handle"
                  onPointerDown={onImgResizeDown}
                  style={{ touchAction: 'none' }}
                />
              </>
            )}
          </div>
          {isImgFull && (
            <div className="beat-card-image-actions-floating">
              <button
                className="beat-card-image-action-btn"
                onClick={() => onUpdate(beat.id, { imageHeight: 0 })}
                title="Default size"
              >&#x229F;</button>
              <button
                className="beat-card-image-remove"
                onClick={() => onUpdate(beat.id, { imageUrl: '', imageHeight: 0 })}
                title="Remove image"
              >&times;</button>
            </div>
          )}
        </>
      )}

      {isImgFull ? (
        <div className="beat-card-content-bottom">
          <div className="beat-card-top">
            <span className="beat-drag-icon" {...(dragHandleProps || {})} style={{ touchAction: 'none' }}>&#x2630;</span>
            <input
              className="beat-card-title"
              value={beat.title}
              onChange={(e) => onUpdate(beat.id, { title: e.target.value })}
              placeholder="Beat title..."
            />
            <BeatPagesField beat={beat} onUpdate={onUpdate} />
            <button className="beat-card-delete" onClick={() => onDelete(beat.id)} title="Delete beat">&times;</button>
          </div>
          {descFocused ? (
            <textarea
              ref={descRef}
              className="beat-card-description"
              value={beat.description}
              onChange={(e) => onUpdate(beat.id, { description: e.target.value })}
              onBlur={() => { if (descRef.current) descHeightRef.current = descRef.current.offsetHeight; setDescFocused(false); }}
              placeholder="Describe this beat..."
              rows={2}
              style={descHeightRef.current ? { height: descHeightRef.current } : undefined}
              autoFocus
            />
          ) : (
            <div className="beat-card-description-view" onClick={() => setDescFocused(true)}
              style={descHeightRef.current ? { minHeight: descHeightRef.current } : undefined}>
              {beat.description ? <DescriptionWithLinks text={beat.description} /> : (
                <span className="beat-card-desc-placeholder">Describe this beat...</span>
              )}
            </div>
          )}
          {linkPreviews.length > 0 && (
            <div className="beat-link-previews">
              {linkPreviews.map((p) => (
                <LinkPreviewCard key={p.url} preview={p} onRemove={() => handleRemovePreview(p.url)} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="beat-card-top">
            <span className="beat-drag-icon" {...(dragHandleProps || {})} style={{ touchAction: 'none' }}>&#x2630;</span>
            <input
              className="beat-card-title"
              value={beat.title}
              onChange={(e) => onUpdate(beat.id, { title: e.target.value })}
              placeholder="Beat title..."
            />
            <BeatPagesField beat={beat} onUpdate={onUpdate} />
            <button className="beat-card-delete" onClick={() => onDelete(beat.id)} title="Delete beat">&times;</button>
          </div>
          {descFocused ? (
            <textarea
              ref={descRef}
              className="beat-card-description"
              value={beat.description}
              onChange={(e) => onUpdate(beat.id, { description: e.target.value })}
              onBlur={() => { if (descRef.current) descHeightRef.current = descRef.current.offsetHeight; setDescFocused(false); }}
              placeholder="Describe this beat..."
              rows={3}
              style={descHeightRef.current ? { height: descHeightRef.current } : undefined}
              autoFocus
            />
          ) : (
            <div className="beat-card-description-view" onClick={() => setDescFocused(true)}
              style={descHeightRef.current ? { minHeight: descHeightRef.current } : undefined}>
              {beat.description ? <DescriptionWithLinks text={beat.description} /> : (
                <span className="beat-card-desc-placeholder">Describe this beat...</span>
              )}
            </div>
          )}
          {linkPreviews.length > 0 && (
            <div className="beat-link-previews">
              {linkPreviews.map((p) => (
                <LinkPreviewCard key={p.url} preview={p} onRemove={() => handleRemovePreview(p.url)} />
              ))}
            </div>
          )}
        </>
      )}

      <div className="beat-card-toolbar" style={{ marginTop: 'auto' }}>
        <div className="beat-color-picker-wrap">
          <button
            className="beat-toolbar-btn"
            onClick={() => setShowColorPicker(!showColorPicker)}
            title="Color"
            style={beat.color ? { color: beat.color } : undefined}
          >&#9679;</button>
          {showColorPicker && (
            <div className="beat-color-picker">
              {BEAT_COLORS.map((c) => (
                <button
                  key={c || 'none'}
                  className={`beat-color-swatch${beat.color === c ? ' active' : ''}`}
                  style={c ? { background: c } : undefined}
                  onClick={() => { onUpdate(beat.id, { color: c }); setShowColorPicker(false); }}
                  title={c || 'No color'}
                >{!c && <span className="beat-color-none">&times;</span>}</button>
              ))}
            </div>
          )}
        </div>
        <button className="beat-toolbar-btn" onClick={() => fileInputRef.current?.click()} title="Attach image">&#128247;</button>
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
        {(beat.cardWidth > 0 || beat.cardHeight > 0) && (
          <button
            className="beat-toolbar-btn"
            onClick={() => onUpdate(beat.id, { cardWidth: 0, cardHeight: 0 })}
            title="Reset size"
          >&#8634;</button>
        )}
      </div>

      {/* Resize handle */}
      <div className="beat-card-resize-handle" onPointerDown={resizePointerDown} style={{ touchAction: 'none' }} />
    </div>
  );
};

/* ─── Sortable Beat Card (auto-arrange mode) ─── */
interface SortableBeatCardProps {
  beat: BeatInfo;
  onUpdate: (id: string, updates: Partial<BeatInfo>) => void;
  onDelete: (id: string) => void;
}

const SortableBeatCard: React.FC<SortableBeatCardProps> = ({ beat, onUpdate, onDelete }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: beat.id });

  const wrapStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    width: beat.cardWidth || undefined,
    flexShrink: 0,
  };

  const handleResize = useCallback(
    (w: number, h: number) => {
      onUpdate(beat.id, { cardWidth: w, cardHeight: h });
    },
    [beat.id, onUpdate],
  );
  const resizePointerDown = useResizeHandle(handleResize);

  return (
    <div ref={setNodeRef} style={wrapStyle} className="beat-card-wrap">
      <BeatCardContent
        beat={beat}
        onUpdate={onUpdate}
        onDelete={onDelete}
        dragHandleProps={{ ...attributes, ...listeners }}
        resizePointerDown={resizePointerDown}
      />
    </div>
  );
};

/* ─── Free-position Beat Card (custom-arrange mode) ─── */
interface FreeBeatCardProps {
  beat: BeatInfo;
  onUpdate: (id: string, updates: Partial<BeatInfo>) => void;
  onDelete: (id: string) => void;
}

const FreeBeatCard: React.FC<FreeBeatCardProps> = ({ beat, onUpdate, onDelete }) => {
  const dragRef = useRef<{ startX: number; startY: number; beatX: number; beatY: number } | null>(null);

  const handleResize = useCallback(
    (w: number, h: number) => {
      onUpdate(beat.id, { cardWidth: w, cardHeight: h });
    },
    [beat.id, onUpdate],
  );
  const resizePointerDown = useResizeHandle(handleResize);

  const bx = beat.x || 0;
  const by = beat.y || 0;

  const onDragPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragRef.current = { startX: e.clientX, startY: e.clientY, beatX: bx, beatY: by };

      const onMove = (ev: PointerEvent) => {
        if (!dragRef.current) return;
        const newX = Math.max(0, dragRef.current.beatX + (ev.clientX - dragRef.current.startX));
        const newY = Math.max(0, dragRef.current.beatY + (ev.clientY - dragRef.current.startY));
        onUpdate(beat.id, { x: newX, y: newY });
      };
      const onUp = () => {
        dragRef.current = null;
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
      };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    },
    [beat.id, bx, by, onUpdate],
  );

  const wrapStyle: React.CSSProperties = {
    position: 'absolute',
    left: bx,
    top: by,
    width: beat.cardWidth || 240,
    zIndex: 1,
  };

  return (
    <div style={wrapStyle} className="beat-card-wrap beat-card-wrap-free">
      <BeatCardContent
        beat={beat}
        onUpdate={onUpdate}
        onDelete={onDelete}
        dragHandleProps={{ onPointerDown: onDragPointerDown, style: { touchAction: 'none', cursor: 'grab' } }}
        resizePointerDown={resizePointerDown}
      />
    </div>
  );
};

/* ─── DragOverlay card ─── */
const BeatCardOverlay: React.FC<{ beat: BeatInfo }> = ({ beat }) => (
  <div className="beat-card beat-card-overlay" style={beat.color ? { borderLeftColor: beat.color, borderLeftWidth: 4 } : {}}>
    <div className="beat-card-top"><span className="beat-drag-icon">&#x2630;</span><input className="beat-card-title" value={beat.title} readOnly /></div>
  </div>
);

/* ─── Custom Canvas (free-form mode) ─── */
interface CustomCanvasProps {
  beats: BeatInfo[];
  onUpdateBeat: (id: string, updates: Partial<BeatInfo>) => void;
  onDeleteBeat: (id: string) => void;
}

const CustomCanvas: React.FC<CustomCanvasProps> = ({
  beats, onUpdateBeat, onDeleteBeat,
}) => {
  return (
    <div className="beat-custom-canvas">
      {beats.map((beat) => (
        <FreeBeatCard
          key={beat.id}
          beat={beat}
          onUpdate={onUpdateBeat}
          onDelete={onDeleteBeat}
        />
      ))}
    </div>
  );
};

/* ─── Custom collision detection: prefer beat cards, fallback to column droppables ─── */
const beatCollisionDetection: CollisionDetection = (args) => {
  const centerCollisions = closestCenter(args);
  if (centerCollisions.length > 0) return centerCollisions;
  return pointerWithin(args);
};

/* ─── Main Beat Board ─── */
const BeatBoard: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const {
    beats, beatBoardOpen, beatColumns, beatArrangeMode,
    addBeat, updateBeat, deleteBeat, setBeats,
    addBeatColumn, updateBeatColumn, deleteBeatColumn,
    setBeatArrangeMode,
    beatUndo, beatRedo,
  } = useEditorStore();

  const boardRef = useRef<HTMLDivElement>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [maximizedColumnId, setMaximizedColumnId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  // Undo/redo + Escape keyboard shortcuts — only when focus is inside the beat board
  useEffect(() => {
    if (!beatBoardOpen) return;
    const handler = (e: KeyboardEvent) => {
      // Escape restores maximized column
      if (e.key === 'Escape' && maximizedColumnId) {
        e.preventDefault();
        setMaximizedColumnId(null);
        return;
      }
      if (!boardRef.current?.contains(document.activeElement)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        beatUndo();
      } else if (mod && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) {
        e.preventDefault();
        e.stopPropagation();
        beatRedo();
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [beatBoardOpen, beatUndo, beatRedo, maximizedColumnId]);

  const sortedColumns = [...beatColumns].sort((a, b) => a.position - b.position);
  const isSingleColumn = sortedColumns.length === 1;
  // v2.23: beats orphaned by a preset override wait in "Uncategorized".
  const orphanBeats = uncategorizedBeats(beats, beatColumns);
  // v2.26: the user's saved presets share the dropdown with the built-ins.
  const customPresets = useOutlinePresetStore((s) => s.presets);

  // v2.30: outline variation tabs — one beat pool, many arrangements.
  const outlineTabs = useEditorStore((s) => s.outlineTabs);
  const viewedTab = useEditorStore((s) => s.viewedOutlineTab);
  const barTab = useEditorStore((s) => s.outlineBarTab);
  const { addOutlineTab, switchOutlineTab, renameOutlineTab, deleteOutlineTab, setOutlineBarTab } = useEditorStore.getState();
  const [renamingTab, setRenamingTab] = useState<string | null>(null);

  const handleCloseTab = useCallback(async (id: string, name: string) => {
    const ok = await confirmDialog(
      `Close "${name}"? Your beats are safe — they live in every tab. Only this arrangement of sections is deleted.`,
      { title: 'Close Outline Tab', confirmLabel: 'Close Tab', danger: true },
    );
    if (ok) deleteOutlineTab(id);
  }, [deleteOutlineTab]);

  const handlePresetAction = useCallback(async (value: string) => {
    if (!value) return;
    const store = useOutlinePresetStore.getState();
    if (value === '__save') {
      const cols = [...useEditorStore.getState().beatColumns].sort((a, b) => a.position - b.position);
      if (cols.length === 0) { showToast('Nothing to save — the outline has no sections yet.', 'error'); return; }
      const name = await promptDialog('Name this preset', 'My Structure', { title: 'Save Outline Preset', confirmLabel: 'Save' });
      if (!name || !name.trim()) return;
      store.savePreset(name, cols.map((c) => c.title), cols.map((c) => c.targetPages ?? 1));
      showToast(`Preset "${name.trim()}" saved.`, 'success');
      return;
    }
    if (value === '__export') {
      try {
        const ok = await saveFile(store.exportJson(), 'outline-presets.json', [{ name: 'Outline Presets', extensions: ['json'] }]);
        if (ok) showToast(`Exported ${store.presets.length} preset${store.presets.length === 1 ? '' : 's'}.`, 'success');
      } catch (err) {
        showToast(`Export failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
      }
      return;
    }
    if (value === '__import') {
      try {
        const file = await openTextFile([{ name: 'Outline Presets', extensions: ['json'] }]);
        if (!file) return;
        const result = store.importPresets(file.content);
        if (result.error) showToast(result.error, 'error');
        else showToast(`Imported ${result.added} preset${result.added === 1 ? '' : 's'}${result.skipped ? ` (${result.skipped} skipped)` : ''}.`, result.added > 0 ? 'success' : 'info');
      } catch (err) {
        showToast(`Import failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
      }
      return;
    }
    // A preset id (built-in or custom:<id>) — v2.23 override rules apply.
    if (useEditorStore.getState().beatColumns.length === 0) { applyOutlinePreset(value); return; }
    const ok = await confirmDialog(
      'This preset will replace your current sections. Your beats are NOT deleted — they move to a temporary "Uncategorized" column on the left, and you drag each one into its new section.',
      { title: 'Replace the current outline?', confirmLabel: 'Replace Sections', danger: true },
    );
    if (ok) applyOutlinePreset(value, 'override');
  }, []);

  const handleAddColumn = useCallback(() => {
    addBeatColumn(`Section ${beatColumns.length + 1}`);
  }, [addBeatColumn, beatColumns.length]);

  const handleDragStart = useCallback((e: DragStartEvent) => setActiveDragId(String(e.active.id)), []);

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) return;
      const activeBeat = beats.find((b) => b.id === active.id);
      if (!activeBeat) return;

      const overId = String(over.id);

      // Check if dragging over a beat in a different column
      const overBeat = beats.find((b) => b.id === overId);
      if (overBeat && overBeat.columnId !== activeBeat.columnId) {
        setBeats(beats.map((b) => b.id === activeBeat.id ? { ...b, columnId: overBeat.columnId } : b));
        return;
      }

      // Check if dragging over an empty column droppable (id starts with "column-drop-")
      if (overId.startsWith('column-drop-')) {
        const targetColId = overId.replace('column-drop-', '');
        if (targetColId !== activeBeat.columnId) {
          setBeats(beats.map((b) => b.id === activeBeat.id ? { ...b, columnId: targetColId, position: 0 } : b));
        }
      }
    },
    [beats, setBeats],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDragId(null);
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const activeBeat = beats.find((b) => b.id === active.id);
      const overBeat = beats.find((b) => b.id === over.id);
      if (!activeBeat || !overBeat) return;

      const columnId = overBeat.columnId;
      const updated = beats.map((b) => b.id === activeBeat.id ? { ...b, columnId } : b);
      const colBeats = updated.filter((b) => b.columnId === columnId).sort((a, b) => a.position - b.position);
      const oldIdx = colBeats.findIndex((b) => b.id === active.id);
      const newIdx = colBeats.findIndex((b) => b.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return;
      const reordered = arrayMove(colBeats, oldIdx, newIdx);
      const posMap = new Map(reordered.map((b, i) => [b.id, i]));
      setBeats(updated.map((b) => { const p = posMap.get(b.id); return p !== undefined ? { ...b, position: p } : b; }));
    },
    [beats, setBeats],
  );

  const activeBeat = activeDragId ? beats.find((b) => b.id === activeDragId) : null;

  // Ensure at least one column exists for adding beats in custom mode
  const defaultColumnId = sortedColumns.length > 0 ? sortedColumns[0].id : '';

  const handleAddBeatFree = useCallback(() => {
    const colId = defaultColumnId || addBeatColumn('Section 1');
    const offset = (beats.length % 10) * 30;
    addBeat('New Beat', colId);
    setTimeout(() => {
      const store = useEditorStore.getState();
      const latest = store.beats[store.beats.length - 1];
      if (latest && (latest.x || 0) === 0 && (latest.y || 0) === 0) {
        updateBeat(latest.id, { x: 40 + offset, y: 40 + offset });
      }
    }, 0);
  }, [defaultColumnId, beats.length, addBeat, addBeatColumn, updateBeat]);

  if (!beatBoardOpen && !embedded) return null;

  return (
    <div className="beat-board" ref={boardRef}>
      {/* v2.30: variation tabs, browser-style. One shared pool of beats;
          each tab is its own arrangement of sections. The ◉ marks the tab
          the Outline Bar shows. */}
      <div className="beat-tabs">
        {outlineTabs.map((t) => (
          <div
            key={t.id}
            className={`beat-tab${viewedTab === t.id ? ' active' : ''}`}
            onClick={() => switchOutlineTab(t.id)}
            onDoubleClick={() => setRenamingTab(t.id)}
            title={viewedTab === t.id ? t.name : `Switch to ${t.name}`}
          >
            <button
              className={`beat-tab-use${barTab === t.id ? ' on' : ''}`}
              title={barTab === t.id ? 'Shown in the Outline Bar' : 'Use this outline in the Outline Bar'}
              onClick={(e) => { e.stopPropagation(); setOutlineBarTab(t.id); }}
            >
              {barTab === t.id ? <FaDotCircle /> : <FaRegCircle />}
            </button>
            {renamingTab === t.id ? (
              <input
                autoFocus
                className="beat-tab-rename"
                defaultValue={t.name}
                onClick={(e) => e.stopPropagation()}
                onBlur={(e) => { renameOutlineTab(t.id, e.target.value); setRenamingTab(null); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  if (e.key === 'Escape') setRenamingTab(null);
                }}
              />
            ) : (
              <span className="beat-tab-name">{t.name}</span>
            )}
            {outlineTabs.length > 1 && (
              <button
                className="beat-tab-x"
                title="Close this outline variation (beats are kept)"
                onClick={(e) => { e.stopPropagation(); void handleCloseTab(t.id, t.name); }}
              >×</button>
            )}
          </div>
        ))}
        <button className="beat-tab-add" title="New outline variation" onClick={() => addOutlineTab()}>＋</button>
      </div>
      <div className="beat-board-header">
        <span className="beat-board-title">Outline</span>
        <span className="beat-board-info">
          {beats.length} beat{beats.length !== 1 ? 's' : ''}
        </span>

        {/* Mode toggle (v1.98; v2.22: "Columns" → "Sections", matching the
            v2.18 rename everywhere else) */}
        <span className="beat-mode-label">Arrangement:</span>
        <div className="beat-mode-toggle">
          <button
            className={`beat-mode-btn${beatArrangeMode === 'auto' ? ' active' : ''}`}
            onClick={() => setBeatArrangeMode('auto')}
            title="Sections — beats grouped in side-by-side sections"
          >Sections</button>
          <button
            className={`beat-mode-btn${beatArrangeMode === 'custom' ? ' active' : ''}`}
            onClick={() => setBeatArrangeMode('custom')}
            title="Freeform — place beats anywhere"
          >Freeform</button>
        </div>

        {beatArrangeMode === 'auto' ? (
          <>
            {/* v1.89: an action menu, not state — value stays on the
                placeholder so it reads "Presets" again after applying.
                v2.23: with sections already on the board, a preset REPLACES
                them (after a confirm) instead of piling more on — the beats
                survive in the Uncategorized column.
                v2.26: the user's saved presets join the list, plus save /
                export / import actions. */}
            <select
              className="beat-board-preset"
              value=""
              title="Apply an outline structure, or save your own"
              onChange={(e) => { void handlePresetAction(e.target.value); }}
            >
              <option value="">Presets…</option>
              <optgroup label="Built-in">
                {OUTLINE_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </optgroup>
              {customPresets.length > 0 && (
                <optgroup label="My Presets">
                  {customPresets.map((p) => (
                    <option key={p.id} value={`custom:${p.id}`}>{p.name}</option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Manage">
                <option value="__save">Save current as preset…</option>
                {customPresets.length > 0 && <option value="__export">Export my presets…</option>}
                <option value="__import">Import presets…</option>
              </optgroup>
            </select>
            <button className="beat-board-add-col-btn" onClick={handleAddColumn}>+ Add Section</button>
          </>
        ) : (
          <button className="beat-board-add-col-btn" onClick={handleAddBeatFree}>+ Add Beat</button>
        )}
      </div>

      {beatArrangeMode === 'auto' && (
        <div className="beat-board-hint">
          Create a section to organize scenes/beats. Example: Act 1, Act 2, Act 3.
        </div>
      )}

      {beatArrangeMode === 'auto' ? (
        <DndContext sensors={sensors} collisionDetection={beatCollisionDetection} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
          <div className={`beat-board-columns${maximizedColumnId ? ' beat-board-columns-maximized' : ''}`}>
            {/* v2.23: the temporary holding pen for beats orphaned by a
                preset override. Looks like a section but isn't one — no
                title input, no page budget, no delete. It sits before the
                first section and disappears once it's empty. */}
            {orphanBeats.length > 0 && !maximizedColumnId && (
              <div className="beat-column beat-column-uncategorized">
                <div className="beat-column-header">
                  <span className="beat-column-uncat-title">Uncategorized</span>
                </div>
                <SortableContext items={orphanBeats.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                  <div className="beat-column-cards">
                    {orphanBeats.map((beat) => (
                      <SortableBeatCard key={beat.id} beat={beat} onUpdate={updateBeat} onDelete={deleteBeat} />
                    ))}
                  </div>
                </SortableContext>
                <div className="beat-column-uncat-hint">
                  Drag each beat into a section — this column disappears when it's empty.
                </div>
              </div>
            )}
            {sortedColumns.map((col) => {
              if (maximizedColumnId && maximizedColumnId !== col.id) return null;
              const colBeats = beats.filter((b) => b.columnId === col.id).sort((a, b) => a.position - b.position);

              return <BeatColumnView
                key={col.id}
                col={col}
                colBeats={colBeats}
                isSingleColumn={isSingleColumn || maximizedColumnId === col.id}
                isMaximized={maximizedColumnId === col.id}
                onToggleMaximize={() => setMaximizedColumnId(maximizedColumnId === col.id ? null : col.id)}
                showMaximizeBtn={true}
                onUpdateColumn={updateBeatColumn}
                onDeleteColumn={deleteBeatColumn}
                onAddBeat={addBeat}
                onUpdateBeat={updateBeat}
                onDeleteBeat={deleteBeat}
              />;
            })}
          </div>
          <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>{activeBeat ? <BeatCardOverlay beat={activeBeat} /> : null}</DragOverlay>
        </DndContext>
      ) : (
        <CustomCanvas
          beats={beats}
          onUpdateBeat={updateBeat}
          onDeleteBeat={deleteBeat}
        />
      )}
    </div>
  );
};

/* ─── Column component with resize handle ─── */
interface BeatColumnViewProps {
  col: { id: string; title: string; width: number; targetPages?: number };
  colBeats: BeatInfo[];
  isSingleColumn: boolean;
  isMaximized: boolean;
  onToggleMaximize: () => void;
  showMaximizeBtn: boolean;
  onUpdateColumn: (id: string, updates: Partial<{ title: string; width: number; targetPages: number }>) => void;
  onDeleteColumn: (id: string) => void;
  onAddBeat: (title: string, columnId: string) => void;
  onUpdateBeat: (id: string, updates: Partial<BeatInfo>) => void;
  onDeleteBeat: (id: string) => void;
}

const BeatColumnView: React.FC<BeatColumnViewProps> = ({
  col, colBeats, isSingleColumn, isMaximized, onToggleMaximize, showMaximizeBtn,
  onUpdateColumn, onDeleteColumn, onAddBeat, onUpdateBeat, onDeleteBeat,
}) => {
  const colResizePointerDown = useColumnResize((w) => onUpdateColumn(col.id, { width: w }));
  const { setNodeRef: setDropRef } = useDroppable({ id: `column-drop-${col.id}` });

  const colStyle: React.CSSProperties = isMaximized
    ? { flex: 1, maxWidth: 'none', minWidth: 0 }
    : isSingleColumn
      ? { flex: 1, maxWidth: 'none', minWidth: 0 }
      : col.width > 0
        ? { width: col.width, minWidth: 200, maxWidth: 'none', flexShrink: 0 }
        : {};

  return (
    <div className={`beat-column${isMaximized ? ' beat-column-maximized' : ''}`} style={colStyle}>
      <div className="beat-column-header">
        <input
          className="beat-column-title-input"
          value={col.title}
          onChange={(e) => onUpdateColumn(col.id, { title: e.target.value })}
          placeholder="Section name..."
        />
        {/* v2.11: the section's page budget — drives its block width on the
            Outline Bar's top row (also settable by right-click there). */}
        <label className="beat-column-target" title="Target pages for this section on the Outline Bar">
          {/* v2.20: never blank (see BeatPagesField). */}
          <input
            type="number"
            min={1}
            value={col.targetPages ?? 1}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n) && n >= 1) onUpdateColumn(col.id, { targetPages: Math.round(n) });
            }}
            onBlur={(e) => { if (!e.target.value) e.target.value = String(col.targetPages ?? 1); }}
          />
          <span>pages</span>
        </label>
        {showMaximizeBtn && (
          <button
            className="beat-column-maximize"
            onClick={onToggleMaximize}
            title={isMaximized ? 'Restore section' : 'Maximize section'}
          >{isMaximized ? '\u29C9' : '\u2922'}</button>
        )}
        <button className="beat-column-delete" onClick={() => onDeleteColumn(col.id)} title="Delete section">&times;</button>
      </div>
      <SortableContext items={colBeats.map((b) => b.id)} strategy={verticalListSortingStrategy}>
        <div ref={setDropRef} className={`beat-column-cards${isSingleColumn ? ' beat-column-cards-wrap' : ''}`}>
          {colBeats.map((beat) => (
            <SortableBeatCard key={beat.id} beat={beat} onUpdate={onUpdateBeat} onDelete={onDeleteBeat} />
          ))}
        </div>
      </SortableContext>
      <button className="beat-add-btn" onClick={() => onAddBeat('New Beat', col.id)}>+ Add Beat</button>
      {/* Column resize handle (right edge) */}
      {!isSingleColumn && !isMaximized && <div className="beat-column-resize-handle" onPointerDown={colResizePointerDown} style={{ touchAction: 'none' }} />}
    </div>
  );
};

export default BeatBoard;
