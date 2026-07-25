/**
 * WorkspacesTool (v4.23, Derek) — the dockable side-panel form of Workspaces.
 * The same saved layouts the View → Workspaces menu drives, listed so you can
 * apply one with a click, save the current arrangement, and rename/delete in
 * place. It reads and writes the SAME store API the menu and the Workspace
 * dialogs use (workspaces / applyWorkspace / saveWorkspace / renameWorkspace /
 * deleteWorkspace), so the two entry points can never drift apart.
 * v4.35: the menu's remaining actions live here too — save-changes, reset,
 * Edit Workspaces… and Import Workspaces from a Project… (the save-as row at
 * the top already covers "Save as New Workspace…").
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { FaColumns, FaEdit, FaRegTrashAlt, FaCheck } from 'react-icons/fa';
import { useEditorStore } from '../stores/editorStore';
import { EditWorkspacesDialog } from './WorkspaceDialogs';
import { importWorkspacesFromFile } from '../utils/workspaceImport';

export default function WorkspacesTool() {
  const workspaces = useEditorStore((s) => s.workspaces);
  const workspaceOrder = useEditorStore((s) => s.workspaceOrder);
  const activeWorkspace = useEditorStore((s) => s.activeWorkspace);
  const saveWorkspace = useEditorStore((s) => s.saveWorkspace);
  const applyWorkspace = useEditorStore((s) => s.applyWorkspace);
  const deleteWorkspace = useEditorStore((s) => s.deleteWorkspace);
  const renameWorkspace = useEditorStore((s) => s.renameWorkspace);

  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const names = workspaceOrder.filter((n) => workspaces[n]);
  const trimmed = newName.trim();
  const saveExists = trimmed.length > 0 && Object.prototype.hasOwnProperty.call(workspaces, trimmed);

  const doSave = () => {
    if (!trimmed) return;
    saveWorkspace(trimmed);
    setNewName('');
  };

  const startEdit = (name: string) => { setEditing(name); setEditValue(name); };
  const commitEdit = () => {
    const next = editValue.trim();
    if (editing && next && next !== editing && !workspaces[next]) renameWorkspace(editing, next);
    setEditing(null);
  };

  return (
    <div className="ws-tool">
      <div className="ws-save-row">
        <input
          className="ws-save-input"
          placeholder="Save current layout as…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') doSave(); }}
        />
        <button className="ws-save-btn" onClick={doSave} disabled={!trimmed} title={saveExists ? 'Overwrite this workspace' : 'Save current layout'}>
          {saveExists ? 'Overwrite' : 'Save'}
        </button>
      </div>

      <div className="ws-list">
        {names.length === 0 ? (
          <div className="ws-empty">No saved workspaces yet. Arrange your panels, then save the layout above.</div>
        ) : (
          names.map((name) => {
            const isActive = name === activeWorkspace;
            if (editing === name) {
              return (
                <div key={name} className="ws-item ws-item-editing">
                  <input
                    className="ws-edit-input"
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(null); }}
                  />
                  <button className="ws-icon-btn" title="Save name" onClick={commitEdit}><FaCheck /></button>
                  <button className="ws-icon-btn" title="Cancel" onClick={() => setEditing(null)}>×</button>
                </div>
              );
            }
            return (
              <div key={name} className={`ws-item${isActive ? ' ws-item-active' : ''}`}>
                <button className="ws-apply" onClick={() => applyWorkspace(name)} title="Apply this workspace">
                  <FaColumns className="ws-apply-icon" />
                  <span className="ws-apply-name">{name}</span>
                </button>
                {confirmDelete === name ? (
                  <>
                    <button className="ws-icon-btn ws-danger" title="Confirm delete" onClick={() => { deleteWorkspace(name); setConfirmDelete(null); }}><FaCheck /></button>
                    <button className="ws-icon-btn" title="Cancel" onClick={() => setConfirmDelete(null)}>×</button>
                  </>
                ) : (
                  <>
                    <button className="ws-icon-btn" title="Rename" onClick={() => startEdit(name)}><FaEdit /></button>
                    <button className="ws-icon-btn" title="Delete" onClick={() => setConfirmDelete(name)}><FaRegTrashAlt /></button>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* v4.35: the View → Workspaces menu's actions, mirrored. */}
      <div className="ws-actions">
        <button
          className="ws-action-btn"
          disabled={!activeWorkspace}
          title={activeWorkspace ? `Overwrite “${activeWorkspace}” with the current layout` : 'Apply a workspace first'}
          onClick={() => { if (activeWorkspace) saveWorkspace(activeWorkspace); }}
        >
          Save Changes to this Workspace
        </button>
        <button
          className="ws-action-btn"
          disabled={!activeWorkspace}
          title={activeWorkspace ? `Reapply the saved “${activeWorkspace}” layout` : 'Apply a workspace first'}
          onClick={() => { if (activeWorkspace) applyWorkspace(activeWorkspace); }}
        >
          Reset to Saved Layout
        </button>
        <button className="ws-action-btn" onClick={() => setEditDialogOpen(true)}>
          Edit Workspaces…
        </button>
        <button className="ws-action-btn" onClick={() => { void importWorkspacesFromFile(); }}>
          Import Workspaces from a Project…
        </button>
      </div>

      {/* Portalled: as a temp window this tool sits under a transform
          (.tool-window-temp), which would hijack the overlay's fixed
          positioning — from document.body it covers the viewport. */}
      {createPortal(
        <EditWorkspacesDialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} />,
        document.body,
      )}
    </div>
  );
}
