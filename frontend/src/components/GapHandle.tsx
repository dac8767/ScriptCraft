/**
 * GapHandle (v2.29) — the faint drag grip on the chrome bars.
 *
 * One sits at the right end of the menu bar, one at the right end of the
 * toolbar, one to the LEFT of the Big Button section. Invisible until the
 * bar is hovered (CSS), it drags horizontally to adjust that bar's item
 * spacing (flex gap) — chromeGapPx in the store, persisted view state.
 */
import React, { useRef } from 'react';
import { useEditorStore } from '../stores/editorStore';

const GapHandle: React.FC<{ bar: 'menu' | 'toolbar' | 'bigbtn' }> = ({ bar }) => {
  const setChromeGap = useEditorStore((s) => s.setChromeGap);
  const locked = useEditorStore((s) => s.uiResizeLocked);
  const drag = useRef<{ x: number; gap: number; gaps: number } | null>(null);

  // v2.55: the sizing lock hides every grip — no dead controls.
  if (locked) return null;

  return (
    <span
      className="fs-gap-handle"
      title="Drag to adjust the spacing between items"
      onPointerDown={(e) => {
        e.preventDefault(); e.stopPropagation();
        const el = e.currentTarget as HTMLElement;
        el.setPointerCapture?.(e.pointerId);
        // v2.40, Derek: the grip must track the mouse 1:1. Each pixel of
        // gap moves the grip by ONE PIXEL PER GAP between it and the bar's
        // edge, so divide the mouse delta by how many gaps it rides on.
        let gaps = 1;
        const parent = el.parentElement;
        if (parent) {
          const kids = Array.from(parent.children);
          const idx = kids.indexOf(el);
          gaps = Math.max(1, Math.max(idx, kids.length - 1 - idx));
        }
        drag.current = { x: e.clientX, gap: useEditorStore.getState().chromeGapPx[bar], gaps };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        setChromeGap(bar, d.gap + (e.clientX - d.x) / d.gaps);
      }}
      onPointerUp={() => { drag.current = null; }}
    >
      <span className="fs-gap-handle-bar" />
    </span>
  );
};

export default GapHandle;
