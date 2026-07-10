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
                onClick={() => openProject(p)}
                title="Show this project's scripts"
              >
                <span className="fs-project-name">{p.name}</span>
                <span className="fs-project-chevron">›</span>
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
    </div>
  );
}
