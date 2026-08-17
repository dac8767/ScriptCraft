/**
 * useCastCollection — who is in the script, read from the script.
 *
 * v7.38: lifted out of ScreenplayEditor verbatim. It is a HOOK and not a
 * utility because it owns state that outlives a call: two dirty flags and two
 * editor listeners that decide WHEN a rescan is worth doing.
 *
 * The shape is Derek's bug from v7.08 — "I only had one name on the script
 * (SCRIPTCRAFT), but the name auto suggest shows two entries, one of which is
 * just the letter S." Two causes, and both are why `collectCast` is the only
 * reader and nobody keeps a copy:
 *   · the autocomplete filtered a CACHED array refreshed only when the cursor
 *     crossed a character node's edge. Type "S", leave, delete the cue — "S"
 *     stayed in the cache with nothing in the script behind it.
 *   · nothing excluded the cue being typed, so a half-written name could be
 *     offered back as if it were real. That is what `skipPos` is for.
 *
 * The scan is not free on a long script, so it is gated: `charsNeeded` says a
 * consumer tool is open and wants live data, and the dirty flag says something
 * actually changed since the last scan. Entering a character node forces a
 * refresh even with every tool closed — that is the autocomplete's moment of
 * need, and a stale cast there is exactly the bug above.
 */
import { useCallback, useEffect, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import { useEditorStore } from '../stores/editorStore';

export function useCastCollection(
  editor: Editor | null,
  /** A consumer tool (Navigator, Characters) is open and wants live data. */
  charsNeeded: boolean,
): { stripCharacterExtension: (raw: string) => string; collectCast: (skipPos?: number) => string[] } {
  const charsDirty = useRef(true);
  const didInitialCharScan = useRef(false);

  const stripCharacterExtension = useCallback((raw: string): string => {
    // Remove all parenthetical extensions from character names
    // Handles: (CONT'D), (CONT'D), (CONTD), (V.O.), (V/O), (O.S.), (O.C.), (MORE)
    return raw.replace(/\s*\([^)]*\)\s*/g, '').trim();
  }, []);

  /* v7.08, Derek ("I only had one name on the script (SCRIPTCRAFT), but the
     name auto suggest shows two entries, one of which is just the letter S"):
     THE cast reader — every consumer asks this, nobody keeps a private copy.
     Two things were wrong with the old arrangement:
       · the autocomplete filtered a CACHED array, refreshed only when the
         cursor crossed a character node's edge. Type "S", leave, delete the
         cue — "S" stayed in the cache with nothing in the script behind it,
         which is the ghost entry in Derek's screenshot.
       · nothing excluded the cue being typed, so a half-written name could
         be offered back as if it were a real character.
     `skipPos` is the position of the node the cursor sits in — the caller
     passes it when a name is mid-typing. */
  const collectCast = useCallback((skipPos?: number): string[] => {
    if (!editor) return [];
    const names = new Set<string>();
    editor.state.doc.descendants((node, pos) => {
      if (!node.isBlock) return false;   // never walk into text/marks
      if (node.type.name !== 'character') return true;  // dual dialogue nests
      if (pos === skipPos) return false;
      const base = stripCharacterExtension(node.textContent.trim().toUpperCase());
      if (base) names.add(base);
      return false;
    });
    return Array.from(names).sort();
  }, [editor, stripCharacterExtension]);

  const updateCharacters = useCallback(() => {
    if (!editor) return;
    // No skip here: a cue the cursor happens to be parked in is still a real
    // cast member as far as the Characters and Navigator tools go.
    useEditorStore.getState().setCharacters(collectCast());
  }, [editor, collectCast]);

  useEffect(() => {
    if (!editor) return;
    // v4.82: one scan on mount (the autocomplete needs a cast from the word
    // go), then catch up whenever a consumer opens.
    if ((charsNeeded || !didInitialCharScan.current) && charsDirty.current) {
      charsDirty.current = false;
      didInitialCharScan.current = true;
      updateCharacters();
    }
    // Only update character list when the cursor leaves a character node
    // (i.e., user finished typing the name and pressed Enter / moved away)
    let prevInCharNode = false;
    const handleSelectionUpdate = () => {
      const { $from } = editor.state.selection;
      const inCharNode = $from.parent.type.name === 'character';
      // Update when leaving a character node, or when entering a non-character node after being in one
      if (prevInCharNode && !inCharNode) {
        charsDirty.current = true;
        if (charsNeeded) { charsDirty.current = false; updateCharacters(); }
      }
      // v4.82: ENTERING a character node is the autocomplete's moment of
      // need — refresh here even with every tool closed, or the dropdown
      // offers a stale cast. Only when something actually changed.
      if (!prevInCharNode && inCharNode && charsDirty.current) {
        charsDirty.current = false;
        updateCharacters();
      }
      prevInCharNode = inCharNode;
    };
    // Also update on transaction that changes node type (e.g., setNode from character to dialogue)
    const handleUpdate = ({ transaction }: { transaction: { docChanged: boolean } }) => {
      if (!transaction.docChanged) return;
      const { $from } = editor.state.selection;
      if ($from.parent.type.name !== 'character') {
        charsDirty.current = true;
        if (charsNeeded) { charsDirty.current = false; updateCharacters(); }
      }
    };
    editor.on('selectionUpdate', handleSelectionUpdate);
    editor.on('update', handleUpdate);
    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate);
      editor.off('update', handleUpdate);
    };
  }, [editor, updateCharacters, charsNeeded]);

  return { stripCharacterExtension, collectCast };
}
