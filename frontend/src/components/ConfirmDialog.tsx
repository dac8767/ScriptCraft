/**
 * ConfirmDialog (v2.23) — the app's ONE confirm primitive.
 *
 * Never use window.confirm here. In the desktop app Tauri's dialog plugin
 * replaces it with an async IPC shim, which (a) returns a Promise, so the
 * classic `if (!window.confirm(...))` guard NEVER blocks — a Promise is
 * always truthy — and (b) rejects when the command isn't permitted, which
 * surfaced as the "ScriptCraft failed to start" overlay when Derek deleted
 * a title page. It only looks fine in a browser.
 *
 * Usage, from anywhere (same event-bus pattern as Toast):
 *   if (await confirmDialog('Delete this?', { danger: true })) { ... }
 *
 * The host (<ConfirmDialogHost/>, mounted once in App) renders a portalled
 * in-app modal — no native dialogs, no Tauri permissions involved.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button red for destructive actions. */
  danger?: boolean;
}

interface ConfirmRequest extends ConfirmOptions {
  id: number;
  message: string;
  resolve: (ok: boolean) => void;
}

let nextId = 0;
const listeners: Array<(req: ConfirmRequest) => void> = [];

export function confirmDialog(message: string, opts: ConfirmOptions = {}): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    if (listeners.length === 0) {
      // No host mounted (shouldn't happen in the app). Fail SAFE: a confirm
      // that can't be shown is a "no", never a silent "yes".
      resolve(false);
      return;
    }
    listeners.forEach((fn) => fn({ id: ++nextId, message, ...opts, resolve }));
  });
}

const ConfirmDialogHost: React.FC = () => {
  const [queue, setQueue] = useState<ConfirmRequest[]>([]);
  const current = queue[0] ?? null;

  useEffect(() => {
    const add = (req: ConfirmRequest) => setQueue((prev) => [...prev, req]);
    listeners.push(add);
    return () => {
      const idx = listeners.indexOf(add);
      if (idx >= 0) listeners.splice(idx, 1);
    };
  }, []);

  const answer = useCallback((ok: boolean) => {
    setQueue((prev) => {
      prev[0]?.resolve(ok);
      return prev.slice(1);
    });
  }, []);

  useEffect(() => {
    if (!current) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); answer(false); }
      else if (e.key === 'Enter') { e.stopPropagation(); answer(true); }
    };
    document.addEventListener('keydown', key, true);
    return () => document.removeEventListener('keydown', key, true);
  }, [current, answer]);

  if (!current) return null;

  return createPortal(
    <div className="fs-confirm-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) answer(false); }}>
      <div className="fs-confirm-box" role="alertdialog" aria-modal="true">
        {current.title && <div className="fs-confirm-title">{current.title}</div>}
        <div className="fs-confirm-message">{current.message}</div>
        <div className="fs-confirm-actions">
          <button className="fs-confirm-cancel" onClick={() => answer(false)}>
            {current.cancelLabel ?? 'Cancel'}
          </button>
          <button
            autoFocus
            className={`fs-confirm-ok${current.danger ? ' fs-confirm-danger' : ''}`}
            onClick={() => answer(true)}
          >
            {current.confirmLabel ?? 'OK'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ConfirmDialogHost;
