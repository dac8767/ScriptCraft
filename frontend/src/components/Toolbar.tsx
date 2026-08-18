import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Editor } from '@tiptap/react';
import {
  FaBold,
  FaItalic,
  FaUnderline,
  FaStrikethrough,
  FaSubscript,
  FaSuperscript,
  FaAlignLeft,
  FaAlignCenter,
  FaAlignRight,
  FaAlignJustify,
  FaUndo,
  FaRedo,
  FaStickyNote,
  FaTags,
  FaHighlighter,
  FaEllipsisV,
  FaHashtag,
  FaFileAlt, FaRegFileAlt,
  FaMarker,
} from 'react-icons/fa';
import { LuSearch } from 'react-icons/lu';
import { ALL_TOOLS } from './ToolDock';
import { CirclePlusIcon, TOOLBAR_ICONS } from './uiIcons';
import { useNotebookStore } from '../stores/notebookStore';
import { useSettingsStore } from '../stores/settingsStore';
import { applyScrapbookTextFormat } from './NotebookTool';
import { chromePx, chromeScaleFactor } from './chromeSizes';
import { confirmDialog } from './ConfirmDialog';
import { commandDef, type ToolbarCommand } from './toolbarCommands';
import { resolvePickedElement } from './screenplayEditorConstants';
import { BUILTIN_BY_KEY, DEFAULT_TOOLBAR_LEFT, DEFAULT_TOOLBAR_RIGHT, normalizeToolbarZones, stripTall, parseRibbon, ribbonKindVars } from './toolbarBuiltins';
import { smartUndo, smartRedo, useEditorStore } from '../stores/editorStore';
import { useWindowUndoStore } from '../stores/windowUndoStore';
import { createScriptNoteAtSelection } from '../utils/scriptNoteActions';
import { createMarkupAtSelection } from '../utils/markupActions';
import { insertCustomPage } from '../editor/extensions';
import { GoalChip, useGoalWords } from './GoalsTool';
import { showTitleBar } from './TitleBar';
import { AnnotationShowMenu } from './MarkupPickers';
import type { ElementType } from '../stores/editorStore';
import { useFormattingTemplateStore } from '../stores/formattingTemplateStore';
import { BUILT_IN_ELEMENT_IDS } from '../stores/formattingTypes';
import {
  getCurrentElementRule,
  toggleBoldOverride,
  toggleItalicOverride,
  toggleUnderlineOverride,
} from '../utils/effectiveFormatting';
import FontPicker from './FontPicker';
import ColorPicker from './ColorPicker';
import ZoomControl from './ZoomControl';
import InsertTableControl from './InsertTableControl';
import TextColorControl from './TextColorControl';
import { useCursorFormatting } from '../hooks/useCursorFormatting';
import { FONT_REGISTRY, loadFont } from '../utils/fonts';


interface ToolbarProps {
  editor: Editor | null;
}

/** A pinned command as a ribbon cell. Its own component so TOGGLE commands can
 *  SUBSCRIBE to their on-state (v4.71, Derek: active toggles highlight, with
 *  the same .active class the formatting builtins use). Every instance calls
 *  the one hook — commands without an active selector just never light up. */
const NEVER_ACTIVE = () => false;
function RibbonCommandButton({ cmd, tall }: { cmd: ToolbarCommand; tall: boolean }) {
  const active = useEditorStore(cmd.active ?? NEVER_ACTIVE);
  // v3.48, Derek: blur after running so a command button (e.g. Fit) doesn't
  // keep the focus ring lit blue — it's a one-shot action, not a toggle.
  const runCmd = (e: React.MouseEvent) => { cmd.run(); (e.currentTarget as HTMLElement).blur(); };
  return tall ? (
    <button className={`toolbar-btn rib-tall rib-tall-btn${active ? ' active' : ''}`} title={cmd.label} data-key={cmd.id} onClick={runCmd}>
      <span className="rib-tall-icon">{cmd.icon}</span>
      <span className="rib-tall-label">{cmd.label}</span>
    </button>
  ) : (
    <button className={`toolbar-btn${active ? ' active' : ''}`} title={cmd.label} data-key={cmd.id} onClick={runCmd}>
      {cmd.icon}
    </button>
  );
}

const FONT_SIZES = [8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72, 96];

// Priority groups — higher number = hidden first when toolbar shrinks.
// Priority 1 = zoom-out (just the minus button area)
// Priority 2 = zoom/goto/search
// Priority 3 = alignment buttons
// Priority 4 = font style & colors (bold/italic/underline/strike/sub/super + colors + language)
// Priority 5 = font face & size
const Toolbar: React.FC<ToolbarProps> = ({ editor }) => {
  // v6.15: the ribbon-mounted goal readout (Show in: Toolbar).
  const goalShowIn = useEditorStore((st) => st.goalShowIn);
  // v6.77: the window-action undo lane lights the Undo/Redo buttons too —
  // subscribed (not getState) so a Reset landing on the stack re-renders us.
  const winUndoCount = useWindowUndoStore((s) => s.undoStack.length);
  const winRedoCount = useWindowUndoStore((s) => s.redoStack.length);
  const goalChipWords = useGoalWords(editor);
  const {
    activeElement,
    setActiveElement,
    viewStyle, setViewStyle,
    zoomPanelOpen,
    setZoomPanelOpen,
    setFontFamily,
    setFontSize,
    setSearchOpen,
    setGoToPageOpen,
    activeToolRight,
    toolbarPinnedTools,
    previewMode,
    openTool,
    toggleTool,
    tagsPanelOpen,
    toggleTagsPanel,
    setPendingTagSelection,
    setEditingTagId,
    toolbarMode, chromeCustomPx, chromeGapPx,
    outlineBarOpen,
    markupsVisible,
    uiResizeLocked,
    toolbarDdWidths,
    toolbarHighlighted,
  } = useEditorStore();

  // v2.07: while the Scrapbook is open, the toolbar's own formatting buttons
  // drive the focused text box (execCommand) instead of the script editor —
  // no duplicate B/I/U/S anywhere. Declared up here because the responsive
  // overflow measurement (below) also re-measures on this flag (v2.10).
  const scrapbookOpen = useNotebookStore((s) => s.notebookOpen);
  // v2.94: the Insert Table button needs a page to land the table on — the
  // old menu item was disabled without one, and firing the event with no
  // canvas mounted is a silent no-op.

  const activeTemplate = useFormattingTemplateStore((s) => s.getActiveTemplate());

  // v0.71: element visibility/order come from the user's persisted overrides

  // applied over the active template (system templates are immutable).

  const pickableElements = useFormattingTemplateStore((st) => st.getPickableElements)();
  useFormattingTemplateStore((st) => st.elementHidden);
  useFormattingTemplateStore((st) => st.elementOrder);

  useFormattingTemplateStore((st) => st.elementHidden);   // re-render on change

  useFormattingTemplateStore((st) => st.elementOrder);
  const isOverrideMode = activeTemplate.mode === 'override';

  // v4.22, Derek: the Editor View dropdown's options are customizable
  // (Customize ▸ Editor). Subscribe to the order/hidden so the dropdown updates.
  const evOrder = useSettingsStore((s) => s.editorViewOrder);
  const evHidden = useSettingsStore((s) => s.editorViewHidden);
  void evOrder; void evHidden;
  const editorViews = useSettingsStore.getState().getEffectiveEditorViews();

  // v3.37, Derek: the on-bar "+ Add" menu — utilities are added from the bar
  // itself now. { at: section-boundary index, rightSide, x, y for the popup }.
  // v4.22, Derek: `sec` (when set) routes the add menu to a SPECIFIC section —
  // items/divider/spacer land inside it, sections/split insert right after it —
  // instead of the old left/right boundary guess. `at`/`rightSide` still drive
  // the empty-bar bootstrap +Add.

  // v7.48: what the pickers should be showing for the current selection —
  // which attributes the template locks, the cursor's font and size, and any
  // font the document carries that the registry does not list. All four are
  // read by several cases in renderBuiltinControl AND by the Scrapbook
  // branches above it, which is why the engine is a shared hook rather than
  // state inside any one control.
  const { locked, cursorFont, cursorSize, extraFonts } = useCursorFormatting(editor);

  // v7.47: the SCRIPT text-colour picker's state moved to TextColorControl.
  // What is left here is the Scrapbook's, which is a different control against
  // a different document — they shared one open flag until v7.47 purely because
  // both were rendered by renderBuiltinControl, and that cost a real edge:
  // opening the Scrapbook picker and closing the Scrapbook left the script's
  // picker looking already open.
  const [sbTextColorOpen, setSbTextColorOpen] = useState(false);
  // v2.69: the Scrapbook's text-background picker. Its swatch clicks move
  // focus out of the contentEditable, so the selection is captured on the
  // button's mousedown and restored before the execCommand runs.
  const [sbBgOpen, setSbBgOpen] = useState(false);
  const sbBgRange = useRef<Range | null>(null);
  // v3.87: the font shown in the Scrapbook's Font picker. It tracked the SCRIPT
  // editor's cursor font (always Courier Prime while a box is open); now it
  // follows the selection inside the box and the last font you pick.
  const [sbFont, setSbFont] = useState<string>('');
  // v1.83: the highlighter color is store state — Format > Highlighting shares it.




  const handleElementChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const picked = e.target.value;
    if (!editor) return;

    // Dual Dialogue is a structure, not a paragraph type — it runs its command
    // rather than setting a node type (v0.84).
    if (picked === 'dualDialogue') {
      (editor as unknown as { commands: { toggleDualDialogue: () => boolean } })
        .commands.toggleDualDialogue();
      return;
    }

    // v4.84, Derek: "Dialogue" starts at the character name — the SAME
    // resolver the element picker and the Insert menu use, so one pick means
    // one thing everywhere.
    const { $from } = editor.state.selection;
    const prevNode = $from.depth > 0 && $from.index($from.depth - 1) > 0
      ? $from.node($from.depth - 1).child($from.index($from.depth - 1) - 1)
      : null;
    const type = resolvePickedElement(picked, prevNode?.type.name ?? null);

    setActiveElement(type as ElementType);
    // Three cases:
    //   1. Built-in script element (sceneHeading, action, etc.) — direct setNode
    //   2. Real schema node not in BUILT_IN list (avPara, avShot, avDirection) — also direct setNode
    //   3. Template-declared custom id (sceneCharacters, soundEffect, etc.) — wrap as customElement
    if (BUILT_IN_ELEMENT_IDS.includes(type)) {
      editor.chain().focus().setNode(type).run();
      return;
    }
    if (editor.schema.nodes[type]) {
      editor.chain().focus().setNode(type).run();
      return;
    }
    const rule = activeTemplate.rules[type];
    if (rule) {
      editor.chain().focus().setNode('customElement', {
        customTypeId: type,
        customLabel: rule.label,
      }).run();
    }
  };

  /** True when the selection is inside an AV cell — used to scope the element dropdown. */
  const isInsideAvCell = React.useMemo(() => {
    if (!editor) return false;
    try {
      const { $from } = editor.state.selection;
      for (let d = $from.depth; d >= 0; d--) {
        if ($from.node(d).type.name === 'avCell') return true;
      }
    } catch { /* ignore */ }
    return false;
  // Re-evaluate on selection updates
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, activeElement]);

  /** Element ids valid inside an AV cell (per the avCell schema content rule). */
  const AV_CELL_ELEMENT_IDS = ['avPara', 'avShot', 'avDirection'];

  // v5.41, Derek: "formatting options in the ribbon should be usable for
  // the annotation window." While it's open, its mini editor is registered
  // here and the B/I/U/S buttons read and drive IT instead of the script.
  const miniEd = useEditorStore((s) => s.markupMiniEditor) as Editor | null;

  const isActive = (format: string) => {
    if (miniEd) return miniEd.isActive(format);
    if (!editor) return false;
    return editor.isActive(format);
  };

  // ── Responsive overflow ──────────────────────────────────────────────
  const toolbarRef = useRef<HTMLDivElement>(null);

  // v2.72, Derek: the toolbar's first icon lines up under the menu bar's
  // first icon. The offset depends on both bars' size modes and scales, so
  // it's MEASURED from the rendered icons (both are inline SVGs — no font
  // timing) instead of hand-synced constants. Runs after every render; the
  // <1px guard makes it converge instead of loop.
  const [alignPad, setAlignPad] = useState<number | null>(null);
  useEffect(() => {
    const bar = toolbarRef.current;
    if (!bar) return;
    const measure = () => {
      // v2.80, Derek: align the actual icon IMAGES, not the boxes around
      // them — both sides measure the rendered <svg> glyph itself.
      const menuIcon = document.querySelector('.menu-bar .menu-item .menu-icon svg')
        ?? document.querySelector('.menu-bar .menu-item .menu-icon');
      const firstIcon = bar.querySelector('.toolbar-btn svg') ?? bar.querySelector('.toolbar-btn');
      if (!menuIcon || !firstIcon) { setAlignPad(null); return; }
      const mi = (menuIcon as HTMLElement).getBoundingClientRect();
      const ti = (firstIcon as HTMLElement).getBoundingClientRect();
      if (mi.width === 0 || ti.width === 0) return;   // hidden bar — leave as is
      const currentPad = parseFloat(getComputedStyle(bar).paddingLeft) || 0;
      const pad = Math.max(0, Math.round(currentPad + (mi.left - ti.left)));
      setAlignPad((prev) => (prev !== null && Math.abs(prev - pad) < 1 ? prev : pad));
    };
    const raf = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', measure); };
  });
  const [hiddenPriorities, setHiddenPriorities] = useState<Set<string>>(new Set());
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);

  // Close overflow menu on outside click
  useEffect(() => {
    if (!overflowOpen) return;
    const handler = (e: MouseEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setOverflowOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [overflowOpen]);

  // Measure toolbar overflow. v4.23: width overflow now scrolls (see CSS); this
  // only routes CSS-hidden (mobile-only) sections into the overflow menu.
  useEffect(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar) return;

    const measure = () => {
      const groups = Array.from(toolbar.querySelectorAll<HTMLElement>('[data-priority]'));
      if (groups.length === 0) return;

      // Show all groups to measure the natural layout
      groups.forEach(g => { g.style.display = ''; });

      const newHidden = new Set<string>();
      for (const g of groups) {
        // CSS-hidden items (e.g. toolbar-desktop-only on mobile) have 0 width —
        // mark them as hidden so they appear in the overflow menu.
        if (g.offsetWidth === 0) newHidden.add(g.dataset.priority!);
      }

      // v4.23, Derek: a narrow window no longer HIDES sections into the overflow
      // menu (which "squished" the bar as groups vanished). The ribbon scrolls
      // horizontally instead (see .toolbar-ribbon overflow-x in 03-toolbar.css),
      // exactly like Customize/edit mode already did — spacing stays constant
      // and off-screen sections are reached by scrolling. The overflow menu now
      // only carries CSS-hidden (mobile-only) items, detected above.

      setHiddenPriorities(prev => {
        if (prev.size !== newHidden.size) return newHidden;
        for (const p of newHidden) { if (!prev.has(p)) return newHidden; }
        return prev;
      });
    };

    let rafId = 0;
    let lastWidth = 0;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const w = Math.round(entry.contentRect.width);
      // Only re-measure if container width actually changed (not just internal reflow)
      if (w === lastWidth) return;
      lastWidth = w;
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(measure);
    });
    ro.observe(toolbar);
    requestAnimationFrame(measure);
    return () => { ro.disconnect(); cancelAnimationFrame(rafId); };
    // v2.10: the Scrapbook section appearing/disappearing changes CONTENT
    // width, which the container-width guard can't see — re-measure on
    // toggle or the collapse state computed for the other layout sticks.
  }, [scrapbookOpen]);

  const hasOverflow = hiddenPriorities.size > 0;

  // ── Notes handler (shared between inline and overflow) ──
  // v4.33: a script note is edited in the POPOVER on its highlight now (the
  // Notes window is general-only). On a noted range the button opens that
  // popover; on other text it creates the note (utils/scriptNoteActions —
  // one copy, shared with the context menu) and opens the popover; with
  // nothing to anchor to it opens the Notes window.
  const handleNotesClick = useCallback((e: React.PointerEvent | React.MouseEvent) => {
    e.preventDefault();
    const store = useEditorStore.getState();
    if (!editor) { store.openTool('sticky'); return; }

    // Detect if cursor is on an existing note
    const noteMarkType = editor.schema.marks.scriptNote;
    if (noteMarkType) {
      const $from = editor.state.selection.$from;
      let noteMark = $from.marks().find((m) => m.type === noteMarkType);
      if (!noteMark) {
        const node = $from.nodeAfter || $from.nodeBefore;
        if (node?.marks) noteMark = node.marks.find((m) => m.type === noteMarkType);
      }
      if (noteMark) {
        store.setNotePopoverId(noteMark.attrs.noteId as string);
        return;
      }
    }

    const noteId = createScriptNoteAtSelection(editor);
    if (noteId) store.setNotePopoverId(noteId);
    else store.openTool('sticky');
  }, [editor]);

  // ── Tags handler (shared between inline and overflow) ──
  const handleTagsClick = useCallback((e: React.PointerEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!editor) { toggleTagsPanel(); return; }

    const markType = editor.schema.marks.productionTag;
    if (markType) {
      const $from = editor.state.selection.$from;
      const storedMarks = $from.marks();
      let tagMark = storedMarks.find((m) => m.type === markType);
      if (!tagMark) {
        const node = $from.nodeAfter || $from.nodeBefore;
        if (node?.marks) tagMark = node.marks.find((m) => m.type === markType);
      }

      if (tagMark) {
        setEditingTagId(tagMark.attrs.tagId as string);
        openTool('tags');
        return;
      }
    }

    const { from, to, empty } = editor.state.selection;
    const $from = editor.state.selection.$from;
    const selFrom = empty ? $from.start() : from;
    const selTo = empty ? $from.end() : to;
    const text = editor.state.doc.textBetween(selFrom, selTo, ' ');

    if (text.trim()) {
      const currentNodeType = $from.parent.type.name;
      let sceneId: string | null = null;
      let sceneIdx = 0;
      editor.state.doc.nodesBetween(0, selFrom, (node) => {
        if (node.type.name === 'sceneHeading') { sceneId = `scene-${sceneIdx}`; sceneIdx++; }
        return true;
      });
      setPendingTagSelection({ from: selFrom, to: selTo, text: text.slice(0, 80), elementType: currentNodeType, sceneId });
      openTool('tags');
    } else {
      toggleTagsPanel();
    }
  }, [editor, tagsPanelOpen, toggleTagsPanel, setPendingTagSelection, setEditingTagId]);

  // ── Toolbar zones (v0.42: flat per-item tokens) ────────────────────────
  // Tokens: b:<key> built-in item · t:<toolId> pinned tool ·
  // c:<commandId> pinned command · d:<n> user divider. Right zone renders
  // after the flex spacer. Legacy g: group tokens and the retired
  // toolbarHiddenItems checkboxes migrate via normalizeToolbarZones.
  // NOTE: these hooks must stay ABOVE the toolbarMode early return below —
  // a hook after an early return crashes React when the toolbar is toggled
  // hidden ('Rendered fewer hooks than during the previous render').
  const { toolbarLeft, toolbarRight, setToolbarZones, toolbarZonesSet } = useEditorStore();
  // v5.50, Derek's crash report ("when i tried to hide the ribbon toolbar"):
  // these three lived ~900 lines below the toolbarMode==='hidden' early
  // return — hiding the ribbon changed the hook count and React threw
  // 'Rendered fewer hooks'. Hooks live ABOVE the return, per the NOTE above.
  const dzVars = useEditorStore((st) => st.designVars);
  const ribScaleTitledPct = useEditorStore((st) => st.ribScaleTitledPct);
  const ribScaleUntitledPct = useEditorStore((st) => st.ribScaleUntitledPct);
  // Explicit flag, not length>0 — 'Remove All' legitimately empties the zones
  // and must not re-trigger default seeding.
  const zonesReady = toolbarZonesSet;
  useEffect(() => {
    if (!zonesReady) {
      setToolbarZones(
        [...DEFAULT_TOOLBAR_LEFT, ...toolbarPinnedTools.map((id) => `t:${id}`)],
        DEFAULT_TOOLBAR_RIGHT,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zonesReady]);
  const zones = normalizeToolbarZones(
    zonesReady ? toolbarLeft : [...DEFAULT_TOOLBAR_LEFT, ...toolbarPinnedTools.map((id) => `t:${id}`)],
    zonesReady ? toolbarRight : DEFAULT_TOOLBAR_RIGHT,
  );
  // v2.95: one ribbon sequence — normalize folds any legacy right zone in.
  // v6.15, Derek ("a three-dot 'More format options' appeared and is not
  // removable"): the retired script-highlighter (v6.10) renders NOTHING
  // outside the Scrapbook, and its empty priority block measured as a
  // CSS-hidden item — which is exactly what summons the overflow menu. A
  // token whose control doesn't exist right now is filtered out entirely,
  // so nothing empty is ever measured.
  const leftTokens = scrapbookOpen
    ? zones.left
    : zones.left.filter((t) => t.replace(/^2!/, '') !== 'b:highlightColor');

  if (toolbarMode === 'hidden') return null;

  // Check if a given priority prefix has any collapsed items
  const isHidden = (prefix: string) => {
    for (const k of hiddenPriorities) { if (k.startsWith(prefix)) return true; }
    return false;
  };

  // ── Per-item built-in controls (v0.42) ──────────────────────────────────
  // Each built-in toolbar item renders independently (see toolbarBuiltins.ts).
  // inOverflow: overflow-menu copy. showPopups: suppress ColorPicker popups
  // on a collapsed inline copy so only the overflow copy owns popup state.
  const renderBuiltinControl = (key: string, inOverflow = false, showPopups = true): React.ReactNode => {
    // v2.07: exec-mappable formatting keys act on the Scrapbook's focused
    // contentEditable while it's open. mousedown-preventDefault keeps the
    // box's selection alive; same icon, same spot, different target.
    const SCRAPBOOK_EXEC: Record<string, string> = {
      bold: 'bold', italic: 'italic', underline: 'underline', strike: 'strikeThrough',
      alignLeft: 'justifyLeft', alignCenter: 'justifyCenter', alignRight: 'justifyRight', alignJustify: 'justifyFull',
    };
    if (scrapbookOpen && SCRAPBOOK_EXEC[key]) {
      return (
        <button
          className="toolbar-btn"
          title={`${BUILTIN_BY_KEY[key]?.label ?? key} (Scrapbook)`}
          // v3.86: route through the shared helper so it also PERSISTS the
          // change to the box's stored HTML (execCommand alone left it unsaved).
          onMouseDown={(e) => { e.preventDefault(); applyScrapbookTextFormat(SCRAPBOOK_EXEC[key]); }}
        >
          {TOOLBAR_ICONS[key]}
        </button>
      );
    }
    // v3.86, Derek: font family / size / colour must also act on the focused
    // Scrapbook text box (before, only B/I/U/align were wired — these fell
    // through to the script editor, which has no selection while a box is open).
    if (scrapbookOpen && key === 'fontFamily') {
      return (
        <div className="toolbar-group">
          <FontPicker
            // v3.87: show the Scrapbook's font (what you last applied), not the
            // script editor's cursor font, which stayed at Courier Prime.
            value={sbFont || cursorFont}
            extraFonts={extraFonts}
            onChange={(val) => {
              const entry = FONT_REGISTRY.find((f) => f.name === val);
              if (entry) loadFont(entry);
              setSbFont(val);
              applyScrapbookTextFormat('fontName', val);
              if (inOverflow) setOverflowOpen(false);
            }}
          />
        </div>
      );
    }
    if (scrapbookOpen && key === 'fontSize') {
      return (
        <select
          className="font-size-selector"
          value={cursorSize ?? ''}
          onChange={(e) => {
            if (e.target.value === '') return;
            applyScrapbookTextFormat('fontSizePx', `${Number(e.target.value)}pt`);
            if (inOverflow) setOverflowOpen(false);
          }}
          title="Font Size (Scrapbook)"
        >
          {cursorSize === null && <option value="" disabled hidden>—</option>}
          {(cursorSize !== null && !FONT_SIZES.includes(cursorSize)
            ? [...FONT_SIZES, cursorSize].sort((a, b) => a - b)
            : FONT_SIZES
          ).map((sz) => <option key={sz} value={sz}>{sz}pt</option>)}
        </select>
      );
    }
    if (scrapbookOpen && key === 'textColor') {
      return (
        <div className="toolbar-group" style={{ position: 'relative' }}>
          <button
            className="toolbar-btn"
            title="Text Color (Scrapbook)"
            onMouseDown={(e) => { e.preventDefault(); setSbTextColorOpen(!sbTextColorOpen); }}
          >
            {TOOLBAR_ICONS.textColor}
          </button>
          {showPopups && sbTextColorOpen && (
            <ColorPicker
              value=""
              onChange={(color) => {
                applyScrapbookTextFormat('foreColor', color || '#000000');
                setSbTextColorOpen(false);
              }}
              onClose={() => setSbTextColorOpen(false)}
            />
          )}
        </div>
      );
    }
    /* v2.69, Derek: pasted text can carry a background color with no way to
       change or clear it — while the Scrapbook is open, the highlight button
       becomes a text-BACKGROUND picker for the focused box ("None" clears). */
    if (scrapbookOpen && key === 'highlightColor') {
      return (
        <div className="toolbar-group" style={{ position: 'relative' }}>
          <button
            className="toolbar-btn"
            title="Text Background Color (Scrapbook) — None removes it"
            onMouseDown={(e) => {
              e.preventDefault();
              const sel = document.getSelection();
              sbBgRange.current = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
              setSbBgOpen(!sbBgOpen);
            }}
          >
            <FaHighlighter />
          </button>
          {showPopups && sbBgOpen && (
            <ColorPicker
              value=""
              onChange={(color) => {
                const sel = document.getSelection();
                if (sel && sbBgRange.current) { sel.removeAllRanges(); sel.addRange(sbBgRange.current); }
                document.execCommand('styleWithCSS', false, 'true');
                // 'transparent' clears — execCommand has no unset, so None
                // paints the no-color color.
                document.execCommand('hiliteColor', false, color || 'transparent');
                setSbBgOpen(false);
              }}
              onClose={() => setSbBgOpen(false)}
            />
          )}
        </div>
      );
    }
    switch (key) {
      /* v2.36: smart routing — if the newest change was a beat edit (e.g. a
         beat was just closed on the Outline), Undo restores IT. v6.77: the
         window-action lane (Reset helper text…) lights the button too. */
      case 'undo': {
        const st = useEditorStore.getState();
        const beatWins = st.canBeatUndo && st.lastBeatEditAt > st.lastDocEditAt;
        const winCan = winUndoCount > 0;
        return (
          <button
            className="toolbar-btn"
            title="Undo (⌘Z)"
            onClick={() => smartUndo(editor)}
            disabled={!beatWins && !winCan && (!editor || typeof (editor.can() as any).undo !== 'function' || !(editor.can() as any).undo())}
          >
            <FaUndo />
          </button>
        );
      }
      case 'redo': {
        const st = useEditorStore.getState();
        const beatWins = st.canBeatRedo && st.lastBeatEditAt > st.lastDocEditAt;
        const winCan = winRedoCount > 0;
        return (
          <button
            className="toolbar-btn"
            title="Redo (⇧⌘Z)"
            onClick={() => smartRedo(editor)}
            disabled={!beatWins && !winCan && (!editor || typeof (editor.can() as any).redo !== 'function' || !(editor.can() as any).redo())}
          >
            <FaRedo />
          </button>
        );
      }
      case 'element': return (
        <select
          className="element-selector"
          value={activeElement}
          onChange={handleElementChange}
          title="Element"
        >
          {/* v0.84: one canonical list (getPickableElements) shared with the
              Insert menu, the Enter-key picker and the right-click menu. */}
          {pickableElements
            // When inside an AV cell, only cell-valid types make sense — selecting
            // sceneHeading/action/etc. silently fails the schema check anyway.
            .filter((r) => isInsideAvCell ? AV_CELL_ELEMENT_IDS.includes(r.id) : !AV_CELL_ELEMENT_IDS.includes(r.id))
            .map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
      );
      /* (v5.51, Derek: insertSection / insertNote / insertChecklist are
         RETIRED — the legacy working-note ribbon buttons; stale layout
         tokens fall through to the unknown-key null.) */
      case 'markupScript': return (
        <button
          className="toolbar-btn"
          title="Add Annotation"
          onClick={() => { if (editor) createMarkupAtSelection(editor); }}
        >
          <FaMarker />
        </button>
      );
      /* v6.68, Derek: "This is a simple on or off toggle, like the toggle
         for the side panels, and the ribbon toolbar." It drives
         markupsVisible — the SAME state as View ▸ Annotations ▸ Show
         Annotations in Script and the Annotations window's Show button, so
         the three can never disagree. Icon carries the state (eye / crossed
         eye), the way the sizing lock swaps its padlock. */
      case 'viewAnnotations': return (
        <button
          className={`toolbar-btn${markupsVisible ? ' active' : ''}`}
          title={markupsVisible ? 'Hide annotations on the script' : 'Show annotations on the script'}
          onClick={() => useEditorStore.getState().setMarkupsVisible(!markupsVisible)}
        >{markupsVisible ? TOOLBAR_ICONS.viewAnnotations : TOOLBAR_ICONS.viewAnnotationsOff}</button>
      );
      // v5.28, Derek: a menu of which annotation types are visible on the
      // script — the same popover the Annotations window's Show button opens.
      // v6.68: renamed Annotation Filter — it filters by type and status;
      // plain on/off is the viewAnnotations button above.
      case 'annotationsMenu': return (
        <AnnotationShowMenu className="toolbar-btn" title="Annotation Filter">
          {TOOLBAR_ICONS.annotationsMenu}
        </AnnotationShowMenu>
      );
      // v5.40, Derek: custom pages — a non-script page at the cursor.
      case 'insertCustomPage': return (
        <button
          className="toolbar-btn"
          title="Insert Custom Page"
          onClick={() => { if (editor) insertCustomPage(editor); }}
        >
          <FaRegFileAlt />
        </button>
      );
      case 'titlePage': return (
        <button
          className="toolbar-btn"
          title="Title Page"
          onClick={() => { useEditorStore.getState().setTitlePageEditorOpen(true); if (inOverflow) setOverflowOpen(false); }}
        >
          <FaFileAlt />
        </button>
      );
      case 'fontFamily': return (
        <div className="toolbar-group" style={locked.fontFamily ? { opacity: 0.5, pointerEvents: 'none' } : undefined}>
          <FontPicker
            value={cursorFont}
            extraFonts={extraFonts}
            onChange={(val) => {
              if (locked.fontFamily) return;
              setFontFamily(val);
              const entry = FONT_REGISTRY.find(f => f.name === val);
              if (entry) loadFont(entry);
              const DEFAULT_FONTS = ['Courier Final Draft', 'Courier Prime', 'Courier New', 'Courier'];
              if (DEFAULT_FONTS.includes(val)) {
                editor?.chain().focus(undefined, { scrollIntoView: false }).setMark('textStyle', { fontFamily: null }).removeEmptyTextStyle().run();
              } else {
                editor?.chain().focus(undefined, { scrollIntoView: false }).setMark('textStyle', { fontFamily: val }).run();
              }
              if (inOverflow) setOverflowOpen(false);
            }}
          />
        </div>
      );
      case 'fontSize': return (
        <select
          className="font-size-selector"
          value={cursorSize ?? ''}
          disabled={locked.fontSize}
          onChange={(e) => {
            if (locked.fontSize) return;
            if (e.target.value === '') return; // user clicked the mixed placeholder — no-op
            const val = Number(e.target.value);
            setFontSize(val);
            if (val === 12) {
              editor?.chain().focus(undefined, { scrollIntoView: false }).setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run();
            } else {
              editor?.chain().focus(undefined, { scrollIntoView: false }).setFontSize(`${val}pt`).run();
            }
            if (inOverflow) setOverflowOpen(false);
          }}
          title="Font Size"
        >
          {/* Mixed-selection placeholder. */}
          {cursorSize === null && (
            <option value="" disabled hidden>—</option>
          )}
          {(cursorSize !== null && !FONT_SIZES.includes(cursorSize)
            ? [...FONT_SIZES, cursorSize].sort((a, b) => a - b)
            : FONT_SIZES
          ).map((sz) => (
            <option key={sz} value={sz}>
              {sz}pt
            </option>
          ))}
        </select>
      );
      case 'bold': return (
        <button
          className={`toolbar-btn ${isActive('bold') ? 'active' : ''}`}
          title="Bold (⌘B)"
          disabled={!miniEd && locked.bold}
          onClick={() => {
            // the annotation window has no templates/locks — plain toggle
            if (miniEd) { miniEd.chain().focus().toggleBold().run(); return; }
            if (!editor || locked.bold) return;
            if (isOverrideMode) {
              toggleBoldOverride(editor, getCurrentElementRule(editor, activeTemplate));
            } else {
              editor.chain().focus(undefined, { scrollIntoView: false }).toggleBold().run();
            }
          }}
        >
          <FaBold />
        </button>
      );
      case 'italic': return (
        <button
          className={`toolbar-btn ${isActive('italic') ? 'active' : ''}`}
          title="Italic (⌘I)"
          disabled={!miniEd && locked.italic}
          onClick={() => {
            if (miniEd) { miniEd.chain().focus().toggleItalic().run(); return; }
            if (!editor || locked.italic) return;
            if (isOverrideMode) {
              toggleItalicOverride(editor, getCurrentElementRule(editor, activeTemplate));
            } else {
              editor.chain().focus(undefined, { scrollIntoView: false }).toggleItalic().run();
            }
          }}
        >
          <FaItalic />
        </button>
      );
      case 'underline': return (
        <button
          className={`toolbar-btn ${isActive('underline') ? 'active' : ''}`}
          title="Underline (⌘U)"
          disabled={!miniEd && locked.underline}
          onClick={() => {
            if (miniEd) { miniEd.chain().focus().toggleUnderline().run(); return; }
            if (!editor || locked.underline) return;
            if (isOverrideMode) {
              toggleUnderlineOverride(editor, getCurrentElementRule(editor, activeTemplate));
            } else {
              editor.chain().focus(undefined, { scrollIntoView: false }).toggleUnderline().run();
            }
          }}
        >
          <FaUnderline />
        </button>
      );
      case 'strike': return (
        <button
          className={`toolbar-btn ${isActive('strike') ? 'active' : ''}`}
          title="Strikethrough"
          disabled={!miniEd && locked.strikethrough}
          onClick={() => {
            if (miniEd) { miniEd.chain().focus().toggleStrike().run(); return; }
            if (!locked.strikethrough) editor?.chain().focus(undefined, { scrollIntoView: false }).toggleStrike().run();
          }}
        >
          <FaStrikethrough />
        </button>
      );
      case 'subscript': return (
        <button
          className={`toolbar-btn ${isActive('subscript') ? 'active' : ''}`}
          title="Subscript"
          disabled={locked.subscript}
          onClick={() => { if (!locked.subscript) editor?.chain().focus(undefined, { scrollIntoView: false }).toggleSubscript().run(); }}
        >
          <FaSubscript />
        </button>
      );
      case 'superscript': return (
        <button
          className={`toolbar-btn ${isActive('superscript') ? 'active' : ''}`}
          title="Superscript"
          disabled={locked.superscript}
          onClick={() => { if (!locked.superscript) editor?.chain().focus(undefined, { scrollIntoView: false }).toggleSuperscript().run(); }}
        >
          <FaSuperscript />
        </button>
      );
      case 'textColor':
        return <TextColorControl editor={editor} locked={locked.textColor} showPopups={showPopups} />;
      // v6.10, Derek: SCRIPT highlighting is the Annotations tool's job now —
      // the ribbon highlighter no longer applies the old `highlight` mark.
      // The key survives for the Scrapbook: while a Scrapbook box is focused
      // the v2.69 branch above renders this as the box-background picker;
      // outside the Scrapbook the item renders nothing.
      case 'highlightColor': return null;
      case 'alignLeft': return (
        <button
          className={`toolbar-btn ${editor?.isActive({ textAlign: 'left' }) ? 'active' : ''}`}
          title="Align Left"
          onClick={() => editor?.chain().focus().setTextAlign('left').run()}
          disabled={locked.textAlign}
        >
          <FaAlignLeft />
        </button>
      );
      case 'alignCenter': return (
        <button
          className={`toolbar-btn ${editor?.isActive({ textAlign: 'center' }) ? 'active' : ''}`}
          title="Align Center"
          onClick={() => editor?.chain().focus().setTextAlign('center').run()}
          disabled={locked.textAlign}
        >
          <FaAlignCenter />
        </button>
      );
      case 'alignRight': return (
        <button
          className={`toolbar-btn ${editor?.isActive({ textAlign: 'right' }) ? 'active' : ''}`}
          title="Align Right"
          onClick={() => editor?.chain().focus().setTextAlign('right').run()}
          disabled={locked.textAlign}
        >
          <FaAlignRight />
        </button>
      );
      case 'alignJustify': return (
        <button
          className={`toolbar-btn ${editor?.isActive({ textAlign: 'justify' }) ? 'active' : ''}`}
          title="Justify"
          onClick={() => editor?.chain().focus().setTextAlign('justify').run()}
          disabled={locked.textAlign}
        >
          <FaAlignJustify />
        </button>
      );
      case 'find': return (
        <button
          className="toolbar-btn"
          title="Find & Replace (⌘F)"
          onClick={() => { setSearchOpen(true); if (inOverflow) setOverflowOpen(false); }}
        >
          <LuSearch />
        </button>
      );
      case 'goto': return (
        <button
          className="toolbar-btn"
          title="Go to Page (⌘G)"
          onClick={() => { setGoToPageOpen(true); if (inOverflow) setOverflowOpen(false); }}
        >
          <FaHashtag />
        </button>
      );
      // v4.33: no active state — the button opens the note popover on the
      // highlight (or creates the note there), not a persistent window.
      case 'scriptNotes': return (
        <button
          className="toolbar-btn"
          title="Notes"
          onPointerDown={handleNotesClick}
        >
          <FaStickyNote />
        </button>
      );
      case 'tags': return (
        <button
          className={`toolbar-btn${activeToolRight === 'tags' ? ' active' : ''}`}
          title="Production Tags"
          onPointerDown={handleTagsClick}
        >
          <FaTags />
        </button>
      );
      case 'zoom': return <ZoomControl />;
      /* v2.34, Derek: one-click surface toggle — lit while showing.
         (v3.25: the Left/Right Panel pair retired; chevrons cover them.) */
      case 'toggleOutlineBar': return (
        <button
          className={`toolbar-btn${outlineBarOpen ? ' active' : ''}`}
          title={outlineBarOpen ? 'Hide the Outline Bar' : 'Show the Outline Bar'}
          onClick={() => useEditorStore.getState().setOutlineBarOpen(!outlineBarOpen)}
        >{TOOLBAR_ICONS.toggleOutlineBar}</button>
      );
      /* v2.55, Derek: freeze/unfreeze every chrome resize — panels, bars,
         outline bar, spacing grips. Lit + closed padlock while locked. */
      case 'lockResize': return (
        <button
          className={`toolbar-btn${uiResizeLocked ? ' active' : ''}`}
          title={uiResizeLocked ? 'Sizing is locked — click to unlock' : 'Lock all sizing and spacing'}
          onClick={() => useEditorStore.getState().setUiResizeLocked(!uiResizeLocked)}
        >{uiResizeLocked ? TOOLBAR_ICONS.lockResize : TOOLBAR_ICONS.lockResizeOpen}</button>
      );
      /* v2.67, Derek: reset every adjustable size/spacing — confirm first;
         grayed while the lock is on (a locked layout shouldn't be resettable). */
      case 'resetSizes': return (
        <button
          className="toolbar-btn"
          disabled={uiResizeLocked}
          title={uiResizeLocked ? 'Sizing is locked — unlock to reset' : 'Reset all sizes & spacing to defaults'}
          onClick={async () => {
            if (await confirmDialog(
              'Reset all sizes and spacing to their defaults? Side panels, toolbar, menu bar, outline bar, and spacing all go back to factory positions.',
              { title: 'Reset All Sizes & Spacing', confirmLabel: 'Reset' },
            )) useEditorStore.getState().resetChromeSizes();
          }}
        >{TOOLBAR_ICONS.resetSizes}</button>
      );
      /* v3.02, Derek: Customize is an ordinary ribbon item again — in a
         one-row section it gets the big icon-over-label format for free. */
      case 'customize': return (
        <button
          className="toolbar-btn"
          title="Customize ScriptCraft"
          onClick={() => window.dispatchEvent(new CustomEvent('scriptcraft:command', { detail: 'customize' }))}
        >{TOOLBAR_ICONS.customize}</button>
      );
      /* v2.94, Derek: the Scrapbook's insert-table grid can't live in a native
         macOS menu, so it moves to the toolbar's second row. Only rendered
         while the Scrapbook is open — same visibility as its old menu. */
      case 'insertTable':
        return <InsertTableControl showPopups={showPopups} />;
      case 'view': return (
        <>
          <span className="view-style-label">Editor View</span>
          <select
            className="view-style-selector"
            value={previewMode ? 'preview' : viewStyle}
            onChange={(e) => {
              const v = e.target.value;
              if (v === 'preview') { useEditorStore.getState().setPreviewMode(true); return; }
              useEditorStore.getState().setPreviewMode(false);
              setViewStyle(v === 'continuous' ? 'continuous' : 'page');
            }}
            title="Editor View"
          >
            {editorViews.map((v) => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </select>
        </>
      );
      default: return null;
    }
  };

  /** Inline wrapper for a b: token — priority block, mobile classes, and the
   *  item's own trailing separator (it hides and moves with the item). */
  const renderBuiltinToken = (tok: string, tall = false): React.ReactNode => {
    const def = BUILTIN_BY_KEY[tok.slice(2)];
    if (!def) return null;
    // v3.21, Derek: tall Customize matches the other big buttons — ONE
    // button block with the label INSIDE (the rib-tall-btn format pinned
    // commands use), not an icon button with a caption drawn under it.
    if (tall && def.key === 'customize') {
      return (
        <button
          key={tok}
          className="toolbar-btn rib-tall-btn"
          title="Customize ScriptCraft"
          data-key="customize"
          onClick={() => window.dispatchEvent(new CustomEvent('scriptcraft:command', { detail: 'customize' }))}
        >
          <span className="rib-tall-icon">{TOOLBAR_ICONS.customize}</span>
          <span className="rib-tall-label">{def.label}</span>
        </button>
      );
    }
    // v3.99, Derek: the sizing lock renders like every other big button — ONE
    // rib-tall-btn with the label INSIDE it — so its hover box wraps the icon
    // AND the caption (Derek spotted the lock's box was icon-only, the caption
    // hanging below). Both padlock glyphs are 448×512, so height:auto keeps the
    // locked/unlocked states identical width — no layout shift, no forced square.
    if (tall && def.key === 'lockResize') {
      return (
        <button
          key={tok}
          className={`toolbar-btn rib-tall-btn${uiResizeLocked ? ' active' : ''}`}
          data-key="lockResize"
          title={uiResizeLocked ? 'Sizing is locked — click to unlock' : 'Lock all sizing and spacing'}
          onClick={() => useEditorStore.getState().setUiResizeLocked(!uiResizeLocked)}
        >
          <span className="rib-tall-icon">{uiResizeLocked ? TOOLBAR_ICONS.lockResize : TOOLBAR_ICONS.lockResizeOpen}</span>
          <span className="rib-tall-label">{uiResizeLocked ? 'Locked' : 'Unlocked'}</span>
        </button>
      );
    }
    const showPopups = !def.priority || !isHidden(def.priority);
    const cls = 'toolbar-priority-block'
      + (tall ? ' rib-tall' : '')
      + (def.desktopOnly ? ' toolbar-desktop-only' : '')
      + (def.zoom ? ' zoom-group' : '');
    // v3.76, Derek: the sizing-lock big button captions its STATE — "Locked"
    // when on (padlock closed), "Unlocked" when off (padlock open); the icon
    // already swaps in the control below. The palette keeps the "Lock All" name.
    const riblabel = def.key === 'lockResize' ? (uiResizeLocked ? 'Locked' : 'Unlocked') : def.label;
    return (
      <React.Fragment key={tok}>
        <div
          className={cls}
          data-key={def.key}
          {...(def.priority ? { 'data-priority': def.priority } : {})}
        >
          {renderBuiltinControl(def.key, false, showPopups)}
          {/* v2.97, Derek: in a one-row section every item is a BIG BUTTON —
              large icon with its name underneath.
              v3.38: the `view` control captions itself — no second label.
              v6.08, Derek ("make sure all highlight the text and icon
              together… match exactly"): the label is a REAL element wearing
              the same .rib-tall-label class as the one-block buttons — the
              old CSS ::after label had its own font rule, its own spacing,
              and sat outside the hover surface. One class, one geometry,
              and the whole block is the hover target (03-toolbar.css). */}
          {tall && def.key !== 'view' && <span className="rib-tall-label">{riblabel}</span>}
        </div>
        {def.key === 'zoomIn' && (
          <div className="toolbar-group zoom-mobile-group">
            <button
              className="toolbar-btn"
              title="Zoom"
              onClick={() => setZoomPanelOpen(!zoomPanelOpen)}
            >
              <CirclePlusIcon />
            </button>
          </div>
        )}
      </React.Fragment>
    );
  };

  // Overflow menu: collapsed priorities re-render their PRESENT items only —
  // items removed from the toolbar in Customize never reappear here.
  // (Ribbon tokens may carry the 2! span flag — compare flag-blind.)
  const presentKeys = new Set(
    leftTokens.map(stripTall).filter((t) => t.startsWith('b:')).map((t) => t.slice(2)),
  );
  let overflowContent: React.ReactNode[] | null = null;
  if (hiddenPriorities.size > 0) {
    // v2.71, Derek: the menu reads in TOOLBAR order. Priority decides only
    // WHAT collapses first — rendering by priority group re-shuffled the
    // items relative to how they sit on the bar. Runs of neighbours that
    // collapsed together stay grouped, separated where the bar had a break.
    const runs: { pr: string; keys: string[] }[] = [];
    for (const raw of leftTokens) {
      const tok = stripTall(raw);
      if (!tok.startsWith('b:')) continue;
      const key = tok.slice(2);
      const d = BUILTIN_BY_KEY[key];
      if (!d?.priority || !hiddenPriorities.has(d.priority) || !presentKeys.has(key)) continue;
      const last = runs[runs.length - 1];
      if (last && last.pr === d.priority) last.keys.push(key);
      else runs.push({ pr: d.priority, keys: [key] });
    }
    const items: React.ReactNode[] = [];
    runs.forEach((r, i) => {
      if (i > 0) items.push(<div className="toolbar-overflow-sep" key={`ovsep-${i}`} />);
      items.push(
        <div className="toolbar-group" key={`ov-${i}-${r.pr}`}>
          {r.keys.map((k) => <React.Fragment key={k}>{renderBuiltinControl(k, true, true)}</React.Fragment>)}
        </div>,
      );
    });
    overflowContent = items.length ? items : null;
  }

  /** v2.96: ribbon token → cell in its section row. `tall` comes from the
   *  SECTION now (a section with no row break spans its items across both
   *  rows): icon buttons grow a label under the icon (Word's large-button
   *  format), wide controls center vertically. */
  const renderToken = (raw: string, tall = false): React.ReactNode => {
    const tok = stripTall(raw);
    if (tok.startsWith('d:')) {
      return <div key={tok} className={`toolbar-separator toolbar-user-divider${tall ? ' rib-tall' : ''}`} />;
    }
    // s:<id> — blank space to push neighbouring buttons apart (v0.69).
    // v0.82: an optional width rides along as s:<id>:<px>. Tokens saved before
    // that have no width and fall back to the CSS default, so old layouts load
    // unchanged.
    if (tok.startsWith('s:')) {
      const px = Number(tok.split(':')[2]);
      return (
        <div
          key={tok}
          className={`toolbar-spacer${tall ? ' rib-tall' : ''}`}
          style={Number.isFinite(px) && px > 0 ? { width: px } : undefined}
        />
      );
    }
    if (tok.startsWith('t:')) {
      const t = ALL_TOOLS.find((x) => x.id === tok.slice(2));
      if (!t) return null;
      return tall ? (
        /* v4.85, Derek: a tool button TOGGLES — press it again to close. */
        <button key={tok} className="toolbar-btn rib-tall rib-tall-btn" title={t.label} data-key={t.id} onClick={() => toggleTool(t.id)}>
          <span className="rib-tall-icon">{t.icon}</span>
          <span className="rib-tall-label">{t.label}</span>
        </button>
      ) : (
        <button key={tok} className="toolbar-btn" title={t.label} data-key={t.id} onClick={() => toggleTool(t.id)}>
          {t.icon}
        </button>
      );
    }
    if (tok.startsWith('c:')) {
      const c = commandDef(tok.slice(2));
      if (!c) return null;
      return <RibbonCommandButton key={tok} cmd={c} tall={tall} />;
    }
    if (tok.startsWith('b:')) return renderBuiltinToken(tok, tall);
    return null;
  };

  const tbCustomH = chromePx('toolbar', 'custom', chromeCustomPx.toolbar);
  // One ribbon row's height. chromePx describes the old single-row bar; the
  // ribbon stacks two of them (minus the chrome padding it now owns once).
  const barH = toolbarMode === 'custom' ? tbCustomH
    : toolbarMode === 'comfortable' ? 39 : 33;
  const ribRowH = Math.max(22, Math.round(barH) - 5);

  const { sections, splitAt } = parseRibbon(leftTokens);
  /* v3.25, Derek: EMPTY sections render nothing but their boundary divider
     still painted — a stray line left of the first item or right of the last
     (an empty edge section exists whenever the align split is dropped at the
     end, or a section's last item is removed). The LIVE bar skips empty
     sections entirely; the align gap survives by re-deriving the split
     against the kept sections. The editor still shows empty sections. */
  const liveSections = sections
    .map((s, orig) => ({ s, orig }))
    .filter(({ s }) => s.top.length + s.bottom.length > 0);
  const liveSplitAt = splitAt === null ? null
    : liveSections.findIndex(({ orig }) => orig >= splitAt);
  /* v3.33, Derek: the Scrapbook's ribbon presence is INJECTED, not a stored
     token — while the tool is open, a Scrapbook section (tag + its buttons)
     always appears as the LAST left-aligned section, whatever the saved
     layout says. (It used to depend on a b:insertTable token surviving in
     the layout — close that section in Customize and the tools vanished.) */
  const leftLive = liveSplitAt === null || liveSplitAt < 0 ? liveSections : liveSections.slice(0, liveSplitAt);
  const rightLive = liveSplitAt === null || liveSplitAt < 0 ? [] : liveSections.slice(liveSplitAt);
  /* v4.14, Derek: when NOT ONE section carries a title, drop the reserved title
     band entirely so the ribbon shifts up and loses that blank strip. (When any
     section IS titled, the band stays reserved in every two-row section so the
     button rows still line up — the v4.5 alignment.) Not in edit mode: there the
     title inputs must stay visible so titles can be added. */
  const anyRibTitle = liveSections.some(({ s }) => !!s.title);

  /* v5.14, Derek: per-kind geometry. The numbers ride the same inline style
     block as --rib-rowh; ribbonKindVars (toolbarBuiltins) holds the maths.
     Auto-fill: untitled two-row sections stretch to a titled section's total
     height; the two Design scale knobs multiply each kind on top. */
  const ribKind = ribbonKindVars({
    rowH: ribRowH,
    anyTitle: anyRibTitle,
    anyUntitled: liveSections.some(({ s: ls }) => !ls.title),
    titleFont: dzVars.ribTitleFont,
    titleGap: dzVars.ribTitleGap,
    rowGapTitled: dzVars.ribRowGapTitled,
    rowGapUntitled: dzVars.ribRowGapUntitled,
    padTopTitled: dzVars.ribPadTopTitled,
    padBottomTitled: dzVars.ribPadBottomTitled,
    padTopUntitled: dzVars.ribPadTopUntitled,
    padBottomUntitled: dzVars.ribPadBottomUntitled,
    scaleTitledPct: ribScaleTitledPct,
    scaleUntitledPct: ribScaleUntitledPct,
  });

  /* v3.42, Derek: ONE renderer for a live section's inner rows (both zones
     read it, so the layout can't drift). A section's title sits ON TOP of its
     rows — first child of the section column, one- or two-row alike. */
  const liveSectionInner = (s: typeof sections[number], withTitle = true) => (
    <>
      {withTitle && (
        <div className={`rib-sec-title${s.title ? '' : ' rib-sec-title-empty'}`}>{s.title || ''}</div>
      )}
      <div className="rib-row">{s.top.map((t) => renderToken(t, !s.hasBreak))}</div>
      {s.hasBreak && s.breakLine && <div className="rib-row-line" />}
      {s.hasBreak && <div className="rib-row">{s.bottom.map((t) => renderToken(t, false))}</div>}
    </>
  );

  /* v4.85, Derek: "a ribbon section title should span above everything that is
     between two 2-row dividers." Removing a boundary divider (v4.75) makes two
     sections read as ONE block, so its title must center over the whole block —
     not just over the section that happens to carry the title.

     A GROUP is a maximal run of live sections joined by naked boundaries
     (noSepBefore). The group's title is the first non-empty title in the run;
     it renders once, above the run, and the sections inside drop their own
     bands. A single-section group is the ordinary case and looks exactly as
     it did — the band still gets reserved so button rows stay aligned (the
     v4.5 rule). */
  type LiveSec = { s: typeof sections[number]; orig: number };
  const groupSections = (list: LiveSec[]): LiveSec[][] => {
    const groups: LiveSec[][] = [];
    for (const entry of list) {
      if (groups.length > 0 && entry.s.noSepBefore) groups[groups.length - 1].push(entry);
      else groups.push([entry]);
    }
    return groups;
  };
  const renderLiveGroup = (group: LiveSec[], key: string) => {
    if (group.length === 1) {
      const { s } = group[0];
      return (
        <div key={key} className={`rib-section${s.hasBreak ? '' : ' rib-single'} ${s.title ? 'rib-kind-titled' : 'rib-kind-untitled'}`}>
          {liveSectionInner(s)}
        </div>
      );
    }
    const title = group.map((g) => g.s.title).find((t) => !!t) || '';
    // A grouped block is single-row only if EVERY section in it is.
    const anyBreak = group.some((g) => g.s.hasBreak);
    return (
      <div key={key} className={`rib-group${anyBreak ? '' : ' rib-single'} ${title ? 'rib-kind-titled' : 'rib-kind-untitled'}`}>
        <div className={`rib-sec-title${title ? '' : ' rib-sec-title-empty'}`}>{title}</div>
        <div className="rib-group-body">
          {group.map(({ s, orig }) => (
            <div key={`gs-${orig}`} className={`rib-section rib-section-ingroup${s.hasBreak ? '' : ' rib-single'}`}>
              {liveSectionInner(s, false)}
            </div>
          ))}
        </div>
      </div>
    );
  };


  return (
    /* v2.96, Derek: the WORD RIBBON, arranged by SECTION. Everything between
       two full-height dividers is a section; items read left-to-right, an
       r: row break puts what follows on the section's second row, and a
       section with no break spans its items across both rows. Customize is
       fixed chrome at the right edge spanning both rows — the one big
       button. No spacing grips inside the toolbar (the menu bar keeps its). */
    <div className="toolbar-stack">
    <div
      className={`toolbar toolbar-ribbon${toolbarMode === 'comfortable' ? ' toolbar-comfortable' : ''}${toolbarMode === 'custom' ? ' toolbar-custom' : ''}${toolbarHighlighted ? ' toolbar-highlight' : ''}${!anyRibTitle ? ' rib-no-titles' : ''}`}
      style={{
        ...(toolbarMode === 'custom' ? ({
          ['--chrome-scale' as string]: String(chromeScaleFactor('toolbar', tbCustomH)),
        } as React.CSSProperties) : {}),
        ['--rib-rowh' as string]: `${ribRowH}px`,
        ['--rib-gap' as string]: `${chromeGapPx.toolbar}px`,
        // v5.14: plain NUMBERS so the stylesheet can calc(base * factor).
        ['--rib-k-t' as string]: String(ribKind.kTitled),
        ['--rib-k-u' as string]: String(ribKind.kUntitled),
        ['--rib-content-h' as string]: `${Math.round(ribKind.contentH)}px`,
        // v3.34, Derek: user-set dropdown widths (dragged in the visual
        // editor) — one store, applied here AND in the editor's chips.
        ...Object.fromEntries(Object.entries(toolbarDdWidths).map(([k, v]) => [`--ddw-${k}`, `${v}px`])),
        // v2.72: measured so the first icons of the two bars align.
        // v5.16: ONLY while the user hasn't set the Bar-left-padding knob —
        // an inline value would beat the knob's CSS var and turn it into a
        // silent no-op. Reset the knob to get the auto-alignment back.
        ...(alignPad !== null && dzVars.ribPadLeft === undefined ? { paddingLeft: alignPad } : {}),
      }}
      ref={toolbarRef}
    >
      {/* v4.85: sections joined by removed dividers render as ONE titled
          group; a visible divider still separates group from group. */}
      {groupSections(leftLive).map((group, gi) => (
        <React.Fragment key={`grp-${group[0].orig}`}>
          {gi > 0 && <div className="toolbar-separator rib-section-sep" />}
          {renderLiveGroup(group, `g-${group[0].orig}`)}
        </React.Fragment>
      ))}
      {/* (v5.43, Derek: the Scrapbook's ribbon "Return to Editor" section is
          gone — the surface's own × (v4.85) does it, and one control per
          action is the rule.) */}
      {/* v4.85, Derek: the fullscreen takeover's Return-to-Editor is GONE —
          its header × already returns you to the editor, so the ribbon
          button was a second control for one action. (The Scrapbook keeps
          its own, above: its surface has no window header of its own.) */}
      {/* v3.02, Derek: the align split — everything after it hugs the
          toolbar's right edge. */}
      {rightLive.length > 0 && <div className="rib-align-gap" />}
      {groupSections(rightLive).map((group, gi) => (
        <React.Fragment key={`grp-${group[0].orig}`}>
          {gi > 0 && <div className="toolbar-separator rib-section-sep" />}
          {renderLiveGroup(group, `g-${group[0].orig}`)}
        </React.Fragment>
      ))}
      {/* v6.15: "Show in: Header" mounts the SAME GoalChip the status bar
          uses. v6.29, Derek: its header home is the TITLE BAR (script name +
          QAT row) — this ribbon seat only remains where no title bar exists
          (browser dev, non-Mac), so the chip lives in exactly one place. */}
      {goalShowIn === 'toolbar' && !showTitleBar() && (
        <span className="toolbar-goalchip"><GoalChip variant="toolbar" words={goalChipWords} /></span>
      )}
    </div>

    {/* Overflow 3-dot menu — beside the ribbon, spanning its height */}
    {hasOverflow && overflowContent && (
      <div className="toolbar-group toolbar-overflow-wrap" ref={overflowRef}>
        <button
          className={`toolbar-btn toolbar-overflow-btn${overflowOpen ? ' active' : ''}`}
          title="More formatting options"
          onClick={() => setOverflowOpen(!overflowOpen)}
        >
          <FaEllipsisV />
        </button>
        {overflowOpen && (
          <div className="toolbar-overflow-menu">
            {overflowContent}
          </div>
        )}
      </div>
    )}

    {/* v3.38, Derek: the on-bar "+ Add" menu, portalled to the body so it
        escapes the ribbon's overflow/stacking context. One item list —
        structural pieces first, then every addable item from the SAME source
        the Customize palette reads (ribbonPaletteData). A search box filters
        the whole thing. */}
    </div>
  );
};

export default Toolbar;
