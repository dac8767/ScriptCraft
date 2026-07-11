/**
 * DevPickerTool — a scratchpad that knows what you're pointing at.
 *
 * Turn Inspect on, type "the link isn't working in the", click the Notes tab, and
 * it writes "Notes — Right Panel" into the draft instead of opening the panel.
 * Copy, paste into chat.
 *
 * v1.7: the Claude Code bridge that used to live here is GONE — no dev server
 * endpoint, no spawned process, nothing that reaches off this machine. This panel
 * is now pure local DOM inspection and a text box. The names come from the real registries (see devInspect), so
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
  captureApp, copyImage, buildBundle, downloadText, downloadShot, type Shot,
} from './devCapture';

const DRAFT_KEY = 'freescript:devpicker:draft';
const PHRASES_KEY = 'freescript:devpicker:phrases';

interface Props { onClose?: () => void }

export default function DevPickerTool(_props: Props) {
  const [draft, setDraft] = React.useState(() => {
    try { return localStorage.getItem(DRAFT_KEY) || ''; } catch { return ''; }
  });
  // Commonly used phrases — click to paste into the draft, save the current
  // draft as a new one. Kept in localStorage so they survive across sessions.
  const [phrases, setPhrases] = React.useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(PHRASES_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
    } catch { return []; }
  });
  const [inspecting, setInspecting] = React.useState(false);
  const [hover, setHover] = React.useState<{ rect: DOMRect; cap: Capture } | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [lastKind, setLastKind] = React.useState<string | null>(null);
  const areaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const [shots, setShots] = React.useState<Shot[]>([]);
  const [shooting, setShooting] = React.useState(false);
  const [countdown, setCountdown] = React.useState(0);
  const [flash, setFlash] = React.useState<string | null>(null);

  const say = (msg: string) => { setFlash(msg); setTimeout(() => setFlash(null), 1600); };

  /**
   * Take a shot. The delay exists because a dropdown closes the moment you click
   * anything else — so to photograph an OPEN menu you need to press the button,
   * then go and open it.
   */
  const shoot = async (delayMs = 0) => {
    if (shooting) return;
    setShooting(true);
    try {
      if (delayMs) {
        for (let left = Math.ceil(delayMs / 1000); left > 0; left--) {
          setCountdown(left);
          await new Promise((r) => setTimeout(r, 1000));
        }
        setCountdown(0);
      }
      const label = `Screenshot ${shots.length + 1}`;
      const shot = await captureApp(label);
      setShots((cur) => [...cur, shot]);
      // Reference it in the note, so the text and the picture stay tied together.
      insert(`[${label}]`);
      say('Captured');
    } catch (err) {
      say(`Capture failed: ${(err as Error).message}`);
    } finally {
      setShooting(false);
      setCountdown(0);
    }
  };

  const exportBundle = () => {
    const context = [
      `Screenshots: ${shots.length}`,
      `Theme: ${document.documentElement.getAttribute('data-theme') ?? 'unknown'}`,
      `Viewport: ${window.innerWidth}×${window.innerHeight}`,
    ];
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    downloadText(`freedraft-devnote-${stamp}.md`, buildBundle(draft, shots, context));
    say('Bundle saved — upload it in the chat');
  };


  // The draft outlives the panel being closed — losing a half-written note
  // because you docked something would defeat the purpose.
  React.useEffect(() => {
    try { localStorage.setItem(DRAFT_KEY, draft); } catch { /* not fatal */ }
  }, [draft]);

  React.useEffect(() => {
    try { localStorage.setItem(PHRASES_KEY, JSON.stringify(phrases)); } catch { /* not fatal */ }
  }, [phrases]);

  const savePhrase = () => {
    const p = draft.trim();
    if (!p) return;
    // Don't stack duplicates; move an existing match to the front instead.
    setPhrases((cur) => [p, ...cur.filter((x) => x !== p)]);
  };
  const removePhrase = (p: string) => setPhrases((cur) => cur.filter((x) => x !== p));

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
          onClick={savePhrase}
          disabled={!draft.trim()}
          title="Save the current draft as a reusable phrase"
        >＋ Phrase</button>
        <button
          className="dev-picker-btn"
          onClick={() => { setDraft(''); setShots([]); setLastKind(null); }}
          disabled={!draft && shots.length === 0}
        >Clear</button>
      </div>

      {phrases.length > 0 && (
        <div className="dev-picker-phrases">
          {phrases.map((p) => (
            <span key={p} className="dev-picker-phrase">
              <button
                className="dev-picker-phrase-paste"
                onClick={() => insert(p)}
                title={`Paste: ${p}`}
              >{p}</button>
              <button
                className="dev-picker-phrase-del"
                onClick={() => removePhrase(p)}
                title="Remove phrase"
              >×</button>
            </span>
          ))}
        </div>
      )}

      <div className="dev-picker-bar">
        <button
          className="dev-picker-btn dev-picker-shoot"
          onClick={() => void shoot(0)}
          disabled={shooting}
          title="Snapshot the app (the Dev Picker itself is left out)"
        >{shooting && !countdown ? 'Capturing…' : '⛶ Screenshot'}</button>
        <button
          className="dev-picker-btn"
          onClick={() => void shoot(3000)}
          disabled={shooting}
          title="Three seconds, then capture — long enough to open a menu first"
        >{countdown ? `${countdown}…` : '3s'}</button>
        <button
          className="dev-picker-btn"
          onClick={exportBundle}
          disabled={!draft.trim() && shots.length === 0}
          title="One .md file with the note AND the screenshots inside it — upload that in the chat"
        >Export .md</button>
      </div>

      {shots.length > 0 && (
        <div className="dev-picker-shots">
          {shots.map((s) => (
            <div className="dev-shot" key={s.id}>
              <img src={s.dataUrl} alt={s.label} />
              <div className="dev-shot-bar">
                <span className="dev-shot-label">{s.label}</span>
                <button
                  title="Copy the image — paste it straight into the chat"
                  onClick={async () => say(await copyImage(s)
                    ? 'Image copied — ⌘V in the chat'
                    : 'Clipboard blocked; use Save instead')}
                >Copy img</button>
                <button title="Save the PNG to disk" onClick={() => downloadShot(s)}>Save</button>
                <button
                  title="Remove"
                  onClick={() => setShots((cur) => cur.filter((x) => x.id !== s.id))}
                >✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <textarea
        ref={areaRef}
        className="dev-picker-draft"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={'Type your note, then hit Inspect and click the thing you mean.\n\ne.g. "the link isn\'t working in the " → click the Notes tab →\n"the link isn\'t working in the Notes — Right Panel"'}
      />

      <div className="dev-picker-hint">
        {flash
          ? flash
          : inspecting
          ? 'Clicks are being captured, not passed through. Shift-click to pick several.'
          : lastKind
            ? `Last capture — ${lastKind}`
            : 'Inspect: click any menu, button, panel, card or script element. Copy, and paste into chat.'}
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
