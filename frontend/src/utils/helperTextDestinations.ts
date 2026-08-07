/**
 * helperTextDestinations (v6.24) — Derek: "add a button for each item that
 * takes you to the place where that helper text exists … should open the
 * appropriate window, menu, etc, but should not close the Helper Text
 * window."
 *
 * Maps a catalog entry's source file to a GO-THERE action. Tool files open
 * their window through the ordinary openTool (which honors the remembered
 * shape and never touches helperTextWindowOpen); the Design window and
 * Settings have store channels of their own. Surfaces that are always on
 * screen (ribbon, QAT, status bar, editor) and ones with no store channel
 * (menus, the context menu, Customize — its open flag is MenuBar-local)
 * return null: no button, the row's found-in text still names the place.
 */
import { useEditorStore, type ToolId } from '../stores/editorStore';

const TOOL_BY_FILE: [RegExp, ToolId][] = [
  [/NavigatorTool/, 'navigator'],
  [/SceneNavigator|SceneCard/, 'scenes'],
  [/Location/, 'locations'],
  [/CharacterProfiles|CharacterRelationship/, 'characters'],
  [/StickyNotes|StickyCard/, 'sticky'],
  [/MarkupsPanel|markupIcons|MarkupIconLayer/, 'markups'],
  [/BeatBoard/, 'beatboard'],
  [/GoalsTool/, 'goals'],
  [/TypewriterTool/, 'typewriter'],
  [/AnalyticsTool|GenderAnalysisTool|ScriptStatistics/, 'analytics'],
  [/ThesaurusTool/, 'thesaurus'],
  [/NotebookTool/, 'notebook'],
  [/RewriteTool/, 'rewrite'],
  [/TagsPanel/, 'tags'],
  [/SpellCheckPanel/, 'spelling'],
  [/WorkspacesTool/, 'workspaces'],
  [/FeedbackTool/, 'feedback'],
];

export interface HelperDestination { label: string; go: () => void }

/** The go-there action for an entry's first source file, or null. */
export function helperDestination(where: string[]): HelperDestination | null {
  const file = where[0] ?? '';
  for (const [re, tool] of TOOL_BY_FILE) {
    if (re.test(file)) {
      return { label: 'Open the window this lives in', go: () => useEditorStore.getState().openTool(tool) };
    }
  }
  if (/DesignPanel/.test(file)) {
    return { label: 'Open the Design window', go: () => useEditorStore.getState().setDesignPanelOpen(true) };
  }
  if (/PreferencesDialog/.test(file)) {
    return { label: 'Open Settings', go: () => useEditorStore.getState().openPreferences() };
  }
  return null;
}
