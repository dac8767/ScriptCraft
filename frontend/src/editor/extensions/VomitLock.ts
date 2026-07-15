/**
 * VomitLock (v1.62) — the enforcement half of the Vomit Draft tool.
 *
 * While a sprint is running, previous text is immutable. Enforced with
 * filterTransaction — the transaction level — so nothing can sneak an edit
 * past it (keyboard, menus, paste, drag, undo all arrive as transactions).
 *
 * THE FLOOR. Everything before the floor is locked; at/after it is workable.
 *   floor = max(position captured at sprint start, start of the last block)
 * In practice: you can keep writing, fix the line you're currently on, and
 * change its element type — but the moment you move on to a new element, the
 * previous one becomes "previous text" and locks. Backspacing into it, or
 * joining into it with Delete, is rejected.
 *
 * NEVER SILENT. Every rejected transaction bumps blockedTick, which pulses
 * the timer pill and shows a (throttled) toast — a blocked edit is always
 * announced, per this repo's no-silent-no-ops rule.
 *
 * SCRIPT LOADS END THE SPRINT. Open/Import/New/History-restore all go through
 * tiptap's setContent, which is the only thing that stamps the 'preventUpdate'
 * meta (verified against @tiptap/core source). A doc-changing transaction
 * carrying that meta is a content load, not an edit: the sprint ends (with a
 * toast) and the load proceeds — so File operations keep working "as normal"
 * instead of being mysteriously dead for the length of the timer.
 */
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { Node as PMNode } from '@tiptap/pm/model';
import { useVomitStore } from '../../stores/vomitStore';
import { showToast } from '../../components/Toast';

/** Position just before the document's last top-level block. */
function lastBlockStart(doc: PMNode): number {
  const last = doc.lastChild;
  return last ? doc.content.size - last.nodeSize : 0;
}

/**
 * The floor to capture when a sprint starts on the CURRENT doc: if the doc
 * ends in a textblock, its existing text is locked but its very end stays
 * appendable (floor = one position before doc end, i.e. the end of that
 * block's text). The cursor is sent there by the tool on start.
 */
export function vomitFloorFor(doc: PMNode): number {
  const last = doc.lastChild;
  if (last && last.isTextblock) {
    return last.content.size === 0
      ? lastBlockStart(doc)          // empty tail block: whole block workable
      : doc.content.size - 1;        // tail block has text: append-only at its end
  }
  return doc.content.size;           // doc ends in a non-text node: append after it
}

/** Leftmost document position a step touches, or null for position-less steps
 *  (doc-attr changes and the like — none of them edit text). */
function stepFrom(step: unknown): number | null {
  const s = step as { from?: unknown; pos?: unknown };
  if (typeof s.from === 'number') return s.from;
  if (typeof s.pos === 'number') return s.pos;
  return null;
}

let lastToastAt = 0;
function announceBlocked() {
  useVomitStore.getState().bumpBlocked();
  const now = Date.now();
  if (now - lastToastAt > 2500) {   // key-repeat must not stack 30 toasts
    lastToastAt = now;
    showToast('Vomit Draft: previous text is locked until the timer ends. Keep writing!', 'info');
  }
}

export const VomitLock = Extension.create({
  name: 'vomitLock',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('vomitLock'),
        filterTransaction(tr, state) {
          const store = useVomitStore.getState();
          const session = store.session;
          if (!session || !tr.docChanged) return true;
          // Clock ran out — never outlive the timer. (null = Hemingway
          // mode, v1.74: no clock, holds until switched off.)
          if (session.endsAt !== null && Date.now() >= session.endsAt) return true;

          // Content load (setContent stamps 'preventUpdate'): end the sprint, let it through.
          if (tr.getMeta('preventUpdate') !== undefined) {
            store.end();
            showToast('Vomit Draft ended — the script changed.', 'info');
            return true;
          }

          const floor = Math.max(session.floor, lastBlockStart(state.doc));
          for (const step of tr.steps) {
            const from = stepFrom(step);
            if (from !== null && from < floor) {
              announceBlocked();
              return false;
            }
          }
          return true;
        },
      }),
    ];
  },
});

export default VomitLock;
