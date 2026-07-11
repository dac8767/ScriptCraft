/**
 * Customize → Context Menu (v0.81).
 *
 * Shows and hides the TOP-LEVEL sections of the right-click menu, and nothing
 * deeper. What lives *inside* a section is owned by that feature's own tab —
 * the elements offered under "Element" come from Customize > Elements, so
 * changing them there updates the Element dropdown, the Insert menu, the
 * Enter-key picker AND this context menu at once. Duplicating that control here
 * would let the same setting drift between instances.
 *
 * "Customize Context Menu" is permanent in the menu itself and therefore isn't
 * listed as hidable — you can always get back in.
 */
import { useEditorStore } from '../stores/editorStore';
import { CONTEXT_MENU_SECTIONS } from './ScriptContextMenu';

export default function ContextMenuTab() {
  const contextMenuHidden = useEditorStore((s) => s.contextMenuHidden);
  const setContextMenuHidden = useEditorStore((s) => s.setContextMenuHidden);

  const setHidden = (id: string, hidden: boolean) => {
    setContextMenuHidden(
      hidden
        ? [...contextMenuHidden.filter((x) => x !== id), id]
        : contextMenuHidden.filter((x) => x !== id),
    );
  };

  return (
    <section>
      <h3>Context Menu</h3>
      <p className="fs-customize-hint">
        Choose which items appear when you right-click in the script. Names match
        the menu exactly. Undo, Redo, Cut, Copy, Paste, Select All, Delete,
        Delete Element and Customize Context Menu are permanent, so they aren’t
        listed. What’s <em>inside</em> an item is set by its own tab — the
        elements under Element come from the Elements tab, and changing them
        there updates every menu at once.
      </p>

      <div className="fs-customize-grid">
        {CONTEXT_MENU_SECTIONS.map(({ id, label }) => {
          const hidden = contextMenuHidden.includes(id);
          return (
            <div className="fs-customize-row" key={id}>
              <span className="fs-customize-tool">{label}</span>
              <span className="fs-customize-seg">
                <button
                  className={!hidden ? 'active' : ''}
                  onClick={() => setHidden(id, false)}
                >Show</button>
                <button
                  className={hidden ? 'active' : ''}
                  onClick={() => setHidden(id, true)}
                >Hide</button>
              </span>
            </div>
          );
        })}
      </div>

      <div className="fs-tbzone-adders fs-adders-equal">
        <button className="swn-add-btn" onClick={() => setContextMenuHidden([])}>Show All</button>
        <button
          className="swn-add-btn"
          onClick={() => setContextMenuHidden(CONTEXT_MENU_SECTIONS.map((s) => s.id))}
        >Hide All</button>
        <button className="swn-add-btn" onClick={() => setContextMenuHidden([])}>Reset to Default</button>
      </div>
    </section>
  );
}
