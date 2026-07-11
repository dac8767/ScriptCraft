/**
 * RenameDialog (File → Rename…) — rename the current project and/or script.
 *
 * Project renames go through the project's home API (local backend or cloud);
 * script renames go through scriptApi so "mode follows the file" routing
 * applies. The status bar and window title pick the new names up immediately.
 */
import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { cloudApi } from '../services/cloudApi';
import { scriptApi } from '../services/scriptApi';
import { useProjectStore } from '../stores/projectStore';
import { useEditorStore } from '../stores/editorStore';
import { showToast } from './Toast';

export default function RenameDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { currentProject, currentScriptId, setCurrentProject, isCloudScript } = useProjectStore();
  const { documentTitle, setDocumentTitle } = useEditorStore();
  const [projectName, setProjectName] = useState('');
  const [scriptName, setScriptName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setProjectName(currentProject?.name || '');
      setScriptName(documentTitle || '');
    }
  }, [open, currentProject, documentTitle]);

  if (!open) return null;

  const noDoc = !currentProject || !currentScriptId;
  const trimmedProject = projectName.trim();
  const trimmedScript = scriptName.trim();
  const projectChanged = !!currentProject && trimmedProject && trimmedProject !== currentProject.name;
  const scriptChanged = trimmedScript && trimmedScript !== documentTitle;
  const canApply = !saving && !noDoc && (projectChanged || scriptChanged) && trimmedProject && trimmedScript;

  const apply = async () => {
    if (!currentProject || !currentScriptId) return;
    setSaving(true);
    try {
      if (projectChanged) {
        const cloud = isCloudScript(currentProject.id, currentScriptId);
        const client = cloud ? cloudApi : api;
        await client.updateProject(currentProject.id, { name: trimmedProject });
        setCurrentProject({ ...currentProject, name: trimmedProject });
      }
      if (scriptChanged) {
        await scriptApi.saveScript(currentProject.id, currentScriptId, { title: trimmedScript });
        setDocumentTitle(trimmedScript);
      }
      showToast('Renamed', 'success');
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Rename failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="dialog-overlay"
      onMouseDown={(e) => {
        // Close only when the press STARTS on the overlay — a text-selection
        // drag that ends outside the box must not dismiss the dialog.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-box ws-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">Rename</div>
        <div className="dialog-body">
          {noDoc ? (
            <p className="prefs-hint">Open a script first — Rename applies to the current project and script.</p>
          ) : (
            <>
              <div className="dialog-row">
                <label>Project Name</label>
                <input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Project name"
                />
              </div>
              <div className="dialog-row" style={{ marginTop: 12 }}>
                <label>Script Name</label>
                <input
                  value={scriptName}
                  onChange={(e) => setScriptName(e.target.value)}
                  placeholder="Script name"
                  onKeyDown={(e) => { if (e.key === 'Enter' && canApply) { e.preventDefault(); void apply(); } }}
                />
              </div>
            </>
          )}
        </div>
        <div className="dialog-actions">
          <button onClick={onClose}>Cancel</button>
          <button className="dialog-primary" disabled={!canApply} onClick={() => void apply()}>
            {saving ? 'Renaming…' : 'Rename'}
          </button>
        </div>
      </div>
    </div>
  );
}
