/**
 * SettingsPage — the System tab (embedded in Settings) and the standalone
 * /settings route.
 *
 * v6.42, Derek: "The system tab in settings still has all of the old
 * collaboration server login stuff" — the ScriptCraft Cloud Server URL,
 * ScriptCraft Account (sign-in / register / Google / 2FA) and Account &
 * Security (devices, delete account) sections are GONE with the account
 * system's UI. The app is local-first: what remains here is what actually
 * operates on this machine — the reset. (The auth/cloud service layer still
 * exists in code, un-surfaced; see docs/HANDOFF-CONTINUE.md v6.42.)
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { useEditorStore } from '../stores/editorStore';
import { showToast } from './Toast';

const SettingsPage: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const navigate = useNavigate();

  // ── Reset all settings (v0.48) ──
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const handleResetAll = () => {
    useEditorStore.getState().resetAllSettings();
    setResetConfirmOpen(false);
    showToast('All settings reset to default', 'success');
  };

  return (
    <div className={`settings-page${embedded ? ' settings-page-embedded' : ''}`}>
      {!embedded && (
      <div className="settings-header">
        <button className="settings-back-btn" onClick={() => navigate(-1)} title="Go back">
          &larr;
        </button>
        <h1>System Settings</h1>
      </div>

      )}
      <div className="settings-content">
        {/* ── Reset All Settings ── */}
        <section className="settings-section">
          <h2 className="settings-section-title">Reset</h2>
          <p className="settings-section-desc">
            Reset all settings to their defaults: the default workspace, menu bar,
            toolbar, left and right panels, page template settings, and Page view
            for Editor View. This does not delete anything in your scripts and does
            not remove project or tool information.
          </p>
          <div className="settings-row">
            <button className="dialog-btn settings-reset-all-btn" onClick={() => setResetConfirmOpen(true)}>
              Reset All Settings to Default
            </button>
          </div>
        </section>
      </div>

      {resetConfirmOpen && (
        <div className="dialog-overlay fs-reset-confirm-overlay" onClick={() => setResetConfirmOpen(false)}>
          <div className="dialog-box fs-reset-confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">Are you sure?</div>
            <div className="dialog-body">
              <p>
                This resets the workspace, menu bar, toolbar, panels, page template
                settings, and Editor View back to their defaults. Your scripts,
                projects, saved workspaces, and tool information are not affected.
              </p>
            </div>
            <div className="dialog-footer">
              <button onClick={() => setResetConfirmOpen(false)}>Cancel</button>
              <button className="dialog-btn-primary" onClick={handleResetAll}>Yes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
