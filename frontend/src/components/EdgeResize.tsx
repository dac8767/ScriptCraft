/**
 * v5.46, Derek: "make all window sizes adjustable by dragging any side of
 * the window (left, right, top, bottom, and corners); remove the hash
 * adjust icon in the bottom right corner."
 *
 * ONE edge-resize primitive for every window kind — the floating tool
 * frame, the Design window and the annotation window all render the same
 * eight invisible zones and share the same pointer math. Each window keeps
 * its own geometry model: it supplies rect() (where am I now), apply()
 * (paint a new box mid-drag) and commit() (persist on release). Dragging
 * the west/north edges moves that edge and pins the opposite one — the
 * left/top in the geometry passed to apply() already accounts for it.
 */
import React from 'react';

export type EdgeZone = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
export const EDGE_ZONES: EdgeZone[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

export interface EdgeGeom { left: number; top: number; w: number; h: number }

export function startEdgeResize(
  e: React.PointerEvent,
  zone: EdgeZone,
  opts: {
    rect: () => EdgeGeom;
    min: { w: number; h: number };
    apply: (g: EdgeGeom) => void;
    commit?: (g: EdgeGeom) => void;
  },
): void {
  e.preventDefault();
  e.stopPropagation();
  const start = opts.rect();
  const sx = e.clientX;
  const sy = e.clientY;
  const north = zone.includes('n');
  const south = zone.includes('s');
  const east = zone.includes('e');
  const west = zone.includes('w');
  let g: EdgeGeom = { ...start };
  const onMove = (ev: PointerEvent) => {
    const dx = ev.clientX - sx;
    const dy = ev.clientY - sy;
    let w = start.w;
    let h = start.h;
    let left = start.left;
    let top = start.top;
    if (east) w = Math.max(opts.min.w, start.w + dx);
    if (west) { w = Math.max(opts.min.w, start.w - dx); left = start.left + (start.w - w); }
    if (south) h = Math.max(opts.min.h, start.h + dy);
    if (north) { h = Math.max(opts.min.h, start.h - dy); top = start.top + (start.h - h); }
    g = { left, top, w, h };
    opts.apply(g);
  };
  const onUp = () => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    opts.commit?.(g);
  };
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
}

/** The eight invisible hit zones. Render inside a positioned window root;
 *  styles live in 20-tool-dock.css (.fs-edge-*). */
export function EdgeResizeZones({ onStart }: {
  onStart: (zone: EdgeZone, e: React.PointerEvent) => void;
}) {
  return (
    <>
      {EDGE_ZONES.map((z) => (
        <div key={z} className={`fs-edge fs-edge-${z}`} onPointerDown={(e) => onStart(z, e)} />
      ))}
    </>
  );
}
