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

      /* ── vertical ruler ── (v4.22, Derek — canonical spec)
         Every mark is MEASURED off the real page-break separators, so nothing
         accumulates drift.

         Page view — each page is a full 0..pageHeight" scale with the top and
         bottom margins shaded ON TOP of that numbering (not added to it). Page
         tops/bottoms come straight from the .page-sep positions.

         Continuous view — the inter-page margins are compressed to the dashed
         gap, so the FIRST TEXT ROW of every page sits at the 1" mark: each
         region is numbered 1,2,3… from its first row down to the next dashed
         line (~10"). Page 1 is the exception — it renders its real top margin,
         so it also shows 0" at the physical page top with 0–1" shaded. No other
         shading in continuous (Derek: keep it clean until numbering is right). */
      {
        const T = RULER_THICKNESS;
        const H2 = Math.max(0, Ht - T);
        const ctx = setup(vc, T, H2);
        ctx.font = '9px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const topM = (pl.topMargin / 72) * inPx;       // top margin, px
        const botM = (pl.bottomMargin / 72) * inPx;    // bottom margin, px
        const shade = 'rgba(127,127,127,0.16)';
        const P1 = y0 - T;                             // physical top of page 1 (ruler-local)

        // Ticks + numbers for the linear map value(y) = valueAtOrigin + (y-originY)/inPx,
        // clipped to [clipTop, clipBottom]. value 0 draws a tick (no "0" label);
        // negatives are skipped.
        const drawScaleFrom = (originY: number, valueAtOrigin: number, clipTop: number, clipBottom: number) => {
          const lo = Math.max(clipTop, -10);
          const hi = Math.min(clipBottom, H2 + 10);
          if (hi < lo - 0.6) return;
          ctx.strokeStyle = text;
          ctx.fillStyle = text;
          ctx.globalAlpha = 0.55;
          ctx.beginPath();
          const step = 1 / minorSteps;
          let k = Math.ceil(((valueAtOrigin + (lo - originY) / unitPx)) / step - 1e-6);
          for (; ; k++) {
            const v = k * step;
            if (v < -1e-6) continue;                   // no marks above 0
            const y = Math.round(originY + (v - valueAtOrigin) * unitPx) + 0.5;
            if (y > hi + 0.6) break;
            if (y < lo - 0.6) continue;
            const isWhole = Math.abs(v - Math.round(v)) < 0.001;
            const isHalf = !isWhole && Math.abs(v * 2 - Math.round(v * 2)) < 0.001;
            if (isWhole) {
              const n = Math.round(v);
              if (n > 0) ctx.fillText(String(n), T / 2, y);
              else { ctx.moveTo(T - 9, y); ctx.lineTo(T - 3, y); }
            } else {
              const len = isHalf ? 7 : 4;
              ctx.moveTo(T - 3 - len, y);
              ctx.lineTo(T - 3, y);
            }
          }
          ctx.stroke();
          ctx.globalAlpha = 1;
        };

        if (continuous) {
          // Dashed page lines (ruler-local). Each .page-sep-line spans the gap
          // between the last row of one page and the first row of the next.
          const lines = Array.from(el.querySelectorAll<HTMLElement>('.page-sep-line'))
            .map((s) => s.getBoundingClientRect())
            .map((r) => ({ top: (r.top - er.top) - T, bottom: (r.bottom - er.top) - T }))
            .sort((a, b) => a.top - b.top);
          // Only page 1's real top margin is shaded.
          ctx.fillStyle = shade;
          ctx.globalAlpha = 1;
          ctx.fillRect(0, P1, T, topM);
          // Each page reads 1..10: first text row is "1", content bottom is "10".
          // The dashed divide sits one row BELOW that "10"; the next page's first
          // row ("1") sits one row below the divide — a 2-row breather so the two
          // pages never stack. Page 1 alone also shows 0" at the physical top.
          const ROW = inPx / 6;                          // one 12pt line = 1/6"
          let cTop = P1 + topM;
          let clipTop = P1;
          for (const g of lines) {
            drawScaleFrom(cTop, 1, clipTop, g.top - ROW); // "10" is one row above the divide
            cTop = g.top + ROW;                           // next page's first text row
            clipTop = cTop;                               // no 0" / margin above pages 2+
          }
          drawScaleFrom(cTop, 1, clipTop, H2 + 10);
        } else {
          // Page view: page i top = previous page's bottom margin end + gap; its
          // content-end (bottom-margin start) is the matching .page-sep. Both are
          // measured, so the 0..pageHeight" scale lands exactly on each page.
          const gap = PAGE_GAP_PX * zoom;
          const B = Array.from(el.querySelectorAll<HTMLElement>('.page-sep'))
            .map((s) => (s.getBoundingClientRect().top - er.top) - T)
            .sort((a, b) => a - b);
          const pageCount = Math.max(1, st.pageCount || 1);
          let top = P1;
          for (let i = 0; i < pageCount; i++) {
            if (i > 0) {
              if (i - 1 >= B.length) break;            // no measured boundary yet
              top = B[i - 1] + botM + gap;             // next physical page top
            }
            const contentEnd = i < B.length ? B[i] : top + (pageHpx - botM);
            const bottom = contentEnd + botM;          // physical page bottom
            if (bottom < -20 || top > H2 + 20) continue;
            ctx.fillStyle = shade;
            ctx.globalAlpha = 1;
            ctx.fillRect(0, top, T, topM);             // top margin band
            ctx.fillRect(0, bottom - botM, T, botM);   // bottom margin band
            drawScaleFrom(top, 0, top, bottom);        // 0" at page top … pageHeight" at bottom
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
