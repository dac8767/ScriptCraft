/**
 * renameLocationInScript (v5.77) — rewrite a location across every scene
 * heading, and keep the map's places pointing at it.
 *
 * Lifted out of SceneNavigator because the Map tab needs the SAME rename
 * (Derek: "in the location drop down is an option to change the name of the
 * scene in the script"). Two copies of a heading rewriter is exactly the
 * drift this codebase keeps paying for — the second one always forgets a
 * case, here the "INT. X. DAY" vs "INT. X - DAY" separator.
 */
import type { Editor } from '@tiptap/react';
import { parseHeading } from './sceneFilters';
import { useEditorStore } from '../stores/editorStore';

/**
 * Rename a location everywhere it appears in a scene heading.
 * Returns how many headings changed (0 when nothing matched).
 */
export function renameLocationInScript(editor: Editor | null, from: string, to: string): number {
  if (!editor) return 0;
  const oldName = from.trim();
  const newName = to.trim();
  if (!oldName || !newName || oldName.toUpperCase() === newName.toUpperCase()) return 0;

  const { doc, schema, tr } = editor.state;
  if (!schema.nodes.sceneHeading) return 0;

  let changed = 0;
  doc.descendants((node, pos) => {
    if (node.type.name !== 'sceneHeading') return true;
    const heading = node.textContent;
    const parsed = parseHeading(heading);
    if (parsed.location.toUpperCase() !== oldName.toUpperCase()) return true;
    let newHeading = parsed.preamble;
    if (parsed.prefix) newHeading += parsed.prefix + ' ';
    newHeading += newName;
    if (parsed.timeOfDay) {
      // Keep the separator the writer used: "INT. X. DAY" stays dotted,
      // "INT. X - DAY" stays dashed.
      const usesDot = /\.\s*\w+\.?\s*$/.test(heading) && !/\s-\s/.test(heading);
      newHeading += usesDot ? '. ' + parsed.timeOfDay + '.' : ' - ' + parsed.timeOfDay;
    }
    tr.insertText(newHeading, pos + 1, pos + 1 + heading.length);
    changed++;
    return true;
  });

  if (changed > 0) editor.view.dispatch(tr);
  // The map's places are keyed by script name, so they follow the rename —
  // otherwise the heading rewrite would strand every pin on that location.
  useEditorStore.getState().renameLocationInPlaces(oldName, newName);
  return changed;
}
