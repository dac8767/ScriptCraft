import { Node, mergeAttributes } from '@tiptap/core';

export const General = Node.create({
  name: 'general',
  group: 'block',
  content: 'text*',
  defining: true,

  /**
   * v0.96 — a to-do added in the script must render as the SAME card as one added
   * in the To-Do window. A card has a title and a colour; a bare "[ ] ..." line
   * had nowhere to keep either, so the two could never truly match — the script
   * one was always a stripped-down imitation.
   *
   * These attrs give them a home, on the FIRST line of a to-do run (consecutive
   * [ ] lines are one list). They live in the document, so they travel with the
   * script and survive save/load like everything else in it.
   */
  addAttributes() {
    return {
      todoTitle: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-todo-title'),
        renderHTML: (attrs) =>
          (attrs.todoTitle ? { 'data-todo-title': attrs.todoTitle } : {}),
      },
      todoColor: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-todo-color'),
        renderHTML: (attrs) =>
          (attrs.todoColor ? { 'data-todo-color': attrs.todoColor } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="general"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    // Outline-line classification (Insert > Section / Marker / To-Do List)
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
