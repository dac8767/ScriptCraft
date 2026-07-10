/**
 * Toolbar command registry (v0.38) — every Production/Tools menu COMMAND that
 * can be pinned to the toolbar as a button. Commands whose UI lives in
 * MenuBar-mounted dialogs run via a window event ('freedraft:command') that
 * MenuBar listens for, so no dialog state needs hoisting; commands backed by
 * store setters run directly.
 */
import React from 'react';
import {
  FaFileAlt, FaFileSignature, FaEdit, FaListUl, FaLock, FaToggleOn,
  FaUpload, FaHistory, FaExchangeAlt, FaSpellCheck, FaTags, FaCodeBranch,
} from 'react-icons/fa';
import { useEditorStore } from '../stores/editorStore';

export interface ToolbarCommand {
  id: string;
  label: string;
  icon: React.ReactNode;
  run: () => void;
}

const emit = (id: string) =>
  window.dispatchEvent(new CustomEvent('freedraft:command', { detail: id }));

export const TOOLBAR_COMMANDS: ToolbarCommand[] = [
  { id: 'titlePage', label: 'Title Page', icon: <FaFileAlt />, run: () => useEditorStore.getState().setTitlePageEditorOpen(true) },
  { id: 'setDraft', label: 'Set Draft Number', icon: <FaFileSignature />, run: () => emit('setDraft') },
  { id: 'rename', label: 'Rename', icon: <FaEdit />, run: () => emit('rename') },
  { id: 'addSceneNumbers', label: 'Add Scene Numbers', icon: <FaListUl />, run: () => useEditorStore.getState().setSceneNumbersVisible(true) },
  { id: 'removeSceneNumbers', label: 'Remove Scene Numbers', icon: <FaListUl />, run: () => useEditorStore.getState().setSceneNumbersVisible(false) },
  { id: 'lockSceneNumbers', label: 'Lock Scene Numbers', icon: <FaLock />, run: () => { const s = useEditorStore.getState(); s.setSceneNumbersLocked(!s.sceneNumbersLocked); } },
  { id: 'revisionMode', label: 'Revision Mode', icon: <FaToggleOn />, run: () => { const s = useEditorStore.getState(); s.setRevisionMode(!s.revisionMode); } },
  { id: 'productionTags', label: 'Production Tags', icon: <FaTags />, run: () => useEditorStore.getState().openTool('tags') },
  { id: 'takeSnapshot', label: 'Take Snapshot', icon: <FaUpload />, run: () => emit('takeSnapshot') },
  { id: 'snapshots', label: 'Snapshots', icon: <FaHistory />, run: () => emit('snapshots') },
  { id: 'compareSnapshot', label: 'Compare with Snapshot', icon: <FaCodeBranch />, run: () => emit('compareSnapshot') },
  { id: 'trackChanges', label: 'Track Changes', icon: <FaExchangeAlt />, run: () => emit('trackChanges') },
  { id: 'spellCheck', label: 'Spell Check', icon: <FaSpellCheck />, run: () => emit('spellCheck') },
  { id: 'writingSuggestions', label: 'Writing Suggestions', icon: <FaSpellCheck />, run: () => emit('writingSuggestions') },
];

export const commandDef = (id: string): ToolbarCommand | null =>
  TOOLBAR_COMMANDS.find((c) => c.id === id) || null;
