// v5.25: the Markups anchor pair. NEW identifiers — the legacy `scriptNote`
// mark and its data are untouched (renaming persisted identifiers orphans
// user scripts; these are additions, not renames).
import { Mark, Node, mergeAttributes } from '@tiptap/core';

/** Range markups: a mark over the selected text. The highlight color (when
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

/** Point markups: a zero-width inline atom at the cursor position. It has no
 *  text content, so pagination line counts are untouched, and every exporter
 *  filters or drops non-text inline children (verified). */
export const MarkupAnchor = Node.create({
  name: 'markupAnchor',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,

  addAttributes() {
    return {
      markupId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-markup-id'),
        renderHTML: (attrs) => (attrs.markupId ? { 'data-markup-id': attrs.markupId } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-markup-anchor]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes({ 'data-markup-anchor': '', class: 'script-markup-anchor' }, HTMLAttributes)];
  },
});
