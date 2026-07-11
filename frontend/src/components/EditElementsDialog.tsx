/**
 * EditElementsDialog (v0.63) — show/hide and reorder screenplay elements.
 *
 * Same interaction model as Customize: one row per element, drag to reorder,
 * Show/Hide per row, plus Show All / Hide All / Reset to Default. Reachable
 * from Insert → Edit Elements… and embedded in Settings → Elements.
 *
 * Element order lives in the active template's `rules` object (its key order);
 * visibility is each rule's `enabled` flag. Both are persisted through
 * updateTemplate, so the Element dropdown, the Insert menu, and the editor's
 * element cycling all follow automatically.
 *
 * Core elements can be reordered but not hidden — hiding Scene Heading or
 * Action would leave a screenplay with no way to type its own body.
 */
import React from 'react';
import { useFormattingTemplateStore } from '../stores/formattingTemplateStore';
import type { FormattingElementRule } from '../stores/formattingTypes';

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
  const template = useFormattingTemplateStore((s) => s.getActiveTemplate());
  const updateTemplate = useFormattingTemplateStore((s) => s.updateTemplate);
  const [dragIdx, setDragIdx] = React.useState<number | null>(null);

  const ids = Object.keys(template.rules).filter((id) => !EXCLUDED_IDS.includes(id));

  const commit = (nextIds: string[], overrides?: Record<string, Partial<FormattingElementRule>>) => {
    // Rebuild `rules` in the new key order — Object.values() order is what the
    // Element dropdown and Insert menu iterate, so key order IS display order.
    const rules: Record<string, FormattingElementRule> = {};
    for (const id of nextIds) {
      rules[id] = { ...template.rules[id], ...(overrides?.[id] ?? {}) };
    }
    // Preserve excluded rules (not shown here, but must survive the rewrite).
    for (const id of Object.keys(template.rules)) {
      if (!(id in rules)) rules[id] = template.rules[id];
    }
    void updateTemplate(template.id, { rules });
  };

  const moveTo = (from: number, to: number) => {
    const next = [...ids];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    commit(next);
  };

  const setEnabled = (id: string, enabled: boolean) => {
    if (!enabled && REQUIRED_IDS.includes(id)) return;
    commit(ids, { [id]: { enabled } });
  };

  const showAll = () =>
    commit(ids, Object.fromEntries(ids.map((id) => [id, { enabled: true }])));

  const hideAll = () =>
    commit(
      ids,
      Object.fromEntries(
        ids.map((id) => [id, { enabled: REQUIRED_IDS.includes(id) }]),
      ),
    );

  const resetDefault = () => {
    // Default: every element visible, in the template's canonical rule order.
    commit(
      Object.keys(template.rules).filter((id) => !EXCLUDED_IDS.includes(id)).sort(
        (a, b) => Object.keys(template.rules).indexOf(a) - Object.keys(template.rules).indexOf(b),
      ),
      Object.fromEntries(ids.map((id) => [id, { enabled: true }])),
    );
  };

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
            const rule = template.rules[id];
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
                    title={required ? 'Core elements can\u2019t be hidden' : 'Hide this element'}
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
