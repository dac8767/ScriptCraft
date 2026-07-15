/**
 * EditElementsDialog — show/hide and reorder script elements.
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
 * Action would leave a script with no way to type its own body.
 */
import { useFormattingTemplateStore, DUAL_DIALOGUE_ID } from '../stores/formattingTemplateStore';
import { DndColumns } from './CustomizePanelsDialog';

/** Elements a script can't function without — reorderable, never hidable. */
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

  // Re-derived whenever overrides change, so the list reflects every edit.
  void elementOrder; void elementHidden;
  const rules = getEffectiveRules();
  const ids = Object.keys(rules).filter((id) => !EXCLUDED_IDS.includes(id));

  // v0.86: Dual Dialogue is offered in every element list, so it must be
  // manageable here too — otherwise it's the one element you can't hide or
  // reorder. It has no template rule (it's a structure, not a paragraph type),
  // so it's inserted with the SAME placement rule the store uses: the user's
  // position if they've dragged it, otherwise straight after Dialogue.
  if (!ids.includes(DUAL_DIALOGUE_ID)) {
    const placed = elementOrder.indexOf(DUAL_DIALOGUE_ID);
    if (placed >= 0) {
      const before = elementOrder.slice(0, placed);
      const at = ids.findIndex((id) => !before.includes(id));
      ids.splice(at < 0 ? ids.length : at, 0, DUAL_DIALOGUE_ID);
    } else {
      const di = ids.indexOf('dialogue');
      ids.splice(di < 0 ? ids.length : di + 1, 0, DUAL_DIALOGUE_ID);
    }
  }
  const labelOf = (id: string) => (id === DUAL_DIALOGUE_ID ? 'Dual Dialogue' : rules[id]?.label ?? id);

  /** Elements still IN the list. Hidden ones leave it and live in + Add Item. */
  const visibleIds = ids.filter((id) => {
    const rule = rules[id];
    return rule ? rule.enabled : !elementHidden.includes(id);
  });

  const hiddenIds = ids.filter((id) => !visibleIds.includes(id));

  const setEnabled = (id: string, enabled: boolean) => {
    if (!enabled && REQUIRED_IDS.includes(id)) return;
    setElementHidden(
      enabled
        ? elementHidden.filter((x) => x !== id)
        : [...elementHidden.filter((x) => x !== id), id],
    );
  };

  const hideAll = () => setElementHidden(ids.filter((id) => !REQUIRED_IDS.includes(id)));
  const resetDefault = () => resetElementOverrides();

  const body = (
    <div className="fs-customize-body">
      <section>
        <h3>Elements</h3>
        <p className="fs-customize-hint">
          Drag elements between Shown and Hidden — where you drop one is its
          place in the Element dropdown and the Insert menu. Core elements
          (Scene Heading, Action, Character, Dialogue) can be reordered but
          not hidden.
        </p>
        <DndColumns
          columns={[
            {
              id: 'shown', title: 'Shown',
              sections: [{
                rows: visibleIds.map((id) => {
                  const required = REQUIRED_IDS.includes(id);
                  return {
                    key: id,
                    content: (
                      <span className="fs-customize-tool">
                        {labelOf(id)}
                        {required && <span className="fs-dnd-required">(required)</span>}
                        {!required && (
                          <button className="fs-dnd-rowbtn" title="Hide this element" onClick={() => setEnabled(id, false)}>×</button>
                        )}
                      </span>
                    ),
                  };
                }),
              }],
            },
            {
              id: 'hidden', title: 'Hidden', isHidden: true,
              sections: [{
                label: 'Elements',
                rows: hiddenIds.map((id) => ({
                  key: id,
                  content: (
                    <span className="fs-customize-tool">
                      {labelOf(id)}
                      <button className="fs-dnd-rowbtn" title="Show this element" onClick={() => setEnabled(id, true)}>+</button>
                    </span>
                  ),
                })),
              }],
            },
          ]}
          onDrop={(src2, dst) => {
            const id = src2.key;
            if (dst.col === 'hidden') { setEnabled(id, false); return; }
            const next = visibleIds.filter((x) => x !== id);
            next.splice(Math.min(dst.idx, next.length), 0, id);
            setElementOrder([...next, ...ids.filter((x) => !next.includes(x))]);
            if (hiddenIds.includes(id)) setEnabled(id, true);
          }}
        />
        <div className="fs-tbzone-adders fs-adders-equal">
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
