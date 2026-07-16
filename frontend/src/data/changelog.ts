/**
 * Changelog (v0.82).
 *
 * Nothing generates this automatically — it's a hand-written list, and it had
 * been left frozen at v0.19 (inherited from the fork), which is why none of the
 * recent work appeared. Entries are added HERE, as part of the change that
 * makes them true. Newest first.
 */

/* ── Tags (v1.56) ──────────────────────────────────────────────────────────
   Every changelog item wears one or two colored tags so the list can be
   scanned. Curated entries set `tags` explicitly; anything without them is
   classified by inferTags() below — ONE classifier, so the backfilled
   history and future omissions are tagged by the same rules. */
export type ChangeTag =
  | 'New Feature' | 'Fix' | 'UI' | 'Editor' | 'Saving' | 'Tools' | 'Branding' | 'Polish';

export const TAG_META: Record<ChangeTag, { color: string }> = {
  'New Feature': { color: '#6abf69' },
  'Fix':         { color: '#e06060' },
  'UI':          { color: '#6fa8dc' },
  'Editor':      { color: '#b58ee0' },
  'Saving':      { color: '#e89b4f' },
  'Tools':       { color: '#4cbfbf' },
  'Branding':    { color: '#d377b0' },
  'Polish':      { color: '#9a9a9a' },
};

export const ALL_TAGS = Object.keys(TAG_META) as ChangeTag[];

const TAG_RULES: [RegExp, ChangeTag][] = [
  [/\bfix|bug|broke|regress|crash|wrong|dead|clip|misalign|stale|orphan|actually|no longer|stops?\b/i, 'Fix'],
  [/save|export|import|\bfile\b|folder|location|draft|version|autosave|\.odraft|snapshot/i, 'Saving'],
  [/scriptcraft|freedraft|opendraft|brand|renam/i, 'Branding'],
  [/notes?\b|to-?do|snippet|outline|analytic|character|location tool|spell|navigator|title page|index cards|goals|tags panel|dev picker|workspace/i, 'Tools'],
  [/placeholder|element|action|scene|dialogue|pagination|\bpage\b|cursor|caret|dual/i, 'Editor'],
  [/\bnew\b|adds?\b|introduc/i, 'New Feature'],
  [/menu|dialog|toolbar|icon|chevron|spacing|padding|align|colou?r|theme|font|divider|bubble|chip|header|footer|window|panel|zoom|layout|customize|button|resiz/i, 'UI'],
];

export function inferTags(text: string): ChangeTag[] {
  const out: ChangeTag[] = [];
  for (const [re, tag] of TAG_RULES) {
    if (out.length >= 2) break;
    if (re.test(text) && !out.includes(tag)) out.push(tag);
  }
  return out.length ? out : ['Polish'];
}

export interface ChangelogItem {
  title: string;
  detail: string;
  /** Explicit tags win; absent means inferTags(title + detail) applies. */
  tags?: ChangeTag[];
}

export function tagsFor(item: ChangelogItem): ChangeTag[] {
  return item.tags && item.tags.length ? item.tags : inferTags(`${item.title} ${item.detail}`);
}

export interface ChangelogEntry {
  version: string;
  /** v1.55: release date (YYYY-MM-DD). Older entries predate the field. */
  date?: string;
  items: ChangelogItem[];
}

export const APP_VERSION = '2.38';

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '2.38',
    date: '2026-07-16',
    items: [
      { title: 'Tighter gap above the outline bar', detail: 'The space between the toolbar and the outline bar was cut in half (6px → 3px).', tags: ['Polish'] },
    ],
  },
  {
    version: '2.37',
    date: '2026-07-16',
    items: [
      { title: 'Outline window: one toolbar, tabs below', detail: 'The "OUTLINE" title row is gone — beat count, Arrangement, Presets and + Add Section share a single toolbar, and the variation tabs sit under it. The on-screen hint text was replaced by a ? button (helper info lives behind ? buttons from now on).', tags: ['UI', 'Tools'] },
    ],
  },
  {
    version: '2.36',
    date: '2026-07-16',
    items: [
      { title: 'Undo brings back a closed beat', detail: 'Close a beat in the Outline and hit ⌘Z — or the toolbar/Edit-menu Undo — and it comes back. Undo now routes to whichever change is freshest: outline edits when you just touched the outline, the script\'s own history otherwise. Redo follows the same rule.', tags: ['Fix', 'Tools'] },
    ],
  },
  {
    version: '2.35',
    date: '2026-07-16',
    items: [
      { title: 'Scrapbook declutter button', detail: 'The "Hide other tools when launched" setting left Settings and became an eye button at the top of the Scrapbook window — one click hides every other sidebar tool AND the outline bar; click again to bring them back exactly as they were. The Settings > Tools tab is gone: the Typewriter master switch lives in the Typewriter window, and restore-cursor moved back to General > Startup.', tags: ['Tools', 'UI'] },
      { title: 'Slide the Scrapbook menus', detail: 'Grab the divider line before "Scrapbook" in the menu bar and drag to move the whole Scrapbook menu group left or right. The position sticks.', tags: ['UI'] },
    ],
  },
  {
    version: '2.34',
    date: '2026-07-16',
    items: [
      { title: 'Toolbar toggles for the panels and the bar', detail: 'Three new toolbar buttons — Left Panel, Right Panel, Outline Bar — light up while their surface is showing and toggle it with one click. Existing toolbar layouts get them appended after a divider; move or hide them in Customize like anything else.', tags: ['New Feature', 'UI'] },
    ],
  },
  {
    version: '2.33',
    date: '2026-07-16',
    items: [
      { title: 'Freeform is a mind map now', detail: 'Hover a card for two new buttons: one cycles its shape (rectangle → rounded → ellipse), the other draws a connection — click it, then click another card\'s link button, and a line joins them (click the line to remove it). Cards still drag anywhere and resize from the corner, and the title now grows with the card, so big cards read as big beats.', tags: ['New Feature', 'Tools'] },
    ],
  },
  {
    version: '2.32',
    date: '2026-07-16',
    items: [
      { title: 'A round of small fixes', detail: 'Scrapbook text boxes line up exactly with their drag bar (bottom corners stay rounded — that\'s how you tell them from tables). "Return to Editor" is back in the Scrapbook\'s top-right corner with its background color. The "Local only" chip moved from the menu bar to the status bar. The menu bar\'s spacing grip sits right after the last menu (after the Scrapbook menus when they\'re open). The outline bar\'s ruler moved to the top, above the sections. Freeform beat cards no longer let the "pages" field poke outside the card. The Navigator shows scene headings in caps, matching the page. "Spelling & Grammar" is now called "Spell Check".', tags: ['Fix', 'Polish'] },
    ],
  },
  {
    version: '2.31',
    date: '2026-07-16',
    items: [
      { title: 'Two grips for the top of the app', detail: 'The line between the toolbar and the outline bar scales the menu bar + toolbar together; the bottom-most edge (when the outline bar is on) scales the outline bar\'s rows alone. The scaler that sat on the bar\'s right edge is gone, and Customize gained Reset-to-Default-Size buttons for the menu bar, toolbar, outline bar and side panels.', tags: ['UI'] },
      { title: 'Outline Bar: slimmer controls, smarter clicks', detail: 'The side of the bar is now just three stacked buttons — add, send to script (with a confirmation so a stray click can\'t dump every beat into the script), and Fit. Double-clicking any bar item jumps to that spot in the script; right-click opens a menu with name, pages and (for beats) color.', tags: ['Tools', 'UI'] },
    ],
  },
  {
    version: '2.30',
    date: '2026-07-16',
    items: [
      { title: 'Outline variations — tabs, like a browser', detail: 'The Outline window has tabs. Every tab is its own arrangement of sections, but all tabs share ONE pool of beats: organize the same beats into 3-Act on one tab, Story Circle on another, something custom on a third. The ◉ on a tab picks which variation the Outline Bar shows. New tabs start empty with every beat waiting in Uncategorized; closing a tab never deletes a beat. Tabs save with the script.', tags: ['New Feature', 'Tools'] },
      { title: 'The Outline Bar shows every beat, automatically', detail: 'No more Place… — if a beat is in the outline, it\'s on the bar, packed under its section in board order, each spanning its page estimate. Drag a beat to move it between sections (the board follows), drag its right edge to change its page span, right-click to type it. Beats not yet in a section line up after the last one.', tags: ['Tools', 'Fix'] },
    ],
  },
  {
    version: '2.29',
    date: '2026-07-16',
    items: [
      { title: 'All sizing is manual now', detail: 'The size buttons and sliders left Customize (Menu Bar, Toolbar, Side Panels — the toolbar keeps a Show/Hide). Everything above the editor acts as one: drag the strip under the top bars and the menu bar, toolbar and outline bar scale together proportionally. Side panels resize by their inner edge as before — and dragging one small enough now clicks it into the icon-only rail (drag back out to restore it).', tags: ['UI', 'New Feature'] },
      { title: 'Spacing grips on the bars', detail: 'Faint grips appear on hover — at the right end of the menu bar, the right end of the toolbar, and to the left of the Big Button section. Drag one sideways to adjust that bar\'s item spacing. Remembered per bar.', tags: ['UI', 'New Feature'] },
      { title: 'View menu: Left Panel / Right Panel', detail: 'The side panels toggle from View, with checkmarks, exactly like the Outline Bar.', tags: ['UI'] },
      { title: 'Breathing room under the toolbar', detail: 'A little more space between the toolbar and the outline bar.', tags: ['Polish'] },
    ],
  },
  {
    version: '2.28',
    date: '2026-07-16',
    items: [
      { title: 'Outline Bar: a Premiere-style navigator', detail: 'The zoom slider and the scrollbar merged into one bar under the tracks, always visible: drag the middle to scroll, drag either round end handle to zoom — the opposite edge stays anchored, exactly like Premiere\'s timeline navigator. Mouse-wheel scrolling still works and keeps the thumb in sync.', tags: ['Tools', 'New Feature'] },
      { title: 'Outline Bar: row-height scaler', detail: 'A slim vertical bar at the far right edge — drag it to grow or shrink every row and the ruler together. The height is remembered.', tags: ['Tools', 'UI'] },
    ],
  },
  {
    version: '2.27',
    date: '2026-07-16',
    items: [
      { title: 'Opening the Scrapbook no longer crashes the app', detail: 'A React rule was being broken in the side-panel dock since v2.15: one of its state subscriptions only ran while the Scrapbook was open, so toggling it could crash React ("prevDeps.length") and leave the startup-failure screen over your script. Both subscriptions now always run.', tags: ['Fix'] },
    ],
  },
  {
    version: '2.26',
    date: '2026-07-16',
    items: [
      { title: 'Your own outline presets', detail: 'The Outline\'s Presets menu gained a "My Presets" group: Save current as preset… captures your sections and their page budgets under a name, and Export / Import moves them between machines (or writers) as a .json file. Applying one works exactly like a built-in, including the replace confirmation.', tags: ['New Feature', 'Tools'] },
    ],
  },
  {
    version: '2.25',
    date: '2026-07-16',
    items: [
      { title: 'Imported title pages look like title pages', detail: 'Importing a .fdx used to produce a nearly blank first page with one small title line, and often a second copy of the title info glued to the top of page 1. The importer now builds the same classic layout as the Title Page editor (title a third of the way down, credit line, draft info at the bottom), keeps a combined "Written by … from the novel by …" credit intact, and removes leading body lines that just repeat the title page.', tags: ['Fix', 'Saving'] },
      { title: 'Fountain title pages import too', detail: 'A .fountain file\'s title block (Title:, Credit:, Author:, Source:, Draft date:, Contact:…) becomes a real title page instead of loose lines at the top of the script.', tags: ['New Feature', 'Saving'] },
    ],
  },
  {
    version: '2.24',
    date: '2026-07-16',
    items: [
      { title: '"Delete title page" no longer takes down the app', detail: 'Inside the desktop shell, the system confirm box is an async stand-in that could reject and paint the "ScriptCraft failed to start" screen over a running app — and even when it didn\'t, its answer arrived too late to actually stop anything. Every confirm and prompt in the app (delete title page / location / dictionary / Scrapbook pages, the close-with-unsaved-changes warning, dictionary rename) now uses ScriptCraft\'s own dialog.', tags: ['Fix'] },
      { title: 'Startup diagnostics stay at startup', detail: 'The "failed to start" overlay only appears while the app is actually starting. Errors after that are logged quietly instead of covering your script.', tags: ['Fix'] },
    ],
  },
  {
    version: '2.23',
    date: '2026-07-16',
    items: [
      { title: 'Presets replace instead of piling on', detail: 'Choosing a preset when sections already exist now asks before replacing them — and your beats are never deleted. They wait in a temporary "Uncategorized" column on the far left; drag each one into its new section and the column disappears once it\'s empty.', tags: ['Tools', 'New Feature'] },
      { title: 'A proper in-app confirm dialog', detail: 'Replace-the-outline uses ScriptCraft\'s own confirm dialog instead of the system one, which doesn\'t work reliably inside the desktop shell.', tags: ['UI'] },
    ],
  },
  {
    version: '2.22',
    date: '2026-07-16',
    items: [
      { title: 'Arrangement: Sections', detail: 'The Outline window\'s arrangement toggle caught up with the v2.18 rename — the first option reads "Sections" instead of "Columns".', tags: ['UI', 'Tools'] },
    ],
  },
  {
    version: '2.21',
    date: '2026-07-16',
    items: [
      { title: 'Outline Bar: dragging no longer flings items', detail: 'When the zoomed track came out narrower than the bar, the CSS quietly stretched it to full width but the drag math still used the un-stretched scale — a small mouse move threw the item across the screen. Drag distance now always uses the scale you actually see.', tags: ['Fix', 'Tools'] },
    ],
  },
  {
    version: '2.20',
    date: '2026-07-16',
    items: [
      { title: 'Presets arrive with real page budgets', detail: '3-Act Structure defaults to 40 pages per act. Save the Cat tiles Blake Snyder\'s 110-page beat sheet (Catalyst ending p12, Midpoint p55, All Is Lost p75…), The Hero\'s Journey follows Vogler\'s act mapping across 120 pages, and Story Circle and the Sequence Method split 120 pages into eight 15-page blocks.', tags: ['Tools', 'New Feature'] },
      { title: 'No more blank page counts', detail: 'New sections and beats are born with a 1-page budget instead of an empty field — a blank item had no width to grab on the Outline Bar. The pages fields can no longer be committed empty, and old sections without a budget now draw as 1 page, matching what their field shows.', tags: ['Fix', 'Tools'] },
    ],
  },
  {
    version: '2.19',
    date: '2026-07-16',
    items: [
      { title: 'Outline window: "pages", spelled out', detail: 'The page-count fields on sections and beat cards read "pages" after the number, and an empty field shows # instead of p.', tags: ['Polish'] },
    ],
  },
  {
    version: '2.18',
    date: '2026-07-16',
    items: [
      { title: 'Four classic structures join the presets', detail: 'The Outline\'s Presets dropdown now offers Save the Cat (Blake Snyder\'s 15 beats), The Hero\'s Journey (12 stages), Dan Harmon\'s Story Circle (8 steps) and the Sequence Method (8 sequences), alongside 3-Act. Every preset section arrives with one blank beat, ready to fill in.', tags: ['New Feature', 'Tools'] },
      { title: '"Sections", everywhere', detail: 'The Outline window stopped saying "column" — it\'s + Add Section, Section name, Delete section, matching the bar and the ＋ menu. Sections were already one shared model: add, rename or delete one anywhere and the Outline window, the Outline Bar and the menus all update together.', tags: ['UI', 'Tools'] },
    ],
  },
  {
    version: '2.17',
    date: '2026-07-16',
    items: [
      { title: 'Beat page estimates on the board', detail: 'Every beat card in the Outline window carries a small "p" field — type the page estimate there and the Outline Bar block resizes to match. Same number, either place.', tags: ['Tools'] },
    ],
  },
  {
    version: '2.16',
    date: '2026-07-16',
    items: [
      { title: 'The bar and the board stay in sync', detail: 'Drag a beat along the Outline Bar into a different section\'s page range and it moves into that section on the Outline board too — the two views are one model, always. Page counts also abbreviate as "p" (not "pp") across the bar and the board.', tags: ['Tools', 'Fix'] },
      { title: 'Outline Bar controls cleaned up', detail: 'The ＋ and Send to Script buttons are a tidy row of equal squares instead of stretched, mismatched blocks; the zoom control slimmed to match.', tags: ['UI', 'Polish'] },
      { title: 'Rename on the bar; whole pages only', detail: 'Double-click any section or beat on the Outline Bar to rename it in place (the Outline board follows — one model). Sections and beats also snap to whole pages now, no decimals; the Script row still shows true fractional scene lengths.', tags: ['Tools', 'UI'] },
    ],
  },
  {
    version: '2.15',
    date: '2026-07-16',
    items: [
      { title: 'Settings > Tools', detail: 'A new Settings tab for per-tool options. Scrapbook: "Hide other tools when launched" — opening the Scrapbook hides every other sidebar item and its pages panel fills the sidebar; Return to Editor puts everything back exactly as it was. Typewriter\'s master switch lives here too (same switch as the window), and "Restore the cursor position when opening a script" moved home from General.', tags: ['New Feature', 'Tools'] },
      { title: 'Icon-rail windows open at the rail', detail: 'With a sidebar set to Icons Only (or Compact/Custom), clicking a tool opened its window out where the full-size panel used to end. Windows now anchor to the panel\'s real edge, whatever its width.', tags: ['Fix', 'UI'] },
      { title: 'Outline blocks drop the page count', detail: 'Act blocks no longer print "30pp" inside — the ruler shows the size and the hover tooltip spells it out.', tags: ['Polish'] },
    ],
  },
  {
    version: '2.14',
    date: '2026-07-15',
    items: [
      { title: 'Toolbar dividers are yours now', detail: 'The group separators in the toolbar are real divider rows in Customize > Toolbar — drag them anywhere or remove them, exactly like the dividers you add yourself. Your toolbar looks identical; it\'s just all editable now.', tags: ['UI'] },
    ],
  },
  {
    version: '2.13',
    date: '2026-07-15',
    items: [
      { title: 'Scrapbook menus in the menu bar', detail: 'The Scrapbook\'s controls moved from the toolbar to the menu bar: a divider and Scrapbook tag, then Table and Picture menus that only exist while the tool is open, plus Return to Editor. Table works like Word\'s — insert rows/columns above, below, left or right of the cell you\'re in, delete row/column/table, hide borders, shading, sort by column, alignment. Picture covers borders (on/off, size, color), rotation, and delete. Merge/Split Cells and cropping aren\'t faked — they need real cell-span and crop models and will come as their own features.', tags: ['New Feature', 'Tools'] },
      { title: 'Click anywhere and just type', detail: 'No more "+ Text box" button: click any blank spot on a Scrapbook page and a caret appears there — your first keystroke creates the text box around it, and typing never skips a beat.', tags: ['New Feature', 'Tools'] },
    ],
  },
  {
    version: '2.12',
    date: '2026-07-15',
    items: [
      { title: 'Scrapbook section placement', detail: 'The toolbar\'s Scrapbook section sits left-aligned right after your own toolbar items, with clear air between them — and "Return to editor" moved into the section with the tool\'s other controls, so everything Scrapbook lives in one place.', tags: ['UI'] },
      { title: 'Hovering a scrap never shifts its text', detail: 'The ⋮⋮/✕ bar that appears when you hover a text box or table now floats just above the item instead of pushing the content down.', tags: ['Fix', 'Tools'] },
    ],
  },
  {
    version: '2.11',
    date: '2026-07-15',
    items: [
      { title: 'The Outline Bar is a page timeline', detail: 'Rebuilt like a Premiere timeline where the x-axis is pages. Top row: your Outline sections (acts) as blocks sized by target page counts — set them by dragging a block\'s edge, right-clicking it, or typing in the Outline window\'s column header (30/45/40 gives a 115-page ruler). Middle row: beats, dragged and resized on the same page scale, right-click for an exact target. A page ruler runs 1 to the total, and the bottom row shows what\'s actually written — one block per scene heading, sized by its real page length, click to jump. Zoom with the Fit/slider control, scroll when it outgrows the screen. The ＋ menu adds a section or a beat; Send to Script is an icon now, and closing lives in View > Outline Bar (no more ×).', tags: ['New Feature', 'Tools'] },
    ],
  },
  {
    version: '2.10',
    date: '2026-07-15',
    items: [
      { title: 'Toolbar order matches Customize', detail: 'Opening the Scrapbook was shoving Go to Page and Zoom into the ⋮ overflow — and leaving them there — because the responsive collapse only re-measured when the window resized, not when the Scrapbook section appeared. It re-measures on both now, and the Scrapbook section always renders last, after every Main item, exactly as Customize lists it.', tags: ['Fix', 'UI'] },
    ],
  },
  {
    version: '2.09',
    date: '2026-07-15',
    items: [
      { title: 'Customize window is draggable', detail: 'Grab the Customize window by its header and move it anywhere, like every other window. This also quietly revived the window\'s size memory — the code that remembers your drag-resize had come unwired.', tags: ['UI', 'Fix'] },
    ],
  },
  {
    version: '2.08',
    date: '2026-07-15',
    items: [
      { title: 'Scrapbook icons go monotone', detail: 'The emoji in the Scrapbook tree (page, folder, trash, the create buttons) are replaced with clean line icons that tint with your theme, and sections now use the same collapse caret as the side-panel items. House rule from here on: icons are always monotone.', tags: ['UI', 'Polish'] },
      { title: 'Scrapbook toolbar slims down', detail: 'The tagged Scrapbook section now holds a single "+ Add" dropdown (Text box / Table / Image) instead of three buttons, so the toolbar stays uncrowded. Table controls still appear beside it when a table is selected.', tags: ['UI'] },
    ],
  },
  {
    version: '2.07',
    date: '2026-07-15',
    items: [
      { title: 'One toolbar, Scrapbook included', detail: 'The Scrapbook window\'s own button row is gone. While the Scrapbook is open, the main toolbar\'s Bold/Italic/Underline/Strikethrough and alignment buttons act on your text boxes directly — no duplicates — and a clearly tagged "Scrapbook" section appears after Editor View with + Text box / + Table / + Image, plus the selected table\'s row, column and alignment controls. The tag and divider mark those as the tool\'s buttons, not part of your customized toolbar.', tags: ['UI', 'Tools'] },
      { title: 'Panel size rows line up', detail: 'In Customize > Side Panels, the Left and Right Panel Size button groups start at the same edge — the labels share a fixed column.', tags: ['Polish'] },
    ],
  },
  {
    version: '2.06',
    date: '2026-07-15',
    items: [
      { title: 'Icons Only side panels', detail: 'Customize > Side Panels now offers a fourth size per panel: Icons Only — the panel collapses to a slim rail of square tool icons, OneNote-style. Clicking an icon opens that tool as a floating window (there\'s no pop-in in this mode; the rail has no inline shape to return to).', tags: ['New Feature', 'UI'] },
    ],
  },
  {
    version: '2.05',
    date: '2026-07-15',
    items: [
      { title: 'Scrapbook items share one chrome', detail: 'Text boxes, tables and images all wear the same slim head bar (⋮⋮ to move, ✕ to delete). Empty items keep their border and head bar visible at all times — the move grip can\'t vanish anymore; filled items show theirs when you hover or click in. The table\'s attached button row is gone: while you\'re in the Scrapbook, the toolbar grows a Table section (rows, columns, alignment, delete) for whichever table is selected, and the "Pages" title with its create buttons moved into the panel window\'s header.', tags: ['Tools', 'UI'] },
      { title: 'Scrapbook text formatting works', detail: 'Bold, italic, underline and strikethrough now work in text boxes — from the new formatting buttons in the Scrapbook toolbar or the usual ⌘B/⌘I/⌘U shortcuts.', tags: ['Fix', 'Tools'] },
    ],
  },
  {
    version: '2.04',
    date: '2026-07-15',
    items: [
      { title: 'Every menu item wears an icon', detail: 'The gaps are filled: the Production/Tools/Project command rows in Customize > Toolbar now show the same icon their pinned buttons use (they were reading a second, incomplete icon list — the two-lists bug again), and the last icon-less menu rows (Zoom percentages, the Insert > Element list) got theirs.', tags: ['Fix', 'UI'] },
    ],
  },
  {
    version: '2.03',
    date: '2026-07-15',
    items: [
      { title: 'Navigator: one filter button, one popover', detail: 'The Navigator\'s header now holds a single funnel at its right edge. Click it for everything: a keyword filter and per-type show/hide checkboxes (with Show All / Hide All). Filter icons sit at the right edge of every window header.', tags: ['UI', 'Tools'] },
    ],
  },
  {
    version: '2.02',
    date: '2026-07-15',
    items: [
      { title: 'Toolbar: Main + Big Button', detail: 'The toolbar\'s left/right split is gone. Everything lives in the Main section, aligned left; the far edge is the Big Button section — large Customize-style launchers spanning both bars, in their own color. Customize itself is the section\'s permanent first resident, and tools or commands you drag there (Customize > Toolbar) join it in the large format. Small controls that used to sit on the right (Zoom, Editor View) moved into Main.', tags: ['UI', 'New Feature'] },
    ],
  },
  {
    version: '2.01',
    date: '2026-07-15',
    items: [
      { title: 'The Notebook is now the Scrapbook', detail: 'Same tool, truer name — a board of scraps. Empty items also got clearer: the dashed border is now a solid thin line, and an empty item keeps its menu bar (move/delete, table controls) visible instead of hiding it until you click.', tags: ['Tools', 'UI'] },
    ],
  },
  {
    version: '2.00',
    date: '2026-07-15',
    items: [
      { title: 'Pop in/out lives in the window header', detail: 'The pop-out arrow moved off the panel button row and into the header inside the window, still on the side facing where it sends the window. Pop buttons also get more air between themselves and the nearest text.', tags: ['UI'] },
    ],
  },
  {
    version: '1.99',
    date: '2026-07-15',
    items: [
      { title: 'Empty notebook items are visible now', detail: 'A text box or table with nothing in it wears a clear dashed border so it can\'t vanish into the canvas. Once it has content, the border drops back to the faint outline — the contents do the talking.', tags: ['Fix', 'Tools'] },
    ],
  },
  {
    version: '1.98',
    date: '2026-07-15',
    items: [
      { title: 'Outline: "Arrangement: Columns | Freeform"', detail: 'The Outline\'s two layouts wear their real names now — Columns (was "Auto Arrange") and Freeform (was "Custom") — with an "Arrangement:" label in front so the toggle explains itself.', tags: ['UI', 'Tools'] },
    ],
  },
  {
    version: '1.97',
    date: '2026-07-15',
    items: [
      { title: 'Navigator: one filter control', detail: 'The funnel and the Filter field are a single control in the Navigator\'s header now — funnel opens show/hide, the field beside it narrows by text. The footer bar is gone.', tags: ['UI', 'Tools'] },
    ],
  },
  {
    version: '1.96',
    date: '2026-07-15',
    items: [
      { title: 'The Notebook takes over the editor', detail: 'Opening the Notebook now works differently from other windows: the side-panel window holds just your pages and sections (always inline, like Navigator), and the writing surface fills the entire editor area. A "Return to editor" button in the notebook\'s header brings the script back. Pages are all free canvases now — the flowing-document type is gone, and any existing flow pages convert to text/table boxes automatically. The "drop here" zone in the tree only appears while you\'re actually dragging something.', tags: ['Tools', 'UI'] },
    ],
  },
  {
    version: '1.95',
    date: '2026-07-15',
    items: [
      { title: 'Format > Alignment', detail: 'Align Left / Center / Right and Justify now live together in an Alignment submenu instead of four loose rows in the Format menu.', tags: ['UI'] },
    ],
  },
  {
    version: '1.94',
    date: '2026-07-15',
    items: [
      { title: 'Popped-out windows close with × again', detail: 'Every floating side-panel window has the × back in its upper right corner. The pop-in chevron stays where it was — point at the panel to dock, hit × to close.', tags: ['UI'] },
    ],
  },
  {
    version: '1.93',
    date: '2026-07-15',
    items: [
      { title: 'A tidier Time tab in Goals', detail: 'Two clear choices — "Write until" a clock time or "Write for" a number of minutes — as radio rows with a single Start button, instead of two competing Starts. The unchosen row dims so there\'s no guessing which one will run. Quick start chips still fire instantly.', tags: ['UI', 'Tools'] },
    ],
  },
  {
    version: '1.92',
    date: '2026-07-15',
    items: [
      { title: 'Vomit Draft takes over the Goals window', detail: 'While the lock is on, Goals shows only what matters: the progress bar, how much of the goal is left, the lock notice (it shakes when a locked edit is rejected), and Stop. The floating pill in the editor\'s upper right is gone — the lock lives in the panel now. End the lock and the full Goals window comes back.', tags: ['UI', 'Tools'] },
    ],
  },
  {
    version: '1.91',
    date: '2026-07-15',
    items: [
      { title: 'Typewriter master control is a switch', detail: '"Enable Typewriter tool" flips like a proper toggle switch now instead of a checkbox. Underneath it\'s the same setting — your sub-options still come back exactly as you left them.', tags: ['UI', 'Tools'] },
    ],
  },
  {
    version: '1.90',
    date: '2026-07-15',
    items: [
      { title: 'One filter icon everywhere', detail: 'The funnel from the Scenes/Pages windows is now THE filter icon, drawn from one shared source. The Navigator\'s show/hide control wears it in the window header (same dropdown underneath), the Filter Navigator footer field and the Notes/To-Do Filter menus carry it too — and it tints with the accent color whenever a filter is actually narrowing something.', tags: ['UI'] },
    ],
  },
  {
    version: '1.89',
    date: '2026-07-15',
    items: [
      { title: 'Outline presets', detail: 'A Presets dropdown in the Outline window scaffolds common structures — starting with 3-Act Structure, which adds Act I, Act II and Act III columns in one click. It appends to what\'s already on the board, never replaces.', tags: ['New Feature', 'Tools'] },
    ],
  },
  {
    version: '1.88',
    date: '2026-07-15',
    items: [
      { title: 'Pick the format on the New Script window', detail: 'The script format (Film Script, 1-Hour TV Drama, Multi-Cam Sitcom, Stage Play, Radio Play, AV Script) is a dropdown right on the New Script window now — the separate "Choose script format" window no longer interrupts after Create. The list still follows Format > Script Format Preferences.', tags: ['UI', 'New Feature'] },
    ],
  },
  {
    version: '1.87',
    date: '2026-07-15',
    items: [
      { title: 'The Notebook', detail: 'A Notion/OneNote-style notebook in the Tools menu. Build a sidebar of sections nested as deep as you like and drag pages (or whole sections) anywhere in the tree. Pages come in two kinds: flowing documents with rich text, lists and structured tables, or a free canvas where text boxes, tables and images drop anywhere and drag around like a corkboard. Everything saves automatically.', tags: ['New Feature', 'Tools'] },
    ],
  },
  {
    version: '1.86',
    date: '2026-07-15',
    items: [
      { title: 'Characters: the Connections graph', detail: 'A third tab in the Characters window draws the cast as a force-directed network — a line joins two characters for every scene they share, thicker with more scenes, colored by detected communities. Drag nodes, zoom with the wheel, click a character to open their profile.', tags: ['New Feature', 'Tools'] },
    ],
  },
  {
    version: '1.85',
    date: '2026-07-15',
    items: [
      { title: 'Goals wears its controls in the header', detail: 'Words / Pages / Time are tabs in the window header now, next to a ? that opens the tool\'s explainer as a popover. In the Time tab, "Write until" leads and minutes follow.', tags: ['UI', 'Tools'] },
    ],
  },
  {
    version: '1.84',
    date: '2026-07-15',
    items: [
      { title: 'Typewriter master switch', detail: 'One checkbox at the top of the Typewriter window turns every feature off at once — and every sub-option remembers its state, so switching back on restores exactly the setup you had.', tags: ['Tools', 'New Feature'] },
      { title: '"Writing focus" is now "Extreme focus"', detail: 'Same fullscreen, everything-hidden mode — and while it\'s on, a quiet "esc to leave" sits in the upper right so the exit is never a mystery.', tags: ['UI'] },
    ],
  },
  {
    version: '1.83',
    date: '2026-07-15',
    items: [
      { title: 'Format > Highlighting', detail: 'A Final Draft-style submenu: Highlight the selection, Find Next / Find Previous to hop between highlights (wrapping at the ends), eight named colors with chips and a checkmark on the current one, and Custom… for anything else. The color is the same pen the toolbar highlighter uses — pick it in either place.', tags: ['New Feature', 'Editor'] },
    ],
  },
  {
    version: '1.82',
    date: '2026-07-15',
    items: [
      { title: 'Goals ate Vomit Draft', detail: 'One tool now: Goals. Pick a goal as always — words, pages, or time (time goals can also run until a clock time) — and check "Vomit Draft Mode" to lock previous text until the goal is done. The lock pill opens Goals; Hemingway mode is gone entirely.', tags: ['Tools', 'New Feature'] },
    ],
  },
  {
    version: '1.81',
    date: '2026-07-15',
    items: [
      { title: 'Customize: every list tab is ribbon-style now', detail: 'Context Menu, Elements and Themes joined the Shown/Hidden drag-and-drop columns. Themes keep their Edit/Delete buttons on the row; core elements read "(required)" and can\'t be hidden — and so does File on the Menu Bar tab, slightly greyed. Size options (Menu Bar, Toolbar) sit left-aligned next to their labels.', tags: ['UI'] },
    ],
  },
  {
    version: '1.80',
    date: '2026-07-15',
    items: [
      { title: 'Navigator gets a real header and footer', detail: 'The show/hide dropdown rides in the window\'s header next to the name; the Filter field is a true footer bar. Pop-in/pop-out buttons now always sit on the edge of the header closest to where they send the window — pointing at the editor when docked, at the panel when floating — for every tool, both panels. Popped-out windows lose their X (click the tool\'s name in the panel to close).', tags: ['UI', 'Tools'] },
    ],
  },
  {
    version: '1.79',
    date: '2026-07-15',
    items: [
      { title: 'One less Typewriter knob', detail: '"Only pin once the line is first reached" is gone — Typewriter scrolling now always pins from the first line (the page gets matching breathing room above and below).', tags: ['Tools'] },
    ],
  },
  {
    version: '1.78',
    date: '2026-07-15',
    items: [
      { title: 'Current-line highlight respects the page', detail: 'The Typewriter highlight bar stops at the page edges instead of running across the whole editor background — at any zoom level. And it\'s tintable: pick from six swatches or any custom color, right under the toggle.', tags: ['Tools', 'UI'] },
    ],
  },
  {
    version: '1.77',
    date: '2026-07-15',
    items: [
      { title: 'Typewriter window stays open', detail: 'Clicking into the editor no longer minimizes it — its options are meant to be tuned while writing. The panel is also slimmer: line-length limit and keep-lines are gone, the dim sub-options (what stays bright, and a new dimmed-opacity slider) are visibly nested under "Dim unfocused text".', tags: ['Tools', 'UI'] },
      { title: 'Hemingway mode lives in Vomit Draft', detail: 'It\'s the same forward-only lock, so it starts from the Vomit Draft window now — check the box for no timer.', tags: ['Tools'] },
      { title: 'Restore-cursor moved to Settings', detail: 'Settings > General > Startup: reopen a script with the cursor where you left it.', tags: ['UI'] },
    ],
  },
  {
    version: '1.76',
    date: '2026-07-15',
    items: [
      { title: 'Customize, ribbon-style', detail: 'The Menu Bar, Toolbar and Side Panels tabs are rebuilt around drag-and-drop columns: Shown and Hidden for menus; Left, Right and Hidden for the toolbar and the panels. Drag an item between lists — where you drop it is where it sits; the Hidden list is organized by the same categories the old dropdown used, and every row keeps a click fallback (× to hide, + to show). Dividers and spacers still add from buttons below and drag like everything else.', tags: ['New Feature', 'UI'] },
    ],
  },
  {
    version: '1.75',
    date: '2026-07-15',
    items: [
      { title: 'New: the Outline Bar', detail: 'View > Outline Bar opens a Final Draft-style outline strip under the toolbar: two lanes of beat markers placed by page (drag to move, drag between lanes, drag the right edge to resize in eighth-page steps) plus a Scenes lane of the script\'s actual scene headings — click one to jump there. The markers ARE the Outline tool\'s beats: place existing ones, add new ones, and titles/colors stay linked both ways. "Send to Script" writes the outline into the script as section lines (working notes — never printed or exported).', tags: ['New Feature', 'Tools'] },
    ],
  },
  {
    version: '1.74',
    date: '2026-07-15',
    items: [
      { title: 'Typewriter: the full kit', detail: 'The panel now carries the complete option set — typewriter scrolling with a movable line, keep-N-lines above/below the cursor (the gentler mode), current-line highlight, dimming by element or by sentence, fullscreen Writing Focus with a vignette (Esc leaves), an on-screen line-length limit, restore-cursor-on-open, and Hemingway mode: the Vomit Draft lock with no timer, on until you turn it off.', tags: ['New Feature', 'Tools'] },
    ],
  },
  {
    version: '1.73',
    date: '2026-07-15',
    items: [
      { title: 'The "Write until" field types like a clock', detail: 'Vomit Draft\'s end-time field kept every keystroke stuck in the hours slot (a quirk of the built-in time control). It\'s now a segmented field: two digits of hour jump to minutes, two of minutes jump to AM/PM — and a lone 9 knows it means 09. Backspace hops back a segment.', tags: ['Fix', 'Tools'] },
      { title: '12-hour or 24-hour time', detail: 'Settings > General > Dates & Times: choose 11:30 PM or 23:30. Applies to time entry and displayed times like Vomit Draft\'s unlock clock.', tags: ['New Feature'] },
    ],
  },
  {
    version: '1.72',
    date: '2026-07-15',
    items: [
      { title: 'Typewriter grows up', detail: 'Ported the option set of the Obsidian Typewriter Mode plugin: a movable typewriter line (20–80% of the screen), "only pin once the line is first reached", a current-line highlight bar, and dimming of everything but the element you\'re editing. The page also gains breathing room while the mode is on, so the first and last lines can actually reach the typewriter line.', tags: ['New Feature', 'Tools'] },
      { title: 'AI Writer, softened', detail: 'Its complete works now read: "Write your own damn script."', tags: ['UI'] },
    ],
  },
  {
    version: '1.71',
    date: '2026-07-15',
    items: [
      { title: 'Vomit Draft icon, take three', detail: 'Now Derek\'s line-art face — squeezed-shut eyes, twin streams, chunks — replacing the v1.69 pictogram. Still a real vector icon, so it follows every theme.', tags: ['UI'] },
    ],
  },
  {
    version: '1.70',
    date: '2026-07-15',
    items: [
      { title: 'Typewriter can follow the cursor', detail: 'New sub-option in the Typewriter window: recenter whenever the cursor moves — clicks and arrow keys, not just typing. Off by default; selecting a range never recenters (the text would slide out from under the mouse mid-drag).', tags: ['New Feature', 'Tools'] },
    ],
  },
  {
    version: '1.69',
    date: '2026-07-15',
    items: [
      { title: 'New tool: AI Writer', detail: 'Open it and receive the full extent of its assistance. Dockable, like every tool. That\'s it. That\'s the tool.', tags: ['New Feature', 'Tools'] },
      { title: 'Vomit Draft gets its portrait', detail: 'The icon is now Derek\'s pictogram — person, stream, puddle — drawn as a real icon so it follows every theme\'s colors (the v1.68 emoji didn\'t).', tags: ['UI'] },
    ],
  },
  {
    version: '1.68',
    date: '2026-07-15',
    items: [
      { title: 'New tool: Typewriter', detail: 'Typewriter mode keeps the line you\'re typing on fixed at the vertical center of the screen — the page scrolls under it as you write. One enable switch in the tool window (Tools > Typewriter; dockable and toolbar-able like any tool), and the setting persists. Clicking around the script still navigates normally; only typing recenters.', tags: ['New Feature', 'Tools'] },
      { title: 'Vomit Draft wears its true face', detail: 'The tool\'s icon is now the vomiting emoji, everywhere the icon shows.', tags: ['UI'] },
    ],
  },
  {
    version: '1.67',
    date: '2026-07-15',
    items: [
      { title: 'Spelling & Grammar always shows the word', detail: 'At its old default (or a size remembered from before the tabs), the window crushed the checker body to nothing — buttons, no misspelled word, no suggestions. The default is taller, a remembered pre-tab size is reset once, and the body now has a hard floor: shrink the window below it and the panel scrolls instead of hiding the word.', tags: ['Fix', 'Tools'] },
      { title: 'Vomit Draft presets count in hours', detail: 'The first preset now reads 0.5 hr, matching 1 / 1.5 / 2 hr.', tags: ['UI'] },
    ],
  },
  {
    version: '1.66',
    date: '2026-07-15',
    items: [
      { title: 'Script History lives in the Project menu', detail: 'The whole submenu — Take Auto Save, Auto Saves, Track Changes, Compare — moved from Tools to Project, next to Spelling & Grammar. It\'s script management, not a writing aid.', tags: ['UI'] },
    ],
  },
  {
    version: '1.65',
    date: '2026-07-15',
    items: [
      { title: 'One Draft label field', detail: 'Settings > General\'s "Default draft label" is gone; the Draft label field in Settings > Save Options does it all now — Apply updates the current script (synced with the Title Page and Production menu, as before), and Set as Default makes the value what new scripts start as.', tags: ['UI', 'Saving'] },
    ],
  },
  {
    version: '1.64',
    date: '2026-07-15',
    items: [
      { title: 'Title Page shows in one menu, not two', detail: 'It heads the Production menu as before — and appears in the Project menu only when you\'ve hidden Production in Customize > Menu Bar, so it\'s always reachable but never duplicated.', tags: ['UI'] },
    ],
  },
  {
    version: '1.63',
    date: '2026-07-15',
    items: [
      { title: 'One Spelling & Grammar, with everything in it', detail: 'It was in two places — a dockable panel under Project (spelling only) and a fuller submenu under Tools. Now there\'s one: the extensive version lives in the Project menu, and the dockable panel carries the full set — Spelling and Suggestions tabs, both auto-check toggles, and Settings — so it can sit in a sidebar or the toolbar without losing features.', tags: ['Tools', 'UI'] },
      { title: 'Vomit Draft preset label fixed', detail: 'The 90-minute preset read "1.5½ hr". It\'s "1.5 hr".', tags: ['Fix', 'UI'] },
    ],
  },
  {
    version: '1.62',
    date: '2026-07-15',
    items: [
      { title: 'New tool: Vomit Draft', detail: 'A timed no-editing writing sprint (Tools > Vomit Draft; dockable like any tool). Pick 30/60/90/120 minutes, a custom amount, or an end time — until the timer runs out, previous text is locked and you just keep writing. The line you\'re on stays workable, saving and exporting work as normal, and a floating countdown stays on screen. Blocked edits shake the timer instead of failing silently. When time is up (or the script is switched), full editing returns.', tags: ['New Feature', 'Tools'] },
    ],
  },
  {
    version: '1.61',
    date: '2026-07-14',
    items: [
      { title: 'Smart quotes and dashes', detail: 'Straight "quotes" curl as you type and two hyphens become an em dash (—). Settings > General > Editing toggles it live; text already typed is never altered. Trailing dots are deliberately left alone — dot-dot-dot is a screenwriting idiom.', tags: ['New Feature', 'Editor'] },
      { title: 'Inches or centimeters', detail: 'Settings > General > Measurements: Page Setup shows page size and margins in your unit of choice. Stored values never change — only the display converts, so switching back and forth never drifts a layout.', tags: ['New Feature', 'UI'] },
    ],
  },
  {
    version: '1.60',
    date: '2026-07-13',
    items: [
      { title: 'Spell check by default', detail: 'Settings > General > Editing: start new scripts with spell-check-as-you-type on. Each script\'s own toggle still wins.', tags: ['New Feature'] },
      { title: 'Remember the window', detail: 'Settings > General > Startup: launch maximized (the default) or restore your last window size and position.', tags: ['New Feature', 'UI'] },
      { title: 'Match the system appearance', detail: 'Settings > General > Appearance: the theme follows macOS light/dark when enabled.', tags: ['New Feature', 'UI'] },
      { title: 'Your default draft label', detail: 'Settings > General > Scripts: choose what the Draft field starts as on a new script (was hardcoded to "1st Draft").', tags: ['New Feature', 'Saving'] },
    ],
  },
  {
    version: '1.59',
    date: '2026-07-13',
    items: [
      { title: 'The thin caret is rolled back', detail: 'v1.58\'s custom caret produced a double cursor and broke Enter. The native caret is back while a safer approach is found — typing comes first.', tags: ['Fix', 'Editor'] },
      { title: 'Choose your date format', detail: 'Settings > General > Date format: Short (07/13/26, the default), Local, Friendly, US, European, or ISO. The Version autofill and the changelog follow it.', tags: ['New Feature'] },
      { title: 'Changelog version rows carry the tags', detail: 'Each version\'s tags sit right-aligned on its version-and-date row instead of a per-item column.', tags: ['UI'] },
    ],
  },
  {
    version: '1.58',
    date: '2026-07-13',
    items: [
      { title: 'A thinner, steadier cursor', detail: 'The editor caret used to fatten with zoom (it lived inside the page\'s scale transform). It\'s now drawn by the editor itself at a constant ~1px at any zoom — and it stays visible even when the editor isn\'t focused.', tags: ['Editor', 'UI'] },
    ],
  },
  {
    version: '1.57',
    date: '2026-07-13',
    items: [
      { title: 'Launching with nothing opens New Script', detail: 'First run, reopen-last turned off, or no remembered document — the app starts at the New Script prompt instead of a bare page, so every script begins properly seeded with an Action element and its hint.', tags: ['New Feature', 'Fix'] },
      { title: 'Changelog filter polish', detail: 'The tag filter is a dropdown, and each change\'s tags sit in their own column to the right of the description.', tags: ['UI'] },
    ],
  },
  {
    version: '1.56',
    date: '2026-07-13',
    items: [
      { title: 'Changelog tags and filters', detail: 'Every change wears colored tags (UI, Fix, Saving, …) so the list scans at a glance, and the changelog window gained a filter bar: keywords, tags, and a date range.', tags: ['New Feature', 'UI'] },
    ],
  },
  {
    version: '1.55',
    date: '2026-07-13',
    items: [
      { tags: ['UI' as const], title: 'Menus say when there\'s a next step', detail: 'Every menu item that opens a dialog, picker, or prompt before acting now ends with an ellipsis (…) — and only those. Exports, Feature Request, and Report a Bug gained theirs; the mixed three-dot spellings were unified.' },
      { tags: ['Fix' as const], title: 'The changelog is complete again', detail: 'It had frozen at 0.82 — the exact failure its own header warns about. Every version since is backfilled from the release record with its date, and updating this file is now part of shipping a version.' },
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
