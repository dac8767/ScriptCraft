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
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useFormattingTemplateStore, DUAL_DIALOGUE_ID, DEFAULT_TRANSITIONS } from '../stores/formattingTemplateStore';
import { useSettingsStore, EDITOR_VIEWS, EDITOR_VIEW_REQUIRED } from '../stores/settingsStore';
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

  // ── v4.22, Derek: Transitions customization ──
  const customTransitions = useFormattingTemplateStore((s) => s.customTransitions);
  const hiddenTransitions = useFormattingTemplateStore((s) => s.hiddenTransitions);
  const addTransition = useFormattingTemplateStore((s) => s.addTransition);
  const removeCustomTransition = useFormattingTemplateStore((s) => s.removeCustomTransition);
  const setTransitionHidden = useFormattingTemplateStore((s) => s.setTransitionHidden);
  const setTransitionOrder = useFormattingTemplateStore((s) => s.setTransitionOrder);
  const transitionOrder = useFormattingTemplateStore((s) => s.transitionOrder);
  const resetTransitions = useFormattingTemplateStore((s) => s.resetTransitions);
  const [newTransition, setNewTransition] = useState('');
  // v4.22, Derek: the inline field read as plain text and confused people — the
  // "Add Transition" button now opens a small dialog with a clear input, centered
  // over the Customize window (not the whole screen).
  const [addOpen, setAddOpen] = useState(false);
  const [addPos, setAddPos] = useState<{ left: number; top: number } | null>(null);

  const isDefaultTransition = (t: string) => DEFAULT_TRANSITIONS.includes(t);
  // Re-derived when custom/hidden/order change (all three are subscribed above),
  // and shares the store's ordering so the list matches the editor's picker.
  void transitionOrder;
  const getEffectiveTransitions = useFormattingTemplateStore((s) => s.getEffectiveTransitions);
  const shownTransitions = getEffectiveTransitions();
  const allTransitions = [...DEFAULT_TRANSITIONS, ...customTransitions];
  const hiddenShown = DEFAULT_TRANSITIONS.filter((t) => hiddenTransitions.includes(t));
  const openAddTransition = () => {
    setNewTransition('');
    // Center on the Customize window if it's on screen; else fall back to the
    // viewport centre (the overlay's default).
    const dlg = document.querySelector('.fs-customize-dialog') as HTMLElement | null;
    if (dlg) {
      const r = dlg.getBoundingClientRect();
      setAddPos({ left: Math.round(r.left + r.width / 2), top: Math.round(r.top + r.height / 2) });
    } else {
      setAddPos(null);
    }
    setAddOpen(true);
  };
  const closeAddTransition = () => { setAddOpen(false); setNewTransition(''); };
  const commitNewTransition = () => {
    const t = newTransition.trim();
    if (!t) return;
    addTransition(t);
    closeAddTransition();
  };

  // ── v4.22, Derek: Editor View list (the toolbar's Editor View dropdown) ──
  const editorViewOrder = useSettingsStore((s) => s.editorViewOrder);
  const editorViewHidden = useSettingsStore((s) => s.editorViewHidden);
  const setEditorViewOrder = useSettingsStore((s) => s.setEditorViewOrder);
  const setEditorViewHidden = useSettingsStore((s) => s.setEditorViewHidden);
  const resetEditorViews = useSettingsStore((s) => s.resetEditorViews);
  void editorViewOrder; void editorViewHidden;
  const shownViews = useSettingsStore.getState().getEffectiveEditorViews();
  const hiddenViews = EDITOR_VIEWS.filter((v) => !shownViews.some((s) => s.id === v.id));
  const setViewShown = (id: string, shown: boolean) => {
    if (!shown && EDITOR_VIEW_REQUIRED.includes(id)) return;
    setEditorViewHidden(
      shown ? editorViewHidden.filter((x) => x !== id) : [...editorViewHidden.filter((x) => x !== id), id],
    );
  };

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

      <section>
        <h3>Transitions</h3>
        <p className="fs-customize-hint">
          The transitions offered as you type in a Transition element. Add your
          own; the built-ins can be hidden but not deleted. Drag between Shown and
          Hidden, or use the + / × buttons.
        </p>
        <DndColumns
          columns={[
            {
              id: 'shown', title: 'Shown',
              sections: [{
                rows: shownTransitions.map((t) => {
                  const isDefault = isDefaultTransition(t);
                  return {
                    key: t,
                    content: (
                      <span className="fs-customize-tool">
                        {t}
                        {!isDefault && <span className="fs-dnd-required">(custom)</span>}
                        <button
                          className="fs-dnd-rowbtn"
                          title={isDefault ? 'Hide this transition' : 'Remove this transition'}
                          onClick={() => (isDefault ? setTransitionHidden(t, true) : removeCustomTransition(t))}
                        >×</button>
                      </span>
                    ),
                  };
                }),
              }],
            },
            {
              id: 'hidden', title: 'Hidden', isHidden: true,
              sections: [{
                label: 'Transitions',
                rows: hiddenShown.map((t) => ({
                  key: t,
                  content: (
                    <span className="fs-customize-tool">
                      {t}
                      <button className="fs-dnd-rowbtn" title="Show this transition" onClick={() => setTransitionHidden(t, false)}>+</button>
                    </span>
                  ),
                })),
              }],
            },
          ]}
          onDrop={(src, dst) => {
            const t = src.key;
            if (dst.col === 'hidden') {
              // Only built-ins can be hidden; a custom dragged to Hidden is removed.
              if (isDefaultTransition(t)) setTransitionHidden(t, true);
              else removeCustomTransition(t);
              return;
            }
            // Dropped in Shown → reorder there (and un-hide if it came from Hidden).
            const next = shownTransitions.filter((x) => x !== t);
            next.splice(Math.min(dst.idx, next.length), 0, t);
            // Persist the full order (shown first, hidden appended) so hidden
            // built-ins keep their relative place when shown again.
            setTransitionOrder([...next, ...allTransitions.filter((x) => !next.includes(x))]);
            if (isDefaultTransition(t) && hiddenTransitions.includes(t)) setTransitionHidden(t, false);
          }}
        />
        <div className="fs-tbzone-adders fs-adders-equal">
          <button className="swn-add-btn" onClick={openAddTransition}>Add Transition</button>
          <button className="swn-add-btn" onClick={resetTransitions}>Reset to Default</button>
        </div>
      </section>

      <section>
        <h3>Editor Views</h3>
        <p className="fs-customize-hint">
          Which views appear in the toolbar's Editor View dropdown, and their
          order. Drag between Shown and Hidden. Page is always available.
        </p>
        <DndColumns
          columns={[
            {
              id: 'shown', title: 'Shown',
              sections: [{
                rows: shownViews.map((v) => {
                  const required = EDITOR_VIEW_REQUIRED.includes(v.id);
                  return {
                    key: v.id,
                    content: (
                      <span className="fs-customize-tool">
                        {v.label}
                        {required && <span className="fs-dnd-required">(required)</span>}
                        {!required && (
                          <button className="fs-dnd-rowbtn" title="Hide this view" onClick={() => setViewShown(v.id, false)}>×</button>
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
                label: 'Views',
                rows: hiddenViews.map((v) => ({
                  key: v.id,
                  content: (
                    <span className="fs-customize-tool">
                      {v.label}
                      <button className="fs-dnd-rowbtn" title="Show this view" onClick={() => setViewShown(v.id, true)}>+</button>
                    </span>
                  ),
                })),
              }],
            },
          ]}
          onDrop={(src, dst) => {
            const id = src.key;
            if (dst.col === 'hidden') { setViewShown(id, false); return; }
            const next = shownViews.map((v) => v.id).filter((x) => x !== id);
            next.splice(Math.min(dst.idx, next.length), 0, id);
            setEditorViewOrder([...next, ...EDITOR_VIEWS.map((v) => v.id).filter((x) => !next.includes(x))]);
            if (editorViewHidden.includes(id)) setViewShown(id, true);
          }}
        />
        <div className="fs-tbzone-adders fs-adders-equal">
          <button className="swn-add-btn" onClick={resetEditorViews}>Reset to Default</button>
        </div>
      </section>

      {addOpen && createPortal(
        <div className="dialog-overlay fs-add-transition-overlay" onClick={closeAddTransition}>
          <div
            className="dialog-box fs-add-transition-box"
            style={addPos ? { position: 'fixed', left: addPos.left, top: addPos.top, transform: 'translate(-50%, -50%)', margin: 0 } : undefined}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dialog-header">
              Add Transition
              <button className="fs-dialog-x" onClick={closeAddTransition} title="Close">&times;</button>
            </div>
            <div className="fs-add-transition-body">
              <label className="fs-add-transition-label" htmlFor="fs-add-transition-input">
                Transition text
              </label>
              <input
                id="fs-add-transition-input"
                type="text"
                className="fs-transition-input"
                placeholder="e.g. MATCH CUT TO:"
                autoFocus
                value={newTransition}
                onChange={(e) => setNewTransition(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); commitNewTransition(); }
                  else if (e.key === 'Escape') { e.preventDefault(); closeAddTransition(); }
                }}
              />
            </div>
            <div className="fs-add-transition-actions">
              <button className="swn-add-btn" onClick={closeAddTransition}>Cancel</button>
              <button className="swn-add-btn swn-add-primary" onClick={commitNewTransition} disabled={!newTransition.trim()}>Add</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
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
