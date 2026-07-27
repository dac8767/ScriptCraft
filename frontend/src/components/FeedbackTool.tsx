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
 * field — the capture becomes a chip above the form instead, and its
 * thumbnail is DRAGGABLE straight into the form's attachment dropzone (the
 * drag carries the PNG as a real file). Save is the fallback path. While a
 * capture runs, .fs-shot-veil-feedback on <body> hides this window and the
 * iframe host so the shot shows the app, not the Feedback window itself.
 */
import { useEffect, useRef, useState } from 'react';
import { FaCamera, FaCrop, FaDownload, FaTimes } from 'react-icons/fa';
import { HELP_FORMS } from '../data/helpForms';
import { captureToCanvas, saveScreenshotCanvas, screenshotFilename } from '../utils/screenshot';
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
   close/reopen is a feature: the capture is still there to drag in. */
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
        title="Screenshot the whole window — it appears above the form, ready to drag into the attachment field"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => void take('full')}
      ><FaCamera aria-hidden /></button>
      <button
        className="tool-ctl"
        title="Screenshot a selected area — it appears above the form, ready to drag into the attachment field"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => void take('area')}
      ><FaCrop aria-hidden /></button>
    </span>
  );
}

/**
 * v4.97, Derek ("make the file … the actual file so I can drag and drop it"):
 * load a dragstart with the capture as a genuine FILE, and REPORT whether it
 * took.
 *
 * Order matters. `items.add(file)` goes first: it is the only call that makes
 * the drop target see `dataTransfer.files`, which is what an attachment
 * dropzone looks for. `DownloadURL` is Blink's out-of-page file drag and is
 * ignored elsewhere. `text/plain` is LAST and only when no file attached —
 * setting it up front advertises a text drag, and a dropzone that sniffs
 * types then takes the text branch and quietly ignores the image.
 *
 * The return value is the point. `types` after the add is the engine telling
 * us whether it really carried a file, so a webview that won't do file drags
 * produces a message instead of a drag into the void.
 */
export function attachShotToDrag(dt: DataTransfer, file: File, url: string): boolean {
  let carriesFile = false;
  try {
    dt.items.add(file);
    carriesFile = Array.from(dt.types).includes('Files');
  } catch {
    /* engine without items.add — falls through to the text descriptor */
  }
  try {
    // mime:filename:absolute-url — Blink only; a no-op everywhere else.
    dt.setData('DownloadURL', `${file.type}:${file.name}:${url}`);
  } catch { /* not supported here */ }
  // WebKit refuses to START a drag with an empty dataTransfer (CLAUDE.md §4),
  // so there is always something set by the time we return.
  if (!carriesFile) dt.setData('text/plain', file.name);
  dt.effectAllowed = 'copy';
  return carriesFile;
}

/** The capture chip above the form. The WHOLE chip is the drag handle (v4.97
 *  — Derek drags "the file", not specifically its thumbnail); its buttons opt
 *  out so they still click. Dropping on the Airtable form's attachment
 *  dropzone uploads it — the one gesture the iframe boundary can't take
 *  away. */
function FeedbackShotChip({ shot }: { shot: FeedbackShot }) {
  const thumbRef = useRef<HTMLImageElement>(null);
  const onDragStart = (e: React.DragEvent) => {
    const ok = attachShotToDrag(e.dataTransfer, shot.file, shot.url);
    // Drag the picture, not a ghost of the whole chip.
    if (thumbRef.current) {
      const t = thumbRef.current;
      try { e.dataTransfer.setDragImage(t, t.width / 2, t.height / 2); } catch { /* optional */ }
    }
    if (!ok) {
      showToast('This webview will not carry the file in a drag — use Save and attach it from the file.', 'info');
    }
  };
  return (
    <div
      className="feedback-shot-chip"
      draggable
      onDragStart={onDragStart}
      title="Drag me into the form's attachment field"
    >
      <img
        ref={thumbRef}
        className="feedback-shot-thumb"
        src={shot.url}
        alt="Captured screenshot — drag into the form's attachment field"
        draggable={false}
      />
      <span className="feedback-shot-meta">
        <span className="feedback-shot-name">{shot.file.name}</span>
        <span className="feedback-shot-hint">
          Drag this into the form&rsquo;s attachment field — or Save it and attach the file.
        </span>
      </span>
      <button
        className="feedback-shot-act"
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        title="Save the PNG (screenshot folder, or Downloads)"
        onClick={() => void saveScreenshotCanvas(shot.canvas).catch(() => showToast('Could not save the screenshot.', 'error'))}
      ><FaDownload aria-hidden /></button>
      <button
        className="feedback-shot-act"
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
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
