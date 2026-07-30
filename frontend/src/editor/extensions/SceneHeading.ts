import { Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey, type Transaction } from '@tiptap/pm/state';

export const SceneHeading = Node.create({
  name: 'sceneHeading',
  group: 'block',
  content: 'text*',
  defining: true,

  // v3.45, Derek: scene headings are ALWAYS upper-cased in the text itself, not
  // just via CSS — so the Location tool, Fountain/PDF export and search all see
  // real caps. Fixes lowercase headings the moment you type or edit them. Only
  // a-z→A-Z, which is length-preserving, so positions/marks/selection are
  // untouched.
  //
  // v3.54, Derek: EDITS ONLY. This used to also fire on the transaction that
  // loads a script (setContent), which rewrote every heading and marked a
  // freshly-opened file dirty. setContent carries `preventUpdate`; skipping
  // those means opening an old script with lowercase headings no longer dirties
  // it — they still self-heal the moment you touch the script.
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('sceneHeadingUppercase'),
        appendTransaction: (trs, _oldState, newState) => {
          if (!trs.some((t) => t.docChanged && !t.getMeta('preventUpdate'))) return null;
          const edits: { from: number; to: number; text: string }[] = [];
          newState.doc.descendants((node, pos) => {
            if (node.type.name !== 'sceneHeading') return;
            node.descendants((child, offset) => {
              if (!child.isText || !child.text) return;
              const up = child.text.toUpperCase();
              // Skip anything whose case-fold changes length (e.g. ß→SS) so
              // positions never drift.
              if (up === child.text || up.length !== child.text.length) return;
              // v5.65, Derek's repro ("Carrier"→"cruiser", caret jumped to
              // the heading's end on every letter): replace ONLY the runs
              // that differ, never the whole text node. A caret strictly
              // INSIDE a replaced range maps to the range's end, so the old
              // whole-node replacement threw any mid-heading caret to the
              // end; a one-letter edit is a one-char range whose boundary
              // the caret sits on, which maps to itself.
              const base = pos + 1 + offset;
              for (let i = 0; i < child.text.length; i++) {
                if (child.text[i] === up[i]) continue;
                let j = i + 1;
                while (j < child.text.length && child.text[j] !== up[j]) j++;
                edits.push({ from: base + i, to: base + j, text: up.slice(i, j) });
                i = j;
              }
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
