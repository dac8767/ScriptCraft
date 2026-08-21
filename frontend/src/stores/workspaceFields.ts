/**
 * What a workspace snapshot holds — ONE list (v7.70).
 *
 * It was written inside workspacesSlice.ts, which is where it belongs by
 * subject. But seedDefaults.ts needs it too (the five shipped workspaces were
 * exported before v7.69 and carry only 19 of these 33 fields, so it fills the
 * rest in), and seedDefaults is imported by viewState.ts, which the slice
 * imports — a cycle, and the array would be undefined at module-init on
 * whichever side lost the race.
 *
 * That is the third time in three versions: menu/menuLabel.ts, then
 * customizationFields.ts, now this. A constant two modules share belongs in
 * NEITHER of them. This file imports one leaf and nothing else.
 */
import { CUSTOMIZATION_FIELDS } from './customizationFields';

/** Customizations a workspace deliberately does NOT carry. Both are about how
 *  the app CHECKS YOUR WRITING, not how it is arranged — switching workspace
 *  should not change your grammar rules. Named rather than omitted, so a
 *  reader can tell a decision from an oversight. */
export const WORKSPACE_EXCLUDES = ['suggestionRules', 'suggestionMode'] as const;

/** The arrangement, on top of the customizations: what is open, how big, and
 *  in what mode. These are view state rather than customizations, which is why
 *  CUSTOMIZATION_FIELDS does not have them. */
export const WORKSPACE_VIEW_FIELDS = [
  'navigatorOpen', 'shelfOpen', 'toolSizes', 'toolMode',
  'activeTool', 'activeToolRight',
  'theme',                              // v0.78: the theme is part of a workspace
  'contextMenuOrder',                   // its sibling contextMenuHidden is a customization
] as const;

export const WORKSPACE_FIELDS: string[] = [
  ...CUSTOMIZATION_FIELDS.filter((f) => !(WORKSPACE_EXCLUDES as readonly string[]).includes(f)),
  ...WORKSPACE_VIEW_FIELDS,
];
