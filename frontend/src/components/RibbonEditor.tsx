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
import React, { useState } from 'react';
import { FaGripLinesVertical, FaLevelDownAlt } from 'react-icons/fa';
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
  secs.map((s) => ({ top: [...s.top], bottom: [...s.bottom], hasBreak: s.hasBreak }));

const RibbonEditor: React.FC<Props> = ({ tokens, onChange, palette }) => {
  const sections = parseRibbon(tokens);
  const [spot, setSpot] = useState<DropSpot | null>(null);
  const [dragging, setDragging] = useState(false);

  const commit = (secs: RibbonSection[]) => onChange(serializeRibbon(secs));
  const endDrag = () => { setSpot(null); setDragging(false); };

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
    setSpot({ sec, row, idx: idx + (e.clientX > r.left + r.width / 2 ? 1 : 0) });
  };
  const overRow = (e: React.DragEvent, sec: number, row: Row, len: number) => {
    e.preventDefault();
    e.stopPropagation();
    setSpot({ sec, row, idx: len });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const payload = e.dataTransfer.getData('text/plain');
    if (!payload || !spot) { endDrag(); return; }
    const secs = clone(sections);
    const target = secs[spot.sec];
    if (!target) { endDrag(); return; }
    const rowArr = spot.row === 'top' ? target.top : target.bottom;
    let idx = Math.min(spot.idx, rowArr.length);

    if (payload.startsWith('tok:')) {
      // moving an existing item — removing it first can shift the target
      const tok = payload.slice(4);
      const before = rowArr.indexOf(tok);
      if (before >= 0 && before < idx) idx -= 1;
      removeEverywhere(secs, tok);
      const arr = spot.row === 'top' ? target.top : target.bottom;
      arr.splice(Math.min(idx, arr.length), 0, tok);
    } else if (payload === 'util:rowbreak') {
      if (!target.hasBreak) {
        target.bottom = target.top.slice(idx);
        target.top = target.top.slice(0, idx);
        target.hasBreak = true;
      } else if (spot.row === 'top') {
        target.bottom = [...target.top.slice(idx), ...target.bottom];
        target.top = target.top.slice(0, idx);
      } else {
        target.top = [...target.top, ...target.bottom.slice(0, idx)];
        target.bottom = target.bottom.slice(idx);
      }
    } else if (payload === 'util:spacer') {
      rowArr.splice(idx, 0, `s:${Date.now()}`);
    } else if (payload.startsWith('new:')) {
      rowArr.splice(idx, 0, payload.slice(4));
    }
    commit(secs);
    endDrag();
  };

  const dragStart = (e: React.DragEvent, payload: string) => {
    e.dataTransfer.setData('text/plain', payload);   // WebKit: mandatory
    e.dataTransfer.effectAllowed = 'move';
    setDragging(true);
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

  const dropLine = <span className="ribed-dropline" />;

  const renderChip = (tok: string, sec: number, row: Row, idx: number) => (
    <React.Fragment key={tok}>
      {dragging && spot && spot.sec === sec && spot.row === row && spot.idx === idx && dropLine}
      <span
        className={`ribed-chip${tok.startsWith('s:') ? ' ribed-chip-spacer' : ''}${tok.startsWith('d:') ? ' ribed-chip-div' : ''}`}
        draggable
        title={tokenLabel(tok)}
        onDragStart={(e) => dragStart(e, `tok:${tok}`)}
        onDragEnd={endDrag}
        onDragOver={(e) => overChip(e, sec, row, idx)}
      >
        {tok.startsWith('s:') ? (
          <input
            className="ribed-spacer-w"
            type="number"
            min={8}
            max={240}
            value={spacerPx(tok)}
            title="Spacer width (px)"
            onChange={(e) => setSpacerWidth(tok, Number(e.target.value))}
            onPointerDown={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="ribed-chip-icon">{tokenIcon(tok)}</span>
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
        onDragOver={(e) => overRow(e, sec, row, items.length)}
      >
        {items.map((tok, i) => renderChip(tok, sec, row, i))}
        {dragging && spot && spot.sec === sec && spot.row === row && spot.idx >= items.length && dropLine}
        {items.length === 0 && !dragging && <span className="ribed-empty-hint">drop items here</span>}
      </div>
    );
  };

  const removeDividerBefore = (i: number) => {
    // merging section i-1 and i: rows concatenate, a break in either survives
    const secs = clone(sections);
    const a = secs[i - 1];
    const b = secs[i];
    const merged: RibbonSection = {
      top: [...a.top, ...b.top],
      bottom: [...a.bottom, ...b.bottom],
      hasBreak: a.hasBreak || b.hasBreak,
    };
    secs.splice(i - 1, 2, merged);
    commit(secs);
  };

  const removeBreak = (i: number) => {
    const secs = clone(sections);
    secs[i] = { top: [...secs[i].top, ...secs[i].bottom], bottom: [], hasBreak: false };
    commit(secs);
  };

  return (
    <div className="ribed">
      <div className="ribed-ribbon" onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
        {sections.map((s, i) => (
          <React.Fragment key={`sec-${i}`}>
            {i > 0 && (
              <span className="ribed-secdiv" title="Section divider">
                <button className="ribed-x" title="Remove divider (merges the sections)" onClick={() => removeDividerBefore(i)}>×</button>
              </span>
            )}
            <div className={`ribed-section${s.hasBreak ? '' : ' ribed-single'}`}>
              {renderRow(s, i, 'top')}
              {s.hasBreak && (
                <div className="ribed-break" title="New Row — items after this sit on the second row">
                  <span className="ribed-break-line" />
                  <button className="ribed-x" title="Remove the row split (back to one row)" onClick={() => removeBreak(i)}>×</button>
                </div>
              )}
              {s.hasBreak && renderRow(s, i, 'bottom')}
            </div>
          </React.Fragment>
        ))}
        <button
          className="ribed-add-section"
          title="Add a new empty section at the end"
          onClick={() => commit([...clone(sections), { top: [], bottom: [], hasBreak: false }])}
        >+ Section</button>
      </div>

      <p className="fs-customize-hint">
        Drag items between the sections above — drop position is the item's
        position. Drag <strong>New Row</strong> into a section to split it
        into two rows at that spot; a section without a split spans its items
        across both rows. Drag an item onto the lists below to remove it.
      </p>

      {/* utilities + available items; also the drop target for removal */}
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
        <div className="ribed-pal-group">
          <div className="ribed-pal-title">Utilities</div>
          <span className="ribed-pal-chip ribed-pal-util" draggable title="Drop into a section to split it into two rows"
            onDragStart={(e) => dragStart(e, 'util:rowbreak')} onDragEnd={endDrag}>
            <FaLevelDownAlt /> New Row
          </span>
          <span className="ribed-pal-chip ribed-pal-util" draggable title="Blank space between items"
            onDragStart={(e) => dragStart(e, 'util:spacer')} onDragEnd={endDrag}>
            <FaGripLinesVertical /> Spacer
          </span>
        </div>
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
