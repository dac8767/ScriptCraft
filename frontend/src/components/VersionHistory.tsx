import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useProjectStore } from '../stores/projectStore';
import { useEditorStore } from '../stores/editorStore';
import { api } from '../services/api';
import type { VersionInfo } from '../services/api';
import DiffViewer from './DiffViewer';
import { showToast } from './Toast';
import { confirmDialog } from './ConfirmDialog';
import { withTimeout, SNAPSHOT_LOAD_TIMEOUT_MS } from '../utils/withTimeout';

function relativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? 's' : ''} ago`;
  if (diffDay < 30) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
}

/* v6.74, Derek: "currently the snapshot window appears as a side bar of its
   own style. make this window appear in the side panel like all other tool
   window." The fixed-position shell (.version-history-panel), its own title
   bar and its X are GONE — this is a tool BODY now, hosted by ToolDock like
   every other tool, with the label and Take Snapshot in the tool chrome
   (TOOL_CHROME TitleExtra below). */
export function SnapshotsTitleExtra() {
  return (
    <button
      className="version-history-take"
      title="Take a snapshot of this script"
      onClick={() => useEditorStore.getState().setTakeSnapshotRequest(true)}
    >+ Take Snapshot</button>
  );
}

const VersionHistory: React.FC = () => {
  const navigate = useNavigate();
  const { currentProject, currentScriptId, versions, setVersions, setVersionHistoryOpen, triggerScriptReload } =
    useProjectStore();

  const [selectedVersion, setSelectedVersion] = useState<VersionInfo | null>(null);
  const [diffText, setDiffText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compare mode — checkboxes on version rows. v6.74, Derek: the diff pair
  // lives in the PROJECT store — "the compare feature will open in the main
  // editor window", so ScreenplayEditor renders it as an editor-area
  // takeover instead of this window floating an overlay over the chrome.
  const [compareSelection, setCompareSelection] = useState<string[]>([]);  // commit hashes
  const setScriptCompare = useProjectStore((s) => s.setScriptCompare);

  const toggleCompareSelect = useCallback((hash: string) => {
    setCompareSelection((prev) => {
      if (prev.includes(hash)) return prev.filter((h) => h !== hash);
      if (prev.length >= 2) return [prev[1], hash]; // drop oldest, keep rolling window of 2
      return [...prev, hash];
    });
  }, []);

  const runScriptCompare = useCallback(async () => {
    if (!currentProject || !currentScriptId || compareSelection.length !== 2) return;
    try {
      const vA = versions.find((v) => v.hash === compareSelection[0]);
      const vB = versions.find((v) => v.hash === compareSelection[1]);
      if (!vA || !vB) {
        showToast('Selected snapshots no longer available', 'error');
        return;
      }
      // Order: earlier version = A, later = B
      const aIsEarlier = new Date(vA.date).getTime() < new Date(vB.date).getTime();
      const earlier = aIsEarlier ? vA : vB;
      const later = aIsEarlier ? vB : vA;

      // Fetch each version independently so a 404 on one side shows as an
      // "Added in this version" / "Removed before this version" state rather
      // than killing the whole compare.
      const fetchOrNull = async (hash: string) => {
        try {
          return await api.getScriptAtVersion(currentProject.id, hash, currentScriptId);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg.includes('404') || /not found/i.test(msg)) return null;
          throw e;
        }
      };

      const [respA, respB] = await Promise.all([
        fetchOrNull(earlier.hash),
        fetchOrNull(later.hash),
      ]);

      if (!respA && !respB) {
        showToast(
          `This script does not exist in either selected snapshot.`,
          'error',
        );
        return;
      }
      if (!respA) {
        showToast(
          `Script was added in ${later.short_hash}. It does not exist in ${earlier.short_hash}.`,
          'info',
        );
      }
      if (!respB) {
        showToast(
          `Script was removed before ${later.short_hash}. Showing only ${earlier.short_hash}.`,
          'info',
        );
      }

      const emptyDoc = { type: 'doc', content: [] };
      setScriptCompare({
        docA: (respA?.content || emptyDoc) as Record<string, unknown>,
        docB: (respB?.content || emptyDoc) as Record<string, unknown>,
        labelA: respA
          ? `${earlier.short_hash} · ${earlier.message}`
          : `${earlier.short_hash} · (script not in this snapshot)`,
        labelB: respB
          ? `${later.short_hash} · ${later.message}`
          : `${later.short_hash} · (script not in this snapshot)`,
      });
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to load snapshots for comparison',
        'error',
      );
    }
  }, [currentProject, currentScriptId, compareSelection, versions]);

  /* Load versions when the panel opens. v6.69, Derek: "forever stuck on
     Loading snapshots…". The wait is BOUNDED now — whatever the transport
     does, the spinner ends in a message the writer can act on. */
  const loadVersions = useCallback(async () => {
    if (!currentProject) return;
    setLoading(true);
    setError(null);
    try {
      const data = await withTimeout(
        api.getVersions(currentProject.id, currentScriptId || undefined),
        SNAPSHOT_LOAD_TIMEOUT_MS,
        'Snapshots did not answer. The server may be unreachable — check Settings → System Settings.',
      );
      setVersions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load snapshots');
    } finally {
      setLoading(false);
    }
  }, [currentProject, currentScriptId, setVersions]);

  // v6.73: versionsTick reloads the OPEN window — Take Snapshot bumps it, so
  // a snapshot taken from here appears right away.
  const versionsTick = useProjectStore((s) => s.versionsTick);
  useEffect(() => {
    if (currentProject) loadVersions();
  }, [currentProject, loadVersions, versionsTick]);

  const handleViewDiff = useCallback(
    async (version: VersionInfo, index: number) => {
      if (!currentProject) return;
      setSelectedVersion(version);

      // Diff against previous commit (or show first commit as-is)
      if (index >= versions.length - 1) {
        setDiffText('(Initial snapshot -- no previous snapshot to compare against)');
        return;
      }

      const prevVersion = versions[index + 1]; // versions are newest-first
      try {
        const result = await api.getVersionDiff(currentProject.id, prevVersion.hash, version.hash);
        setDiffText(result.diff || '(No changes)');
      } catch (err) {
        setDiffText(`Error loading diff: ${err instanceof Error ? err.message : 'unknown error'}`);
      }
    },
    [currentProject, versions]
  );

  const [restoreConfirm, setRestoreConfirm] = useState<VersionInfo | null>(null);

  const handleRestore = useCallback(
    (version: VersionInfo) => {
      setRestoreConfirm(version);
    },
    []
  );

  /* v6.73, Derek: "add a delete option for the snapshots in the snapshot
     window. show a warning window before deleting." Delete-one on each row,
     and Delete All in the footer — the one-click way out of the pile of
     'Auto save' entries versions before v6.72 wrote into this list. Both
     warn first; a snapshot deletes nothing but itself. */
  const handleDelete = useCallback(async (version: VersionInfo) => {
    if (!currentProject) return;
    const ok = await confirmDialog(
      `Delete snapshot ${version.short_hash} — "${version.message}"?\n\nOnly this saved version is deleted. Your script is not touched. This cannot be undone.`,
      { title: 'Delete Snapshot', confirmLabel: 'Delete', danger: true },
    );
    if (!ok) return;
    try {
      await api.deleteVersion(currentProject.id, version.hash);
      if (selectedVersion?.hash === version.hash) { setSelectedVersion(null); setDiffText(null); }
      setCompareSelection((sel) => sel.filter((h) => h !== version.hash));
      await loadVersions();
      showToast(`Snapshot ${version.short_hash} deleted`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not delete that snapshot', 'error');
    }
  }, [currentProject, selectedVersion, loadVersions]);

  const handleDeleteAll = useCallback(async () => {
    if (!currentProject || versions.length === 0) return;
    const ok = await confirmDialog(
      `Delete all ${versions.length} snapshot${versions.length === 1 ? '' : 's'} of this project?\n\nEvery saved version is deleted — including any old "Auto save" entries. Your script is not touched. This cannot be undone.`,
      { title: 'Delete All Snapshots', confirmLabel: 'Delete All', danger: true },
    );
    if (!ok) return;
    try {
      const { deleted } = await api.deleteAllVersions(currentProject.id);
      setSelectedVersion(null); setDiffText(null); setCompareSelection([]);
      await loadVersions();
      showToast(`Deleted ${deleted} snapshot${deleted === 1 ? '' : 's'}`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not delete the snapshots', 'error');
    }
  }, [currentProject, versions.length, loadVersions]);

  const handleRestoreConfirm = useCallback(
    async () => {
      if (!currentProject || !restoreConfirm) return;
      const version = restoreConfirm;
      setRestoreConfirm(null);
      try {
        await api.restoreVersion(currentProject.id, version.hash);
        await loadVersions();
        setSelectedVersion(null);
        setDiffText(null);

        // Check if the current script still exists after restore
        if (currentScriptId) {
          try {
            await api.getScript(currentProject.id, currentScriptId);
            // Script still exists — reload it in the editor
            triggerScriptReload();
          } catch {
            // Script was removed by the restore — go to project view
            setVersionHistoryOpen(false);
            navigate(`/project/${currentProject.id}`, { replace: true });
            showToast(`Restored to snapshot ${version.short_hash}. The open script no longer exists in this snapshot.`, 'info');
            return;
          }
        } else {
          triggerScriptReload();
        }
        showToast(`Restored to snapshot ${version.short_hash}`, 'success');
      } catch (err) {
        showToast(`Restore failed: ${err instanceof Error ? err.message : 'unknown error'}`, 'error');
      }
    },
    [currentProject, currentScriptId, restoreConfirm, loadVersions, navigate, setVersionHistoryOpen, triggerScriptReload]
  );


  return (
    <div className="version-history-body">
      {!currentProject && (
        <div className="version-history-empty">
          No project selected. Import or create a script first.
        </div>
      )}

      {error && (
        <div className="version-history-error">
          {error}
          {/* v6.69: never a dead end — the writer can try again without
              closing and reopening the window. */}
          <button className="version-history-retry" onClick={loadVersions}>Try again</button>
        </div>
      )}

      {loading && <div className="version-history-loading">Loading snapshots...</div>}

      {currentScriptId && versions.length >= 2 && (
        <div className="version-compare-bar">
          <span className="version-compare-info">
            {compareSelection.length === 0 && 'Check two snapshots to compare'}
            {compareSelection.length === 1 && 'Select one more snapshot to compare'}
            {compareSelection.length === 2 && 'Ready to compare'}
          </span>
          <button
            className="version-compare-btn"
            disabled={compareSelection.length !== 2}
            onClick={runScriptCompare}
          >
            Compare Selected
          </button>
          {compareSelection.length > 0 && (
            <button
              className="version-compare-clear"
              onClick={() => setCompareSelection([])}
            >
              Clear
            </button>
          )}
        </div>
      )}

      <div className="version-history-content">
        <div className="version-history-list">
          {versions.length > 0 && (
            <div className="version-history-listbar">
              <span className="version-history-count">{versions.length} snapshot{versions.length === 1 ? '' : 's'}</span>
              <button
                className="version-deleteall-btn"
                onClick={() => void handleDeleteAll()}
                title="Delete every snapshot of this project (your script is not touched)"
              >Delete All…</button>
            </div>
          )}
          {versions.length === 0 && !loading && currentProject && (
            <div className="version-history-empty">
              No snapshots yet. Use File &gt; Script History &gt; Take Snapshot to save one.
            </div>
          )}
          {versions.map((v, i) => (
            <div
              key={v.hash}
              className={`version-item ${selectedVersion?.hash === v.hash ? 'selected' : ''}${compareSelection.includes(v.hash) ? ' compare-selected' : ''}`}
              onClick={() => handleViewDiff(v, i)}
            >
              <div className="version-item-top">
                {currentScriptId && (
                  <input
                    type="checkbox"
                    className="version-compare-checkbox"
                    checked={compareSelection.includes(v.hash)}
                    onChange={(e) => { e.stopPropagation(); toggleCompareSelect(v.hash); }}
                    onClick={(e) => e.stopPropagation()}
                    title="Select for compare"
                  />
                )}
                <span className="version-hash">{v.short_hash}</span>
                <span className="version-date">{relativeTime(v.date)}</span>
              </div>
              <div className="version-message">{v.message}</div>
              <div className="version-item-actions">
                {currentScriptId && (
                  <button
                    className="version-view-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (currentProject && currentScriptId) {
                        setVersionHistoryOpen(false);
                        setSelectedVersion(null);
                        setDiffText(null);
                        navigate(`/project/${currentProject.id}/history/${currentScriptId}/${v.hash}`);
                      }
                    }}
                    title="View this snapshot in the editor (read-only)"
                  >
                    View
                  </button>
                )}
                <button
                  className="version-restore-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRestore(v);
                  }}
                  title="Restore this snapshot"
                >
                  Restore
                </button>
                <button
                  className="version-delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleDelete(v);
                  }}
                  title="Delete this snapshot (your script is not touched)"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        {diffText !== null && selectedVersion && (
          <div className="version-diff-area">
            <div className="version-diff-header">
              <span>
                Changes in {selectedVersion.short_hash}: {selectedVersion.message}
              </span>
              <button
                className="version-diff-close"
                onClick={() => {
                  setSelectedVersion(null);
                  setDiffText(null);
                }}
              >
                x
              </button>
            </div>
            <DiffViewer diff={diffText} />
          </div>
        )}
      </div>
      {restoreConfirm && (
        <div className="dialog-overlay" onClick={() => setRestoreConfirm(null)}>
          <div className="dialog-box" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">Restore Snapshot</div>
            <div className="dialog-body">
              <p style={{ margin: 0 }}>
                Restore to snapshot <strong>{restoreConfirm.short_hash}</strong>?
                This will create a new snapshot with the restored content.
              </p>
            </div>
            <div className="dialog-actions">
              <button onClick={() => setRestoreConfirm(null)}>Cancel</button>
              <button className="dialog-primary" onClick={handleRestoreConfirm}>
                Restore
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VersionHistory;
