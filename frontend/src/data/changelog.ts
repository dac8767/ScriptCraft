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
  /** v1.55: release date (YYYY-MM-DD). Older entries predate the field. */
  date?: string;
  items: { title: string; detail: string }[];
}

export const APP_VERSION = '1.55';

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.55',
    date: '2026-07-13',
    items: [
      { title: 'Menus say when there\'s a next step', detail: 'Every menu item that opens a dialog, picker, or prompt before acting now ends with an ellipsis (…) — and only those. Exports, Feature Request, and Report a Bug gained theirs; the mixed three-dot spellings were unified.' },
      { title: 'The changelog is complete again', detail: 'It had frozen at 0.82 — the exact failure its own header warns about. Every version since is backfilled from the release record with its date, and updating this file is now part of shipping a version.' },
    ],
  },
  {
    version: '1.54',
    date: '2026-07-13',
    items: [
      { title: 'empty scripts start in an Action element with a live caret; Open/Import on New Script', detail: '' },
    ],
  },
  {
    version: '1.53',
    date: '2026-07-13',
    items: [
      { title: 'reopen-last on by default; Open Script on the welcome screen; aligned New Script buttons', detail: '' },
    ],
  },
  {
    version: '1.52',
    date: '2026-07-13',
    items: [
      { title: '"screenplay" is "script" everywhere a person reads it', detail: '' },
    ],
  },
  {
    version: '1.51',
    date: '2026-07-13',
    items: [
      { title: 'New Script card — interior padding', detail: '' },
    ],
  },
  {
    version: '1.50',
    date: '2026-07-13',
    items: [
      { title: 'File > New Script… — a welcome-card dialog seeds the new document', detail: '' },
    ],
  },
  {
    version: '1.49',
    date: '2026-07-13',
    items: [
      { title: 'launch maximized; bigger folder icon; zoom "Reset"', detail: '' },
    ],
  },
  {
    version: '1.48',
    date: '2026-07-13',
    items: [
      { title: 'Save Script — divider becomes a breath; underlined filename; toggle-height folder', detail: '' },
    ],
  },
  {
    version: '1.47',
    date: '2026-07-13',
    items: [
      { title: 'Save Script — symmetric gaps at top and bottom of the body', detail: '' },
    ],
  },
  {
    version: '1.46',
    date: '2026-07-13',
    items: [
      { title: 'Save Script — Derek\'s folder artwork, balanced footer, air under locations', detail: '' },
    ],
  },
  {
    version: '1.45',
    date: '2026-07-13',
    items: [
      { title: 'Save Script — location bubbles flow inline and wrap', detail: '' },
    ],
  },
  {
    version: '1.44',
    date: '2026-07-13',
    items: [
      { title: 'Save Script — location chips are bubbles, and "None" gets one too', detail: '' },
    ],
  },
  {
    version: '1.43',
    date: '2026-07-13',
    items: [
      { title: 'Save Script — draggable by its header, tighter rows, breath after Saves as', detail: '' },
    ],
  },
  {
    version: '1.42',
    date: '2026-07-13',
    items: [
      { title: 'Save Script — 1px divider, straight filename, matching footer, browse icon', detail: '' },
    ],
  },
  {
    version: '1.41',
    date: '2026-07-13',
    items: [
      { title: 'Save Script — light divider with more air; grey Saves-as label; italic filename', detail: '' },
    ],
  },
  {
    version: '1.40',
    date: '2026-07-13',
    items: [
      { title: 'Save Script — divider after the name fields; the filename lands on light grey', detail: '' },
    ],
  },
  {
    version: '1.39',
    date: '2026-07-13',
    items: [
      { title: 'Set Draft Number is a plain text field', detail: '' },
    ],
  },
  {
    version: '1.38',
    date: '2026-07-13',
    items: [
      { title: 'zoom stepper wears Derek\'s circled minus/plus, sized to the text', detail: '' },
    ],
  },
  {
    version: '1.37',
    date: '2026-07-13',
    items: [
      { title: 'placeholder text FINALLY comes from the templates — plus panel tables and Save polish', detail: '' },
    ],
  },
  {
    version: '1.36',
    date: '2026-07-13',
    items: [
      { title: 'zoom stepper becomes the menu\'s header — a three-cell grid', detail: '' },
    ],
  },
  {
    version: '1.35',
    date: '2026-07-13',
    items: [
      { title: 'field-styled folder path, colored location chips, Spelling panel unclipped', detail: '' },
    ],
  },
  {
    version: '1.34',
    date: '2026-07-13',
    items: [
      { title: 'ScriptCraft — the overnight batch', detail: '' },
    ],
  },
  {
    version: '1.33',
    date: '2026-07-13',
    items: [
      { title: 'draggable windows, dock carets, Title Page never docks, chrome-colored Save header', detail: '' },
    ],
  },
  {
    version: '1.32',
    date: '2026-07-13',
    items: [
      { title: 'darker Save bands, "Action..." hint, double-chevron pop-out/pop-in icons', detail: '' },
    ],
  },
  {
    version: '1.31',
    date: '2026-07-13',
    items: [
      { title: 'Save Script — banded header/footer via one theme-computed color; bigger Saves as', detail: '' },
    ],
  },
  {
    version: '1.30',
    date: '2026-07-13',
    items: [
      { title: 'Save Script — "Saves as" joins the footer, and long names widen the window', detail: '' },
    ],
  },
  {
    version: '1.29',
    date: '2026-07-13',
    items: [
      { title: 'Save Script — toggles back at the right edge, per Derek\'s drawing', detail: '' },
    ],
  },
  {
    version: '1.28',
    date: '2026-07-13',
    items: [
      { title: 'Save Script — toggles ride behind the fields; dimmer lines; footer air', detail: '' },
    ],
  },
  {
    version: '1.27',
    date: '2026-07-13',
    items: [
      { title: 'Save Script — visible dividers, tighter footer, shorter fields, a breath before Saves as', detail: '' },
    ],
  },
  {
    version: '1.26',
    date: '2026-07-13',
    items: [
      { title: 'Save Script — true text rhythm, locked Script Name toggle, stacked locations', detail: '' },
    ],
  },
  {
    version: '1.25',
    date: '2026-07-13',
    items: [
      { title: 'Save Script matches Derek\'s mockup — text alignment, even rhythm, flat surface', detail: '' },
    ],
  },
  {
    version: '1.24',
    date: '2026-07-13',
    items: [
      { title: 'Save Script labels get their colons; the composed name uses a dash', detail: '' },
    ],
  },
  {
    version: '1.23',
    date: '2026-07-13',
    items: [
      { title: 'Save Script polish — and Settings stops eating your entries', detail: '' },
    ],
  },
  {
    version: '1.22',
    date: '2026-07-13',
    items: [
      { title: 'Save Script dialog — Version row, Include-in-Name toggles, honest paths', detail: '' },
    ],
  },
  {
    version: '1.21',
    date: '2026-07-13',
    items: [
      { title: 'Save As, laid out like an export panel', detail: '' },
    ],
  },
  {
    version: '1.20',
    date: '2026-07-13',
    items: [
      { title: 'the writability check was inventing the failure it was testing for', detail: '' },
    ],
  },
  {
    version: '1.19',
    date: '2026-07-13',
    items: [
      { title: 'the folder actually works — and the error stops saying "(undefined)"', detail: '' },
    ],
  },
  {
    version: '1.18',
    date: '2026-07-13',
    items: [
      { title: 'the chosen folder is actually writable — and a failed copy stops pretending your script is lost', detail: '' },
    ],
  },
  {
    version: '1.17',
    date: '2026-07-13',
    items: [
      { title: 'File > Save As actually opens Save As', detail: '' },
    ],
  },
  {
    version: '1.16',
    date: '2026-07-13',
    items: [
      { title: 'Save and Save As behave the way they do in every other app', detail: '' },
    ],
  },
  {
    version: '1.15',
    date: '2026-07-13',
    items: [
      { title: 'fix Save/Save As — the script owns its name again', detail: '' },
    ],
  },
  {
    version: '1.14',
    date: '2026-07-13',
    items: [
      { title: 'projects are gone from the product — a FreeDraft file is one script', detail: '' },
    ],
  },
  {
    version: '1.13',
    date: '2026-07-13',
    items: [
      { title: 'Diagnostics moves into Help > Developer', detail: '' },
    ],
  },
  {
    version: '1.12',
    date: '2026-07-13',
    items: [
      { title: 'Developer moved from View to Help', detail: '' },
    ],
  },
  {
    version: '1.11',
    date: '2026-07-12',
    items: [
      { title: 'Customize > Side Panels — Left/Right Panel are Show/Hide only', detail: '' },
    ],
  },
  {
    version: '1.10',
    date: '2026-07-12',
    items: [
      { title: 'the menu opens a tool where it actually lives', detail: '' },
    ],
  },
  {
    version: '1.9',
    date: '2026-07-12',
    items: [
      { title: 'Inspect passes clicks through — capture with ⌥-click or F8', detail: '' },
    ],
  },
  {
    version: '1.8',
    date: '2026-07-11',
    items: [
      { title: 'Dev Picker screenshots + export bundle — and the production build works again', detail: '' },
    ],
  },
  {
    version: '1.7',
    date: '2026-07-11',
    items: [
      { title: 'the Claude Code bridge is removed entirely', detail: '' },
    ],
  },
  {
    version: '1.6.3',
    date: '2026-07-11',
    items: [
      { title: 'the Claude bridge is OFF by default, and opt-in only', detail: '' },
    ],
  },
  {
    version: '1.6.2',
    date: '2026-07-11',
    items: [
      { title: 'the bridge was killing the agent before it could speak', detail: '' },
    ],
  },
  {
    version: '1.6.1',
    date: '2026-07-11',
    items: [
      { title: 'the bridge finds the claude binary itself', detail: '' },
    ],
  },
  {
    version: '1.6',
    date: '2026-07-11',
    items: [
      { title: 'Claude Code runs inside the Dev Picker', detail: '' },
    ],
  },
  {
    version: '1.5',
    date: '2026-07-11',
    items: [
      { title: 'Dev Picker — click a thing, get its real name', detail: '' },
    ],
  },
  {
    version: '1.4.1',
    date: '2026-07-11',
    items: [
      { title: 'Export Themes is a submenu, matching Import', detail: '' },
    ],
  },
  {
    version: '1.4',
    date: '2026-07-11',
    items: [
      { title: 'working notes — visible while you write, gone from print and export', detail: '' },
    ],
  },
  {
    version: '1.3.2',
    date: '2026-07-11',
    items: [
      { title: 'fix the Customize + Add Item menus — never anchor a menu by its bottom edge', detail: '' },
    ],
  },
  {
    version: '1.3.1',
    date: '2026-07-11',
    items: [
      { title: 'scene numbers in the link; fix the sliver dropdown; one title placeholder', detail: '' },
    ],
  },
  {
    version: '1.3',
    date: '2026-07-11',
    items: [
      { title: 'Show button back for consistency; Themes joins the remove-and-stash model', detail: '' },
    ],
  },
  {
    version: '1.2',
    date: '2026-07-11',
    items: [
      { title: 'card foot row, title page in Preview only, one placeholder at a time', detail: '' },
    ],
  },
  {
    version: '1.1',
    date: '2026-07-11',
    items: [
      { title: 'drag the panel edge to resize; one Hide model; one Import button', detail: '' },
    ],
  },
  {
    version: '1.0',
    date: '2026-07-11',
    items: [
      { title: 'Notes and To-Do are one list — filter, sort, drag, and a link field', detail: '' },
    ],
  },
  {
    version: '0.99',
    date: '2026-07-11',
    items: [
      { title: 'Customize rows show each item\'s real icon', detail: '' },
    ],
  },
  {
    version: '0.98',
    date: '2026-07-11',
    items: [
      { title: 'script notes and window notes are the same card, top to bottom', detail: '' },
    ],
  },
  {
    version: '0.97',
    date: '2026-07-11',
    items: [
      { title: 'Help shortcuts read the live bindings; menu bar can\'t be hidden', detail: '' },
    ],
  },
  {
    version: '0.96',
    date: '2026-07-11',
    items: [
      { title: 'ONE card — script and window items are the same component', detail: '' },
    ],
  },
  {
    version: '0.95',
    date: '2026-07-11',
    items: [
      { title: 'cross-zone drag, add-menus without the checkmark, spacer clamps on commit', detail: '' },
    ],
  },
  {
    version: '0.94',
    date: '2026-07-11',
    items: [
      { title: 'script to-dos/notes are links, not descriptions; the corner is reserved once', detail: '' },
    ],
  },
  {
    version: '0.93',
    date: '2026-07-11',
    items: [
      { title: 'Notes becomes one list; the pop-out gutter was on the wrong side', detail: '' },
    ],
  },
  {
    version: '0.92',
    date: '2026-07-11',
    items: [
      { title: 'To-Do is one list with a Location; Checklist is now To-Do List', detail: '' },
    ],
  },
  {
    version: '0.91',
    date: '2026-07-11',
    items: [
      { title: 'Customize is permanent chrome spanning both bars', detail: '' },
    ],
  },
  {
    version: '0.90',
    date: '2026-07-11',
    items: [
      { title: 'To-Do naming makes the distinction real; pop-out no longer overlaps', detail: '' },
    ],
  },
  {
    version: '0.89',
    date: '2026-07-11',
    items: [
      { title: 'Title Page is a fixed window that closes; Fit Page is exact', detail: '' },
    ],
  },
  {
    version: '0.88',
    date: '2026-07-11',
    items: [
      { title: 'context menu tab parity; Enter-key picker follows the user\'s order', detail: '' },
    ],
  },
  {
    version: '0.87',
    date: '2026-07-11',
    items: [
      { title: 'Fit Page finally fits ONE page; Format menu flattened; button readable', detail: '' },
    ],
  },
  {
    version: '0.86',
    date: '2026-07-11',
    items: [
      { title: 'Dual Dialogue is a real element, context menu reorders, spacer is a number', detail: '' },
    ],
  },
  {
    version: '0.85',
    date: '2026-07-11',
    items: [
      { title: 'Fit Page shows ONE page, windows stop at their content, button pops', detail: '' },
    ],
  },
  {
    version: '0.84',
    date: '2026-07-11',
    items: [
      { title: 'one canonical element list, Script History panel, Customize size memory', detail: '' },
    ],
  },
  {
    version: '0.83',
    date: '2026-07-11',
    items: [
      { title: 'Customize sidebar tabs, granular context-menu tab, themed Customize button', detail: '' },
    ],
  },
  {
    version: '0.82',
    items: [
      { title: 'Changelog is real again', detail: 'The changelog was hardcoded and stuck at v0.19, so none of the recent work showed up. It now lives in one list that gets an entry with every release — starting with a full backfill of everything below.' },
      { title: 'Export Themes, your way', detail: 'Choose exactly which themes to export and where the file goes, via a proper save dialog.' },
      { title: 'Import Themes from a Project', detail: 'Copy custom themes out of another ScriptCraft project file. Custom themes now travel inside .odraft exports, so a project carries its look with it.' },
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
