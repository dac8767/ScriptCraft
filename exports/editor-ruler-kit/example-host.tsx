/**
 * The MINIMUM host that makes the rulers correct.
 *
 * This is not a demo of a nice editor — it is the smallest DOM that satisfies
 * the contract in README §3, written out so you can diff your own host against
 * it when something looks off by a few pixels.
 *
 * The four things that matter are marked ▲.
 */
import React, { useRef, useState } from 'react';
import EditorRulers, { RULER_THICKNESS } from './EditorRulers';
import './editor-rulers.css';

const LAYOUT = {
  pageWidth: 8.5,
  pageHeight: 11,
  topMargin: 72,      // POINTS — see README §2
  bottomMargin: 72,   // POINTS
  leftMargin: 1.5,    // INCHES
  rightMargin: 0.7,   // INCHES
};

export default function ExampleHost() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [continuous, setContinuous] = useState(false);
  const [zoom, setZoom] = useState(100);
  const pages = [1, 2, 3];
  const z = zoom / 100;

  return (
    <>
      <button onClick={() => setContinuous((c) => !c)}>{continuous ? 'Page view' : 'Continuous'}</button>
      <button onClick={() => setZoom((v) => (v === 100 ? 150 : 100))}>Zoom {zoom}%</button>

      <div
        ref={scrollRef}
        className="editor-main"
        style={{
          position: 'relative',          // ▲ 1. the ruler pin is sticky INSIDE this
          overflow: 'auto',
          height: '100vh',
          display: 'flex',
          justifyContent: 'center',
          paddingTop: 30,                // ▲ 2. any padding here exercises §5.4
          background: '#2a2a2a',
        }}
      >
        {/* ▲ 3. FIRST child, before the pages */}
        <EditorRulers
          container={scrollRef}
          continuous={continuous}
          layout={LAYOUT}
          zoom={zoom}
          units="in"
          pageCount={pages.length}
        />

        {/* ▲ 4. the sizer's top-left corner IS page 1's top-left corner */}
        <div className="page-sizer" style={{ width: `${LAYOUT.pageWidth * z}in` }}>
          {pages.map((n, i) => (
            <div
              key={n}
              className="page"
              style={{
                position: 'relative',
                width: `${LAYOUT.pageWidth * z}in`,
                minHeight: `${LAYOUT.pageHeight * z}in`,
                padding: `${(LAYOUT.topMargin / 72) * z}in ${LAYOUT.rightMargin * z}in `
                       + `${(LAYOUT.bottomMargin / 72) * z}in ${LAYOUT.leftMargin * z}in`,
                background: '#fff',
                marginBottom: continuous ? 0 : 40 * z,   // the PAGE_GAP_PX the ruler assumes
              }}
            >
              <p>Page {n}</p>

              {/* A row that takes screen space but is dropped from print:
                  the ruler greys it and pauses the count (README §5.3). */}
              {i === 0 && <div className="ol-section">A section heading that does not print</div>}

              {/* The separator. Page view: at the END OF CONTENT — the top of
                  the bottom margin, NOT the page's bottom edge. */}
              {!continuous && (
                <div
                  className="page-sep"
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: `${(LAYOUT.bottomMargin / 72) * z}in`,
                  }}
                />
              )}

              {/* Continuous: the compressed gap between this page's last row
                  and the next page's first row. */}
              {continuous && i < pages.length - 1 && (
                <div
                  className="page-sep-line"
                  style={{ height: `${0.5 * z}in`, borderTop: '1px dashed #999' }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* The rulers occupy the first RULER_THICKNESS px of each edge — inset
          your own overlays (find bars, floating windows) by the same amount. */}
      <style>{`body.rulers-on .floating-thing { top: ${RULER_THICKNESS}px; }`}</style>
    </>
  );
}
