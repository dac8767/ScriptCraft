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
 */
import { useEffect, useRef, useState } from 'react';
import { HELP_FORMS } from '../data/helpForms';

/* Rect channel, tool → host. Module-level on purpose: this is transient
   per-frame geometry between exactly two parties — a store would persist and
   broadcast it. lastRect covers the mount-order race (tool up before host). */
let hostListener: ((r: DOMRect | null) => void) | null = null;
let lastRect: DOMRect | null = null;
function publishFeedbackRect(r: DOMRect | null) {
  lastRect = r;
  hostListener?.(r);
}

export default function FeedbackTool() {
  const ref = useRef<HTMLDivElement>(null);

  // rAF loop, not a ResizeObserver: the floating window is DRAGGED, which
  // moves the placeholder with no resize event. One getBoundingClientRect per
  // frame, and only while the window is open.
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

  return <div className="feedback-tool" ref={ref} />;
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
        title={HELP_FORMS.feedback.title}
      />
    </div>
  );
}
