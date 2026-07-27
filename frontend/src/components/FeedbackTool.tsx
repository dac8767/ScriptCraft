/**
 * FeedbackTool (v4.23, Derek) — the dockable side-panel form of Feedback. It
 * renders the SAME embedded feedback form the Help → Feedback menu opens in a
 * modal, reading the URL from the shared helpForms module so the two entry
 * points can't drift. Docking it lets the writer keep the form open beside the
 * script instead of in a blocking dialog.
 *
 * v4.35: the Airtable embed is PRELOADED. FeedbackFrameHost (mounted once in
 * App.tsx) owns the ONE iframe for the app's whole life; the tool body is just
 * a placeholder that streams its viewport rect to the host, and the host
 * overlays the iframe on that rect. Opening the window is instant — the form
 * loaded at app start — and closing it never unmounts (= never reloads) it.
 *
 * v4.70, Derek: screenshot buttons in the window header. The form lives in a
 * CROSS-ORIGIN Airtable iframe, so no script here can reach its attachment
 * field — the capture becomes a chip above the form instead, and the user
 * carries it across the boundary themselves.
 *
 * v5.00: TWO routes, both the user's own gesture inside the form — COPY the
 * image and paste it into the attachment field, or DOWNLOAD it and upload it.
 * Dragging the chip as a file is gone: it works in Chromium but never in
 * WKWebView, so in the desktop app it could only fail, and a control that
 * looks like it works and does nothing is worse than no control at all
 * (CLAUDE.md §3). Reintroducing it needs a NATIVE drag, driven from Rust.
 *
 * While a capture runs, .fs-shot-veil-feedback on <body> hides this window and
 * the iframe host so the shot shows the app, not the Feedback window itself.
 */
import { useEffect, useRef, useState } from 'react';
import { FaCamera, FaCrop, FaDownload, FaRegCopy, FaTimes } from 'react-icons/fa';
import { HELP_FORMS } from '../data/helpForms';
import { captureToCanvas, copyCanvasToClipboard, saveScreenshotCanvas, screenshotFilename } from '../utils/screenshot';
import { showToast } from './Toast';

/* Rect channel, tool → host. Module-level on purpose: this is transient
   per-frame geometry between exactly two parties — a store would persist and
   broadcast it. lastRect covers the mount-order race (tool up before host). */
let hostListener: ((r: DOMRect | null) => void) | null = null;
let lastRect: DOMRect | null = null;
function publishFeedbackRect(r: DOMRect | null) {
  lastRect = r;
  hostListener?.(r);
}

/* ── the capture, header buttons → chip (v4.70) ──────────────────────────
   Same module-level idiom as the rect channel: the buttons render in the
   window HEADER (ToolDock's TOOL_CHROME slot) while the chip renders in the
   window BODY — two components, one transient value. Surviving a window
   close/reopen is a feature: the capture is still there to copy or save. */
export interface FeedbackShot {
  file: File;
  /** object URL of the PNG, for the <img> thumbnail */
  url: string;
  /** kept for the Save button — saveScreenshotCanvas wants the canvas */
  canvas: HTMLCanvasElement;
}
let lastShot: FeedbackShot | null = null;
const shotListeners = new Set<(s: FeedbackShot | null) => void>();
/** Exported for tests — production code publishes only from this file. */
export function publishFeedbackShot(s: FeedbackShot | null) {
  const old = lastShot;
  lastShot = s;
  shotListeners.forEach((l) => l(s));
  if (old && old !== s) URL.revokeObjectURL(old.url);
}

/** The two screenshot buttons in the Feedback window's header (TOOL_CHROME
 *  Controls slot — floating header and docked strip alike). */
export function FeedbackShotControls() {
  const take = async (mode: 'full' | 'area') => {
    try {
      const canvas = await captureToCanvas(mode, 'fs-shot-veil-feedback');
      if (!canvas) return;                      // cancelled the area drag
      const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/png'));
      if (!blob) throw new Error('Could not encode the image.');
      const file = new File([blob], screenshotFilename(), { type: 'image/png' });
      publishFeedbackShot({ file, url: URL.createObjectURL(blob), canvas });
    } catch (e) {
      console.error('feedback screenshot failed', e);
      showToast('Could not capture a screenshot.', 'error');
    }
  };
  return (
    <span className="feedback-shot-btns">
      <button
        className="tool-ctl"
        title="Screenshot the whole window — it appears above the form, ready to copy or download"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => void take('full')}
      ><FaCamera aria-hidden /></button>
      <button
        className="tool-ctl"
        title="Screenshot a selected area — it appears above the form, ready to copy or download"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => void take('area')}
      ><FaCrop aria-hidden /></button>
    </span>
  );
}

/** The capture chip above the form. Two routes across the cross-origin
 *  boundary, both of them the USER's own gesture inside the form:
 *  Copy → paste, or Download → upload.
 *
 *  v5.00, Derek: DRAGGING IS GONE — code, affordance and language. WKWebView
 *  will not hand a File out of a dragstart, so on the desktop app it could
 *  only ever fail, and a control that looks like it works and does nothing is
 *  worse than a missing control (CLAUDE.md §3). Do not reintroduce it without
 *  a native drag (write the PNG to disk, drive it from Rust). */
function FeedbackShotChip({ shot }: { shot: FeedbackShot }) {
  return (
    <div className="feedback-shot-chip">
      <img
        className="feedback-shot-thumb"
        src={shot.url}
        alt="Captured screenshot"
      />
      <span className="feedback-shot-meta">
        <span className="feedback-shot-name">{shot.file.name}</span>
        <span className="feedback-shot-hint">
          Copy it and paste it into the form’s attachment field — or Download it
          and upload it there.
        </span>
      </span>
      <button
        className="feedback-shot-act"
        title="Copy the image — then paste it into the form's attachment field"
        onClick={() => void copyCanvasToClipboard(shot.canvas).then((ok) => showToast(
          ok
            ? 'Screenshot copied — click the form\u2019s attachment field and paste.'
            : 'This webview would not give up the clipboard. Download the file and upload it instead.',
          ok ? 'success' : 'error',
        ))}
      ><FaRegCopy aria-hidden /></button>
      <button
        className="feedback-shot-act"
        title="Download the PNG (screenshot folder, or Downloads) — then upload it to the form"
        onClick={() => void saveScreenshotCanvas(shot.canvas).catch(() => showToast('Could not save the screenshot.', 'error'))}
      ><FaDownload aria-hidden /></button>
      <button
        className="feedback-shot-act"
        title="Discard this capture"
        onClick={() => publishFeedbackShot(null)}
      ><FaTimes aria-hidden /></button>
    </div>
  );
}

export default function FeedbackTool() {
  const ref = useRef<HTMLDivElement>(null);
  const [shot, setShot] = useState<FeedbackShot | null>(lastShot);

  useEffect(() => {
    shotListeners.add(setShot);
    return () => { shotListeners.delete(setShot); };
  }, []);

  // rAF loop, not a ResizeObserver: the floating window is DRAGGED, which
  // moves the placeholder with no resize event. One getBoundingClientRect per
  // frame, and only while the window is open. The chip sits OUTSIDE the
  // placeholder, so the iframe host (which adopts the placeholder rect)
  // shrinks under it automatically.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (ref.current) publishFeedbackRect(ref.current.getBoundingClientRect());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      publishFeedbackRect(null); // host hides; the iframe stays alive
    };
  }, []);

  return (
    <div className="feedback-tool-wrap">
      {shot && <FeedbackShotChip shot={shot} />}
      <div className="feedback-tool" ref={ref} />
    </div>
  );
}

/** The persistent host — mounted ONCE in App.tsx, outside the routes, so it
 *  survives navigation and window open/close. Hidden = visibility + offscreen
 *  transform, never display:none or unmount: the loaded iframe must live. */
export function FeedbackFrameHost() {
  const [rect, setRect] = useState<DOMRect | null>(lastRect);

  useEffect(() => {
    // Same-geometry frames return prev so React bails out of re-rendering.
    const listen = (r: DOMRect | null) => setRect((prev) =>
      prev && r && prev.top === r.top && prev.left === r.left
        && prev.width === r.width && prev.height === r.height
        ? prev : r);
    hostListener = listen;
    listen(lastRect);
    return () => { if (hostListener === listen) hostListener = null; };
  }, []);

  return (
    <div
      className={`feedback-frame-host${rect ? '' : ' hidden'}`}
      style={rect ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height } : undefined}
    >
      <iframe
        className="feedback-tool-frame"
        src={HELP_FORMS.feedback.url}
        /* v4.36 batch-v10 #1: aria-label, NOT title — the app's HoverTooltip
           renders every [title] as a tooltip, and hovering the form popped a
           pointless "Feedback" bubble. The accessible name stays. */
        aria-label={HELP_FORMS.feedback.title}
      />
    </div>
  );
}
