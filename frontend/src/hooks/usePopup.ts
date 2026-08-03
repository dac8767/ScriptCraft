/**
 * usePopup — the dismissal rules for a portalled, anchored popup (v5.95).
 *
 * Twenty popups in this app hand-rolled these, and they had drifted badly:
 * 5 of 20 dismissed on a capture-phase outside press, 7 of 20 on scroll,
 * 14 of 20 on Escape. Each of those three rules exists because of a specific
 * bug, and every popup that lacks one still has that bug.
 *
 *  1. **Capture phase, with an explicit inside test.** (v5.20, Derek:
 *     "opening the second closes the first.") Sibling controls call
 *     stopPropagation on pointerdown as their window-drag guard, so a
 *     bubble-phase listener never hears a press on them — and two menus sit
 *     open side by side. Capture runs before any stopPropagation.
 *  2. **Scroll dismisses, after a grace window.** The opening click itself
 *     can emit a scroll a frame later (focus scroll, anchoring), which killed
 *     menus the moment they opened. 150ms of grace, then genuine scrolling
 *     closes.
 *  3. **Escape**, which is what a writer reaches for.
 *
 * Position is measured from the trigger and applied as top/left — NEVER
 * bottom. A `position: fixed` box anchored by `bottom` with a `max-height`
 * and `overflow: auto` collapses to a sliver in WebKit (the house footgun).
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export interface PopupPos { top: number; left: number }

export interface UsePopupOptions {
  /** Gap between the trigger and the popup, in px. */
  gap?: number;
  /** 'left' aligns the popup's left edge to the trigger's; 'right' aligns
   *  its right edge, for a control near the window's right edge. */
  align?: 'left' | 'right';
  /** Assumed popup width when keeping it inside the viewport. */
  width?: number;
  /** Called after the popup closes — for a caller that must react to it. */
  onClose?: () => void;
}

export function usePopup(opts: UsePopupOptions = {}) {
  const { gap = 4, align = 'left', width = 200, onClose } = opts;
  const [pos, setPos] = useState<PopupPos | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const popupRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const close = useCallback(() => {
    setPos((p) => {
      if (p) onCloseRef.current?.();
      return null;
    });
  }, []);

  /** Open anchored to the trigger (or to an element passed explicitly). */
  const openAt = useCallback((el?: HTMLElement | null) => {
    const anchor = el ?? triggerRef.current;
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const left = align === 'right' ? r.right - width : r.left;
    setPos({
      top: r.bottom + gap,
      left: Math.max(8, Math.min(left, window.innerWidth - width - 8)),
    });
  }, [align, gap, width]);

  const toggle = useCallback((el?: HTMLElement | null) => {
    if (pos) close(); else openAt(el);
  }, [pos, close, openAt]);

  useEffect(() => {
    if (!pos) return;
    const openedAt = performance.now();

    const onPress = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (triggerRef.current?.contains(t)) return;   // the trigger toggles itself
      if (popupRef.current?.contains(t)) return;     // a press inside is not "outside"
      close();
    };
    const onScroll = () => { if (performance.now() - openedAt > 150) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };

    window.addEventListener('pointerdown', onPress, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('pointerdown', onPress, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', close);
    };
  }, [pos, close]);

  return { pos, isOpen: pos !== null, openAt, toggle, close, triggerRef, popupRef };
}
