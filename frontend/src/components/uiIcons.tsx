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
  FaFile, FaPencilAlt, FaPalette, FaClipboardList, FaEye, FaWrench, FaPlus,
  FaColumns, FaQuestionCircle,
  FaUndo, FaRedo, FaListOl, FaRegStickyNote, FaCheckSquare, FaFileAlt,
  FaBold, FaItalic, FaUnderline, FaStrikethrough, FaSubscript, FaSuperscript,
  FaPaintBrush, FaHighlighter, FaAlignLeft, FaAlignCenter, FaAlignRight,
  FaAlignJustify, FaSearch, FaHashtag, FaStickyNote, FaTags, FaSearchPlus,
  FaFont, FaTextHeight, FaDesktop, FaMinus, FaArrowsAltV,
} from 'react-icons/fa';

/** Customize's utility rows (v1.33) — one icon per concept, read by BOTH the
 *  Panels tab and the Toolbar tab so the two lists can't drift. */
export const UTILITY_ICONS: Record<'divider' | 'spacer', React.ReactNode> = {
  divider: <FaMinus />,
  spacer: <FaArrowsAltV />,
};

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

/** Which way the double chevron points: pop-out sends the window AWAY from its
 *  panel; pop-in sends it back TOWARD the panel. */
export const chevronTowards = (button: 'popout' | 'popin', side: 'left' | 'right'): 'left' | 'right' =>
  (button === 'popout') === (side === 'right') ? 'left' : 'right';

/** Menu-bar menus, by label. */
export const MENU_ICONS: Record<string, React.ReactNode> = {
  File: <FaFile />,
  Edit: <FaPencilAlt />,
  Format: <FaPalette />,
  Production: <FaClipboardList />,
  View: <FaEye />,
  Tools: <FaWrench />,
  Insert: <FaPlus />,
  Project: <FaColumns />,
  Help: <FaQuestionCircle />,
};

/** Toolbar built-ins, by key — the same icon each button shows. */
export const TOOLBAR_ICONS: Record<string, React.ReactNode> = {
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
  textColor: <FaPaintBrush />,
  highlightColor: <FaHighlighter />,
  alignLeft: <FaAlignLeft />,
  alignCenter: <FaAlignCenter />,
  alignRight: <FaAlignRight />,
  alignJustify: <FaAlignJustify />,
  find: <FaSearch />,
  goto: <FaHashtag />,
  scriptNotes: <FaStickyNote />,
  tags: <FaTags />,
  zoom: <FaSearchPlus />,
  view: <FaDesktop />,
};
