/**
 * Modal — the one dialog shell (v5.93).
 *
 * WHY THIS EXISTS. 44 dialogs hand-rolled the same three things, and they had
 * drifted apart in ways a writer can feel:
 *
 *  - **Escape.** Of five sampled, THREE did not close on Escape at all
 *    (About, Changelog, MoresContds). Every dialog closes on Escape now.
 *  - **The backdrop.** Most closed on a plain overlay `onClick`, which means
 *    selecting text inside the box and releasing outside it dismisses the
 *    dialog and throws the work away. SetDraftDialog had already learned this
 *    and closed on mousedown-that-STARTS-on-the-overlay. That is the rule
 *    here, so all 44 get the fix that one of them had.
 *  - **The stop-propagation on the box**, which everyone remembered, because
 *    forgetting it is instantly visible.
 *
 * Nested dialogs: Escape closes the TOP one only. A module-level stack tracks
 * depth — without it, opening a confirm on top of a dialog and pressing
 * Escape closed both, which is how a writer loses the thing underneath.
 */
import React, { useEffect, useRef } from 'react';

/** Every open Modal, innermost last. Escape only reaches the last one. */
const stack: symbol[] = [];

export interface ModalProps {
  onClose: () => void;
  /** Extra class for the box — the per-dialog sizing/skin class. */
  boxClassName?: string;
  /**
   * Escape closes, by default. Opt out for a dialog holding an edit that
   * would be lost — but prefer confirming over trapping the writer.
   */
  closeOnEscape?: boolean;
  /** Backdrop press closes, by default. */
  closeOnBackdrop?: boolean;
  /**
   * Full override of the box's class, for the few dialogs whose box is NOT
   * a `dialog-box` (the title-page editor's, say). Prefer `boxClassName`;
   * this exists so a dialog with its own skin can adopt the shell without
   * inheriting a base class that would restyle it.
   */
  boxClass?: string;
  /** Inline style on the box — a couple of dialogs pin a max-width. */
  boxStyle?: React.CSSProperties;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  onClose, boxClassName = '', closeOnEscape = true, closeOnBackdrop = true,
  boxClass, boxStyle, children,
}) => {
  const idRef = useRef<symbol>(Symbol('modal'));
  // The latest onClose, so the Escape listener never calls a stale one.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const id = idRef.current;
    stack.push(id);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (stack[stack.length - 1] !== id) return;   // an inner dialog owns it
      e.stopPropagation();
      closeRef.current();
    };
    if (closeOnEscape) window.addEventListener('keydown', onKey, true);
    return () => {
      const i = stack.indexOf(id);
      if (i >= 0) stack.splice(i, 1);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [closeOnEscape]);

  return (
    <div
      className="dialog-overlay"
      onMouseDown={(e) => {
        // Only when the press STARTS on the backdrop: a text-selection drag
        // that begins inside the box and ends out here must not dismiss it.
        if (closeOnBackdrop && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={boxClass ?? `dialog-box ${boxClassName}`.trim()}
        style={boxStyle}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

export default Modal;
