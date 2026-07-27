/**
 * ConfirmDialog (v2.23; prompt added v2.24) — the app's ONE confirm/prompt
 * primitive.
 *
 * Never use window.confirm / window.prompt / window.alert here. In the
 * desktop app Tauri's dialog plugin replaces them with async IPC shims,
 * which (a) return Promises, so the classic `if (!window.confirm(...))`
 * guard NEVER blocks — a Promise is always truthy — and (b) reject when the
 * command isn't permitted, which surfaced as the "ScriptCraft failed to
 * start" overlay when Derek deleted a title page. They only look fine in a
 * browser.
 *
 * Usage, from anywhere (same event-bus pattern as Toast):
 *   if (await confirmDialog('Delete this?', { danger: true })) { ... }
 *   const name = await promptDialog('Rename dictionary', oldName);  // null = cancelled
 *
 * The host (<ConfirmDialogHost/>, mounted once in App) renders a portalled
 * in-app modal — no native dialogs, no Tauri permissions involved.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button red for destructive actions. */
  danger?: boolean;
  /** v3.36: gate confirm behind typing this exact phrase (e.g. "Reset
   *  Everything") — the button and Enter stay dead until it matches. */
  requireText?: string;
  /** v3.49: three-way (save) mode — a middle button between Cancel and the
   *  confirm button (e.g. "Don't Save"). Only used by saveDialog. */
  tertiaryLabel?: string;
  /** v4.88: an extra checkbox under the prompt input ("Apply to all
   *  characters?"). Added HERE rather than as a bespoke dialog so every
   *  prompt in the app keeps the one shell — same shape, same Escape/Enter
   *  handling, same fail-safe. Read it with promptWithCheckbox. */
  checkboxLabel?: string;
  checkboxDefault?: boolean;
}

/** v3.49: the three outcomes of a save-before-closing prompt. */
export type SaveChoice = 'save' | 'discard' | 'cancel';

interface ConfirmRequest extends ConfirmOptions {
  id: number;
  message: string;
  /** Present = prompt mode: show a text input, resolve its value or null. */
  promptDefault?: string;
  /** v3.49: three-way mode — resolve 'save' | 'discard' | 'cancel'. */
  threeWay?: boolean;
  /** v4.88: resolve { value, checked } instead of a bare string. */
  withCheckbox?: boolean;
  resolve: (result: boolean | string | null | SaveChoice | PromptWithCheck) => void;
}

/** v4.88: what promptWithCheckbox resolves on confirm. */
export interface PromptWithCheck { value: string; checked: boolean }

let nextId = 0;
const listeners: Array<(req: ConfirmRequest) => void> = [];

function enqueue(req: ConfirmRequest, failSafe: boolean | null | SaveChoice) {
  if (listeners.length === 0) {
    // No host mounted (shouldn't happen in the app). Fail SAFE: a dialog
    // that can't be shown is a "no"/cancel, never a silent "yes".
    req.resolve(failSafe);
    return;
  }
  listeners.forEach((fn) => fn(req));
}

export function confirmDialog(message: string, opts: ConfirmOptions = {}): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    enqueue({ id: ++nextId, message, ...opts, resolve: resolve as ConfirmRequest['resolve'] }, false);
  });
}

export function promptDialog(message: string, defaultValue = '', opts: ConfirmOptions = {}): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    enqueue({ id: ++nextId, message, ...opts, promptDefault: defaultValue, resolve: resolve as ConfirmRequest['resolve'] }, null);
  });
}

/** v4.88: a prompt that also answers a yes/no question — the text and the
 *  checkbox come back together, so the caller makes ONE decision from ONE
 *  dialog. Fails SAFE to null (no host ⇒ nothing was asked, nothing is made). */
export function promptWithCheckbox(
  message: string,
  defaultValue = '',
  opts: ConfirmOptions & { checkboxLabel: string } = { checkboxLabel: '' },
): Promise<PromptWithCheck | null> {
  return new Promise<PromptWithCheck | null>((resolve) => {
    enqueue(
      { id: ++nextId, message, ...opts, promptDefault: defaultValue, withCheckbox: true, resolve: resolve as ConfirmRequest['resolve'] },
      null,
    );
  });
}

/** v3.49: a "save before leaving?" prompt with three outcomes. Fails SAFE to
 *  'cancel' when no host is mounted — a prompt that can't be shown must never
 *  silently close-and-lose or close-and-keep on the user's behalf. */
export function saveDialog(message: string, opts: ConfirmOptions = {}): Promise<SaveChoice> {
  return new Promise<SaveChoice>((resolve) => {
    enqueue({ id: ++nextId, message, ...opts, threeWay: true, resolve: resolve as ConfirmRequest['resolve'] }, 'cancel');
  });
}

const ConfirmDialogHost: React.FC = () => {
  const [queue, setQueue] = useState<ConfirmRequest[]>([]);
  const current = queue[0] ?? null;
  const inputRef = useRef<HTMLInputElement>(null);
  // v3.36: for requireText confirms — the typed value gates the OK button.
  const [typed, setTyped] = useState('');
  useEffect(() => { setTyped(''); }, [current?.id]);
  // v4.88: the optional checkbox. Mirrored into a ref because `answer` is a
  // stable useCallback — reading the state there would resolve a stale value.
  const [checked, setChecked] = useState(false);
  const checkRef = useRef(false);
  useEffect(() => {
    const def = !!current?.checkboxDefault;
    setChecked(def);
    checkRef.current = def;
  }, [current?.id, current?.checkboxDefault]);
  const requireOk = !current?.requireText || typed.trim() === current.requireText;

  useEffect(() => {
    const add = (req: ConfirmRequest) => setQueue((prev) => [...prev, req]);
    listeners.push(add);
    return () => {
      const idx = listeners.indexOf(add);
      if (idx >= 0) listeners.splice(idx, 1);
    };
  }, []);

  const answer = useCallback((kind: 'confirm' | 'cancel' | 'tertiary') => {
    setQueue((prev) => {
      const req = prev[0];
      if (req) {
        if (req.threeWay) {
          req.resolve(kind === 'confirm' ? 'save' : kind === 'tertiary' ? 'discard' : 'cancel');
        } else if (req.promptDefault !== undefined) {
          const value = inputRef.current?.value ?? '';
          if (kind !== 'confirm') req.resolve(null);
          else if (req.withCheckbox) req.resolve({ value, checked: checkRef.current });
          else req.resolve(value);
        } else {
          req.resolve(kind === 'confirm');
        }
      }
      return prev.slice(1);
    });
  }, []);

  useEffect(() => {
    if (!current) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); answer('cancel'); }
      // Enter only confirms when the required phrase (if any) has been typed.
      else if (e.key === 'Enter' && requireOk) { e.stopPropagation(); answer('confirm'); }
    };
    document.addEventListener('keydown', key, true);
    return () => document.removeEventListener('keydown', key, true);
  }, [current, answer, requireOk]);

  if (!current) return null;
  const isPrompt = current.promptDefault !== undefined;

  return createPortal(
    <div className="fs-confirm-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) answer('cancel'); }}>
      <div className="fs-confirm-box" role="alertdialog" aria-modal="true">
        {current.title && <div className="fs-confirm-title">{current.title}</div>}
        <div className="fs-confirm-message">{current.message}</div>
        {isPrompt && (
          <input
            key={current.id}
            ref={inputRef}
            autoFocus
            className="fs-confirm-input"
            defaultValue={current.promptDefault}
            onFocus={(e) => e.target.select()}
          />
        )}
        {current.checkboxLabel && (
          <label className="fs-confirm-check">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => { setChecked(e.target.checked); checkRef.current = e.target.checked; }}
            />
            <span>{current.checkboxLabel}</span>
          </label>
        )}
        {current.requireText && (
          <input
            key={`req-${current.id}`}
            autoFocus
            className="fs-confirm-input"
            value={typed}
            placeholder={`Type “${current.requireText}” to confirm`}
            onChange={(e) => setTyped(e.target.value)}
          />
        )}
        <div className="fs-confirm-actions">
          <button className="fs-confirm-cancel" onClick={() => answer('cancel')}>
            {current.cancelLabel ?? 'Cancel'}
          </button>
          {current.threeWay && current.tertiaryLabel && (
            <button className="fs-confirm-tertiary" onClick={() => answer('tertiary')}>
              {current.tertiaryLabel}
            </button>
          )}
          <button
            autoFocus={!isPrompt && !current.requireText}
            disabled={!requireOk}
            className={`fs-confirm-ok${current.danger ? ' fs-confirm-danger' : ''}`}
            onClick={() => answer('confirm')}
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
