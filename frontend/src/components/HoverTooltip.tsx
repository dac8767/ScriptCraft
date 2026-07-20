/**
 * HoverTooltip (v4.22, Derek) — a fast, app-wide replacement for the browser's
 * native `title` tooltip, whose show-delay is OS-controlled (~1.5s on macOS) and
 * cannot be shortened from CSS/HTML.
 *
 * Single source of truth: it reads the `title` attributes ALREADY on every
 * button and control — nothing per-component changes. On hover it stashes the
 * element's `title` into `data-tip-stash` and strips the attribute (which kills
 * the slow native bubble), then shows its own tooltip after TIP_DELAY. On leave
 * (or click / scroll / keydown / blur) it hides and restores the `title`, so the
 * attribute is always intact for the next hover and for accessibility.
 *
 * Mounted once at the app root. Portalled to <body> and positioned by measured
 * top/left (CLAUDE.md: never anchor floating chrome by `bottom`).
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const TIP_DELAY = 300;       // ms — was the OS default of ~1500ms
const STASH_ATTR = 'data-tip-stash';

type TipState = { text: string; x: number; y: number; above: boolean } | null;

export default function HoverTooltip() {
  const [tip, setTip] = useState<TipState>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  // The element whose title we've currently stashed/stripped.
  const activeRef = useRef<HTMLElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const clearTimer = () => { if (timerRef.current) clearTimeout(timerRef.current); timerRef.current = undefined; };

    // Put the stashed title back so it survives for the next hover / a11y.
    const restore = (el: HTMLElement | null) => {
      if (!el) return;
      const stashed = el.getAttribute(STASH_ATTR);
      if (stashed !== null) {
        el.setAttribute('title', stashed);
        el.removeAttribute(STASH_ATTR);
      }
    };

    const hide = () => {
      clearTimer();
      restore(activeRef.current);
      activeRef.current = null;
      setTip(null);
    };

    const show = (el: HTMLElement, text: string) => {
      const r = el.getBoundingClientRect();
      // Prefer below; flip above if it would run off the bottom of the viewport.
      const below = r.bottom + 8;
      const above = below > window.innerHeight - 40;
      setTip({
        text,
        x: Math.max(6, Math.min(r.left, window.innerWidth - 6)),
        y: above ? r.top - 8 : below,
        above,
      });
    };

    const onOver = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      // Find the nearest element that still carries a live title. (Our own
      // stripped element has none, so moving onto a title-less child of it
      // resolves to null and we simply keep the current tooltip.)
      const el = target?.closest<HTMLElement>('[title]') ?? null;
      if (!el) return;
      const text = el.getAttribute('title');
      if (!text || !text.trim()) return;
      if (el === activeRef.current) return;
      // Adopting a new target — restore the previous one first.
      if (activeRef.current && activeRef.current !== el) restore(activeRef.current);
      clearTimer();
      setTip(null);
      activeRef.current = el;
      el.setAttribute(STASH_ATTR, text);
      el.removeAttribute('title');
      timerRef.current = setTimeout(() => {
        // The node may have left the DOM while we waited.
        if (activeRef.current === el && el.isConnected) show(el, text);
      }, TIP_DELAY);
    };

    const onOut = (e: PointerEvent) => {
      const active = activeRef.current;
      if (!active) return;
      const to = e.relatedTarget as Node | null;
      // Still inside the active element (moved onto a child) — keep it.
      if (to && active.contains(to)) return;
      hide();
    };

    // Any of these mean the pointer/attention moved on — kill the tooltip.
    window.addEventListener('pointerover', onOver, true);
    window.addEventListener('pointerout', onOut, true);
    window.addEventListener('pointerdown', hide, true);
    window.addEventListener('wheel', hide, true);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('keydown', hide, true);
    window.addEventListener('blur', hide, true);

    return () => {
      window.removeEventListener('pointerover', onOver, true);
      window.removeEventListener('pointerout', onOut, true);
      window.removeEventListener('pointerdown', hide, true);
      window.removeEventListener('wheel', hide, true);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('keydown', hide, true);
      window.removeEventListener('blur', hide, true);
      hide();
    };
  }, []);

  if (!tip) return null;
  return createPortal(
    <div
      ref={tipRef}
      className="hover-tip"
      style={{
        left: tip.x,
        top: tip.y,
        transform: tip.above ? 'translateY(-100%)' : undefined,
      }}
      role="tooltip"
    >
      {tip.text}
    </div>,
    document.body,
  );
}
