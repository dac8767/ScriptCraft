import { Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey, type Transaction } from '@tiptap/pm/state';

export const SceneHeading = Node.create({
  name: 'sceneHeading',
  group: 'block',
  content: 'text*',
  defining: true,

  // v3.45, Derek: scene headings are ALWAYS upper-cased in the text itself, not
  // just via CSS — so the Location tool, Fountain/PDF export and search all see
  // real caps. Fixes lowercase headings the moment you type or edit them (and
  // self-heals older lowercase ones on the next edit/open). Only a-z→A-Z, which
  // is length-preserving, so positions/marks/selection are untouched.
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('sceneHeadingUppercase'),
        appendTransaction: (trs, _oldState, newState) => {
          if (!trs.some((t) => t.docChanged)) return null;
          const edits: { from: number; to: number; text: string }[] = [];
          newState.doc.descendants((node, pos) => {
            if (node.type.name !== 'sceneHeading') return;
            node.descendants((child, offset) => {
              if (!child.isText || !child.text) return;
              const up = child.text.toUpperCase();
              // Skip anything whose case-fold changes length (e.g. ß→SS) so
              // positions never drift.
              if (up === child.text || up.length !== child.text.length) return;
              const from = pos + 1 + offset;
              edits.push({ from, to: from + child.text.length, text: up });
            });
          });
          if (edits.length === 0) return null;
          const tr: Transaction = newState.tr;
          // Same-length replacements ⇒ positions stay valid across the batch.
          for (const e of edits) tr.insertText(e.text, e.from, e.to);
          tr.setMeta('addToHistory', false);
          return tr;
        },
      }),
    ];
  },

  addAttributes() {
    return {
      sceneNumber: { default: null },
      locked: { default: false },
      synopsis: { default: '' },
      sceneColor: { default: '' },
      timingOverride: { default: null },  // seconds (null = auto-calculate)
      sequenceId: { default: null },       // links scene to a sequence defined at document level
    };
  },

  parseHTML() {
    return [{
      tag: 'div[data-type="scene-heading"]',
      getAttrs: (el) => {
        const dom = el as HTMLElement;
        return {
          synopsis: dom.getAttribute('data-synopsis') || '',
          sceneColor: dom.getAttribute('data-scene-color') || '',
          sequenceId: dom.getAttribute('data-sequence-id') || null,
        };
      },
    }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const attrs: Record<string, string> = {
      'data-type': 'scene-heading',
      class: 'screenplay-element scene-heading',
    };
    if (node.attrs.sceneNumber != null) {
      attrs['data-scene-number'] = String(node.attrs.sceneNumber);
    }
    if (node.attrs.synopsis) {
      attrs['data-synopsis'] = node.attrs.synopsis;
    }
    if (node.attrs.sceneColor) {
      attrs['data-scene-color'] = node.attrs.sceneColor;
    }
    if (node.attrs.sequenceId) {
      attrs['data-sequence-id'] = node.attrs.sequenceId;
    }
    return [
      'div',
      mergeAttributes(HTMLAttributes, attrs),
      0,
    ];
  },

  addKeyboardShortcuts() {
    return {
      Tab: ({ editor }) => {
        if (!editor.isActive('sceneHeading')) return false;
        // Tab from scene heading goes to action
        return editor
          .chain()
          .splitBlock()
          .setNode('action')
          .run();
      },
    };
  },

  addInputRules() {
    return [];
  },
});
