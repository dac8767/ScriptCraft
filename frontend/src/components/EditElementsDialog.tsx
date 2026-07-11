/**
 * EditElementsDialog — show/hide and reorder screenplay elements.
 *
 * v0.71: rewritten to write PERSISTED OVERRIDES instead of mutating the active
 * template. The active template is usually a SYSTEM template (Industry
 * Standard, Multicam, One-Hour Drama) — an immutable constant, not a row in
 * `templates[]` — so updateTemplate() on it silently did nothing and Show/Hide
 * and reordering had no effect. Overrides (elementHidden / elementOrder) are
 * applied over whatever template is active, and every consumer reads them via
 * getEffectiveRules().
 *
 * Core elements can be reordered but not hidden — hiding Scene Heading or
 * Action would leave a screenplay with no way to type its own body.
 */
import React from 'react';
import { useFormattingTemplateStore } from '../stores/formattingTemplateStore';

/** Elements a screenplay can't function without — reorderable, never hidable. */
const REQUIRED_IDS = ['sceneHeading', 'action', 'character', 'dialogue'];
/** Not user-facing elements (handled elsewhere in the UI). */
const EXCLUDED_IDS = ['newAct', 'endOfAct', 'castList'];

interface Props {
  open?: boolean;
  onClose?: () => void;
  /** Render inline (Settings) rather than as a modal dialog. */
  embedded?: boolean;
}

export default function EditElementsDialog({ open = true, onClose, embedded = false }: Props) {
  const getEffectiveRules = useFormattingTemplateStore((s) => s.getEffectiveRules);
  const elementHidden = useFormattingTemplateStore((s) => s.elementHidden);
  const elementOrder = useFormattingTemplateStore((s) => s.elementOrder);
  const setElementHidden = useFormattingTemplateStore((s) => s.setElementHidden);
  const setElementOrder = useFormattingTemplateStore((s) => s.setElementOrder);
  const resetElementOverrides = useFormattingTemplateStore((s) => s.resetElementOverrides);
  const [dragIdx, setDragIdx] = React.useState<number | null>(null);

  // Re-derived whenever overrides change, so the list reflects every edit.
  void elementOrder; void elementHidden;
  const rules = getEffectiveRules();
  const ids = Object.keys(rules).filter((id) => !EXCLUDED_IDS.includes(id));

  const moveTo = (from: number, to: number) => {
    const next = [...ids];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    setElementOrder(next);
  };

  const setEnabled = (id: string, enabled: boolean) => {
    if (!enabled && REQUIRED_IDS.includes(id)) return;
    setElementHidden(
      enabled
        ? elementHidden.filter((x) => x !== id)
        : [...elementHidden.filter((x) => x !== id), id],
    );
  };

  const showAll = () => setElementHidden([]);
  const hideAll = () => setElementHidden(ids.filter((id) => !REQUIRED_IDS.includes(id)));
  const resetDefault = () => resetElementOverrides();

  const body = (
    <div className="fs-customize-body">
      <section>
        <h3>Elements</h3>
        <p className="fs-customize-hint">
          Drag to reorder. Hidden elements disappear from the Element dropdown
          and the Insert menu. Core elements (Scene Heading, Action, Character,
          Dialogue) can be reordered but not hidden.
        </p>
        <div className="fs-customize-grid">
          {ids.map((id, idx) => {
            const rule = rules[id];
            const required = REQUIRED_IDS.includes(id);
            return (
              <div
                key={id}
                className={`fs-customize-row${dragIdx === idx ? ' dragging' : ''}`}
                draggable
                onDragStart={(e) => { setDragIdx(idx); e.dataTransfer.effectAllowed = 'move'; }}
                onDragOver={(e) => { if (dragIdx !== null) e.preventDefault(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIdx !== null && dragIdx !== idx) moveTo(dragIdx, idx);
                  setDragIdx(null);
                }}
                onDragEnd={() => setDragIdx(null)}
              >
                <span className="fs-customize-tool">
                  <span className="fs-customize-drag" title="Drag to reorder">⠿</span>
                  {rule.label}
                </span>
                <span className="fs-customize-seg">
                  <button
                    className={rule.enabled ? 'active' : ''}
                    onClick={() => setEnabled(id, true)}
                  >Show</button>
                  <button
                    className={!rule.enabled ? 'active' : ''}
                    disabled={required}
                    title={required ? 'Core elements can’t be hidden' : 'Hide this element'}
                    onClick={() => setEnabled(id, false)}
                  >Hide</button>
                </span>
              </div>
            );
          })}
        </div>
        <div className="fs-tbzone-adders fs-adders-equal">
          <button className="swn-add-btn" onClick={showAll}>Show All</button>
          <button className="swn-add-btn" onClick={hideAll}>Hide All</button>
          <button className="swn-add-btn" onClick={resetDefault}>Reset to Default</button>
        </div>
      </section>
    </div>
  );

  if (embedded) return body;
  if (!open) return null;

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-box fs-customize-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          Edit Elements
          <button className="fs-dialog-x" onClick={onClose} title="Close">&times;</button>
        </div>
        {body}
      </div>
    </div>
  );
}
