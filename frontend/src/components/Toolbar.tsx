import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  FaSearchPlus,
  FaSearch,
  FaStickyNote,
  FaTags,
  FaHighlighter,
  FaEllipsisV,
  FaHashtag,
  FaListOl, FaRegStickyNote, FaCheckSquare, FaFileAlt,
  FaImage, FaExchangeAlt, FaArrowLeft,
} from 'react-icons/fa';
import { ALL_TOOLS } from './ToolDock';
import { CircleMinusIcon, CirclePlusIcon, TOOLBAR_ICONS } from './uiIcons';
import {
  startRibbonDrag, ribCloseSection, ribRemoveToken, ribRemoveBreak,
  ribToggleBreakLine, ribRemoveSplit, ribAddSectionAtBoundary, ribAddInlineAtBoundary,
  ribSetAlignSplit, ribSetSectionTitle, ribRemoveSectionTitle,
  ribSetSpacerWidth, SPACER_MIN_PX, SPACER_MAX_PX,
  ribUndo, ribResetHistory,
} from './ribbonDrag';
import { tokenLabel } from './tokenMeta';
import { buildRibbonPalette } from './ribbonPaletteData';
import { useNotebookStore } from '../stores/notebookStore';
import { TableGridPicker, closeNotebook } from './NotebookTool';
import { chromePx, chromeScaleFactor } from './chromeSizes';
import { confirmDialog } from './ConfirmDialog';
import { commandDef } from './toolbarCommands';
import { BUILTIN_BY_KEY, DEFAULT_TOOLBAR_LEFT, DEFAULT_TOOLBAR_RIGHT, normalizeToolbarZones, stripTall, parseRibbon } from './toolbarBuiltins';
import { smartUndo, smartRedo, useEditorStore, NOTE_COLORS } from '../stores/editorStore';
import type { ElementType } from '../stores/editorStore';
import { useFormattingTemplateStore } from '../stores/formattingTemplateStore';
import { BUILT_IN_ELEMENT_IDS } from '../stores/formattingTypes';
import {
  getCurrentElementRule,
  getLockedFormatting,
  toggleBoldOverride,
  toggleItalicOverride,
  toggleUnderlineOverride,
} from '../utils/effectiveFormatting';
import type { LockedFormatting } from '../utils/effectiveFormatting';
import FontPicker from './FontPicker';
import ColorPicker from './ColorPicker';
import { FONT_REGISTRY, loadFont } from '../utils/fonts';

/** Zoom bounds. The editable input previously advertised max 200 while the
 *  buttons allowed 300 — unified here (v0.75). */
const ZOOM_MIN = 50;
const ZOOM_MAX = 300;

interface ToolbarProps {
  editor: Editor | null;
}

const FONT_SIZES = [8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72, 96];

// Priority groups — higher number = hidden first when toolbar shrinks.
// Priority 1 = zoom-out (just the minus button area)
// Priority 2 = zoom/goto/search
// Priority 3 = alignment buttons
// Priority 4 = font style & colors (bold/italic/underline/strike/sub/super + colors + language)
// Priority 5 = font face & size
const Toolbar: React.FC<ToolbarProps> = ({ editor }) => {
  const {
    activeElement,
    setActiveElement,
    zoomLevel,
    viewStyle, setViewStyle,
    setZoomLevel,
    zoomPanelOpen,
    setZoomPanelOpen,
    fontFamily,
    setFontFamily,
    fontSize,
    setFontSize,
    setSearchOpen,
    setGoToPageOpen,
    activeToolRight,
    setActiveToolRight,
    openShelfTab,
    toolbarPinnedTools,
    previewMode,
    openTool,
    addNote,
    setNoteFilter,
    tagsPanelOpen,
    toggleTagsPanel,
    setPendingTagSelection,
    setEditingTagId,
    toolbarMode, chromeCustomPx, chromeGapPx,
    outlineBarOpen,
    uiResizeLocked,
    toolbarDdWidths,
    toolbarEditing, ribEdit,
  } = useEditorStore();

  // v2.07: while the Scrapbook is open, the toolbar's own formatting buttons
  // drive the focused text box (execCommand) instead of the script editor —
  // no duplicate B/I/U/S anywhere. Declared up here because the responsive
  // overflow measurement (below) also re-measures on this flag (v2.10).
  const scrapbookOpen = useNotebookStore((s) => s.notebookOpen);
  // v2.94: the Insert Table button needs a page to land the table on — the
  // old menu item was disabled without one, and firing the event with no
  // canvas mounted is a silent no-op.
  const scrapbookPage = useNotebookStore((s) => !!s.selectedPageId);

  const activeTemplate = useFormattingTemplateStore((s) => s.getActiveTemplate());

  // v0.71: element visibility/order come from the user's persisted overrides

  // applied over the active template (system templates are immutable).

  const pageLayout = useEditorStore((st) => st.pageLayout);
  const pickableElements = useFormattingTemplateStore((st) => st.getPickableElements)();
  useFormattingTemplateStore((st) => st.elementHidden);
  useFormattingTemplateStore((st) => st.elementOrder);

  useFormattingTemplateStore((st) => st.elementHidden);   // re-render on change

  useFormattingTemplateStore((st) => st.elementOrder);
  const isEnforceMode = activeTemplate.mode === 'enforce';
  const isOverrideMode = activeTemplate.mode === 'override';

  // v3.37, Derek: the on-bar "+ Add" menu — utilities are added from the bar
  // itself now. { at: section-boundary index, rightSide, x, y for the popup }.
  const [addMenu, setAddMenu] = useState<{ at: number; rightSide: boolean; x: number; y: number } | null>(null);
  const [addSearch, setAddSearch] = useState('');
  // v3.40, Derek: the +Add menu has two views — the structural utilities up
  // front, and every addable item behind an "Add Item ▸" submenu.
  const [addView, setAddView] = useState<'main' | 'items'>('main');
  // Per-attribute locking state — updates reactively when cursor moves between elements
  const [locked, setLocked] = useState<LockedFormatting>({
    bold: false, italic: false, underline: false, strikethrough: false,
    textAlign: false, textColor: false, backgroundColor: false, textTransform: false,
    fontFamily: false, fontSize: false, subscript: false, superscript: false,
  });

  // Color picker state
  const [textColorOpen, setTextColorOpen] = useState(false);
  const [bgColorOpen, setBgColorOpen] = useState(false);
  // v3.21: the color pickers are PORTALLED (the ribbon clips overflow, so an
  // absolute popup inside it is invisible — the "dead button" report).
  // Fixed coordinates measured from the trigger, per the AddMenu rule.
  const [colorPopAnchor, setColorPopAnchor] = useState<{ top: number; left: number } | null>(null);
  // v2.69: the Scrapbook's text-background picker. Its swatch clicks move
  // focus out of the contentEditable, so the selection is captured on the
  // button's mousedown and restored before the execCommand runs.
  const [sbBgOpen, setSbBgOpen] = useState(false);
  const sbBgRange = useRef<Range | null>(null);
  // v2.94: the insert-table grid on the toolbar's second row — the one menu
  // item that can't move into the native macOS menu bar. Portalled to
  // document.body (the toolbar's own stacking context sits UNDER the tool
  // dock — a popup inside it renders but can't be clicked) and positioned
  // by measured top/left from the trigger, never bottom.
  const [tableGridOpen, setTableGridOpen] = useState(false);
  const [tableGridPos, setTableGridPos] = useState<{ top: number; left: number } | null>(null);
  useEffect(() => {
    if (!tableGridOpen) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest?.('.toolbar-tablegrid-anchor')) setTableGridOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [tableGridOpen]);
  const [currentTextColor, setCurrentTextColor] = useState<string>('#000000');
  // v1.83: the highlighter color is store state — Format > Highlighting shares it.
  const currentBgColor = useEditorStore((s) => s.highlightColor);
  const setCurrentBgColor = useEditorStore((s) => s.setHighlightColor);

  // Track the font/size of the text at current cursor position. Empty string
  // / null indicates the selection spans more than one value ("mixed").
  const [cursorFont, setCursorFont] = useState<string>(fontFamily);
  const [cursorSize, setCursorSize] = useState<number | null>(fontSize);
  // Fonts found in document that aren't in the registry
  const [extraFonts, setExtraFonts] = useState<string[]>([]);

  const detectFormatting = useCallback(() => {
    if (!editor) return;

    // Update locked formatting for current element
    const rule = getCurrentElementRule(editor, activeTemplate);
    setLocked(getLockedFormatting(rule, isEnforceMode));

    const { from, to, empty } = editor.state.selection;

    // For an empty cursor, fall back to the textStyle mark at that position.
    if (empty) {
      const attrs = editor.getAttributes('textStyle');
      const detectedFont = (attrs.fontFamily as string | undefined) || '';
      const detectedSize = (attrs.fontSize as string | undefined) || '';
      const effectiveFont = detectedFont || rule?.fontFamily || fontFamily;
      setCursorFont(effectiveFont);
      if (effectiveFont && !FONT_REGISTRY.find((f) => f.name === effectiveFont)) {
        setExtraFonts((prev) => (prev.includes(effectiveFont) ? prev : [...prev, effectiveFont]));
      }
      if (detectedSize) {
        const parsed = parseInt(detectedSize, 10);
        setCursorSize(!isNaN(parsed) ? parsed : (rule?.fontSize ?? fontSize));
      } else {
        setCursorSize(rule?.fontSize ?? fontSize);
      }
      return;
    }

    // For a real selection, walk the text nodes within [from, to]. If every
    // text node carries the same fontFamily / fontSize, show that value;
    // otherwise show the picker as blank to indicate "mixed".
    const fonts = new Set<string>();
    const sizes = new Set<string>();
    let sawText = false;
    editor.state.doc.nodesBetween(from, to, (node, pos) => {
      if (!node.isText || !node.text) return;
      const start = Math.max(pos, from);
      const end = Math.min(pos + node.nodeSize, to);
      if (end <= start) return;
      sawText = true;
      const ts = node.marks.find((m) => m.type.name === 'textStyle');
      const ff = (ts?.attrs.fontFamily as string | undefined) || '';
      const fs = (ts?.attrs.fontSize as string | undefined) || '';
      fonts.add(ff);
      sizes.add(fs);
    });

    if (!sawText) {
      // Selection contains only block boundaries / no text — fall back to cursor attrs.
      const attrs = editor.getAttributes('textStyle');
      const detectedFont = (attrs.fontFamily as string | undefined) || '';
      const detectedSize = (attrs.fontSize as string | undefined) || '';
      const effectiveFont = detectedFont || rule?.fontFamily || fontFamily;
      setCursorFont(effectiveFont);
      if (detectedSize) {
        const parsed = parseInt(detectedSize, 10);
        setCursorSize(!isNaN(parsed) ? parsed : (rule?.fontSize ?? fontSize));
      } else {
        setCursorSize(rule?.fontSize ?? fontSize);
      }
      return;
    }

    if (fonts.size > 1) {
      setCursorFont('');
    } else {
      const single = [...fonts][0] || '';
      const effective = single || rule?.fontFamily || fontFamily;
      setCursorFont(effective);
      if (effective && !FONT_REGISTRY.find((f) => f.name === effective)) {
        setExtraFonts((prev) => (prev.includes(effective) ? prev : [...prev, effective]));
      }
    }

    if (sizes.size > 1) {
      setCursorSize(null);
    } else {
      const single = [...sizes][0] || '';
      if (single) {
        const parsed = parseInt(single, 10);
        setCursorSize(!isNaN(parsed) ? parsed : (rule?.fontSize ?? fontSize));
      } else {
        setCursorSize(rule?.fontSize ?? fontSize);
      }
    }
  }, [editor, fontFamily, fontSize, activeTemplate, isEnforceMode]);

  useEffect(() => {
    if (!editor) return;
    editor.on('selectionUpdate', detectFormatting);
    editor.on('transaction', detectFormatting);
    // Run once on mount / editor ready
    detectFormatting();
    return () => {
      editor.off('selectionUpdate', detectFormatting);
      editor.off('transaction', detectFormatting);
    };
  }, [editor, detectFormatting]);

  // v3.71, Derek: while editing the toolbar, Cmd/Ctrl+Z undoes the last ribbon
  // change (each mutation snapshots toolbarLeft). Capture-phase so it beats the
  // editor's own undo; skipped inside a text field so typing a section title
  // still gets native text undo. History resets each time editing begins.
  useEffect(() => {
    if (!toolbarEditing) return;
    ribResetHistory();
    const onKey = (e: KeyboardEvent) => {
      if (!((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && (e.key === 'z' || e.key === 'Z'))) return;
      const t = e.target as HTMLElement | null;
      // Skip ONLY real text fields (the section-title / spacer-size inputs) so
      // they keep native text undo. NOT the script editor (contentEditable) —
      // when you click a toolbar button the editor keeps focus, so bailing on
      // contentEditable meant Cmd+Z fell through to the script's undo.
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      e.preventDefault();
      e.stopPropagation();
      ribUndo();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [toolbarEditing]);

  // Collect all unique fonts used in the document (for extra fonts display)
  useEffect(() => {
    if (!editor) return;
    const collectFonts = () => {
      const found = new Set<string>();
      editor.state.doc.descendants((node) => {
        if (node.isText && node.marks) {
          for (const mark of node.marks) {
            if (mark.type.name === 'textStyle' && mark.attrs.fontFamily) {
              const f = mark.attrs.fontFamily as string;
              if (!FONT_REGISTRY.find(r => r.name === f)) {
                found.add(f);
              }
            }
          }
        }
      });
      if (found.size > 0) {
        setExtraFonts(prev => {
          const merged = new Set([...prev, ...found]);
          return merged.size !== prev.length ? [...merged] : prev;
        });
      }
    };
    collectFonts();
    editor.on('update', collectFonts);
    return () => { editor.off('update', collectFonts); };
  }, [editor]);

  const handleElementChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const type = e.target.value;
    if (!editor) return;

    // Dual Dialogue is a structure, not a paragraph type — it runs its command
    // rather than setting a node type (v0.84).
    if (type === 'dualDialogue') {
      (editor as unknown as { commands: { toggleDualDialogue: () => boolean } })
        .commands.toggleDualDialogue();
      return;
    }

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

  const isActive = (format: string) => {
    if (!editor) return false;
    return editor.isActive(format);
  };

  // ── Zoom dropdown (v0.75) ──
  const [zoomInput, setZoomInput] = useState(String(zoomLevel));
  const [zoomEditing, setZoomEditing] = useState(false);
  const [zoomMenuOpen, setZoomMenuOpen] = useState(false);
  const zoomInputRef = useRef<HTMLInputElement>(null);
  const zoomMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!zoomEditing) setZoomInput(String(zoomLevel)); }, [zoomLevel, zoomEditing]);

  const commitZoom = () => {
    const val = parseInt(zoomInput, 10);
    if (!isNaN(val) && val >= ZOOM_MIN && val <= ZOOM_MAX) setZoomLevel(val);
    else setZoomInput(String(zoomLevel));
    setZoomEditing(false);
  };

  // Fit Page to Screen is also a rebindable shortcut (v0.77); the MenuBar's key
  // handler dispatches it here because the measurement lives in this component.
  useEffect(() => {
    const onCmd = (e: Event) => {
      if ((e as CustomEvent).detail === 'fitPage') fitPageToScreen();
      if ((e as CustomEvent).detail === 'fitWidth') fitPageToWidth();
    };
    window.addEventListener('scriptcraft:command', onCmd);
    return () => window.removeEventListener('scriptcraft:command', onCmd);
  });

  // Close the zoom menu on an outside click.
  useEffect(() => {
    if (!zoomMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!zoomMenuRef.current?.contains(e.target as Node)) {
        setZoomMenuOpen(false);
        setZoomEditing(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [zoomMenuOpen]);

  /** Scale so one whole page fits the visible editor area.
   *  Measured from the DOM: the page's UNSCALED height (its rendered height
   *  divided by the zoom currently applied) against the scroll container's
   *  height, minus the page's vertical margins. Deriving it from real geometry
   *  keeps it correct for any paper size or margin setting. */
  const fitPageToScreen = () => {
    const page = document.querySelector('.page') as HTMLElement | null;
    const scroller = document.querySelector('.editor-main') as HTMLElement | null;
    if (!page || !scroller) return;

    // ROOT CAUSE, take two (v0.87). There is only ONE .page element and it holds
    // the WHOLE script — page breaks are decorations, not separate elements. So
    // measuring the element measured the entire document, and "fit" shrank the
    // script until EVERY page fitted.
    //
    // v0.85 tried to fix that by reading min-height, on the reasoning that the
    // stylesheet sets it to one page (11in). It doesn't, at runtime: the element
    // carries an INLINE min-height of `lastPageEnd + bottomMargin` — the end of
    // the LAST page — which overrides the stylesheet. So it was still measuring
    // the whole document, just via a different property. That's why it still
    // showed two pages.
    //
    // The page height is not something to infer from the DOM at all: pageLayout
    // states it (US Letter = 11in). Take it from there. CSS treats 1in as 96px
    // regardless of the actual display, so this is exact.
    const CSS_PX_PER_IN = 96;
    const pc = getComputedStyle(page);

    const onePageH = pageLayout.pageHeight * CSS_PX_PER_IN;
    const pageW = pageLayout.pageWidth * CSS_PX_PER_IN;

    // v0.89: only the page's TOP margin sits between the top of the view and the
    // first page. Its bottom margin falls BELOW page one — counting it shrank
    // the page by that much and let the next page peek in.
    const marginTop = parseFloat(pc.marginTop) || 0;
    const blockH = onePageH + marginTop;
    if (!blockH || !pageW) return;

    // .editor-main pads 30px top / 60px bottom. Only the TOP padding pushes page
    // one down the screen; the bottom padding sits after the WHOLE document, not
    // after page one. Subtracting both (as v0.87 did) made the page ~60px
    // shorter than the space available — and that leftover strip is exactly the
    // sliver of page two Derek could see.
    const sc = getComputedStyle(scroller);
    const padTop = parseFloat(sc.paddingTop) || 0;
    const padX = (parseFloat(sc.paddingLeft) || 0) + (parseFloat(sc.paddingRight) || 0);
    const availH = scroller.clientHeight - padTop;
    const availW = scroller.clientWidth - padX;
    if (availH <= 0 || availW <= 0) return;

    // Whichever axis runs out first decides the zoom — fitting height alone
    // would clip the sides on a narrow window.
    const pct = Math.floor(Math.min(availH / blockH, availW / pageW) * 100);
    setZoomLevel(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, pct)));
  };

  /** v2.57, Derek: scale so the page fills the editor's WIDTH — as big as it
   *  can get in the current window; the height scrolls. How much width there
   *  is depends on the sidebars, which is the point: same measured-geometry
   *  approach as fitPageToScreen, width axis only. */
  const fitPageToWidth = () => {
    const scroller = document.querySelector('.editor-main') as HTMLElement | null;
    if (!scroller) return;
    const CSS_PX_PER_IN = 96;
    const pageW = pageLayout.pageWidth * CSS_PX_PER_IN;
    const sc = getComputedStyle(scroller);
    const padX = (parseFloat(sc.paddingLeft) || 0) + (parseFloat(sc.paddingRight) || 0);
    const availW = scroller.clientWidth - padX;
    if (availW <= 0 || !pageW) return;
    const pct = Math.floor((availW / pageW) * 100);
    setZoomLevel(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, pct)));
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

  // Hide order: "1" first, then "2" (matches "2" and "2b"), "3", "4", "5" last
  const HIDE_ORDER = ['1', '2', '3', '4', '5'];

  // Measure toolbar overflow and determine which priority groups to hide
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

      // v2.95: the ribbon is a two-row GRID — per-child width sums double-
      // count stacked columns, so overflow is judged by the layout itself:
      // hide priority groups until the grid stops overflowing its box.
      for (const prefix of HIDE_ORDER) {
        if (toolbar.scrollWidth <= toolbar.clientWidth) break;
        for (const g of groups) {
          const key = g.dataset.priority!;
          if (!key.startsWith(prefix) || newHidden.has(key)) continue;
          newHidden.add(key);
          g.style.display = 'none';
        }
      }

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
  const handleNotesClick = useCallback((e: React.PointerEvent | React.MouseEvent) => {
    e.preventDefault();
    const scriptTabShowing = activeToolRight === 'scriptnotes';
    if (!editor) { if (scriptTabShowing) setActiveToolRight(null); else openShelfTab('script'); return; }

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
        setNoteFilter({ elementType: null, contextLabel: null, color: null, noteId: noteMark.attrs.noteId as string });
        openShelfTab('script');
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
      const nodeText = $from.parent.textContent.trim();
      let contextLabel = nodeText.slice(0, 60);
      if (currentNodeType === 'character') {
        contextLabel = nodeText.replace(/\s*\([^)]*\)\s*/g, '').trim();
      } else if (currentNodeType === 'sceneHeading') {
        contextLabel = nodeText;
      } else if (currentNodeType === 'dialogue' || currentNodeType === 'parenthetical') {
        let charName = '';
        editor.state.doc.nodesBetween(0, selFrom, (node) => {
          if (node.type.name === 'character') {
            charName = node.textContent.trim().replace(/\s*\([^)]*\)\s*/g, '').trim();
          }
          return true;
        });
        if (charName) contextLabel = charName;
      }

      let sceneId: string | null = null;
      let sceneIdx = 0;
      editor.state.doc.nodesBetween(0, selFrom, (node) => {
        if (node.type.name === 'sceneHeading') { sceneId = `scene-${sceneIdx}`; sceneIdx++; }
        return true;
      });

      const defaultColor = NOTE_COLORS[0];
      const noteId = addNote({
        content: '',
        anchorText: text.slice(0, 120),
        elementType: currentNodeType,
        contextLabel,
        color: defaultColor.name,
        sceneId,
      });

      const { tr } = editor.state;
      const markType = editor.schema.marks.scriptNote;
      if (markType) {
        tr.addMark(selFrom, selTo, markType.create({ noteId, color: defaultColor.hex }));
        editor.view.dispatch(tr);
        editor.emit('update', { editor, transaction: tr });
      }

      setNoteFilter({ elementType: null, contextLabel: null, color: null, noteId });
      openShelfTab('script');
    } else if (scriptTabShowing) {
      setActiveToolRight(null);
    } else {
      openShelfTab('script');
    }
  }, [editor, activeToolRight, setActiveToolRight, openShelfTab, addNote, setNoteFilter]);

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
  const leftTokens = zones.left;

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
          onMouseDown={(e) => { e.preventDefault(); document.execCommand(SCRAPBOOK_EXEC[key]); }}
        >
          {TOOLBAR_ICONS[key]}
        </button>
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
         beat was just closed on the Outline), Undo restores IT. */
      case 'undo': {
        const st = useEditorStore.getState();
        const beatWins = st.canBeatUndo && st.lastBeatEditAt > st.lastDocEditAt;
        return (
          <button
            className="toolbar-btn"
            title="Undo (⌘Z)"
            onClick={() => smartUndo(editor)}
            disabled={!beatWins && (!editor || typeof (editor.can() as any).undo !== 'function' || !(editor.can() as any).undo())}
          >
            <FaUndo />
          </button>
        );
      }
      case 'redo': {
        const st = useEditorStore.getState();
        const beatWins = st.canBeatRedo && st.lastBeatEditAt > st.lastDocEditAt;
        return (
          <button
            className="toolbar-btn"
            title="Redo (⇧⌘Z)"
            onClick={() => smartRedo(editor)}
            disabled={!beatWins && (!editor || typeof (editor.can() as any).redo !== 'function' || !(editor.can() as any).redo())}
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
      case 'insertSection': return (
        <button
          className="toolbar-btn"
          title="Insert Section"
          onClick={() => editor?.chain().focus().insertContent({ type: 'general', content: [{ type: 'text', text: '# ' }] }).run()}
        >
          <FaListOl />
        </button>
      );
      case 'insertNote': return (
        <button
          className="toolbar-btn"
          title="Insert Note"
          onClick={() => useEditorStore.getState().openShelfTab('script')}
        >
          <FaRegStickyNote />
        </button>
      );
      case 'insertChecklist': return (
        <button
          className="toolbar-btn"
          title="Add To-Do List"
          onClick={() => editor?.chain().focus().insertContent({ type: 'general', content: [{ type: 'text', text: '[ ] ' }] }).run()}
        >
          <FaCheckSquare />
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
          disabled={locked.bold}
          onClick={() => {
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
          disabled={locked.italic}
          onClick={() => {
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
          disabled={locked.underline}
          onClick={() => {
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
          disabled={locked.strikethrough}
          onClick={() => { if (!locked.strikethrough) editor?.chain().focus(undefined, { scrollIntoView: false }).toggleStrike().run(); }}
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
      case 'textColor': return (
        <div className="toolbar-group" style={{ position: 'relative' }}>
          <button
            className="toolbar-btn"
            title="Text Color"
            disabled={locked.textColor}
            onClick={(e) => {
              if (locked.textColor) return;
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setColorPopAnchor({ top: r.bottom + 4, left: r.left });
              setTextColorOpen(!textColorOpen);
              setBgColorOpen(false);
            }}
          >
            {/* v3.25, Derek: the A ALWAYS wears the picked color — black when
                black is chosen (the red-default special case is gone). */}
            <span
              className="fs-textcolor-icon"
              aria-hidden="true"
              style={{ color: currentTextColor }}
            >
              A
              <span className="fs-textcolor-bar" style={{ background: currentTextColor }} />
            </span>
          </button>
          {showPopups && textColorOpen && colorPopAnchor && createPortal(
            <div style={{ position: 'fixed', top: colorPopAnchor.top, left: colorPopAnchor.left, zIndex: 2147483647 }}>
              <ColorPicker
                value={currentTextColor}
                onChange={(color) => {
                  setCurrentTextColor(color || '#000000');
                  if (color) {
                    editor?.chain().focus(undefined, { scrollIntoView: false }).setColor(color).run();
                  } else {
                    editor?.chain().focus(undefined, { scrollIntoView: false }).unsetColor().run();
                  }
                  setTextColorOpen(false);
                }}
                onClose={() => setTextColorOpen(false)}
              />
            </div>,
            document.body,
          )}
        </div>
      );
      case 'highlightColor': return (
        <div className="toolbar-group" style={{ position: 'relative' }}>
          <button
            className="toolbar-btn"
            title="Highlight Color"
            disabled={locked.backgroundColor}
            onClick={(e) => {
              if (locked.backgroundColor) return;
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setColorPopAnchor({ top: r.bottom + 4, left: r.left });
              setBgColorOpen(!bgColorOpen);
              setTextColorOpen(false);
            }}
          >
            <FaHighlighter style={{ color: currentBgColor }} />
          </button>
          {showPopups && bgColorOpen && colorPopAnchor && createPortal(
            <div style={{ position: 'fixed', top: colorPopAnchor.top, left: colorPopAnchor.left, zIndex: 2147483647 }}>
              <ColorPicker
                value={currentBgColor}
                onChange={(color) => {
                  setCurrentBgColor(color || '#ffff00');
                  if (color) {
                    editor?.chain().focus(undefined, { scrollIntoView: false }).toggleHighlight({ color }).run();
                  } else {
                    editor?.chain().focus(undefined, { scrollIntoView: false }).unsetHighlight().run();
                  }
                  setBgColorOpen(false);
                }}
                onClose={() => setBgColorOpen(false)}
              />
            </div>,
            document.body,
          )}
        </div>
      );
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
          <FaSearch />
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
      case 'scriptNotes': return (
        <button
          className={`toolbar-btn${activeToolRight === 'scriptnotes' ? ' active' : ''}`}
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
      case 'zoom': return (
        <div className="zoom-menu-wrap" ref={zoomMenuRef}>
          {/* v3.04, Derek: step zoom straight from the toolbar. v3.48: the %
              is edited RIGHT HERE (click to type) — no popup that just repeats
              the stepper. A small caret keeps Reset / Fit within reach. */}
          <button
            className="toolbar-btn zoom-tb-step"
            title="Zoom out"
            disabled={zoomLevel <= ZOOM_MIN}
            onClick={() => setZoomLevel(Math.max(ZOOM_MIN, zoomLevel - 10))}
          ><CircleMinusIcon /></button>
          <span className="zoom-tb-mid">
            <FaSearchPlus className="zoom-tb-icon" />
            {zoomEditing ? (
              <input
                ref={zoomInputRef}
                className="zoom-tb-input"
                type="number"
                min={ZOOM_MIN}
                max={ZOOM_MAX}
                step={10}
                value={zoomInput}
                onChange={(e) => setZoomInput(e.target.value)}
                onBlur={commitZoom}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { commitZoom(); }
                  if (e.key === 'Escape') { setZoomInput(String(zoomLevel)); setZoomEditing(false); }
                }}
                autoFocus
              />
            ) : (
              <span
                className="toolbar-btn-text zoom-tb-value"
                title="Click to type an exact zoom"
                onClick={() => { setZoomEditing(true); setTimeout(() => zoomInputRef.current?.select(), 0); }}
              >{zoomLevel}%</span>
            )}
            <button
              className="zoom-tb-caret"
              title="Zoom options"
              onClick={() => setZoomMenuOpen((o) => !o)}
            >▾</button>
          </span>
          <button
            className="toolbar-btn zoom-tb-step"
            title="Zoom in"
            disabled={zoomLevel >= ZOOM_MAX}
            onClick={() => setZoomLevel(Math.min(ZOOM_MAX, zoomLevel + 10))}
          ><CirclePlusIcon /></button>
          {zoomMenuOpen && (
            <div className="zoom-menu">
              <button
                className="zoom-menu-item"
                onClick={() => { setZoomLevel(100); setZoomMenuOpen(false); }}
              >Reset</button>
              <button
                className="zoom-menu-item"
                onClick={() => { fitPageToScreen(); setZoomMenuOpen(false); }}
              >Fit Page to Screen</button>
              <button
                className="zoom-menu-item"
                onClick={() => { fitPageToWidth(); setZoomMenuOpen(false); }}
              >Scale to Max Width</button>
            </div>
          )}
        </div>
      );
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
      case 'insertTable': {
        if (!scrapbookOpen) return null;
        return (
          <div className="toolbar-group toolbar-tablegrid-anchor">
            <button
              className={`toolbar-btn${tableGridOpen ? ' active' : ''}`}
              disabled={!scrapbookPage}
              title={scrapbookPage ? 'Insert Table (Scrapbook)' : 'Insert Table — select a Scrapbook page first'}
              onClick={(e) => {
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setTableGridPos({ top: r.bottom + 4, left: r.left });
                setTableGridOpen(!tableGridOpen);
              }}
            >{TOOLBAR_ICONS.insertTable}</button>
            {showPopups && tableGridOpen && tableGridPos && createPortal(
              <div
                className="toolbar-tablegrid-popup toolbar-tablegrid-anchor"
                style={{ top: tableGridPos.top, left: tableGridPos.left }}
              >
                <TableGridPicker
                  onPick={(rows, cols) => {
                    window.dispatchEvent(new CustomEvent('nb-add-table-canvas', { detail: { rows, cols } }));
                    setTableGridOpen(false);
                  }}
                />
              </div>,
              document.body,
            )}
          </div>
        );
      }
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
            <option value="page">Page</option>
            <option value="continuous">Continuous</option>
            <option value="preview">Preview</option>
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
    const showPopups = !def.priority || !isHidden(def.priority);
    const cls = 'toolbar-priority-block'
      + (tall ? ' rib-tall' : '')
      + (def.desktopOnly ? ' toolbar-desktop-only' : '')
      + (def.zoom ? ' zoom-group' : '');
    return (
      <React.Fragment key={tok}>
        <div
          className={cls}
          data-key={def.key}
          {...(def.priority ? { 'data-priority': def.priority } : {})}
          // v2.97, Derek: in a one-row section every item is a BIG BUTTON —
          // large icon with its name underneath (drawn by CSS from this).
          // v3.38: the `view` control already draws its own "Editor View:"
          // caption, so the underneath label would repeat the name — skip it
          // for any builtin that captions itself.
          {...(tall && def.key !== 'view' ? { 'data-riblabel': def.label } : {})}
        >
          {renderBuiltinControl(def.key, false, showPopups)}
        </div>
        {def.key === 'zoomIn' && (
          <div className="toolbar-group zoom-mobile-group">
            <button
              className="toolbar-btn"
              title="Zoom"
              onClick={() => setZoomPanelOpen(!zoomPanelOpen)}
            >
              <FaSearchPlus />
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
        <button key={tok} className="toolbar-btn rib-tall rib-tall-btn" title={t.label} data-key={t.id} onClick={() => openTool(t.id)}>
          <span className="rib-tall-icon">{t.icon}</span>
          <span className="rib-tall-label">{t.label}</span>
        </button>
      ) : (
        <button key={tok} className="toolbar-btn" title={t.label} data-key={t.id} onClick={() => openTool(t.id)}>
          {t.icon}
        </button>
      );
    }
    if (tok.startsWith('c:')) {
      const c = commandDef(tok.slice(2));
      if (!c) return null;
      // v3.48, Derek: blur after running so a command button (e.g. Fit) doesn't
      // keep the focus ring lit blue — it's a one-shot action, not a toggle.
      const runCmd = (e: React.MouseEvent) => { c.run(); (e.currentTarget as HTMLElement).blur(); };
      return tall ? (
        <button key={tok} className="toolbar-btn rib-tall rib-tall-btn" title={c.label} data-key={c.id} onClick={runCmd}>
          <span className="rib-tall-icon">{c.icon}</span>
          <span className="rib-tall-label">{c.label}</span>
        </button>
      ) : (
        <button key={tok} className="toolbar-btn" title={c.label} data-key={c.id} onClick={runCmd}>
          {c.icon}
        </button>
      );
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

  /* v3.42, Derek: ONE renderer for a live section's inner rows (both zones
     read it, so the layout can't drift). A section's title sits ON TOP of its
     rows — first child of the section column, one- or two-row alike. */
  const liveSectionInner = (s: typeof sections[number]) => (
    <>
      {s.title && <div className="rib-sec-title">{s.title}</div>}
      <div className="rib-row">{s.top.map((t) => renderToken(t, !s.hasBreak))}</div>
      {s.hasBreak && s.breakLine && <div className="rib-row-line" />}
      {s.hasBreak && <div className="rib-row">{s.bottom.map((t) => renderToken(t, false))}</div>}
    </>
  );

  /* v3.36, Derek: EDIT MODE — while Customize > Toolbar is open the real bar
     IS the editor. Every ALL section renders (empty ones too, as drop
     targets), each item wrapped with a drag cover + remove ×, sections
     draggable to reorder and closeable. The drop indicators read from the
     store's ribEdit state; drops mutate toolbarLeft via ribbonDrag.ts. */
  const editDropline = <span className="rib-edit-dropline" />;
  // v3.67, Derek: drag a spacer's right edge to resize it. The handle sits
  // above the hover cover so it gets the pointer; we resize the .toolbar-spacer
  // element live and commit the new width to its s:<id>:<px> token on release.
  const startSpacerResize = (e: React.PointerEvent, tok: string) => {
    e.preventDefault();
    e.stopPropagation();   // don't start the item drag
    const item = (e.currentTarget as HTMLElement).closest('.rib-edit-item');
    const spacerEl = item?.querySelector('.toolbar-spacer') as HTMLElement | null;
    if (!spacerEl) return;
    const startX = e.clientX;
    const startW = spacerEl.getBoundingClientRect().width;
    let w = startW;
    const onMove = (ev: PointerEvent) => {
      w = Math.max(SPACER_MIN_PX, Math.min(SPACER_MAX_PX, startW + (ev.clientX - startX)));
      spacerEl.style.width = `${w}px`;
    };
    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      ribSetSpacerWidth(tok, w);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };
  const editItem = (tok: string, sec: number, row: 'top' | 'bottom', idx: number, big: boolean) => (
    <span
      key={`ei-${tok}`}
      className="rib-edit-item"
      data-sec={sec}
      data-row={row}
      data-idx={idx}
      onPointerDown={(e) => startRibbonDrag(e, `tok:${tok}`)}
    >
      {renderToken(tok, big)}
      {/* v3.42, Derek: hovering an item shows its NAME (on the cover, which is
          what the pointer actually sits over), not a generic helper string. */}
      <span className="rib-edit-cover" title={tokenLabel(tok)} />
      {tok.startsWith('s:') && (
        <span
          className="toolbar-spacer-resize"
          title="Drag to resize this spacer"
          onPointerDown={(e) => startSpacerResize(e, tok)}
        />
      )}
      <button
        className="rib-edit-x"
        title="Remove from the toolbar"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => ribRemoveToken(tok)}
      >×</button>
    </span>
  );
  const editRow = (s: typeof sections[number], sec: number, row: 'top' | 'bottom') => {
    const items = row === 'top' ? s.top : s.bottom;
    const showLine = (idx: number) => ribEdit.dragging && ribEdit.spot
      && ribEdit.spot.sec === sec && ribEdit.spot.row === row && ribEdit.spot.idx === idx;
    return (
      <div className="rib-row" data-sec={sec} data-row={row} data-len={items.length}>
        {items.map((tok, idx) => (
          <React.Fragment key={`eiw-${tok}`}>
            {showLine(idx) && editDropline}
            {editItem(tok, sec, row, idx, !s.hasBreak)}
          </React.Fragment>
        ))}
        {ribEdit.dragging && ribEdit.spot && ribEdit.spot.sec === sec && ribEdit.spot.row === row
          && ribEdit.spot.idx >= items.length && editDropline}
        {items.length === 0 && <span className="rib-edit-emptyhint">drop here</span>}
      </div>
    );
  };
  /* v3.38, Derek: the faint on-bar "+ Add" block. One sits at the end of the
     left-aligned run and, when an align split exists, one at the START of the
     right-aligned run (the left-most right item). Clicking opens a menu that
     builds sections / dividers / spacers / the split / any item — the same
     item list the Customize palette uses (ribbonPaletteData). */
  const addBlock = (at: number, rightSide: boolean) => (
    <button
      type="button"
      className="rib-edit-add"
      title="Add a section, divider, spacer, alignment split or item here"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setAddSearch('');
        setAddView('main');
        setAddMenu({ at, rightSide, x: r.left, y: r.bottom + 4 });
      }}
    >
      <span className="rib-edit-add-plus">+</span>
      <span className="rib-edit-add-label">Add</span>
    </button>
  );
  const editLayout = (
    <>
      {sections.map((s, i) => (
        <React.Fragment key={`esec-${i}`}>
          {ribEdit.secSpot === i && <span className="rib-edit-sec-dropline" />}
          {/* end of the left-aligned run — the +Add sits just before the gap */}
          {i === splitAt && addBlock(splitAt, false)}
          {i > 0 && (i === splitAt
            ? (
              <div className="rib-align-gap">
                <span className="rib-edit-alignsplit" title="Align Split — sections after this hug the right edge">
                  <FaExchangeAlt />
                  <button className="rib-edit-x" title="Remove the align split" onPointerDown={(e) => e.stopPropagation()} onClick={ribRemoveSplit}>×</button>
                </span>
              </div>
            )
            : <div className="toolbar-separator rib-section-sep" />)}
          {/* start of the right-aligned run — the left-most right item */}
          {i === splitAt && addBlock(splitAt, true)}
          <div
            className={`rib-section rib-edit-section${s.hasBreak ? '' : ' rib-single'}`}
            data-sec={i}
            title="Drag to move this section"
            onPointerDown={(e) => {
              const t = e.target as HTMLElement;
              if (t.closest('.rib-edit-item, .rib-edit-x, .rib-edit-cover, .rib-edit-break, .rib-row-line, input, select, button')) return;
              startRibbonDrag(e, `sec:${i}`);
            }}
          >
            {sections.length > 1 && (
              <button
                className="rib-edit-x rib-edit-secclose"
                title="Remove this section"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => ribCloseSection(i)}
              >×</button>
            )}
            {/* v3.50, Derek: EVERY section wears a title field on top — type to
                name it, leave it blank and nothing shows on the saved bar.
                (No more adding a title from + Add, no drag handle: the field is
                just always here.) Empty ⇒ drop the title from the model so it
                neither serializes nor renders live. */}
            <span className="rib-edit-sectitle-wrap">
              <input
                className="rib-edit-sectitle"
                value={s.title ?? ''}
                placeholder="title"
                title="Section title — leave blank for none"
                onPointerDown={(e) => e.stopPropagation()}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v.trim() === '') ribRemoveSectionTitle(i);
                  else ribSetSectionTitle(i, v);
                }}
              />
            </span>
            {editRow(s, i, 'top')}
            {s.hasBreak && (
              <div className="rib-edit-break">
                <span
                  className={`rib-row-line rib-edit-breakline${s.breakLine ? ' heavy' : ''}`}
                  title={s.breakLine ? 'Row split line: shown — click to hide' : 'Row split line: hidden — click to show'}
                  onClick={() => ribToggleBreakLine(i)}
                />
                <button className="rib-edit-x" title="Remove the row split" onPointerDown={(e) => e.stopPropagation()} onClick={() => ribRemoveBreak(i)}>×</button>
              </div>
            )}
            {s.hasBreak && editRow(s, i, 'bottom')}
          </div>
        </React.Fragment>
      ))}
      {ribEdit.secSpot === sections.length && <span className="rib-edit-sec-dropline" />}
      {/* no split → the single left run ends here; empty bar → the only +Add */}
      {splitAt === null && addBlock(sections.length, false)}
    </>
  );

  return (
    /* v2.96, Derek: the WORD RIBBON, arranged by SECTION. Everything between
       two full-height dividers is a section; items read left-to-right, an
       r: row break puts what follows on the section's second row, and a
       section with no break spans its items across both rows. Customize is
       fixed chrome at the right edge spanning both rows — the one big
       button. No spacing grips inside the toolbar (the menu bar keeps its). */
    <div className="toolbar-stack">
    <div
      className={`toolbar toolbar-ribbon${toolbarMode === 'comfortable' ? ' toolbar-comfortable' : ''}${toolbarMode === 'custom' ? ' toolbar-custom' : ''}${toolbarEditing ? ' toolbar-editing' : ''}`}
      style={{
        ...(toolbarMode === 'custom' ? ({
          ['--chrome-scale' as string]: String(chromeScaleFactor('toolbar', tbCustomH)),
        } as React.CSSProperties) : {}),
        ['--rib-rowh' as string]: `${ribRowH}px`,
        ['--rib-gap' as string]: `${chromeGapPx.toolbar}px`,
        // v3.34, Derek: user-set dropdown widths (dragged in the visual
        // editor) — one store, applied here AND in the editor's chips.
        ...Object.fromEntries(Object.entries(toolbarDdWidths).map(([k, v]) => [`--ddw-${k}`, `${v}px`])),
        // v2.72: measured so the first icons of the two bars align.
        ...(alignPad !== null ? { paddingLeft: alignPad } : {}),
      }}
      ref={toolbarRef}
    >
      {toolbarEditing ? editLayout : <>
      {leftLive.map(({ s, orig }, i) => (
        <React.Fragment key={`sec-${orig}`}>
          {/* v3.25: dividers only BETWEEN rendered sections — empty ones are
              skipped above, so nothing paints at the outer edges. */}
          {i > 0 && <div className="toolbar-separator rib-section-sep" />}
          <div className={`rib-section${s.hasBreak ? '' : ' rib-single'}`}>
            {liveSectionInner(s)}
          </div>
        </React.Fragment>
      ))}
      {/* v3.33, Derek: the Scrapbook section — injected while the tool is
          open, always the last left-aligned section. */}
      {scrapbookOpen && (
        <>
          {leftLive.length > 0 && <div className="toolbar-separator rib-section-sep" />}
          <div className="rib-section rib-scrapbook-sec">
            {/* v3.42, Derek: the tag sits CENTERED above the buttons (like a
                section title), and the section gets extra left padding. */}
            <span className="menu-section-tag rib-scrapbook-tag">Scrapbook</span>
            <div className="rib-scrapbook-body">
              <div className="rib-row">
                {/* v3.34/v3.61, Derek: the Scrapbook section carries its own
                    actions — Insert Picture (clicks the notebook's hidden file
                    input) + Insert Table. */}
                <button
                  className="toolbar-btn"
                  title="Insert Picture (Scrapbook)"
                  onClick={() => (document.getElementById('fs-nb-filepick') as HTMLInputElement | null)?.click()}
                ><FaImage /></button>
                {renderBuiltinToken('b:insertTable', false)}
              </div>
              {/* v3.74, Derek: Return to Editor rides here as a two-row big
                  button, beside the Scrapbook actions. */}
              <button
                className="toolbar-btn rib-tall rib-tall-btn rib-scrapbook-return"
                title="Return to Editor"
                onClick={() => closeNotebook()}
              >
                <span className="rib-tall-icon"><FaArrowLeft /></span>
                <span className="rib-tall-label">Return to Editor</span>
              </button>
            </div>
          </div>
        </>
      )}
      {/* v3.02, Derek: the align split — everything after it hugs the
          toolbar's right edge. */}
      {rightLive.length > 0 && <div className="rib-align-gap" />}
      {rightLive.map(({ s, orig }, i) => (
        <React.Fragment key={`sec-${orig}`}>
          {i > 0 && <div className="toolbar-separator rib-section-sep" />}
          <div className={`rib-section${s.hasBreak ? '' : ' rib-single'}`}>
            {liveSectionInner(s)}
          </div>
        </React.Fragment>
      ))}
      </>}
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
    {addMenu && (() => {
      const close = () => { setAddMenu(null); setAddSearch(''); setAddView('main'); };
      const act = (fn: () => void) => { fn(); close(); };
      // v3.41: each utility carries a larger visual representation (not just an
      // icon) so its shape reads at a glance.
      const vis = {
        single: <span className="rib-util-vis"><span className="ruv-sec"><span className="ruv-row" /></span></span>,
        double: <span className="rib-util-vis"><span className="ruv-sec"><span className="ruv-row" /><span className="ruv-row" /></span></span>,
        divider: <span className="rib-util-vis"><span className="ruv-divider" /></span>,
        spacer: <span className="rib-util-vis"><span className="ruv-spacer" /></span>,
        split: <span className="rib-util-vis"><span className="ruv-box" /><span className="ruv-splitgap"><span /><span /></span><span className="ruv-box" /></span>,
      };
      const structural = [
        { label: '1 Row Section', vis: vis.single, run: () => ribAddSectionAtBoundary('single', addMenu.at, addMenu.rightSide) },
        { label: '2 Row Section', vis: vis.double, run: () => ribAddSectionAtBoundary('double', addMenu.at, addMenu.rightSide) },
        { label: 'Divider', vis: vis.divider, run: () => ribAddInlineAtBoundary(`d:${Date.now()}`, addMenu.at, addMenu.rightSide) },
        { label: 'Spacer', vis: vis.spacer, run: () => ribAddInlineAtBoundary(`s:${Date.now()}`, addMenu.at, addMenu.rightSide) },
        ...(splitAt === null ? [{ label: 'Alignment Split', vis: vis.split, run: () => ribSetAlignSplit(addMenu.at) }] : []),
      ];
      const q = addSearch.trim().toLowerCase();
      const placedSet = new Set(leftTokens.map(stripTall));
      const cats = buildRibbonPalette((v) => placedSet.has(v))
        .map((c) => ({ ...c, options: c.options.filter((o) => !q || o.label.toLowerCase().includes(q)) }))
        .filter((c) => c.options.length > 0);
      return createPortal(
        <div className="rib-add-backdrop" onPointerDown={close}>
          <div
            className="rib-add-menu"
            style={{ top: addMenu.y, left: addMenu.x }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {addView === 'main' ? (
              // Utilities up front (each with a visual), items behind the submenu.
              <div className="rib-add-scroll">
                <div className="rib-add-utilgrid">
                  {structural.map((o) => (
                    <button key={o.label} className="rib-add-util" onClick={() => act(o.run)}>
                      {o.vis}
                      <span className="rib-add-util-label">{o.label}</span>
                    </button>
                  ))}
                </div>
                <div className="rib-add-sep" />
                <button
                  className="rib-add-opt rib-add-more"
                  onClick={() => { setAddSearch(''); setAddView('items'); }}
                >Add Item<span className="rib-add-caret">›</span></button>
              </div>
            ) : (
              <>
                <button className="rib-add-back" onClick={() => setAddView('main')}>‹ Back</button>
                <input
                  className="rib-add-search"
                  autoFocus
                  placeholder="Search items…"
                  value={addSearch}
                  onChange={(e) => setAddSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Escape') setAddView('main'); }}
                />
                <div className="rib-add-scroll">
                  {cats.map((c) => (
                    <div className="rib-add-group" key={c.id}>
                      <div className="rib-add-grouphdr">{c.label}</div>
                      {c.options.map((o) => (
                        <button
                          key={o.value}
                          className="rib-add-opt"
                          onClick={() => act(() => ribAddInlineAtBoundary(o.value, addMenu.at, addMenu.rightSide))}
                        >{o.label}</button>
                      ))}
                    </div>
                  ))}
                  {cats.length === 0 && <div className="rib-add-empty">No matches</div>}
                </div>
              </>
            )}
          </div>
        </div>,
        document.body,
      );
    })()}
    </div>
  );
};

export default Toolbar;
