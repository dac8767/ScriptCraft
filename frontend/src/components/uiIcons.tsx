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
