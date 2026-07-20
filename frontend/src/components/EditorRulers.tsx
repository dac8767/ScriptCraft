/**
 * EditorRulers (v2.95, Derek) — Word/Docs-style rulers on the editor's top
 * and left edges, toggled from View > Show Rulers.
 *
 * Both rulers are canvases inside a zero-size position:sticky pin, the
 * standard trick for chrome that must stay put inside a scroll container.
 * Geometry comes from the live DOM (the .page-sizer's rect vs the scroll
 * container's), so the marks track the page through scrolling, zooming and
 * page-layout changes without duplicating any layout math. Units follow
 * Settings > General (in/cm). The vertical scale restarts at every page
 * top, like Word; margin zones are shaded on both rulers.
 */
import React, { useEffect, useRef } from 'react';
import { useEditorStore } from '../stores/editorStore';
import { useSettingsStore } from '../stores/settingsStore';

export const RULER_THICKNESS = 20;

/** Extra px between two pages in Page view — the dark gap band. Matches
 *  ScreenplayEditor's `page-sep-gap` (40) added on top of the two margins.
 *  (Continuous view is measured from the real .page-sep-line gaps instead.) */
const PAGE_GAP_PX = 40;

const EditorRulers: React.FC<{ container: React.RefObject<HTMLDivElement | null>; continuous?: boolean }> = ({ container, continuous = false }) => {
  const pageLayout = useEditorStore((s) => s.pageLayout);
  const zoomLevel = useEditorStore((s) => s.zoomLevel);
  const units = useSettingsStore((s) => s.units);
  const hRef = useRef<HTMLCanvasElement>(null);
  const vRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    let raf = 0;

    const draw = () => {
      const hc = hRef.current;
      const vc = vRef.current;
      const sizer = el.querySelector<HTMLElement>('.page-sizer');
      if (!hc || !vc || !sizer) return;

      // The sticky pin's flow position starts at the container's CONTENT
      // edge (inside its padding), not the container's corner — measure the
      // drift each frame and counter it, so the rulers hug the corner both
      // at rest and once sticky engages.
      const pin = hc.parentElement as HTMLElement;
      pin.style.transform = 'none';
      const pr0 = pin.getBoundingClientRect();
      const er0 = el.getBoundingClientRect();
      pin.style.transform = `translate(${er0.left - pr0.left}px, ${er0.top - pr0.top}px)`;

      const st = useEditorStore.getState();
      const zoom = (st.zoomLevel || 100) / 100;
      const pl = st.pageLayout;
      const inPx = 96 * zoom;                                   // CSS px per inch on screen
      const unitPx = units === 'cm' ? inPx / 2.54 : inPx;       // px per ruler unit
      const minorSteps = units === 'cm' ? 2 : 4;                // half-cm / quarter-inch ticks

      const er = el.getBoundingClientRect();
      const sr = sizer.getBoundingClientRect();
      const x0 = sr.left - er.left;                             // page left, container-viewport coords
      const y0 = sr.top - er.top;                               // page top
      const pageWpx = pl.pageWidth * inPx;
      const pageHpx = pl.pageHeight * inPx;

      const dpr = window.devicePixelRatio || 1;
      const W = el.clientWidth;
      const Ht = el.clientHeight;

      // Theme colors come off the canvas's computed style (CSS vars can't be
      // read inside a canvas): text color from `color`, lines derived from it.
      const cs = getComputedStyle(hc);
      const text = cs.color;

      const setup = (c: HTMLCanvasElement, w: number, h: number) => {
        c.style.width = `${w}px`;
        c.style.height = `${h}px`;
        c.width = Math.max(1, Math.round(w * dpr));
        c.height = Math.max(1, Math.round(h * dpr));
        const ctx = c.getContext('2d')!;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        return ctx;
      };

      /* ── horizontal ruler ── */
      {
        const T = RULER_THICKNESS;
        const ctx = setup(hc, W, T);
        // margin shading: the writable area reads lighter than the margins
        ctx.fillStyle = 'rgba(127,127,127,0.16)';
        ctx.fillRect(x0, 0, pl.leftMargin * inPx, T);
        ctx.fillRect(x0 + pageWpx - pl.rightMargin * inPx, 0, pl.rightMargin * inPx, T);
        ctx.strokeStyle = text;
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = text;
        ctx.font = '9px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.beginPath();
        const totalUnits = (pl.pageWidth * inPx) / unitPx;
        for (let u = 0; u <= totalUnits + 0.001; u += 1 / minorSteps) {
          const x = Math.round(x0 + u * unitPx) + 0.5;
          if (x < -10 || x > W + 10) continue;
          const isWhole = Math.abs(u - Math.round(u)) < 0.001;
          const isHalf = !isWhole && Math.abs(u * 2 - Math.round(u * 2)) < 0.001;
          if (isWhole) {
            const n = Math.round(u);
            if (n > 0 && u < totalUnits - 0.05) ctx.fillText(String(n), x, T / 2);
            else { ctx.moveTo(x, T - 9); ctx.lineTo(x, T - 3); }
          } else {
            const len = isHalf ? 7 : 4;
            ctx.moveTo(x, T - 3 - len);
            ctx.lineTo(x, T - 3);
          }
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
        // bottom edge line
        ctx.globalAlpha = 0.35;
        ctx.beginPath(); ctx.moveTo(0, T - 0.5); ctx.lineTo(W, T - 0.5); ctx.stroke();
        ctx.globalAlpha = 1;
      }

      /* ── vertical ruler ── (v4.22, Derek)
         The old scale stacked pages by a COMPUTED height, so any mismatch grew
         page by page — the drift Derek saw. Continuous view is now MEASURED off
         the real page-break lines (.page-sep-line), so the grey gap sits exactly
         between the last row of one page and the first row of the next, and the
         inch scale resets on the real content, never accumulating error. Page
         view keeps the uniform page stride + the inter-page gap band. */
      {
        const T = RULER_THICKNESS;
        const H2 = Math.max(0, Ht - T);
        const ctx = setup(vc, T, H2);
        ctx.font = '9px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const topMarginIn = pl.topMargin / 72;      // pt → in
        const bottomMarginIn = pl.bottomMargin / 72;
        const shade = 'rgba(127,127,127,0.16)';

        // Inch marks + numbers filling one content region [top, bottom].
        const drawScale = (top: number, bottom: number) => {
          if (bottom < -20 || top > H2 + 20) return;   // region off-screen
          ctx.strokeStyle = text;
          ctx.fillStyle = text;
          ctx.globalAlpha = 0.55;
          ctx.beginPath();
          for (let u = 0; ; u += 1 / minorSteps) {
            const y = Math.round(top + u * unitPx) + 0.5;
            if (y > bottom + 0.6) break;
            if (y >= -10 && y <= H2 + 10) {
              const isWhole = Math.abs(u - Math.round(u)) < 0.001;
              const isHalf = !isWhole && Math.abs(u * 2 - Math.round(u * 2)) < 0.001;
              if (isWhole) {
                const n = Math.round(u);
                if (n > 0) ctx.fillText(String(n), T / 2, y);
                else { ctx.moveTo(T - 9, y); ctx.lineTo(T - 3, y); }
              } else {
                const len = isHalf ? 7 : 4;
                ctx.moveTo(T - 3 - len, y);
                ctx.lineTo(T - 3, y);
              }
            }
          }
          ctx.stroke();
          ctx.globalAlpha = 1;
        };

        if (continuous) {
          // Measured gaps (ruler-local y). .page-sep-line spans exactly the gap
          // between the last row of a page and the first row of the next.
          const gaps = Array.from(el.querySelectorAll<HTMLElement>('.page-sep-line'))
            .map((s) => s.getBoundingClientRect())
            .map((r) => ({ top: (r.top - er.top) - T, bottom: (r.bottom - er.top) - T }))
            .sort((a, b) => a.top - b.top);
          ctx.fillStyle = shade;
          ctx.globalAlpha = 1;
          ctx.fillRect(0, y0 - T, T, topMarginIn * inPx);          // page 1 top margin
          for (const g of gaps) ctx.fillRect(0, g.top, T, Math.max(0, g.bottom - g.top));
          // inch scale per content region (between consecutive gaps)
          let regionTop = (y0 - T) + topMarginIn * inPx;
          for (const g of gaps) { drawScale(regionTop, g.top); regionTop = g.bottom; }
          drawScale(regionTop, H2 + 10);
        } else {
          // Page view: uniform pages; stride includes the inter-page gap band.
          const pageSpan = pageHpx;
          const stride = pageSpan + PAGE_GAP_PX * zoom;
          const firstK = Math.max(0, Math.floor((0 - (y0 - T)) / stride));
          const lastK = Math.max(firstK, Math.ceil((H2 - (y0 - T)) / stride));
          for (let k = firstK; k <= lastK; k++) {
            const base = (y0 - T) + k * stride;
            ctx.fillStyle = shade;
            ctx.globalAlpha = 1;
            ctx.fillRect(0, base, T, topMarginIn * inPx);
            ctx.fillRect(0, base + pageSpan - bottomMarginIn * inPx, T, bottomMarginIn * inPx);
            drawScale(base, base + pageSpan);
          }
        }
        ctx.strokeStyle = text;
        ctx.globalAlpha = 0.35;
        ctx.beginPath(); ctx.moveTo(T - 0.5, 0); ctx.lineTo(T - 0.5, H2); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    };

    const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); };
    el.addEventListener('scroll', schedule, { passive: true });
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    // v4.22, Derek: the continuous ruler reads the real page-break lines, whose
    // positions shift as typing adds/removes pages — so also watch the sizer,
    // which grows with the content, and repaint when it changes.
    const sizerEl = el.querySelector('.page-sizer');
    if (sizerEl) ro.observe(sizerEl);
    schedule();
    return () => {
      el.removeEventListener('scroll', schedule);
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [container, units, pageLayout, zoomLevel, continuous]);

  return (
    <div className="fs-rulers-pin" aria-hidden="true">
      <canvas ref={hRef} className="fs-ruler fs-ruler-h" />
      <canvas ref={vRef} className="fs-ruler fs-ruler-v" />
      <div className="fs-ruler-corner" />
    </div>
  );
};

export default EditorRulers;
