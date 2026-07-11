/**
 * DevPickerTool — a scratchpad that knows what you're pointing at.
 *
 * Turn Inspect on, type "the link isn't working in the", click the Notes tab, and
 * it writes "Notes — Right Panel" into the draft instead of opening the panel.
 * Copy, paste to me. The names come from the real registries (see devInspect), so
 * they're the names the code uses — which is the actual value here: it removes the
 * round trip where I have to ask which thing you meant.
 *
 * DEV ONLY, and deliberately self-contained: the whole feature is src/dev/ plus a
 * tool-registry entry and a View-menu item, both behind import.meta.env.DEV. To
 * remove it: delete src/dev/, drop the 'devpicker' case in ToolDock, the entry in
 * ALL_TOOLS, the ToolId union member, and the View > Developer block.
 */
import React from 'react';
import { createPortal } from 'react-dom';
import { describeElement, type Capture } from './devInspect';
import {
  runClaude, checkBridge, gitDiffStat, type PanelEvent,
} from './claudeClient';

const DRAFT_KEY = 'freescript:devpicker:draft';

interface Props { onClose?: () => void }

export default function DevPickerTool(_props: Props) {
  const [draft, setDraft] = React.useState(() => {
    try { return localStorage.getItem(DRAFT_KEY) || ''; } catch { return ''; }
  });
  const [inspecting, setInspecting] = React.useState(false);
  const [hover, setHover] = React.useState<{ rect: DOMRect; cap: Capture } | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [lastKind, setLastKind] = React.useState<string | null>(null);
  const areaRef = React.useRef<HTMLTextAreaElement | null>(null);

  // ── Claude Code, running in the repo on this machine (see dev-server/) ──
  const [bridge, setBridge] = React.useState<{ available: boolean; version?: string; hint?: string } | null>(null);
  const [log, setLog] = React.useState<PanelEvent[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [allowEdits, setAllowEdits] = React.useState(false);
  const [sessionId, setSessionId] = React.useState<string | undefined>();
  const [diff, setDiff] = React.useState('');
  const abortRef = React.useRef<AbortController | null>(null);
  const logRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => { void checkBridge().then(setBridge); }, []);
  React.useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [log]);

  const send = async () => {
    const prompt = draft.trim();
    if (!prompt || busy) return;
    setBusy(true);
    setLog((l) => [...l, { kind: 'text', text: `▸ ${prompt}` }]);
    setDraft('');
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      await runClaude({ prompt, sessionId, allowEdits, signal: ctrl.signal }, (e) => {
        if (e.kind === 'session') { setSessionId(e.sessionId); return; }
        if (e.kind === 'result' && e.sessionId) setSessionId(e.sessionId);
        setLog((l) => [...l, e]);
      });
      setDiff(await gitDiffStat());
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setLog((l) => [...l, { kind: 'error', message: String(err) }]);
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const stop = () => { abortRef.current?.abort(); setBusy(false); };

  // The draft outlives the panel being closed — losing a half-written note
  // because you docked something would defeat the purpose.
  React.useEffect(() => {
    try { localStorage.setItem(DRAFT_KEY, draft); } catch { /* not fatal */ }
  }, [draft]);

  /** Insert at the caret, not at the end — you're mid-sentence when you click. */
  const insert = React.useCallback((token: string) => {
    setDraft((cur) => {
      const el = areaRef.current;
      const at = el && document.activeElement === el ? el.selectionStart : cur.length;
      const before = cur.slice(0, at ?? cur.length);
      const after = cur.slice(at ?? cur.length);
      const pad = before && !/\s$/.test(before) ? ' ' : '';
      const next = `${before}${pad}${token}${after}`;
      // Put the caret back after what we just inserted.
      requestAnimationFrame(() => {
        const t = areaRef.current;
        if (!t) return;
        const pos = (before + pad + token).length;
        t.focus();
        t.setSelectionRange(pos, pos);
      });
      return next;
    });
  }, []);

  /**
   * While inspecting, the whole app is a picker: clicks are swallowed in the
   * CAPTURE phase so a click on File doesn't also open the File menu, and mousedown
   * / pointerdown too, since plenty of this app acts on those rather than click.
   */
  React.useEffect(() => {
    if (!inspecting) { setHover(null); return; }

    const ours = (e: Event) =>
      (e.target as HTMLElement | null)?.closest?.('[data-dev-panel]') != null;

    const onMove = (e: MouseEvent) => {
      if (ours(e)) { setHover(null); return; }
      const cap = describeElement(e.target);
      const el = e.target as HTMLElement;
      if (!cap || !el?.getBoundingClientRect) { setHover(null); return; }
      setHover({ rect: el.getBoundingClientRect(), cap });
    };

    const swallow = (e: Event) => {
      if (ours(e)) return;
      e.preventDefault();
      e.stopPropagation();
    };

    const onClick = (e: MouseEvent) => {
      if (ours(e)) return;
      e.preventDefault();
      e.stopPropagation();
      const cap = describeElement(e.target);
      if (!cap) return;
      insert(cap.name);
      setLastKind(cap.kind);
      // Shift-click keeps inspecting, for grabbing several names in a row.
      if (!e.shiftKey) setInspecting(false);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); setInspecting(false); }
    };

    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('pointerdown', swallow, true);
    document.addEventListener('mousedown', swallow, true);
    document.addEventListener('mouseup', swallow, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey, true);
    document.body.classList.add('dev-inspecting');
    return () => {
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('pointerdown', swallow, true);
      document.removeEventListener('mousedown', swallow, true);
      document.removeEventListener('mouseup', swallow, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKey, true);
      document.body.classList.remove('dev-inspecting');
    };
  }, [inspecting, insert]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch { /* clipboard blocked; the text is selectable anyway */ }
  };

  return (
    <div className="dev-picker" data-dev-panel>
      <div className="dev-picker-bar">
        <button
          className={`dev-picker-inspect${inspecting ? ' active' : ''}`}
          onClick={() => setInspecting((v) => !v)}
          title="Click things in the app to write their names into the draft. Shift-click to keep picking. Esc to stop."
        >{inspecting ? '◉ Picking — Esc to stop' : '◎ Inspect'}</button>
        <button className="dev-picker-btn" onClick={copy} disabled={!draft}>
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button
          className="dev-picker-btn"
          onClick={() => { setDraft(''); setLastKind(null); }}
          disabled={!draft}
        >Clear</button>
      </div>

      <textarea
        ref={areaRef}
        className="dev-picker-draft"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={'Type your note, then hit Inspect and click the thing you mean.\n\ne.g. "the link isn\'t working in the " → click the Notes tab →\n"the link isn\'t working in the Notes — Right Panel"'}
      />

      <div className="dev-picker-send">
        <button
          className="dev-picker-inspect"
          onClick={() => void send()}
          disabled={!draft.trim() || busy || !bridge?.available}
          title={bridge?.available
            ? 'Run this in the repo with Claude Code'
            : bridge?.hint ?? 'Checking for the Claude Code CLI…'}
        >{busy ? 'Working…' : 'Send to Claude Code'}</button>
        {busy && <button className="dev-picker-btn" onClick={stop}>Stop</button>}
        <label className="dev-picker-toggle" title="Off: Claude can read the repo but not change it. On: it can edit files and run the tests.">
          <input
            type="checkbox"
            checked={allowEdits}
            onChange={(e) => setAllowEdits(e.target.checked)}
            disabled={busy}
          />
          Allow edits
        </label>
      </div>

      {(log.length > 0 || diff) && (
        <div className="dev-picker-log" ref={logRef}>
          {log.map((e, i) => (
            <div key={i} className={`dev-log-${e.kind}`}>
              {e.kind === 'tool' ? <><b>{e.name}</b> {e.detail}</>
                : e.kind === 'error' ? e.message
                : e.kind === 'result' ? <>{e.text}{e.cost != null && <span className="dev-log-cost"> (${e.cost.toFixed(3)})</span>}</>
                : e.kind === 'done' ? null
                : e.kind === 'text' ? e.text
                : null}
            </div>
          ))}
          {diff && (
            <pre className="dev-log-diff" title="git diff --stat">{diff}</pre>
          )}
        </div>
      )}

      <div className="dev-picker-hint">
        {inspecting
          ? 'Clicks are being captured, not passed through. Shift-click to pick several.'
          : bridge && !bridge.available
            ? bridge.hint
            : lastKind
              ? `Last capture — ${lastKind}`
              : sessionId
                ? `Session live${allowEdits ? ' — edits allowed' : ' — read-only'}. Claude can see the repo.`
                : 'Inspect: click any menu, button, panel, card or script element.'}
      </div>

      {/* The hover outline lives on the body so no panel can clip it. */}
      {inspecting && hover && createPortal(
        <>
          <div
            className="dev-picker-outline"
            style={{
              top: hover.rect.top, left: hover.rect.left,
              width: hover.rect.width, height: hover.rect.height,
            }}
          />
          <div
            className="dev-picker-tip"
            style={{
              top: Math.max(4, hover.rect.top - 24),
              left: Math.max(4, hover.rect.left),
            }}
          >{hover.cap.name}</div>
        </>,
        document.body,
      )}
    </div>
  );
}
