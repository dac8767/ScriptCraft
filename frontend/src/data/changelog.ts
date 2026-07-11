/**
 * Changelog (v0.82).
 *
 * Nothing generates this automatically — it's a hand-written list, and it had
 * been left frozen at v0.19 (inherited from the fork), which is why none of the
 * recent work appeared. Entries are added HERE, as part of the change that
 * makes them true. Newest first.
 */

export interface ChangelogEntry {
  version: string;
  items: { title: string; detail: string }[];
}

export const APP_VERSION = '0.82';

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.82',
    items: [
      { title: 'Changelog is real again', detail: 'The changelog was hardcoded and stuck at v0.19, so none of the recent work showed up. It now lives in one list that gets an entry with every release — starting with a full backfill of everything below.' },
      { title: 'Export Themes, your way', detail: 'Choose exactly which themes to export and where the file goes, via a proper save dialog.' },
      { title: 'Import Themes from a Project', detail: 'Copy custom themes out of another FreeDraft project file. Custom themes now travel inside .odraft exports, so a project carries its look with it.' },
      { title: 'Resizable spacers', detail: 'Spacers added to the toolbar or a side panel can be sized with a slider instead of being a fixed gap.' },
      { title: 'Roomier dialogs', detail: 'Widening a window no longer strands controls at the far edges with a lake of empty space in the middle.' },
    ],
  },
  {
    version: '0.81',
    items: [
      { title: 'One element list, everywhere', detail: 'The Element dropdown, the Insert menu, the Enter-key picker and the right-click menu now all read the same list — hide or reorder an element once and every menu follows.' },
      { title: 'Dual dialogue hints', detail: 'Both dual dialogue columns show the same faint CHARACTER NAME / Dialogue hints as a normal element.' },
      { title: 'Deleting a dual dialogue', detail: 'Backspace in an empty dual dialogue removes it, and the right-click menu gained Delete Element. A column that still has text is never destroyed.' },
      { title: 'Customize → Context Menu', detail: 'Show or hide the top-level sections of the right-click menu.' },
    ],
  },
  {
    version: '0.80',
    items: [
      { title: 'Colour picker stays put', detail: 'Picking a theme colour opened the operating system’s colour panel, which could appear on another monitor. The picker is now built into the window.' },
      { title: 'Theme import & export', detail: 'Save custom themes to a file and load them back — including themes made by someone else.' },
      { title: 'Shortcuts: Clear vs Reset', detail: 'Clear removes a shortcut entirely; Reset restores its default.' },
    ],
  },
  {
    version: '0.79',
    items: [
      { title: 'Dual dialogue builds itself', detail: 'The dual dialogue shortcut now creates the elements it needs instead of refusing when the cursor isn’t already on a character.' },
    ],
  },
  {
    version: '0.78',
    items: [
      { title: 'Custom themes', detail: 'Create your own themes, pick every colour, reorder and hide them, and edit or delete the ones you made. Built-in themes can be reordered and hidden.' },
      { title: 'Themes follow your workspace', detail: 'The active theme is saved as part of a workspace and restored with it.' },
    ],
  },
  {
    version: '0.77',
    items: [
      { title: 'Keyboard Shortcuts editor', detail: 'See every command in one place — including the ones with no shortcut — and rebind them. Conflicts are flagged and resolved rather than silently ignored.' },
    ],
  },
  {
    version: '0.76',
    items: [
      { title: 'Print works again', detail: 'Printing failed with a permissions error in the desktop app.' },
      { title: 'Windows resize properly', detail: 'The resize grip in the bottom-right corner was being covered by the window’s own content in some dialogs, including Project Manager.' },
      { title: 'Zoom menu', detail: 'Restyled to match the other menus, and it no longer draws underneath the side panels.' },
    ],
  },
  {
    version: '0.75',
    items: [
      { title: 'Zoom controls', detail: 'A proper zoom menu: type an exact percentage, zoom in and out, Actual Size, or Fit Page to Screen.' },
    ],
  },
  {
    version: '0.74',
    items: [
      { title: 'Customize, always at hand', detail: 'Customize is a permanent toolbar button, and Edit Elements moved inside it as a tab.' },
    ],
  },
  {
    version: '0.72',
    items: [
      { title: 'Size the interface to taste', detail: 'The menu bar, toolbar and side panels each take Compact, Comfortable, Custom (with a slider) or Hidden.' },
    ],
  },
  {
    version: '0.71',
    items: [
      { title: 'Hiding an element actually hides it', detail: 'Element visibility and ordering are now saved as your own overrides, so they survive and apply everywhere.' },
    ],
  },
  {
    version: '0.69',
    items: [
      { title: 'Dividers and spacers', detail: 'Add dividers and spacers to the toolbar and side panels to group things the way you like.' },
    ],
  },
  {
    version: '0.63',
    items: [
      { title: 'Title Page as a panel', detail: 'The Title Page can be docked as a panel alongside the script.' },
      { title: 'Panels show what’s really there', detail: 'Fixed panels listing windows that didn’t exist.' },
    ],
  },
  {
    version: '0.19',
    items: [
      { title: 'Mobile-Friendly Title Page', detail: 'The Title Page editor adapts to small screens: the form and live preview stack vertically and the dialog fits the viewport.' },
    ],
  },
  {
    version: '0.18',
    items: [
      { title: 'Insert Images', detail: 'Add images anywhere in the script and on the title page via Format → Insert Image, paste from the clipboard, or drag & drop. Resize with the corner handle, set alignment, and they export to PDF and Word.' },
      { title: 'Redesigned Title Page', detail: 'Manage title-page images, choose a larger title font size, and preview the page live. Editor, preview and exports all match.' },
    ],
  },
];
