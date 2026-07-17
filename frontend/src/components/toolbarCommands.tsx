/**
 * Toolbar command registry (v0.38) — every Production/Tools menu COMMAND that
 * can be pinned to the toolbar as a button. Commands whose UI lives in
 * MenuBar-mounted dialogs run via a window event ('scriptcraft:command') that
 * MenuBar listens for, so no dialog state needs hoisting; commands backed by
 * store setters run directly.
 */
import React from 'react';
import {
  FaFileAlt, FaFileSignature, FaEdit, FaListUl, FaLock, FaToggleOn,
  FaUpload, FaHistory, FaExchangeAlt, FaSpellCheck, FaTags, FaCodeBranch,
  FaFile, FaFolderOpen, FaFileImport, FaSave, FaRegSave, FaPrint, FaEye,
  FaFilePdf, FaFileExport, FaFileWord, FaCog, FaCut, FaCopy, FaPaste,
  FaMousePointer, FaColumns, FaImage, FaFlag, FaSearchPlus, FaSearchMinus,
  FaRulerHorizontal, FaInfoCircle, FaKeyboard, FaExternalLinkAlt, FaBug,
  FaPencilAlt,
} from 'react-icons/fa';
import { useEditorStore } from '../stores/editorStore';

export interface ToolbarCommand {
  id: string;
  label: string;
  icon: React.ReactNode;
  run: () => void;
}

const emit = (id: string) =>
  window.dispatchEvent(new CustomEvent('scriptcraft:command', { detail: id }));

export const TOOLBAR_COMMANDS: ToolbarCommand[] = [
  { id: 'titlePage', label: 'Title Page', icon: <FaFileAlt />, run: () => useEditorStore.getState().setTitlePageEditorOpen(true) },
  { id: 'setDraft', label: 'Set Draft Number', icon: <FaFileSignature />, run: () => emit('setDraft') },
  { id: 'rename', label: 'Rename', icon: <FaEdit />, run: () => emit('rename') },
  { id: 'addSceneNumbers', label: 'Add Scene Numbers', icon: <FaListUl />, run: () => useEditorStore.getState().setSceneNumbersVisible(true) },
  { id: 'removeSceneNumbers', label: 'Remove Scene Numbers', icon: <FaListUl />, run: () => useEditorStore.getState().setSceneNumbersVisible(false) },
  { id: 'lockSceneNumbers', label: 'Lock Scene Numbers', icon: <FaLock />, run: () => { const s = useEditorStore.getState(); s.setSceneNumbersLocked(!s.sceneNumbersLocked); } },
  { id: 'revisionMode', label: 'Revision Mode', icon: <FaToggleOn />, run: () => { const s = useEditorStore.getState(); s.setRevisionMode(!s.revisionMode); } },
  { id: 'productionTags', label: 'Production Tags', icon: <FaTags />, run: () => useEditorStore.getState().openTool('tags') },
  { id: 'takeSnapshot', label: 'Take Auto Save', icon: <FaUpload />, run: () => emit('takeSnapshot') },
  { id: 'snapshots', label: 'Auto Saves', icon: <FaHistory />, run: () => emit('snapshots') },
  { id: 'compareSnapshot', label: 'Compare with Auto Save', icon: <FaCodeBranch />, run: () => emit('compareSnapshot') },
  { id: 'trackChanges', label: 'Track Changes', icon: <FaExchangeAlt />, run: () => emit('trackChanges') },
  { id: 'spellCheck', label: 'Spell Check', icon: <FaSpellCheck />, run: () => emit('spellCheck') },
  { id: 'writingSuggestions', label: 'Writing Suggestions', icon: <FaSpellCheck />, run: () => emit('writingSuggestions') },
  // v2.97, Derek: EVERY menu action is ribbon-pinnable. These run through
  // the same 'scriptcraft:command' bus, which falls back to MenuBar's
  // shortcut-actions map — one closure per command, three surfaces.
  { id: 'newScreenplay', label: 'New Script', icon: <FaFile />, run: () => emit('newScreenplay') },
  { id: 'openFile', label: 'Open', icon: <FaFolderOpen />, run: () => emit('openFile') },
  { id: 'importLocal', label: 'Import', icon: <FaFileImport />, run: () => emit('importLocal') },
  { id: 'save', label: 'Save', icon: <FaSave />, run: () => emit('save') },
  { id: 'saveAs', label: 'Save As', icon: <FaRegSave />, run: () => emit('saveAs') },
  { id: 'print', label: 'Print', icon: <FaPrint />, run: () => emit('print') },
  { id: 'preview', label: 'Preview', icon: <FaEye />, run: () => emit('preview') },
  { id: 'exportPDF', label: 'Export PDF', icon: <FaFilePdf />, run: () => emit('exportPDF') },
  { id: 'exportFDX', label: 'Export FDX', icon: <FaFileExport />, run: () => emit('exportFDX') },
  { id: 'exportFountain', label: 'Export Fountain', icon: <FaFileAlt />, run: () => emit('exportFountain') },
  { id: 'exportDocx', label: 'Export Word (.docx)', icon: <FaFileWord />, run: () => emit('exportDocx') },
  { id: 'settings', label: 'Settings', icon: <FaCog />, run: () => emit('settings') },
  // v3.42, Derek: show/hide the side panels from the ribbon (same toggles the
  // panel edge strips use).
  { id: 'toggleLeftPanel', label: 'Toggle Left Panel', icon: <FaColumns />, run: () => useEditorStore.getState().toggleNavigator() },
  { id: 'toggleRightPanel', label: 'Toggle Right Panel', icon: <FaColumns />, run: () => useEditorStore.getState().toggleShelf() },
  { id: 'cut', label: 'Cut', icon: <FaCut />, run: () => emit('cut') },
  { id: 'copy', label: 'Copy', icon: <FaCopy />, run: () => emit('copy') },
  { id: 'paste', label: 'Paste', icon: <FaPaste />, run: () => emit('paste') },
  { id: 'selectAll', label: 'Select All', icon: <FaMousePointer />, run: () => emit('selectAll') },
  { id: 'dualDialogue', label: 'Dual Dialogue', icon: <FaColumns />, run: () => emit('dualDialogue') },
  // v2.98, Derek: the rest of the menus — import variants, the .odraft
  // export, Insert/View/Format/Help actions. fitPage/fitWidth are handled
  // by ScreenplayEditor's listener on the same bus.
  { id: 'importDocx', label: 'Import Word (.docx)', icon: <FaFileWord />, run: () => emit('importDocx') },
  { id: 'importPdf', label: 'Import PDF', icon: <FaFilePdf />, run: () => emit('importPdf') },
  { id: 'exportOdraft', label: 'Export ScriptCraft (.odraft)', icon: <FaFile />, run: () => emit('exportOdraft') },
  { id: 'insertImage', label: 'Insert Image', icon: <FaImage />, run: () => emit('insertImage') },
  { id: 'insertMarker', label: 'Insert Marker', icon: <FaFlag />, run: () => emit('insertMarker') },
  { id: 'fitPage', label: 'Scale to Fit Page', icon: <FaSearchPlus />, run: () => emit('fitPage') },
  { id: 'fitWidth', label: 'Scale to Max Width', icon: <FaSearchPlus />, run: () => emit('fitWidth') },
  { id: 'actualSize', label: 'Actual Size (100%)', icon: <FaSearchMinus />, run: () => emit('actualSize') },
  { id: 'showRulers', label: 'Show/Hide Rulers', icon: <FaRulerHorizontal />, run: () => emit('showRulers') },
  // v3.25: bookmarks removed (markers cover them); Last Edit stays pinnable.
  { id: 'lastEditLocation', label: 'Last Edit Location', icon: <FaPencilAlt />, run: () => emit('lastEditLocation') },
  { id: 'formatPrefs', label: 'Script Format Preferences', icon: <FaFileAlt />, run: () => emit('formatPrefs') },
  { id: 'grammarSettings', label: 'Grammar & Spelling Settings', icon: <FaSpellCheck />, run: () => emit('grammarSettings') },
  { id: 'about', label: 'About ScriptCraft', icon: <FaInfoCircle />, run: () => emit('about') },
  { id: 'keyboardShortcuts', label: 'Keyboard Shortcuts', icon: <FaKeyboard />, run: () => emit('keyboardShortcuts') },
  { id: 'knowledgeBase', label: 'Knowledge Base', icon: <FaInfoCircle />, run: () => emit('knowledgeBase') },
  { id: 'changelog', label: 'Changelog', icon: <FaHistory />, run: () => emit('changelog') },
  { id: 'featureRequest', label: 'Feature Request', icon: <FaExternalLinkAlt />, run: () => emit('featureRequest') },
  { id: 'reportBug', label: 'Report a Bug', icon: <FaBug />, run: () => emit('reportBug') },
];

export const commandDef = (id: string): ToolbarCommand | null =>
  TOOLBAR_COMMANDS.find((c) => c.id === id) || null;
