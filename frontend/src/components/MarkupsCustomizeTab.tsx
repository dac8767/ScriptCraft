/**
 * v5.25: Customize ▸ Annotations (tool renamed v5.26; ids keep 'markups') —
 * pick which icon + color combos are the PREDEFINED options the annotation
 * icon picker offers. The list
 * is ordered (drag a chip onto another to reorder — dataTransfer.setData
 * is mandatory, the WebKit footgun); build a new combo from the full
 * icon/emoji grid + a color, then Add. Floor of one preset: an empty row
 * in the popover would read as broken.
 */
import { useState } from 'react';
import { useEditorStore } from '../stores/editorStore';
import { runMajorChange } from '../utils/majorChange';
import { DEFAULT_MARKUP_PRESETS } from '../stores/slices/markupsSlice';
import { MARKUP_ICONS, MARKUP_EMOJI, MARKUP_COLORS, MarkupIcon } from './markupIcons';

export default function MarkupsCustomizeTab() {
  const presets = useEditorStore((s) => s.markupPresets);
  const setPresets = useEditorStore((s) => s.setMarkupPresets);
  const [pickIcon, setPickIcon] = useState('flag');
  const [pickColor, setPickColor] = useState(MARKUP_COLORS[0]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const exists = presets.some((p) => p.icon === pickIcon && p.color === pickColor);
  const add = () => {
    if (exists) return;
    setPresets([...presets, { icon: pickIcon, color: pickColor }]);
  };
  const remove = (i: number) => {
    if (presets.length <= 1) return;
    setPresets(presets.filter((_, idx) => idx !== i));
  };
  const reorder = (from: number, to: number) => {
    const next = [...presets];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setPresets(next);
  };

  return (
    <section>
      <h3>Annotation Presets</h3>
      <p className="fs-markup-cz-help">
        These combos appear as the one-click options in an annotation&rsquo;s icon
        picker. Drag to reorder — the first is what a new annotation starts as.
      </p>
      <div className="fs-markup-cz-current">
        {presets.map((p, i) => (
          <span
            key={`${p.icon}-${p.color}-${i}`}
            className={`fs-markup-cz-chip${dragIdx === i ? ' dragging' : ''}`}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', p.icon);   // required by WebKit
              e.dataTransfer.effectAllowed = 'move';
              setDragIdx(i);
            }}
            onDragEnd={() => setDragIdx(null)}
            onDragOver={(e) => { if (dragIdx !== null && dragIdx !== i) e.preventDefault(); }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragIdx !== null && dragIdx !== i) reorder(dragIdx, i);
              setDragIdx(null);
            }}
          >
            <MarkupIcon icon={p.icon} color={p.color} />
            <button
              className="fs-markup-cz-x"
              title={presets.length <= 1 ? 'At least one preset must remain' : 'Remove preset'}
              disabled={presets.length <= 1}
              onClick={() => remove(i)}
            >×</button>
          </span>
        ))}
      </div>

      <h3>Add a Combo</h3>
      <div className="markup-pop-grid fs-markup-cz-grid">
        {Object.keys(MARKUP_ICONS).map((k) => (
          <button key={k} className={`markup-preset${pickIcon === k ? ' active' : ''}`} title={k} onClick={() => setPickIcon(k)}>
            <MarkupIcon icon={k} color={pickColor} />
          </button>
        ))}
        {MARKUP_EMOJI.map((e) => (
          <button key={e} className={`markup-preset${pickIcon === `emoji:${e}` ? ' active' : ''}`} onClick={() => setPickIcon(`emoji:${e}`)}>
            <span className="markup-emoji">{e}</span>
          </button>
        ))}
      </div>
      <div className="fs-markup-cz-colors">
        {MARKUP_COLORS.map((c) => (
          <button key={c} className={`markup-dot${pickColor === c ? ' active' : ''}`} style={{ background: c }} title="Icon color" onClick={() => setPickColor(c)} />
        ))}
        <input type="color" className="markup-dot markup-dot-custom" value={pickColor} title="Custom color" onChange={(e) => setPickColor(e.target.value)} />
        <span className="fs-markup-cz-preview"><MarkupIcon icon={pickIcon} color={pickColor} /></span>
        <button
          className="dialog-btn dialog-btn-sm dialog-btn-primary fs-markup-cz-add"
          disabled={exists}
          title={exists ? 'This combo is already a preset' : 'Add this combo to the presets'}
          onClick={add}
        >+ Add Preset</button>
      </div>

      <div className="fs-markup-cz-footrow">
        {/* v6.77: warned + undoable like every bulk reset (majorChange). */}
        <button
          className="dialog-btn"
          onClick={() => {
            const st = useEditorStore.getState();
            void runMajorChange({
              title: 'Reset Annotation Presets',
              message: `Replace your ${st.markupPresets.length} annotation preset${st.markupPresets.length === 1 ? '' : 's'} with the app's default set?`,
              confirmLabel: 'Reset',
              label: 'Reset annotation presets',
              capture: () => {
                const prev = st.markupPresets.map((p) => ({ ...p }));
                return () => useEditorStore.getState().setMarkupPresets(prev);
              },
              run: () => useEditorStore.getState().setMarkupPresets(DEFAULT_MARKUP_PRESETS),
            });
          }}
        >
          Reset to Default
        </button>
      </div>
    </section>
  );
}
