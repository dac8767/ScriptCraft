/**
 * HelperTextWindow (v6.22) — Derek: "Move the helper text section from the
 * design window into it's own window. add a button for this window under the
 * help > developer menu."
 *
 * v6.38, Derek: "give the helper text window the same format as all other
 * windows (header with full screen button and close button)" — the header
 * now wears the tool-window classes (same look by the same CSS, not a
 * copy), with a working fullscreen toggle. Body, search and rows are
 * unchanged (HelperTextSection). Opens from Help ▸ Developer ▸ Helper
 * Text… (store flag helperTextWindowOpen — session state, like a dialog).
 */
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LuSearch, LuMaximize, LuMinimize } from 'react-icons/lu';
import { useEditorStore } from '../stores/editorStore';
import { HelperTextSection, filterHelperCatalog } from './HelperTextSection';
import { EdgeResizeZones, startEdgeResize, type EdgeZone } from './EdgeResize';

export default function HelperTextWindow() {
  const open = useEditorStore((s) => s.helperTextWindowOpen);
  const setOpen = useEditorStore((s) => s.setHelperTextWindowOpen);
  const editedCount = useEditorStore((s) => Object.keys(s.helperTextOverrides).length);

  const [pos, setPos] = useState<{ x: number; y: number }>(
    () => ({ x: Math.max(8, window.innerWidth / 2 - 210), y: 72 }),
  );
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 420, h: 620 });
  const [fullscreen, setFullscreen] = useState(false);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const [query, setQuery] = useState('');

  if (!open) return null;

  const startDrag = (e: React.PointerEvent) => {
    if (fullscreen) return;
    if ((e.target as HTMLElement).closest('button, input')) return;
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
    min: { w: 320, h: 280 },
    apply: (g) => { setPos({ x: g.left, y: g.top }); setSize({ w: g.w, h: g.h }); },
  });

  const q = query.trim().toLowerCase();
  const entries = filterHelperCatalog(q);

  const frame = fullscreen
    ? { left: 0, top: 0, width: '100vw', height: '100vh' }
    : { left: pos.x, top: pos.y, width: size.w, height: size.h };

  return createPortal(
    <div className={`dz-panel htw-panel${fullscreen ? ' htw-fullscreen' : ''}`} style={frame}>
      <div className="tool-window-header htw-header" onPointerDown={startDrag}>
        <span className="tool-header-title">
          <span className="tool-window-title">Helper Text</span>
          {editedCount > 0 && <span className="dz-count">{editedCount} changed</span>}
        </span>
        <span className="htw-header-right">
          <button
            className="tool-window-close htw-fsbtn"
            title={fullscreen ? 'Exit full screen' : 'Full screen'}
            onClick={() => setFullscreen((v) => !v)}
          >{fullscreen ? <LuMinimize /> : <LuMaximize />}</button>
          <button className="tool-window-close" title="Close" onClick={() => setOpen(false)}>&times;</button>
        </span>
      </div>

      <div className="dz-search">
        <LuSearch className="dz-search-icon" />
        <input
          className="dz-search-input"
          placeholder="Search helper text…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="dz-body">
        <HelperTextSection entries={entries} />
      </div>

      {/* any edge/corner resizes — the same shared zones as Design */}
      {!fullscreen && <EdgeResizeZones onStart={beginEdge} />}
    </div>,
    document.body,
  );
}
