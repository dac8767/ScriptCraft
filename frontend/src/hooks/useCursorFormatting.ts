/**
 * useCursorFormatting — what the ribbon's pickers should be showing right now.
 *
 * v7.48, queue #7. I said the fourth stateful case in renderBuiltinControl was
 * `fontFamily` and that it would come out the way zoom, insertTable and
 * textColor did. That was wrong, and it is worth saying why rather than
 * quietly doing something else: those three OWNED their state. `fontFamily`
 * does not. It reads `cursorFont`, `extraFonts` and `locked`, and every one of
 * those is also read by `fontSize`, by the Scrapbook's font picker, and — in
 * `locked`'s case — by all thirty-three cases in the switch. Lifting the JSX
 * would have moved twenty-five lines and left the hundred and fifty lines of
 * actual logic behind, or duplicated the detector, which is the mistake this
 * project has made more than any other.
 *
 * So what comes out is the ENGINE, not the button: the three state fields, the
 * detector that fills them, and the two effects that drive it.
 *
 * WHAT MAKES IT WORTH TESTING. "What font is the cursor in" has three answers
 * depending on the selection, and each one used to be got wrong somewhere:
 *
 *   · EMPTY CURSOR — read the textStyle mark at the position. If there is no
 *     mark, the answer is not "nothing"; it is what the element's template rule
 *     says, and failing that the document default. A picker that goes blank
 *     when you click into clean text reads as broken.
 *   · A REAL SELECTION — walk every text node in it. All one font, show it;
 *     more than one, show BLANK, which is the picker's word for "mixed". The
 *     trap is that blank must not then be written back on the next render, or
 *     selecting mixed text and clicking away silently flattens it.
 *   · A SELECTION WITH NO TEXT IN IT — dragging across a blank line or a page
 *     break lands here. `nodesBetween` yields nothing, and without the
 *     `sawText` guard every font in the set is absent, so the code would take
 *     the "all one font" branch with an empty set and report the empty string:
 *     mixed. Same fallback as the empty cursor is the right answer.
 *
 * EXTRA FONTS. A document can carry a font the registry has never heard of —
 * from a paste, or from a machine that had it installed. If the picker only
 * lists the registry, that font is not selectable, and worse, the picker shows
 * blank while the text plainly is in something. So anything found in the doc
 * and missing from the registry is appended to the list. It only ever grows
 * within a session; that is deliberate, since a font you just formatted away
 * from should stay pickable to get back to.
 */
import { useState, useEffect, useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import { useEditorStore } from '../stores/editorStore';
import { useFormattingTemplateStore } from '../stores/formattingTemplateStore';
import { getCurrentElementRule, getLockedFormatting } from '../utils/effectiveFormatting';
import type { LockedFormatting } from '../utils/effectiveFormatting';
import { FONT_REGISTRY } from '../utils/fonts';

const NOTHING_LOCKED: LockedFormatting = {
  bold: false, italic: false, underline: false, strikethrough: false,
  textAlign: false, textColor: false, backgroundColor: false, textTransform: false,
  fontFamily: false, fontSize: false, subscript: false, superscript: false,
};

export interface CursorFormatting {
  /** Which attributes the active template forbids changing here. */
  locked: LockedFormatting;
  /** The font to show in the picker. '' means the selection is mixed. */
  cursorFont: string;
  /** The size to show. null means mixed. */
  cursorSize: number | null;
  /** Fonts present in the document that the registry does not list. */
  extraFonts: string[];
}

export function useCursorFormatting(editor: Editor | null): CursorFormatting {
  const fontFamily = useEditorStore((s) => s.fontFamily);
  const fontSize = useEditorStore((s) => s.fontSize);
  const activeTemplate = useFormattingTemplateStore((s) => s.getActiveTemplate());
  const isEnforceMode = activeTemplate.mode === 'enforce';

  // Per-attribute locking state — updates reactively when the cursor moves
  // between elements.
  const [locked, setLocked] = useState<LockedFormatting>(NOTHING_LOCKED);
  // The font/size of the text at the cursor. Empty string / null means the
  // selection spans more than one value ("mixed").
  const [cursorFont, setCursorFont] = useState<string>(fontFamily);
  const [cursorSize, setCursorSize] = useState<number | null>(fontSize);
  const [extraFonts, setExtraFonts] = useState<string[]>([]);

  const detectFormatting = useCallback(() => {
    if (!editor) return;

    const rule = getCurrentElementRule(editor, activeTemplate);
    setLocked(getLockedFormatting(rule, isEnforceMode));

    const { from, to, empty } = editor.state.selection;

    // For an empty cursor, fall back to the textStyle mark at that position.
    if (empty) {
      const attrs = editor.getAttributes('textStyle');
      const detectedFont = (attrs.fontFamily as string | undefined) || '';
      const detectedSize = (attrs.fontSize as string | undefined) || '';
      const effectiveFont = detectedFont || rule?.fontFamily || fontFamily;
      setCursorFont(effectiveFont);
      if (effectiveFont && !FONT_REGISTRY.find((f) => f.name === effectiveFont)) {
        setExtraFonts((prev) => (prev.includes(effectiveFont) ? prev : [...prev, effectiveFont]));
      }
      if (detectedSize) {
        const parsed = parseInt(detectedSize, 10);
        setCursorSize(!isNaN(parsed) ? parsed : (rule?.fontSize ?? fontSize));
      } else {
        setCursorSize(rule?.fontSize ?? fontSize);
      }
      return;
    }

    // For a real selection, walk the text nodes within [from, to]. If every
    // text node carries the same fontFamily / fontSize, show that value;
    // otherwise show the picker as blank to indicate "mixed".
    const fonts = new Set<string>();
    const sizes = new Set<string>();
    let sawText = false;
    editor.state.doc.nodesBetween(from, to, (node, pos) => {
      if (!node.isText || !node.text) return;
      const start = Math.max(pos, from);
      const end = Math.min(pos + node.nodeSize, to);
      if (end <= start) return;
      sawText = true;
      const ts = node.marks.find((m) => m.type.name === 'textStyle');
      const ff = (ts?.attrs.fontFamily as string | undefined) || '';
      const fs = (ts?.attrs.fontSize as string | undefined) || '';
      fonts.add(ff);
      sizes.add(fs);
    });

    if (!sawText) {
      // Selection contains only block boundaries / no text — fall back to cursor attrs.
      const attrs = editor.getAttributes('textStyle');
      const detectedFont = (attrs.fontFamily as string | undefined) || '';
      const detectedSize = (attrs.fontSize as string | undefined) || '';
      const effectiveFont = detectedFont || rule?.fontFamily || fontFamily;
      setCursorFont(effectiveFont);
      if (detectedSize) {
        const parsed = parseInt(detectedSize, 10);
        setCursorSize(!isNaN(parsed) ? parsed : (rule?.fontSize ?? fontSize));
      } else {
        setCursorSize(rule?.fontSize ?? fontSize);
      }
      return;
    }

    if (fonts.size > 1) {
      setCursorFont('');
    } else {
      const single = [...fonts][0] || '';
      const effective = single || rule?.fontFamily || fontFamily;
      setCursorFont(effective);
      if (effective && !FONT_REGISTRY.find((f) => f.name === effective)) {
        setExtraFonts((prev) => (prev.includes(effective) ? prev : [...prev, effective]));
      }
    }

    if (sizes.size > 1) {
      setCursorSize(null);
    } else {
      const single = [...sizes][0] || '';
      if (single) {
        const parsed = parseInt(single, 10);
        setCursorSize(!isNaN(parsed) ? parsed : (rule?.fontSize ?? fontSize));
      } else {
        setCursorSize(rule?.fontSize ?? fontSize);
      }
    }
  }, [editor, fontFamily, fontSize, activeTemplate, isEnforceMode]);

  useEffect(() => {
    if (!editor) return;
    editor.on('selectionUpdate', detectFormatting);
    editor.on('transaction', detectFormatting);
    // Run once on mount / editor ready
    detectFormatting();
    return () => {
      editor.off('selectionUpdate', detectFormatting);
      editor.off('transaction', detectFormatting);
    };
  }, [editor, detectFormatting]);

  // Collect all unique fonts used in the document (for extra fonts display).
  // This is the sweep, as opposed to the detector above which only ever sees
  // the font under the cursor — without it, a pasted font two pages away is
  // missing from the picker until you happen to click into it.
  useEffect(() => {
    if (!editor) return;
    const collectFonts = () => {
      const found = new Set<string>();
      editor.state.doc.descendants((node) => {
        if (node.isText && node.marks) {
          for (const mark of node.marks) {
            if (mark.type.name === 'textStyle' && mark.attrs.fontFamily) {
              const f = mark.attrs.fontFamily as string;
              if (!FONT_REGISTRY.find((r) => r.name === f)) {
                found.add(f);
              }
            }
          }
        }
      });
      if (found.size > 0) {
        setExtraFonts((prev) => {
          const merged = new Set([...prev, ...found]);
          return merged.size !== prev.length ? [...merged] : prev;
        });
      }
    };
    collectFonts();
    editor.on('update', collectFonts);
    return () => { editor.off('update', collectFonts); };
  }, [editor]);

  return { locked, cursorFont, cursorSize, extraFonts };
}
