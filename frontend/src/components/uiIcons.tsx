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
  FaFont, FaTextHeight, FaDesktop,
} from 'react-icons/fa';

/**
 * v1.32: the double-chevron (») for the side-panel pop-out / pop-in buttons.
 * One inline SVG, drawn in currentColor and mirrored with a transform — so it
 * takes every theme's text color (white on dark) and points either way without
 * needing an icon file per color or direction.
 */
export const DoubleChevronIcon: React.FC<{ towards: 'left' | 'right'; size?: number }> = ({
  towards,
  size = 13,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    aria-hidden="true"
    focusable="false"
    style={towards === 'left' ? { transform: 'scaleX(-1)' } : undefined}
  >
    <path d="M2.5 2.5 L8 8 L2.5 13.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8.5 2.5 L14 8 L8.5 13.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
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
