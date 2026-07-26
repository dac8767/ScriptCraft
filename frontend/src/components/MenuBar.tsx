import React, { useState, useRef, useEffect, useCallback } from 'react';
import CustomizePanelsDialog from './CustomizePanelsDialog';
import EditElementsDialog from './EditElementsDialog';
import { SaveWorkspaceDialog, EditWorkspacesDialog } from './WorkspaceDialogs';
import PreferencesDialog from './PreferencesDialog';
import { PresetsDialog } from './PresetsPanel';
import SetDraftDialog from './SetDraftDialog';
import NewScriptDialog, { type NewScriptMeta } from './NewScriptDialog';
import NewScriptLauncher from './NewScriptLauncher';
import GuidedSetupDialog from './GuidedSetupDialog';
import RenameDialog from './RenameDialog';
import HelpReferenceDialog from './HelpReferenceDialog';
import { ALL_TOOLS } from './ToolDock';

/** Project menu: script structure / story elements / project management. */
const PROJECT_MENU_GROUPS: string[][] = [
  ['navigator', 'pages', 'scenes'],
  ['locations', 'characters'],
  // v0.62: Asset Manager is a Project window again (rolled back from File);
  // 'projects' stays out — the Project Manager lives under File.
  // v1.63: 'spelling' is NOT a plain item here anymore — Spelling & Grammar
  // is the extensive submenu appended to the Project menu below (one version,
  // one home; the docked panel now carries the full feature set).
  // v3.24: 'titlepage' is out of the windows groups — the merged-in
  // Production block heads with Title Page (one home, per v1.64's rule).
  ['assets'],
];
/** Tools menu: story planning / writing aids / production & analysis. */
const TOOL_MENU_GROUPS: string[][] = [
  // v4.24 batch 7: 'indexcards' retired — it's the Scenes tool's Cards view.
  ['beatboard'],
  ['sticky', 'fragments', 'todo', 'highlights'],
  // 'tags' is intentionally absent: Production Tags opens from the
  // Production menu (its conceptual home); the window itself remains a
  // dockable Tool in Customize.
  ['analytics', 'goals', 'typewriter', 'aiwriter', 'notebook'],
];
/** v1.83: Format > Highlighting color list — Final Draft's palette. */
const HIGHLIGHT_MENU_COLORS: Array<[string, string]> = [
  ['Yellow', '#ffff00'], ['Green', '#00f900'], ['Cyan', '#00fdff'],
  ['Blue', '#3e9bff'], ['Purple', '#9d9bff'], ['Magenta', '#ff85ff'],
  ['Red', '#ff5257'], ['Tangerine', '#ff9300'],
];
import { createPortal } from 'react-dom';
import { Editor } from '@tiptap/react';
import { smartUndo, smartRedo, useEditorStore, DEFAULT_PAGE_LAYOUT, DEFAULT_TAG_CATEGORIES } from '../stores/editorStore';
import { useProjectStore } from '../stores/projectStore';
import { api } from '../services/api';
import { showToast } from './Toast';
import { DiagnosticsDialog } from './DiagnosticsDialog';
import { AboutDialog } from './AboutDialog';
import { ChangelogDialog } from './ChangelogDialog';
import { useBookmarkStore, bookmarkScriptKey } from '../stores/bookmarkStore';
import { openInBrowser, DONATE_URL } from '../services/external';
import { parseFountain } from '../utils/fountainParser';
import { parseFDXFull } from '../utils/fdxParser';
import { downloadFDX } from '../utils/fdxExporter';
import { downloadFountain } from '../utils/fountainExporter';
import { exportPDF } from '../utils/pdfExporter';
import { downloadDocx } from '../utils/docxExporter';
import { parseDocx } from '../utils/docxImporter';
import { downloadOdraft, parseOdraft } from '../utils/odraftFormat';
import { trackChangesPluginKey } from '../editor/trackChanges';
import PageSetupDialog from './PageSetupDialog';
import TemplateSelectDialog from './TemplateSelectDialog';
import ScriptFormatPreferencesDialog from './ScriptFormatPreferencesDialog';
import ScriptFormatPickerDialog from './ScriptFormatPickerDialog';
import { useFormattingTemplateStore } from '../stores/formattingTemplateStore';
import { applyScriptFormat } from '../utils/applyScriptFormat';
import { INDUSTRY_STANDARD_ID } from '../stores/formattingTypes';
import { getCurrentElementRule, getLockedFormatting } from '../utils/effectiveFormatting';
import { pluginRegistry } from '../plugins/registry';
import { LuSearch } from 'react-icons/lu';
import { MENU_ICONS, CirclePlusIcon, CircleMinusIcon } from './uiIcons';
import { useScrapbookMenus } from './NotebookTool';
import { FaTable, FaImage as FaImageIcon, FaChevronRight, FaChevronDown } from 'react-icons/fa';
import { chromePx, chromeScaleFactor } from './chromeSizes';
import GapHandle from './GapHandle';
import { syncNativeMenu, uninstallNativeMenu } from '../menu/nativeMenuSync';
import { isTauri as isTauriEnv } from '../services/platform';
import { eventToCombo, COMMAND_BY_ID, formatCombo } from './shortcuts';
import { useShortcutStore } from '../stores/shortcutStore';
import { useThemeStore } from '../stores/themeStore';
import { BUILTIN_THEMES } from './themes';
import { scriptApi } from '../services/scriptApi';
import { mirrorSave, mirrorSnapshot } from '../services/saveLocations';
import { useSettingsStore } from '../stores/settingsStore';
import { clearEditorHistory } from '../editor/clearHistory';
import { createScriptNoteAtSelection } from '../utils/scriptNoteActions';
import { importWorkspacesFromFile } from '../utils/workspaceImport';
import { composeSaveContent } from '../utils/screenplaySaveContent';
import { openTextFile, openBinaryFile } from '../utils/fileOps';
import { reportSaveError } from '../stores/saveErrorStore';
import { HELP_FORMS } from '../data/helpForms';
import type { MenuSection as PluginMenuSection } from '../plugins/registry';
import {
  FaExternalLinkAlt,
  FaRegStickyNote,
  FaCheckSquare,
  FaFile,
  FaFileImport,
  FaFolderOpen,
  FaSave,
  FaFileExport,
  FaFileCode,
  FaFilePdf,
  FaFileWord,
  FaCodeBranch,
  FaPrint,
  FaUndo,
  FaRedo,
  FaCut,
  FaCopy,
  FaPaste,
  FaMousePointer,
  FaTextHeight,
  FaHashtag,
  FaSpellCheck,
  FaPalette,
  FaListOl,
  FaBold,
  FaItalic,
  FaUnderline,
  FaStrikethrough,
  FaAlignLeft,
  FaAlignCenter,
  FaAlignRight,
  FaAlignJustify, FaHighlighter,
  FaColumns,
  FaFileAlt,
  FaImage,
  FaAdjust,
  FaUserFriends,
  FaSignInAlt,
  FaBars,
  FaInfoCircle,
  FaKeyboard,
  FaStethoscope,
  FaSearchPlus,
  FaUpload,
  FaHistory,
  FaExchangeAlt,
  FaListUl,
  FaToggleOn,
  FaLock,
  FaFileSignature,
  FaRegClone, FaStream,   FaEdit,
  FaTags,
  FaFlag, FaRegEyeSlash, FaRegEye, FaCheck, FaWrench,
  FaBug,
  FaRulerHorizontal,
  FaPencilAlt, FaCoffee, FaBoxOpen,
} from 'react-icons/fa';

/** v2.98: the Help-menu form links, shared by the menu items and the
 *  ribbon-pinnable commands — one place for each URL. */

/* v3.08, Derek: the donation link at the end of Help. Opens the Buy Me a
 * Coffee page in the DEFAULT browser — the BMC widget script is a remote
 * CDN embed, which a native menu can't render and the desktop app
 * shouldn't load (same rule as the dictionary CDN in §open items).
 * v3.12: opener + URL live in services/external.ts, shared with the
 * titlebar's donate button. */

interface MenuBarProps {
  editor: Editor | null;
  onCollaborate?: () => void;
  onJoinCollab?: () => void;
  isCollabActive?: boolean;
  isCollabGuest?: boolean;
}

interface MenuItem {
  label: string;
  shortcut?: string;
  action?: () => void;
  separator?: boolean;
  disabled?: boolean;
  children?: MenuItem[];
  /** v2.62: custom submenu content (e.g. the Scrapbook's table-size grid).
   *  Rendered inside the submenu flyout instead of a children list; `close`
   *  shuts the whole menu after the content commits its action. */
  render?: (close: () => void) => React.ReactNode;
  icon?: React.ReactNode;
  /** v3.05, Derek: checkable items set this (true OR false) instead of
   *  prefixing '✓ ' to the label. Any list containing a checkable item
   *  reserves a left check column so labels stay aligned (macOS style);
   *  the native bar renders these as real CheckMenuItems. */
  checked?: boolean;
}

interface MenuSection {
  label: string;
  items: MenuItem[];
}

const MenuBar: React.FC<MenuBarProps> = ({ editor, onCollaborate, onJoinCollab, isCollabActive, isCollabGuest }) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  // v4.28, Derek: the menus ALWAYS live in the macOS menu bar on desktop —
  // the in-window menu system and its setting are gone; there is no other
  // option. A plain-browser session (dev) still renders the in-window bar,
  // because there is no native bar for it to live in.
  const nativeMenus = isTauriEnv();
  const menuRef = useRef<HTMLDivElement>(null);
  // Platform-aware modifier key symbol for shortcut labels
  const mod = /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl+';
  const {
    menuBarOrder, menuBarHidden,
    previewMode,
    outlineBarOpen, setOutlineBarOpen,
    rulersVisible,
    highlightColor, setHighlightColor,
    notesVisible, setNotesVisible,
    scriptTodosVisible, setScriptTodosVisible,
    markersVisible, setMarkersVisible,
    sectionsVisible, setSectionsVisible,
    tagsVisible, setTagsVisible,
    viewStyle, setViewStyle,
    revisionMode,
    setRevisionMode,
    documentTitle,
    pageLayout,
    setSearchOpen,
    setGoToPageOpen,
    spellCheckEnabled,
    toggleSpellCheck,
    setSpellModalOpen,
    grammarCheckEnabled,
    toggleGrammarCheck,
    setGrammarModalOpen,
    setGrammarRulesPanelOpen,
    setOpenFileOpen,
    setPostSaveAction,
    setSaveAsOpen,
    theme,
    setTheme,
    workspaces,
    workspaceOrder,
    activeWorkspace,
    saveWorkspace,
    applyWorkspace,
    menuMode,
    chromeCustomPx,
    chromeGapPx,
    navigatorOpen,
    toggleNavigator,
    shelfOpen,
    toggleShelf,
    uiResizeLocked,
    zoomLevel,
    setZoomLevel,
    navPanelWidth,
    trackChangesEnabled,
    setTrackChangesEnabled,
    setTrackChangesLabel,
    setCompareVersionOpen,
    sceneNumbersVisible,
    setSceneNumbersVisible,
    sceneNumbersLocked,
    setSceneNumbersLocked,
  } = useEditorStore();

  const {
    currentProject,
    currentScriptId,
    setCurrentProject,
    setCurrentScriptId,
    setScripts,
    setVersionHistoryOpen,
  } = useProjectStore();

  // Build a saveable content object: editor JSON + store metadata at top level.
  // v4.24: delegates to composeSaveContent — this used to be a hand-forked
  // PARTIAL copy of the extras list (no _shelf, no _outlineTabs/_outlineStash,
  // no spell/grammar prefs), so a manual File > Save stripped the Scrapbook
  // and Outline tabs from the file until the next autosave healed it. The
  // extras list lives in exactly one place now; never fork it again.
  const buildSaveContent = useCallback((): Record<string, unknown> | undefined => {
    if (!editor || editor.isDestroyed) return undefined;
    return composeSaveContent(editor.getJSON());
  }, [editor]);

  // ── Save current editor content to backend ──
  const handleSave = useCallback(async () => {
    if (!editor) return;
    /*
     * v1.16 — Save behaves the way Save behaves everywhere else.
     *
     * Never saved before  -> open Save As, so you can name it.
     * Saved before        -> just save, and say so briefly. No dialog, no questions.
     */
    if (!currentProject || !currentScriptId) {
      setSaveAsOpen(true);
      return;
    }
    const { setSaveStatus } = useEditorStore.getState();
    setSaveStatus('saving');
    try {
      const content = buildSaveContent();
      await scriptApi.saveScript(currentProject.id, currentScriptId, { content });
      setSaveStatus('saved');
      showToast('Saved', 'success');   // the brief confirmation a silent save owes you
      if (content) {
        void mirrorSave({
          projectId: currentProject.id,
          scriptId: currentScriptId,
          projectName: currentProject.name,
          title: documentTitle || 'Untitled',
          content,
        });
      }
    } catch (err) {
      console.error('Save failed:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setSaveStatus('error', msg);
      // AuthGate / QuotaExceededDialog already surfaced handled errors (401,
      // 402, 403 unverified) — reportSaveError skips them.  Other failures
      // get the blocking modal so the user can't miss them.
      reportSaveError(err, 'manual-save');
    }
  }, [editor, currentProject, currentScriptId, buildSaveContent, setSaveAsOpen, documentTitle]);

  /** Save As: always opens the destination/project/filename picker, even when
   *  the current document is already saved. Use this to fork a local script
   *  to cloud (or vice versa) or to write a copy under a different name. */
  const handleSaveAs = useCallback(() => {
    if (!editor) return;
    setSaveAsOpen(true);
  }, [editor, setSaveAsOpen]);

  // ── Unsaved-changes confirmation before New / Import ──
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // ── Word import: best-effort warning shown before opening the file picker ──
  const [docxImportWarningOpen, setDocxImportWarningOpen] = useState(false);

  /** Returns true if the editor has unsaved changes worth prompting about.
   *  - If never saved to a project: true when editor has any meaningful text.
   *  - If saved to a project: true when auto-save hasn't caught up yet
   *    (saveStatus is 'unsaved', 'saving', or 'error'). The 30s auto-save
   *    interval leaves a window where edits exist only in memory; resetting
   *    the editor in that window would silently discard them. */
  const editorHasUnsavedChanges = useCallback((): boolean => {
    if (!editor) return false;
    if (currentProject && currentScriptId) {
      const status = useEditorStore.getState().saveStatus;
      return status === 'unsaved' || status === 'saving' || status === 'error';
    }
    // Never-saved document — prompt only if there's real content
    const text = editor.state.doc.textContent.trim();
    return text.length > 0;
  }, [editor, currentProject, currentScriptId]);

  const confirmOrRun = useCallback((action: () => void) => {
    if (editorHasUnsavedChanges()) {
      setPendingAction(() => action);
      setDiscardConfirmOpen(true);
    } else {
      action();
    }
  }, [editorHasUnsavedChanges]);

  const handleDiscardConfirmSave = useCallback(async () => {
    setDiscardConfirmOpen(false);
    if (!currentProject || !currentScriptId) {
      // No project yet — open save-as dialog; the pending action will run
      // after save-as completes (via postSaveAction in the store).
      if (pendingAction) setPostSaveAction(pendingAction);
      setPendingAction(null);
      setSaveAsOpen(true);
      return;
    }
    // Existing project — save inline, then run pending action
    await handleSave();
    pendingAction?.();
    setPendingAction(null);
  }, [handleSave, pendingAction, currentProject, currentScriptId, setSaveAsOpen, setPostSaveAction]);

  const handleDiscardConfirmDiscard = useCallback(() => {
    setDiscardConfirmOpen(false);
    pendingAction?.();
    setPendingAction(null);
  }, [pendingAction]);

  const handleDiscardConfirmCancel = useCallback(() => {
    setDiscardConfirmOpen(false);
    setPendingAction(null);
  }, []);

  // ── Page Setup ──
  const [pageSetupOpen, setPageSetupOpen] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  // v4.79: the Presets window (File ▸ Import/Export ▸ Presets…).
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [customizeTab, setCustomizeTab] =
    useState<'toolbar' | 'panels' | 'elements' | 'themes' | 'context'>('elements');
  const openCustomize = (tab: typeof customizeTab) => {
    setCustomizeTab(tab);
    setCustomizeOpen(true);
  };
  const [prefsOpen, setPrefsOpen] = useState(false);
  const preferencesRequest = useEditorStore((s) => s.preferencesRequest);
  const closePreferences = useEditorStore((s) => s.closePreferences);
  // v1.34: unfinished features (Collaboration, Lock Pages) hide from the menus
  // unless the Developer toggle shows them.
  const showUnreleasedTools = useEditorStore((s) => s.showUnreleasedTools);
  const setShowUnreleasedTools = useEditorStore((s) => s.setShowUnreleasedTools);
  const [helpForm, setHelpForm] = useState<{ title: string; url: string } | null>(null);
  const [draftDialogOpen, setDraftDialogOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [saveWorkspaceOpen, setSaveWorkspaceOpen] = useState(false);
  const [editWorkspacesOpen, setEditWorkspacesOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [knowledgeBaseOpen, setKnowledgeBaseOpen] = useState(false);
  const [templateSelectOpen, setTemplateSelectOpen] = useState(false);

  // ── Script-format preferences (multi-select) and per-script picker ──
  // `formatPrefsOpen` controls the multi-select preferences dialog. When `firstRun`
  // is true the dialog is non-cancellable and triggers `pendingFormatApply` after save.
  // `formatPickerOpen` is the single-select dialog shown when 2+ formats are enabled.
  const [formatPrefsOpen, setFormatPrefsOpen] = useState<{ firstRun: boolean; afterSave: 'apply-new-screenplay' | null } | null>(null);
  const [formatPickerOpen, setFormatPickerOpen] = useState(false);

  // ── Per-attribute locking from active template ──
  const activeTemplate = useFormattingTemplateStore((s) => s.getActiveTemplate());
  // v0.71: element visibility/order come from the user's persisted overrides
  // applied over the active template (system templates are immutable).
  const pickableElements = useFormattingTemplateStore((st) => st.getPickableElements)();
  useFormattingTemplateStore((st) => st.elementHidden);   // re-render on change
  useFormattingTemplateStore((st) => st.elementOrder);
  const isEnforceMode = activeTemplate.mode === 'enforce';
  const editorRule = editor ? getCurrentElementRule(editor, activeTemplate) : null;
  const locked = getLockedFormatting(editorRule, isEnforceMode);

  // ── About / What's New ──
  const [aboutOpen, setAboutOpen] = useState(false);

  // ── Diagnostics (Help menu) — the dialog collects its own report on mount.
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);

  // ── Check in (git commit) ──
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [editElementsOpen, setEditElementsOpen] = useState(false);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [checkinMessage, setCheckinMessage] = useState('');
  const [checkinSaving, setCheckinSaving] = useState(false);
  const checkinInputRef = useRef<HTMLInputElement>(null);

  const handleCheckinOpen = useCallback(() => {
    if (!currentProject) {
      showToast('This script hasn\'t been saved yet. Save it first.', 'error');
      return;
    }
    setCheckinMessage('');
    setCheckinOpen(true);
    setTimeout(() => checkinInputRef.current?.focus(), 100);
  }, [currentProject]);

  const handleCheckinSubmit = useCallback(async () => {
    if (!currentProject || !checkinMessage.trim()) return;
    setCheckinSaving(true);
    // Save first so the latest content is on disk
    if (editor && currentScriptId) {
      try {
        const content = buildSaveContent();
        await api.saveScript(currentProject.id, currentScriptId, { content });
      } catch (err) {
        console.error('Auto-save before checkin failed:', err);
        reportSaveError(err, 'manual-save');
        // Don't proceed with the check-in if we couldn't persist the latest
        // content — committing stale data would be worse than the failure.
        setCheckinSaving(false);
        return;
      }
    }
    try {
      const result = await api.checkin(currentProject.id, checkinMessage.trim());
      if (result.hash) {
        showToast(`Version saved: ${result.short_hash}`, 'success');
        const snapContent = buildSaveContent();
        if (snapContent) {
          void mirrorSnapshot({
            projectId: currentProject.id,
            projectName: currentProject.name,
            title: documentTitle || 'Untitled',
            content: snapContent,
            message: checkinMessage.trim(),
          });
        }
      } else {
        showToast(result.message || 'No changes to commit', 'success');
      }
    } catch (err) {
      showToast(`Check in failed: ${err instanceof Error ? err.message : 'unknown error'}`, 'error');
    } finally {
      setCheckinSaving(false);
      setCheckinOpen(false);
    }
  }, [editor, currentProject, currentScriptId, checkinMessage, buildSaveContent]);

  // ── Track Changes ──
  const clearTrackChanges = useCallback(() => {
    if (!trackChangesEnabled) return;
    setTrackChangesEnabled(false);
    setTrackChangesLabel('');
    if (editor) {
      const { tr } = editor.state;
      tr.setMeta(trackChangesPluginKey, { enabled: false, baseline: null });
      editor.view.dispatch(tr);
    }
  }, [editor, trackChangesEnabled, setTrackChangesEnabled, setTrackChangesLabel]);

  const handleTrackChangesToggle = useCallback(async () => {
    if (trackChangesEnabled) {
      clearTrackChanges();
      return;
    }

    if (!currentProject || !currentScriptId) {
      showToast('Save your script to a project first', 'error');
      return;
    }

    try {
      const versions = await api.getVersions(currentProject.id);
      if (versions.length === 0) {
        showToast('No auto saves yet — use Tools > Script History > Take Auto Save first', 'info');
        return;
      }

      const latest = versions[0];
      let scriptResp;
      try {
        scriptResp = await api.getScriptAtVersion(
          currentProject.id,
          latest.hash,
          currentScriptId,
        );
      } catch (innerErr) {
        // Script didn't exist at the last check-in (created after the last commit)
        const msg = innerErr instanceof Error ? innerErr.message : '';
        if (msg.includes('404')) {
          showToast('This script has no auto save yet — use Tools > Script History > Take Auto Save first', 'info');
        } else {
          showToast('Could not load the checked-in version. Try checking in first.', 'error');
        }
        return;
      }

      setTrackChangesEnabled(true);
      setTrackChangesLabel(latest.short_hash);

      if (editor) {
        const { tr } = editor.state;
        tr.setMeta(trackChangesPluginKey, {
          enabled: true,
          baseline: scriptResp.content,
        });
        editor.view.dispatch(tr);
      }
    } catch (err) {
      showToast('Could not load version history. Make sure the backend is running.', 'error');
    }
  }, [
    editor,
    currentProject,
    currentScriptId,
    trackChangesEnabled,
    setTrackChangesEnabled,
    setTrackChangesLabel,
  ]);

  // Pinned toolbar commands (Customize > Toolbar Layout) dispatch
  // 'scriptcraft:command'; the dialogs live here, so route them here.
  useEffect(() => {
    const onCmd = (e: Event) => {
      const id = (e as CustomEvent).detail as string;
      switch (id) {
        case 'customize': openCustomize('elements'); break;
        case 'customizeContextMenu': openCustomize('context'); break;
        // v4.30 #3: hotkeys live in Settings now
        case 'customizeShortcuts': useEditorStore.getState().openPreferences('keys'); break;
        case 'setDraft': setDraftDialogOpen(true); break;
        case 'rename': setRenameOpen(true); break;
        case 'takeSnapshot': handleCheckinOpen(); break;
        case 'snapshots': setVersionHistoryOpen(true); break;
        case 'compareSnapshot': setCompareVersionOpen(true); break;
        case 'trackChanges': handleTrackChangesToggle(); break;
        case 'spellCheck': setSpellModalOpen(true); break;
        case 'writingSuggestions': setGrammarModalOpen(true); break;
        // fitPage/fitWidth are OWNED by ScreenplayEditor's listener on this
        // same event — falling through to the map would re-dispatch the
        // event and recurse until the stack blows. Explicit no-ops here.
        case 'fitPage': case 'fitWidth': break;
        // v2.97, Derek: EVERY menu action is pinnable to the ribbon — any
        // command id the actions map knows resolves here, so the ribbon,
        // the menus and the keyboard all run the same closure. (Safe for
        // system-owned ids like selectAll: the KEYBOARD handler still
        // bails on owner==='system' before reaching the map.)
        default: shortcutActionsRef.current[id]?.(); break;
      }
    };
    window.addEventListener('scriptcraft:command', onCmd);
    return () => window.removeEventListener('scriptcraft:command', onCmd);
  }, [handleCheckinOpen, handleTrackChangesToggle]);

  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Capture the portal dropdown element via a callback ref on the portal
  useEffect(() => {
    if (activeMenu) {
      // The portal dropdown is the last .menu-dropdown in the body
      dropdownRef.current = document.body.querySelector(':scope > .menu-dropdown');
    } else {
      dropdownRef.current = null;
    }
  }, [activeMenu]);

  useEffect(() => {
    if (!activeMenu) return;
    // Only listen for outside clicks when a menu is open.
    // Delay registration so the opening click/touch doesn't immediately close it.
    let active = true;
    const timerId = setTimeout(() => {
      if (!active) return;
      const handleClose = (e: MouseEvent | TouchEvent) => {
        const target = e.target as Node;
        const inMenu = menuRef.current?.contains(target);
        const inDropdown = dropdownRef.current?.contains(target);
        if (!inMenu && !inDropdown) {
          setActiveMenu(null);
          setOpenSubmenu(null);
        }
      };
      document.addEventListener('mousedown', handleClose);
      document.addEventListener('touchstart', handleClose);
      cleanup = () => {
        document.removeEventListener('mousedown', handleClose);
        document.removeEventListener('touchstart', handleClose);
      };
    }, 10);
    let cleanup: (() => void) | null = null;
    return () => {
      active = false;
      clearTimeout(timerId);
      cleanup?.();
    };
  }, [activeMenu]);

  const setElement = (type: string) => {
    if (!editor) return;
    editor.chain().focus().setNode(type).run();
  };

  const handleImport = useCallback(async () => {
    if (!editor) return;
    try {
      const result = await openTextFile([
        { name: 'Script', extensions: ['fountain', 'fdx', 'odraft', 'txt'] },
      ]);
      if (!result) return;

      const { name, content: text } = result;
      const ext = name.split('.').pop()?.toLowerCase();

      // Clear previous document state before importing
      clearTrackChanges();
      const store = useEditorStore.getState();
      store.setBeats([]);
      store.setBeatColumns([]);
      store.resetOutlineTabs();   // v2.30: start over on a single tab
      store.setBeatArrangeMode('auto');
      store.setNotes([]);
      store.setTags([]);
      store.setTagCategories([...DEFAULT_TAG_CATEGORIES]);
      store.setCharacterProfiles([]);
      store.setCharacterRelationships([]);
      store.setReferredTags({});
      store.setScanResults(null);
      store.setScenes([]);

      let doc;
      if (ext === 'fdx') {
        const parsed = parseFDXFull(text);
        doc = parsed.doc;
        if (parsed.pageLayout) {
          store.setPageLayout({
            ...store.pageLayout,
            ...parsed.pageLayout,
          });
        }
        // Import beats from Outline elements
        if (parsed.beats.length > 0) {
          store.setBeats(parsed.beats);
          if (parsed.beatColumns.length > 0) {
            store.setBeatColumns(parsed.beatColumns);
          }
        }
        // Import character profiles from CastList + CharacterHighlighting
        if (parsed.castList.length > 0 || parsed.characterHighlighting.length > 0) {
          const highlightMap = new Map(parsed.characterHighlighting.map((h) => [h.name.toUpperCase(), h]));
          for (const member of parsed.castList) {
            const hl = highlightMap.get(member.name.toUpperCase());
            store.upsertCharacterProfile(member.name, {
              description: member.description,
              color: hl?.color || '',
              highlighted: hl?.highlighted || false,
            });
            highlightMap.delete(member.name.toUpperCase());
          }
          // Remaining highlights without cast entries
          for (const [, hl] of highlightMap) {
            store.upsertCharacterProfile(hl.name, { color: hl.color, highlighted: hl.highlighted });
          }
        }
      } else if (ext === 'odraft') {
        try {
          const parsed = parseOdraft(text);
          doc = parsed.content;
          if (parsed.meta.title) {
            store.setDocumentTitle(parsed.meta.title);
          }
        } catch (parseErr) {
          showToast(`Invalid .odraft file: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`, 'error');
          return;
        }
      } else {
        doc = parseFountain(text);
      }
      editor.commands.setContent(doc, true);
      clearEditorHistory(editor);

      // Open as unsaved document — user can save later via Cmd+S
      const scriptTitle = ext === 'odraft' ? (store.documentTitle || name.replace(/\.\w+$/, '') || 'Untitled') : (name.replace(/\.\w+$/, '') || 'Untitled');
      store.setDocumentTitle(scriptTitle);
      setCurrentProject(null);
      setCurrentScriptId(null);
      setScripts([]);
      // Track that this is an imported document so Save As can warn the user
      // that the save goes to ScriptCraft's library, not back to the source file.
      const fmtLabel = ext === 'fdx' ? 'Final Draft (.fdx)'
        : ext === 'fountain' ? 'Fountain (.fountain)'
        : ext === 'odraft' ? 'ScriptCraft (.odraft)'
        : ext ? `.${ext}` : 'imported file';
      store.setImportedSource({ name, format: fmtLabel });
    } catch (err) {
      console.error('Import failed:', err);
      showToast(`Import failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  }, [editor, clearTrackChanges, setCurrentProject, setCurrentScriptId, setScripts]);

  // Core Word import: open binary file → parse → apply.  The pre-import
  // warning dialog and the unsaved-changes guard wrap this.
  const handleImportDocxCore = useCallback(async () => {
    if (!editor) return;
    try {
      const result = await openBinaryFile([
        { name: 'Word Document', extensions: ['docx'] },
      ]);
      if (!result) return;

      const { name, content } = result;
      const parsed = await parseDocx(content);

      // Clear previous document state
      clearTrackChanges();
      const store = useEditorStore.getState();
      store.setBeats([]);
      store.setBeatColumns([]);
      store.resetOutlineTabs();   // v2.30: start over on a single tab
      store.setBeatArrangeMode('auto');
      store.setNotes([]);
      store.setTags([]);
      store.setTagCategories([...DEFAULT_TAG_CATEGORIES]);
      store.setCharacterProfiles([]);
      store.setCharacterRelationships([]);
      store.setReferredTags({});
      store.setScanResults(null);
      store.setScenes([]);

      editor.commands.setContent(parsed.doc, true);
      clearEditorHistory(editor);

      const scriptTitle = parsed.scriptTitle || name.replace(/\.\w+$/, '') || 'Untitled';
      store.setDocumentTitle(scriptTitle);
      setCurrentProject(null);
      setCurrentScriptId(null);
      setScripts([]);
      store.setImportedSource({ name, format: 'Microsoft Word (.docx)' });

      if (parsed.warnings.length > 0) {
        const summary = parsed.ambiguousCount > 0
          ? `Imported with ${parsed.ambiguousCount} paragraph(s) auto-classified as Action — review the script.`
          : `Imported with ${parsed.warnings.length} note(s). See console for details.`;
        showToast(summary, 'info');
        for (const w of parsed.warnings) console.warn('[Word Import]', w);
      } else {
        showToast('Word document imported.', 'info');
      }
    } catch (err) {
      console.error('Word import failed:', err);
      showToast(`Word import failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  }, [editor, clearTrackChanges, setCurrentProject, setCurrentScriptId, setScripts]);

  // Wraps handleImportDocxCore with the best-effort warning dialog.
  const handleImportDocx = useCallback(() => {
    setDocxImportWarningOpen(true);
  }, []);

  const handleConfirmDocxImport = useCallback(() => {
    setDocxImportWarningOpen(false);
    // Run through unsaved-changes guard, then through the core importer.
    confirmOrRun(() => { handleImportDocxCore(); });
  }, [confirmOrRun, handleImportDocxCore]);

  // v2.79: PDF import — reconstructs elements from the PDF's text layer by
  // indentation. pdf.js is heavy, so the parser loads lazily on first use.
  const handleImportPdfCore = useCallback(async () => {
    if (!editor) return;
    try {
      const result = await openBinaryFile([
        { name: 'PDF', extensions: ['pdf'] },
      ]);
      if (!result) return;

      const { name, content } = result;
      const { parsePdfScreenplay } = await import('../utils/pdfImporter');
      const parsed = await parsePdfScreenplay(content);

      // Clear previous document state
      clearTrackChanges();
      const store = useEditorStore.getState();
      store.setBeats([]);
      store.setBeatColumns([]);
      store.resetOutlineTabs();
      store.setBeatArrangeMode('auto');
      store.setNotes([]);
      store.setTags([]);
      store.setTagCategories([...DEFAULT_TAG_CATEGORIES]);
      store.setCharacterProfiles([]);
      store.setCharacterRelationships([]);
      store.setReferredTags({});
      store.setScanResults(null);
      store.setScenes([]);

      editor.commands.setContent(parsed.doc, true);
      clearEditorHistory(editor);

      const scriptTitle = name.replace(/\.\w+$/, '') || 'Untitled';
      store.setDocumentTitle(scriptTitle);
      setCurrentProject(null);
      setCurrentScriptId(null);
      setScripts([]);
      store.setImportedSource({ name, format: 'PDF (.pdf)' });

      if (parsed.warnings.length > 0) {
        for (const w of parsed.warnings) showToast(w, 'info');
      } else {
        showToast(`PDF imported (${parsed.pages} page${parsed.pages === 1 ? '' : 's'}). A PDF stores print layout, not elements — worth a review pass.`, 'info');
      }
    } catch (err) {
      console.error('PDF import failed:', err);
      showToast(`PDF import failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  }, [editor, clearTrackChanges, setCurrentProject, setCurrentScriptId, setScripts]);

  const handleImportPdf = useCallback(() => {
    confirmOrRun(() => { void handleImportPdfCore(); });
  }, [confirmOrRun, handleImportPdfCore]);

  /** Resets all per-script session state for a fresh new-screenplay,
   *  but does NOT seed editor content — caller picks the format and content. */
  /* v1.50: what the New Script dialog collected, applied when the reset runs.
     A ref (not state) because the format-picker flow between the dialog and
     the reset is asynchronous; every entry to New Script overwrites it. */
  const pendingNewScriptMeta = useRef<NewScriptMeta | null>(null);
  const [newScriptOpen, setNewScriptOpen] = useState(false);
  // v4.80: the four-way launcher, and the Guided wizard it can open.
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [guidedOpen, setGuidedOpen] = useState(false);

  const resetForNewScreenplay = useCallback(() => {
    if (!editor) return;
    clearTrackChanges();
    clearEditorHistory(editor);
    setCurrentProject(null);
    setCurrentScriptId(null);
    setScripts([]);
    const store = useEditorStore.getState();
    const meta = pendingNewScriptMeta.current;
    pendingNewScriptMeta.current = null;
    store.setDocumentTitle(meta?.name || 'Untitled Script');
    store.setDraftLabel(meta?.draft || useSettingsStore.getState().defaultDraftLabel);
    store.setSpellCheckEnabled(useSettingsStore.getState().spellCheckByDefault);   // v1.60
    store.setSpellCheckChoice(null);   // v4.77: a new script starts unchosen
    store.setVersionLabel(meta?.version || '');
    store.setBeats([]);
    store.setBeatColumns([]);
    store.resetOutlineTabs();   // v2.30: start over on a single tab
    store.setBeatArrangeMode('auto');
    store.setNotes([]);
    store.setTags([]);
    store.setTagCategories([]);
    store.setCharacterProfiles([]);
    store.setCharacterRelationships([]);
    store.setReferredTags({});
    store.setScanResults(null);
    store.setScenes([]);
    store.setPageLayout({ ...DEFAULT_PAGE_LAYOUT });
    if (window.location.pathname !== '/') {
      window.history.replaceState(null, '', '/');
    }
  }, [editor, clearTrackChanges, setCurrentProject, setCurrentScriptId, setScripts]);

  /** Picker mode: 'reset' clears project context (top-level New Script);
   *  'apply-only' just applies the template, leaving the current project intact
   *  (used by ProjectView so the new script stays in the current project). */
  const [formatPickerMode, setFormatPickerMode] = useState<'reset' | 'apply-only'>('reset');

  /** Apply the chosen format (sets active template + seeds starter content). */
  const finishNewScreenplayWithFormat = useCallback((templateId: string, mode: 'reset' | 'apply-only' = 'reset') => {
    if (mode === 'reset') resetForNewScreenplay();
    applyScriptFormat(editor, templateId);
  }, [editor, resetForNewScreenplay]);

  /** Run the format-selection flow. Mode 'reset' is the global New Script
   *  action; 'apply-only' is invoked from in-project script creation, where the
   *  caller has already wired up project context. */
  const promptForNewScreenplayFormat = useCallback((mode: 'reset' | 'apply-only') => {
    if (!editor) return;
    setFormatPickerMode(mode);
    const settings = useSettingsStore.getState();
    const enabled = settings.enabledScriptFormats;

    // First run — never asked the user. Show the multi-select prefs dialog.
    if (!settings.formatPreferencesInitialized) {
      setFormatPrefsOpen({ firstRun: true, afterSave: 'apply-new-screenplay' });
      return;
    }

    // No formats enabled (edge case — user deselected everything).
    if (enabled.length === 0) {
      setFormatPrefsOpen({ firstRun: false, afterSave: 'apply-new-screenplay' });
      return;
    }

    // Exactly one enabled — apply it directly, no prompt.
    if (enabled.length === 1) {
      finishNewScreenplayWithFormat(enabled[0], mode);
      return;
    }

    // 2+ enabled — show the quick single-select picker.
    setFormatPickerOpen(true);
  }, [editor, finishNewScreenplayWithFormat]);

  // v1.57: launch found nothing to open — show the New Script prompt.
  // No unsaved-work guard: this only fires on a fresh, empty session.
  const newScriptPromptRequest = useEditorStore((s) => s.newScriptPromptRequest);
  useEffect(() => {
    if (!newScriptPromptRequest || !editor) return;
    useEditorStore.getState().setNewScriptPromptRequest(false);
    setLauncherOpen(true);
  }, [newScriptPromptRequest, editor]);

  const handleNewScreenplay = useCallback(() => {
    // v1.50: New Script… asks for name/draft/version first; Create hands off
    // to the existing format flow. confirmOrRun is the existing unsaved-work
    // guard — it prompts to save before any of this if the doc is dirty.
    // v4.80, Derek: the LAUNCHER comes first — manual / guided / open /
    // import — and hands off to the right one.
    confirmOrRun(() => setLauncherOpen(true));
  }, [confirmOrRun]);

  // ProjectView sets pendingFormatPromptInProject=true before navigating into
  // the editor for a fresh in-project script. Consume it once on mount (or
  // when it becomes true) and prompt for a script format without touching the
  // project context ProjectView already wired up.
  const pendingFormatPromptInProject = useEditorStore((s) => s.pendingFormatPromptInProject);
  useEffect(() => {
    if (!pendingFormatPromptInProject || !editor) return;
    useEditorStore.getState().setPendingFormatPromptInProject(false);
    promptForNewScreenplayFormat('apply-only');
  }, [pendingFormatPromptInProject, editor, promptForNewScreenplayFormat]);

  // ── Global keyboard shortcuts (registry-driven, v0.77) ──
  // What each command DOES. The registry (shortcuts.ts) owns the key bindings;
  // this owns the behavior. Held in a ref so the capture-phase listener below
  // can be registered once and still call the current closures.
  /* v3.08/v3.25: Last Edit Location — shared by the Edit menu, the
   * keyboard map and the ribbon's pinned command. */
  const bookmarkKey = bookmarkScriptKey(currentScriptId);
  const jumpToLastEdit = () => {
    if (!editor) return;
    const pos = useBookmarkStore.getState().lastEdit[bookmarkKey];
    if (pos == null) { showToast('No edits recorded yet.', 'info'); return; }
    const max = editor.state.doc.content.size;
    const at = Math.max(1, Math.min(pos, max - 1));
    editor.chain().focus().setTextSelection(at).run();
    // Center the last-edit line in the viewport — Tiptap's own scrollIntoView
    // only nudges it barely into view. domAtPos → nearest element → center.
    requestAnimationFrame(() => {
      const { node } = editor.view.domAtPos(at);
      const el = (node instanceof HTMLElement ? node : node.parentElement) as HTMLElement | null;
      el?.scrollIntoView({ block: 'center', inline: 'nearest' });
    });
  };
  const shortcutActions: Record<string, () => void> = {
    lastEditLocation: jumpToLastEdit,
    newScreenplay: () => { if (!isCollabGuest) handleNewScreenplay(); },
    openFile: () => { if (!isCollabGuest) confirmOrRun(() => setOpenFileOpen(true)); },
    importLocal: () => { if (!isCollabGuest) confirmOrRun(handleImport); },
    save: () => { if (!isCollabGuest) handleSave(); },
    saveAs: () => { if (!isCollabGuest) handleSaveAs(); },
    print: () => window.print(),
    preview: () => useEditorStore.getState().setPreviewMode(true),
    exportPDF: () => { void handleExportPDF(); },
    exportFDX: () => { void handleExportFDX(); },
    exportFountain: () => { void handleExportFountain(); },
    exportDocx: () => { void handleExportDocx(); },
    rename: () => setRenameOpen(true),
    settings: () => setPrefsOpen(true),

    find: () => setSearchOpen(true),
    goToPage: () => setGoToPageOpen(true),

    zoomIn: () => setZoomLevel(Math.min(300, useEditorStore.getState().zoomLevel + 10)),
    zoomOut: () => setZoomLevel(Math.max(50, useEditorStore.getState().zoomLevel - 10)),
    actualSize: () => setZoomLevel(100),
    fitPage: () => window.dispatchEvent(new CustomEvent('scriptcraft:command', { detail: 'fitPage' })),
    fitWidth: () => window.dispatchEvent(new CustomEvent('scriptcraft:command', { detail: 'fitWidth' })),
    // v4.22, Derek: the ribbon Customize button lands on the Editor tab (top of
    // the list) rather than Menu Bar / Toolbar.
    customize: () => openCustomize('elements'),

    bold: () => editor?.chain().focus(undefined, { scrollIntoView: false }).toggleBold().run(),
    italic: () => editor?.chain().focus(undefined, { scrollIntoView: false }).toggleItalic().run(),
    underline: () => editor?.chain().focus(undefined, { scrollIntoView: false }).toggleUnderline().run(),
    dualDialogue: () => (editor as unknown as { commands?: { toggleDualDialogue?: () => void } })?.commands?.toggleDualDialogue?.(),

    spellCheck: () => setSpellModalOpen(true),
    writingSuggestions: () => setGrammarModalOpen(true),
    takeSnapshot: () => handleCheckinOpen(),
    scriptHistory: () => setVersionHistoryOpen(true),
    trackChanges: () => { void handleTrackChangesToggle(); },
    // v2.97: ribbon-pinnable Edit actions. Their SHORTCUTS stay with the OS
    // (the keyboard handler bails on system-owned ids); these closures run
    // only via menu clicks and ribbon buttons.
    cut: () => document.execCommand('cut'),
    copy: () => document.execCommand('copy'),
    paste: () => document.execCommand('paste'),
    selectAll: () => editor?.chain().focus().selectAll().run(),
    // v2.98, Derek: the REST of the menus — every remaining action becomes
    // ribbon-pinnable through the same bus. Pickers and dialogs with their
    // own flows (Workspaces, Theme, Element) stay menu-only.
    importDocx: () => { if (!isCollabGuest) handleImportDocx(); },
    importPdf: () => { if (!isCollabGuest) handleImportPdf(); },
    exportOdraft: () => { void handleExportOdraft(); },
    insertImage: () => useEditorStore.getState().imageInsertHandler?.(),
    insertMarker: () => insertOutlineLine('⚑ '),
    showRulers: () => { const s = useEditorStore.getState(); s.setRulersVisible(!s.rulersVisible); },
    formatPrefs: () => setFormatPrefsOpen({ firstRun: false, afterSave: null }),
    grammarSettings: () => setGrammarRulesPanelOpen(true),
    about: () => setAboutOpen(true),
    keyboardShortcuts: () => setShortcutsOpen(true),
    knowledgeBase: () => setKnowledgeBaseOpen(true),
    changelog: () => setChangelogOpen(true),
    feedback: () => setHelpForm(HELP_FORMS.feedback),
  };
  const shortcutActionsRef = useRef(shortcutActions);
  // Menu items display the EFFECTIVE binding, so a rebound (or cleared)
  // shortcut is reflected in the menus instead of showing a stale default.
  const keyBindings = useShortcutStore((st) => st.bindings);

  // View > Theme is driven by the theme store: user order, hidden themes
  // removed, custom themes included alongside the built-ins.
  const customThemes = useThemeStore((st) => st.customThemes);
  const hiddenThemes = useThemeStore((st) => st.hiddenThemes);
  const allThemeIds = useThemeStore((st) => st.allThemeIds);
  const visibleThemes = allThemeIds()
    .filter((id) => !hiddenThemes.includes(id))
    .map((id) => ({
      id,
      label: BUILTIN_THEMES.find((b) => b.id === id)?.label
        ?? customThemes.find((c) => c.id === id)?.label
        ?? id,
    }));
  const sc = (id: string) => formatCombo(keyBindings[id] ?? null) || undefined;

  // ── v1.83: Format > Highlighting (Final Draft-style) ──
  const customHighlightRef = React.useRef<HTMLInputElement>(null);
  /** Picking a color sets the shared highlighter pen; with text selected it
   *  also applies the highlight right away. */
  const pickHighlightColor = (hex: string) => {
    setHighlightColor(hex);
    if (editor && !editor.state.selection.empty) {
      editor.chain().focus(undefined, { scrollIntoView: false }).setHighlight({ color: hex }).run();
    }
  };
  /** Contiguous highlight-mark ranges, in document order. */
  const highlightRanges = (): Array<{ from: number; to: number }> => {
    const ranges: Array<{ from: number; to: number }> = [];
    editor?.state.doc.descendants((node, pos) => {
      if (node.isText && node.marks.some((m) => m.type.name === 'highlight')) {
        const last = ranges[ranges.length - 1];
        if (last && last.to === pos) last.to = pos + node.nodeSize;
        else ranges.push({ from: pos, to: pos + node.nodeSize });
      }
    });
    return ranges;
  };
  const jumpHighlight = (dir: 1 | -1) => {
    if (!editor) return;
    const ranges = highlightRanges();
    if (ranges.length === 0) { showToast('No highlights in the script.', 'info'); return; }
    const head = editor.state.selection.head;
    const target = dir === 1
      ? (ranges.find((r) => r.from > head) ?? ranges[0])                       // wrap to first
      : ([...ranges].reverse().find((r) => r.to < head) ?? ranges[ranges.length - 1]); // wrap to last
    editor.chain().focus().setTextSelection({ from: target.from, to: target.to }).scrollIntoView().run();
  };
  shortcutActionsRef.current = shortcutActions;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const combo = eventToCombo(e);
      if (!combo) return;

      // Which command owns this combo right now (default or user-rebound)?
      const bindings = useShortcutStore.getState().bindings;
      const id = Object.keys(bindings).find((k) => bindings[k] === combo);
      if (!id) return;

      const cmd = COMMAND_BY_ID[id];
      // Cut/Copy/Paste/Undo/Redo/Select All belong to the OS and the browser's
      // native edit pipeline — let them through untouched.
      if (!cmd || cmd.owner === 'system') return;

      const run = shortcutActionsRef.current[id];
      if (!run) return;

      // Editor-owned commands (Bold, etc.) also live in TipTap's keymap. We run
      // in the CAPTURE phase and stop propagation so exactly one handler fires:
      // without this, a rebound Bold would still respond to the old Mod+B (via
      // TipTap) *and* the new combo, and on the default key both would run.
      e.preventDefault();
      e.stopPropagation();
      run();
    };
    window.addEventListener('keydown', handler, true);   // capture: beat TipTap
    return () => window.removeEventListener('keydown', handler, true);
  }, []);

  const handleExportFDX = useCallback(async () => {
    if (!editor) return;
    try {
      const s = useEditorStore.getState();
      await downloadFDX(editor.getJSON(), documentTitle, s.characterProfiles, s.tagCategories, s.tags, s.beats, s.beatColumns, s.pageLayout);
    } catch (err) {
      console.error('FDX export failed:', err);
      showToast(`Export failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  }, [editor, documentTitle]);

  const handleExportFountain = useCallback(async () => {
    if (!editor) return;
    try {
      await downloadFountain(editor.getJSON(), documentTitle);
    } catch (err) {
      console.error('Fountain export failed:', err);
      showToast(`Export failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  }, [editor, documentTitle]);

  const handleExportPDF = useCallback(async () => {
    if (!editor) return;
    try {
      const store = useEditorStore.getState();
      await exportPDF(editor.getJSON(), documentTitle, pageLayout, {
        sceneNumbersVisible: store.sceneNumbersVisible,
        documentTitle: store.documentTitle,
        revisionColor: store.revisionMode ? store.revisionColor : '',
      });
    } catch (err) {
      console.error('PDF export failed:', err);
      showToast(`Export failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  }, [editor, documentTitle, pageLayout]);

  const handleExportDocx = useCallback(async () => {
    if (!editor) return;
    try {
      const store = useEditorStore.getState();
      await downloadDocx(editor.getJSON(), documentTitle, pageLayout, {
        documentTitle: store.documentTitle,
        revisionColor: store.revisionMode ? store.revisionColor : '',
      });
    } catch (err) {
      console.error('Word export failed:', err);
      showToast(`Export failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  }, [editor, documentTitle, pageLayout]);

  const handleExportOdraft = useCallback(async () => {
    if (!editor) return;
    try {
      const store = useEditorStore.getState();
      const meta = {
        id: '', title: documentTitle, author: '', format: 'json',
        created_at: '', updated_at: '', page_count: store.pageCount,
        size_bytes: 0, color: '', pinned: false, sort_order: 0, preview: '',
      };
      // Ship the custom themes inside the project so another ScriptCraft can
      // import them (Customize > Themes > Import Themes from a Project).
      await downloadOdraft(meta, editor.getJSON(), useThemeStore.getState().customThemes);
    } catch (err) {
      console.error('ScriptCraft export failed:', err);
      showToast(`Export failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  }, [editor, documentTitle]);

  // v4.35 batch-v9 #8: the import flow moved to utils/workspaceImport so the
  // Workspaces WINDOW offers it too \u2014 one implementation, two entry points.
  const handleImportWorkspaces = importWorkspacesFromFile;

  const handleMenuClick = (label: string) => {
    setActiveMenu((prev) => (prev === label ? null : label));
    setOpenSubmenu(null);
  };

  const handleItemClick = (item: MenuItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.disabled && item.action) {
      item.action();
    }
    setActiveMenu(null);
    setOpenSubmenu(null);
  };

  // Mouse: hover switches submenu (desktop) — no pointerleave to avoid layout shift
  const handleSubmenuPointerEnter = (label: string, e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') setOpenSubmenu(label);
  };
  /** Submenu keys are scoped to their parent menu so a stale open submenu can
   *  never render under a different top-level menu (the "Analytics in the
   *  File menu" glitch). */
  const submenuKey = (menuLabel: string, itemLabel: string, index?: number) =>
    `${menuLabel}:${index ?? ''}:${itemLabel}`;
  const handleItemPointerEnter = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') setOpenSubmenu(null);
  };
  // Touch: tap toggles submenu (mobile)
  const handleSubmenuTouchEnd = (label: string, e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpenSubmenu((prev) => (prev === label ? null : label));
  };

  /** Insert an outline-style General line at the caret (Section '# ',
   *  Marker '⚑ ', To-Do '[ ] ') — the Navigator recognizes these. */
  const insertOutlineLine = (prefix: string) => {
    if (!editor) return;
    editor.chain().focus().insertContent({ type: 'general', content: [{ type: 'text', text: prefix }] }).run();
  };

  const menus: MenuSection[] = [
    {
      label: 'File',
      items: [
        {
          icon: <span className="menu-txt-icon" aria-hidden="true">+</span>,
          label: 'New Script…',
          shortcut: sc('newScreenplay'),
          disabled: isCollabGuest,
          action: handleNewScreenplay,
        },
        { separator: true, label: '' },
        /* v4.79, Derek: Open has NO submenu — it opens the Open window
           directly, and that window carries "Browse This Computer…" for a
           file on disk (the old Local File child). */
        {
          icon: <FaFolderOpen />, label: 'Open…', shortcut: sc('openFile'),
          action: () => confirmOrRun(() => setOpenFileOpen(true)), disabled: isCollabGuest,
        },
        { separator: true, label: '' },
        { icon: <FaSave />, label: 'Save', shortcut: sc('save'), action: handleSave, disabled: isCollabGuest },
        {
          /*
           * v1.17: Save As opens the SAVE AS DIALOG.
           *
           * It was bound to handleExportOdraft — an EXPORT, which writes a .odraft file
           * and is already sitting in File > Export > ScriptCraft (.odraft). So the
           * Name/Draft/Version window could only ever be reached by saving a file that
           * had never been saved; picking "Save As" on a saved script exported it
           * instead. Same word, two different jobs, and the wrong one wired up.
           */
          icon: <FaSave />, label: 'Save As…', shortcut: sc('saveAs'),
          action: () => setSaveAsOpen(true), disabled: isCollabGuest,
        },
        { icon: <FaEdit />, label: 'Rename…', action: () => setRenameOpen(true) },
        { separator: true, label: '' },
        /* v3.24 reorg #4: Preview left File — it duplicates
           View > Editor > Preview; view modes belong to View. */
        /* v4.79, Derek: Import sits NEXT TO Export (it lived up by New/Open),
           and both submenus gain Presets… — one combined window. */
        {
          icon: <FaFileImport />, label: 'Import',
          children: [
            { icon: <FaFileCode />, label: 'Final Draft / Fountain / ScriptCraft…', action: () => confirmOrRun(handleImport), disabled: isCollabGuest },
            { icon: <FaFileWord />, label: 'Microsoft Word (.docx)…', action: handleImportDocx, disabled: isCollabGuest },
            { icon: <FaFilePdf />, label: 'PDF (.pdf)…', action: handleImportPdf, disabled: isCollabGuest },
            { icon: <FaBoxOpen />, label: 'Presets…', action: () => setPresetsOpen(true) },
          ],
        },
        {
          icon: <FaFileExport />, label: 'Export',
          children: [
            { icon: <FaFileCode />, label: 'Final Draft (.fdx)…', action: handleExportFDX, disabled: isCollabGuest },
            { icon: <FaFileAlt />, label: 'Fountain (.fountain)…', action: handleExportFountain, disabled: isCollabGuest },
            { icon: <FaFilePdf />, label: 'PDF…', action: handleExportPDF },
            { icon: <FaFileWord />, label: 'Microsoft Word (.docx)…', action: handleExportDocx },
            { icon: <FaFile />, label: 'ScriptCraft (.odraft)…', action: handleExportOdraft, disabled: isCollabGuest },
            { icon: <FaBoxOpen />, label: 'Presets…', action: () => setPresetsOpen(true) },
          ],
        },
        { icon: <FaPrint />, label: 'Print…', shortcut: sc('print'), action: () => setTimeout(() => window.print(), 60) },
        // v1.34: Collaboration is UNRELEASED — hidden unless the Developer
        // toggle (Help > Developer > Show Unreleased Tools) is on.
        ...(showUnreleasedTools ? [
          { separator: true, label: '' },
          {
            icon: <FaUserFriends />, label: 'Collaboration',
            children: [
              { icon: <FaUserFriends />, label: isCollabActive ? '\u2713 Collaborate…' : 'Collaborate…', action: onCollaborate, disabled: isCollabGuest },
              { icon: <FaSignInAlt />, label: 'Join Collaboration…', action: onJoinCollab, disabled: isCollabGuest },
            ],
          },
        ] : []),
        // Settings lives in the ScriptCraft app menu under native macOS menus
        // (the platform convention — see nativeMenuSync). In-window menus have
        // no app menu, so it stays in File there.
        ...(nativeMenus ? [] : [
          { separator: true, label: '' },
          { separator: true, label: '' },
          { icon: <FaWrench />, label: 'Settings…', action: () => setPrefsOpen(true) },
        ]),
      ],
    },
    {
      label: 'Edit',
      items: [
        // v2.36: smart routing — a just-edited beat undoes before the script.
        { icon: <FaUndo />, label: 'Undo', shortcut: sc('undo'), action: () => smartUndo(editor) },
        { icon: <FaRedo />, label: 'Redo', shortcut: sc('redo'), action: () => smartRedo(editor) },
        { separator: true, label: '' },
        { icon: <FaCut />, label: 'Cut', shortcut: sc('cut'), action: () => document.execCommand('cut') },
        { icon: <FaCopy />, label: 'Copy', shortcut: sc('copy'), action: () => document.execCommand('copy') },
        { icon: <FaPaste />, label: 'Paste', shortcut: sc('paste'), action: () => document.execCommand('paste') },
        { icon: <FaMousePointer />, label: 'Select All', shortcut: sc('selectAll'), action: () => editor?.chain().focus().selectAll().run() },
        { separator: true, label: '' },
        { icon: <LuSearch />, label: 'Find & Replace…', shortcut: sc('find'), action: () => setSearchOpen(true) },
        /* v3.25: bookmarks removed (markers cover them); Last Edit Location
           survives here — it's navigation, like Go to Page. */
        { icon: <FaHashtag />, label: 'Go to Page…', shortcut: sc('goToPage'), action: () => setGoToPageOpen(true) },
        { icon: <FaPencilAlt />, label: 'Go to Last Edited', action: () => shortcutActionsRef.current.lastEditLocation?.() },
      ],
    },
    {
      label: 'View',
      items: [
        /* v3.25, Derek: Customize leads the View menu. */
        // v2.58, Derek: the Customize window straight from View.
        {
          icon: <FaWrench />,
          label: 'Customize…',
          action: () => openCustomize('elements'),
        },
        {
          icon: <FaPalette />,
          label: 'Design…',
          action: () => useEditorStore.getState().setDesignPanelOpen(true),
        },
        { separator: true, label: '' },
        {
          icon: <FaColumns />, label: 'Workspaces',
          children: [
            ...workspaceOrder.filter((n) => workspaces[n]).map((name) => ({
              icon: <FaColumns />,
              label: activeWorkspace === name ? `\u2713 ${name}` : name,
              action: () => applyWorkspace(name),
            })),
            ...(Object.keys(workspaces).length > 0 ? [{ separator: true, label: '' }] : []),
            { icon: <FaColumns />, label: 'Save as New Workspace…', action: () => setSaveWorkspaceOpen(true) },
            { icon: <FaColumns />, label: 'Save Changes to this Workspace', action: () => {
              if (activeWorkspace) saveWorkspace(activeWorkspace);
            }, disabled: !activeWorkspace },
            { icon: <FaColumns />, label: 'Reset to Saved Layout', action: () => {
              if (activeWorkspace) applyWorkspace(activeWorkspace);
            }, disabled: !activeWorkspace },
            { icon: <FaColumns />, label: 'Edit Workspaces…', action: () => setEditWorkspacesOpen(true) },
            { separator: true, label: '' },
            { icon: <FaFileImport />, label: 'Import Workspaces from a Project…', action: handleImportWorkspaces },
          ],
        },
        { separator: true, label: '' },

        {
          icon: <FaColumns />, label: 'Editor',
          children: [
            { icon: <FaRegClone />, label: !previewMode && viewStyle === 'page' ? '\u2713 Page' : 'Page', action: () => { useEditorStore.getState().setPreviewMode(false); setViewStyle('page'); } },
            { icon: <FaStream />, label: !previewMode && viewStyle === 'continuous' ? '\u2713 Continuous' : 'Continuous', action: () => { useEditorStore.getState().setPreviewMode(false); setViewStyle('continuous'); } },
            { icon: <FaRegEye />, label: previewMode ? '\u2713 Preview' : 'Preview', action: () => useEditorStore.getState().setPreviewMode(true) },
          ],
        },
        // v3.16, Derek: the surface toggles group under one Toolbars submenu
        // (they were flat View items since v1.75/v2.29), as check items.
        {
          icon: <FaColumns />, label: 'Toolbars',
          children: [
            { icon: <FaColumns />, label: 'Left Panel', checked: navigatorOpen, action: () => toggleNavigator() },
            { icon: <FaColumns />, label: 'Right Panel', checked: shelfOpen, action: () => toggleShelf() },
            { icon: <FaStream />, label: 'Outline Bar', checked: outlineBarOpen, action: () => setOutlineBarOpen(!outlineBarOpen) },
          ],
        },
        // v2.95, Derek: Word/Docs-style rulers on the editor's top and left.
        {
          icon: <FaRulerHorizontal />,
          label: 'Show Rulers',
          checked: rulersVisible,
          action: () => useEditorStore.getState().setRulersVisible(!rulersVisible),
        },
        {
          // v4.22, Derek: moved here from Project; a label toggle.
          icon: <FaListUl />,
          label: sceneNumbersVisible ? 'Hide Scene Numbers' : 'Show Scene Numbers',
          action: () => setSceneNumbersVisible(!sceneNumbersVisible),
        },
        { separator: true, label: '' },
        /* v3.24 reorg #5: Lock All / Reset All Sizing moved into the
           Customize window (they're customization controls; the per-surface
           resets already live there). */
        { separator: true, label: '' },
        {
          /**
           * v1.4 — everything you can put IN the script that isn't part of the
           * script. v3.25, Derek's rule: every on/off pair is ONE checkable
           * item with a stable label — the check column shows the state.
           * None of these ever reach Preview, print or export.
           */
          icon: <FaRegEye />, label: 'Working Notes',
          children: [
            // v4.22, Derek: label toggles (Show/Hide …) instead of check items.
            {
              icon: <FaRegStickyNote />,
              label: notesVisible ? 'Hide Notes in Script' : 'Show Notes in Script',
              action: () => setNotesVisible(!notesVisible),
            },
            {
              icon: <FaCheckSquare />,
              label: scriptTodosVisible ? 'Hide To-Do Lists in Script' : 'Show To-Do Lists in Script',
              action: () => setScriptTodosVisible(!scriptTodosVisible),
            },
            {
              icon: <FaFlag />,
              label: markersVisible ? 'Hide Markers in Script' : 'Show Markers in Script',
              action: () => setMarkersVisible(!markersVisible),
            },
            {
              icon: <FaListOl />,
              label: sectionsVisible ? 'Hide Sections in Script' : 'Show Sections in Script',
              action: () => setSectionsVisible(!sectionsVisible),
            },
            {
              icon: <FaTags />,
              label: tagsVisible ? 'Hide Tags in Script' : 'Show Tags in Script',
              action: () => setTagsVisible(!tagsVisible),
            },
            { separator: true, label: '' },
            {
              icon: <FaRegEye />,
              label: 'Show All in Script',
              action: () => {
                setNotesVisible(true); setScriptTodosVisible(true);
                setMarkersVisible(true); setSectionsVisible(true); setTagsVisible(true);
              },
            },
            {
              icon: <FaRegEyeSlash />,
              label: 'Hide All in Script',
              action: () => {
                setNotesVisible(false); setScriptTodosVisible(false);
                setMarkersVisible(false); setSectionsVisible(false); setTagsVisible(false);
              },
            },
          ],
        },
        { separator: true, label: '' },
        {
          icon: <FaAdjust />, label: 'Theme',
          children: [
            // Built-ins and custom themes, in the user's order, minus hidden ones.
            ...visibleThemes.map(({ id, label }) => ({
              icon: <FaAdjust />,
              label: theme === id ? `\u2713 ${label}` : label,
              action: () => setTheme(id),
            })),
            { separator: true, label: '' },
            { icon: <FaWrench />, label: 'Customize Themes…', action: () => openCustomize('themes') },
          ],
        },
        { separator: true, label: '' },
        {
          icon: <CirclePlusIcon />, label: `Zoom (${zoomLevel}%)`,
          children: [
            { icon: <CirclePlusIcon />, label: 'Zoom In', shortcut: sc('zoomIn'), action: () => setZoomLevel(Math.min(300, zoomLevel + 10)) },
            { icon: <CircleMinusIcon />, label: 'Zoom Out', shortcut: sc('zoomOut'), action: () => setZoomLevel(Math.max(50, zoomLevel - 10)) },
            // v2.57, Derek: as big as the page can get in the current editor
            // width (the sidebars decide how much room there is). The
            // measurement lives in the Toolbar; the command event reaches it.
            { icon: <FaSearchPlus />, label: 'Scale to Max Width', shortcut: sc('fitWidth'), action: () => window.dispatchEvent(new CustomEvent('scriptcraft:command', { detail: 'fitWidth' })) },
            { separator: true, label: '' },
            { icon: <CirclePlusIcon />, label: zoomLevel === 50 ? '\u2713 50%' : '50%', action: () => setZoomLevel(50) },
            { icon: <CirclePlusIcon />, label: zoomLevel === 75 ? '\u2713 75%' : '75%', action: () => setZoomLevel(75) },
            { icon: <CirclePlusIcon />, label: zoomLevel === 100 ? '\u2713 100%' : '100%', action: () => setZoomLevel(100) },
            { icon: <CirclePlusIcon />, label: zoomLevel === 125 ? '\u2713 125%' : '125%', action: () => setZoomLevel(125) },
            { icon: <CirclePlusIcon />, label: zoomLevel === 150 ? '\u2713 150%' : '150%', action: () => setZoomLevel(150) },
            { icon: <CirclePlusIcon />, label: zoomLevel === 200 ? '\u2713 200%' : '200%', action: () => setZoomLevel(200) },
            { icon: <CirclePlusIcon />, label: zoomLevel === 300 ? '\u2713 300%' : '300%', action: () => setZoomLevel(300) },
          ],
        },
      ],
    },
    {
      label: 'Insert',
      items: [
        {
          icon: <FaListOl />, label: 'Element',
          children: [
            // Dual Dialogue lives inside the Element list, immediately after
            // Dialogue (v0.62) — it's an element choice, not a separate insert.
            ...pickableElements
              .flatMap((r) => {
                const shortcuts: Record<string, string> = {
                  sceneHeading: `${mod}1`, action: `${mod}2`, character: `${mod}3`, dialogue: `${mod}4`,
                  parenthetical: `${mod}5`, transition: `${mod}6`, general: `${mod}7`, shot: `${mod}8`,
                };
                // Dual Dialogue arrives from the canonical list like any other
                // element; it just runs a command instead of setting a node.
                if (r.id === 'dualDialogue') {
                  return [{
                    icon: <FaColumns />,
                    label: r.label,
                    shortcut: sc('dualDialogue'),
                    action: () => (editor as any)?.commands?.toggleDualDialogue(),
                  }];
                }
                // v2.04: every menu item wears an icon (Derek's audit).
                return [{ icon: <FaTextHeight />, label: r.label, shortcut: shortcuts[r.id], action: () => setElement(r.id as any) }];
              }),
            { separator: true, label: '' },
            { icon: <FaWrench />, label: 'Customize Elements…', action: () => openCustomize('elements') },
          ],
        },
        { icon: <FaImage />, label: 'Insert Image…', action: () => useEditorStore.getState().imageInsertHandler?.() },
        { separator: true, label: '' },
        { icon: <FaListOl />, label: 'Section', action: () => insertOutlineLine('# ') },
        { icon: <FaListOl />, label: 'Marker', action: () => insertOutlineLine('⚑ ') },
        // v4.33: creates the note on the current selection/element and opens
        // its highlight popover (the Notes window is general-only now).
        { icon: <FaRegStickyNote />, label: 'Note', action: () => {
          if (!editor) return;
          const noteId = createScriptNoteAtSelection(editor);
          if (noteId) useEditorStore.getState().setNotePopoverId(noteId);
          else useEditorStore.getState().openTool('sticky');
        } },
        { icon: <FaCheckSquare />, label: 'To-Do List', action: () => insertOutlineLine('[ ] ') },
        { separator: true, label: '' },
        // v3.25, Derek: moved here from Project (ex-Production menu).
        { icon: <FaTags />, label: 'Production Tags', action: () => useEditorStore.getState().openTool('tags') },
      ],
    },
    {
      label: 'Format',
      items: [
        // v0.87: Style and Alignment were submenus in a menu with barely anything
        // else in it — two clicks to reach Bold. Their contents are promoted to
        // the top of Format and the wrapper submenus are gone.
        { icon: <FaBold />, label: 'Bold', shortcut: sc('bold'), action: () => editor?.chain().focus(undefined, { scrollIntoView: false }).toggleBold().run(), disabled: locked.bold },
        { icon: <FaItalic />, label: 'Italic', shortcut: sc('italic'), action: () => editor?.chain().focus(undefined, { scrollIntoView: false }).toggleItalic().run(), disabled: locked.italic },
        { icon: <FaUnderline />, label: 'Underline', shortcut: sc('underline'), action: () => editor?.chain().focus(undefined, { scrollIntoView: false }).toggleUnderline().run(), disabled: locked.underline },
        { icon: <FaStrikethrough />, label: 'Strikethrough', action: () => editor?.chain().focus(undefined, { scrollIntoView: false }).toggleStrike().run(), disabled: locked.strikethrough },
        /* v3.24 reorg #3: Subscript/Superscript removed — screenplay
           format never uses them (same call as the v3.19 palette cull).
           The editor marks still exist for imported documents. */
        { separator: true, label: '' },
        // v1.95: the four alignment actions fold into one submenu.
        {
          icon: <FaAlignLeft />, label: 'Alignment',
          children: [
            { icon: <FaAlignLeft />, label: 'Align Left', action: () => editor?.chain().focus(undefined, { scrollIntoView: false }).setTextAlign('left').run(), disabled: locked.textAlign },
            { icon: <FaAlignCenter />, label: 'Align Center', action: () => editor?.chain().focus(undefined, { scrollIntoView: false }).setTextAlign('center').run(), disabled: locked.textAlign },
            { icon: <FaAlignRight />, label: 'Align Right', action: () => editor?.chain().focus(undefined, { scrollIntoView: false }).setTextAlign('right').run(), disabled: locked.textAlign },
            { icon: <FaAlignJustify />, label: 'Justify', action: () => editor?.chain().focus(undefined, { scrollIntoView: false }).setTextAlign('justify').run(), disabled: locked.textAlign },
          ],
        },
        { separator: true, label: '' },
        // v1.83: Final Draft-style Highlighting submenu. The color list and
        // the toolbar highlighter share ONE store color (highlightColor).
        {
          icon: <FaHighlighter />, label: 'Highlighting',
          children: [
            {
              icon: <FaHighlighter />, label: 'Highlight', shortcut: '⇧⌘H',
              action: () => editor?.chain().focus(undefined, { scrollIntoView: false }).toggleHighlight({ color: highlightColor }).run(),
            },
            { separator: true, label: '' },
            { icon: <FaHighlighter />, label: 'Find Next', shortcut: '⇧⌘.', action: () => jumpHighlight(1) },
            { icon: <FaHighlighter />, label: 'Find Previous', shortcut: '⇧⌘,', action: () => jumpHighlight(-1) },
            { separator: true, label: '' },
            ...HIGHLIGHT_MENU_COLORS.map(([name, hex]) => ({
              icon: <span className="fs-hl-chip" style={{ background: hex }} />,
              label: name,
              checked: highlightColor.toLowerCase() === hex,
              action: () => pickHighlightColor(hex),
            })),
            { separator: true, label: '' },
            { icon: <FaHighlighter />, label: 'Custom…', action: () => customHighlightRef.current?.click() },
          ],
        },
        { separator: true, label: '' },
        { icon: <FaFileAlt />, label: `Formatting Template (${activeTemplate.name})...`, action: () => setTemplateSelectOpen(true) },
        { icon: <FaFileAlt />, label: 'Script Format Preferences…', action: () => setFormatPrefsOpen({ firstRun: false, afterSave: null }) },
      ],
    },
    {
      label: 'Project',
      items: [
        ...PROJECT_MENU_GROUPS.filter((group) => group.length > 0).flatMap((group, gi) => [
          ...(gi > 0 ? [{ separator: true, label: '' }] : []),
          ...group
            .map((id) => ALL_TOOLS.find((t) => t.id === id))
            .filter((t): t is typeof ALL_TOOLS[number] => !!t)
            .map((t) => ({
              icon: t.icon,
              label: t.label,
              action: () => useEditorStore.getState().openTool(t.id),
            })),
        ]),
        // v1.63: the one Spelling & Grammar, moved here from Tools. The panel
        // item opens the dockable window (which now has the full feature set);
        // the rest is the extensive submenu it always had.
        {
          icon: <FaSpellCheck />, label: 'Spelling & Grammar',
          children: [
            { icon: <FaSpellCheck />, label: 'Spell Check Panel', action: () => useEditorStore.getState().openTool('spelling') },
            { separator: true, label: '' },
            { icon: <FaSpellCheck />, label: 'Auto Spell Check', checked: spellCheckEnabled, action: toggleSpellCheck },
            { icon: <FaSpellCheck />, label: 'Spell Check…', shortcut: 'F7', action: () => setSpellModalOpen(true) },
            { separator: true, label: '' },
            { icon: <FaSpellCheck />, label: 'Auto Writing Suggestions', checked: grammarCheckEnabled, action: toggleGrammarCheck },
            { icon: <FaSpellCheck />, label: 'Writing Suggestions…', shortcut: '⇧F7', action: () => setGrammarModalOpen(true) },
            /* v3.24 reorg #6: Grammar & Spelling Settings moved to the
               Settings dialog (it's configuration, not workflow). */
          ],
        },
        // v1.66: Script History moved here from Tools — it's project/script
        // management, and its dockable window was already a Project Window.
        { separator: true, label: '' },
        {
          icon: <FaCodeBranch />, label: 'Script History',
          disabled: isCollabGuest,
          children: [
            { icon: <FaUpload />, label: 'Take Auto Save…', action: handleCheckinOpen, disabled: isCollabGuest },
            { icon: <FaHistory />, label: 'Auto Saves', action: () => setVersionHistoryOpen(true), disabled: isCollabGuest },
            { separator: true, label: '' },
            {
              icon: <FaExchangeAlt />,
              label: trackChangesEnabled
                ? '\u2713 Track Changes'
                : 'Track Changes Since Last Auto Save',
              action: handleTrackChangesToggle,
            },
            { icon: <FaFileSignature />, label: 'Compare with Auto Save\u2026', action: () => setCompareVersionOpen(true) },
          ],
        },
        /* v3.24, Derek's menu reorg #1: the Production menu merged in —
           everything below was that menu. Title Page heads the block
           (v0.91's rule) and appears ONLY here (v1.64's one-home rule).
           #2: Add/Remove Scene Numbers folded into one checkable toggle. */
        { separator: true, label: '' },
        { icon: <FaFileAlt />, label: 'Title Page', action: () => useEditorStore.getState().openTool('titlepage') },
        { icon: <FaFileSignature />, label: 'Set Draft Number…', action: () => setDraftDialogOpen(true) },
        { separator: true, label: '' },
        {
          icon: <FaLock />,
          label: 'Lock Scene Numbers',
          checked: sceneNumbersLocked,
          action: () => setSceneNumbersLocked(!sceneNumbersLocked),
          disabled: !sceneNumbersVisible,
        },
        // v1.34: Lock Pages is UNRELEASED — same Developer toggle as Help's.
        ...(showUnreleasedTools ? [{ icon: <FaLock />, label: 'Lock Pages', disabled: true }] : []),
        { icon: <FaToggleOn />, label: 'Revision Mode', checked: revisionMode, action: () => setRevisionMode(!revisionMode) },
        /* v3.25, Derek: Production Tags moved to Insert — tagging is
           something you do TO the script, alongside markers and notes. */
      ],
    },
    {
      label: 'Tools',
      items: [
        ...TOOL_MENU_GROUPS.flatMap((group, gi) => [
          ...(gi > 0 ? [{ separator: true, label: '' }] : []),
          ...group
            .map((id) => ALL_TOOLS.find((t) => t.id === id))
            .filter((t): t is typeof ALL_TOOLS[number] => !!t)
            .map((t) => ({
              icon: t.icon,
              label: t.label,
              action: () => useEditorStore.getState().openTool(t.id),
            })),
        ]),
      ],
    },
  ];

  // Help menu rendered separately as a 3-dot overflow on the right
  const helpMenu: MenuSection = {
    label: 'Help',
    items: [
      /* v3.15, Derek: About lives in the ScriptCraft app menu, not Help —
         but ONLY native mode has an app menu, so the in-window Help keeps
         it (removing it there would leave About unreachable). */
      ...(nativeMenus ? [] : [{
        icon: <FaInfoCircle />,
        label: 'About ScriptCraft',
        action: () => setAboutOpen(true),
      }]),
      {
        icon: <FaKeyboard />,
        label: 'Keyboard Shortcuts',
        action: () => setShortcutsOpen(true),
      },
      {
        icon: <FaInfoCircle />,
        label: 'Knowledge Base',
        action: () => setKnowledgeBaseOpen(true),
      },
      /* v3.24 reorg #7: Changelog folded into About ("What's New"). */
      { separator: true, label: '' },
      {
        icon: <FaExternalLinkAlt />,
        label: 'Feedback…',
        action: () => setHelpForm(HELP_FORMS.feedback),
      },
      { separator: true, label: '' },
      {
        /*
         * v1.13: Developer collects the app's own diagnostic tools.
         *
         * NOTE THE ONE THING THAT IS *NOT* DEV-ONLY HERE. Diagnostics ships. It's
         * what a user runs when something breaks and what support would ask them
         * for, so burying it behind import.meta.env.DEV would delete it from every
         * release build — a real loss dressed up as tidying. So the Developer group
         * always ships. (v3.25: the Dev Picker that used to live here is gone.)
         */
        icon: <FaBug />, label: 'Developer',
        children: [
          {
            icon: <FaStethoscope />,
            label: 'Diagnostics',
            action: () => setDiagnosticsOpen(true),
          },
          /* v1.34: the switch for features that exist but aren't finished
           * (Collaboration, Lock Pages). One flag, read wherever an
           * unreleased item renders — not a per-feature checkbox list. */
          {
            icon: <FaToggleOn />,
            label: 'Show Unreleased Tools',
            checked: showUnreleasedTools,
            action: () => setShowUnreleasedTools(!showUnreleasedTools),
          },
        ],
      },
      { separator: true, label: '' },
      /* v3.08, Derek: donation link — last item of Help. */
      {
        icon: <FaCoffee />,
        label: 'Buy Me a Coffee',
        action: () => openInBrowser(DONATE_URL),
      },
    ],
  };

  menus.push(helpMenu);

  // Customize > Menu Bar: apply user order + hidden set (File never hides;
  // menus not in the saved order — e.g. added in later versions — keep their
  // natural position at the end of the ordered ones).

  // v2.13: the Scrapbook's contextual menus (Table / Picture) — [] unless
  // the Scrapbook is open. They render AFTER a divider + tag, never join
  // orderedMenus, and can't be customized or hidden.
  const scrapbookMenus = useScrapbookMenus() as unknown as MenuSection[];

  const visibleMenus = menus.filter((m) => m.label === 'File' || !menuBarHidden.includes(m.label));
  const orderIdxOf = (label: string) => {
    const i = menuBarOrder.indexOf(label);
    return i === -1 ? 100 + menus.findIndex((m) => m.label === label) : i;
  };
  const orderedMenus = [...visibleMenus].sort((a, b) => orderIdxOf(a.label) - orderIdxOf(b.label));

  // Append plugin menu items to each section (supports nested submenus)
  const pluginCtx = { editor };
  const mapPluginChildren = (children: any[]): MenuItem[] =>
    children.map((c) => ({
      label: c.label || '',
      shortcut: c.shortcut,
      action: c.action ? () => c.action!(pluginCtx) : undefined,
      disabled: typeof c.disabled === 'function' ? c.disabled(pluginCtx) : c.disabled,
      separator: c.separator,
      children: c.children ? mapPluginChildren(c.children) : undefined,
    }));
  for (const menu of menus) {
    const pluginItems = pluginRegistry.getMenuItems(menu.label as PluginMenuSection);
    if (pluginItems.length > 0) {
      menu.items.push({ separator: true, label: '' });
      for (const p of pluginItems) {
        menu.items.push({
          label: p.label,
          shortcut: p.shortcut,
          action: p.action ? () => p.action!(pluginCtx) : undefined,
          disabled: typeof p.disabled === 'function' ? p.disabled(pluginCtx) : p.disabled,
          children: p.children ? mapPluginChildren(p.children) : undefined,
        });
      }
    }
  }

  // Track the active menu item's position for the portal dropdown
  const menuItemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [dropdownPos, setDropdownPos] = useState<{ top?: number; bottom?: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => {
    if (!activeMenu) return;
    const el = menuItemRefs.current[activeMenu];
    if (el) {
      const rect = el.getBoundingClientRect();
      const dropdownWidth = 260; // min-width of .menu-dropdown
      const left = Math.min(rect.left, window.innerWidth - dropdownWidth - 8);

      // In floating mode, position relative to the panel edges (not individual items)
      // so the dropdown clears the rounded, padded floating menu panel.
      if (menuMode === 'hidden' && menuRef.current) {
        const panelRect = menuRef.current.getBoundingClientRect();
        if (panelRect.bottom > window.innerHeight * 0.55) {
          setDropdownPos({ bottom: window.innerHeight - panelRect.top + 4, left, top: undefined });
        } else {
          setDropdownPos({ top: panelRect.bottom + 4, left, bottom: undefined });
        }
      } else {
        setDropdownPos({ top: rect.bottom, left, bottom: undefined });
      }
    }
  }, [activeMenu, menuMode]);

  // Floating menu toggle (hidden mode)
  const [floatingMenuOpen, setFloatingMenuOpen] = useState(false);
  const [showHiddenModeIntro, setShowHiddenModeIntro] = useState(false);
  const [hiddenModeDontShow, setHiddenModeDontShow] = useState(true);

  // Draggable FAB position — persisted to localStorage
  const FAB_POS_KEY = 'opendraft:fabPosition';
  const FAB_SIZE = 36;
  const [fabPos, setFabPos] = useState<{ x: number; y: number } | null>(() => {
    try {
      const s = localStorage.getItem('opendraft:fabPosition');
      if (s) {
        const p = JSON.parse(s);
        return {
          x: Math.max(0, Math.min(p.x, window.innerWidth - 36)),
          y: Math.max(0, Math.min(p.y, window.innerHeight - 36)),
        };
      }
    } catch {}
    return null;
  });
  const fabDragRef = useRef<{ startX: number; startY: number; originX: number; originY: number; isDrag: boolean } | null>(null);
  const fabWasDragRef = useRef(false);
  const fabX = fabPos?.x ?? (navPanelWidth + 14);
  const fabY = fabPos?.y ?? 10;
  // On Android the WebView extends behind the (transparent) status bar, so a
  // FAB rendered at top: 10px sits in the system-bar touch region and never
  // receives taps. Clamp the rendered top below the status bar (28dp fallback
  // when env() reports 0, otherwise the real inset).
  const isAndroidWebView = typeof document !== 'undefined'
    && document.documentElement.classList.contains('android');
  const fabTopStyle = isAndroidWebView
    ? `max(${fabY}px, calc(max(env(safe-area-inset-top), 28px) + 8px))`
    : `max(${fabY}px, calc(env(safe-area-inset-top, 0px) + 8px))`;

  // Desktop: pointer events with capture for mouse drag
  const handleFabPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return; // Touch handled separately below
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
    fabDragRef.current = {
      startX: e.clientX, startY: e.clientY,
      originX: fabPos?.x ?? (navPanelWidth + 14),
      originY: fabPos?.y ?? 10,
      isDrag: false,
    };
  }, [fabPos, navPanelWidth]);

  const handleFabPointerMove = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return;
    const d = fabDragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.isDrag && Math.abs(dx) + Math.abs(dy) > 5) {
      d.isDrag = true;
      setFloatingMenuOpen(false);
    }
    if (d.isDrag) {
      setFabPos({
        x: Math.max(0, Math.min(window.innerWidth - FAB_SIZE, d.originX + dx)),
        y: Math.max(0, Math.min(window.innerHeight - FAB_SIZE, d.originY + dy)),
      });
    }
  }, [FAB_SIZE]);

  const handleFabPointerUp = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return;
    const d = fabDragRef.current;
    fabDragRef.current = null;
    if (!d) return;
    fabWasDragRef.current = true;
    if (d.isDrag) {
      const pos = {
        x: Math.max(0, Math.min(window.innerWidth - FAB_SIZE, d.originX + (e.clientX - d.startX))),
        y: Math.max(0, Math.min(window.innerHeight - FAB_SIZE, d.originY + (e.clientY - d.startY))),
      };
      setFabPos(pos);
      localStorage.setItem(FAB_POS_KEY, JSON.stringify(pos));
    } else {
      setFloatingMenuOpen(prev => !prev);
    }
  }, [FAB_POS_KEY, FAB_SIZE]);

  // Touch: native listeners on the FAB element via ref (WKWebView + Android WebView)
  const fabElRef = useRef<HTMLDivElement>(null);
  const fabPosRef = useRef(fabPos);
  fabPosRef.current = fabPos;
  const navPanelWidthRef = useRef(navPanelWidth);
  navPanelWidthRef.current = navPanelWidth;

  useEffect(() => {
    const el = fabElRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      e.stopPropagation(); // Prevent swipe handlers on parent elements
      const t = e.touches[0];
      const pos = fabPosRef.current;
      fabDragRef.current = {
        startX: t.clientX, startY: t.clientY,
        originX: pos?.x ?? (navPanelWidthRef.current + 14),
        originY: pos?.y ?? 10,
        isDrag: false,
      };
    };
    const onTouchMove = (e: TouchEvent) => {
      const d = fabDragRef.current;
      if (!d) return;
      const t = e.touches[0];
      const dx = t.clientX - d.startX;
      const dy = t.clientY - d.startY;
      if (!d.isDrag && Math.abs(dx) + Math.abs(dy) > 5) {
        d.isDrag = true;
        setFloatingMenuOpen(false);
      }
      if (d.isDrag) {
        e.preventDefault();
        e.stopPropagation();
        setFabPos({
          x: Math.max(0, Math.min(window.innerWidth - FAB_SIZE, d.originX + dx)),
          y: Math.max(0, Math.min(window.innerHeight - FAB_SIZE, d.originY + dy)),
        });
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      const d = fabDragRef.current;
      fabDragRef.current = null;
      if (!d) return;
      if (d.isDrag) {
        fabWasDragRef.current = true;
        // Reset after a short delay so the flag doesn't block future taps
        // (onClick may not fire on mobile after a drag to reset it)
        setTimeout(() => { fabWasDragRef.current = false; }, 400);
        const t = e.changedTouches[0];
        const pos = {
          x: Math.max(0, Math.min(window.innerWidth - FAB_SIZE, d.originX + (t.clientX - d.startX))),
          y: Math.max(0, Math.min(window.innerHeight - FAB_SIZE, d.originY + (t.clientY - d.startY))),
        };
        setFabPos(pos);
        localStorage.setItem(FAB_POS_KEY, JSON.stringify(pos));
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [FAB_POS_KEY, FAB_SIZE, menuMode]);

  // Click: fallback for tap (works everywhere)
  const handleFabClick = useCallback(() => {
    if (fabWasDragRef.current) {
      fabWasDragRef.current = false;
      return;
    }
    setFloatingMenuOpen(prev => !prev);
  }, []);

  // Icon map for menu labels

  // Find the active menu's items (search both main menus and help)
  const activeMenuData = activeMenu
    ? menus.find(m => m.label === activeMenu)
      || scrapbookMenus.find(m => m.label === activeMenu)
      || (activeMenu === 'Help' ? helpMenu : null)
    : null;

  // Close floating menu when clicking outside (but not on the dropdown portal or FAB)
  useEffect(() => {
    if (!floatingMenuOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (menuRef.current && !menuRef.current.contains(target)) {
        // Don't close if clicking inside the dropdown portal or a submenu
        if (target.closest('.menu-dropdown') || target.closest('.menu-fab')) return;
        setFloatingMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [floatingMenuOpen]);

  // v0.72: 'custom' sizes the bar from the user's slider (half-compact …
  // double-comfortable). Contents scale with it via --chrome-scale so a taller
  // bar isn't just empty space around tiny text.
  const menuBarClass =
    menuMode === 'comfortable' ? 'menu-bar chrome-comfortable'
    : menuMode === 'custom' ? 'menu-bar chrome-custom'
    : 'menu-bar';
  const menuCustomH = chromePx('menu', 'custom', chromeCustomPx.menu);
  const menuBarStyle: React.CSSProperties | undefined = menuMode === 'custom'
    ? ({
        height: menuCustomH,
        ['--chrome-scale' as string]: String(chromeScaleFactor('menu', menuCustomH)),
      } as React.CSSProperties)
    : undefined;

  // v2.35: dragging the line before "Scrapbook" slides that menu group.
  const scrapbookSepDrag = useRef<{ x: number; offset: number } | null>(null);

  const renderMenuItems = () => (
    <>
      {orderedMenus.map((menu) => (
        <div
          key={menu.label}
          ref={(el) => { menuItemRefs.current[menu.label] = el; }}
          className={`menu-item ${activeMenu === menu.label ? 'active' : ''}`}
          onClick={() => handleMenuClick(menu.label)}
          onMouseEnter={() => {
            if (activeMenu && activeMenu !== menu.label) { setActiveMenu(menu.label); setOpenSubmenu(null); }
          }}
        >
          {MENU_ICONS[menu.label] && <span className="menu-icon">{MENU_ICONS[menu.label]}</span>}
          <span className="menu-label">{menu.label}</span>
        </div>
      ))}
      {/* v2.13: the Scrapbook's contextual menus — divider, tag, then Table /
          Picture (Word's model) and the way back. Only while it's open. */}
      {scrapbookMenus.length > 0 && (<>
        {/* v2.35, Derek: grab this line to slide the whole Scrapbook menu
            group left or right (the offset persists). */}
        <span
          className={`menu-scrapbook-sep${uiResizeLocked ? '' : ' menu-scrapbook-sep-drag'}`}
          style={{ marginLeft: chromeGapPx.scrapbook }}
          title={uiResizeLocked ? undefined : 'Drag to move the Scrapbook menus'}
          onPointerDown={(e) => {
            // v2.55: the sizing lock freezes this slide too.
            if (useEditorStore.getState().uiResizeLocked) return;
            e.preventDefault();
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            scrapbookSepDrag.current = { x: e.clientX, offset: chromeGapPx.scrapbook };
          }}
          onPointerMove={(e) => {
            const d = scrapbookSepDrag.current;
            if (d) useEditorStore.getState().setChromeGap('scrapbook', d.offset + (e.clientX - d.x));
          }}
          onPointerUp={() => { scrapbookSepDrag.current = null; }}
        />
        <span className="menu-section-tag">Scrapbook</span>
        {scrapbookMenus.map((menu) => (
          <div
            key={menu.label}
            ref={(el) => { menuItemRefs.current[menu.label] = el; }}
            className={`menu-item ${activeMenu === menu.label ? 'active' : ''}`}
            onClick={() => handleMenuClick(menu.label)}
            onMouseEnter={() => {
              if (activeMenu && activeMenu !== menu.label) { setActiveMenu(menu.label); setOpenSubmenu(null); }
            }}
          >
            <span className="menu-icon">{menu.label === 'Table' ? <FaTable /> : <FaImageIcon />}</span>
            <span className="menu-label">{menu.label}</span>
          </div>
        ))}
      </>)}
      {/* v2.32, Derek: the spacing grip sits right after the LAST menu item —
          Help usually, the Scrapbook menus when they're open. ("Return to
          Editor" went back to the Scrapbook surface's corner.) */}
      <GapHandle bar="menu" />
      <div className="menu-spacer" />
    </>
  );

  // v2.93, Derek: the menus can live in the REAL macOS menu bar. Same
  // MenuSection data, mirrored natively; the in-window bar (and its
  // dropdown portal) stays unrendered while native mode is on — but the
  // component itself stays mounted: it owns the dialogs, the shortcut
  // handler, and the menu data the native bar mirrors.
  useEffect(() => {
    if (nativeMenus) {
      void syncNativeMenu([...orderedMenus, ...scrapbookMenus] as never);
    } else {
      void uninstallNativeMenu();
    }
  });

  /** v3.05: a list reserves the left check column when ANY of its items is
   *  checkable — so toggling doesn't shift the labels sideways. */
  const hasChecks = (items?: MenuItem[]) => !!items?.some((it) => it.checked !== undefined);

  return (
    <>
    {/* v1.83: hidden picker behind Format > Highlighting > Custom… */}
    <input
      ref={customHighlightRef}
      type="color"
      value={highlightColor}
      onChange={(e) => pickHighlightColor(e.target.value)}
      style={{ position: 'fixed', left: -9999, top: -9999, width: 1, height: 1, opacity: 0 }}
      aria-hidden="true"
      tabIndex={-1}
    />
    {nativeMenus ? null : menuMode === 'hidden' ? (
      createPortal(
        <>
          <div
            ref={fabElRef}
            className={`menu-fab ${floatingMenuOpen ? 'menu-fab--open' : ''}`}
            style={{ left: fabX, top: fabTopStyle }}
            onPointerDown={handleFabPointerDown}
            onPointerMove={handleFabPointerMove}
            onPointerUp={handleFabPointerUp}
            onClick={handleFabClick}
            onMouseDown={(e) => e.nativeEvent.stopImmediatePropagation()}
            title="Menu (drag to reposition)"
          >
            <FaBars />
          </div>
          {floatingMenuOpen && (() => {
            const fabInBottom = fabY > window.innerHeight * 0.55;
            const fabInRight = fabX > window.innerWidth * 0.5;
            const mStyle: React.CSSProperties = {};
            if (fabInBottom) {
              mStyle.bottom = window.innerHeight - fabY + 8;
            } else {
              mStyle.top = fabY + FAB_SIZE + 8;
            }
            if (fabInRight) {
              mStyle.right = window.innerWidth - fabX - FAB_SIZE;
            } else {
              mStyle.left = fabX;
            }
            return (
              <div className="menu-bar chrome-comfortable menu-bar--floating" style={mStyle} ref={menuRef}>
                {renderMenuItems()}
              </div>
            );
          })()}
        </>,
        document.body,
      )
    ) : (
      <div
        className={menuBarClass}
        style={{ ...(menuBarStyle ?? {}), gap: chromeGapPx.menu }}
        ref={menuRef}
      >
        {renderMenuItems()}
      </div>
    )}
    {!nativeMenus && activeMenuData && createPortal(
      <div
        className={`menu-dropdown${menuMode === 'comfortable' ? ' menu-dropdown--comfortable' : ''}${dropdownPos.bottom != null ? ' menu-dropdown--above' : ''}`}
        style={{ top: dropdownPos.top, bottom: dropdownPos.bottom, left: dropdownPos.left }}
      >
        {activeMenuData.items.map((item, i) =>
          item.separator ? (
            <div key={i} className="menu-separator" onPointerEnter={handleItemPointerEnter} />
          ) : item.children || item.render ? (
            <div
              key={`${i}:${item.label}`}
              className={`menu-dropdown-item has-children ${item.disabled ? 'disabled ' : ''}${openSubmenu === submenuKey(activeMenuData.label, item.label!, i) ? 'submenu-open' : ''}`}
              onPointerEnter={(e) => { if (!item.disabled) handleSubmenuPointerEnter(submenuKey(activeMenuData.label, item.label!, i), e); }}
              onTouchEnd={(e) => { if (!item.disabled) handleSubmenuTouchEnd(submenuKey(activeMenuData.label, item.label!, i), e); }}
              onClick={(e) => { e.stopPropagation(); if (!item.disabled) setOpenSubmenu(submenuKey(activeMenuData.label, item.label!, i)); }}
            >
              {hasChecks(activeMenuData.items) && <span className="menu-check" />}
              {item.icon && <span className="menu-dropdown-icon">{item.icon}</span>}
              <span>{item.label}</span>
              <span className="menu-submenu-arrow">{openSubmenu === submenuKey(activeMenuData.label, item.label!, i) ? <FaChevronDown /> : <FaChevronRight />}</span>
              <div
                className={`menu-submenu ${openSubmenu === submenuKey(activeMenuData.label, item.label!, i) ? 'submenu-visible' : ''}`}
                ref={(el) => {
                  if (el && openSubmenu === submenuKey(activeMenuData.label, item.label!, i)) {
                    const rect = el.getBoundingClientRect();
                    if (rect.right > window.innerWidth) {
                      el.classList.add('submenu-flip');
                    } else {
                      el.classList.remove('submenu-flip');
                    }
                    if (rect.bottom > window.innerHeight) {
                      el.classList.add('submenu-flip-y');
                    } else {
                      el.classList.remove('submenu-flip-y');
                    }
                  }
                }}
              >
                {item.render ? item.render(() => { setActiveMenu(null); setOpenSubmenu(null); }) : item.children!.map((child, j) =>
                  child.separator ? (
                    <div key={j} className="menu-separator" />
                  ) : (
                    <div
                      key={`${j}:${child.label}`}
                      className={`menu-dropdown-item ${child.disabled ? 'disabled' : ''}`}
                      onTouchEnd={(e) => e.stopPropagation()}
                      onClick={(e) => handleItemClick(child, e)}
                    >
                      {hasChecks(item.children) && <span className="menu-check">{child.checked ? <FaCheck /> : ''}</span>}
                      {child.icon && <span className="menu-dropdown-icon">{child.icon}</span>}
                      <span>{child.label}</span>
                      {child.shortcut && (
                        <span className="menu-shortcut">{child.shortcut}</span>
                      )}
                    </div>
                  )
                )}
              </div>
            </div>
          ) : (
            <div
              key={`${i}:${item.label}`}
              className={`menu-dropdown-item ${item.disabled ? 'disabled' : ''}`}
              onPointerEnter={handleItemPointerEnter}
              onClick={(e) => handleItemClick(item, e)}
            >
              {hasChecks(activeMenuData.items) && <span className="menu-check">{item.checked ? <FaCheck /> : ''}</span>}
              {item.icon && <span className="menu-dropdown-icon">{item.icon}</span>}
              <span>{item.label}</span>
              {item.shortcut && (
                <span className="menu-shortcut">{item.shortcut}</span>
              )}
            </div>
          )
        )}
      </div>,
      document.body,
    )}
    {showHiddenModeIntro && createPortal(
      <div className="dialog-overlay" onClick={() => setShowHiddenModeIntro(false)}>
        <div className="hidden-mode-intro" onClick={(e) => e.stopPropagation()}>
          <div className="dialog-header">Hidden Mode</div>
          <div className="hidden-mode-intro-body">
            <div className="hidden-mode-intro-icon">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="var(--fd-accent)" strokeWidth="1.5">
                <circle cx="20" cy="20" r="18" fill="var(--fd-overlay-subtle)" />
                <line x1="14" y1="14" x2="14" y2="26" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="20" y1="14" x2="20" y2="26" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="26" y1="14" x2="26" y2="26" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
            <p>The menu bar is now hidden. A <strong>floating menu button</strong> has been placed on screen to access all menus.</p>
            <p>You can <strong>drag the button</strong> to reposition it anywhere on screen. Your preferred position will be remembered.</p>
            <p>To restore the menu bar, tap the button and go to <strong>View &gt; Menu &amp; Toolbar</strong>.</p>
          </div>
          <div className="dialog-footer" style={{ flexDirection: 'column', gap: '12px', alignItems: 'stretch' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--fd-text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={hiddenModeDontShow} onChange={(e) => setHiddenModeDontShow(e.target.checked)} />
              Don't show this again
            </label>
            <button className="dialog-btn dialog-btn-primary" onClick={() => {
              if (hiddenModeDontShow) localStorage.setItem('opendraft:hiddenModeIntroShown', '1');
              setShowHiddenModeIntro(false);
            }}>Got it</button>
          </div>
        </div>
      </div>,
      document.body,
    )}
    {checkinOpen && (
      <div className="dialog-overlay" onClick={() => setCheckinOpen(false)}>
        <div className="dialog-box" onClick={(e) => e.stopPropagation()}>
          <div className="dialog-header">Check In Version</div>
          <div className="dialog-body">
            <div className="dialog-row">
              <label>Version Description</label>
              <input
                ref={checkinInputRef}
                value={checkinMessage}
                onChange={(e) => setCheckinMessage(e.target.value)}
                placeholder="Describe what changed..."
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && checkinMessage.trim()) handleCheckinSubmit();
                  if (e.key === 'Escape') setCheckinOpen(false);
                }}
              />
            </div>
          </div>
          <div className="dialog-actions">
            <button onClick={() => setCheckinOpen(false)}>Cancel</button>
            <button
              className="dialog-primary"
              onClick={handleCheckinSubmit}
              disabled={checkinSaving || !checkinMessage.trim()}
            >
              {checkinSaving ? 'Saving...' : 'Check In'}
            </button>
          </div>
        </div>
      </div>
    )}
    <CustomizePanelsDialog open={customizeOpen} category={customizeTab} onClose={() => setCustomizeOpen(false)} />
    <PresetsDialog open={presetsOpen} onClose={() => setPresetsOpen(false)} />
    <SaveWorkspaceDialog open={saveWorkspaceOpen} onClose={() => setSaveWorkspaceOpen(false)} />
    <EditWorkspacesDialog open={editWorkspacesOpen} onClose={() => setEditWorkspacesOpen(false)} />
    <PreferencesDialog
      open={prefsOpen || preferencesRequest.open}
      openTab={preferencesRequest.tab}
      onClose={() => { setPrefsOpen(false); closePreferences(); }}
      editor={editor}
    />
    <SetDraftDialog open={draftDialogOpen} onClose={() => setDraftDialogOpen(false)} editor={editor} />
    {/* v4.80, Derek: the launcher fronts New Script — the unsaved-work guard
        already ran on the way in, so its branches act directly. */}
    <NewScriptLauncher
      open={launcherOpen}
      onClose={() => setLauncherOpen(false)}
      onChoose={(choice) => {
        setLauncherOpen(false);
        if (choice === 'manual') setNewScriptOpen(true);
        else if (choice === 'guided') setGuidedOpen(true);
        else if (choice === 'open') useEditorStore.getState().setOpenFileOpen(true);
        else handleImport();
      }}
    />
    <GuidedSetupDialog
      open={guidedOpen}
      onClose={() => setGuidedOpen(false)}
      onBack={() => { setGuidedOpen(false); setLauncherOpen(true); }}
      onCreate={(meta) => {
        pendingNewScriptMeta.current = meta;
        setGuidedOpen(false);
        finishNewScreenplayWithFormat(meta.templateId, 'reset');
      }}
    />
    <NewScriptDialog
      open={newScriptOpen}
      onClose={() => setNewScriptOpen(false)}
      onBack={() => { setNewScriptOpen(false); setLauncherOpen(true); }}
      onCreate={(meta) => {
        pendingNewScriptMeta.current = meta;
        setNewScriptOpen(false);
        // v1.88: the format is a dropdown ON the dialog now — apply it
        // directly instead of routing through the "Choose script format"
        // window. (promptForNewScreenplayFormat still serves in-project
        // creation, which has no New Script dialog.)
        finishNewScreenplayWithFormat(meta.templateId, 'reset');
      }}
    />
    <RenameDialog open={renameOpen} onClose={() => setRenameOpen(false)} />
    {helpForm && (
      <div className="dialog-overlay" onClick={() => setHelpForm(null)}>
        <div className="dialog-box help-form-dialog" onClick={(e) => e.stopPropagation()}>
          <div className="dialog-header">
            {helpForm.title}
            <button className="fs-dialog-x" onClick={() => setHelpForm(null)} title="Close">&times;</button>
          </div>
          <iframe className="help-form-frame" src={helpForm.url} title={helpForm.title} />
        </div>
      </div>
    )}
    <HelpReferenceDialog kind="shortcuts" open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    <HelpReferenceDialog kind="knowledge" open={knowledgeBaseOpen} onClose={() => setKnowledgeBaseOpen(false)} />
    {pageSetupOpen && (
      <PageSetupDialog onClose={() => setPageSetupOpen(false)} />
    )}
    {templateSelectOpen && (
      <TemplateSelectDialog editor={editor} onClose={() => setTemplateSelectOpen(false)} />
    )}
    {formatPrefsOpen && (
      <ScriptFormatPreferencesDialog
        firstRun={formatPrefsOpen.firstRun}
        onConfirm={(ids) => {
          const next = formatPrefsOpen;
          setFormatPrefsOpen(null);
          if (next?.afterSave === 'apply-new-screenplay') {
            // After saving prefs, immediately route the new-screenplay action through
            // the same logic again (1 enabled = apply directly, 2+ = show picker).
            if (ids.length === 1) finishNewScreenplayWithFormat(ids[0], formatPickerMode);
            else if (ids.length > 1) setFormatPickerOpen(true);
            else finishNewScreenplayWithFormat(INDUSTRY_STANDARD_ID, formatPickerMode);
          }
        }}
        onCancel={() => setFormatPrefsOpen(null)}
      />
    )}
    {formatPickerOpen && (
      <ScriptFormatPickerDialog
        enabledIds={useSettingsStore.getState().enabledScriptFormats}
        onPick={(id) => {
          setFormatPickerOpen(false);
          finishNewScreenplayWithFormat(id, formatPickerMode);
        }}
        onCancel={() => setFormatPickerOpen(false)}
      />
    )}
    <ChangelogDialog open={changelogOpen} onClose={() => setChangelogOpen(false)} />
    {editElementsOpen && (
      <EditElementsDialog open onClose={() => setEditElementsOpen(false)} />
    )}
    {aboutOpen && <AboutDialog onClose={() => setAboutOpen(false)} onShowChangelog={() => { setAboutOpen(false); setChangelogOpen(true); }} />}
    {diagnosticsOpen && <DiagnosticsDialog onClose={() => setDiagnosticsOpen(false)} />}
    {discardConfirmOpen && (
      <div className="dialog-overlay" onClick={handleDiscardConfirmCancel}>
        <div className="dialog-box" onClick={(e) => e.stopPropagation()}>
          <div className="dialog-header">Unsaved Changes</div>
          <div className="dialog-body">
            <p style={{ margin: 0, fontSize: 14, color: 'var(--fd-text)' }}>
              You have unsaved changes. Would you like to save before proceeding?
            </p>
          </div>
          <div className="dialog-actions">
            <button onClick={handleDiscardConfirmCancel}>Cancel</button>
            <button onClick={handleDiscardConfirmDiscard}>Discard</button>
            <button className="dialog-primary" onClick={handleDiscardConfirmSave}>Save &amp; Continue</button>
          </div>
        </div>
      </div>
    )}
    {docxImportWarningOpen && (
      <div className="dialog-overlay" onClick={() => setDocxImportWarningOpen(false)}>
        <div className="dialog-box" onClick={(e) => e.stopPropagation()}>
          <div className="dialog-header">Import from Word — Best-Effort Formatting</div>
          <div className="dialog-body">
            <p style={{ margin: '0 0 8px 0', fontSize: 14, color: 'var(--fd-text)' }}>
              ScriptCraft will detect script element types (scene heading, action,
              character, dialogue, parenthetical, transition, etc.) from the
              Word document&apos;s formatting.
            </p>
            <p style={{ margin: '0 0 8px 0', fontSize: 14, color: 'var(--fd-text)' }}>
              Detection is <strong>best-effort</strong> and depends on consistent
              formatting being applied throughout the document. Results will be
              accurate if you used:
            </p>
            <ul style={{ margin: '0 0 8px 18px', fontSize: 13, color: 'var(--fd-text)' }}>
              <li>Final Draft, Fade In, Trelby, or Highland style names, OR</li>
              <li>Standard Final Draft indents (Action 1.5&quot;, Character 3.5&quot;, Dialogue 2.5&quot;, Parenthetical 3.0&quot;), OR</li>
              <li>Conventional text patterns (INT./EXT., ALL-CAPS character cues, &quot;CUT TO:&quot; transitions).</li>
            </ul>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--fd-text-muted, #888)' }}>
              Anything that can&apos;t be classified will be imported as Action and
              listed in a post-import notice for you to review.
            </p>
          </div>
          <div className="dialog-actions">
            <button onClick={() => setDocxImportWarningOpen(false)}>Cancel</button>
            <button className="dialog-primary" onClick={handleConfirmDocxImport}>Continue</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default MenuBar;
