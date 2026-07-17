/**
 * RibbonEditor (v2.96, Derek) — "make the ribbon a true visual customizer."
 *
 * An editable replica of the ribbon: sections between full-height dividers,
 * one or two rows each, items dragged and dropped exactly where they'll sit.
 * The New Row utility, dropped into a section, splits it into two rows at
 * the drop point (dropping it again moves the split); the × on the split
 * bar merges the rows back. Section dividers carry an × that merges the
 * neighbouring sections; + Section appends an empty one. Items dragged onto
 * the palette leave the ribbon.
 *
 * Every mutation is expressed on the parsed section structure and written
 * back through serializeRibbon — the token sequence in the store stays the
 * single source of truth the real Toolbar renders from.
 *
 * WebKit footgun (CLAUDE.md §4): every dragstart MUST call
 * dataTransfer.setData() or the drag silently never begins in Tauri.
 */
import React, { useState, useRef } from 'react';
import { FaGripLinesVertical, FaLevelDownAlt, FaArrowsAltH } from 'react-icons/fa';
import {
  parseRibbon, serializeRibbon, type RibbonSection,
} from './toolbarBuiltins';
import { tokenIcon, tokenLabel, spacerPx } from './tokenMeta';

type Row = 'top' | 'bottom';
interface DropSpot { sec: number; row: Row; idx: number }

interface Props {
  tokens: string[];
  onChange: (tokens: string[]) => void;
  /** Available (not-placed) items, by category — same data as + Add Item. */
  palette: Array<{ id: string; label: string; options: Array<{ value: string; label: string }> }>;
}

const clone = (secs: RibbonSection[]): RibbonSection[] =>
  secs.map((s) => ({ top: [...s.top], bottom: [...s.bottom], hasBreak: s.hasBreak, breakLine: s.breakLine }));

const EMPTY_SECTION: RibbonSection = { top: [], bottom: [], hasBreak: false, breakLine: false };

const RibbonEditor: React.FC<Props> = ({ tokens, onChange, palette }) => {
  const sections = parseRibbon(tokens);
  const [spot, setSpot] = useState<DropSpot | null>(null);
  const [dragging, setDragging] = useState(false);
  const html5DragLive = useRef(false);
  // The armed pointer fallback's cleanup. Pointer events are SUPPRESSED for
  // the duration of a native HTML5 drag, so the fallback can never clean
  // itself up during one — whoever starts/ends a drag disarms it instead,
  // or a stale fallback wakes after the drop and runs a phantom drag.
  const fallbackCleanup = useRef<(() => void) | null>(null);

  const commit = (secs: RibbonSection[]) => onChange(serializeRibbon(secs));
  const endDrag = () => {
    setSpot(null);
    setDragging(false);
    html5DragLive.current = false;
    fallbackCleanup.current?.();
  };
  /** setSpot only on real change — same-valued updates re-render the whole
   *  editor mid-drag and read as flicker. */
  const moveSpot = (next: DropSpot | null) => {
    setSpot((prev) => (
      prev === next ? prev
        : prev && next && prev.sec === next.sec && prev.row === next.row && prev.idx === next.idx ? prev
          : next
    ));
  };

  const removeEverywhere = (secs: RibbonSection[], tok: string) => {
    for (const s of secs) {
      s.top = s.top.filter((t) => t !== tok);
      s.bottom = s.bottom.filter((t) => t !== tok);
    }
  };

  /* ── drop targeting: hovering a chip picks before/after by midpoint;
        hovering row/section space appends at the end of that row. ── */
  const overChip = (e: React.DragEvent, sec: number, row: Row, idx: number) => {
    e.preventDefault();
    e.stopPropagation();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    moveSpot({ sec, row, idx: idx + (e.clientX > r.left + r.width / 2 ? 1 : 0) });
  };
  const overRow = (e: React.DragEvent, sec: number, row: Row, len: number) => {
    e.preventDefault();
    e.stopPropagation();
    moveSpot({ sec, row, idx: len });
  };

  /** The one drop mutation, shared by the HTML5 path and the pointer
   *  fallback: apply `payload` at `at`. */
  const applyDrop = (payload: string, at: DropSpot | null) => {
    if (!payload || !at) { endDrag(); return; }
    const secs = clone(sections);
    const target = secs[at.sec];
    if (!target) { endDrag(); return; }
    const rowArr = at.row === 'top' ? target.top : target.bottom;
    let idx = Math.min(at.idx, rowArr.length);

    if (payload.startsWith('tok:')) {
      // moving an existing item — removing it first can shift the target
      const tok = payload.slice(4);
      const before = rowArr.indexOf(tok);
      if (before >= 0 && before < idx) idx -= 1;
      removeEverywhere(secs, tok);
      const arr = at.row === 'top' ? target.top : target.bottom;
      arr.splice(Math.min(idx, arr.length), 0, tok);
    } else if (payload === 'util:rowbreak') {
      if (!target.hasBreak) {
        target.bottom = target.top.slice(idx);
        target.top = target.top.slice(0, idx);
        target.hasBreak = true;
      } else if (at.row === 'top') {
        target.bottom = [...target.top.slice(idx), ...target.bottom];
        target.top = target.top.slice(0, idx);
      } else {
        target.top = [...target.top, ...target.bottom.slice(0, idx)];
        target.bottom = target.bottom.slice(idx);
      }
    } else if (payload === 'util:spacer') {
      rowArr.splice(idx, 0, `s:${Date.now()}`);
    } else if (payload === 'util:divider') {
      // a ONE-ROW vertical line inside the row (plain d:, not a section 2!d:)
      rowArr.splice(idx, 0, `d:${Date.now()}`);
    } else if (payload.startsWith('new:')) {
      rowArr.splice(idx, 0, payload.slice(4));
    }
    commit(secs);
    endDrag();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    applyDrop(e.dataTransfer.getData('text/plain'), spot);
  };

  const dragStart = (e: React.DragEvent, payload: string) => {
    e.dataTransfer.setData('text/plain', payload);   // WebKit: mandatory
    e.dataTransfer.effectAllowed = 'move';
    html5DragLive.current = true;
    fallbackCleanup.current?.();   // the native drag owns this gesture
    setDragging(true);
  };

  /** v2.98, Derek's report: in the Mac app (WKWebView) some chips never got
   *  a dragstart at all — HTML5 drag silently refused, while the same chip
   *  dragged fine after being re-added. Belt and braces: if a pointer moves
   *  4px on a chip and NO dragstart has fired, run the drag ourselves —
   *  pointer capture, the same drop-spot math (via data attributes on rows
   *  and chips), the same applyDrop on release. */
  const startPointerFallback = (e: React.PointerEvent, payload: string) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('.ribed-x') || target.closest('.ribed-spacer-grip') || target.closest('input')) return;
    const chip = e.currentTarget as HTMLElement;
    const startX = e.clientX;
    const startY = e.clientY;
    let active = false;
    const spotFromPoint = (x: number, y: number): DropSpot | null => {
      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      const hitChip = el?.closest<HTMLElement>('.ribed-chip');
      if (hitChip?.dataset.sec) {
        const r = hitChip.getBoundingClientRect();
        return {
          sec: Number(hitChip.dataset.sec),
          row: hitChip.dataset.row as Row,
          idx: Number(hitChip.dataset.idx) + (x > r.left + r.width / 2 ? 1 : 0),
        };
      }
      const hitRow = el?.closest<HTMLElement>('.ribed-row');
      if (hitRow?.dataset.sec) {
        return { sec: Number(hitRow.dataset.sec), row: hitRow.dataset.row as Row, idx: Number(hitRow.dataset.len) };
      }
      return null;
    };
    const move = (ev: PointerEvent) => {
      if (!active) {
        // an HTML5 drag took over, or the pointer hasn't traveled yet
        if (html5DragLive.current) { cleanup(); return; }
        if (Math.abs(ev.clientX - startX) < 4 && Math.abs(ev.clientY - startY) < 4) return;
        active = true;
        setDragging(true);
        chip.classList.add('ribed-chip-lifted');
      }
      moveSpot(spotFromPoint(ev.clientX, ev.clientY));
    };
    const up = (ev: PointerEvent) => {
      cleanup();
      if (!active) return;
      const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
      if (payload.startsWith('tok:') && el?.closest('.ribed-palette')) {
        removeToken(payload.slice(4));   // dragging out = remove, same as HTML5
        endDrag();
        return;
      }
      applyDrop(payload, spotFromPoint(ev.clientX, ev.clientY));
    };
    const cleanup = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      chip.classList.remove('ribed-chip-lifted');
      fallbackCleanup.current = null;
    };
    fallbackCleanup.current?.();   // never two armed fallbacks
    fallbackCleanup.current = cleanup;
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  };

  const removeToken = (tok: string) => {
    const secs = clone(sections);
    removeEverywhere(secs, tok);
    commit(secs);
  };

  const setSpacerWidth = (tok: string, px: number) => {
    const [, id] = tok.split(':');
    const next = `s:${id}:${Math.max(8, Math.min(240, Math.round(px)))}`;
    const secs = clone(sections);
    for (const s of secs) {
      s.top = s.top.map((t) => (t === tok ? next : t));
      s.bottom = s.bottom.map((t) => (t === tok ? next : t));
    }
    commit(secs);
  };

  /** v2.97, Derek: spacers resize by dragging their right edge — the chip's
   *  width IS the spacer's width. Pointer-driven (not HTML5 drag), live on
   *  the element, committed to the token on release. */
  const startSpacerResize = (e: React.PointerEvent, tok: string) => {
    e.preventDefault();
    e.stopPropagation();
    const chip = (e.currentTarget as HTMLElement).parentElement as HTMLElement;
    const startX = e.clientX;
    const startW = spacerPx(tok);
    let w = startW;
    const move = (ev: PointerEvent) => {
      w = Math.max(8, Math.min(240, Math.round(startW + (ev.clientX - startX))));
      chip.style.width = `${w}px`;
    };
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      setSpacerWidth(tok, w);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  };

  const dropLine = <span className="ribed-dropline" />;

  const renderChip = (tok: string, sec: number, row: Row, idx: number) => (
    <React.Fragment key={tok}>
      {dragging && spot && spot.sec === sec && spot.row === row && spot.idx === idx && dropLine}
      <span
        className={`ribed-chip${tok.startsWith('s:') ? ' ribed-chip-spacer' : ''}${tok.startsWith('d:') ? ' ribed-chip-div' : ''}`}
        draggable
        title={tokenLabel(tok)}
        style={tok.startsWith('s:') ? { width: spacerPx(tok) } : undefined}
        data-sec={sec}
        data-row={row}
        data-idx={idx}
        onDragStart={(e) => dragStart(e, `tok:${tok}`)}
        onDragEnd={endDrag}
        onDragOver={(e) => overChip(e, sec, row, idx)}
        onPointerDown={(e) => startPointerFallback(e, `tok:${tok}`)}
      >
        {!tok.startsWith('s:') && !tok.startsWith('d:') && (
          <span className="ribed-chip-icon">{tokenIcon(tok)}</span>
        )}
        {tok.startsWith('s:') && (
          <span
            className="ribed-spacer-grip"
            title="Drag to resize the spacer"
            draggable={false}
            onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onPointerDown={(e) => startSpacerResize(e, tok)}
          />
        )}
        <button className="ribed-x" title="Remove" onClick={() => removeToken(tok)}>×</button>
      </span>
    </React.Fragment>
  );

  const renderRow = (s: RibbonSection, sec: number, row: Row) => {
    const items = row === 'top' ? s.top : s.bottom;
    return (
      <div
        className="ribed-row"
        data-sec={sec}
        data-row={row}
        data-len={items.length}
        onDragOver={(e) => overRow(e, sec, row, items.length)}
      >
        {items.map((tok, i) => renderChip(tok, sec, row, i))}
        {dragging && spot && spot.sec === sec && spot.row === row && spot.idx >= items.length && dropLine}
        {items.length === 0 && !dragging && <span className="ribed-empty-hint">drop items here</span>}
      </div>
    );
  };

  /** v2.97, Derek: a section's RIGHT divider is the one associated with it —
   *  closing the section (its × ) merges it into the section that follows. */
  const closeSection = (i: number) => {
    const secs = clone(sections);
    const a = secs[i];
    const b = secs[i + 1];
    const merged: RibbonSection = {
      top: [...a.top, ...b.top],
      bottom: [...a.bottom, ...b.bottom],
      hasBreak: a.hasBreak || b.hasBreak,
      breakLine: a.breakLine || b.breakLine,
    };
    secs.splice(i, 2, merged);
    commit(secs);
  };

  const removeBreak = (i: number) => {
    const secs = clone(sections);
    secs[i] = { top: [...secs[i].top, ...secs[i].bottom], bottom: [], hasBreak: false, breakLine: false };
    commit(secs);
  };

  /** v2.97, Derek: clicking the split line toggles it heavy (drawn on the
   *  real toolbar) or faint (invisible split). */
  const toggleBreakLine = (i: number) => {
    const secs = clone(sections);
    secs[i] = { ...secs[i], breakLine: !secs[i].breakLine };
    commit(secs);
  };

  return (
    <div className="ribed">
      <div className="ribed-ribbon" onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
        {sections.map((s, i) => (
          <React.Fragment key={`sec-${i}`}>
            <div className={`ribed-section${s.hasBreak ? '' : ' ribed-single'}`}>
              {renderRow(s, i, 'top')}
              {s.hasBreak && (
                <div className="ribed-break">
                  <span
                    className={`ribed-break-line${s.breakLine ? ' heavy' : ''}`}
                    title={s.breakLine
                      ? 'Row split line: SHOWN on the toolbar — click to hide it'
                      : 'Row split line: hidden on the toolbar — click to show it'}
                    onClick={() => toggleBreakLine(i)}
                  />
                  <button className="ribed-x" title="Remove the row split (back to one row)" onClick={() => removeBreak(i)}>×</button>
                </div>
              )}
              {s.hasBreak && renderRow(s, i, 'bottom')}
            </div>
            {i < sections.length - 1 && (
              <span className="ribed-secdiv" title="This section's closing divider">
                <button className="ribed-x" title="Close this section (its items join the next one)" onClick={() => closeSection(i)}>×</button>
              </span>
            )}
          </React.Fragment>
        ))}
        {/* v2.97, Derek: the utilities live HERE, beside + Section — the
            structural tools, next to the structure they build. */}
        <div className="ribed-tools">
          <button
            className="ribed-add-section"
            title="Add a new empty section at the end"
            onClick={() => commit([...clone(sections), { ...EMPTY_SECTION }])}
          >+ Section</button>
          <span className="ribed-pal-chip ribed-pal-util" draggable title="Drop into a section to split it into two rows"
            onDragStart={(e) => dragStart(e, 'util:rowbreak')} onDragEnd={endDrag}
            onPointerDown={(e) => startPointerFallback(e, 'util:rowbreak')}>
            <FaLevelDownAlt /> New Row
          </span>
          <span className="ribed-pal-chip ribed-pal-util" draggable title="Drop into a row: a one-row vertical divider line"
            onDragStart={(e) => dragStart(e, 'util:divider')} onDragEnd={endDrag}
            onPointerDown={(e) => startPointerFallback(e, 'util:divider')}>
            <FaGripLinesVertical /> Divider
          </span>
          <span className="ribed-pal-chip ribed-pal-util" draggable title="Drop into a row: blank space — drag its edge to resize"
            onDragStart={(e) => dragStart(e, 'util:spacer')} onDragEnd={endDrag}
            onPointerDown={(e) => startPointerFallback(e, 'util:spacer')}>
            <FaArrowsAltH /> Spacer
          </span>
        </div>
      </div>

      <p className="fs-customize-hint">
        Drag items between the sections above — drop position is the item's
        position. Drag <strong>New Row</strong> into a section to split it
        into two rows at that spot; a section without a split spans its items
        across both rows. Spacers resize by dragging their right edge. Drag
        an item onto the lists below to remove it.
      </p>

      {/* available items; also the drop target for removal */}
      <div
        className="ribed-palette"
        onDragOver={(e) => { e.preventDefault(); setSpot(null); }}
        onDrop={(e) => {
          e.preventDefault();
          const p = e.dataTransfer.getData('text/plain');
          if (p.startsWith('tok:')) removeToken(p.slice(4));
          endDrag();
        }}
      >
        {palette.map((cat) => cat.options.length > 0 && (
          <div key={cat.id} className="ribed-pal-group">
            <div className="ribed-pal-title">{cat.label}</div>
            {cat.options.map((o) => (
              <span
                key={o.value}
                className="ribed-pal-chip"
                draggable
                title={`Drag onto the ribbon: ${o.label}`}
                onDragStart={(e) => dragStart(e, `new:${o.value}`)}
                onDragEnd={endDrag}
                onPointerDown={(e) => startPointerFallback(e, `new:${o.value}`)}
              >
                <span className="ribed-chip-icon">{tokenIcon(o.value)}</span>
                {o.label}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default RibbonEditor;
