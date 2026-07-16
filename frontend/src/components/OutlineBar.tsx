/**
 * OutlineBar (v1.75; rebuilt v2.11) — a PAGE TIMELINE, Premiere-style:
 * the x-axis is script pages instead of time.
 *
 * Rows, top to bottom:
 *   Acts   — the Outline tool's COLUMNS as sequential blocks, each spanning
 *            its page budget (targetPages: 30/45/40 → a 115-page ruler).
 *            Drag a block's right edge to change the budget; right-click to
 *            type it (also settable in the Outline window's column header).
 *   Beats  — the Outline tool's beats, placed at a page + span. Drag to
 *            move, drag the right edge to resize, right-click to type the
 *            page target.
 *   Ruler  — page increments, 1 to the total the acts define.
 *   Script — what's ACTUALLY written: one block per scene heading, sized by
 *            its real page length (computeSceneLengths). Click to jump.
 *
 * The side holds a zoom (pixels per page; Fit stretches the ruler to the
 * visible width) and the tracks scroll horizontally when they outgrow the
 * screen. ONE SOURCE OF TRUTH: blocks ARE the Outline tool's columns and
 * beats — no copies. Closing lives in View > Outline Bar (no × here, v2.11).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@tiptap/react';
import { FaFileExport } from 'react-icons/fa';
import { useEditorStore, type BeatInfo, type BeatColumn } from '../stores/editorStore';
import { computeSceneLengths } from '../editor/pagination';
import AddMenu from './AddMenu';
import { showToast } from './Toast';

const SNAP = 1;                   // v2.16, Derek: whole pages only — no decimals
const DEFAULT_SPAN = 1;           // beats default to one page
const SCENE_MIN = 0.125;          // the script row stays TRUE to real lengths
/** A section with no page budget yet still needs a visible block. v2.20:
 *  1, matching what the Outline window's field shows for it — new sections
 *  are born with targetPages: 1, so this only covers pre-v2.20 data. */
export const DEFAULT_COLUMN_PAGES = 1;

/** Clamp + snap a page position for a beat. Exported for the test. */
export function snapPage(page: number, span: number, totalPages: number): number {
  const snapped = Math.round(page / SNAP) * SNAP;
  return Math.min(Math.max(1, snapped), Math.max(1, totalPages - span + 1));
}

/** Left/width percentages for a marker. Exported for the test. */
export function markerGeometry(page: number, span: number, totalPages: number) {
  const total = Math.max(1, totalPages);
  return {
    leftPct: ((page - 1) / total) * 100,
    widthPct: (Math.max(SNAP, span) / total) * 100,
  };
}

/** v2.11: the acts row — columns in board order, packed from page 1, each
 *  spanning its budget. Exported for the test. */
export function columnRanges(cols: BeatColumn[]): Array<{ id: string; title: string; start: number; pages: number }> {
  const sorted = [...cols].sort((a, b) => a.position - b.position);
  let start = 1;
  return sorted.map((c) => {
    const pages = Math.max(1, Math.round(c.targetPages || DEFAULT_COLUMN_PAGES));
    const r = { id: c.id, title: c.title, start, pages };
    start += pages;
    return r;
  });
}

interface SceneEntry { text: string; pos: number; start: number; pages: number }

function collectScenes(editor: Editor | null): Array<{ text: string; pos: number }> {
  if (!editor || editor.isDestroyed) return [];
  const scenes: Array<{ text: string; pos: number }> = [];
  editor.state.doc.forEach((node, pos) => {
    if (node.type.name === 'sceneHeading' && node.textContent.trim()) {
      scenes.push({ text: node.textContent.trim(), pos });
    }
  });
  return scenes;
}

/** The right-click "target pages" popover — portalled to body, positioned
 *  by top/left only (never bottom). */
interface PagesPop { kind: 'column' | 'beat'; id: string; x: number; y: number; value: number }

export default function OutlineBar({ editor }: { editor: Editor | null }) {
  const beats = useEditorStore((s) => s.beats);
  const beatColumns = useEditorStore((s) => s.beatColumns);
  const updateBeat = useEditorStore((s) => s.updateBeat);
  const updateBeatColumn = useEditorStore((s) => s.updateBeatColumn);
  const addBeatColumn = useEditorStore((s) => s.addBeatColumn);
  const addBeat = useEditorStore((s) => s.addBeat);
  const pageCount = useEditorStore((s) => s.pageCount);
  const pageLayout = useEditorStore((s) => s.pageLayout);
  const zoom = useEditorStore((s) => s.outlineBarZoom);
  const setZoom = useEditorStore((s) => s.setOutlineBarZoom);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [viewW, setViewW] = useState(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    setViewW(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;   // jsdom
    const ro = new ResizeObserver(() => setViewW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ── the page domain ── */
  const acts = useMemo(() => columnRanges(beatColumns), [beatColumns]);
  const actsTotal = acts.reduce((sum, a) => sum + a.pages, 0);
  // v2.11: beats on either legacy lane count as placed (lanes merged).
  const placed = useMemo(() => beats.filter((b) => b.outlineLane !== undefined && b.outlineLane !== null), [beats]);
  const unplaced = useMemo(() => beats.filter((b) => b.outlineLane === undefined || b.outlineLane === null), [beats]);
  const beatsEnd = placed.reduce((m, b) => Math.max(m, (b.outlinePage ?? 1) + (b.outlineSpan ?? DEFAULT_SPAN) - 1), 0);
  // The acts define the plan; the script and beats can outgrow it.
  const totalPages = Math.max(1, actsTotal, Math.ceil(pageCount), Math.ceil(beatsEnd));

  // px per page: explicit zoom, or fit-to-width when zoom === 0.
  const ppp = zoom > 0 ? zoom : Math.max(2, (viewW || 800) / totalPages);
  const trackW = Math.ceil(totalPages * ppp);

  /* ── the script row ── */
  const [scenes, setScenes] = useState<SceneEntry[]>([]);
  useEffect(() => {
    if (!editor) return;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const heads = collectScenes(editor);
        let lengths: number[] = [];
        try { lengths = computeSceneLengths(editor.state.doc, pageLayout); } catch { /* mid-transaction */ }
        let start = 1;
        setScenes(heads.map((h, i) => {
          const pages = Math.max(SCENE_MIN, lengths[i] ?? SCENE_MIN);
          const s: SceneEntry = { ...h, start, pages };
          start += pages;
          return s;
        }));
      }, 400);
    };
    refresh();
    editor.on('update', refresh);
    return () => { clearTimeout(timer); editor.off('update', refresh); };
  }, [editor, pageLayout]);

  /* ── dragging: beats move/resize; act blocks resize (budget) ── */
  const dragRef = useRef<{
    kind: 'beat-move' | 'beat-resize' | 'beat-resize-l' | 'act-resize';
    id: string; startX: number; startPage: number; startSpan: number;
  } | null>(null);

  const startBeatDrag = (e: React.PointerEvent, beat: BeatInfo, mode: 'move' | 'resize' | 'resize-l') => {
    e.preventDefault(); e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = {
      kind: mode === 'move' ? 'beat-move' : mode === 'resize' ? 'beat-resize' : 'beat-resize-l',
      id: beat.id, startX: e.clientX,
      startPage: beat.outlinePage ?? 1,
      startSpan: beat.outlineSpan ?? DEFAULT_SPAN,
    };
  };
  /** v2.15: either edge resizes. An act's LEFT edge is the boundary with the
   *  previous section, so it adjusts THAT section's budget — Premiere's
   *  trim-the-cut model; the first act's left edge is page 1, immovable. */
  const startActResize = (e: React.PointerEvent, act: { id: string; pages: number }) => {
    e.preventDefault(); e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { kind: 'act-resize', id: act.id, startX: e.clientX, startPage: 1, startSpan: act.pages };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dPages = (e.clientX - d.startX) / ppp;
    if (d.kind === 'beat-move') {
      const page = snapPage(d.startPage + dPages, d.startSpan, totalPages);
      updateBeat(d.id, { outlinePage: page, outlineLane: 0 });
    } else if (d.kind === 'beat-resize') {
      const span = Math.max(SNAP, Math.round((d.startSpan + dPages) / SNAP) * SNAP);
      updateBeat(d.id, { outlineSpan: Math.min(span, totalPages) });
    } else if (d.kind === 'beat-resize-l') {
      // Left edge moves the START; the END stays pinned.
      const end = d.startPage + d.startSpan;
      const page = Math.min(
        Math.max(1, Math.round((d.startPage + dPages) / SNAP) * SNAP),
        end - SNAP,
      );
      updateBeat(d.id, { outlinePage: page, outlineSpan: end - page, outlineLane: 0 });
    } else {
      // Acts budget in WHOLE pages — the ruler total follows live.
      const pages = Math.max(1, Math.round(d.startSpan + dPages));
      updateBeatColumn(d.id, { targetPages: pages });
    }
  };
  /** v2.16: the bar and the board are ONE model — dropping a beat inside a
   *  section's page range moves it into that column on the Outline board. */
  const onPointerUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d || d.kind !== 'beat-move') return;
    const b = useEditorStore.getState().beats.find((x) => x.id === d.id);
    if (!b) return;
    const mid = (b.outlinePage ?? 1) + (b.outlineSpan ?? DEFAULT_SPAN) / 2;
    const act = acts.find((a) => mid >= a.start && mid < a.start + a.pages);
    if (act && b.columnId !== act.id) updateBeat(b.id, { columnId: act.id });
  };

  /* ── double-click: rename in place (v2.16) — the same title the
        Outline board shows, one model. ── */
  const [renaming, setRenaming] = useState<{ kind: 'column' | 'beat'; id: string } | null>(null);
  const commitRename = (value: string) => {
    if (!renaming) return;
    const title = value.trim();
    if (title) {
      if (renaming.kind === 'column') updateBeatColumn(renaming.id, { title });
      else updateBeat(renaming.id, { title });
    }
    setRenaming(null);
  };
  const renameInput = (defaultValue: string) => (
    <input
      autoFocus
      className="fs-ob-rename"
      defaultValue={defaultValue}
      onPointerDown={(e) => e.stopPropagation()}
      onBlur={(e) => commitRename(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') setRenaming(null);
      }}
    />
  );

  /* ── right-click: type the page target ── */
  const [pop, setPop] = useState<PagesPop | null>(null);
  useEffect(() => {
    if (!pop) return;
    const close = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest('.fs-ob-pagespop')) setPop(null);
    };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setPop(null); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', key);
    };
  }, [pop]);

  const openPop = (e: React.MouseEvent, kind: PagesPop['kind'], id: string, value: number) => {
    e.preventDefault();
    setPop({ kind, id, x: Math.min(e.clientX, window.innerWidth - 200), y: e.clientY + 4, value });
  };
  const commitPop = () => {
    if (!pop) return;
    const v = Math.max(1, Math.round(pop.value));   // whole pages only
    if (pop.kind === 'column') updateBeatColumn(pop.id, { targetPages: v });
    else updateBeat(pop.id, { outlineSpan: v });
    setPop(null);
  };

  /* ── actions ── */
  const placeAtEnd = useCallback((id: string) => {
    const ends = placed.map((b) => (b.outlinePage ?? 1) + (b.outlineSpan ?? DEFAULT_SPAN));
    const page = snapPage(ends.length ? Math.max(...ends) : 1, DEFAULT_SPAN, totalPages);
    updateBeat(id, { outlineLane: 0, outlinePage: page, outlineSpan: DEFAULT_SPAN });
  }, [placed, totalPages, updateBeat]);

  const addFromMenu = (v: string) => {
    if (v === 'section') {
      addBeatColumn('New Section');
    } else if (v === 'beat') {
      const col = beatColumns[0]?.id || addBeatColumn('New Section');
      placeAtEnd(addBeat('New Beat', col));
    }
  };

  const sendToScript = () => {
    if (!editor || editor.isDestroyed || placed.length === 0) return;
    const ordered = [...placed].sort((a, b) => (a.outlinePage ?? 0) - (b.outlinePage ?? 0));
    const nodes = ordered.map((b) => ({
      type: 'general',
      content: [{ type: 'text', text: `# ${b.title}${b.description ? ` — ${b.description}` : ''}` }],
    }));
    editor.chain().insertContentAt(editor.state.doc.content.size, nodes).run();
    showToast(`Sent ${ordered.length} outline beat${ordered.length === 1 ? '' : 's'} to the script as sections.`, 'success');
  };

  const jumpToScene = (pos: number) => {
    if (!editor || editor.isDestroyed) return;
    editor.chain().focus().setTextSelection(pos + 1).scrollIntoView().run();
  };

  /* ── ruler ticks: label density follows the zoom ── */
  const labelEvery = ppp >= 24 ? 1 : ppp >= 10 ? 5 : 10;
  const pages = useMemo(() => Array.from({ length: totalPages }, (_, i) => i + 1), [totalPages]);

  const pctLeft = (page: number) => `${((page - 1) / totalPages) * 100}%`;
  const pctWidth = (span: number) => `${(span / totalPages) * 100}%`;

  return (
    <div className="fs-outline-bar">
      <div className="fs-ob-side">
        <span className="fs-ob-title">Outline</span>
        {/* v2.16: one tidy row of equal square buttons. */}
        <div className="fs-ob-actions">
          <AddMenu
            label="＋"
            title="Add a section (column) or a beat"
            center
            onPick={addFromMenu}
            groups={[{
              label: 'Add',
              options: [
                { value: 'section', label: 'Section' },
                { value: 'beat', label: 'Beat' },
              ],
            }]}
          />
          <button
            className="fs-ob-iconbtn"
            onClick={sendToScript}
            disabled={placed.length === 0}
            title="Send to Script — insert each beat as a section line (# …)"
          >
            <FaFileExport />
          </button>
        </div>
        {unplaced.length > 0 && (
          <select
            value=""
            title="Place a beat from the Outline board"
            onChange={(e) => { if (e.target.value) placeAtEnd(e.target.value); }}
          >
            <option value="">Place…</option>
            {unplaced.map((b) => <option key={b.id} value={b.id}>{b.title || '(untitled)'}</option>)}
          </select>
        )}
        <div className="fs-ob-zoom" title="Zoom — how many pixels one page takes">
          <button className={zoom === 0 ? 'active' : ''} onClick={() => setZoom(0)}>Fit</button>
          <input
            type="range"
            min={2}
            max={64}
            value={zoom > 0 ? zoom : Math.round(ppp)}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </div>
      </div>

      {/* Premiere-style: tracks scroll horizontally; labels stay pinned. */}
      <div className="fs-ob-scroll" ref={scrollRef}>
        <div className="fs-ob-tracks" style={{ width: trackW }}>
          {/* Row 1: acts / sections — sequential page budgets */}
          <div className="fs-ob-lane fs-ob-acts">
            <span className="fs-ob-lane-label">Acts</span>
            {acts.map((a, i) => (
              <div
                key={a.id}
                className={`fs-ob-act fs-ob-act-${i % 3}`}
                style={{ left: pctLeft(a.start), width: pctWidth(a.pages) }}
                title={`${a.title} — ${a.pages}p (${a.start}–${a.start + a.pages - 1})\nRight-click to set the target page count`}
                onContextMenu={(e) => openPop(e, 'column', a.id, a.pages)}
                onDoubleClick={() => setRenaming({ kind: 'column', id: a.id })}
              >
                {i > 0 && (
                  <span
                    className="fs-ob-resize-l"
                    title="Drag to move this boundary (resizes the previous section)"
                    onPointerDown={(e) => startActResize(e, acts[i - 1])}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                  />
                )}
                {/* v2.15: no page count on the block — the ruler shows it,
                    and the hover tooltip spells it out. */}
                {renaming?.kind === 'column' && renaming.id === a.id
                  ? renameInput(a.title)
                  : <span className="fs-ob-act-title">{a.title}</span>}
                <span
                  className="fs-ob-beat-resize"
                  title="Drag to change this section's page budget"
                  onPointerDown={(e) => startActResize(e, a)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                />
              </div>
            ))}
            {acts.length === 0 && <span className="fs-ob-empty">No sections yet — ＋ adds one</span>}
          </div>

          {/* Row 2: beats */}
          <div className="fs-ob-lane fs-ob-beats">
            <span className="fs-ob-lane-label">Beats</span>
            {placed.map((b) => {
              const { leftPct, widthPct } = markerGeometry(b.outlinePage ?? 1, b.outlineSpan ?? DEFAULT_SPAN, totalPages);
              return (
                <div
                  key={b.id}
                  className="fs-ob-beat"
                  style={{ left: `${leftPct}%`, width: `${widthPct}%`, background: b.color || undefined }}
                  title={`${b.title} — p${b.outlinePage ?? 1}, ${b.outlineSpan ?? DEFAULT_SPAN}p${b.description ? `\n${b.description}` : ''}\nRight-click to set the page target`}
                  onPointerDown={(e) => startBeatDrag(e, b, 'move')}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onContextMenu={(e) => openPop(e, 'beat', b.id, b.outlineSpan ?? DEFAULT_SPAN)}
                  onDoubleClick={() => setRenaming({ kind: 'beat', id: b.id })}
                >
                  <span
                    className="fs-ob-resize-l"
                    title="Drag to move the start (the end stays put)"
                    onPointerDown={(e) => startBeatDrag(e, b, 'resize-l')}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                  />
                  {renaming?.kind === 'beat' && renaming.id === b.id
                    ? renameInput(b.title)
                    : <span className="fs-ob-beat-title">{b.title}</span>}
                  <button
                    className="fs-ob-beat-x"
                    title="Remove from the bar (stays on the Outline board)"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => updateBeat(b.id, { outlineLane: undefined, outlinePage: undefined })}
                  >×</button>
                  <span
                    className="fs-ob-beat-resize"
                    title="Drag to change the page span"
                    onPointerDown={(e) => startBeatDrag(e, b, 'resize')}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                  />
                </div>
              );
            })}
          </div>

          {/* Ruler: pages 1..total */}
          <div className="fs-ob-ruler">
            {pages.map((p) => (
              <span key={p} className="fs-ob-tick" style={{ left: pctLeft(p), width: pctWidth(1) }}>
                {(p === 1 || p % labelEvery === 0) && <span className="fs-ob-tick-label">{p}</span>}
              </span>
            ))}
          </div>

          {/* Row 3: the actual script, one block per scene heading */}
          <div className="fs-ob-lane fs-ob-scenes">
            <span className="fs-ob-lane-label">Script</span>
            {scenes.length === 0 ? (
              <span className="fs-ob-empty">No scene headings yet</span>
            ) : scenes.map((s, i) => (
              <button
                key={`${s.pos}-${i}`}
                className="fs-ob-scene"
                style={{ left: pctLeft(s.start), width: pctWidth(s.pages) }}
                title={`${s.text} — ${s.pages.toFixed(2)}p`}
                onClick={() => jumpToScene(s.pos)}
              >
                {s.text}
              </button>
            ))}
          </div>
        </div>
      </div>

      {pop && createPortal(
        <div className="fs-ob-pagespop" style={{ top: pop.y, left: pop.x }}>
          <label>
            Target pages
            <input
              autoFocus
              type="number"
              min={1}
              step={1}
              value={pop.value}
              onChange={(e) => setPop({ ...pop, value: Number(e.target.value) || 0 })}
              onKeyDown={(e) => { if (e.key === 'Enter') commitPop(); }}
            />
          </label>
          <button onClick={commitPop}>Set</button>
        </div>,
        document.body,
      )}
    </div>
  );
}
