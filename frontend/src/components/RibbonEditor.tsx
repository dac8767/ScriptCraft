/**
 * RibbonEditor (v2.96–v3.02, Derek) — the ribbon's true visual customizer.
 *
 * An editable replica of the ribbon: sections between full-height dividers,
 * one or two rows each, items dragged and dropped exactly where they'll sit.
 * v3.22/v3.24: sections are BLOCKS — drop a Single Row / Two Rows bubble to
 * create one, drag a section's own body to move it. The Align Split utility
 * (v3.02) marks where the toolbar switches from left- to right-aligned. Every section shows its closing divider on the RIGHT —
 * including the last one — and its × folds the section into its neighbour.
 * Items dragged onto the palette leave the ribbon; double-clicking a
 * palette item adds it to the most recently touched section.
 *
 * v3.02: dragging is POINTER-ONLY. HTML5 drag-and-drop in WKWebView kept
 * refusing to start on arbitrary chips (v2.99's report, then again inside
 * one-row sections) — the app's other drags all use pointer events, the
 * mechanism that has never failed here (CLAUDE.md §4 names HTML5 drag as
 * the platform's oldest footgun). One code path, a ghost chip under the
 * cursor, the same drop-spot math for every payload.
 *
 * Every mutation is expressed on the parsed RibbonModel and written back
 * through serializeRibbon — the token sequence in the store stays the
 * single source of truth the real Toolbar renders from.
 */
import React, { useState, useRef } from 'react';
import { FaGripLinesVertical, FaArrowsAltH, FaExchangeAlt } from 'react-icons/fa';
import {
  parseRibbon, serializeRibbon, type RibbonModel, type RibbonSection,
} from './toolbarBuiltins';
import { tokenIcon, tokenLabel, spacerPx } from './tokenMeta';

type Row = 'top' | 'bottom';
interface DropSpot { sec: number; row: Row; idx: number }

interface Props {
  tokens: string[];
  onChange: (tokens: string[]) => void;
  /** Available (not-placed) items, by category — same data as + Add Item. */
  palette: Array<{ id: string; label: string; options: Array<{ value: string; label: string }> }>;
  /** v3.20, Derek: the dialog's Show/Hide/Reset controls render in the same
   *  row as the structural utilities, left of them. */
  headerControls?: React.ReactNode;
}

const clone = (m: RibbonModel): RibbonModel => ({
  sections: m.sections.map((s) => ({ top: [...s.top], bottom: [...s.bottom], hasBreak: s.hasBreak, breakLine: s.breakLine })),
  splitAt: m.splitAt,
});

const EMPTY_SECTION: RibbonSection = { top: [], bottom: [], hasBreak: false, breakLine: false };

const payloadLabel = (payload: string): string => {
  if (payload.startsWith('tok:')) return tokenLabel(payload.slice(4));
  if (payload.startsWith('new:')) return tokenLabel(payload.slice(4));
  if (payload === 'util:rowbreak') return 'New Row';
  if (payload === 'util:divider') return 'Divider';
  if (payload === 'util:spacer') return 'Spacer';
  if (payload === 'util:alignsplit') return 'Align Split';
  if (payload === 'blk:single') return 'Single Row Section';
  if (payload === 'blk:double') return 'Two Row Section';
  if (payload.startsWith('sec:')) return 'Section';
  return '';
};

const RibbonEditor: React.FC<Props> = ({ tokens, onChange, palette, headerControls }) => {
  const model = parseRibbon(tokens);
  const { sections, splitAt } = model;
  const [spot, setSpot] = useState<DropSpot | null>(null);
  const [dragging, setDragging] = useState(false);
  // v3.17/v3.24, Derek: whole SECTIONS reorder — dragged by their own body.
  // This is the insertion boundary (0..sections.length).
  const [secSpot, setSecSpot] = useState<number | null>(null);
  // v3.01: double-clicking a palette item drops it into the most recently
  // added or modified section — every mutation records its target.
  const lastSec = useRef<number | null>(null);
  // v3.11: palette keyword filter. Categories keep their grouping; empty
  // groups drop out while a query is active.
  const [paletteQuery, setPaletteQuery] = useState('');
  const q = paletteQuery.trim().toLowerCase();
  const filteredPalette = q
    ? palette.map((cat) => ({ ...cat, options: cat.options.filter((o) => o.label.toLowerCase().includes(q)) }))
    : palette;

  const commit = (m: RibbonModel, touchedSec?: number) => {
    if (touchedSec !== undefined) lastSec.current = touchedSec;
    onChange(serializeRibbon(m));
  };
  const endDrag = () => { setSpot(null); setSecSpot(null); setDragging(false); };

  /** v3.22, Derek's block model: drop a Single Row / Two Row BLOCK at a
   *  boundary and an empty section of that shape appears there. Dividers
   *  between adjacent sections are automatic (every boundary draws one). */
  const insertSectionAt = (type: 'single' | 'double', at: number) => {
    const m = clone(model);
    m.sections.splice(at, 0, { top: [], bottom: [], hasBreak: type === 'double', breakLine: false });
    if (m.splitAt !== null && at <= m.splitAt) m.splitAt += 1;
    commit(m, at);
    endDrag();
  };

  /** v3.25, Derek: the align split drops at a section BOUNDARY (0..len),
   *  exactly like the section blocks — never inside a section. Dropping it
   *  at the very end grows an empty section so there's something to
   *  right-align into. */
  const setAlignSplit = (at: number) => {
    const m = clone(model);
    // Clamp to ≥1: serializeRibbon only writes boundary tokens after a
    // section, so a split at boundary 0 could never round-trip.
    m.splitAt = Math.max(1, Math.min(at, m.sections.length));
    if (m.splitAt === m.sections.length) m.sections.push({ ...EMPTY_SECTION });
    commit(m, Math.min(m.splitAt, m.sections.length - 1));
    endDrag();
  };

  /** v3.17: move a whole section to insertion boundary `to` (0..len). The
   *  align-split boundary index stays put — the sections shuffle around it. */
  const moveSection = (from: number, to: number) => {
    if (to === from || to === from + 1) { endDrag(); return; }   // same place
    const m = clone(model);
    const [s] = m.sections.splice(from, 1);
    const dest = to > from ? to - 1 : to;
    m.sections.splice(dest, 0, s);
    commit(m, dest);
    endDrag();
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

  const removeEverywhere = (m: RibbonModel, tok: string) => {
    for (const s of m.sections) {
      s.top = s.top.filter((t) => t !== tok);
      s.bottom = s.bottom.filter((t) => t !== tok);
    }
  };

  /** The one drop mutation: apply `payload` at `at`. */
  const applyDrop = (payload: string, at: DropSpot | null) => {
    if (!payload || !at) { endDrag(); return; }
    const m = clone(model);
    const target = m.sections[at.sec];
    if (!target) { endDrag(); return; }
    const rowArr = at.row === 'top' ? target.top : target.bottom;
    let idx = Math.min(at.idx, rowArr.length);

    if (payload.startsWith('tok:')) {
      // moving an existing item — removing it first can shift the target
      const tok = payload.slice(4);
      const before = rowArr.indexOf(tok);
      if (before >= 0 && before < idx) idx -= 1;
      removeEverywhere(m, tok);
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
    commit(m, at.sec);
    endDrag();
  };

  /** v3.01: double-click a palette item → it lands in the most recently
   *  added or modified section (the last one, if none yet). v3.20, Derek:
   *  sections RIGHT of the align split are anchored to the toolbar's right
   *  edge, so they fill right-to-left — new items go at the FRONT, and the
   *  anchor items (e.g. Customize) keep their spot at the edge. */
  const quickAdd = (tok: string) => {
    const m = clone(model);
    const sec = Math.min(lastSec.current ?? m.sections.length - 1, m.sections.length - 1);
    const target = m.sections[sec];
    const row = target.hasBreak ? target.bottom : target.top;
    const rightAligned = m.splitAt !== null && sec >= m.splitAt;
    if (rightAligned) row.unshift(tok);
    else row.push(tok);
    commit(m, sec);
  };

  /* ── v3.02: POINTER drag — the only drag mechanism. A ghost chip follows
        the cursor; the drop spot comes from elementFromPoint against the
        data attributes rows and chips carry. ── */
  const startDrag = (e: React.PointerEvent, payload: string) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('.ribed-x') || target.closest('.ribed-spacer-grip') || target.closest('input')) return;
    e.preventDefault();
    const chip = e.currentTarget as HTMLElement;
    const startX = e.clientX;
    const startY = e.clientY;
    let active = false;
    let ghost: HTMLElement | null = null;

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
      const hitSection = el?.closest<HTMLElement>('.ribed-section');
      if (hitSection?.dataset.sec) {
        return { sec: Number(hitSection.dataset.sec), row: 'top', idx: 9999 };
      }
      return null;
    };

    /** v3.17: a SECTION drag targets a boundary. v3.29, Derek: GEOMETRY, not
     *  hit-testing — the pointer spends half its life over the gaps between
     *  sections (or the drop line itself), and the old "not over a section →
     *  the end" fallback made the indicator leap to the strip's end, so a
     *  middle drop needed the cursor dragged way left. The boundary is
     *  simply how many section midpoints lie left of the cursor. */
    const secSpotFromPoint = (x: number, y: number): number | null => {
      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      if (!el?.closest('.ribed-ribbon')) return null;
      let b = 0;
      for (const s of Array.from(document.querySelectorAll<HTMLElement>('.ribed-ribbon .ribed-section'))) {
        const r = s.getBoundingClientRect();
        if (x > r.left + r.width / 2) b += 1;
      }
      return b;
    };
    /* v3.25, Derek: the align split drops BETWEEN sections, like the section
       blocks — not into a section's item flow. */
    const boundaryDrag = payload.startsWith('sec:') || payload.startsWith('blk:')
      || payload === 'util:alignsplit';

    const move = (ev: PointerEvent) => {
      if (!active) {
        if (Math.abs(ev.clientX - startX) < 4 && Math.abs(ev.clientY - startY) < 4) return;
        active = true;
        setDragging(true);
        chip.classList.add('ribed-chip-lifted');
        ghost = document.createElement('div');
        ghost.className = 'ribed-ghost';
        ghost.textContent = payloadLabel(payload);
        document.body.appendChild(ghost);
      }
      if (ghost) {
        ghost.style.left = `${ev.clientX + 10}px`;
        ghost.style.top = `${ev.clientY + 12}px`;
      }
      const overPalette = (document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null)?.closest('.ribed-palette');
      if (boundaryDrag) {
        setSecSpot(overPalette ? null : secSpotFromPoint(ev.clientX, ev.clientY));
      } else {
        moveSpot(overPalette ? null : spotFromPoint(ev.clientX, ev.clientY));
      }
    };
    const up = (ev: PointerEvent) => {
      cleanup();
      if (!active) return;
      const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
      if (payload.startsWith('tok:') && el?.closest('.ribed-palette')) {
        removeToken(payload.slice(4));   // dragging out = remove
        endDrag();
        return;
      }
      if (boundaryDrag) {
        const to = secSpotFromPoint(ev.clientX, ev.clientY);
        if (to === null) { endDrag(); return; }
        if (payload === 'util:alignsplit') setAlignSplit(to);
        else if (payload.startsWith('blk:')) insertSectionAt(payload.slice(4) as 'single' | 'double', to);
        else moveSection(Number(payload.slice(4)), to);
        return;
      }
      applyDrop(payload, spotFromPoint(ev.clientX, ev.clientY));
    };
    const cleanup = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      chip.classList.remove('ribed-chip-lifted');
      ghost?.remove();
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  };

  const removeToken = (tok: string) => {
    const m = clone(model);
    removeEverywhere(m, tok);
    commit(m);
  };

  const setSpacerWidth = (tok: string, px: number) => {
    const [, id] = tok.split(':');
    const next = `s:${id}:${Math.max(8, Math.min(240, Math.round(px)))}`;
    const m = clone(model);
    for (const s of m.sections) {
      s.top = s.top.map((t) => (t === tok ? next : t));
      s.bottom = s.bottom.map((t) => (t === tok ? next : t));
    }
    commit(m);
  };

  /** v2.97: spacers resize by dragging their right edge — the chip's width
   *  IS the spacer's width. Committed to the token on release. */
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

  /* v3.29, Derek: the editor is WYSIWYG — chips mirror the LIVE ribbon.
     Dropdown builtins render as select-looking fields with their real
     resting text; items in a single-row section render big (large icon,
     name underneath), exactly like the bar. Same drag payloads and data
     attributes throughout — only the chip's face changed. */
  const DROPDOWN_PREVIEW: Record<string, string> = {
    fontFamily: 'Courier Prime', fontSize: '12pt', element: 'Action', view: 'Page', zoom: '100%',
  };
  const renderChip = (tok: string, sec: number, row: Row, idx: number, big = false) => {
    const ddText = tok.startsWith('b:') ? DROPDOWN_PREVIEW[tok.slice(2)] : undefined;
    return (
      <React.Fragment key={tok}>
        {dragging && spot && spot.sec === sec && spot.row === row && spot.idx === idx && dropLine}
        <span
          className={`ribed-chip${tok.startsWith('s:') ? ' ribed-chip-spacer' : ''}${tok.startsWith('d:') ? ' ribed-chip-div' : ''}${ddText ? ' ribed-chip-dd' : ''}${big && !ddText && !tok.startsWith('s:') && !tok.startsWith('d:') ? ' ribed-chip-big' : ''}`}
          title={tokenLabel(tok)}
          style={tok.startsWith('s:') ? { width: spacerPx(tok) } : undefined}
          {...(ddText ? { 'data-dd': tok.slice(2) } : {})}
          data-sec={sec}
          data-row={row}
          data-idx={idx}
          onPointerDown={(e) => startDrag(e, `tok:${tok}`)}
        >
          {ddText ? (
            <>
              <span className="ribed-dd-text">{ddText}</span>
              <span className="ribed-dd-chev" aria-hidden="true" />
            </>
          ) : !tok.startsWith('s:') && !tok.startsWith('d:') && (
            <>
              <span className="ribed-chip-icon">{tokenIcon(tok)}</span>
              {big && <span className="ribed-chip-biglabel">{tokenLabel(tok)}</span>}
            </>
          )}
          {tok.startsWith('s:') && (
            <span
              className="ribed-spacer-grip"
              title="Drag to resize the spacer"
              onPointerDown={(e) => startSpacerResize(e, tok)}
            />
          )}
          <button className="ribed-x" title="Remove" onClick={() => removeToken(tok)}>×</button>
        </span>
      </React.Fragment>
    );
  };

  const renderRow = (s: RibbonSection, sec: number, row: Row) => {
    const items = row === 'top' ? s.top : s.bottom;
    return (
      <div className="ribed-row" data-sec={sec} data-row={row} data-len={items.length}>
        {items.map((tok, i) => renderChip(tok, sec, row, i, !s.hasBreak))}
        {dragging && spot && spot.sec === sec && spot.row === row && spot.idx >= items.length && dropLine}
        {items.length === 0 && !dragging && <span className="ribed-empty-hint">drop items here</span>}
      </div>
    );
  };

  /** Merging two adjacent sections (the divider between them goes away).
   *  A split boundary sitting at or before the merge point shifts with it. */
  const mergeSections = (i: number) => {
    const m = clone(model);
    const a = m.sections[i];
    const b = m.sections[i + 1];
    if (!a || !b) return;
    m.sections.splice(i, 2, {
      top: [...a.top, ...b.top],
      bottom: [...a.bottom, ...b.bottom],
      hasBreak: a.hasBreak || b.hasBreak,
      breakLine: a.breakLine || b.breakLine,
    });
    if (m.splitAt !== null) {
      if (m.splitAt === i + 1) m.splitAt = null;      // the merged boundary WAS the split
      else if (m.splitAt > i + 1) m.splitAt -= 1;
    }
    commit(m, i);
  };

  const removeSplit = () => {
    const m = clone(model);
    m.splitAt = null;   // the boundary becomes a regular divider
    commit(m);
  };

  const removeBreak = (i: number) => {
    const m = clone(model);
    m.sections[i] = { top: [...m.sections[i].top, ...m.sections[i].bottom], bottom: [], hasBreak: false, breakLine: false };
    commit(m, i);
  };

  /** v2.97: clicking the split line toggles it heavy (drawn on the real
   *  toolbar) or faint (invisible split). */
  const toggleBreakLine = (i: number) => {
    const m = clone(model);
    m.sections[i] = { ...m.sections[i], breakLine: !m.sections[i].breakLine };
    commit(m, i);
  };

  return (
    <div className="ribed">
      {/* v3.20, Derek: ONE control row — the dialog's Show/Hide/Reset
          (headerControls) and the structural utilities share it. */}
      <div className="ribed-utilrow">
        {headerControls}
        <span className="ribed-utilrow-spring" />
        <div className="ribed-tools">
          {/* v3.22, Derek's block model: sections are built by dropping one
              of these two BLOCKS onto the strip — a boundary line shows
              where it lands (double-click: append at the end). Dividers
              between adjacent sections are automatic. */}
          <span className="ribed-pal-chip ribed-pal-util ribed-blk" title="Drag onto the ribbon: a new single-row section (double-click: add at the end)"
            onPointerDown={(e) => startDrag(e, 'blk:single')}
            onDoubleClick={() => insertSectionAt('single', sections.length)}>
            <span className="ribed-blk-glyph"><i /></span> Single Row
          </span>
          <span className="ribed-pal-chip ribed-pal-util ribed-blk" title="Drag onto the ribbon: a new two-row section (double-click: add at the end)"
            onPointerDown={(e) => startDrag(e, 'blk:double')}
            onDoubleClick={() => insertSectionAt('double', sections.length)}>
            <span className="ribed-blk-glyph"><i /><i /></span> Two Rows
          </span>
          <span className="ribed-pal-chip ribed-pal-util" title="Drag into a row: a one-row vertical divider line (double-click: add to the last-touched section)"
            onPointerDown={(e) => startDrag(e, 'util:divider')}
            onDoubleClick={() => quickAdd(`d:${Date.now()}`)}>
            <FaGripLinesVertical /> Divider
          </span>
          <span className="ribed-pal-chip ribed-pal-util" title="Drag into a row: blank space — drag its edge to resize (double-click: add to the last-touched section)"
            onPointerDown={(e) => startDrag(e, 'util:spacer')}
            onDoubleClick={() => quickAdd(`s:${Date.now()}`)}>
            <FaArrowsAltH /> Spacer
          </span>
          <span className="ribed-pal-chip ribed-pal-util" title="Drag onto a section: everything after it aligns to the toolbar's RIGHT edge"
            onPointerDown={(e) => startDrag(e, 'util:alignsplit')}>
            <FaExchangeAlt /> Align Split
          </span>
        </div>
      </div>
      <div className="ribed-ribbon">
        {sections.map((s, i) => (
          <React.Fragment key={`sec-${i}`}>
            {secSpot === i && <span className="ribed-sec-dropline" />}
            <div
              className={`ribed-section${s.hasBreak ? '' : ' ribed-single'}`}
              data-sec={i}
              title="Drag to move this section"
              /* v3.24, Derek: the section ITSELF is the drag handle — grab
                 anywhere that isn't a chip or a control and the whole bubble
                 moves. Chips keep their own drag (they stopPropagation via
                 the closest() guard below). */
              onPointerDown={(e) => {
                const t = e.target as HTMLElement;
                if (t.closest('.ribed-chip, .ribed-x, .ribed-spacer-grip, .ribed-break, input, button')) return;
                startDrag(e, `sec:${i}`);
              }}
            >
              {/* v3.29, Derek: the close-section × lives on the section
                  BUBBLE's top-right corner, not on its divider. */}
              {sections.length > 1 && (
                <button
                  className="ribed-x ribed-sec-close"
                  title={i < sections.length - 1
                    ? 'Close this section (its items join the next one)'
                    : 'Close this section (its items join the previous one)'}
                  onClick={() => mergeSections(i < sections.length - 1 ? i : i - 1)}
                >×</button>
              )}
              <div className="ribed-sec-rows">
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
            </div>
            {/* v3.02, Derek: EVERY section gets its closing divider on the
                right. At the align split the boundary is the split marker.
                v3.29: the close-section × moved onto the section bubble
                itself — the divider is just a divider now. */}
            {i + 1 === splitAt ? (
              <span className="ribed-alignsplit" title="Align Split — sections after this hug the toolbar's right edge">
                <FaExchangeAlt />
                <button className="ribed-x" title="Remove the align split (back to one left-aligned run)" onClick={removeSplit}>×</button>
              </span>
            ) : (i < sections.length - 1 || sections.length > 1) && (
              <span className="ribed-secdiv" title="Divider between sections" />
            )}
          </React.Fragment>
        ))}
        {secSpot === sections.length && <span className="ribed-sec-dropline" />}
      </div>

      <p className="fs-customize-hint">
        The strip above shows the ribbon as it will look. Drag items between
        the sections — drop position is the item's position; drag a section
        anywhere on its body to move the whole block. Drop <strong>Align
        Split</strong> between two sections and everything after it hugs the
        toolbar's right edge. Hover a section for the × that closes it (its
        items join the neighbour). Spacers resize by dragging their right
        edge. Drag an item onto the lists below to remove it — or
        double-click one below to add it to the section you touched last.
      </p>

      {/* v3.11, Derek: keyword filter — "save" surfaces Save, Save As,
          autosave... across every category at once. */}
      <div className="ribed-pal-search">
        <input
          type="search"
          value={paletteQuery}
          onChange={(e) => setPaletteQuery(e.target.value)}
          placeholder="Search items…"
          aria-label="Search available items"
        />
      </div>

      {/* available items; also the drop target for removal */}
      <div className="ribed-palette">
        {filteredPalette.every((cat) => cat.options.length === 0) && (
          <div className="ribed-pal-empty">Nothing matches “{paletteQuery}”.</div>
        )}
        {filteredPalette.map((cat) => cat.options.length > 0 && (
          <div key={cat.id} className="ribed-pal-group">
            <div className="ribed-pal-title">{cat.label}</div>
            {cat.options.map((o) => (
              <span
                key={o.value}
                className="ribed-pal-chip"
                title={`Drag onto the ribbon — or double-click to add: ${o.label}`}
                onPointerDown={(e) => startDrag(e, `new:${o.value}`)}
                onDoubleClick={() => quickAdd(o.value)}
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
