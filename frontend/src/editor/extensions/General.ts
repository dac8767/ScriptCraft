import { Node, mergeAttributes } from '@tiptap/core';

export const General = Node.create({
  name: 'general',
  group: 'block',
  content: 'text*',
  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-type="general"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    // Outline-line classification (Insert > Section / Marker / Checklist Item)
    // so View > Preview can hide each kind, and themes can style them.
    const text = node.textContent || '';
    let olClass = '';
    if (/^#+\s/.test(text)) olClass = ' ol-section';
    else if (text.startsWith('\u2691')) olClass = ' ol-marker';
    else if (/^\[[ x]\]/.test(text)) olClass = ' ol-todo';
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'general',
        class: 'screenplay-element general' + olClass,
      }),
      0,
    ];
  },

  addKeyboardShortcuts() {
    return {};
  },
});
