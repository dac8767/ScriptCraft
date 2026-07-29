/**
 * v5.26: the annotation sub-popovers — the current-color swatch, the
 * current-icon swatch, and the ⋮ options menu. All three portal to body at
 * measured top/left (the AddMenu seating rules — never bottom-anchored,
 * clamped into the viewport) and wear `.markup-subpop`, which the
 * annotation popover's save-on-close treats as INSIDE itself.
 *
 * Color: the Theme tool's ColorPicker, plus a Recent row (wheel Applies
 * only — preset clicks don't record; Derek's rule). Icon: the same shape —
 * preset combos, the full icon + emoji grid, a Recent row fed by grid picks.
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@tiptap/react';
import { FaEllipsisV, FaRegTrashAlt } from 'react-icons/fa';
import { useEditorStore } from '../stores/editorStore';
import type { ScriptMarkup } from '../stores/slices/markupsSlice';
import ColorPicker from './ColorPicker';
import { MARKUP_ICONS, MARKUP_EMOJI, MarkupIcon } from './markupIcons';
import { removeMarkupFromDoc } from '../utils/markupActions';

/** Human name for an icon id — '★'-style emoji show themselves. */
export const iconLabel = (k: string) =>
  (k.startsWith('emoji:') ? k.slice(6) : k.charAt(0).toUpperCase() + k.slice(1));

/** Seat a portalled box under (or above) its trigger, clamped on-screen.
 *  (Shared with the panel's Filter / Show in Script popovers.) */
export function useSeat(open: boolean, triggerRef: React.RefObject<HTMLElement | null>, boxRef: React.RefObject<HTMLDivElement | null>) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  useLayoutEffect(() => {
    if (!open) { setPos(null); return; }
    const place = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      const w = boxRef.current?.offsetWidth ?? 260;
      const h = boxRef.current?.offsetHeight ?? 300;
      const top = r.bottom + 4 + h > window.innerHeight ? Math.max(8, r.top - h - 4) : r.bottom + 4;
      setPos({ top, left: Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) });
    };
    place();
    const raf = requestAnimationFrame(place);
    return () => cancelAnimationFrame(raf);
  }, [open, triggerRef, boxRef]);
  return pos;
}

/** Close on outside pointerdown (capture) or Escape. */
export function useDismiss(open: boolean, boxRef: React.RefObject<HTMLDivElement | null>, triggerRef: React.RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (boxRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open, boxRef, triggerRef, close]);
}

/* ── Color swatch → the Theme ColorPicker with a Recent row ─────────────── */

export function MarkupColorSwatch({ value, title, onPick }: {
  value: string;
  title: string;
  onPick: (color: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const recent = useEditorStore((s) => s.markupRecentColors);
  const addRecent = useEditorStore((s) => s.addMarkupRecentColor);
  const pos = useSeat(open, btnRef, boxRef);
  useDismiss(open, boxRef, btnRef, () => setOpen(false));
  return (
    <>
      <button
        ref={btnRef}
        className="markup-swatch markup-swatch-color"
        style={{ background: value }}
        title={title}
        onClick={() => setOpen((v) => !v)}
      />
      {open && createPortal(
        <div ref={boxRef} className="markup-subpop markup-color-pop" style={pos ?? { top: -9999, left: -9999 }}
          onPointerDown={(e) => e.stopPropagation()}>
          <ColorPicker
            value={value}
            recent={recent}
            onChange={(color, source) => {
              if (!color) return;                       // Reset to Default → ignore
              if (source === 'wheel') addRecent(color); // presets/recents don't record
              onPick(color);
            }}
            onClose={() => setOpen(false)}
          />
        </div>,
        document.body,
      )}
    </>
  );
}

/* ── Icon swatch → presets / full grid / Recent row ─────────────────────── */

export function MarkupIconSwatch({ markup }: { markup: ScriptMarkup }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const presets = useEditorStore((s) => s.markupPresets);
  const recent = useEditorStore((s) => s.markupRecentIcons);
  const addRecent = useEditorStore((s) => s.addMarkupRecentIcon);
  const updateMarkup = useEditorStore((s) => s.updateMarkup);
  const pos = useSeat(open, btnRef, boxRef);
  useDismiss(open, boxRef, btnRef, () => setOpen(false));

  // Any pick here is a HAND pick — auto-icon must never override it again.
  const pick = (patch: { icon: string; color?: string }, fromGrid: boolean) => {
    updateMarkup(markup.id, { ...patch, iconManual: true });
    if (fromGrid) addRecent(patch.icon);
    setOpen(false);
  };

  return (
    <>
      <button ref={btnRef} className="markup-swatch markup-swatch-icon" title="Choose an icon" onClick={() => setOpen((v) => !v)}>
        <MarkupIcon icon={markup.icon} color={markup.color} />
      </button>
      {open && createPortal(
        <div ref={boxRef} className="markup-subpop markup-icon-pop" style={pos ?? { top: -9999, left: -9999 }}
          onPointerDown={(e) => e.stopPropagation()}>
          <div className="markup-pop-label">Presets</div>
          <div className="markup-icon-pop-row">
            {presets.map((p, i) => (
              <button
                key={`${p.icon}-${i}`}
                className={`markup-preset${markup.icon === p.icon && markup.color === p.color ? ' active' : ''}`}
                title={iconLabel(p.icon)}
                onClick={() => pick({ icon: p.icon, color: p.color }, false)}
              ><MarkupIcon icon={p.icon} color={p.color} /></button>
            ))}
          </div>
          {recent.length > 0 && (<>
            <div className="markup-pop-label">Recent</div>
            <div className="markup-icon-pop-row">
              {recent.map((k) => (
                <button key={k} className={`markup-preset${markup.icon === k ? ' active' : ''}`} title={iconLabel(k)}
                  onClick={() => pick({ icon: k }, false)}>
                  <MarkupIcon icon={k} color={markup.color} />
                </button>
              ))}
            </div>
          </>)}
          <div className="markup-pop-label">All icons</div>
          <div className="markup-pop-grid">
            {Object.keys(MARKUP_ICONS).map((k) => (
              <button key={k} className={`markup-preset${markup.icon === k ? ' active' : ''}`} title={iconLabel(k)}
                onClick={() => pick({ icon: k }, true)}>
                <MarkupIcon icon={k} color={markup.color} />
              </button>
            ))}
            {MARKUP_EMOJI.map((e) => (
              <button key={e} className={`markup-preset${markup.icon === `emoji:${e}` ? ' active' : ''}`}
                onClick={() => pick({ icon: `emoji:${e}` }, true)}>
                <span className="markup-emoji">{e}</span>
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

/* ── The ⋮ options menu (popover window + side-panel cards) ─────────────── */

export function MarkupDotsMenu({ markup, editor, onDeleted }: {
  markup: ScriptMarkup;
  editor: Editor | null;
  /** the popover closes itself after its own markup is deleted */
  onDeleted?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const hiddenIcons = useEditorStore((s) => s.markupHiddenIcons);
  const pos = useSeat(open, btnRef, boxRef);
  useDismiss(open, boxRef, btnRef, () => setOpen(false));

  const typeHidden = hiddenIcons.includes(markup.icon);
  const setDone = (done: boolean) => {
    useEditorStore.getState().updateMarkup(markup.id, { done });
    setOpen(false);
  };
  const toggleTypeHidden = () => {
    const s = useEditorStore.getState();
    s.setMarkupHiddenIcons(typeHidden
      ? hiddenIcons.filter((i) => i !== markup.icon)
      : [...hiddenIcons, markup.icon]);
    setOpen(false);
  };
  const del = () => {
    const s = useEditorStore.getState();
    if (editor) {
      removeMarkupFromDoc(editor, markup.id);
      editor.emit('update', { editor, transaction: editor.state.tr });
    }
    s.removeMarkup(markup.id);
    setOpen(false);
    onDeleted?.();
  };

  return (
    <>
      <button ref={btnRef} className="markup-dots-btn" title="More options"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        onDoubleClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}>
        <FaEllipsisV />
      </button>
      {open && createPortal(
        <div ref={boxRef} className="markup-subpop markup-dots-pop" style={pos ?? { top: -9999, left: -9999 }}
          onPointerDown={(e) => e.stopPropagation()}>
          {/* v5.27, Derek: Open/Complete side by side as ONE toggle row */}
          <div className="markup-dots-statusrow">
            <span className="markup-dots-label">Status</span>
            <span className="markup-seg">
              <button className={markup.done ? '' : 'active'} onClick={() => setDone(false)}>Open</button>
              <button className={markup.done ? 'active' : ''} onClick={() => setDone(true)}>Complete</button>
            </span>
          </div>
          <div className="markup-dots-sep" />
          <button className="markup-dots-item" onClick={toggleTypeHidden}>
            {typeHidden ? `Show “${iconLabel(markup.icon)}” in script` : `Hide “${iconLabel(markup.icon)}” in script`}
          </button>
          <div className="markup-dots-sep" />
          <button className="markup-dots-item markup-dots-del" onClick={del}>
            <FaRegTrashAlt /> Delete Annotation
          </button>
        </div>,
        document.body,
      )}
    </>
  );
}
