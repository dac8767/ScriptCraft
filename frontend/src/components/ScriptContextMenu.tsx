import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import { ELEMENT_LABELS, NOTE_COLORS, type ElementType } from '../stores/editorStore';
import { uuid } from '../utils/uuid';
import { showToast } from './Toast';
import { useEditorStore } from '../stores/editorStore';
import { spellChecker, PROJECT_DICT_TARGET } from '../editor/spellchecker';
import { spellCheckPluginKey } from '../editor/extensions/SpellCheck';
import { grammarPluginKey } from '../editor/extensions/Grammar';
import { grammarIgnore, GrammarIgnore } from '../editor/grammar/grammarIgnore';
import { RETEXT_CATEGORY_META } from '../editor/grammar/retextProvider';
import { useFormattingTemplateStore } from '../stores/formattingTemplateStore';
import { getCurrentElementRule, getLockedFormatting } from '../utils/effectiveFormatting';

const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
const mod = isMac ? '⌘' : 'Ctrl+';
const shift = isMac ? '⇧' : 'Shift+';

/**
 * Top-level sections of the right-click menu (v0.81), in display order.
 * Customize > Context Menu shows/hides these — and ONLY these. What's inside a
 * section (e.g. which elements Element offers) is governed by that feature's own
 * tab, so a change there updates every instance at once.
 */
export const CONTEXT_MENU_SECTIONS: { id: string; label: string; group: ContextMenuGroup }[] = [
  // Labels are copied verbatim from the menu itself — if they drift apart, the
  // Customize list is lying about what it controls. Undo/Redo, Cut/Copy/Paste,
  // Select All/Delete, Delete Element and Customize Context Menu are PERMANENT
  // and deliberately absent: they always appear, so listing them would offer a
  // switch that does nothing.
  //
  // `group` mirrors the categories the other Customize tabs use. Items that also
  // exist elsewhere in the app sit under their usual heading; the ones that only
  // ever appear on a right-click live under "Context Menu" (v0.88).
  { id: 'element', label: 'Element', group: 'Format' },
  { id: 'style', label: 'Style', group: 'Format' },
  { id: 'font', label: 'Font…', group: 'Context Menu' },
  { id: 'sceneProperties', label: 'Scene Properties…', group: 'Context Menu' },
  { id: 'characterProfile', label: 'Character Profile…', group: 'Context Menu' },
  { id: 'revisionMode', label: 'Revision Mode', group: 'Production' },
  { id: 'revisionColor', label: 'Revision Color', group: 'Production' },
  { id: 'addScriptNote', label: 'Add Script Note', group: 'Context Menu' },
  { id: 'copyToSnippets', label: 'Copy to Snippets', group: 'Tools' },
  { id: 'insertSection', label: 'Insert Section', group: 'Insert' },
  { id: 'insertMarker', label: 'Insert Marker', group: 'Insert' },
  // v0.90/v0.92: 'Add as To-Do Item' removed — it duplicated this. A standalone
  // to-do doesn't live in the script, so it has no business in a script context
  // menu; a script to-do does, and that's what this inserts. The internal id
  // stays 'insertChecklist' so saved menu orders keep working.
  { id: 'insertChecklist', label: 'Add To-Do List', group: 'Insert' },
  { id: 'tagAs', label: 'Tag as…', group: 'Context Menu' },
  { id: 'spelling', label: 'Spelling Tools', group: 'Context Menu' },
];

/** Categories in the Add Item dropdown, in display order. */
export type ContextMenuGroup = 'Format' | 'Insert' | 'Tools' | 'Production' | 'Context Menu';
export const CONTEXT_MENU_GROUPS: ContextMenuGroup[] =
  ['Format', 'Insert', 'Tools', 'Production', 'Context Menu'];

// Element types shown in the submenu, with their shortcuts
const ELEMENT_MENU_ITEMS: { type: ElementType; shortcut: string }[] = [
  { type: 'sceneHeading', shortcut: `${mod}1` },
  { type: 'action', shortcut: `${mod}2` },
  { type: 'character', shortcut: `${mod}3` },
  { type: 'dialogue', shortcut: `${mod}4` },
  { type: 'parenthetical', shortcut: `${mod}5` },
  { type: 'transition', shortcut: `${mod}6` },
  { type: 'general', shortcut: `${mod}7` },
  { type: 'shot', shortcut: `${mod}8` },
  { type: 'newAct', shortcut: '' },
  { type: 'endOfAct', shortcut: '' },
  { type: 'lyrics', shortcut: '' },
  { type: 'showEpisode', shortcut: '' },
  { type: 'castList', shortcut: '' },
];

// Revision colors matching Final Draft production standard
const REVISION_COLORS = [
  'White', 'Blue', 'Pink', 'Yellow', 'Green',
  'Goldenrod', 'Buff', 'Salmon', 'Cherry',
  '2nd Blue', '2nd Pink', '2nd Yellow', '2nd Green',
];

interface SpellInfo {
  word: string;
  from: number;
  to: number;
  suggestions: string[];
}

interface GrammarInfo {
  from: number;
  to: number;
  ruleId: string;
  message: string;
  severity: 'style' | 'grammar';
  suggestions: string[];
}

interface ScriptContextMenuProps {
  editor: Editor;
  position: { x: number; y: number };
  spellInfo: SpellInfo | null;
  grammarInfo: GrammarInfo | null;
  onClose: () => void;
  onOpenFormatPanel: () => void;
  /** Pre-captured selection from long-press (touch devices blur the editor before mounting). */
  overrideSelection?: { from: number; to: number };
}

const ScriptContextMenu: React.FC<ScriptContextMenuProps> = ({
  editor,
  position,
  spellInfo,
  grammarInfo,
  onClose,
  onOpenFormatPanel,
  overrideSelection,
}) => {
  const setGrammarRuleEnabled = useEditorStore((s) => s.setGrammarRuleEnabled);
  const menuRef = useRef<HTMLDivElement>(null);
  const [elementSubOpen, setElementSubOpen] = useState(false);
  const [styleSubOpen, setStyleSubOpen] = useState(false);
  const [revisionSubOpen, setRevisionSubOpen] = useState(false);
  const [addDictSubOpen, setAddDictSubOpen] = useState(false);
  const appendWordToGlobalDictionary = useEditorStore((s) => s.appendWordToGlobalDictionary);

  const {
    revisionMode, setRevisionMode, revisionColor, setRevisionColor,
    openShelfTab, addNote, deleteNote, setNoteFilter, addShelfCard,
    toggleCharacterProfiles, characterProfilesOpen,
    deleteTag, setPendingTagSelection, setEditingTagId,
  } = useEditorStore();

  // Per-attribute locking for the current element
  const contextMenuHidden = useEditorStore((st) => st.contextMenuHidden);
  const contextMenuOrder = useEditorStore((st) => st.contextMenuOrder);

  const activeTemplate = useFormattingTemplateStore((s) => s.getActiveTemplate());
  useFormattingTemplateStore((s) => s.elementHidden);   // re-render on change
  useFormattingTemplateStore((s) => s.elementOrder);

  // Elements in the user's order, hidden ones removed. Shortcuts come from the
  // existing table; anything without one simply shows no shortcut.
  const shortcutFor = new Map(ELEMENT_MENU_ITEMS.map((i) => [i.type as string, i.shortcut]));
  const pickableElements = useFormattingTemplateStore((s) => s.getPickableElements)();
  const orderedElementItems = pickableElements
    .map((r) => ({ type: r.id as ElementType, label: r.label, shortcut: shortcutFor.get(r.id) ?? '' }));
  const isEnforceMode = activeTemplate.mode === 'enforce';
  const rule = getCurrentElementRule(editor, activeTemplate);
  const locked = getLockedFormatting(rule, isEnforceMode);

  // Use overrideSelection (from long-press on touch) if available,
  // otherwise capture from editor state (desktop right-click).
  const selFrom = overrideSelection?.from ?? editor.state.selection.from;
  const selTo = overrideSelection?.to ?? editor.state.selection.to;
  const savedSelection = useRef({ from: selFrom, to: selTo, empty: selFrom === selTo });

  // Restore ProseMirror selection so editor commands work correctly.
  // Wrapped in try/catch — positions may be stale if the document changed.
  useEffect(() => {
    if (overrideSelection && overrideSelection.from !== overrideSelection.to) {
      try {
        const docSize = editor.state.doc.content.size;
        const from = Math.min(overrideSelection.from, docSize);
        const to = Math.min(overrideSelection.to, docSize);
        if (from < to) {
          const { TextSelection } = require('@tiptap/pm/state');
          const { tr } = editor.state;
          tr.setSelection(TextSelection.create(editor.state.doc, from, to));
          editor.view.dispatch(tr);
        }
      } catch (e) {
        console.warn('ScriptContextMenu: failed to restore selection', e);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const safeSelFrom = Math.min(selFrom, editor.state.doc.content.size);
  const $from = editor.state.doc.resolve(safeSelFrom);
  const currentNodeType = $from.parent.type.name as ElementType;
  const hasSelection = !savedSelection.current.empty;

  // Context-sensitive: show dual dialogue for character/dialogue/parenthetical
  // Context-sensitive: show scene properties for scene headings
  const showSceneProps = currentNodeType === 'sceneHeading';

  // v0.86: Delete Element only makes sense when the caret is actually IN an
  // element. Anywhere else there's nothing for it to delete, so offering it is
  // just a dead entry.
  const onAnElement = (() => {
    if (!ELEMENT_LABELS[currentNodeType] && currentNodeType !== 'customElement') {
      // Not a known element type — unless we're inside a dual dialogue, which
      // IS the element the user is looking at.
      for (let d = $from.depth; d >= 0; d--) {
        if ($from.node(d).type.name === 'dualDialogue') return true;
      }
      return false;
    }
    return true;
  })();
  // Context-sensitive: show character profile for character/dialogue/parenthetical
  const showCharProfile = ['character', 'dialogue', 'parenthetical'].includes(currentNodeType);

  // Detect if cursor is on an existing script note
  const existingNoteId = (() => {
    const markType = editor.schema.marks.scriptNote;
    if (!markType) return null;
    const pos = editor.state.selection.$from;
    const storedMarks = pos.marks();
    let noteMark = storedMarks.find((m) => m.type === markType);
    if (!noteMark) {
      const node = pos.nodeAfter || pos.nodeBefore;
      if (node?.marks) {
        noteMark = node.marks.find((m) => m.type === markType);
      }
    }
    return noteMark ? (noteMark.attrs.noteId as string) : null;
  })();

  // Detect if cursor is on an existing production tag
  const existingTagInfo = (() => {
    const markType = editor.schema.marks.productionTag;
    if (!markType) return null;
    const pos = editor.state.selection.$from;
    // Check storedMarks first, then marks on the text node at this position
    const storedMarks = pos.marks();
    let tagMark = storedMarks.find((m) => m.type === markType);
    if (!tagMark) {
      // Check the text node at this position directly
      const node = pos.nodeAfter || pos.nodeBefore;
      if (node?.marks) {
        tagMark = node.marks.find((m) => m.type === markType);
      }
    }
    return tagMark ? { tagId: tagMark.attrs.tagId as string, categoryId: tagMark.attrs.categoryId as string } : null;
  })();

  // Close on click outside or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Adjust position to keep menu in viewport
  const [adjustedPos, setAdjustedPos] = useState(position);
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    let x = position.x;
    let y = position.y;
    if (x + rect.width > window.innerWidth - 8) {
      x = window.innerWidth - rect.width - 8;
    }
    if (y + rect.height > window.innerHeight - 8) {
      y = window.innerHeight - rect.height - 8;
    }
    if (x < 8) x = 8;
    if (y < 8) y = 8;
    setAdjustedPos({ x, y });
  }, [position]);

  const triggerSpellRecheck = useCallback(() => {
    const { tr } = editor.state;
    tr.setMeta(spellCheckPluginKey, { toggle: false });
    editor.view.dispatch(tr);
    requestAnimationFrame(() => {
      const tr2 = editor.state.tr;
      tr2.setMeta(spellCheckPluginKey, { toggle: true });
      editor.view.dispatch(tr2);
    });
  }, [editor]);

  // ── Action handlers ──

  const handleUndo = () => { editor.chain().focus().undo().run(); onClose(); };
  const handleRedo = () => { editor.chain().focus().redo().run(); onClose(); };

  const handleCut = () => {
    editor.commands.focus();
    document.execCommand('cut');
    onClose();
  };
  const handleCopy = () => {
    editor.commands.focus();
    document.execCommand('copy');
    onClose();
  };
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      editor.chain().focus().insertContent(text).run();
    } catch {
      editor.commands.focus();
      document.execCommand('paste');
    }
    onClose();
  };
  const handlePasteWithoutFormatting = async () => {
    try {
      const text = await navigator.clipboard.readText();
      editor.chain().focus().insertContent(text).run();
    } catch {
      editor.commands.focus();
      document.execCommand('paste');
    }
    onClose();
  };

  const handleSelectAll = () => { editor.chain().focus().selectAll().run(); onClose(); };
  /** Delete the element the cursor sits in — the whole block, not a selection.
   *  Inside a dual dialogue this removes the entire dual dialogue, which is the
   *  element the user is looking at. An empty Action is left behind so there's
   *  somewhere to type. */
  const handleDeleteElement = () => {
    const { state } = editor;
    const { $from } = state.selection;
    for (let d = $from.depth; d >= 0; d--) {
      if ($from.node(d).type.name === 'dualDialogue') {
        (editor as unknown as { commands: { deleteDualDialogue: () => boolean } })
          .commands.deleteDualDialogue();
        onClose();
        return;
      }
    }
    const start = $from.before($from.depth);
    const end = $from.after($from.depth);
    editor.chain().focus().deleteRange({ from: start, to: end }).run();
    onClose();
  };

  const handleDelete = () => {
    if (hasSelection) {
      editor.chain().focus().deleteSelection().run();
    }
    onClose();
  };

  const handleSetElement = (type: ElementType) => {
    // Dual Dialogue is a structure, not a paragraph type — run its command.
    if ((type as string) === 'dualDialogue') {
      (editor as unknown as { commands: { toggleDualDialogue: () => boolean } })
        .commands.toggleDualDialogue();
      onClose();
      return;
    }
    editor.chain().focus().setNode(type).run();
    onClose();
  };

  const handleBold = () => { editor.chain().focus().toggleBold().run(); onClose(); };
  const handleItalic = () => { editor.chain().focus().toggleItalic().run(); onClose(); };
  const handleUnderline = () => { editor.chain().focus().toggleUnderline().run(); onClose(); };
  const handleStrike = () => { editor.chain().focus().toggleStrike().run(); onClose(); };
  const handleSubscript = () => { editor.chain().focus().toggleSubscript().run(); onClose(); };
  const handleSuperscript = () => { editor.chain().focus().toggleSuperscript().run(); onClose(); };
  const handleAllCaps = () => {
    // Toggle all caps on selection by transforming the text
    if (!hasSelection) { onClose(); return; }
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to);
    const isUpper = text === text.toUpperCase();
    const newText = isUpper ? text.toLowerCase() : text.toUpperCase();
    editor.chain().focus().command(({ tr }) => {
      tr.insertText(newText, from, to);
      return true;
    }).run();
    onClose();
  };

  /** Derive a meaningful context label from the element under cursor */
  const deriveContextLabel = (): string => {
    const text = $from.parent.textContent.trim();
    switch (currentNodeType) {
      case 'character':
        // Strip extensions like (CONT'D), (V.O.) etc.
        return text.replace(/\s*\([^)]*\)\s*/g, '').trim();
      case 'sceneHeading':
        return text;
      case 'dialogue':
      case 'parenthetical': {
        // Walk backwards to find the owning character name
        let charName = '';
        const doc = editor.state.doc;
        const pos = $from.before($from.depth);
        doc.nodesBetween(0, pos, (node) => {
          if (node.type.name === 'character') {
            charName = node.textContent.trim().replace(/\s*\([^)]*\)\s*/g, '').trim();
          }
          return true;
        });
        return charName || text.slice(0, 40);
      }
      default:
        return text.slice(0, 60);
    }
  };

  const handleAddScriptNote = () => {
    const { from, to } = savedSelection.current;
    const anchorText = hasSelection
      ? editor.state.doc.textBetween(from, to, ' ')
      : editor.state.doc.textBetween(
          $from.start(),
          $from.end(),
          ' ',
        );

    // Determine which scene this text belongs to (find nearest sceneHeading above)
    let sceneId: string | null = null;
    let sceneIdx = 0;
    editor.state.doc.nodesBetween(0, from, (node) => {
      if (node.type.name === 'sceneHeading') {
        sceneId = `scene-${sceneIdx}`;
        sceneIdx++;
      }
      return true;
    });

    const contextLabel = deriveContextLabel();
    const defaultColor = NOTE_COLORS[0];
    const noteId = addNote({
      content: '',
      anchorText: anchorText.slice(0, 120),
      elementType: currentNodeType,
      contextLabel,
      color: defaultColor.name,
      sceneId,
    });

    // Apply the note highlight mark using chain (editor should still have valid state
    // since context menu is open and editor hasn't been blurred by a panel)
    const markFrom = hasSelection ? from : $from.start();
    const markTo = hasSelection ? to : $from.end();
    editor.chain().focus()
      .setTextSelection({ from: markFrom, to: markTo })
      .setMark('scriptNote', { noteId, color: defaultColor.hex })
      .run();

    // Filter to the newly created note
    setNoteFilter({ elementType: null, contextLabel: null, color: null, noteId });

    // Open the Sticky Notes pane on the Script tab
    openShelfTab('script');
    onClose();
  };

  const handleEditScriptNote = () => {
    if (existingNoteId) {
      setNoteFilter({
        elementType: null,
        contextLabel: null,
        color: null,
        noteId: existingNoteId,
      });
    }
    openShelfTab('script');
    onClose();
  };

  const handleDeleteScriptNote = () => {
    if (!existingNoteId) return;
    // Remove the mark from the editor
    const { doc, schema } = editor.state;
    const markType = schema.marks.scriptNote;
    if (markType) {
      editor.chain().focus().command(({ tr }) => {
        doc.descendants((node, pos) => {
          if (!node.isText) return;
          const mark = node.marks.find(
            (m) => m.type === markType && m.attrs.noteId === existingNoteId,
          );
          if (mark) {
            tr.removeMark(pos, pos + node.nodeSize, mark);
          }
        });
        return true;
      }).run();
    }
    deleteNote(existingNoteId);
    onClose();
  };

  const handleSpellSuggestion = (suggestion: string) => {
    if (!spellInfo) return;
    editor.chain().focus().command(({ tr }) => {
      tr.insertText(suggestion, spellInfo.from, spellInfo.to);
      return true;
    }).run();
    onClose();
    setTimeout(triggerSpellRecheck, 200);
  };

  const handleSpellIgnore = () => {
    if (!spellInfo) return;
    spellChecker.ignoreWord(spellInfo.word);
    onClose();
    triggerSpellRecheck();
  };

  const handleSpellAddDictTo = useCallback((target: string) => {
    if (!spellInfo) return;
    if (target === PROJECT_DICT_TARGET) {
      spellChecker.addToProjectDictionary(spellInfo.word);
    } else {
      appendWordToGlobalDictionary(target, spellInfo.word);
    }
    onClose();
    triggerSpellRecheck();
  }, [spellInfo, onClose, triggerSpellRecheck]);

  const handleSpellAddDict = () => {
    if (!spellInfo) return;
    const targets = spellChecker.getActiveAddTargets();
    if (targets.length === 0) {
      // Fallback: project. Stores even if currently disabled — re-enabling later restores.
      spellChecker.addToProjectDictionary(spellInfo.word);
      onClose();
      triggerSpellRecheck();
      return;
    }
    if (targets.length === 1) {
      handleSpellAddDictTo(targets[0]);
      return;
    }
    setAddDictSubOpen((v) => !v);
  };

  // ── Grammar (writing-suggestion) handlers ──

  const triggerGrammarRecheck = useCallback(() => {
    const tr = editor.state.tr.setMeta(grammarPluginKey, { rescanAll: true });
    editor.view.dispatch(tr);
  }, [editor]);

  const handleGrammarSuggestion = (suggestion: string) => {
    if (!grammarInfo) return;
    editor.chain().focus().command(({ tr }) => {
      tr.insertText(suggestion, grammarInfo.from, grammarInfo.to);
      return true;
    }).run();
    onClose();
  };

  const handleGrammarIgnoreOnce = () => {
    if (!grammarInfo) return;
    const start = Math.max(0, grammarInfo.from - 30);
    const end = Math.min(editor.state.doc.content.size, grammarInfo.to + 30);
    const text = editor.state.doc.textBetween(start, end, ' ');
    const localIdx = grammarInfo.from - start;
    const len = grammarInfo.to - grammarInfo.from;
    const ctxKey = GrammarIgnore.buildContextKey(text, localIdx, len);
    grammarIgnore.ignoreOnce(grammarInfo.ruleId, ctxKey);
    onClose();
    triggerGrammarRecheck();
  };

  const handleGrammarIgnoreRuleForDoc = () => {
    if (!grammarInfo) return;
    grammarIgnore.ignoreRuleForDoc(grammarInfo.ruleId);
    onClose();
    triggerGrammarRecheck();
  };

  const handleGrammarDisableRule = () => {
    if (!grammarInfo) return;
    setGrammarRuleEnabled(grammarInfo.ruleId, false);
    onClose();
    // Store subscriber inside Grammar extension triggers a rescan automatically.
  };

  // ── Tag handlers ──
  const handleTagAs = () => {
    const { from, to, empty } = savedSelection.current;
    const selFrom = empty ? $from.start() : from;
    const selTo = empty ? $from.end() : to;
    const text = editor.state.doc.textBetween(selFrom, selTo, ' ');

    let sceneId: string | null = null;
    let sceneIdx = 0;
    editor.state.doc.nodesBetween(0, selFrom, (node) => {
      if (node.type.name === 'sceneHeading') { sceneId = `scene-${sceneIdx}`; sceneIdx++; }
      return true;
    });

    setPendingTagSelection({ from: selFrom, to: selTo, text: text.slice(0, 80), elementType: currentNodeType, sceneId });
    useEditorStore.getState().openTool('tags');
    onClose();
  };



  const handleRemoveTag = () => {
    if (!existingTagInfo) return;
    const { doc, schema } = editor.state;
    const markType = schema.marks.productionTag;
    if (!markType) { onClose(); return; }

    // Find and remove only the mark at the cursor position
    const cursorPos = editor.state.selection.$from.pos;
    editor.chain().focus().command(({ tr }) => {
      doc.descendants((node, pos) => {
        if (!node.isText) return;
        const mark = node.marks.find(
          (m) => m.type === markType && m.attrs.tagId === existingTagInfo.tagId,
        );
        if (mark && pos <= cursorPos && pos + node.nodeSize >= cursorPos) {
          tr.removeMark(pos, pos + node.nodeSize, mark);
        }
      });
      return true;
    }).run();

    // Count remaining occurrences; if none left, delete the entity
    let remaining = 0;
    editor.state.doc.descendants((node) => {
      if (!node.isText) return;
      if (node.marks.some((m) => m.type === markType && m.attrs.tagId === existingTagInfo.tagId)) {
        remaining++;
      }
    });
    if (remaining === 0) {
      deleteTag(existingTagInfo.tagId);
    }
    onClose();
  };

  const handleRevisionColor = (color: string) => {
    setRevisionColor(color);
    setRevisionSubOpen(false);
    onClose();
  };

  // v0.86: the right-click menu is rendered from an ORDERED map rather than a
  // fixed run of JSX. Customize > Context Menu can now reorder and add/remove
  // items, and that ordering has to reach the actual menu — which is impossible
  // while each section is hardcoded in place. Contextual conditions (only show
  // Scene Properties on a scene heading, etc.) still apply on top.
  const ctxSections: Record<string, React.ReactNode> = {
    element: (<><>
      <div
        className="ctx-has-sub-wrap"
        onPointerEnter={(e) => { if (e.pointerType === 'mouse') { setElementSubOpen(true); setStyleSubOpen(false); setRevisionSubOpen(false); } }}
        onPointerLeave={(e) => { if (e.pointerType === 'mouse') setElementSubOpen(false); }}
      >
        <div className="ctx-item ctx-has-sub" onClick={() => { setElementSubOpen(true); setStyleSubOpen(false); setRevisionSubOpen(false); }}>
          <span>Element</span>
          <span className="ctx-arrow">&#9656;</span>
        </div>
        {elementSubOpen && (
          <div className="ctx-submenu">
            {/* v0.81: driven by the EFFECTIVE rules so hiding or reordering an
                element in Customize > Elements updates this menu too — it used
                to walk its own hardcoded ELEMENT_MENU_ITEMS order and only
                checked the raw template's `enabled`. */}
            {orderedElementItems
              .map(({ type, label, shortcut }) => (
              <div
                key={type}
                className={`ctx-item${currentNodeType === type ? ' ctx-active' : ''}`}
                onClick={() => handleSetElement(type)}
              >
                <span>{ELEMENT_LABELS[type] || label}</span>
                {shortcut && <span className="ctx-shortcut">{shortcut}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      </></>),
    style: (<><>
      <div
        className="ctx-has-sub-wrap"
        onPointerEnter={(e) => { if (e.pointerType === 'mouse') { setStyleSubOpen(true); setElementSubOpen(false); setRevisionSubOpen(false); } }}
        onPointerLeave={(e) => { if (e.pointerType === 'mouse') setStyleSubOpen(false); }}
      >
        <div className="ctx-item ctx-has-sub" onClick={() => { setStyleSubOpen(true); setElementSubOpen(false); setRevisionSubOpen(false); }}>
          <span>Style</span>
          <span className="ctx-arrow">&#9656;</span>
        </div>
        {styleSubOpen && (
          <div className="ctx-submenu">
            <div className={`ctx-item${locked.bold ? ' ctx-disabled' : ''}${editor.isActive('bold') ? ' ctx-active' : ''}`} onClick={() => { if (!locked.bold) handleBold(); }}>
              <span>Bold</span>
              <span className="ctx-shortcut">{mod}B</span>
            </div>
            <div className={`ctx-item${locked.italic ? ' ctx-disabled' : ''}${editor.isActive('italic') ? ' ctx-active' : ''}`} onClick={() => { if (!locked.italic) handleItalic(); }}>
              <span>Italic</span>
              <span className="ctx-shortcut">{mod}I</span>
            </div>
            <div className={`ctx-item${locked.underline ? ' ctx-disabled' : ''}${editor.isActive('underline') ? ' ctx-active' : ''}`} onClick={() => { if (!locked.underline) handleUnderline(); }}>
              <span>Underline</span>
              <span className="ctx-shortcut">{mod}U</span>
            </div>
            <div className={`ctx-item${locked.strikethrough ? ' ctx-disabled' : ''}${editor.isActive('strike') ? ' ctx-active' : ''}`} onClick={() => { if (!locked.strikethrough) handleStrike(); }}>
              <span>Strikethrough</span>
            </div>
            <div className="ctx-separator" />
            <div className={`ctx-item${locked.subscript ? ' ctx-disabled' : ''}${editor.isActive('subscript') ? ' ctx-active' : ''}`} onClick={() => { if (!locked.subscript) handleSubscript(); }}>
              <span>Subscript</span>
            </div>
            <div className={`ctx-item${locked.superscript ? ' ctx-disabled' : ''}${editor.isActive('superscript') ? ' ctx-active' : ''}`} onClick={() => { if (!locked.superscript) handleSuperscript(); }}>
              <span>Superscript</span>
            </div>
            <div className="ctx-separator" />
            <div className={`ctx-item${locked.textTransform ? ' ctx-disabled' : ''}`} onClick={() => { if (!locked.textTransform) handleAllCaps(); }}>
              <span>ALL CAPS</span>
            </div>
          </div>
        )}
      </div>

      </></>),
    font: (<><div className={`ctx-item${locked.fontFamily ? ' ctx-disabled' : ''}`} onClick={() => { if (!locked.fontFamily) { onOpenFormatPanel(); onClose(); } }}>
          <span>Font...</span>
        </div></>),
    sceneProperties: showSceneProps ? (<><div className="ctx-item ctx-disabled">
          <span>Scene Properties...</span>
        </div></>) : null,
    characterProfile: showCharProfile ? (<><div className="ctx-item" onClick={() => {
          if (!characterProfilesOpen) toggleCharacterProfiles();
          onClose();
        }}>
          <span>Character Profile...</span>
        </div></>) : null,
    revisionMode: (<><div className="ctx-item" onClick={() => { setRevisionMode(!revisionMode); onClose(); }}>
        <span>{revisionMode ? '\u2713 ' : ''}Revision Mode</span>
      </div></>),
    revisionColor: (<><div
        className="ctx-has-sub-wrap"
        onPointerEnter={(e) => { if (e.pointerType === 'mouse') { setRevisionSubOpen(true); setElementSubOpen(false); setStyleSubOpen(false); } }}
        onPointerLeave={(e) => { if (e.pointerType === 'mouse') setRevisionSubOpen(false); }}
      >
        <div className="ctx-item ctx-has-sub" onClick={() => { setRevisionSubOpen(true); setElementSubOpen(false); setStyleSubOpen(false); }}>
          <span>Revision Color</span>
          <span className="ctx-arrow">&#9656;</span>
        </div>
        {revisionSubOpen && (
          <div className="ctx-submenu ctx-submenu-colors">
            {REVISION_COLORS.map((color) => (
              <div
                key={color}
                className={`ctx-item${revisionColor === color ? ' ctx-active' : ''}`}
                onClick={() => handleRevisionColor(color)}
              >
                <span className="ctx-color-swatch" data-color={color.toLowerCase().replace(/\s/g, '-')} />
                <span>{color}</span>
              </div>
            ))}
          </div>
        )}
      </div></>),
    addScriptNote: (<><>
      {existingNoteId ? (
        <>
          <div className="ctx-item" onClick={handleEditScriptNote}>
            <span>Edit Script Note</span>
          </div>
          <div className="ctx-item" onClick={handleDeleteScriptNote}>
            <span>Delete Script Note</span>
          </div>
        </>
      ) : (
        <div className="ctx-item" onClick={handleAddScriptNote}>
          <span>Add Script Note</span>
          <span className="ctx-shortcut">{shift}{mod}N</span>
        </div>
      )}
      <div className="ctx-separator" />

      </></>),
    copyToSnippets: hasSelection ? (<><div className="ctx-item" onClick={() => {
            const { from, to } = savedSelection.current;
            const text = editor.state.doc.textBetween(from, to, '\n');
            if (text.trim()) {
              addShelfCard({ id: uuid(), type: 'snippet', color: '#f4d35e', text: text.trim(), createdAt: new Date().toISOString() });
              useEditorStore.getState().openTool('fragments');
              showToast('Copied to Snippets', 'success');
            }
            onClose();
          }}>
            <span>Copy to Snippets</span>
          </div></>) : null,
    insertSection: (<><div className="ctx-item" onClick={() => {
        editor.chain().focus().insertContent({ type: 'general', content: [{ type: 'text', text: '# ' }] }).run();
        onClose();
      }}>
        <span>Insert Section</span>
      </div></>),
    insertMarker: (<><div className="ctx-item" onClick={() => {
        editor.chain().focus().insertContent({ type: 'general', content: [{ type: 'text', text: '\u2691 ' }] }).run();
        onClose();
      }}>
        <span>Insert Marker</span>
      </div></>),
    insertChecklist: (<><div className="ctx-item" onClick={() => {
        editor.chain().focus().insertContent({ type: 'general', content: [{ type: 'text', text: '[ ] ' }] }).run();
        onClose();
      }}>
        <span>Add To-Do List</span>
      </div></>),
    tagAs: (<><>
      {existingTagInfo ? (
        <>
          <div className="ctx-item" onClick={() => {
            if (existingTagInfo) {
              setEditingTagId(existingTagInfo.tagId);
            }
            useEditorStore.getState().openTool('tags');
            onClose();
          }}>
            <span>Edit Tag...</span>
          </div>
          <div className="ctx-item" onClick={handleRemoveTag}>
            <span>Remove Tag</span>
          </div>
        </>
      ) : (
        <div className="ctx-item" onClick={handleTagAs}>
          <span>Tag as...</span>
        </div>
      )}
      <div className="ctx-separator" />

      </></>),
    spelling: (<><>
      {spellInfo && (() => {
        const activeAddTargets = spellChecker.getActiveAddTargets();
        const multipleTargets = activeAddTargets.length > 1;
        return (
          <>
            <div className="ctx-item" onClick={handleSpellIgnore}>
              <span>Ignore Spelling</span>
            </div>
            <div
              className="ctx-item"
              onMouseEnter={() => multipleTargets && setAddDictSubOpen(true)}
              onMouseLeave={() => multipleTargets && setAddDictSubOpen(false)}
              onClick={handleSpellAddDict}
              style={multipleTargets ? { position: 'relative' } : undefined}
            >
              <span>Add to Dictionary{multipleTargets ? '…' : ''}</span>
              {multipleTargets && (
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--fd-text-muted)' }}>▸</span>
              )}
              {multipleTargets && addDictSubOpen && (
                <div className="ctx-submenu" style={{ left: '100%', top: 0 }}>
                  {activeAddTargets.map((t) => {
                    const label = t === PROJECT_DICT_TARGET ? 'Project dictionary' : t;
                    return (
                      <div
                        key={t}
                        className="ctx-item"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSpellAddDictTo(t);
                        }}
                      >
                        <span>{label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        );
      })()}
      </></>),
  };

  // The user's order, hidden items removed. Anything not yet in their saved
  // order (e.g. a section added in a later version) keeps its default place.
  const orderedCtxIds = (() => {
    const known = CONTEXT_MENU_SECTIONS.map((x) => x.id);
    const ordered = contextMenuOrder.filter((id) => known.includes(id));
    const rest = known.filter((id) => !ordered.includes(id));
    return [...ordered, ...rest].filter((id: string) => !contextMenuHidden.includes(id));
  })();

  return (
    <div
      ref={menuRef}
      className="script-context-menu"
      style={{ top: adjustedPos.y, left: adjustedPos.x }}
    >
      {/* Spelling suggestions at top (if misspelled word) */}
      {spellInfo && (
        <>
          {spellInfo.suggestions.length > 0 ? (
            spellInfo.suggestions.slice(0, 5).map((s) => (
              <div
                key={s}
                className="ctx-item ctx-spell-suggestion"
                onClick={() => handleSpellSuggestion(s)}
              >
                {s}
              </div>
            ))
          ) : (
            <div className="ctx-item ctx-disabled">No suggestions</div>
          )}
          <div className="ctx-separator" />
        </>
      )}

      {/* Grammar / writing suggestions */}
      {grammarInfo && (
        <>
          <div className="ctx-item ctx-disabled" style={{ fontSize: 11, opacity: 0.7 }}>
            {RETEXT_CATEGORY_META[grammarInfo.ruleId as keyof typeof RETEXT_CATEGORY_META]?.label ?? grammarInfo.ruleId}: {grammarInfo.message}
          </div>
          {grammarInfo.suggestions.length > 0 ? (
            grammarInfo.suggestions.slice(0, 5).map((s) => (
              <div
                key={s}
                className="ctx-item ctx-spell-suggestion"
                onClick={() => handleGrammarSuggestion(s)}
              >
                {s}
              </div>
            ))
          ) : (
            <div className="ctx-item ctx-disabled">No automatic replacement</div>
          )}
          <div className="ctx-item" onClick={handleGrammarIgnoreOnce}>Ignore Once</div>
          <div className="ctx-item" onClick={handleGrammarIgnoreRuleForDoc}>Ignore in Document</div>
          <div className="ctx-item" onClick={handleGrammarDisableRule}>Disable Rule</div>
          <div className="ctx-separator" />
        </>
      )}

      {/* Undo / Redo */}
      <div className="ctx-item" onClick={handleUndo}>
        <span>Undo</span>
        <span className="ctx-shortcut">{mod}Z</span>
      </div>
      <div className="ctx-item" onClick={handleRedo}>
        <span>Redo</span>
        <span className="ctx-shortcut">{shift}{mod}Z</span>
      </div>
      <div className="ctx-separator" />

      
      {/* Clipboard */}
      <div className={`ctx-item${!hasSelection ? ' ctx-disabled' : ''}`} onClick={handleCut}>
        <span>Cut</span>
        <span className="ctx-shortcut">{mod}X</span>
      </div>
      <div className={`ctx-item${!hasSelection ? ' ctx-disabled' : ''}`} onClick={handleCopy}>
        <span>Copy</span>
        <span className="ctx-shortcut">{mod}C</span>
      </div>
      <div className="ctx-item" onClick={handlePaste}>
        <span>Paste</span>
        <span className="ctx-shortcut">{mod}V</span>
      </div>
      <div className="ctx-item" onClick={handlePasteWithoutFormatting}>
        <span>Paste Without Formatting</span>
        <span className="ctx-shortcut">{shift}{mod}V</span>
      </div>
      <div className="ctx-separator" />

      
      {/* Selection */}
      <div className="ctx-item" onClick={handleSelectAll}>
        <span>Select All</span>
        <span className="ctx-shortcut">{mod}A</span>
      </div>
      {onAnElement && (
        <div className="ctx-item" onClick={handleDeleteElement}>
          <span>Delete Element</span>
        </div>
      )}
      <div className={`ctx-item${!hasSelection ? ' ctx-disabled' : ''}`} onClick={handleDelete}>
        <span>Delete</span>
      </div>
      <div className="ctx-separator" />

      
      {/* Element submenu */}
      {orderedCtxIds.map((id) => (
        <React.Fragment key={id}>{ctxSections[id]}</React.Fragment>
      ))}

      {/* Permanent — never hidden, so the menu can always be customized back. */}
      <div className="ctx-separator" />
      <div
        className="ctx-item"
        onClick={() => {
          window.dispatchEvent(new CustomEvent('freedraft:command', { detail: 'customizeContextMenu' }));
          onClose();
        }}
      >
        <span>Customize Context Menu...</span>
      </div>

    </div>
  );
};

export default ScriptContextMenu;
