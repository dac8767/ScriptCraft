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
 * v4.98/v4.99: COPY is the primary route. Pasting works because the paste
 * happens inside the iframe, by the user's own gesture. Dragging the chip as a
 * file works in Chromium but NOT in WKWebView (Derek, on the desktop app), so
 * the drag is offered only where canDragFiles() says the engine can carry it —
 * a control that looks like it works and does nothing is worse than no control
 * (CLAUDE.md §3). Save is the third route.
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
 * v4.99, Derek ("drag still doesn't work, but copy and pasting screenshots
 * work"): STOP OFFERING THE DRAG WHERE IT CANNOT WORK.
 *
 * CLAUDE.md §3 — a control that looks like it works and writes into the void
 * is worse than a missing control. WKWebView will not carry a File out of a
 * dragstart, so on Derek's machine the chip was an invitation to a gesture
 * that could only fail. This asks the engine the same question the real drag
 * asks — items.add(File), then does `types` report 'Files'? — on a throwaway
 * DataTransfer, at first use, with no user gesture needed. Where the answer
 * is no, the chip simply isn't draggable and leads with Copy.
 *
 * `make` is injected so the probe itself is testable; canDragFiles() is the
 * memoized real-engine call.
 */
export function probeFileDrag(make: () => DataTransfer): boolean {
  try {
    const dt = make();
    dt.items.add(new File([new Uint8Array(1)], 'probe.png', { type: 'image/png' }));
    return Array.from(dt.types).includes('Files');
  } catch {
    // No DataTransfer constructor, no items.add, or a throwing add — all of
    // them mean the same thing here: this engine can't hand over a file.
    return false;
  }
}

let fileDragSupport: boolean | null = null;
export function canDragFiles(): boolean {
  if (fileDragSupport === null) fileDragSupport = probeFileDrag(() => new DataTransfer());
  return fileDragSupport;
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
  const canDrag = canDragFiles();
  // v4.98: a toast is easy to miss, and "it just doesn't work" is the worst
  // thing this chip could say. Once the engine has told us it won't carry the
  // file, the hint line says so for good and points at Copy.
  const [dragRefused, setDragRefused] = useState(false);
  const onDragStart = (e: React.DragEvent) => {
    const ok = attachShotToDrag(e.dataTransfer, shot.file, shot.url);
    // Drag the picture, not a ghost of the whole chip.
    if (thumbRef.current) {
      const t = thumbRef.current;
      try { e.dataTransfer.setDragImage(t, t.width / 2, t.height / 2); } catch { /* optional */ }
    }
    if (!ok) {
      setDragRefused(true);
      showToast('This webview will not carry the file in a drag — use Copy, then paste into the form.', 'info');
    }
  };
  return (
    <div
      className={`feedback-shot-chip${canDrag ? ' feedback-shot-draggable' : ''}`}
      draggable={canDrag}
      onDragStart={canDrag ? onDragStart : undefined}
      title={canDrag ? "Drag me into the form's attachment field" : undefined}
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
          {canDrag && !dragRefused
            ? 'Drag this into the form’s attachment field — or Copy it and paste it in, or Save it and attach the file.'
            : 'Copy it, then click the form’s attachment field and paste. (Or Save it and attach the file.)'}
        </span>
      </span>
      {/* v4.98, Derek ("screenshot dragging is not working"): Copy is the route
          that does NOT depend on the webview carrying a file in a drag. The
          form is cross-origin, so the paste happens INSIDE it, by his own
          gesture — which is precisely why it reaches where our drag can't. */}
      <button
        className="feedback-shot-act"
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        title="Copy the image — then paste it into the form's attachment field"
        onClick={() => void copyCanvasToClipboard(shot.canvas).then((ok) => showToast(
          ok
            ? 'Screenshot copied — click the form\u2019s attachment field and paste.'
            : 'This webview would not give up the clipboard. Save the file and attach it instead.',
          ok ? 'success' : 'error',
        ))}
      ><FaRegCopy aria-hidden /></button>
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
