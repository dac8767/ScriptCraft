// v4.24: Help → Diagnostics, extracted from the 2.8k-line MenuBar (component
// split step 3; the audit named Diagnostics as MenuBar's first cut). The dialog
// owns its whole lifecycle: it collects the report on mount, so the parent
// keeps only the open flag.
import React, { useCallback, useEffect, useState } from 'react';
import { showToast } from './Toast';
import { Modal } from './Modal';

const DiagRow: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => (
  <tr>
    <td style={{ padding: '4px 8px', color: 'var(--fd-text-secondary)', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
      {label}
    </td>
    <td style={{
      padding: '4px 8px',
      color: 'var(--fd-text)',
      fontFamily: mono ? 'ui-monospace, Menlo, Consolas, monospace' : undefined,
      wordBreak: 'break-word',
    }}>
      {value}
    </td>
  </tr>
);

export function DiagnosticsDialog({ onClose }: { onClose: () => void }) {
  const [report, setReport] = useState<import('../services/diagnostics').DiagnosticsReport | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const { collectDiagnostics } = await import('../services/diagnostics');
      const r = await collectDiagnostics();
      if (alive) setReport(r);
    })();
    return () => { alive = false; };
  }, []);

  const handleCopy = useCallback(async () => {
    if (!report) return;
    try {
      const { formatReport } = await import('../services/diagnostics');
      await navigator.clipboard.writeText(formatReport(report));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('Could not copy to clipboard', 'error');
    }
  }, [report]);

  return (
    <Modal onClose={onClose} boxClassName="about-dialog">
        <div className="dialog-header">Diagnostics</div>
        <div className="dialog-body about-body">
          <p style={{ margin: 0, fontSize: 13, color: 'var(--fd-text-secondary)' }}>
            Runtime info to attach to bug reports. Click "Copy" to copy the
            full report to your clipboard, then paste it into the GitHub issue.
          </p>
          {report ? (
            <>
              {report.oneDriveSuspect && (
                <div style={{
                  marginTop: 12,
                  padding: '10px 12px',
                  background: '#fff8e1',
                  border: '1px solid #ffcc80',
                  borderRadius: 4,
                  color: '#8b5a00',
                  fontSize: 13,
                  lineHeight: 1.5,
                }}>
                  <strong>OneDrive interference suspected.</strong> Your app
                  data folder appears to be inside a OneDrive-synced
                  location. OneDrive can corrupt SQLite WAL files mid-write,
                  causing silent save failures. To fix this, exclude
                  ScriptCraft's data folder from OneDrive backup, or move your
                  Windows AppData folder out of OneDrive sync.
                </div>
              )}
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', marginTop: 12 }}>
                <tbody>
                  <DiagRow label="Version" value={report.appVersion} />
                  <DiagRow label="OS" value={report.os} />
                  <DiagRow label="Storage backend" value={report.storageMode} />
                  {report.storageError && (
                    <DiagRow label="Storage error" value={report.storageError} mono />
                  )}
                  {report.appDataDir && (
                    <DiagRow label="App data dir" value={report.appDataDir} mono />
                  )}
                  {report.sqliteDbPath && (
                    <DiagRow label="SQLite DB path" value={report.sqliteDbPath} mono />
                  )}
                </tbody>
              </table>
            </>
          ) : (
            <div style={{ marginTop: 12, color: 'var(--fd-text-secondary)' }}>Loading…</div>
          )}
        </div>
        <div className="dialog-actions">
          <button
            className="dialog-secondary"
            onClick={handleCopy}
            disabled={!report}
          >
            {copied ? 'Copied ✓' : 'Copy Report'}
          </button>
          <button className="dialog-primary" onClick={onClose}>Close</button>
        </div>
    </Modal>
  );
}
