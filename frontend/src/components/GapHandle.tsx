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
  const drag = useRef<{ x: number; gap: number } | null>(null);

  return (
    <span
      className="fs-gap-handle"
      title="Drag to adjust the spacing between items"
      onPointerDown={(e) => {
        e.preventDefault(); e.stopPropagation();
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        drag.current = { x: e.clientX, gap: useEditorStore.getState().chromeGapPx[bar] };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        // 4px of mouse per 1px of gap — fine-grained control.
        setChromeGap(bar, d.gap + (e.clientX - d.x) / 4);
      }}
      onPointerUp={() => { drag.current = null; }}
    >
      <span className="fs-gap-handle-bar" />
    </span>
  );
};

export default GapHandle;
