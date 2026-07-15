/**
 * OutlineBar (v1.75) — Final Draft's Outline Editor, adapted.
 * (Reference: finaldraft.com/blog/how-to-use-final-draft-the-outline-editor)
 *
 * A horizontal band directly under the toolbar (View > Outline Bar), made of
 * lanes:
 *   Outline 1 ┐ beat markers placed by PAGE, spanning a page range —
 *   Outline 2 ┘ drag to move, drag up/down to change lanes, drag the right
 *              edge to resize (snap: eighth of a page, FD's granularity)
 *   Scenes    — the script's actual scene headings, in order; click to jump.
 *
 * ONE SOURCE OF TRUTH: the markers ARE the beats of the Outline tool
 * (editorStore.beats — same objects the board renders). Placing a beat here
 * adds outlineLane/outlinePage/outlineSpan to it; its title and color stay
 * linked both ways, and removing it from a lane never deletes it from the
 * board. "Send to Script" emits each beat as a section line (`# ...`) — the
 * app's non-printing outline element, excluded from print/export like all
 * working notes.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { useEditorStore, type BeatInfo } from '../stores/editorStore';
import { showToast } from './Toast';

const SNAP = 0.125;               // FD: an eighth of a page
const DEFAULT_SPAN = 0.5;         // FD: beats default to half a page

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

interface SceneEntry { text: string; pos: number }

function collectScenes(editor: Editor | null): SceneEntry[] {
  if (!editor || editor.isDestroyed) return [];
  const scenes: SceneEntry[] = [];
  editor.state.doc.forEach((node, pos) => {
    if (node.type.name === 'sceneHeading' && node.textContent.trim()) {
      scenes.push({ text: node.textContent.trim(), pos });
    }
  });
  return scenes;
}

export default function OutlineBar({ editor }: { editor: Editor | null }) {
  const beats = useEditorStore((s) => s.beats);
  const beatColumns = useEditorStore((s) => s.beatColumns);
  const updateBeat = useEditorStore((s) => s.updateBeat);
  const addBeat = useEditorStore((s) => s.addBeat);
  const pageCount = useEditorStore((s) => s.pageCount);
  const setOutlineBarOpen = useEditorStore((s) => s.setOutlineBarOpen);
  const totalPages = Math.max(1, pageCount);

  const laneRef = useRef<HTMLDivElement>(null);
  const [scenes, setScenes] = useState<SceneEntry[]>(() => collectScenes(editor));

  // Scene lane follows the script (debounced — headings don't change often).
  useEffect(() => {
    if (!editor) return;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => { clearTimeout(timer); timer = setTimeout(() => setScenes(collectScenes(editor)), 400); };
    refresh();
    editor.on('update', refresh);
    return () => { clearTimeout(timer); editor.off('update', refresh); };
  }, [editor]);

  const placed = useMemo(
    () => beats.filter((b) => b.outlineLane === 0 || b.outlineLane === 1),
    [beats],
  );
  const unplaced = useMemo(
    () => beats.filter((b) => b.outlineLane !== 0 && b.outlineLane !== 1),
    [beats],
  );

  /* ── dragging: move (and switch lanes) or resize, plain pointer events ── */
  const dragRef = useRef<{
    id: string; mode: 'move' | 'resize';
    startX: number; startY: number;
    startPage: number; startSpan: number; startLane: 0 | 1;
  } | null>(null);

  const pxPerPage = () => {
    const w = laneRef.current?.clientWidth || 1;
    return w / totalPages;
  };

  const onPointerDown = (e: React.PointerEvent, beat: BeatInfo, mode: 'move' | 'resize') => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = {
      id: beat.id, mode,
      startX: e.clientX, startY: e.clientY,
      startPage: beat.outlinePage ?? 1,
      startSpan: beat.outlineSpan ?? DEFAULT_SPAN,
      startLane: (beat.outlineLane ?? 0) as 0 | 1,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dPages = (e.clientX - d.startX) / pxPerPage();
    if (d.mode === 'move') {
      const page = snapPage(d.startPage + dPages, d.startSpan, totalPages);
      // Crossing more than half a lane's height vertically switches lanes.
      const laneH = (laneRef.current?.clientHeight || 28);
      const dLanes = Math.round((e.clientY - d.startY) / laneH);
      const lane = Math.min(1, Math.max(0, d.startLane + dLanes)) as 0 | 1;
      updateBeat(d.id, { outlinePage: page, outlineLane: lane });
    } else {
      const span = Math.max(SNAP, Math.round((d.startSpan + dPages) / SNAP) * SNAP);
      updateBeat(d.id, { outlineSpan: Math.min(span, totalPages) });
    }
  };

  const onPointerUp = () => { dragRef.current = null; };

  /* ── actions ── */
  const placeAtEnd = useCallback((id: string) => {
    const lanePages = placed.filter((b) => b.outlineLane === 0).map((b) => (b.outlinePage ?? 1) + (b.outlineSpan ?? DEFAULT_SPAN));
    const page = snapPage(lanePages.length ? Math.max(...lanePages) : 1, DEFAULT_SPAN, totalPages);
    updateBeat(id, { outlineLane: 0, outlinePage: page, outlineSpan: DEFAULT_SPAN });
  }, [placed, totalPages, updateBeat]);

  const newBeat = () => {
    const col = beatColumns[0]?.id || '';
    const id = addBeat('New Beat', col);
    placeAtEnd(id);
  };

  const sendToScript = () => {
    if (!editor || editor.isDestroyed || placed.length === 0) return;
    const ordered = [...placed].sort((a, b) =>
      (a.outlineLane! - b.outlineLane!) || ((a.outlinePage ?? 0) - (b.outlinePage ?? 0)));
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

  const renderLane = (lane: 0 | 1) => (
    <div className="fs-ob-lane" ref={lane === 0 ? laneRef : undefined}>
      <span className="fs-ob-lane-label">Outline {lane + 1}</span>
      {placed.filter((b) => b.outlineLane === lane).map((b) => {
        const { leftPct, widthPct } = markerGeometry(b.outlinePage ?? 1, b.outlineSpan ?? DEFAULT_SPAN, totalPages);
        return (
          <div
            key={b.id}
            className="fs-ob-beat"
            style={{ left: `${leftPct}%`, width: `${widthPct}%`, background: b.color || undefined }}
            title={`${b.title} — page ${b.outlinePage ?? 1}${b.description ? `\n${b.description}` : ''}`}
            onPointerDown={(e) => onPointerDown(e, b, 'move')}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            <span className="fs-ob-beat-title">{b.title}</span>
            <button
              className="fs-ob-beat-x"
              title="Remove from outline (stays on the Outline board)"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => updateBeat(b.id, { outlineLane: undefined, outlinePage: undefined })}
            >×</button>
            <span
              className="fs-ob-beat-resize"
              title="Drag to change the page span"
              onPointerDown={(e) => onPointerDown(e, b, 'resize')}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            />
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="fs-outline-bar">
      <div className="fs-ob-side">
        <span className="fs-ob-title">Outline</span>
        <button onClick={newBeat} title="New beat, placed at the end of Outline 1">+ Beat</button>
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
        <button onClick={sendToScript} disabled={placed.length === 0} title="Insert each beat into the script as a section line (# …)">
          Send to Script
        </button>
        <button className="fs-ob-close" title="Hide the Outline Bar (View menu brings it back)" onClick={() => setOutlineBarOpen(false)}>×</button>
      </div>
      <div className="fs-ob-lanes">
        {renderLane(0)}
        {renderLane(1)}
        <div className="fs-ob-lane fs-ob-scenes">
          <span className="fs-ob-lane-label">Scenes</span>
          {scenes.length === 0 ? (
            <span className="fs-ob-empty">No scene headings yet</span>
          ) : scenes.map((s, i) => (
            <button
              key={`${s.pos}-${i}`}
              className="fs-ob-scene"
              style={{ width: `${100 / scenes.length}%` }}
              title={s.text}
              onClick={() => jumpToScene(s.pos)}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
