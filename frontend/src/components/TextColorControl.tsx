/**
 * TextColorControl — the ribbon's text-colour button and its picker.
 *
 * v7.47: lifted out of Toolbar's renderBuiltinControl, the third of the four
 * cases in that switch carrying their own state (zoom v7.46, insertTable
 * v7.47).
 *
 * THIS ONE WAS NOT A CLEAN LIFT, and the reason is worth recording. There are
 * TWO text-colour controls — this one, which colours script text, and the
 * Scrapbook's, which colours a Scrapbook box — and they shared a single
 * `textColorOpen` flag purely because both were rendered by the same function.
 * They can never be on screen together (the Scrapbook branch returns before
 * the switch is reached), so sharing bought nothing and cost a real edge:
 * opening the Scrapbook picker and then closing the Scrapbook left the flag
 * true, so the script picker appeared already open. Each owns its own state
 * now, which is what they always should have had.
 *
 * The popup is PORTALLED to the body and positioned by a measured top/left.
 * An absolutely-positioned child cannot escape an ancestor's overflow or
 * stacking context, and anchoring by `bottom` collapses the box in WebKit —
 * both are old scars here, and both are why this cannot simply be a child of
 * the button.
 */
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@tiptap/react';
import ColorPicker from './ColorPicker';

interface TextColorControlProps {
  editor: Editor | null;
  /** The active template locks this control. */
  locked: boolean;
  showPopups: boolean;
}

const TextColorControl: React.FC<TextColorControlProps> = ({ editor, locked, showPopups }) => {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  const [currentTextColor, setCurrentTextColor] = useState('#000000');

  return (
    <div className="toolbar-group" style={{ position: 'relative' }}>
      <button
        className="toolbar-btn"
        title="Text Color"
        disabled={locked}
        onClick={(e) => {
          if (locked) return;
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setAnchor({ top: r.bottom + 4, left: r.left });
          setOpen(!open);
        }}
      >
        {/* v3.25, Derek: the A ALWAYS wears the picked color — black when
            black is chosen (the red-default special case is gone). */}
        <span
          className="fs-textcolor-icon"
          aria-hidden="true"
          style={{ color: currentTextColor }}
        >
          A
          <span className="fs-textcolor-bar" style={{ background: currentTextColor }} />
        </span>
      </button>
      {showPopups && open && anchor && createPortal(
        <div style={{ position: 'fixed', top: anchor.top, left: anchor.left, zIndex: 2147483647 }}>
          <ColorPicker
            value={currentTextColor}
            onChange={(color) => {
              setCurrentTextColor(color || '#000000');
              if (color) {
                editor?.chain().focus(undefined, { scrollIntoView: false }).setColor(color).run();
              } else {
                editor?.chain().focus(undefined, { scrollIntoView: false }).unsetColor().run();
              }
              setOpen(false);
            }}
            onClose={() => setOpen(false)}
          />
        </div>,
        document.body,
      )}
    </div>
  );
};

export default TextColorControl;
