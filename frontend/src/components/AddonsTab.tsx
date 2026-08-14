/**
 * Settings ▸ Add-ons (v7.05, Derek: "create an add-on module where add-ons can
 * be installed").
 *
 * Lists every add-on the app knows about and lets you install or remove it.
 * An add-on that is not installed contributes NOTHING to the UI — no tool
 * window, no menu entry, no ribbon option — so this list is the only place it
 * appears until you install it.
 */
import React from 'react';
import { FaPuzzlePiece } from 'react-icons/fa';
import {
  ADDON_CATALOG, installAddon, removeAddon, isAddonInstalled, subscribeAddons,
} from '../addons/addonRegistry';
import { confirmDialog } from './ConfirmDialog';
import { showToast } from './Toast';

export default function AddonsTab() {
  // re-render on install/remove, wherever it was triggered from
  const [, bump] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => subscribeAddons(bump), []);

  const install = (id: string, name: string) => {
    installAddon(id);
    showToast(`${name} installed`, 'success');
  };

  const remove = async (id: string, name: string) => {
    const ok = await confirmDialog(
      `Remove ${name}? Its window and menu entry go back out of the app. `
      + 'You can install it again from here at any time.',
      { title: `Remove ${name}?`, confirmLabel: 'Remove', danger: true },
    );
    if (!ok) return;
    removeAddon(id);
    showToast(`${name} removed`, 'success');
  };

  return (
    <div className="prefs-general">
      <section>
        <h3>Add-ons</h3>
        <p className="prefs-hint" style={{ marginLeft: 0 }}>
          Extra features that stay out of the app until you install them.
          Everything listed here ships with ScriptCraft — nothing is downloaded.
        </p>

        {ADDON_CATALOG.length === 0 && (
          <div className="fs-addon-empty">No add-ons are available yet.</div>
        )}

        {ADDON_CATALOG.map((a) => {
          const on = isAddonInstalled(a.id);
          return (
            <div key={a.id} className="fs-addon-row">
              <span className="fs-addon-icon" aria-hidden="true"><FaPuzzlePiece /></span>
              <div className="fs-addon-info">
                <div className="fs-addon-name">
                  {a.name}
                  <span className="fs-addon-version">v{a.version}</span>
                  {on && <span className="fs-addon-badge">Installed</span>}
                </div>
                <div className="fs-addon-summary">{a.summary}</div>
                {a.details && <div className="fs-addon-details">{a.details}</div>}
              </div>
              {on ? (
                <button
                  className="dialog-btn dialog-btn-sm dialog-btn-danger"
                  onClick={() => { void remove(a.id, a.name); }}
                >Remove</button>
              ) : (
                <button
                  className="dialog-btn dialog-btn-sm dialog-btn-primary"
                  onClick={() => install(a.id, a.name)}
                >Install</button>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
