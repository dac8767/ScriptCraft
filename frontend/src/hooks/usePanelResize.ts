/**
 * usePanelResize — the drag-to-resize edges of the left navigator and the
 * right tool panel (v5.88, lifted verbatim out of ScreenplayEditor).
 *
 * A pure move: same clamps (160–500 left, 200–600 right), same pointer
 * capture on the document rather than the grip — a resize must keep tracking
 * when the pointer outruns a 4px divider — and the same body cursor/select
 * lock for the duration of the drag.
 *
 * The one nuance worth keeping in sight: the LEFT edge grows with the
 * pointer and the RIGHT edge shrinks with it, because the right panel's
 * grip is on its left-hand side. Dragging right therefore widens one and
 * narrows the other, which is what a writer expects and what the two
 * opposite signs below are for.
 */
import { useCallback, useRef, useState } from 'react';

export interface PanelResize {
  navWidth: number;
  rightPanelWidth: number;
  setNavWidth: (n: number) => void;
  setRightPanelWidth: (n: number) => void;
  /** Attach to a divider's onPointerDown, naming which edge it is. */
  onResizePointerDown: (side: 'left' | 'right', e: React.PointerEvent) => void;
}

const LEFT_MIN = 160;
const LEFT_MAX = 500;
const RIGHT_MIN = 200;
const RIGHT_MAX = 600;

export function usePanelResize(initialNav = 240, initialRight = 300): PanelResize {
  const [navWidth, setNavWidth] = useState(initialNav);
  const [rightPanelWidth, setRightPanelWidth] = useState(initialRight);

  const resizingRef = useRef<'left' | 'right' | null>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const onResizePointerDown = useCallback((side: 'left' | 'right', e: React.PointerEvent) => {
    e.preventDefault();
    resizingRef.current = side;
    startXRef.current = e.clientX;
    startWidthRef.current = side === 'left' ? navWidth : rightPanelWidth;

    const onMove = (ev: PointerEvent) => {
      const delta = ev.clientX - startXRef.current;
      if (resizingRef.current === 'left') {
        setNavWidth(Math.max(LEFT_MIN, Math.min(LEFT_MAX, startWidthRef.current + delta)));
      } else {
        setRightPanelWidth(Math.max(RIGHT_MIN, Math.min(RIGHT_MAX, startWidthRef.current - delta)));
      }
    };

    const onUp = () => {
      resizingRef.current = null;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [navWidth, rightPanelWidth]);

  return { navWidth, rightPanelWidth, setNavWidth, setRightPanelWidth, onResizePointerDown };
}
