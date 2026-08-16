/**
 * SavedFlash — the "Saved" confirmation, on the page.
 *
 * v7.14 moved it out of the bottom-right toast corner into the Quick Access
 * bar, because a save is not news from elsewhere: you pressed the key, and the
 * confirmation belongs where the Save button is.
 *
 * v7.25, Derek: "move the 'Saved' indicator so it is on the white page,
 * centered and about an inch down from the ruler. make the indicator larger."
 * The page is where his eyes already are.
 *
 * MEASURED, not assumed (the house rule for anything floating — see AddMenu):
 *   · the page is CENTERED in the scroller, and the scroller narrows when a
 *     side panel opens, so the centre is read off the page's own rect;
 *   · the ruler can be off (View ▸ Show Rulers), so the drop is measured from
 *     the ruler when there is one and from the scroller's top when there is
 *     not;
 *   · "an inch" is the PAGE's inch. The page carries a scale() zoom, so a flat
 *     96px would drift away from the ruler's own inch marks as soon as Derek
 *     zoomed. rect.width / pageWidthIn is the on-screen inch at any zoom.
 *
 * Portalled to the body and positioned by fixed top/left: an absolutely-
 * positioned child cannot escape the scroller's overflow, and anchoring by
 * `bottom` collapses the box in WebKit. Both are old scars in this codebase.
 */
import React from 'react';
import { createPortal } from 'react-dom';
import { subscribeSaveFlash, SAVE_FLASH_MS } from '../utils/saveFlash';

/** Derek: "about an inch down from the ruler." Not a Design knob — one that
 *  CSS never reads is a slider that does nothing, and the drop has to be
 *  applied in the page's measured inch, which CSS cannot see. */
export const DROP_IN = 1;

/** Where the chip sits, in viewport coordinates. */
export function savedFlashSpot(
  page: DOMRect | null,
  ruler: DOMRect | null,
  scroller: DOMRect | null,
  pageWidthIn: number,
  dropIn: number,
): { left: number; top: number } | null {
  const anchor = ruler ?? scroller;
  if (!page || !anchor || page.width <= 0) return null;
  // the page's own inch — it survives zoom, a flat 96px would not
  const pxPerIn = page.width / Math.max(1, pageWidthIn);
  return {
    left: Math.round(page.left + page.width / 2),
    top: Math.round(anchor.bottom + dropIn * pxPerIn),
  };
}

const SavedFlash: React.FC<{ pageWidthIn: number }> = ({ pageWidthIn }) => {
  const [text, setText] = React.useState<string | null>(null);
  const [spot, setSpot] = React.useState<{ left: number; top: number } | null>(null);
  const widthRef = React.useRef(pageWidthIn);
  widthRef.current = pageWidthIn;

  React.useEffect(() => {
    let timer = 0;
    return subscribeSaveFlash((t) => {
      const rect = (sel: string) => document.querySelector(sel)?.getBoundingClientRect() ?? null;
      /* Measured on SHOW. It is up for under two seconds, so tracking scroll
         or resize for the whole of its life buys nothing a listener could
         not cost. */
      setSpot(savedFlashSpot(rect('.page'), rect('.fs-ruler-h'), rect('.editor-main'), widthRef.current, DROP_IN));
      setText(t);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setText(null), SAVE_FLASH_MS);
    });
  }, []);

  if (!text || !spot) return null;
  return createPortal(
    <span className="fs-page-saved" role="status" style={{ left: spot.left, top: spot.top }}>
      {text}
    </span>,
    document.body,
  );
};

export default SavedFlash;
