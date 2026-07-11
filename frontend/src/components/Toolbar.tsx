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
  FaSearchPlus,
  FaSearchMinus,
  FaSearch,
  FaStickyNote,
  FaTags,
  FaPaintBrush,
  FaHighlighter,
  FaEllipsisV,
  FaHashtag,
  FaListOl, FaRegStickyNote, FaCheckSquare, FaFileAlt,
} from 'react-icons/fa';
import { ALL_TOOLS } from './ToolDock';
import { chromePx, chromeScaleFactor } from './chromeSizes';
import { commandDef } from './toolbarCommands';
import { TOOLBAR_BUILTINS, BUILTIN_BY_KEY, DEFAULT_TOOLBAR_LEFT, DEFAULT_TOOLBAR_RIGHT, normalizeToolbarZones } from './toolbarBuiltins';
import { useEditorStore, NOTE_COLORS } from '../stores/editorStore';
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
    toolbarMode, chromeCustomPx,
  } = useEditorStore();

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

  // Per-attribute locking state — updates reactively when cursor moves between elements
  const [locked, setLocked] = useState<LockedFormatting>({
    bold: false, italic: false, underline: false, strikethrough: false,
    textAlign: false, textColor: false, backgroundColor: false, textTransform: false,
    fontFamily: false, fontSize: false, subscript: false, superscript: false,
  });

  // Color picker state
  const [textColorOpen, setTextColorOpen] = useState(false);
  const [bgColorOpen, setBgColorOpen] = useState(false);
  const [currentTextColor, setCurrentTextColor] = useState<string>('#000000');
  const [currentBgColor, setCurrentBgColor] = useState<string>('#ffff00');

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
    //   1. Built-in screenplay element (sceneHeading, action, etc.) — direct setNode
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
    };
    window.addEventListener('freedraft:command', onCmd);
    return () => window.removeEventListener('freedraft:command', onCmd);
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

  // ── Responsive overflow ──────────────────────────────────────────────
  const toolbarRef = useRef<HTMLDivElement>(null);
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
      const containerWidth = toolbar.clientWidth;
      const groups = toolbar.querySelectorAll<HTMLElement>('[data-priority]');
      if (groups.length === 0) return;

      // Show all groups to measure natural widths
      groups.forEach(g => g.style.display = '');

      const OVERFLOW_BTN_WIDTH = 36;
      const allItems: { el: HTMLElement; key: string }[] = [];
      const newHidden = new Set<string>();

      let totalWidth = 0;
      for (const child of toolbar.children) {
        const el = child as HTMLElement;
        const w = el.offsetWidth;
        if (el.dataset.priority) {
          // CSS-hidden items (e.g. toolbar-desktop-only on mobile) have 0 width —
          // mark them as hidden so they appear in the overflow menu.
          if (w === 0) {
            newHidden.add(el.dataset.priority);
          } else {
            allItems.push({ el, key: el.dataset.priority });
          }
        }
        totalWidth += w + 2;
      }

      if (totalWidth > containerWidth) {
        let currentTotal = totalWidth + OVERFLOW_BTN_WIDTH;

        for (const prefix of HIDE_ORDER) {
          if (currentTotal <= containerWidth) break;
          const matching = allItems.filter(p => p.key.startsWith(prefix));
          for (const { el, key } of matching) {
            newHidden.add(key);
            currentTotal -= el.offsetWidth + 2;
            el.style.display = 'none';
          }
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
  }, []);

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
  const leftTokens = zones.left;
  const rightTokens = zones.right;

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
    switch (key) {
      case 'undo': return (
        <button
          className="toolbar-btn"
          title="Undo (⌘Z)"
          onClick={() => { try { editor?.chain().focus().undo().run(); } catch {} }}
          disabled={!editor || typeof (editor.can() as any).undo !== 'function' || !(editor.can() as any).undo()}
        >
          <FaUndo />
        </button>
      );
      case 'redo': return (
        <button
          className="toolbar-btn"
          title="Redo (⇧⌘Z)"
          onClick={() => { try { editor?.chain().focus().redo().run(); } catch {} }}
          disabled={!editor || typeof (editor.can() as any).redo !== 'function' || !(editor.can() as any).redo()}
        >
          <FaRedo />
        </button>
      );
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
          title="Insert Script Note"
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
            onClick={() => { if (!locked.textColor) { setTextColorOpen(!textColorOpen); setBgColorOpen(false); } }}
          >
            <FaPaintBrush style={{ color: currentTextColor }} />
          </button>
          {showPopups && textColorOpen && (
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
          )}
        </div>
      );
      case 'highlightColor': return (
        <div className="toolbar-group" style={{ position: 'relative' }}>
          <button
            className="toolbar-btn"
            title="Highlight Color"
            disabled={locked.backgroundColor}
            onClick={() => { if (!locked.backgroundColor) { setBgColorOpen(!bgColorOpen); setTextColorOpen(false); } }}
          >
            <FaHighlighter style={{ color: currentBgColor }} />
          </button>
          {showPopups && bgColorOpen && (
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
          title="Script Notes"
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
          <button
            className="toolbar-btn toolbar-btn-labeled"
            title="Zoom"
            onClick={() => setZoomMenuOpen((o) => !o)}
          >
            <FaSearchPlus />
            <span className="toolbar-btn-text">{zoomLevel}%</span>
          </button>
          {zoomMenuOpen && (
            <div className="zoom-menu">
              {/* First item: the current percentage, click to type an exact value. */}
              <div className="zoom-menu-value">
                {zoomEditing ? (
                  <input
                    ref={zoomInputRef}
                    className="zoom-input"
                    type="number"
                    min={ZOOM_MIN}
                    max={ZOOM_MAX}
                    step={10}
                    value={zoomInput}
                    onChange={(e) => setZoomInput(e.target.value)}
                    onBlur={commitZoom}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { commitZoom(); setZoomMenuOpen(false); }
                      if (e.key === 'Escape') { setZoomInput(String(zoomLevel)); setZoomEditing(false); }
                    }}
                    autoFocus
                  />
                ) : (
                  <span
                    className="zoom-label"
                    onClick={() => { setZoomEditing(true); setTimeout(() => zoomInputRef.current?.select(), 0); }}
                    title="Click to type an exact zoom"
                  >
                    {zoomLevel}%
                  </span>
                )}
              </div>
              <div className="zoom-menu-sep" />
              <button
                className="zoom-menu-item"
                disabled={zoomLevel >= ZOOM_MAX}
                onClick={() => setZoomLevel(Math.min(ZOOM_MAX, zoomLevel + 10))}
              ><FaSearchPlus /> Zoom In</button>
              <button
                className="zoom-menu-item"
                disabled={zoomLevel <= ZOOM_MIN}
                onClick={() => setZoomLevel(Math.max(ZOOM_MIN, zoomLevel - 10))}
              ><FaSearchMinus /> Zoom Out</button>
              <button
                className="zoom-menu-item"
                onClick={() => { setZoomLevel(100); setZoomMenuOpen(false); }}
              >Actual Size</button>
              <button
                className="zoom-menu-item"
                onClick={() => { fitPageToScreen(); setZoomMenuOpen(false); }}
              >Fit Page to Screen</button>
            </div>
          )}
        </div>
      );
      case 'view': return (
        <>
          <span className="view-style-label">Editor View:</span>
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
  const renderBuiltinToken = (tok: string): React.ReactNode => {
    const def = BUILTIN_BY_KEY[tok.slice(2)];
    if (!def) return null;
    const showPopups = !def.priority || !isHidden(def.priority);
    const cls = 'toolbar-priority-block'
      + (def.desktopOnly ? ' toolbar-desktop-only' : '')
      + (def.zoom ? ' zoom-group' : '');
    return (
      <React.Fragment key={tok}>
        <div className={cls} {...(def.priority ? { 'data-priority': def.priority } : {})}>
          {renderBuiltinControl(def.key, false, showPopups)}
          {def.sepAfter && <div className="toolbar-separator" />}
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
  const presentKeys = new Set(
    [...leftTokens, ...rightTokens].filter((t) => t.startsWith('b:')).map((t) => t.slice(2)),
  );
  let overflowContent: React.ReactNode[] | null = null;
  if (hiddenPriorities.size > 0) {
    const items: React.ReactNode[] = [];
    for (const prefix of ['5', '4', '3', '2', '1']) {
      if (!isHidden(prefix)) continue;
      const defs = TOOLBAR_BUILTINS.filter((d) => d.priority?.startsWith(prefix) && presentKeys.has(d.key));
      if (defs.length === 0) continue;
      if (items.length > 0) items.push(<div className="toolbar-overflow-sep" key={`ovsep-${prefix}`} />);
      items.push(
        <div className="toolbar-group" key={`ov-${prefix}`}>
          {defs.map((d) => <React.Fragment key={d.key}>{renderBuiltinControl(d.key, true, true)}</React.Fragment>)}
        </div>,
      );
    }
    overflowContent = items.length ? items : null;
  }

  const renderToken = (tok: string): React.ReactNode => {
    if (tok.startsWith('d:')) {
      return <div key={tok} className="toolbar-separator toolbar-user-divider" />;
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
          className="toolbar-spacer"
          style={Number.isFinite(px) && px > 0 ? { width: px } : undefined}
        />
      );
    }
    if (tok.startsWith('t:')) {
      const t = ALL_TOOLS.find((x) => x.id === tok.slice(2));
      if (!t) return null;
      return (
        <button key={tok} className="toolbar-btn" title={t.label} onClick={() => openTool(t.id)}>
          {t.icon}
        </button>
      );
    }
    if (tok.startsWith('c:')) {
      const c = commandDef(tok.slice(2));
      if (!c) return null;
      return (
        <button key={tok} className="toolbar-btn" title={c.label} onClick={() => c.run()}>
          {c.icon}
        </button>
      );
    }
    if (tok.startsWith('b:')) return renderBuiltinToken(tok);
    return null;
  };

  const tbCustomH = chromePx('toolbar', 'custom', chromeCustomPx.toolbar);

  return (
    <div
      className={`toolbar${toolbarMode === 'comfortable' ? ' toolbar-comfortable' : ''}${toolbarMode === 'custom' ? ' toolbar-custom' : ''}`}
      style={toolbarMode === 'custom' ? ({
        height: tbCustomH,
        ['--chrome-scale' as string]: String(chromeScaleFactor('toolbar', tbCustomH)),
      } as React.CSSProperties) : undefined}
      ref={toolbarRef}
    >
      {leftTokens.map(renderToken)}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Overflow 3-dot menu */}
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

      {rightTokens.map(renderToken)}
    </div>
  );
};

export default Toolbar;
