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
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FullscreenIcon, RestoreIcon, CloseIcon } from './uiIcons';
import { EdgeResizeZones, startEdgeResize, type EdgeZone } from './EdgeResize';

/** The app's BODY area: below the menu bar + ribbon, above the status bar.
 *  Falls back to the whole viewport if that chrome isn't mounted. */
function measureAppBody(): { top: number; height: number } {
  let top = 0;
  for (const sel of ['.menu-bar', '.toolbar']) {
    for (const el of document.querySelectorAll(sel)) {
      const r = (el as HTMLElement).getBoundingClientRect();
      if (r.height > 0) top = Math.max(top, r.bottom);
    }
  }
  const status = document.querySelector('.status-bar') as HTMLElement | null;
  const sr = status?.getBoundingClientRect();
  const bottom = sr && sr.height > 0 ? sr.top : window.innerHeight;
  return { top, height: Math.max(200, bottom - top) };
}

export default function FloatingWindow({ title, onClose, className, initial, startFullscreen, min, children }: {
  title: React.ReactNode;
  onClose: () => void;
  /** Extra classes on the panel (for per-window sizing/body CSS). */
  className?: string;
  /** Opening size; the window centers itself in the viewport. */
  initial: { w: number; h: number };
  /** v7.06, Derek: open FULL SCREEN. The header's shrink button still gives a
   *  floating window — this only decides how it opens. */
  startFullscreen?: boolean;
  min?: { w: number; h: number };
  children: React.ReactNode;
}) {
  const [pos, setPos] = useState<{ x: number; y: number }>(() => ({
    x: Math.max(8, Math.round((window.innerWidth - initial.w) / 2)),
    y: Math.max(8, Math.round((window.innerHeight - initial.h) / 2) - 16),
  }));
  const [size, setSize] = useState<{ w: number; h: number }>({ w: initial.w, h: initial.h });
  const [fullscreen, setFullscreen] = useState(Boolean(startFullscreen));
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

  /* v7.06, Derek: "when in full screen, it covers everything below the ribbon
     toolbar: both side panels and the editing area."

     This was left:0 / top:0 / 100vw / 100vh — the WHOLE viewport — which buried
     the menu bar and ribbon and stacked this window's header controls on top of
     the OS traffic lights (his screenshot). It spans the app BODY now, measured
     from the live chrome because the menu bar and ribbon are user-resizable. */
  const [bodyBox, setBodyBox] = useState(measureAppBody);
  useEffect(() => {
    if (!fullscreen) return;
    const remeasure = () => setBodyBox(measureAppBody());
    remeasure();
    window.addEventListener('resize', remeasure);
    /* the ribbon changes height without a window resize (mode switch, its own
       drag-bar), so watch the chrome itself too. */
    const ro = new ResizeObserver(remeasure);
    document.querySelectorAll('.menu-bar, .toolbar, .status-bar').forEach((el) => ro.observe(el));
    return () => { window.removeEventListener('resize', remeasure); ro.disconnect(); };
  }, [fullscreen]);

  const frame = fullscreen
    ? { left: 0, top: bodyBox.top, width: '100vw', height: bodyBox.height }
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
