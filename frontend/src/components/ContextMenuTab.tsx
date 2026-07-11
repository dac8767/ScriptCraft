/**
 * Customize → Context Menu (v0.88).
 *
 * Deliberately the same shape as the Toolbar and Side Panels tabs: drag to
 * reorder, a Show/Hide pair per row, a categorised "+ Add Item" dropdown, and
 * Hide All / Reset. The Show button is redundant information (a listed row is
 * visible by definition) but it's there because every other tab has it, and an
 * inconsistent control is worse than a redundant one.
 *
 * Only top-level items live here. What's INSIDE an item is owned by that
 * feature's own tab — the elements under Element come from the Elements tab — so
 * one change updates every menu instead of the two drifting apart.
 */
import React from 'react';
import { useEditorStore } from '../stores/editorStore';
import {
  CONTEXT_MENU_SECTIONS, CONTEXT_MENU_GROUPS, type ContextMenuGroup,
} from './ScriptContextMenu';
import { titleCase } from './CustomizePanelsDialog';

export default function ContextMenuTab() {
  const contextMenuHidden = useEditorStore((s) => s.contextMenuHidden);
  const setContextMenuHidden = useEditorStore((s) => s.setContextMenuHidden);
  const contextMenuOrder = useEditorStore((s) => s.contextMenuOrder);
  const setContextMenuOrder = useEditorStore((s) => s.setContextMenuOrder);

  const [dragIdx, setDragIdx] = React.useState<number | null>(null);

  const known = CONTEXT_MENU_SECTIONS.map((x) => x.id);
  const sectionOf = (id: string) => CONTEXT_MENU_SECTIONS.find((x) => x.id === id);
  const labelOf = (id: string) => sectionOf(id)?.label ?? id;

  // The user's arrangement first, then anything they haven't touched — so an
  // item added in a newer version still appears, at its default place.
  const fullOrder = [
    ...contextMenuOrder.filter((id) => known.includes(id)),
    ...known.filter((id) => !contextMenuOrder.includes(id)),
  ];
  const shown = fullOrder.filter((id) => !contextMenuHidden.includes(id));
  const hidden = fullOrder.filter((id) => contextMenuHidden.includes(id));

  /** Reorder the visible rows, then write the FULL order back — hidden items
   *  keep their slots, so un-hiding one restores it where it was rather than
   *  dumping it at the end. */
  const move = (from: number, to: number) => {
    const next = [...shown];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    let vi = 0;
    setContextMenuOrder(fullOrder.map((id) =>
      contextMenuHidden.includes(id) ? id : next[vi++]));
  };

  const show = (id: string) =>
    setContextMenuHidden(contextMenuHidden.filter((x) => x !== id));
  const hide = (id: string) =>
    setContextMenuHidden([...contextMenuHidden.filter((x) => x !== id), id]);

  /** Hidden items available to add, by category. */
  const hiddenIn = (g: ContextMenuGroup) =>
    hidden.filter((id) => sectionOf(id)?.group === g);

  const onAdd = (value: string) => {
    if (value.startsWith('all:')) {
      const g = value.slice(4) as ContextMenuGroup;
      const ids = hiddenIn(g);
      setContextMenuHidden(contextMenuHidden.filter((x) => !ids.includes(x)));
      return;
    }
    show(value);
  };

  return (
    <section>
      <h3>Context Menu</h3>
      <p className="fs-customize-hint">
        Drag to reorder the right-click menu. Hide what you don’t use and add it
        back with + Add Item. Undo, Redo, Cut, Copy, Paste, Select All, Delete,
        Delete Element and Customize Context Menu are permanent, so they aren’t
        listed. What’s <em>inside</em> an item is set by its own tab — the
        elements under Element come from the Elements tab.
      </p>

      <div className="fs-customize-grid">
        {shown.map((id, idx) => (
          <div
            key={id}
            className={`fs-customize-row${dragIdx === idx ? ' dragging' : ''}`}
            draggable
            onDragStart={(e) => { setDragIdx(idx); e.dataTransfer.effectAllowed = 'move'; }}
            onDragOver={(e) => { if (dragIdx !== null) e.preventDefault(); }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragIdx !== null && dragIdx !== idx) move(dragIdx, idx);
              setDragIdx(null);
            }}
            onDragEnd={() => setDragIdx(null)}
          >
            <span className="fs-customize-tool">
              <span className="fs-customize-drag" title="Drag to reorder">⠿</span>
              {labelOf(id)}
            </span>
            <span className="fs-customize-seg">
              <button className="active" onClick={() => show(id)}>Show</button>
              <button onClick={() => hide(id)}>Hide</button>
            </span>
          </div>
        ))}
        {shown.length === 0 && (
          <p className="fs-customize-hint">Every item is hidden. Add one back with + Add Item.</p>
        )}
      </div>

      <div className="fs-tbzone-adders fs-adders-equal">
        <select
          value=""
          onChange={(e) => { if (e.target.value) { onAdd(e.target.value); e.target.value = ''; } }}
        >
          <option value="">+ Add Item</option>
          {CONTEXT_MENU_GROUPS.some((g) => hiddenIn(g).length > 0) && (
            <optgroup label="Show All">
              {CONTEXT_MENU_GROUPS
                .filter((g) => hiddenIn(g).length > 0)
                .map((g) => (
                  <option key={`all-${g}`} value={`all:${g}`}>Show All {titleCase(g)}</option>
                ))}
            </optgroup>
          )}
          {CONTEXT_MENU_GROUPS.map((g) => {
            const opts = hiddenIn(g);
            if (opts.length === 0) return null;
            return (
              <optgroup key={g} label={g}>
                {opts.map((id) => (
                  <option key={id} value={id}>{labelOf(id)}</option>
                ))}
              </optgroup>
            );
          })}
        </select>
        <button
          className="swn-add-btn"
          title="Hide every item"
          onClick={() => setContextMenuHidden(known)}
        >Hide All</button>
        <button
          className="swn-add-btn"
          title="Restore the default items and order"
          onClick={() => { setContextMenuHidden([]); setContextMenuOrder([]); }}
        >Reset to Default</button>
      </div>
    </section>
  );
}
