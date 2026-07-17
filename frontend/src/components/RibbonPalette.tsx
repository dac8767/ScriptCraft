/**
 * RibbonPalette (v3.36, Derek) — the SOURCE side of in-place ribbon editing.
 *
 * The old RibbonEditor rendered an editable REPLICA of the ribbon inside the
 * dialog; matching it to the real bar pixel-for-pixel was a losing battle.
 * The new model: this component (in the Customize > Toolbar tab) shows only
 * the drag SOURCES — the structural utilities and the item palette — and you
 * drop them onto the REAL ribbon bar, which becomes the editor while this tab
 * is open. Every drag routes through the shared controller in ribbonDrag.ts;
 * the token sequence in `toolbarLeft` stays the single source of truth.
 */
import React, { useState } from 'react';
import { FaGripLinesVertical, FaArrowsAltH, FaExchangeAlt, FaRegQuestionCircle } from 'react-icons/fa';
import { tokenIcon } from './tokenMeta';
import {
  startRibbonDrag, ribAppendSection, ribQuickAdd,
} from './ribbonDrag';

interface Props {
  palette: Array<{ id: string; label: string; options: Array<{ value: string; label: string }> }>;
  headerControls?: React.ReactNode;
}

const RibbonPalette: React.FC<Props> = ({ palette, headerControls }) => {
  const [paletteQuery, setPaletteQuery] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const q = paletteQuery.trim().toLowerCase();
  const filtered = q
    ? palette.map((cat) => ({ ...cat, options: cat.options.filter((o) => o.label.toLowerCase().includes(q)) }))
    : palette;

  return (
    <div className="ribed ribed-palette-only">
      <div className="ribed-utilrow">
        {headerControls}
        <span className="ribed-utilrow-spring" />
        <div className="ribed-tools">
          <span className="ribed-pal-chip ribed-pal-util ribed-blk" title="Drag onto the toolbar: a new single-row section (double-click: add at the end)"
            onPointerDown={(e) => startRibbonDrag(e, 'blk:single')}
            onDoubleClick={() => ribAppendSection('single')}>
            <span className="ribed-blk-glyph"><i /></span> Single Row
          </span>
          <span className="ribed-pal-chip ribed-pal-util ribed-blk" title="Drag onto the toolbar: a new two-row section (double-click: add at the end)"
            onPointerDown={(e) => startRibbonDrag(e, 'blk:double')}
            onDoubleClick={() => ribAppendSection('double')}>
            <span className="ribed-blk-glyph"><i /><i /></span> Two Rows
          </span>
          <span className="ribed-pal-chip ribed-pal-util" title="Drag into a row on the toolbar: a one-row vertical divider line (double-click: add to the last section)"
            onPointerDown={(e) => startRibbonDrag(e, 'util:divider')}
            onDoubleClick={() => ribQuickAdd(`d:${Date.now()}`)}>
            <FaGripLinesVertical /> Divider
          </span>
          <span className="ribed-pal-chip ribed-pal-util" title="Drag into a row on the toolbar: blank space — drag its edge to resize (double-click: add to the last section)"
            onPointerDown={(e) => startRibbonDrag(e, 'util:spacer')}
            onDoubleClick={() => ribQuickAdd(`s:${Date.now()}`)}>
            <FaArrowsAltH /> Spacer
          </span>
          <span className="ribed-pal-chip ribed-pal-util" title="Drag onto the toolbar between two sections: everything after aligns to the RIGHT edge"
            onPointerDown={(e) => startRibbonDrag(e, 'util:alignsplit')}>
            <FaExchangeAlt /> Align Split
          </span>
          <span className="ribed-help-anchor">
            <button
              className="ribed-help-btn"
              title="How toolbar editing works"
              onClick={() => setHelpOpen((v) => !v)}
            ><FaRegQuestionCircle /></button>
            {helpOpen && (
              <div className="ribed-help-pop" onClick={() => setHelpOpen(false)}>
                While this tab is open, the <strong>real toolbar</strong> above
                is the editor. Drag items from the lists below straight onto it;
                drag a section by its body to move it; hover a section for its
                closing ×. Drop <strong>Align Split</strong> between two sections
                so everything after hugs the right edge. Drag an item off the bar
                (back here) to remove it, or double-click one below to add it.
                Close this window to lock the layout.
              </div>
            )}
          </span>
        </div>
      </div>

      <div className="ribed-pal-search">
        <input
          type="search"
          value={paletteQuery}
          onChange={(e) => setPaletteQuery(e.target.value)}
          placeholder="Search items…"
          aria-label="Search available items"
        />
      </div>

      {/* the drag SOURCES; also the drop target for removal */}
      <div className="ribed-palette">
        {filtered.every((cat) => cat.options.length === 0) && (
          <div className="ribed-pal-empty">Nothing matches “{paletteQuery}”.</div>
        )}
        {filtered.map((cat) => cat.options.length > 0 && (
          <div key={cat.id} className="ribed-pal-group">
            <div className="ribed-pal-title">{cat.label}</div>
            {cat.options.map((o) => (
              <span
                key={o.value}
                className="ribed-pal-chip"
                title={`Drag onto the toolbar — or double-click to add: ${o.label}`}
                onPointerDown={(e) => startRibbonDrag(e, `new:${o.value}`)}
                onDoubleClick={() => ribQuickAdd(o.value)}
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

export default RibbonPalette;
