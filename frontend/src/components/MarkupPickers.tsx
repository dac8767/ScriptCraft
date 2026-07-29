/**
 * v5.26: the annotation sub-popovers — the current-color swatch, the
 * current-icon swatch, and the ⋮ options menu. All three portal to body at
 * measured top/left (the AddMenu seating rules — never bottom-anchored,
 * clamped into the viewport) and wear `.markup-subpop`, which the
 * annotation popover's save-on-close treats as INSIDE itself.
 *
 * Color: the Theme tool's ColorPicker, plus a "Used" row — the colors
 * currently on annotations (v5.29; replaced the v5.26 recents). Icon: the
 * same shape — preset combos, a Used row of in-use icon+color combos, the
 * full icon + emoji grid, and Import icon… (v5.29).
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@tiptap/react';
import { FaEllipsisV, FaRegTrashAlt } from 'react-icons/fa';
import { useEditorStore } from '../stores/editorStore';
import type { ScriptMarkup } from '../stores/slices/markupsSlice';
import ColorPicker from './ColorPicker';
import { MARKUP_ICONS, MARKUP_EMOJI, MarkupIcon, isDarkColor } from './markupIcons';
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

/* ── Color swatch → the Theme ColorPicker with a "Used" row ──────────────
   v5.29, Derek: Recent became USED — the colors currently on annotations
   (icon colors for the icon-color picker, highlight colors for the
   highlight picker), presets and customs alike, derived live. */

export function MarkupColorSwatch({ value, title, usedKind, onPick }: {
  value: string;
  title: string;
  /** which in-use colors the "Used" row shows */
  usedKind: 'color' | 'highlight';
  onPick: (color: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const markups = useEditorStore((s) => s.markups);
  const used = React.useMemo(
    () => [...new Set(
      usedKind === 'color'
        ? markups.map((m) => m.color)
        : markups.flatMap((m) => (m.highlight ? [m.highlight] : [])),
    )],
    [markups, usedKind],
  );
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
            used={used}
            onChange={(color) => {
              if (!color) return;                       // Reset to Default → ignore
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

/* ── Icon swatch → presets / Used combos / full grid / import ──────────── */

/** v5.29: imported icons — image files only, downscaled to a 48px PNG data
 *  URL (small enough to persist; crisp at the 22px chip). */
const CUSTOM_ICON_PX = 48;
const CUSTOM_ICON_MAX_FILE = 2 * 1024 * 1024;   // reject absurd uploads early

function importIconFile(file: File, onDone: (dataUrl: string) => void, onErr: (msg: string) => void) {
  if (!file.type.startsWith('image/')) { onErr('That file is not an image.'); return; }
  if (file.size > CUSTOM_ICON_MAX_FILE) { onErr('Image too large — keep it under 2 MB.'); return; }
  const url = URL.createObjectURL(file);
  const img = new window.Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = CUSTOM_ICON_PX;
    canvas.height = CUSTOM_ICON_PX;
    const ctx = canvas.getContext('2d');
    if (!ctx) { URL.revokeObjectURL(url); onErr('Could not read the image.'); return; }
    // contain-fit, centered, transparent padding
    const scale = Math.min(CUSTOM_ICON_PX / img.width, CUSTOM_ICON_PX / img.height);
    const w = img.width * scale, h = img.height * scale;
    ctx.drawImage(img, (CUSTOM_ICON_PX - w) / 2, (CUSTOM_ICON_PX - h) / 2, w, h);
    URL.revokeObjectURL(url);
    onDone(canvas.toDataURL('image/png'));
  };
  img.onerror = () => { URL.revokeObjectURL(url); onErr('Could not read the image.'); };
  img.src = url;
}

export function MarkupIconSwatch({ markup }: { markup: ScriptMarkup }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importErr, setImportErr] = useState<string | null>(null);
  const presets = useEditorStore((s) => s.markupPresets);
  const markups = useEditorStore((s) => s.markups);
  const customIcons = useEditorStore((s) => s.markupCustomIcons);
  const addCustomIcon = useEditorStore((s) => s.addMarkupCustomIcon);
  const updateMarkup = useEditorStore((s) => s.updateMarkup);
  const pos = useSeat(open, btnRef, boxRef);
  useDismiss(open, boxRef, btnRef, () => setOpen(false));

  // v5.29, Derek: "Used" — the icon+color combos currently on annotations,
  // shown in the colors they were used in (presets and customs alike).
  const usedCombos = React.useMemo(() => {
    const seen = new Set<string>();
    const out: { icon: string; color: string }[] = [];
    for (const m of markups) {
      const key = `${m.icon}|${m.color}`;
      if (!seen.has(key)) { seen.add(key); out.push({ icon: m.icon, color: m.color }); }
    }
    return out;
  }, [markups]);

  // A dark icon color vanishes on the dark chrome — those buttons get a
  // light chip behind the glyph (Derek's screenshot: near-black icons).
  const chip = isDarkColor(markup.color) ? ' markup-light-chip' : '';

  // Any pick here is a HAND pick — auto-icon must never override it again.
  const pick = (patch: { icon: string; color?: string }) => {
    updateMarkup(markup.id, { ...patch, iconManual: true });
    setOpen(false);
  };

  const onImportPicked = (file: File | undefined) => {
    if (!file) return;
    setImportErr(null);
    importIconFile(file, (dataUrl) => {
      const id = `ci-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      addCustomIcon({ id, data: dataUrl });
      pick({ icon: `custom:${id}` });
    }, setImportErr);
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
                className={`markup-preset${isDarkColor(p.color) ? ' markup-light-chip' : ''}${markup.icon === p.icon && markup.color === p.color ? ' active' : ''}`}
                title={iconLabel(p.icon)}
                onClick={() => pick({ icon: p.icon, color: p.color })}
              ><MarkupIcon icon={p.icon} color={p.color} /></button>
            ))}
          </div>
          {usedCombos.length > 0 && (<>
            <div className="markup-pop-label">Used</div>
            <div className="markup-icon-pop-row">
              {usedCombos.map(({ icon, color }) => (
                <button
                  key={`${icon}-${color}`}
                  className={`markup-preset${isDarkColor(color) ? ' markup-light-chip' : ''}${markup.icon === icon && markup.color === color ? ' active' : ''}`}
                  title={iconLabel(icon)}
                  onClick={() => pick({ icon, color })}
                ><MarkupIcon icon={icon} color={color} /></button>
              ))}
            </div>
          </>)}
          <div className="markup-pop-label">All icons</div>
          <div className="markup-pop-grid">
            {Object.keys(MARKUP_ICONS).map((k) => (
              <button key={k} className={`markup-preset${chip}${markup.icon === k ? ' active' : ''}`} title={iconLabel(k)}
                onClick={() => pick({ icon: k })}>
                <MarkupIcon icon={k} color={markup.color} />
              </button>
            ))}
            {MARKUP_EMOJI.map((e) => (
              <button key={e} className={`markup-preset${markup.icon === `emoji:${e}` ? ' active' : ''}`}
                onClick={() => pick({ icon: `emoji:${e}` })}>
                <span className="markup-emoji">{e}</span>
              </button>
            ))}
            {customIcons.map((c) => (
              <button key={c.id} className={`markup-preset${markup.icon === `custom:${c.id}` ? ' active' : ''}`}
                title="Imported icon"
                onClick={() => pick({ icon: `custom:${c.id}` })}>
                <MarkupIcon icon={`custom:${c.id}`} />
              </button>
            ))}
          </div>
          {/* v5.29, Derek: bring-your-own icon (image file → 48px chip) */}
          <button className="markup-hl-clear markup-import-icon" onClick={() => fileRef.current?.click()}>
            Import icon…
          </button>
          {importErr && <div className="markup-filter-empty">{importErr}</div>}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => { onImportPicked(e.target.files?.[0]); e.target.value = ''; }}
          />
        </div>,
        document.body,
      )}
    </>
  );
}

/* ── The shared visibility popover (state row + type grid) ───────────────
   v5.28: moved here from MarkupsPanel — the panel's Filter/Show buttons,
   the ribbon's Annotation Visibility button and the View submenu all draw
   on the same shapes (one source, three doors). */

export const DONE_LABELS = { open: 'Open', done: 'Complete', all: 'All' } as const;

/** Annotation types (icons) present in the script, plus any already-hidden
 *  selections — a hidden type must stay listed or it could never come back. */
export function useTypesInUse(extra: string[]) {
  const markups = useEditorStore((s) => s.markups);
  return React.useMemo(
    () => [...new Set([...markups.map((m) => m.icon), ...extra])],
    [markups, extra],
  );
}

export function TypeGridPop({ boxRef, pos, done, onDone, gridHelp, types, hidden, onToggle, onShowAll, onHideAll }: {
  boxRef: React.RefObject<HTMLDivElement | null>;
  pos: { top: number; left: number } | null;
  done: 'open' | 'done' | 'all';
  onDone: (d: 'open' | 'done' | 'all') => void;
  /** helper text over the type grid — the popovers differ here */
  gridHelp: string;
  types: string[];
  hidden: string[];
  onToggle: (icon: string) => void;
  onShowAll: () => void;
  onHideAll: () => void;
}) {
  return createPortal(
    <div ref={boxRef} className="markup-subpop markup-filter-pop" style={pos ?? { top: -9999, left: -9999 }}
      onPointerDown={(e) => e.stopPropagation()}>
      <div className="markup-filter-help">Select one</div>
      {/* v5.27, Derek: the three states side by side as ONE toggle row */}
      <span className="markup-seg markup-filter-seg">
        {(['open', 'done', 'all'] as const).map((d) => (
          <button key={d} className={done === d ? 'active' : ''} onClick={() => onDone(d)}>
            {DONE_LABELS[d]}
          </button>
        ))}
      </span>
      <div className="markup-dots-sep" />
      <div className="markup-filter-help">{gridHelp}</div>
      {types.length === 0 && <div className="markup-filter-empty">No annotations yet.</div>}
      <div className="markup-filter-grid">
        {types.map((icon) => (
          <button
            key={icon}
            className={`markup-preset${hidden.includes(icon) ? '' : ' active'}`}
            title={iconLabel(icon)}
            onClick={() => onToggle(icon)}
          ><MarkupIcon icon={icon} /></button>
        ))}
      </div>
      <div className="markup-filter-allrow">
        <button className="markup-hl-clear" onClick={onShowAll}>Show all</button>
        <button className="markup-hl-clear" onClick={onHideAll}>Hide all</button>
      </div>
    </div>,
    document.body,
  );
}

/** A self-contained trigger + the SCRIPT-visibility popover (status row +
 *  type grid bound to viewPrefs). The panel's "Show" button and the ribbon's
 *  Annotation Visibility button are both this component in different coats. */
export function AnnotationShowMenu({ className, title, children }: {
  className: string;
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const hidden = useEditorStore((s) => s.markupHiddenIcons);
  const setHidden = useEditorStore((s) => s.setMarkupHiddenIcons);
  const done = useEditorStore((s) => s.markupScriptDone);
  const setDone = useEditorStore((s) => s.setMarkupScriptDone);
  const types = useTypesInUse(hidden);
  const pos = useSeat(open, btnRef, boxRef);
  useDismiss(open, boxRef, btnRef, () => setOpen(false));
  return (
    <>
      <button ref={btnRef} className={`${className}${open ? ' open' : ''}`} title={title}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}>
        {children}
      </button>
      {open && (
        <TypeGridPop
          boxRef={boxRef}
          pos={pos}
          done={done}
          onDone={setDone}
          gridHelp="Toggle visibility in script"
          types={types}
          hidden={hidden}
          onToggle={(icon) => setHidden(hidden.includes(icon) ? hidden.filter((x) => x !== icon) : [...hidden, icon])}
          onShowAll={() => setHidden([])}
          onHideAll={() => setHidden(types)}
        />
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
