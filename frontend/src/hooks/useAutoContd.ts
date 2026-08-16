/**
 * useAutoContd — the (CONT'D) marker, extracted from ScreenplayEditor (v7.31).
 *
 * MOVED VERBATIM. ScreenplayEditor is 3,977 lines, which is why every change
 * to it starts with a hunt and why a third of the browser suite lists it as
 * covered. This is the first slice: one self-contained effect, its four
 * closure values now named parameters instead of things it happened to reach.
 *
 * Nothing about the rule changed — the whole point of a first slice is that
 * the suite proves it. See the effect's own comments below for the rule.
 */
import { useEffect } from 'react';
import type { Editor } from '@tiptap/react';

export function useAutoContd(
  editor: Editor | null,
  {
    characterContd,
    contdText,
    stripCharacterExtension,
  }: {
    characterContd: boolean;
    contdText: string;
    stripCharacterExtension: (name: string) => string;
  },
): void {
  // --- Auto CONT'D: add/remove (CONT'D) based on previous dialogue ---
  // Industry rule (Final Draft / WriterDuet / Fade In): append the continued
  // marker when the same character resumes speaking after action *within the same
  // scene*. A scene heading / transition resets continuation. A per-cue override
  // remembers when the writer deletes it so it is not re-added there. Gated by the
  // per-document characterContd setting; page-break (CONT'D)/(MORE) is separate.
  useEffect(() => {
    if (!editor || !characterContd) return;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    // Configured marker, e.g. "(CONT'D)", and an uppercase form for detection.
    const contdMarker = contdText.trim() || "(CONT'D)";
    const contdMarkerUpper = contdMarker.toUpperCase();

    // Elements that mark a new scene — they break dialogue continuation.
    const CONTD_RESET_TYPES = new Set(['sceneHeading', 'transition', 'newAct', 'endOfAct']);

    const updateContd = () => {
      const { doc } = editor.state;

      // First pass: collect all children and determine what each character node should be
      const children: { type: string; text: string; pos: number; attrs: Record<string, unknown> }[] = [];
      doc.forEach((node, offset) => {
        children.push({ type: node.type.name, text: node.textContent, pos: offset, attrs: node.attrs });
      });

      // Determine CONT'D status for each character node. A change may update the node's
      // text and/or its override attributes (contdSeen / contdSuppressed).
      interface ContdChange { pos: number; oldText: string | null; newText: string | null; attrs: Record<string, unknown> | null }
      const changes: ContdChange[] = [];
      let lastCharBase: string | null = null;
      let lastWasDialogue = false;

      for (const child of children) {
        if (child.type === 'character') {
          const raw = child.text.trim().toUpperCase();
          const base = stripCharacterExtension(raw);
          // Detect the configured marker as well as the standard forms, so an
          // existing marker is recognised even if the text setting was changed.
          const hasContd = /\(CONT'D\)|\(CONT'D\)|\(CONTD\)/i.test(raw) || raw.includes(contdMarkerUpper);
          const contdAuto = child.attrs.contdAuto === true;
          const contdSuppressed = child.attrs.contdSuppressed === true;
          const shouldHaveContd = lastCharBase !== null && base === lastCharBase && !lastWasDialogue;

          const setText = (newText: string) =>
            changes.push({ pos: child.pos, oldText: child.text, newText, attrs: null });
          const setAttrs = (patch: Record<string, unknown>) =>
            changes.push({ pos: child.pos, oldText: null, newText: null, attrs: { ...child.attrs, ...patch } });

          // Golden rule: the automation only ever adds/removes a (CONT'D) it added
          // itself (contdAuto). A (CONT'D) the writer typed is never touched.
          if (shouldHaveContd && base) {
            if (contdSuppressed) {
              // Writer opted out here. If they re-typed (CONT'D), respect it as their
              // own (manual) and forget the opt-out; otherwise leave the cue untouched.
              if (hasContd) setAttrs({ contdSuppressed: false });
            } else if (!hasContd) {
              if (contdAuto) {
                // An auto (CONT'D) was here and is now gone → writer removed it → remember.
                setAttrs({ contdSuppressed: true, contdAuto: false });
              } else {
                // Genuine first-time auto-add.
                setText(`${base} ${contdMarker}`);
                setAttrs({ contdAuto: true });
              }
            } else if (contdAuto && !raw.endsWith(contdMarkerUpper)) {
              // Present and auto-added, but the marker text was changed in settings →
              // normalise it to the configured text. Manually typed markers are left.
              setText(`${base} ${contdMarker}`);
            }
            // else hasContd && !suppressed: present (manual, or already correct) → leave it.
          } else {
            // Not a continuation here (different speaker, or after a scene reset).
            // Only strip a now-stale (CONT'D) the automation itself added — never a
            // manually typed one.
            if (hasContd && contdAuto) setText(base);
            if (contdAuto || contdSuppressed) setAttrs({ contdAuto: false, contdSuppressed: false });
          }

          lastCharBase = base;
          lastWasDialogue = false;
        } else if (child.type === 'dialogue' || child.type === 'parenthetical') {
          lastWasDialogue = true;
        } else {
          if (CONTD_RESET_TYPES.has(child.type)) {
            lastCharBase = null; // new scene / transition breaks dialogue continuation
          }
          lastWasDialogue = false;
        }
      }

      if (changes.length === 0) return;

      // Apply changes in reverse document order so earlier positions don't shift.
      const { tr } = editor.state;
      for (let i = changes.length - 1; i >= 0; i--) {
        const c = changes[i];
        if (c.attrs) tr.setNodeMarkup(c.pos, undefined, c.attrs);
        if (c.oldText !== null && c.newText !== null) {
          const from = c.pos + 1; // +1 for node open token
          const to = from + c.oldText.length;
          tr.insertText(c.newText, from, to);
        }
      }
      tr.setMeta('addToHistory', false);
      editor.view.dispatch(tr);
    };

    const debouncedUpdate = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(updateContd, 800);
    };

    editor.on('update', debouncedUpdate);
    setTimeout(updateContd, 500);
    return () => {
      editor.off('update', debouncedUpdate);
      if (timeout) clearTimeout(timeout);
    };
  }, [editor, stripCharacterExtension, characterContd, contdText]);
}
