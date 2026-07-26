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

        // v4.54, Derek: sections (# …), markers (⚑ …) and to-do lines ([ ] …)
        // take NO space in the final document (print/Preview/export drop
        // them), so the ruler numbers skip the screen space they occupy: the
        // band reads grayed out, the count pauses over it and resumes right
        // where it left off beneath. Note highlights are inline on script
        // text that DOES print, so they create no band; a line hidden by a
        // View toggle is display:none (zero rect) and drops out on its own.
        // Each band starts at the previous element's bottom edge so the
        // leading gap the note line adds is skipped along with it.
        const noteBands: { top: number; bottom: number }[] = [];
        el.querySelectorAll<HTMLElement>('.ol-section, .ol-marker, .ol-todo').forEach((n) => {
          const r = n.getBoundingClientRect();
          if (r.height < 1) return;                    // hidden via View toggles
          let bTop = (r.top - er.top) - T;
          const prevEl = n.previousElementSibling;
          if (prevEl) {
            const pb = (prevEl.getBoundingClientRect().bottom - er.top) - T;
            if (pb < bTop) bTop = pb;
          }
          const bBottom = (r.bottom - er.top) - T;
          const last = noteBands[noteBands.length - 1];
          if (last && bTop <= last.bottom + 1) last.bottom = Math.max(last.bottom, bBottom);
          else noteBands.push({ top: bTop, bottom: bBottom });
        });

        // Ticks + numbers for the linear map value(y) = valueAtOrigin + (y-originY)/inPx,
        // clipped to [clipTop, clipBottom]. value 0 draws a tick (no "0" label);
        // negatives are skipped.
        const drawTicks = (originY: number, valueAtOrigin: number, clipTop: number, clipBottom: number, terminal: boolean) => {
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
            const isWhole = Math.abs(v - Math.round(v)) < 0.001;
            if (y > hi + 0.6) {
              // Past the clip: always render the TERMINAL whole-inch label (page
              // view "11", continuous "10") even when sub-pixel rounding nudges
              // it a hair past the boundary — but never an extra tick or the next
              // number, so the last number is ALWAYS shown, every page.
              // (Only for the region's last segment — with skipped note bands
              // the region ends mid-inch and there is no terminal label.)
              if (terminal && isWhole && Math.round(v) > 0 && y <= hi + unitPx * 0.4) {
                ctx.fillText(String(Math.round(v)), T / 2, y);
              }
              break;
            }
            if (y < lo - 0.6) continue;
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

        // The band-aware scale: gray each note band, pause the count over it,
        // resume beneath with the value it left off at.
        const drawScaleFrom = (originY: number, valueAtOrigin: number, clipTop: number, clipBottom: number) => {
          const bands = noteBands.filter((b) => b.bottom > originY && b.top < clipBottom);
          let segY = originY;
          let segV = valueAtOrigin;
          for (const b of bands) {
            const bTop = Math.max(b.top, segY);
            const bBot = Math.min(b.bottom, clipBottom);
            drawTicks(segY, segV, Math.max(clipTop, segY), bTop, false);
            segV += Math.max(0, bTop - segY) / unitPx;
            const gTop = Math.max(bTop, clipTop);
            if (bBot > gTop) {
              ctx.fillStyle = shade;
              ctx.globalAlpha = 1;
              ctx.fillRect(0, gTop, T, bBot - gTop);
            }
            segY = Math.max(segY, bBot);
          }
          drawTicks(segY, segV, Math.max(clipTop, segY), clipBottom, bands.length === 0);
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
          // The dashed divide sits 0.25" BELOW that "10"; the next page's first
          // row ("1") sits 0.25" below the divide — a 0.5" breather so the two
          // pages never stack. Page 1 reads 0..10.25"; every later page 0.75..10.25".
          const QUARTER = inPx / 4;                      // 0.25"
          let cTop = P1 + topM;
          let clipTop = P1;
          for (const g of lines) {
            drawScaleFrom(cTop, 1, clipTop, g.top - QUARTER); // "10" is 0.25" above the divide
            cTop = g.top + QUARTER;                            // next page's first text row
            clipTop = cTop;                                    // no 0" / margin above pages 2+
          }
          drawScaleFrom(cTop, 1, clipTop, H2 + 10);
          // A dotted line across the ruler at each divide (between "10" and "1"),
          // matching the page-break line in the script. (v4.22, Derek.)
          ctx.strokeStyle = text;
          ctx.globalAlpha = 0.5;
          ctx.setLineDash([1.5, 2]);
          ctx.beginPath();
          for (const g of lines) {
            if (g.top < -2 || g.top > H2 + 2) continue;
            const y = Math.round(g.top) + 0.5;
            ctx.moveTo(0, y);
            ctx.lineTo(T, y);
          }
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
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
    // Switching Page ⇄ Continuous swaps the separator elements (.page-sep ⇄
    // .page-sep-line). That isn't a resize, so the ResizeObserver misses it and
    // the old ruler lingered until the next scroll. Watch the page subtree for
    // the structural/class change and repaint the instant the new view lands.
    const mo = new MutationObserver(schedule);
    if (sizerEl) mo.observe(sizerEl, { childList: true, subtree: true, attributeFilter: ['class'] });
    // Positions can settle a frame or two after that mutation (pagination
    // re-measures), so also repaint across a short window after any view/layout
    // change — cheap, and only fires on these infrequent switches.
    const bursts = [0, 80, 200, 400].map((ms) => window.setTimeout(schedule, ms));
    schedule();
    return () => {
      el.removeEventListener('scroll', schedule);
      ro.disconnect();
      mo.disconnect();
      bursts.forEach(clearTimeout);
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
