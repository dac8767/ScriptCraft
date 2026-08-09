import { Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';
import { workingNoteKind } from '../../utils/workingNotes';

export const General = Node.create({
  name: 'general',
  group: 'block',
  content: 'text*',
  defining: true,

  /**
   * Outline-line classification (Insert > Section / Marker / To-Do List) so
   * View > Preview can hide each kind, themes can style them, and the ruler
   * can skip them (v4.54).
   *
   * v4.54: this used to be stamped in renderHTML — which ProseMirror does NOT
   * re-run when only a node's TEXT changes, so a hand-typed "# " kept a stale
   * (missing) class until the node happened to re-render. A decoration is
   * recomputed on every doc change, so the class always tracks the text; the
   * classification itself lives in utils/workingNotes, the same predicate the
   * exporters and the paginator use.
   */
  addProseMirrorPlugins() {
    const build = (doc: PMNode) => {
      const decos: Decoration[] = [];
      doc.descendants((node, pos) => {
        if (node.type.name !== 'general') return;
        const kind = workingNoteKind(node.textContent || '');
        if (kind) decos.push(Decoration.node(pos, pos + node.nodeSize, { class: `ol-${kind}` }));
        return false;                             // generals hold no block children
      });
      return DecorationSet.create(doc, decos);
    };
    return [
      new Plugin({
        key: new PluginKey('generalOutlineClass'),
        state: {
          init: (_config, state) => build(state.doc),
          apply: (tr, old) => (tr.docChanged ? build(tr.doc) : old),
        },
        props: {
          decorations(state) { return this.getState(state); },
        },
      }),
    ];
  },

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
      /** v1.0: a stable id for the list, so a manual reorder in the To-Do window
       *  keeps pointing at the same list even when the script above it changes
       *  (its document position, which we'd otherwise key on, would shift). */
      todoId: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-todo-id'),
        renderHTML: (attrs) => (attrs.todoId ? { 'data-todo-id': attrs.todoId } : {}),
      },
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
      /** v6.64: the outline SECTION this line was sent from (Send to Script).
       *  It makes the line a mirror rather than a copy — rename the section
       *  or change its page budget and utils/outlineScriptSync rewrites the
       *  line. Stored on the node like todoId, so the link travels with the
       *  script and survives save/load. */
      outlineSectionId: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-outline-section'),
        renderHTML: (attrs) =>
          (attrs.outlineSectionId ? { 'data-outline-section': attrs.outlineSectionId } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="general"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    // The ol- outline class is applied by the decoration plugin above, NOT
    // here \u2014 renderHTML output goes stale the moment the text changes.
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'general',
        class: 'screenplay-element general',
      }),
      0,
    ];
  },

  addKeyboardShortcuts() {
    return {};
  },
});
