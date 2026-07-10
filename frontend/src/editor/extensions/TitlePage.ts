import { Node, mergeAttributes } from '@tiptap/core';

export interface TitlePageAttrs {
  field: string;
  // Structured title page metadata
  tpTitle: string;
  /** Optional second title line, sized independently. */
  tpTitle2: string;
  tpTitle2FontSize: number;
  tpWrittenBy: string;
  tpBasedOn: string;
  tpDraft: string;
  tpDraftDate: string;
  tpContact: string;
  tpCopyright: string;
  tpWgaRegistration: string;
  tpNotes: string;
  /** Title font size in points (default 12). */
  tpTitleFontSize: number;
}

export const TitlePage = Node.create({
  name: 'titlePage',
  group: 'block',
  content: 'text*',
  defining: true,

  addAttributes() {
    return {
      field: { default: 'title' },
      // Structured fields (stored on the title node with field='title')
      tpTitle: { default: '' },
      tpTitle2: { default: '' },
      tpTitle2FontSize: { default: 12 },
      tpWrittenBy: { default: '' },
      tpBasedOn: { default: '' },
      tpDraft: { default: '' },
      tpDraftDate: { default: '' },
      tpContact: { default: '' },
      tpCopyright: { default: '' },
      tpWgaRegistration: { default: '' },
      tpNotes: { default: '' },
      tpTitleFontSize: { default: 12 },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="title-page"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const field = node.attrs.field || 'title';
    const size = Number(node.attrs.tpTitleFontSize) || 12;
    const attrs: Record<string, string> = {
      'data-type': 'title-page',
      class: `screenplay-element title-page title-page-${field}`,
      'data-field': field,
    };
    // Apply a custom title font size (default 12pt is left to CSS).
    // The title2 block carries its size in its own tpTitleFontSize attr.
    // line-height snaps to a whole number of 12pt line slots so the rendered
    // block height matches the paginator's and builder's line accounting —
    // otherwise the title page grows past one page and every page after it
    // starts on the wrong line.
    if ((field === 'title' || field === 'title2') && size !== 12) {
      const slots = Math.max(1, Math.ceil(size / 12));
      attrs.style = `font-size: ${size}pt; line-height: ${slots * 12}pt`;
    }
    return ['div', mergeAttributes(HTMLAttributes, attrs), 0];
  },
});
