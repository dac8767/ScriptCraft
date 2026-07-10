/**
 * ProjectManagerTool — the Project Manager as a real in-window tool (v0.25).
 *
 * Two levels, all inside the window:
 *   Projects  — every local project; click to drill in, + New Project
 *   Scripts   — the chosen project's scripts with page counts; click to open
 *               in the editor, + New Script
 * Nothing here leaves the editor or opens the old full-screen page.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type ProjectInfo, type ScriptMeta } from '../services/api';
import { useProjectStore } from '../stores/projectStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useEditorStore } from '../stores/editorStore';
import { mirrorSave } from '../services/saveLocations';
import { showToast } from './Toast';

type Level = { view: 'projects' } | { view: 'scripts'; project: ProjectInfo };

export default function ProjectManagerTool() {
  const navigate = useNavigate();
  const { currentProject } = useProjectStore();
  const [level, setLevel] = useState<Level>({ view: 'projects' });
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [scripts, setScripts] = useState<ScriptMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  const loadProjects = useCallback(() => {
    setLoading(true);
    setError('');
    api.listProjects()
      .then((list) => { setProjects(list); setLoading(false); })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Could not load projects');
        setLoading(false);
      });
  }, []);

  const loadScripts = useCallback((project: ProjectInfo) => {
    setLoading(true);
    setError('');
    api.listScripts(project.id)
      .then((list) => { setScripts(list); setLoading(false); })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Could not load scripts');
        setLoading(false);
      });
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const openProject = (p: ProjectInfo) => {
    setLevel({ view: 'scripts', project: p });
    setAdding(false);
    setNewName('');
    loadScripts(p);
  };

  const backToProjects = () => {
    setLevel({ view: 'projects' });
    setAdding(false);
    setNewName('');
    loadProjects();
  };

  const submitNew = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      if (level.view === 'projects') {
        await api.createProject(name);
        showToast(`Project "${name}" created`, 'success');
        loadProjects();
      } else {
        const resp = await api.createScript(level.project.id, { title: name });
        showToast(`Script "${name}" created`, 'success');
        navigate(`/project/${level.project.id}/edit/${resp.meta.id}`);
      }
      setAdding(false);
      setNewName('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Create failed', 'error');
    }
  };

  // ── Rename / Delete (v0.44) ────────────────────────────────────────────
  const [chooserTarget, setChooserTarget] = useState<ProjectInfo | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ProjectInfo | null>(null);
  const [deleteText, setDeleteText] = useState('');
  const [backupFirst, setBackupFirst] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const startRename = (p: ProjectInfo) => { setRenamingId(p.id); setRenameValue(p.name); };
  const commitRename = async (p: ProjectInfo) => {
    const name = renameValue.trim();
    setRenamingId(null);
    if (!name || name === p.name) return;
    try {
      const updated = await api.updateProject(p.id, { name });
      if (currentProject?.id === p.id) {
        useProjectStore.getState().setCurrentProject({ ...currentProject, name: updated.name ?? name });
      }
      showToast(`Project renamed to "${name}"`, 'success');
      loadProjects();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Rename failed', 'error');
    }
  };

  const openDelete = (p: ProjectInfo) => {
    setDeleteTarget(p);
    setDeleteText('');
    setBackupFirst(false);
  };
  const closeDelete = () => { if (!deleting) setDeleteTarget(null); };

  const confirmDelete = async () => {
    const p = deleteTarget;
    if (!p || deleteText !== 'Delete Project' || deleting) return;
    if (currentProject?.id === p.id) return; // belt-and-braces; the button never offers it
    setDeleting(true);
    try {
      if (backupFirst) {
        const st = useSettingsStore.getState();
        if (!st.saveToCloud && !st.saveToGDrive && !st.saveToOneDrive) {
          showToast('No save locations are enabled — enable one in Settings > Save Options first.', 'error');
          setDeleting(false);
          return;
        }
        // Fan every script out to the enabled save locations, then verify —
        // the project is only deleted if every backup destination succeeded.
        useEditorStore.getState().clearMirrorStatuses();
        const projScripts = await api.listScripts(p.id);
        for (const sc of projScripts) {
          const resp = await api.getScript(p.id, sc.id);
          await mirrorSave({
            projectId: p.id,
            scriptId: sc.id,
            projectName: p.name,
            title: resp.meta.title,
            content: resp.content ?? {},
          });
        }
        const statuses = useEditorStore.getState().mirrorStatuses;
        if (Object.values(statuses).includes('error')) {
          showToast('Backup failed for one or more save locations — the project was NOT deleted.', 'error');
          setDeleting(false);
          return;
        }
        showToast(`"${p.name}" backed up to your save locations`, 'success');
      }
      await api.deleteProject(p.id);
      showToast(`Project "${p.name}" deleted`, 'success');
      setDeleteTarget(null);
      loadProjects();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Delete failed', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fs-sticky-tool fs-projects-tool">
      {level.view === 'scripts' && (
        <div className="fs-projects-crumb">
          <button className="fs-projects-back" onClick={backToProjects} title="All projects">‹ Projects</button>
          <span className="fs-projects-crumb-name">{level.project.name}</span>
        </div>
      )}

      <div className="fs-projects-list">
        {loading && <div className="fs-nav-empty">Loading…</div>}
        {!loading && error && <div className="fs-nav-empty">{error}</div>}

        {!loading && !error && level.view === 'projects' && (
          <>
            {projects.length === 0 && <div className="fs-nav-empty">No projects yet.</div>}
            {projects.map((p) => (
              <div
                key={p.id}
                className={`fs-project-row${currentProject?.id === p.id ? ' active' : ''}`}
                onClick={() => { if (renamingId !== p.id) setChooserTarget(p); }}
                title={renamingId === p.id ? undefined : 'Open, rename, or delete this project'}
              >
                {renamingId === p.id ? (
                  <input
                    className="fs-project-rename-input"
                    autoFocus
                    value={renameValue}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => void commitRename(p)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); void commitRename(p); }
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                  />
                ) : (
                  <span className="fs-project-name">{p.name}</span>
                )}
              </div>
            ))}
          </>
        )}

        {!loading && !error && level.view === 'scripts' && (
          <>
            {scripts.length === 0 && <div className="fs-nav-empty">No scripts in this project yet.</div>}
            {scripts.map((sc) => (
              <div
                key={sc.id}
                className="fs-project-row"
                onClick={() => navigate(`/project/${level.project.id}/edit/${sc.id}`)}
                title="Open in the editor"
              >
                <span className="fs-project-name">{sc.title}</span>
                <span className="fs-project-meta">{sc.page_count > 0 ? `${sc.page_count}p` : ''}</span>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="swn-add-row">
        {adding ? (
          <div className="fs-projects-add-row">
            <input
              autoFocus
              value={newName}
              placeholder={level.view === 'projects' ? 'Project name' : 'Script title'}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); void submitNew(); }
                if (e.key === 'Escape') { setAdding(false); setNewName(''); }
              }}
            />
            <button className="swn-add-btn" disabled={!newName.trim()} onClick={() => void submitNew()}>Add</button>
          </div>
        ) : (
          <button className="swn-add-btn" onClick={() => setAdding(true)}>
            {level.view === 'projects' ? '+ New Project' : '+ New Script'}
          </button>
        )}
      </div>

      {chooserTarget && (
        <div className="dialog-overlay" onClick={() => setChooserTarget(null)}>
          <div className="dialog-box fs-project-chooser-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              {chooserTarget.name}
              <button className="fs-dialog-x" onClick={() => setChooserTarget(null)} title="Close">&times;</button>
            </div>
            <div className="dialog-body fs-project-chooser-body">
              <button
                className="dialog-btn dialog-btn-primary"
                autoFocus
                onClick={() => { const t = chooserTarget; setChooserTarget(null); openProject(t); }}
              >Open</button>
              <button
                className="dialog-btn"
                onClick={() => { const t = chooserTarget; setChooserTarget(null); startRename(t); }}
              >Rename</button>
              <button
                className="dialog-btn"
                disabled={currentProject?.id === chooserTarget.id}
                title={currentProject?.id === chooserTarget.id
                  ? 'The currently open project can\u2019t be deleted'
                  : 'Delete this project\u2026'}
                onClick={() => { const t = chooserTarget; setChooserTarget(null); openDelete(t); }}
              >Delete</button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="dialog-overlay" onClick={closeDelete}>
          <div className="dialog-box fs-delete-project-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              Delete Project
              <button className="fs-dialog-x" onClick={closeDelete} title="Close">&times;</button>
            </div>
            <div className="dialog-body">
              <p>
                This permanently deletes <b>{deleteTarget.name}</b> and all of its
                scripts. This cannot be undone.
              </p>
              <label className="fs-delete-backup-check">
                <input
                  type="checkbox"
                  checked={backupFirst}
                  onChange={(e) => setBackupFirst(e.target.checked)}
                />
                Back up first — save all of this project's scripts to your enabled
                save locations, then remove the project from the Project Manager
              </label>
              <p className="fs-delete-confirm-label">
                Type <b>Delete Project</b> to confirm:
              </p>
              <input
                className="fs-delete-confirm-input"
                autoFocus
                value={deleteText}
                placeholder="Delete Project"
                onChange={(e) => setDeleteText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void confirmDelete(); }}
              />
            </div>
            <div className="dialog-footer">
              <button onClick={closeDelete} disabled={deleting}>Cancel</button>
              <button
                className="dialog-btn-primary"
                disabled={deleteText !== 'Delete Project' || deleting}
                onClick={() => void confirmDelete()}
              >
                {deleting ? (backupFirst ? 'Backing up…' : 'Deleting…') : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
