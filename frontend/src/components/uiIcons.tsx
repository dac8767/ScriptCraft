/**
 * uiIcons (v0.99) — the icons for menus and toolbar items, in ONE place.
 *
 * Customize needs to show the same icon a thing wears in the real UI. The menu
 * icons were a private map inside MenuBar and the toolbar icons were inline JSX
 * in a switch statement inside Toolbar — so Customize couldn't reach either, and
 * the only alternative was to hand-copy them, which is how two lists drift apart.
 *
 * Both surfaces now read from here, so an icon changed once changes everywhere.
 * (Panel tools already had an `icon` on their ToolDef — Customize just reads it.)
 */
import React from 'react';
import {
  FaFile, FaPencilAlt, FaPalette, FaClipboardList, FaRegEye, FaRegFlag, FaWrench,
  FaColumns, FaRegQuestionCircle, FaStream,
  FaUndo, FaRedo, FaListOl, FaRegStickyNote, FaCheckSquare, FaFileAlt,
  FaBold, FaItalic, FaUnderline, FaStrikethrough, FaSubscript, FaSuperscript,
  FaHighlighter, FaAlignLeft, FaAlignCenter, FaAlignRight,
  FaAlignJustify, FaHashtag, FaStickyNote, FaTags,
  FaFont, FaTextHeight, FaDesktop, FaGripLinesVertical, FaArrowsAltH,
  FaLock, FaUnlock, FaTable,
} from 'react-icons/fa';
import { LuSearch, LuRotateCcw } from 'react-icons/lu';

/** Customize's utility rows (v1.33) — one icon per concept, read by BOTH the
 *  Panels tab and the Toolbar tab so the two lists can't drift.
 *  v4.31 (Derek's icon-audit pick, group 18-B): the Quick Access tab's pair
 *  is the standard now, and it reads THIS registry too. */
export const UTILITY_ICONS: Record<'divider' | 'spacer', React.ReactNode> = {
  divider: <FaGripLinesVertical />,
  spacer: <FaArrowsAltH />,
};

/** v4.38, Derek: TWO verbs, TWO faces — so a window's fullscreen button can
 *  never be confused with a control that merely enlarges a piece of content.
 *
 *  FullscreenIcon — the SQUARE (the icon-audit's option A, the former ⛶
 *  four-corners face): takes the whole TOOL fullscreen over the editor area.
 *  ExpandIcon / ShrinkIcon — the diagonal-arrows pair (the v4.31 pick, now
 *  scoped down): expand/restore ONE thing — a character card into its modal,
 *  a synopsis, an Outline section. */
export const FullscreenIcon: React.FC<{ size?: number }> = ({ size = 11 }) => (
  <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.5">
    <polyline points="1,4 1,1 4,1" />
    <polyline points="10,1 13,1 13,4" />
    <polyline points="13,10 13,13 10,13" />
    <polyline points="4,13 1,13 1,10" />
  </svg>
);
/** v4.43, Derek: the window-header close is an SVG twin of the × glyph. A
 *  font glyph is seated by FONT metrics (baseline/ascent), which differ per
 *  platform — beside a geometric SVG icon it sat a hair off on his Mac no
 *  matter how the boxes aligned. Same 14-box, same 1.5 stroke as
 *  FullscreenIcon, so the pair centers identically everywhere. */
export const CloseIcon: React.FC<{ size?: number }> = ({ size = 11 }) => (
  // v4.69, Derek: the × ink spans 1→13 — the same 12-unit extent as the
  // fullscreen square — so the two icons read the same visual height.
  <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.5">
    <line x1="1" y1="1" x2="13" y2="13" />
    <line x1="13" y1="1" x2="1" y2="13" />
  </svg>
);
/** v4.78, Derek: the fullscreen header's minimize/shrink — back to a floating
 *  window. Windows-restore shape (two offset outline squares), same 14-box /
 *  1.5 stroke / 1→13 ink family as FullscreenIcon and CloseIcon. */
export const RestoreIcon: React.FC<{ size?: number }> = ({ size = 11 }) => (
  <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="1" y="4.5" width="8.5" height="8.5" />
    <polyline points="4.5,4.5 4.5,1 13,1 13,9.5 9.5,9.5" />
  </svg>
);
export const ExpandIcon: React.FC<{ size?: number }> = ({ size = 11 }) => (
  <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.5">
    <polyline points="9,1 13,1 13,5" /><line x1="8" y1="6" x2="13" y2="1" />
    <polyline points="5,13 1,13 1,9" /><line x1="6" y1="8" x2="1" y2="13" />
  </svg>
);
export const ShrinkIcon: React.FC<{ size?: number }> = ({ size = 11 }) => (
  <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.5">
    <polyline points="9,1 9,5 13,5" /><line x1="13" y1="1" x2="9" y2="5" />
    <polyline points="5,13 5,9 1,9" /><line x1="1" y1="13" x2="5" y2="9" />
  </svg>
);

/**
 * v1.32: the double-chevron (») for the side-panel pop-out / pop-in buttons.
 * One inline SVG, drawn in currentColor and mirrored with a transform — so it
 * takes every theme's text color (white on dark) and points either way without
 * needing an icon file per color or direction.
 */
const CHEVRON_TRANSFORM: Record<string, string | undefined> = {
  right: undefined,
  left: 'scaleX(-1)',
  down: 'rotate(90deg)',
  up: 'rotate(-90deg)',
};

export const DoubleChevronIcon: React.FC<{
  towards: 'left' | 'right' | 'up' | 'down';
  size?: number;
}> = ({ towards, size = 13 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    aria-hidden="true"
    focusable="false"
    style={CHEVRON_TRANSFORM[towards] ? { transform: CHEVRON_TRANSFORM[towards] } : undefined}
  >
    <path d="M2.5 2.5 L8 8 L2.5 13.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8.5 2.5 L14 8 L8.5 13.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* (v4.32: the FilterIcon funnel is retired — filters are text-labelled
   dropdowns per Derek's window standard; the last consumer, ListToolbar,
   is gone.) */

/** v1.38: circled minus / plus for the zoom stepper — Derek's artwork as
 *  currentColor vectors, so they tint with every theme like the chevrons. */
const CircleIconBase: React.FC<{ size: number; children: React.ReactNode }> = ({ size, children }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <circle cx="8" cy="8" r="6.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
    {children}
  </svg>
);
export const CircleMinusIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <CircleIconBase size={size}>
    <path d="M4.9 8 H11.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </CircleIconBase>
);
export const CirclePlusIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <CircleIconBase size={size}>
    <path d="M4.9 8 H11.1 M8 4.9 V11.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </CircleIconBase>
);

/** v1.46: the Save dialog's folder-browse icon — Derek's flat-blue folder
 *  artwork (back folder, tucked paper, front flap). Fixed colors on purpose:
 *  it's artwork, not a glyph, so it doesn't take the theme's text color. */
export const FolderIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path d="M1 3.4c0-.9.7-1.6 1.6-1.6h3c.5 0 .9.2 1.2.5l.9 1h5.7c.9 0 1.6.7 1.6 1.6v7.5c0 .9-.7 1.6-1.6 1.6H2.6c-.9 0-1.6-.7-1.6-1.6z" fill="#63a3f5" />
    <rect x="2.7" y="4.7" width="10.6" height="8" rx="1" fill="#e9e9ee" />
    <path d="M1 7.6c0-.9.7-1.6 1.6-1.6h5.8c.5 0 1-.2 1.3-.6l.3-.3c.3-.4.8-.6 1.3-.6h2.1c.9 0 1.6.7 1.6 1.6v5.7c0 .9-.7 1.6-1.6 1.6H2.6c-.9 0-1.6-.7-1.6-1.6z" fill="#8ecdfb" />
  </svg>
);

/** Vomit Draft (v1.71) — Derek's line-art face, recreated as strokes so it
 *  follows currentColor like the font icons (a black bitmap would vanish on
 *  dark themes). Circle head open at the bottom, > < squeezed-shut eyes, a
 *  mouth arch with twin streams curling outward, chunk dots inside and out. */
export const VomitIcon: React.FC<{ size?: number | string }> = ({ size = '1em' }) => (
  <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true" focusable="false">
    <g fill="none" stroke="currentColor" strokeWidth="30" strokeLinecap="round" strokeLinejoin="round">
      {/* head — the arc stays open at the bottom where the streams exit */}
      <path d="M324,428 A200,200 0 1 0 188,428" />
      {/* eyes: > < */}
      <path d="M150,163 L217,207 L150,251" />
      <path d="M362,163 L295,207 L362,251" />
      {/* mouth arch */}
      <path d="M162,348 C192,296 224,274 256,274 C288,274 320,296 350,348" />
      {/* streams with outward curls */}
      <path d="M196,332 L196,438 C196,468 180,484 152,487" />
      <path d="M316,332 L316,438 C316,468 332,484 360,487" />
    </g>
    <g fill="currentColor">
      {/* chunks in the stream */}
      <circle cx="256" cy="352" r="13" />
      <circle cx="267" cy="416" r="13" />
      <circle cx="229" cy="462" r="11" />
      {/* stray chunks outside */}
      <circle cx="104" cy="406" r="23" />
      <circle cx="451" cy="446" r="24" />
    </g>
  </svg>
);

/** v4.53, Derek: the two panel toggles were the SAME FaColumns glyph — now a
 *  pair with the FILLED side naming the panel each one toggles. */
export const PanelLeftIcon: React.FC<{ size?: number }> = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <rect x="1.25" y="2.25" width="13.5" height="11.5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <rect x="3.2" y="4.2" width="3.4" height="7.6" rx="0.8" fill="currentColor" />
  </svg>
);
export const PanelRightIcon: React.FC<{ size?: number }> = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <rect x="1.25" y="2.25" width="13.5" height="11.5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <rect x="9.4" y="4.2" width="3.4" height="7.6" rx="0.8" fill="currentColor" />
  </svg>
);

/* (v4.39: chevronTowards is gone with the pop-in/pop-out buttons — windows
   dock and undock by drag now. DoubleChevronIcon stays: the collapsed-panel
   expand strips still point with it.) */

/** Menu-bar menus, by label. */
export const MENU_ICONS: Record<string, React.ReactNode> = {
  File: <FaFile />,
  Edit: <FaPencilAlt />,
  Format: <FaPalette />,
  Production: <FaClipboardList />,
  // v4.31 icon unification (Derek's audit picks): eye = outline (11-B),
  // add = the ASCII + everywhere (4-B), help = outline circle (16-B).
  View: <FaRegEye />,
  Tools: <FaWrench />,
  Insert: <span className="menu-txt-icon" aria-hidden="true">+</span>,
  Project: <FaColumns />,
  Help: <FaRegQuestionCircle />,
};

/** Toolbar built-ins, by key — the same icon each button shows. */
export const TOOLBAR_ICONS: Record<string, React.ReactNode> = {
  customize: <FaWrench />,   // v2.02: a Big Button item again
  undo: <FaUndo />,
  redo: <FaRedo />,
  element: <FaTextHeight />,
  insertSection: <FaListOl />,
  insertNote: <FaRegStickyNote />,
  insertChecklist: <FaCheckSquare />,
  titlePage: <FaFileAlt />,
  fontFamily: <FaFont />,
  fontSize: <FaTextHeight />,
  bold: <FaBold />,
  italic: <FaItalic />,
  underline: <FaUnderline />,
  strike: <FaStrikethrough />,
  subscript: <FaSubscript />,
  superscript: <FaSuperscript />,
  // v3.01, Derek: the Text Color icon is a red A (his one deliberate
  // exception to the monotone-icons rule).
  textColor: <span className="fs-textcolor-icon" aria-hidden="true">A</span>,
  highlightColor: <FaHighlighter />,
  alignLeft: <FaAlignLeft />,
  alignCenter: <FaAlignCenter />,
  alignRight: <FaAlignRight />,
  alignJustify: <FaAlignJustify />,
  find: <LuSearch />,   // v4.31: search = the Lu magnifier (3-B)
  goto: <FaHashtag />,
  scriptNotes: <FaStickyNote />,
  tags: <FaTags />,
  // v5.25: Markups — create at cursor/selection, and the visibility toggle
  // (the live button swaps eye/eye-slash by state, the lockResize model).
  markupScript: <FaRegFlag />,
  toggleMarkups: <FaRegEye />,
  zoom: <CirclePlusIcon />,   // v4.31: zoom = the circled steppers (14-B)
  view: <FaDesktop />,
  // v2.34: surface toggles. The right panel is the left icon mirrored —
  // one glyph, two directions.
  toggleOutlineBar: <FaStream />,
  // v2.55: the sizing lock — the Toolbar swaps to lockResizeOpen when off.
  lockResize: <FaLock />,
  lockResizeOpen: <FaUnlock />,
  // v2.67: reset every adjustable size/spacing back to defaults.
  // v4.31 (audit 13-B): the counter-clockwise rotate is THE reset icon now.
  resetSizes: <LuRotateCcw />,
  // v2.94: the Scrapbook's insert-table grid, promoted to toolbar row 2 —
  // it can't live in a native menu (macOS menus can't host the grid picker).
  insertTable: <FaTable />,
};
