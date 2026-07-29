// v5.25: the Markups anchor. A NEW identifier — the legacy `scriptNote`
// mark and its data are untouched (renaming persisted identifiers orphans
// user scripts; this is an addition, not a rename).
//
// ONE anchor mechanism, deliberately: the MARK. Point markups (created at a
// bare cursor) mark the whole current element; range markups mark the
// selection. An inline anchor NODE was tried first and is impossible in this
// schema — every element is `content: 'text*'`, so ProseMirror's replace-
// fitter silently DROPS the atom on insert (a phantom markup, no anchor).
import { Mark, mergeAttributes } from '@tiptap/core';

/** The markup anchor: a mark over script text. The highlight color (when
 *  the user picked one) paints the span; without one the span is invisible —
 *  the margin icon is the affordance. Exporters keep the TEXT and drop the
 *  mark (verified across fountain/FDX/PDF/DOCX), so nothing leaks. */
export const ScriptMarkupMark = Mark.create({
  name: 'scriptMarkup',
  inclusive: false,

  addAttributes() {
    return {
      markupId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-markup-id'),
        renderHTML: (attrs) => (attrs.markupId ? { 'data-markup-id': attrs.markupId } : {}),
      },
      highlight: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-markup-hl'),
        renderHTML: (attrs) => (attrs.highlight
          ? { 'data-markup-hl': attrs.highlight, style: `background-color: ${attrs.highlight}55;` }
          : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-markup-id]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes({ class: 'script-markup-highlight' }, HTMLAttributes), 0];
  },
});
