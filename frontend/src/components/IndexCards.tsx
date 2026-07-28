import React, { useCallback, useState, useRef, useEffect, useMemo } from 'react';
import { Editor } from '@tiptap/react';
import { FaUndo, FaRedo } from 'react-icons/fa';
import { ExpandIcon } from './uiIcons';
import { useEditorStore } from '../stores/editorStore';
import { computeSceneLengths } from '../editor/pagination';
import { computeSceneTiming, formatSceneDuration, getTimingColor } from '../utils/scriptTiming';
import { computeSceneFilterDetails, filterSceneIndices, sceneFilterOptions, countActiveSceneFilters } from '../utils/sceneFilters';
import { useSceneReorder, type SceneReorder } from '../utils/useSceneReorder';
import SynopsisModal from './SynopsisModal';

interface IndexCardsProps {
  editor: Editor | null;
  /* v5.04: no scrollContainer — going to a scene is a store request now
     (requestEditorScroll); ScreenplayEditor owns the container. */
}

/** The reorder context bar — Undo / Redo / Cancel / Apply — ONE component for
 *  the card wall and the scene list (do not fork it). v4.35 batch-v9 #2:
 *  filters/search are suspended while reordering (the pending list must hold
 *  every scene — Apply rewrites the whole document order), and when they're
 *  set the bar says so instead of silently ignoring them. */
export function SceneReorderBar({ r }: { r: SceneReorder }) {
  const filters = useEditorStore((s) => s.sceneFilters);
  const search = useEditorStore((s) => s.sceneSearch);
  const narrowed = countActiveSceneFilters(filters) > 0 || !!search;
  return (
    <div className="ic-reorder-bar">
      {narrowed && (
        <span className="ic-reorder-note">showing all scenes while reordering</span>
      )}
      <button
        className="ic-action-btn ic-undo-redo-btn"
        onClick={r.undo}
        disabled={!r.canUndo}
        title="Undo (Ctrl+Z)"
      >
        <FaUndo />
      </button>
      <button
        className="ic-action-btn ic-undo-redo-btn"
        onClick={r.redo}
        disabled={!r.canRedo}
        title="Redo (Ctrl+Shift+Z)"
      >
        <FaRedo />
      </button>
      <button
        className="ic-action-btn"
        onClick={r.cancel}
        title="Cancel reorder"
      >
        Cancel
      </button>
      <button
        className={`ic-action-btn ic-apply-btn${r.hasChanges ? ' active' : ''}`}
        onClick={r.apply}
        title={r.hasChanges ? 'Apply scene reorder to script' : 'No changes to apply'}
        disabled={!r.hasChanges}
      >
        Apply
      </button>
    </div>
  );
}

// v4.24 batch 7: embedded-only — Index Cards is the Scenes tool's Cards view.
// The old standalone overlay (indexCardsOpen gate over the editor) is gone;
// the ScenesTool wrapper decides when this renders.
const IndexCards: React.FC<IndexCardsProps> = ({ editor }) => {
  const { scenes, updateSceneSynopsis, updateSceneColor, pageLayout } = useEditorStore();

  // v4.35 batch-v9 #4: fullscreen is the generic per-tool takeover now.
  const fullscreen = useEditorStore((s) => s.fullscreenTool === 'scenes');
  const setFullscreenTool = useEditorStore((s) => s.setFullscreenTool);

  const requestEditorScroll = useEditorStore((s) => s.requestEditorScroll);
  // v4.35 batch-v9 #2: the deferred-reorder machinery is the shared hook —
  // the same snapshot/undo/apply drives the list view's row drag.
  const reorder = useSceneReorder(editor);
  const { dragMode, displayScenes } = reorder;

  // v4.35 batch-v9 #2: cards obey Filter + Search (same predicate as the
  // list). The store's SceneInfo has heading/synopsis/color; the character/
  // location/prefix/time details come from the shared doc walk.
  const sceneFilters = useEditorStore((s) => s.sceneFilters);
  const sceneSearch = useEditorStore((s) => s.sceneSearch);

  const filterDetails = useMemo(
    () => (editor ? computeSceneFilterDetails(editor.state.doc) : []),
    [editor, scenes],
  );

  const filteredIndices = useMemo(
    () => filterSceneIndices(scenes, filterDetails, sceneFilters, sceneSearch),
    [scenes, filterDetails, sceneFilters, sceneSearch],
  );

  // While reordering, filtering is SUSPENDED and every scene shows — the
  // pending list must be complete (Apply rewrites the whole document order;
  // a filtered apply would eat the hidden scenes). `idx` is the index the
  // card's handlers use: the pending position during reorder (drag/move/
  // badges), the live scene index otherwise (jump, lengths, timings).
  const visibleScenes = useMemo(
    () =>
      dragMode
        ? displayScenes.map((scene, i) => ({ scene, idx: i }))
        : filteredIndices.map((i) => ({ scene: scenes[i], idx: i })),
    [dragMode, displayScenes, filteredIndices, scenes],
  );

  const narrowed = countActiveSceneFilters(sceneFilters) > 0 || !!sceneSearch;

  // v4.35 batch-v9 #2/#3: publish the counts AND the filter option lists while
  // the wall is mounted — the window chrome (SceneTitleExtra fraction, the
  // Filter popover's dropdowns) reads sceneNavData, and in cards view this
  // body is the only one alive to keep it current. Same derivation as the
  // list's (shared sceneFilterOptions), so the two views can't drift.
  const navData = useMemo(
    () => ({
      filtered: filteredIndices.length,
      total: scenes.length,
      ...sceneFilterOptions(filterDetails),
    }),
    [filteredIndices.length, scenes.length, filterDetails],
  );
  useEffect(() => {
    useEditorStore.getState().setSceneNavData(navData);
  }, [navData]);

  // Custom drag state
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [insertIdx, setInsertIdx] = useState<number | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragCardSize, setDragCardSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [dragCardHtml, setDragCardHtml] = useState<string>('');
  const gridRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll refs for drag
  const scrollSpeedRef = useRef(0);
  const scrollRafRef = useRef<number>(0);
  const lastClientPosRef = useRef<{ x: number; y: number } | null>(null);

  // Synopsis modal state
  const [synopsisModal, setSynopsisModal] = useState<{ sceneIdx: number; id: string; heading: string; synopsis: string; color: string } | null>(null);

  const handleSaveSynopsis = useCallback(
    (synopsis: string, color: string, timingOverride?: number | null) => {
      if (!synopsisModal || !editor) return;
      const { sceneIdx, id } = synopsisModal;
      updateSceneSynopsis(id, synopsis);
      updateSceneColor(id, color);
      let currentScene = -1;
      let targetPos = -1;
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'sceneHeading') {
          currentScene++;
          if (currentScene === sceneIdx) { targetPos = pos; return false; }
        }
        return true;
      });
      if (targetPos >= 0) {
        const node = editor.state.doc.nodeAt(targetPos);
        if (node) {
          const { tr } = editor.state;
          const newAttrs = { ...node.attrs, synopsis, sceneColor: color, timingOverride: timingOverride ?? null };
          tr.setNodeMarkup(targetPos, undefined, newAttrs);
          tr.setMeta('addToHistory', false);
          editor.view.dispatch(tr);
        }
      }
    },
    [synopsisModal, editor, updateSceneSynopsis],
  );

  // Scene page lengths and timing
  const sceneLengths = useMemo(() => {
    if (!editor) return [];
    try { return computeSceneLengths(editor.state.doc, pageLayout); } catch { return []; }
  }, [editor, scenes, pageLayout]);

  const sceneTimings = useMemo(() => {
    if (!editor) return [];
    try { return computeSceneTiming(editor.getJSON()).scenes; } catch { return []; }
  }, [editor, scenes]);

  // Update synopsis on the sceneHeading node attribute so it persists in the document
  const updateSynopsisAttr = useCallback(
    (sceneId: string, synopsis: string) => {
      if (!editor) return;
      // Extract 1-based index from scene ID (e.g. "scene-3" → 2)
      const sceneIndex = parseInt(sceneId.replace('scene-', ''), 10) - 1;
      if (isNaN(sceneIndex) || sceneIndex < 0) return;

      let currentScene = -1;
      let targetPos = -1;
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'sceneHeading') {
          currentScene++;
          if (currentScene === sceneIndex) {
            targetPos = pos;
            return false;
          }
        }
        return true;
      });

      if (targetPos >= 0) {
        const node = editor.state.doc.nodeAt(targetPos);
        if (node) {
          const { tr } = editor.state;
          tr.setNodeMarkup(targetPos, undefined, { ...node.attrs, synopsis });
          tr.setMeta('addToHistory', false);
          editor.view.dispatch(tr);
        }
      }
    },
    [editor],
  );

  const goToScene = useCallback(
    (sceneIndex: number) => {
      if (!editor) return;
      const { doc } = editor.state;
      let currentScene = -1;
      let targetPos = 0;

      doc.descendants((node, pos) => {
        if (node.type.name === 'sceneHeading') {
          currentScene++;
          if (currentScene === sceneIndex) {
            targetPos = pos;
            return false;
          }
        }
        return true;
      });

      /* v4.32 batch-v8 #2: exit the takeover BEFORE focusing — while it is up
         the editor surface (and the scroll container) is unmounted.
         v5.04: and then ASK for the scroll instead of doing it. Lowering the
         takeover unmounts this very component, so the two rAFs that used to
         live here ran against a stale null container and quietly did nothing.
         ScreenplayEditor owns the editor and the container and always lives —
         it carries the request out. Same channel as the Scenes list; there is
         no second copy of this any more. */
      if (fullscreen) setFullscreenTool(null);
      requestEditorScroll(targetPos + 1);
    },
    [editor, fullscreen, setFullscreenTool, requestEditorScroll],
  );

  // ── Compute insertion index from mouse position ──

  const calcInsertIndex = useCallback(
    (clientX: number, clientY: number): number | null => {
      if (!gridRef.current) return null;
      const cards = gridRef.current.querySelectorAll('.index-card');
      if (cards.length === 0) return null;

      const rects: DOMRect[] = [];
      cards.forEach((card) => rects.push(card.getBoundingClientRect()));

      // Group cards into rows (cards whose tops are within half a card height)
      const rows: Array<{ indices: number[]; top: number; bottom: number }> = [];
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i];
        const lastRow = rows[rows.length - 1];
        if (lastRow && Math.abs(r.top - rects[lastRow.indices[0]].top) < r.height / 2) {
          lastRow.indices.push(i);
          lastRow.bottom = Math.max(lastRow.bottom, r.bottom);
        } else {
          rows.push({ indices: [i], top: r.top, bottom: r.bottom });
        }
      }

      // Find which row the cursor is on
      let rowIdx = rows.length - 1; // default to last row
      if (clientY < rows[0].top) {
        rowIdx = 0;
      } else {
        for (let r = 0; r < rows.length; r++) {
          const midBottom = r + 1 < rows.length
            ? (rows[r].bottom + rows[r + 1].top) / 2
            : Infinity;
          if (clientY < midBottom) {
            rowIdx = r;
            break;
          }
        }
      }

      const row = rows[rowIdx];
      const rowCardIndices = row.indices;

      // If cursor is past the right edge of the last card in this row, insert after it
      const lastInRow = rects[rowCardIndices[rowCardIndices.length - 1]];
      if (clientX > lastInRow.right) {
        return rowCardIndices[rowCardIndices.length - 1] + 1;
      }

      // If cursor is before the left edge of the first card in this row, insert before it
      const firstInRow = rects[rowCardIndices[0]];
      if (clientX < firstInRow.left) {
        return rowCardIndices[0];
      }

      // Find the closest gap within this row
      for (let i = 0; i < rowCardIndices.length; i++) {
        const cardIdx = rowCardIndices[i];
        const r = rects[cardIdx];
        const cardCenter = r.left + r.width / 2;
        if (clientX < cardCenter) {
          return cardIdx; // insert before this card
        }
      }

      // Past the center of the last card in row — insert after it
      return rowCardIndices[rowCardIndices.length - 1] + 1;
    },
    [],
  );

  // ── Mouse handlers for custom drag ──
  // Use refs so pointer event listeners always call the latest function versions
  const calcInsertIndexRef = useRef(calcInsertIndex);
  calcInsertIndexRef.current = calcInsertIndex;
  const moveRef = useRef(reorder.move);
  moveRef.current = reorder.move;
  const pendingCountRef = useRef(0);
  pendingCountRef.current = reorder.pending?.length ?? 0;

  const handleDragHandleDown = useCallback(
    (e: React.PointerEvent, index: number) => {
      e.preventDefault();
      e.stopPropagation();

      const handle = e.currentTarget as HTMLElement;
      handle.setPointerCapture(e.pointerId);

      // Capture the card element's position and visual clone
      const card = handle.closest('.index-card') as HTMLElement | null;
      if (card) {
        const rect = card.getBoundingClientRect();
        setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        setDragCardSize({ w: rect.width, h: rect.height });
        setDragCardHtml(card.innerHTML);
      }

      setDragIdx(index);
      setDragPos({ x: e.clientX, y: e.clientY });
      setInsertIdx(null);
      scrollSpeedRef.current = 0;
      lastClientPosRef.current = { x: e.clientX, y: e.clientY };

      // Auto-scroll loop: runs every frame while dragging, applies current speed
      const scrollLoop = () => {
        const container = containerRef.current;
        if (container && scrollSpeedRef.current !== 0) {
          container.scrollTop += scrollSpeedRef.current;
          // Recalculate insert index since visible cards shifted
          if (lastClientPosRef.current) {
            const gap = calcInsertIndexRef.current(lastClientPosRef.current.x, lastClientPosRef.current.y);
            setInsertIdx(gap);
          }
        }
        scrollRafRef.current = requestAnimationFrame(scrollLoop);
      };
      scrollRafRef.current = requestAnimationFrame(scrollLoop);

      const cleanup = () => {
        handle.removeEventListener('pointermove', handleMove);
        handle.removeEventListener('pointerup', handleUp);
        handle.removeEventListener('pointercancel', handleUp);
        handle.releasePointerCapture(e.pointerId);
        cancelAnimationFrame(scrollRafRef.current);
        scrollSpeedRef.current = 0;
        lastClientPosRef.current = null;
        document.body.style.cursor = '';
        setDragIdx(null);
        setInsertIdx(null);
        setDragPos(null);
      };

      const handleMove = (ev: PointerEvent) => {
        ev.preventDefault();
        setDragPos({ x: ev.clientX, y: ev.clientY });
        lastClientPosRef.current = { x: ev.clientX, y: ev.clientY };
        const gap = calcInsertIndexRef.current(ev.clientX, ev.clientY);
        setInsertIdx(gap);

        // Compute auto-scroll speed based on proximity to container edges
        const container = containerRef.current;
        if (container) {
          const rect = container.getBoundingClientRect();
          const EDGE = 60; // px from edge to trigger
          const MAX = 12;  // max px per frame
          if (ev.clientY < rect.top + EDGE) {
            const t = 1 - Math.max(0, ev.clientY - rect.top) / EDGE;
            scrollSpeedRef.current = -(t * MAX);
          } else if (ev.clientY > rect.bottom - EDGE) {
            const t = 1 - Math.max(0, rect.bottom - ev.clientY) / EDGE;
            scrollSpeedRef.current = t * MAX;
          } else {
            scrollSpeedRef.current = 0;
          }
        }
      };

      const handleUp = (ev: PointerEvent) => {
        const gap = calcInsertIndexRef.current(ev.clientX, ev.clientY);
        cleanup();

        const total = pendingCountRef.current;
        if (gap !== null && total > 0) {
          let toIndex = gap;
          if (index < gap && gap <= total - 1) toIndex--;
          // Reorder the pending order locally — no editor changes yet
          if (toIndex !== index) moveRef.current(index, toIndex);
        }
      };

      document.body.style.cursor = 'grabbing';
      handle.addEventListener('pointermove', handleMove);
      handle.addEventListener('pointerup', handleUp);
      handle.addEventListener('pointercancel', handleUp);
    },
    [],
  );

  // ── Compute indicator position ──

  const getIndicatorStyle = useCallback((): React.CSSProperties | null => {
    if (dragIdx === null || insertIdx === null || !gridRef.current) return null;
    const totalScenes = pendingCountRef.current;
    const effectiveTo = (dragIdx < insertIdx && insertIdx <= totalScenes - 1)
      ? insertIdx - 1
      : insertIdx;
    if (effectiveTo === dragIdx) return null;

    const cards = gridRef.current.querySelectorAll('.index-card');
    if (cards.length === 0) return null;

    const gridRect = gridRef.current.getBoundingClientRect();
    const rects: DOMRect[] = [];
    cards.forEach((card) => rects.push(card.getBoundingClientRect()));

    let x: number, y: number, height: number;

    if (insertIdx === 0) {
      x = rects[0].left - gridRect.left - 3;
      y = rects[0].top - gridRect.top;
      height = rects[0].height;
    } else if (insertIdx >= rects.length) {
      x = rects[rects.length - 1].right - gridRect.left;
      y = rects[rects.length - 1].top - gridRect.top;
      height = rects[rects.length - 1].height;
    } else {
      const prev = rects[insertIdx - 1];
      const curr = rects[insertIdx];
      if (Math.abs(prev.top - curr.top) < prev.height / 2) {
        // Same row
        x = (prev.right + curr.left) / 2 - gridRect.left - 1;
        y = curr.top - gridRect.top;
        height = curr.height;
      } else {
        // Different rows — show at left edge of current card
        x = curr.left - gridRect.left - 3;
        y = curr.top - gridRect.top;
        height = curr.height;
      }
    }

    return {
      position: 'absolute',
      left: x,
      top: y,
      width: 3,
      height,
      pointerEvents: 'none' as const,
      zIndex: 50,
    };
  }, [dragIdx, insertIdx]);

  const containerClass = 'index-cards';
  const indicatorStyle = getIndicatorStyle();

  return (
    <div className={containerClass} ref={containerRef}>
      {/* v4.32 batch-v8 #10: the count/actions header row is gone — the
          window title carries the count, Reorder lives in the row-2 cluster
          and fullscreen in row 1. Only the reorder CONTEXT bar remains,
          shown while a reorder is in progress. */}
      {dragMode && <SceneReorderBar r={reorder} />}
      <div className="index-cards-grid" ref={gridRef} style={{ position: 'relative' }}>
        {visibleScenes.length === 0 ? (
          <div className="index-cards-empty">
            {narrowed
              ? 'No scenes match the current filters.'
              : 'No scenes yet. Write a scene heading to see index cards here.'}
          </div>
        ) : (
          <>
            {visibleScenes.map(({ scene, idx }) => {
              const origNum = reorder.originalIndexOf(scene.id);
              const newNum = idx + 1;
              const movedUp = dragMode && origNum !== undefined && newNum < origNum;
              const movedDown = dragMode && origNum !== undefined && newNum > origNum;

              return (
                <div
                  key={scene.id}
                  className={
                    `index-card` +
                    (dragMode ? ' ic-draggable' : '') +
                    (dragIdx === idx ? ' ic-dragging' : '') +
                    (movedUp ? ' ic-moved-up' : '') +
                    (movedDown ? ' ic-moved-down' : '')
                  }
                >
                  {dragMode && (
                    <div
                      className="ic-drag-handle"
                      title="Drag to reorder"
                      onPointerDown={(e) => handleDragHandleDown(e, idx)}
                    >
                      &#8942;&#8942;
                    </div>
                  )}
                  <div
                    className="index-card-color-strip"
                    style={{ backgroundColor: scene.color || 'var(--fd-text-muted)' }}
                  />
                  <div className="index-card-body">
                    <div className="index-card-top">
                      <span className="index-card-badge" style={scene.color ? { background: scene.color, borderColor: scene.color } : undefined}>
                        {(movedUp || movedDown) ? (
                          <><span className="ic-orig-num">{origNum}</span> → {newNum}</>
                        ) : (
                          scene.sceneNumber ?? newNum
                        )}
                      </span>
                      <div
                        className="index-card-heading"
                        onClick={() => !dragMode && goToScene(idx)}
                        title={dragMode ? undefined : 'Click to navigate to scene'}
                      >
                        {scene.heading}
                      </div>
                      {/* v5.09, Derek: the time estimate ALWAYS shows, 0:00
                          included — same rule the list view got in v5.03. The
                          page count keeps hiding at zero; the meta strip
                          itself no longer vanishes. */}
                      <div className="index-card-meta">
                        {sceneLengths[idx] > 0 && (
                          <span className="ic-meta-item">{Number(sceneLengths[idx].toFixed(1))}p</span>
                        )}
                        <span className="ic-meta-item" style={{ color: getTimingColor(sceneTimings[idx]?.finalSeconds ?? 0) }}>
                          {formatSceneDuration(sceneTimings[idx]?.finalSeconds ?? 0)}
                        </span>
                      </div>
                      {/* v5.04, Derek: the expand button belongs in the card's
                          top-right corner, right of the time estimate — not
                          floating over the synopsis text it was covering. */}
                      <button
                        className="ic-synopsis-expand"
                        onClick={() => setSynopsisModal({ sceneIdx: idx, id: scene.id, heading: scene.heading, synopsis: scene.synopsis, color: scene.color })}
                        title="Expand synopsis"
                        disabled={dragMode}
                      >
                        <ExpandIcon size={12} />
                      </button>
                    </div>
                    <div className="index-card-synopsis-wrap">
                      <textarea
                        className="index-card-synopsis"
                        value={scene.synopsis}
                        onChange={(e) => {
                          updateSceneSynopsis(scene.id, e.target.value);
                          updateSynopsisAttr(scene.id, e.target.value);
                        }}
                        rows={3}
                        disabled={dragMode}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
            {/* Drop insertion indicator */}
            {indicatorStyle && (
              <div className="ic-insert-indicator" style={indicatorStyle}>
                <div className="ic-insert-indicator-dot" />
              </div>
            )}
          </>
        )}
      </div>

      {/* Synopsis modal */}
      {synopsisModal && (
        <SynopsisModal
          sceneHeading={synopsisModal.heading}
          synopsis={synopsisModal.synopsis}
          sceneColor={synopsisModal.color}
          pageLength={sceneLengths[synopsisModal.sceneIdx]}
          autoTimingSeconds={sceneTimings[synopsisModal.sceneIdx]?.autoEstimateSeconds}
          timingOverride={sceneTimings[synopsisModal.sceneIdx]?.overrideSeconds}
          onSave={handleSaveSynopsis}
          onClose={() => setSynopsisModal(null)}
        />
      )}

      {/* Floating drag overlay — exact clone of the dragged card */}
      {dragIdx !== null && dragPos && dragCardHtml && (
        <div
          className="ic-drag-overlay"
          style={{
            left: dragPos.x - dragOffset.x,
            top: dragPos.y - dragOffset.y,
            width: dragCardSize.w,
            height: dragCardSize.h,
          }}
        >
          <div
            className="index-card ic-overlay-card"
            style={{ width: '100%', height: '100%', margin: 0 }}
            dangerouslySetInnerHTML={{ __html: dragCardHtml }}
          />
        </div>
      )}
    </div>
  );
};

export default IndexCards;
