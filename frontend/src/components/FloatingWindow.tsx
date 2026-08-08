/**
 * FloatingWindow (v6.42) — THE shared floating-window shell.
 *
 * Extracted verbatim from HelperTextWindow's v6.38 chrome the moment a second
 * window (Settings) needed it — one shell, not a fork (the StickyCard rule).
 * Provides: the standard tool-window header (drag to move, fullscreen and
 * close buttons), any-edge resizing (EdgeResizeZones, shared with Design),
 * and the dz-panel visual shell. The caller owns open/close state and the
 * body; `title` renders inside the standard tool-header-title span.
 */
import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FullscreenIcon, RestoreIcon, CloseIcon } from './uiIcons';
import { EdgeResizeZones, startEdgeResize, type EdgeZone } from './EdgeResize';

export default function FloatingWindow({ title, onClose, className, initial, min, children }: {
  title: React.ReactNode;
  onClose: () => void;
  /** Extra classes on the panel (for per-window sizing/body CSS). */
  className?: string;
  /** Opening size; the window centers itself in the viewport. */
  initial: { w: number; h: number };
  min?: { w: number; h: number };
  children: React.ReactNode;
}) {
  const [pos, setPos] = useState<{ x: number; y: number }>(() => ({
    x: Math.max(8, Math.round((window.innerWidth - initial.w) / 2)),
    y: Math.max(8, Math.round((window.innerHeight - initial.h) / 2) - 16),
  }));
  const [size, setSize] = useState<{ w: number; h: number }>({ w: initial.w, h: initial.h });
  const [fullscreen, setFullscreen] = useState(false);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  const startDrag = (e: React.PointerEvent) => {
    if (fullscreen) return;
    if ((e.target as HTMLElement).closest('button, input, select, textarea')) return;
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    const move = (ev: PointerEvent) => {
      if (!drag.current) return;
      setPos({
        x: Math.min(window.innerWidth - 80, Math.max(0, ev.clientX - drag.current.dx)),
        y: Math.min(window.innerHeight - 40, Math.max(0, ev.clientY - drag.current.dy)),
      });
    };
    const up = () => {
      drag.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const beginEdge = (zone: EdgeZone, e: React.PointerEvent) => startEdgeResize(e, zone, {
    rect: () => ({ left: pos.x, top: pos.y, w: size.w, h: size.h }),
    min: min ?? { w: 320, h: 280 },
    apply: (g) => { setPos({ x: g.left, y: g.top }); setSize({ w: g.w, h: g.h }); },
  });

  const frame = fullscreen
    ? { left: 0, top: 0, width: '100vw', height: '100vh' }
    : { left: pos.x, top: pos.y, width: size.w, height: size.h };

  return createPortal(
    <div className={`dz-panel htw-panel${fullscreen ? ' htw-fullscreen' : ''}${className ? ` ${className}` : ''}`} style={frame}>
      <div className="tool-window-header htw-header" onPointerDown={startDrag}>
        <span className="tool-header-title">{title}</span>
        {/* v6.43, Derek: the SAME buttons as every tool window — the
            FullscreenIcon/RestoreIcon/CloseIcon SVG family and the standard
            classes, not lookalike glyphs (his screenshot caught the drift). */}
        <span className="tool-chrome-actions htw-header-right">
          <button
            className="char-profiles-fullscreen-btn htw-fsbtn"
            title={fullscreen ? 'Shrink to a floating window' : 'Fullscreen'}
            onClick={() => setFullscreen((v) => !v)}
          >{fullscreen ? <RestoreIcon /> : <FullscreenIcon />}</button>
          <button className="tool-window-close" title="Close" onClick={onClose}><CloseIcon /></button>
        </span>
      </div>
      {children}
      {!fullscreen && <EdgeResizeZones onStart={beginEdge} />}
    </div>,
    document.body,
  );
}
