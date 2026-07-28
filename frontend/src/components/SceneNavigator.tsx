import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Editor } from '@tiptap/react';
import { useEditorStore, EMPTY_SCENE_FILTERS, type SceneFilters } from '../stores/editorStore';
import type { LocationFilter, LocationSort } from '../stores/slices/sceneNavSlice';
import { PAGES_THUMB_MIN, PAGES_THUMB_MAX, PAGES_THUMB_STEP } from '../stores/slices/sceneNavSlice';
import { CircleMinusIcon, CirclePlusIcon } from './uiIcons';
import { computeSceneLengths, computePageBlocks, type PageContentInfo } from '../editor/pagination';
import { computeSceneTiming, formatSceneDuration } from '../utils/scriptTiming';
import { SCENE_SWATCH_COLORS } from '../utils/palettes';
import { computeScriptStructure, sceneActLabel, type ScriptStructure } from '../utils/scriptStructure';
import { parseHeading, computeSceneFilterDetails, sceneFilterOptions, filterSceneIndices, countActiveSceneFilters, type SceneFilterDetail } from '../utils/sceneFilters';
import { useSceneReorder } from '../utils/useSceneReorder';
import { ControlDropdown, ControlSearch, ToolActionRow } from './ToolControls';
import { SceneReorderBar } from './IndexCards';
import { LuLayoutGrid, LuList } from 'react-icons/lu';
import { FaChevronRight, FaChevronDown } from 'react-icons/fa';

interface SceneNavigatorProps {
  editor: Editor | null;
  scrollContainer?: HTMLDivElement | null;
  /** Which view to render — each view is now its own tool in the left dock. */
  view: NavTab;
}

export type NavTab = 'scenes' | 'pages' | 'locations' | 'structure';

// The scene heading parser lives in utils/sceneFilters.ts now (v4.35
// batch-v9 #2) — the Cards view's filter predicate needs the same parse.

// ── Location grouping ───────────────────────────────────────────────────

interface LocationGroup {
  name: string;
  sceneIndices: number[];
  headings: string[];
  prefixes: string[];
  times: string[];
  preambles: string[];
}

function groupByLocation(scenes: Array<{ heading: string }>): LocationGroup[] {
  const map = new Map<string, LocationGroup>();
  scenes.forEach((scene, index) => {
    const parsed = parseHeading(scene.heading);
    const key = parsed.location.toUpperCase();
    if (!key) return;
    let group = map.get(key);
    if (!group) {
      group = { name: parsed.location, sceneIndices: [], headings: [], prefixes: [], times: [], preambles: [] };
      map.set(key, group);
    }
    group.sceneIndices.push(index);
    group.headings.push(scene.heading);
    group.prefixes.push(parsed.prefix);
    group.times.push(parsed.timeOfDay);
    group.preambles.push(parsed.preamble.replace(/[\s.]+$/, ''));
  });
  return Array.from(map.values());
}

/** v4.92, Derek: the Locations window's Filter / Sort / Search, as one pure
 *  function over the grouped list.
 *
 *  INT/EXT comes off the scene PREFIXES a location was seen with, and a
 *  location can legitimately be both ("INT./EXT. CAR") or appear interior in
 *  one scene and exterior in another — so the test is "has any scene of this
 *  kind", not "is this kind". Filtering to Interior therefore keeps a location
 *  you sometimes shoot inside, which is what a location list is for.
 *
 *  'scene' order is the order groupByLocation produced — first appearance —
 *  which is the order this list has always used, so it stays the default.
 *  v4.93, Derek asked for "scene order" as an option; this IS that order, so
 *  it was renamed rather than duplicated — a second entry sorting the list
 *  the same way would be two controls doing one job. */
export function visibleLocations(
  all: LocationGroup[],
  { search, filter, sort }: { search: string; filter: LocationFilter; sort: LocationSort },
): LocationGroup[] {
  const q = search.trim().toLowerCase();
  const kept = all.filter((loc) => {
    if (q && !loc.name.toLowerCase().includes(q)) return false;
    if (filter === 'all') return true;
    const wanted = filter === 'int' ? 'INT' : 'EXT';
    return loc.prefixes.some((p) => (p || '').toUpperCase().includes(wanted));
  });
  if (sort === 'name') return [...kept].sort((a, b) => a.name.localeCompare(b.name));
  // Most-used first; ties keep scene order, so the list never shuffles at random.
  if (sort === 'count') return [...kept].sort((a, b) => b.sceneIndices.length - a.sceneIndices.length);
  return kept;
}

/** v4.94, Derek: the Pages window's search. A page matches when any of its
 *  text contains the query — the question this answers is "which page is that
 *  line on?", so it reads the page's OWN blocks rather than scene headings.
 *  Page numbers are kept as they are: a filtered list still says "Page 7",
 *  because renumbering the survivors 1..n would be a lie about the script. */
export function pagesMatching(pages: PageContentInfo[], query: string): PageContentInfo[] {
  const q = query.trim().toLowerCase();
  if (!q) return pages;
  return pages.filter((p) => p.blocks.some((b) => (b.text || '').toLowerCase().includes(q)));
}

// ── Search highlight helper ─────────────────────────────────────────────

function highlightText(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const lower = text.toLowerCase();
  const qLower = query.toLowerCase();
  const idx = lower.indexOf(qLower);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="navigator-search-highlight">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}

// ── Scene detail helpers ────────────────────────────────────────────────

/** The shared filter detail (utils/sceneFilters.ts) plus the list-only
 *  page length. */
interface SceneDetail extends SceneFilterDetail {
  pageLength: number;
}

function formatPageLength(pages: number): string {
  const n = Number(pages.toFixed(2));
  return `${n} ${n <= 1 ? 'page' : 'pages'}`;
}

// ── Scene Length Icon ────────────────────────────────────────────────────

function getPageFillStyle(pages: number): { color: string; opacity: number } {
  if (pages <= 1) return { color: 'var(--fd-accent)', opacity: 0.6 };
  const t = Math.min((pages - 1) / 4, 1); // 0 at 1 page, 1 at 5+ pages
  const hue = Math.round(120 * (1 - t)); // green(120) → red(0)
  const sat = 65 + Math.round(t * 25);   // 65% → 90%
  const lit = 50 - Math.round(t * 10);   // 50% → 40%
  const opacity = 0.65 + t * 0.3;        // 0.65 → 0.95
  return { color: `hsl(${hue}, ${sat}%, ${lit}%)`, opacity };
}

const SceneLengthIcon: React.FC<{ pages: number }> = React.memo(({ pages }) => {
  const wholePgs = Math.floor(pages);
  const fraction = pages - wholePgs;
  const FILL_TOP = 2.5;
  const FILL_BOT = 14;
  const FILL_H = FILL_BOT - FILL_TOP; // 11.5 — full interior height
  const fillH = (fraction > 0 ? fraction : 1) * FILL_H;
  const { color: fillColor, opacity: fillOpacity } = getPageFillStyle(pages);
  // For multi-page scenes, fill the remaining top portion with the previous page's color
  const showBg = pages > 1 && fraction > 0;
  const bgStyle = showBg ? getPageFillStyle(wholePgs) : null;
  return (
    <svg width="14" height="16" viewBox="0 0 14 16" style={{ flexShrink: 0 }}>
      {wholePgs >= 2 && (
        <rect x="3.5" y="0" width="9.5" height="13.5" rx="1" fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.2" />
      )}
      {wholePgs >= 1 && pages > 1 && (
        <rect x="2.5" y="0.5" width="9.5" height="13.5" rx="1" fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.3" />
      )}
      <rect x="1" y="1.5" width="9.5" height="13" rx="1" fill="none" stroke="currentColor" strokeWidth="0.7" opacity="0.5" />
      {bgStyle && (
        <rect x="2" y={FILL_TOP} width="7.5" height={FILL_H} fill={bgStyle.color} opacity={bgStyle.opacity} rx="0.5" />
      )}
      <rect x="2" y={FILL_BOT - fillH} width="7.5" height={fillH} fill={fillColor} opacity={fillOpacity} rx="0.5" className="scene-length-fill" />
    </svg>
  );
});

// ── Page thumbnail: exact-match layout constants (same as pagination.ts) ─

const FD_INDENTS: Record<string, [number, number]> = {
  sceneHeading: [1.50, 7.50], action: [1.50, 7.50],
  character: [3.50, 7.50], dialogue: [2.50, 6.00],
  parenthetical: [3.00, 5.50], transition: [5.50, 7.50],
  general: [1.50, 7.50], shot: [1.50, 7.50],
  newAct: [1.50, 7.50], endOfAct: [1.50, 7.50],
  lyrics: [2.50, 6.00], showEpisode: [1.50, 7.50],
  castList: [1.50, 7.50],
};

const SPACE_BEFORE: Record<string, number> = {
  sceneHeading: 1, action: 1, character: 1, dialogue: 0,
  parenthetical: 0, transition: 1, general: 0, shot: 1,
  newAct: 2, endOfAct: 2, lyrics: 0, showEpisode: 1, castList: 0,
};

const LINE_HEIGHT_PX = 12 * (96 / 72); // 16px — matches pagination LINE_HEIGHT_PT

// ── Main component ──────────────────────────────────────────────────────

const SceneNavigator: React.FC<SceneNavigatorProps> = ({ editor, scrollContainer, view }) => {
  const { scenes, updateSceneSynopsis } = useEditorStore();
  const pageLayout = useEditorStore((s) => s.pageLayout);
  const fontFamily = useEditorStore((s) => s.fontFamily);
  const fontSize = useEditorStore((s) => s.fontSize);
  const activeTab = view;
  const [expandedLocation, setExpandedLocation] = useState<string | null>(null);
  const [renamingLocation, setRenamingLocation] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Expanded scene (shows synopsis inline)

  // v3.54, Derek: the search + filters live in the store — the window chrome
  // (SceneTitleExtra count, SceneControls cluster) renders them outside this
  // body. The body just reads them and publishes the derived option lists +
  // count back (setSceneNavData) for the chrome to show.
  const searchQuery = useEditorStore((s) => s.sceneSearch);
  const sceneFilters = useEditorStore((s) => s.sceneFilters);
  const setSceneNavData = useEditorStore((s) => s.setSceneNavData);

  // v4.35 batch-v9 #2: reorder works in the LIST too — the same deferred
  // snapshot machinery as the card wall (shared hook), the same context bar.
  // Only the scenes view owns the flag: Pages/Locations/Structure share this
  // component and must not cancel a reorder on their unmount.
  const reorder = useSceneReorder(editor, view === 'scenes');
  // HTML5-DnD state for the reorder rows (scene id being dragged)
  const [dragRowId, setDragRowId] = useState<string | null>(null);

  // Page preview state
  const pageGridRef = useRef<HTMLDivElement>(null);
  /* v5.03, Derek: resizable scene-list columns. The widths live in the store
     (persisted) and reach the grid as CSS variables on this root — the header
     row and every data row read the SAME two variables, so they cannot
     disagree. During a drag the variable is written straight to the element
     and the store is left alone; committing on every pointermove would
     re-render the whole list per pixel. */
  const navRootRef = useRef<HTMLDivElement>(null);
  const sceneColWidths = useEditorStore((s) => s.sceneColWidths);
  const setSceneColWidth = useEditorStore((s) => s.setSceneColWidth);
  const COL_LIMITS = { head: { min: 90, max: 900, varName: '--scene-col-head', dir: 1 },
                       metrics: { min: 74, max: 260, varName: '--scene-metrics-w', dir: -1 } } as const;

  const startColResize = (key: 'head' | 'metrics') => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();                       // the header sits on the row; don't start a row drag
    const { min, max, varName, dir } = COL_LIMITS[key];
    const startX = e.clientX;
    const startW = sceneColWidths[key];
    const grip = e.currentTarget as HTMLElement;
    grip.setPointerCapture(e.pointerId);
    let w = startW;
    // dir: the metrics grip is on that column's LEFT edge, so dragging right
    // makes it NARROWER. Without this the metrics column ran the wrong way.
    const onMove = (ev: PointerEvent) => {
      w = Math.max(min, Math.min(max, startW + dir * (ev.clientX - startX)));
      navRootRef.current?.style.setProperty(varName, `${w}px`);
    };
    const onUp = () => {
      grip.releasePointerCapture(e.pointerId);
      grip.removeEventListener('pointermove', onMove);
      grip.removeEventListener('pointerup', onUp);
      setSceneColWidth(key, w);
    };
    grip.addEventListener('pointermove', onMove);
    grip.addEventListener('pointerup', onUp);
  };

  const [thumbScale, setThumbScale] = useState(0.35);
  const [currentVisiblePage, setCurrentVisiblePage] = useState(1);

  /* v5.03: the synopsis MODAL is gone from this view. Its only entry point
     was the Edit / + Add button inside the click-to-expand panel Derek asked
     to remove, so it became unreachable code the moment that panel went. The
     modal itself still lives (IndexCards opens it), and with it the scene
     COLOUR picker and the runtime override — Cards view only, for now. */

  /* v5.02: the ONE place scene-heading attrs are written back to the document.
     The synopsis is now editable from two places — the inline field on the row
     and the synopsis modal — and a second copy of this walk is exactly how the
     two would drift. Both go through here. */
  const setSceneHeadingAttrs = useCallback(
    (sceneIdx: number, attrs: Record<string, unknown>) => {
      if (!editor) return;
      let currentScene = -1;
      let targetPos = -1;
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'sceneHeading') {
          currentScene++;
          if (currentScene === sceneIdx) { targetPos = pos; return false; }
        }
        return true;
      });
      if (targetPos < 0) return;
      const node = editor.state.doc.nodeAt(targetPos);
      if (!node) return;
      const { tr } = editor.state;
      tr.setNodeMarkup(targetPos, undefined, { ...node.attrs, ...attrs });
      tr.setMeta('addToHistory', false);
      editor.view.dispatch(tr);
    },
    [editor],
  );

  /** Store + document, together — a synopsis written to only one of them
   *  reappears as the old text the next time the scenes are rescanned. */
  const writeSceneSynopsis = useCallback(
    (sceneIdx: number, id: string, synopsis: string) => {
      updateSceneSynopsis(id, synopsis);
      setSceneHeadingAttrs(sceneIdx, { synopsis });
    },
    [updateSceneSynopsis, setSceneHeadingAttrs],
  );

  const allLocations = useMemo(() => groupByLocation(scenes), [scenes]);
  // v4.92: the header's Filter / Sort / Search drive the list through the
  // store — one state, so the controls can't be decorative.
  const locSearch = useEditorStore((s) => s.locationSearch);
  const locFilter = useEditorStore((s) => s.locationFilter);
  const locSort = useEditorStore((s) => s.locationSort);
  const locations = useMemo(
    () => visibleLocations(allLocations, { search: locSearch, filter: locFilter, sort: locSort }),
    [allLocations, locSearch, locFilter, locSort],
  );

  useEffect(() => {
    if (renamingLocation && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingLocation]);

  // ── Compute scene details (characters, location, length) ──
  // The doc walk is the shared computeSceneFilterDetails (the predicate's
  // input, same one the Cards view builds); only pageLength is list-only.

  const sceneDetails = useMemo((): SceneDetail[] => {
    if (!editor) return [];
    const doc = editor.state.doc;
    const lengths = computeSceneLengths(doc, pageLayout);
    return computeSceneFilterDetails(doc).map((d, i) => ({ ...d, pageLength: lengths[i] || 0 }));
  }, [editor, scenes, pageLayout]);

  // ── Compute scene timing ──

  const sceneTimings = useMemo(() => {
    if (!editor) return [];
    try {
      const doc = editor.getJSON();
      return computeSceneTiming(doc).scenes;
    } catch {
      return [];
    }
  }, [editor, scenes]);

  // ── Compute act/sequence structure ──

  const structure: ScriptStructure = useMemo(() => {
    if (!editor) return { acts: [], sceneActMap: new Map(), totalScenes: 0 };
    try {
      return computeScriptStructure(editor.getJSON());
    } catch {
      return { acts: [], sceneActMap: new Map(), totalScenes: 0 };
    }
  }, [editor, scenes]);

  // ── Collapsed acts / sequences (Structure tab state) ──
  const [collapsedActs, setCollapsedActs] = useState<Set<number>>(new Set());
  const [collapsedSequences, setCollapsedSequences] = useState<Set<string>>(new Set());

  const toggleAct = useCallback((actNumber: number) => {
    setCollapsedActs((prev) => {
      const next = new Set(prev);
      if (next.has(actNumber)) next.delete(actNumber); else next.add(actNumber);
      return next;
    });
  }, []);

  const toggleSequence = useCallback((seqId: string) => {
    setCollapsedSequences((prev) => {
      const next = new Set(prev);
      if (next.has(seqId)) next.delete(seqId); else next.add(seqId);
      return next;
    });
  }, []);

  // ── Compute page blocks for page preview ──

  const pageContent = useMemo((): PageContentInfo[] => {
    if (!editor) return [];
    return computePageBlocks(editor.state.doc, pageLayout);
  }, [editor, scenes, pageLayout]);

  // v4.94: the Pages header's search + preview scale (chrome controls, body
  // list — one state, so neither can be decorative).
  const pagesSearch = useEditorStore((s) => s.pagesSearch);
  const pagesThumbPx = useEditorStore((s) => s.pagesThumbPx);
  const shownPages = useMemo(() => pagesMatching(pageContent, pagesSearch), [pageContent, pagesSearch]);

  // ── Exact-match page layout for thumbnails ──

  // Reference width = actual page width in CSS px (inches × 96 DPI)
  const refWidthPx = useMemo(() => pageLayout.pageWidth * 96, [pageLayout.pageWidth]);

  // Inline style for the page content container — matches editor's .page element
  const pageContentStyle = useMemo((): React.CSSProperties => ({
    width: `${refWidthPx}px`,
    paddingTop: `${pageLayout.topMargin}pt`,
    paddingBottom: `${pageLayout.bottomMargin}pt`,
    paddingLeft: `${pageLayout.leftMargin}in`,
    paddingRight: `${pageLayout.rightMargin}in`,
    fontFamily: `'${fontFamily}', 'Courier New', Courier, monospace`,
    fontSize: `${fontSize}pt`,
    lineHeight: `${LINE_HEIGHT_PX}px`,
  }), [refWidthPx, pageLayout, fontFamily, fontSize]);

  // Per-element inline style — same indentation as the editor
  const getBlockStyle = useCallback((typeName: string, isFirst: boolean): React.CSSProperties => {
    const [left, right] = FD_INDENTS[typeName] || [1.50, 7.50];
    const padL = Math.max(0, (left - pageLayout.leftMargin) * 96);
    const padR = Math.max(0, (pageLayout.pageWidth - right - pageLayout.rightMargin) * 96);
    const sb = isFirst ? 0 : (SPACE_BEFORE[typeName] ?? 0);
    return {
      paddingLeft: padL > 0 ? `${padL}px` : undefined,
      paddingRight: padR > 0 ? `${padR}px` : undefined,
      marginTop: sb > 0 ? `${sb * LINE_HEIGHT_PX}px` : undefined,
    };
  }, [pageLayout]);

  // ── ResizeObserver for thumbnail scaling ──

  useEffect(() => {
    if (activeTab !== 'pages' || !pageGridRef.current) return;
    const grid = pageGridRef.current;
    const measure = () => {
      const firstThumb = grid.querySelector('.page-thumbnail') as HTMLElement;
      if (firstThumb) {
        setThumbScale(Math.max(0.05, firstThumb.clientWidth / refWidthPx));
      }
    };
    const observer = new ResizeObserver(measure);
    // v4.95, Derek ("the text does not scale with the page size"): observe the
    // THUMBNAIL, not just the scroll container. The scaling buttons change the
    // grid's COLUMN width — the container's own width never moves — so an
    // observer watching only the container never fired, the white page grew
    // and the text kept the width it was scaled for. Grid stays observed for
    // real container resizes (auto-fill retunes the columns then).
    observer.observe(grid);
    const firstThumb = grid.querySelector('.page-thumbnail') as HTMLElement | null;
    if (firstThumb) observer.observe(firstThumb);
    measure();
    return () => observer.disconnect();
  }, [activeTab, pageContent.length, refWidthPx, pagesThumbPx]);

  // ── Scroll sync: highlight current page in editor ──

  useEffect(() => {
    if (activeTab !== 'pages' || !scrollContainer || !editor || pageContent.length === 0) return;

    let rafId = 0;
    const handleScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const rect = scrollContainer.getBoundingClientRect();
        const viewY = rect.top + rect.height / 3;
        try {
          const pos = editor.view.posAtCoords({ left: rect.left + rect.width / 2, top: viewY });
          if (!pos) return;
          let page = 1;
          for (let i = pageContent.length - 1; i >= 0; i--) {
            if (pageContent[i].blocks.length > 0 && pageContent[i].blocks[0].docPos <= pos.pos) {
              page = pageContent[i].pageNumber;
              break;
            }
          }
          if (page !== currentVisiblePage) {
            setCurrentVisiblePage(page);
            const thumbEl = pageGridRef.current?.querySelector(`[data-page="${page}"]`) as HTMLElement;
            if (thumbEl) thumbEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
        } catch { /* editor coords may not be available */ }
      });
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // initial sync
    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(rafId);
    };
  }, [activeTab, scrollContainer, editor, pageContent, currentVisiblePage]);

  // ── Filter dropdown options ──

  const filterOptions = useMemo(() => sceneFilterOptions(sceneDetails), [sceneDetails]);

  // ── Filtered scene indices ──
  // The predicate itself lives in utils/sceneFilters.ts — the ONE filter both
  // the list and the Cards view apply (v4.35 batch-v9 #2).

  const hasActiveFilter = countActiveSceneFilters(sceneFilters) > 0;

  const filteredIndices = useMemo(
    () => filterSceneIndices(scenes, sceneDetails, sceneFilters, searchQuery),
    [scenes, sceneDetails, sceneFilters, searchQuery],
  );

  // v3.54: publish the count + filter option lists for the window chrome
  // (SceneTitleExtra / SceneControls), which renders outside this body. Scenes
  // view only (the Pages / Locations tools share this component but have no
  // such chrome).
  useEffect(() => {
    if (activeTab !== 'scenes') return;
    setSceneNavData({
      filtered: filteredIndices.length,
      total: scenes.length,
      ...filterOptions,
    });
  }, [activeTab, filteredIndices.length, scenes.length, filterOptions, setSceneNavData]);

  // v4.32 batch-v8 #11/#12: the Pages / Locations / Structure windows carry
  // their count beside the window title now (the template's TitleExtra slot,
  // reading toolCounts) — their in-body title rows are gone.
  useEffect(() => {
    const s = useEditorStore.getState();
    if (activeTab === 'locations') s.setToolCount('locations', locations.length);
    else if (activeTab === 'pages') s.setToolCount('pages', pageContent.length);
    else if (activeTab === 'structure') {
      s.setToolCount('structure', structure.acts.filter((a) => a.actNumber > 0).length);
    }
  }, [activeTab, locations.length, pageContent.length, structure]);

  // ── Navigate to a scene by index ──

  /* v5.04: the click only says WHERE. ScreenplayEditor does the focus and the
     scroll (see requestEditorScroll) — it is the one component that survives a
     fullscreen takeover being lowered, which is exactly when this used to fail:
     clicking a scene in a fullscreen Scenes list did nothing at all. */
  const goToScene = useCallback(
    (sceneIndex: number) => {
      if (!editor) return;
      const { doc } = editor.state;
      let currentScene = -1;
      let targetPos = 0;
      doc.descendants((node, pos) => {
        if (node.type.name === 'sceneHeading') {
          currentScene++;
          if (currentScene === sceneIndex) { targetPos = pos; return false; }
        }
        return true;
      });
      // Clicking a scene means "take me there", so the takeover steps aside.
      const s = useEditorStore.getState();
      if (s.fullscreenTool) s.setFullscreenTool(null);
      s.requestEditorScroll(targetPos + 1);
    },
    [editor],
  );

  // ── Navigate to a document position ──

  const goToPosition = useCallback(
    (pos: number) => {
      if (!editor) return;
      editor.chain().focus().setTextSelection(pos + 1).run();
      requestAnimationFrame(() => {
        const coords = editor.view.coordsAtPos(pos + 1);
        if (scrollContainer) {
          const containerRect = scrollContainer.getBoundingClientRect();
          const scrollTo = scrollContainer.scrollTop + (coords.top - containerRect.top) - 60;
          scrollContainer.scrollTo({ top: scrollTo, behavior: 'auto' });
        }
      });
    },
    [editor, scrollContainer],
  );

  // ── Handle page thumbnail click ──

  const setPagesThumbPx = useEditorStore((s) => s.setPagesThumbPx);
  const [gotoPage, setGotoPage] = useState('');
  /** v5.01: jump to a typed page — scroll its thumbnail into view and take the
   *  script to the page's first block, which is what clicking it does. A
   *  number that isn't a page is left in the field rather than silently
   *  ignored, so a typo is visible. */
  const goToPageNumber = useCallback((raw: string) => {
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n)) return;
    const page = pageContent.find((p) => p.pageNumber === n);
    if (!page) return;
    const el = pageGridRef.current?.querySelector(`[data-page="${n}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const first = page.blocks[0];
    if (first) goToPosition(first.docPos);
  }, [pageContent, goToPosition]);

  const handlePageClick = useCallback(
    (page: PageContentInfo, e: React.MouseEvent<HTMLDivElement>) => {
      if (!editor || page.blocks.length === 0) return;
      const contentEl = e.currentTarget.querySelector('.page-thumb-content') as HTMLElement;
      if (!contentEl) return;
      const children = Array.from(contentEl.children) as HTMLElement[];
      const clickY = e.clientY;
      let bestIdx = 0;
      let bestDist = Infinity;
      children.forEach((child, idx) => {
        const rect = child.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        const dist = Math.abs(clickY - mid);
        if (dist < bestDist) { bestDist = dist; bestIdx = idx; }
      });
      const block = page.blocks[bestIdx];
      if (block) goToPosition(block.docPos);
    },
    [editor, goToPosition],
  );

  // ── Batch rename a location across all scene headings ──

  const handleRenameSubmit = useCallback(() => {
    if (!editor || !renamingLocation || !renameValue.trim()) {
      setRenamingLocation(null);
      return;
    }
    const oldName = renamingLocation;
    const newName = renameValue.trim();
    if (oldName === newName) { setRenamingLocation(null); return; }

    const { doc, schema, tr } = editor.state;
    const sceneHeadingType = schema.nodes.sceneHeading;
    if (!sceneHeadingType) { setRenamingLocation(null); return; }

    doc.descendants((node, pos) => {
      if (node.type.name !== 'sceneHeading') return true;
      const heading = node.textContent;
      const parsed = parseHeading(heading);
      if (parsed.location.toUpperCase() !== oldName.toUpperCase()) return true;
      let newHeading = parsed.preamble;
      if (parsed.prefix) newHeading += parsed.prefix + ' ';
      newHeading += newName;
      if (parsed.timeOfDay) {
        const usesDot = /\.\s*\w+\.?\s*$/.test(heading) && !/\s-\s/.test(heading);
        newHeading += usesDot ? '. ' + parsed.timeOfDay + '.' : ' - ' + parsed.timeOfDay;
      }
      tr.insertText(newHeading, pos + 1, pos + 1 + heading.length);
      return true;
    });

    if (tr.steps.length > 0) editor.view.dispatch(tr);
    setRenamingLocation(null);
    setExpandedLocation(newName.toUpperCase());
  }, [editor, renamingLocation, renameValue]);

  return (
    <>
    <div
      className="scene-navigator scene-navigator-embed"
      ref={navRootRef}
      style={{ '--scene-col-head': `${sceneColWidths.head}px`, '--scene-metrics-w': `${sceneColWidths.metrics}px` } as React.CSSProperties}
    >

      {/* ── Scenes tab ───────────────────────────────────────────────── */}
      {/* v4.27, Derek: the count sits beside the window title
          (SceneTitleExtra) and the controls in the row-2 cluster
          (SceneControls). The body is just the list. */}
      {/* v4.35 batch-v9 #2: reorder mode — the list renders the PENDING order
          (ALL scenes; filters/search are suspended because Apply rewrites the
          whole document and a filtered pending list would eat scenes). Rows
          drag by their grip via HTML5 DnD — the setData call is what makes
          WebKit start the drag — and drop on a row to take its place.
          Click-to-jump and expand are off while reordering. */}
      {activeTab === 'scenes' && reorder.dragMode && (
        <>
          <SceneReorderBar r={reorder} />
          <div className="navigator-list">
            {reorder.displayScenes.map((scene, idx) => {
              const origNum = reorder.originalIndexOf(scene.id);
              const newNum = idx + 1;
              const movedUp = origNum !== undefined && newNum < origNum;
              const movedDown = origNum !== undefined && newNum > origNum;
              return (
                <div
                  key={scene.id}
                  className={
                    'navigator-scene nav-reorder-row' +
                    (movedUp ? ' nav-moved-up' : '') +
                    (movedDown ? ' nav-moved-down' : '') +
                    (dragRowId === scene.id ? ' nav-row-dragging' : '')
                  }
                  onDragOver={(e) => { if (dragRowId) e.preventDefault(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragRowId && dragRowId !== scene.id) {
                      const from = reorder.displayScenes.findIndex((s) => s.id === dragRowId);
                      if (from >= 0) reorder.move(from, idx);
                    }
                    setDragRowId(null);
                  }}
                >
                  <div
                    className="nav-row-grip"
                    title="Drag to reorder"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', scene.id);   // required by WebKit
                      e.dataTransfer.effectAllowed = 'move';
                      setDragRowId(scene.id);
                    }}
                    onDragEnd={() => setDragRowId(null)}
                  >
                    &#8942;&#8942;
                  </div>
                  <div className="scene-info">
                    <div className="scene-heading-row">
                      <div className="scene-heading-text">
                        <span className="scene-number-badge" style={scene.color ? { background: scene.color } : undefined}>
                          {(movedUp || movedDown) ? (
                            <><span className="nav-orig-num">{origNum}</span> → {newNum}</>
                          ) : (
                            scene.sceneNumber ?? newNum
                          )}
                        </span>
                        <span className="scene-heading-label">{scene.heading}</span>
                      </div>
                    </div>
                    {scene.synopsis && (
                      <div className="scene-synopsis-preview">{scene.synopsis.split('\n')[0]}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      {activeTab === 'scenes' && !reorder.dragMode && (
          <>
          {/* v5.03, Derek: "make it so I can adjust the size of the columns".
              The header IS a .scene-heading-row, so it reads the very same
              grid template as every data row — one template, so a resized
              column cannot line up in the header and miss in the list. The
              grips write --scene-col-head / --scene-metrics-w onto the tool
              body, which is the common ancestor of the header and the rows. */}
          <div className="scene-heading-row scene-list-header" aria-hidden="true">
            {/* v5.05: all three titles are SIBLINGS of one class, each parked
                straight in its grid area — nested in the data cells they
                inherited three different fonts.
                v5.06, Derek's marked-up screenshot: a COLUMN is what the eye
                groups, not what the grid tracks say. "Scene" is the number
                badge AND the heading; "Length" is the figures AND the icon.
                So those two titles span their whole regions (grid-column
                spans in the CSS) and centre over them — centred on the bare
                head/metrics tracks they sat visibly off Derek's centre lines. */}
            <span className="scene-col-title scene-col-title-head">
              Scene
              <span className="scene-col-grip" onPointerDown={startColResize('head')} title="Drag to resize" />
            </span>
            <span className="scene-col-title scene-col-title-syn">Synopsis</span>
            <span className="scene-col-title scene-col-title-met">
              <span className="scene-col-grip scene-col-grip-left" onPointerDown={startColResize('metrics')} title="Drag to resize" />
              Length
            </span>
          </div>
          <div className="navigator-list">
            {filteredIndices.length === 0 ? (
              <div className="navigator-empty">
                {(hasActiveFilter || searchQuery)
                  ? 'No scenes match the current filters.'
                  : 'No scenes yet. Start writing a scene heading (INT. or EXT.)'}
              </div>
            ) : (
              filteredIndices.map((sceneIdx) => {
                const scene = scenes[sceneIdx];
                const detail = sceneDetails[sceneIdx];
                return (
                  <div key={scene.id} className="navigator-scene">
                    {/* v5.03, Derek: clicking a scene JUMPS to it and nothing
                        else. The old click also unfolded a detail panel that
                        repeated the row's own page count, runtime and synopsis
                        back at you — everything it showed is on the row now. */}
                    {/* v5.05, Derek: "require a double click to jump to the
                        chosen scene." A single click lands in the row without
                        moving the script out from under you — you can aim at
                        the synopsis field, or just look. */}
                    <div className="scene-info" onDoubleClick={() => goToScene(sceneIdx)} title="Double-click to go to this scene">
                      {/* v5.02, Derek's mockup: five columns, and the SAME
                          five on every row — number · heading · synopsis field
                          · metrics · length icon. These are grid tracks, not
                          flex children, because flex sizes each row to its own
                          content: every synopsis would start at a different x.
                          Empty cells still render so the tracks keep their
                          width the whole way down the list. */}
                      <div className="scene-heading-row">
                        <span className="scene-num-cell">
                          {scene.sceneNumber != null && (
                            <span className="scene-number-badge" style={scene.color ? { background: scene.color } : undefined}>{scene.sceneNumber}</span>
                          )}
                        </span>
                        <span className="scene-heading-text">
                          {(() => {
                            const label = sceneActLabel(structure, sceneIdx);
                            return label ? <span className="scene-act-badge" title={`Act ${label.slice(1)}`}>{label}</span> : null;
                          })()}
                          <span className="scene-heading-label">{highlightText(scene.heading, searchQuery)}</span>
                        </span>
                        {/* Uncontrolled on purpose: a controlled input would
                            round-trip every keystroke through the document and
                            a full scene rescan. It commits on blur / Enter,
                            reverts on Escape, and `key` re-seeds it whenever the
                            stored synopsis changes underneath it. */}
                        <input
                          className="scene-synopsis-field"
                          key={`${scene.id}:${scene.synopsis}`}
                          defaultValue={scene.synopsis}
                          /* v5.04, Derek: no placeholder. The field's own box
                             is the affordance; "Synopsis" repeated down every
                             empty row was noise, and the column header already
                             says what the column is. */
                          title={scene.synopsis || 'Add a synopsis for this scene'}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === 'Enter') e.currentTarget.blur();
                            else if (e.key === 'Escape') {
                              e.currentTarget.value = scene.synopsis;
                              e.currentTarget.blur();
                            }
                          }}
                          onBlur={(e) => {
                            const next = e.currentTarget.value.trim();
                            if (next !== scene.synopsis) writeSceneSynopsis(sceneIdx, scene.id, next);
                          }}
                        />
                        {/* v5.03, Derek: "always show a page count and a time
                            here… make the first item 0:00". Both figures on
                            every row — a scene that hadn't accrued a second
                            printed a page count and then nothing, and the
                            column read ragged for a reason that wasn't real. */}
                        <span className="scene-metrics">
                          <span className="scene-metric-pages">{formatPageLength(detail?.pageLength ?? 0)}</span>
                          <span className="scene-metric-time">{formatSceneDuration(sceneTimings[sceneIdx]?.finalSeconds ?? 0)}</span>
                        </span>
                        <span className="scene-length">
                          {detail && detail.pageLength > 0 && <SceneLengthIcon pages={detail.pageLength} />}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          </>
      )}

      {/* ── Pages tab ────────────────────────────────────────────────── */}
      {/* v5.01, Derek: the Pages tool's OWN actions, in the first row of its
          body — Zoom left, Go to right. The scale is the grid COLUMN width;
          the thumbnails size themselves to their column (a ResizeObserver
          reads the rendered width and scales the page content to match), so
          one number drives both preview size and pages-per-row. */}
      {activeTab === 'pages' && (
        <ToolActionRow>
          <span className="tool-action-group">
            <button
              className="tool-action-btn tool-action-icon"
              title="Smaller page previews"
              disabled={pagesThumbPx <= PAGES_THUMB_MIN}
              onClick={() => setPagesThumbPx(pagesThumbPx - PAGES_THUMB_STEP)}
            ><CircleMinusIcon /></button>
            <span className="tool-action-label">Zoom</span>
            <button
              className="tool-action-btn tool-action-icon"
              title="Larger page previews"
              disabled={pagesThumbPx >= PAGES_THUMB_MAX}
              onClick={() => setPagesThumbPx(pagesThumbPx + PAGES_THUMB_STEP)}
            ><CirclePlusIcon /></button>
          </span>
          {/* Right-aligned by the auto margin, so it stays at the edge however
              wide the panel is. Submitting scrolls the thumbnail into view AND
              takes the script there — the same jump clicking the page makes. */}
          <form
            className="tool-action-right"
            onSubmit={(e) => { e.preventDefault(); goToPageNumber(gotoPage); }}
          >
            <label className="tool-action-label" htmlFor="fs-pages-goto">Go to:</label>
            <input
              id="fs-pages-goto"
              className="tool-action-field"
              type="text"
              inputMode="numeric"
              value={gotoPage}
              placeholder="#"
              onChange={(e) => setGotoPage(e.target.value.replace(/[^0-9]/g, ''))}
              onBlur={() => goToPageNumber(gotoPage)}
            />
          </form>
        </ToolActionRow>
      )}
      {activeTab === 'pages' && (
        <div className="navigator-list page-thumbnails-scroll" ref={pageGridRef}>
          {pageContent.length === 0 ? (
            <div className="navigator-empty">No pages yet. Start writing to see page previews.</div>
          ) : shownPages.length === 0 ? (
            <div className="navigator-empty">No page contains “{pagesSearch.trim()}”.</div>
          ) : (
            /* v4.94: the header's scaling buttons set the grid column width;
               the thumbnails already size themselves to their column. */
            <div className="page-thumbnails-grid" style={{ '--pages-thumb-w': `${pagesThumbPx}px` } as React.CSSProperties}>
              {shownPages.map((page) => (
                <div key={page.pageNumber} className="page-thumb-wrapper">
                  {/* v5.01, Derek: the label sits ABOVE its page (it used to
                      trail underneath), and the title page says so by name
                      rather than carrying a number it doesn't have. */}
                  <div className="page-thumb-number">
                    {page.pageNumber === 0 ? 'Title Page' : `Page ${page.pageNumber}`}
                  </div>
                  <div
                    className={`page-thumbnail${page.pageNumber === currentVisiblePage ? ' current' : ''}`}
                    data-page={page.pageNumber}
                    onClick={(e) => handlePageClick(page, e)}
                  >
                    <div className="page-thumb-content-clip">
                      <div
                        className="page-thumb-content"
                        style={{
                          ...pageContentStyle,
                          transform: `scale(${thumbScale})`,
                        }}
                      >
                        {page.blocks.map((block, i) => (
                          <div
                            key={i}
                            className={`page-thumb-el page-thumb-${block.typeName}`}
                            style={getBlockStyle(block.typeName, i === 0)}
                          >
                            {block.text || '\u00A0'}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Structure tab ────────────────────────────────────────────── */}
      {/* v4.32 batch-v8 #11/#12: the in-body title rows are gone — the window
          title carries the count (StructureTitleExtra / LocationsTitleExtra,
          published via setToolCount below). */}
      {activeTab === 'structure' && (
        <>
          <div className="navigator-list">
            {structure.acts.length === 0 ? (
              <div className="navigator-empty">
                No structure yet. Insert an Act Break from the element selector, or start writing scenes.
              </div>
            ) : (
              structure.acts.map((act) => {
                const isCollapsed = collapsedActs.has(act.actNumber);
                const displayName = act.customName
                  ? `${act.actName}: ${act.customName}`
                  : act.actName;
                return (
                  <div key={`act-${act.actNumber}-${act.docPos}`} className="structure-act">
                    <div
                      className="structure-act-header"
                      onClick={() => toggleAct(act.actNumber)}
                    >
                      <span className="structure-chevron">{isCollapsed ? <FaChevronRight /> : <FaChevronDown />}</span>
                      <span className="structure-act-name">{displayName}</span>
                      <span className="structure-act-count">{act.scenes.length}</span>
                    </div>
                    {!isCollapsed && (
                      <div className="structure-act-body">
                        {act.sequences.map((seq) => {
                          const seqCollapsed = collapsedSequences.has(seq.id);
                          return (
                            <div key={seq.id} className="structure-sequence">
                              <div
                                className="structure-sequence-header"
                                onClick={() => toggleSequence(seq.id)}
                              >
                                <span className="structure-chevron">{seqCollapsed ? <FaChevronRight /> : <FaChevronDown />}</span>
                                <span className="structure-sequence-dot" style={{ background: seq.color }} />
                                <span className="structure-sequence-name">{seq.name}</span>
                                <span className="structure-sequence-count">{seq.scenes.length}</span>
                              </div>
                              {!seqCollapsed && (
                                <div className="structure-scene-list">
                                  {seq.scenes.map((s) => (
                                    <div
                                      key={`seq-scene-${s.sceneIndex}`}
                                      className="structure-scene"
                                      onClick={() => goToScene(s.sceneIndex)}
                                    >
                                      <span className="structure-scene-num">{s.sceneIndex + 1}</span>
                                      <span className="structure-scene-heading">{s.heading}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {act.orphanScenes.length > 0 && (
                          <div className="structure-scene-list">
                            {act.orphanScenes.map((s) => (
                              <div
                                key={`orph-scene-${s.sceneIndex}`}
                                className="structure-scene"
                                onClick={() => goToScene(s.sceneIndex)}
                              >
                                <span className="structure-scene-num">{s.sceneIndex + 1}</span>
                                <span className="structure-scene-heading">{s.heading}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* ── Locations tab ────────────────────────────────────────────── */}
      {activeTab === 'locations' && (
        <>
          <div className="navigator-list">
            {locations.length === 0 ? (
              <div className="navigator-empty">
                No locations yet. Scene headings like
                &ldquo;INT. COFFEE SHOP - DAY&rdquo; will appear here.
              </div>
            ) : (
              locations.map((loc) => {
                const key = loc.name.toUpperCase();
                const isExpanded = expandedLocation === key;
                const isRenaming = renamingLocation === key;
                return (
                  <div key={key} className="location-group">
                    {/* v4.92, Derek: the caret LEADS the row (it used to trail
                        on the far right). It's the control that opens the row,
                        so it belongs where the eye starts — and it matches the
                        panel's own accordion rows. */}
                    <div className="location-header" onClick={() => setExpandedLocation(isExpanded ? null : key)}>
                      <span className="location-chevron">{isExpanded ? <FaChevronDown /> : <FaChevronRight />}</span>
                      <span className="location-name">{loc.name}</span>
                      <span className="location-scene-count">{loc.sceneIndices.length}</span>
                    </div>
                    {isExpanded && (
                      <div className="location-detail">
                        {isRenaming ? (
                          <div className="location-rename-row">
                            <input
                              ref={renameInputRef}
                              className="location-rename-input"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value.toUpperCase())}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSubmit(); if (e.key === 'Escape') setRenamingLocation(null); }}
                              onBlur={handleRenameSubmit}
                            />
                          </div>
                        ) : (
                          <button className="location-rename-btn" onClick={(e) => { e.stopPropagation(); setRenamingLocation(key); setRenameValue(loc.name); }}>
                            Rename Location
                          </button>
                        )}
                        <div className="location-scenes">
                          {loc.sceneIndices.map((sceneIdx, i) => (
                            <div key={sceneIdx} className="location-scene-item" onClick={(e) => { e.stopPropagation(); goToScene(sceneIdx); }}>
                              <span className="location-scene-num">{sceneIdx + 1}.</span>
                              <div className="location-scene-info">
                                <div className="location-scene-top">
                                  <span className="location-scene-prefix">{loc.prefixes[i]}</span>
                                  {loc.times[i] && <span className="location-scene-time">{loc.times[i]}</span>}
                                </div>
                                {loc.preambles[i] && <div className="location-scene-preamble">{loc.preambles[i]}</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
    </>
  );
};

// ── Window-chrome slots (v4.27, Derek's window template) ────────────────
// TOOL_CHROME (ToolDock) wires these two: SceneTitleExtra fills the
// TitleExtra slot (count beside the centered row-1 title) and SceneControls
// the Controls slot (row-2 Filter / Reorder / View / Search cluster). State
// lives in the store so these — rendered outside the tool body — stay in
// sync with the list. The COLORS list mirrors the old in-body filter panel.
// (The chip's dimension count is the shared countActiveSceneFilters — same
// source as the predicate in utils/sceneFilters.ts.)

const SCENE_FILTER_COLORS = ['', ...SCENE_SWATCH_COLORS];

/** v4.27 template TitleExtra slot: the scene count beside the window title.
 *  v4.35 batch-v9 #2/#3: BOTH views obey filter/search now, so both show the
 *  filtered/total fraction when narrowed — except during reorder, when
 *  filtering is suspended and every scene shows (the fraction would lie). */
export function SceneTitleExtra() {
  const data = useEditorStore((s) => s.sceneNavData);
  const filters = useEditorStore((s) => s.sceneFilters);
  const search = useEditorStore((s) => s.sceneSearch);
  const reorderMode = useEditorStore((s) => s.scenesReorderMode);
  const narrowed = !reorderMode && (countActiveSceneFilters(filters) > 0 || !!search);
  return <span className="tool-title-count">· {narrowed ? `${data.filtered}/` : ''}{data.total}</span>;
}

/** v4.32 batch-v8 #11/#12: Pages / Locations / Structure counts beside the
 *  window title (the body publishes via setToolCount — same house pattern as
 *  Notes/To-Do). Structure counts ACTS, the others their list length. */
export function PagesTitleExtra() {
  const count = useEditorStore((s) => s.toolCounts['pages'] ?? 0);
  return <span className="tool-title-count">· {count}</span>;
}
export function LocationsTitleExtra() {
  const count = useEditorStore((s) => s.toolCounts['locations'] ?? 0);
  return <span className="tool-title-count">· {count}</span>;
}
/** v4.92, Derek: the Locations window's header cluster — Filter · Sort ·
 *  Search. It had none, so its header strip held nothing but the fullscreen
 *  and close buttons and read as crushed. Same three controls, same
 *  ControlDropdown/ControlSearch parts, as the Scenes header — and they drive
 *  the store fields the list body reads, so none of them is decorative. */
export function LocationsControls() {
  const search = useEditorStore((s) => s.locationSearch);
  const setSearch = useEditorStore((s) => s.setLocationSearch);
  const filter = useEditorStore((s) => s.locationFilter);
  const setFilter = useEditorStore((s) => s.setLocationFilter);
  const sort = useEditorStore((s) => s.locationSort);
  const setSort = useEditorStore((s) => s.setLocationSort);

  const FILTERS: { id: LocationFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'int', label: 'Interior' },
    { id: 'ext', label: 'Exterior' },
  ];
  const SORTS: { id: LocationSort; label: string }[] = [
    // v4.93, Derek: "Scene order" — the order the locations turn up reading
    // the script. Same ordering that was called "Script order"; the app's own
    // vocabulary for this is scene-based ("Scene #" in the Notes/To-Do sorts).
    { id: 'scene', label: 'Scene order' },
    { id: 'name', label: 'Name (A–Z)' },
    { id: 'count', label: 'Most scenes' },
  ];
  return (
    <>
      <ControlDropdown
        label="Filter"
        current={filter === 'all' ? undefined : FILTERS.find((f) => f.id === filter)?.label}
        chip={filter === 'all' ? 0 : 1}
        title="Show only interior or exterior locations"
        items={FILTERS.map((f) => ({ label: f.label, active: filter === f.id, onSelect: () => setFilter(f.id) }))}
      />
      <ControlDropdown
        label="Sort"
        current={sort === 'scene' ? undefined : SORTS.find((s) => s.id === sort)?.label}
        title="Order the locations"
        items={SORTS.map((s) => ({ label: s.label, active: sort === s.id, onSelect: () => setSort(s.id) }))}
      />
      <ControlSearch value={search} onChange={setSearch} placeholder="Search locations…" />
    </>
  );
}

/** v4.94/v5.01, Derek: the Pages window's header keeps only Search — the
 *  shared control. Zoom and Go to live in the body's first row. */
export function PagesControls() {
  const search = useEditorStore((s) => s.pagesSearch);
  const setSearch = useEditorStore((s) => s.setPagesSearch);
  return (
    /* v5.01, Derek: the zoom pair LEFT this header for the body's first row
       (PagesActionRow) — a tool's own actions belong to its body. Search is
       shared chrome, so it stays. */
    <ControlSearch value={search} onChange={setSearch} placeholder="Search pages…" />
  );
}

export function StructureTitleExtra() {
  const count = useEditorStore((s) => s.toolCounts['structure'] ?? 0);
  return <span className="tool-title-count">· {count}</span>;
}

/** v4.32 batch-v8 #9: the Reorder toggle — ONE control shared by the window's
 *  row-2 cluster and the fullscreen takeover header, so the two can't drift.
 *  Flipping it off without Apply cancels (useSceneReorder drops the pending
 *  snapshot when the flag clears). v4.35 batch-v9 #2: drives BOTH views. */
export function ScenesReorderControl() {
  const reorder = useEditorStore((s) => s.scenesReorderMode);
  const setReorder = useEditorStore((s) => s.setScenesReorderMode);
  return (
    <button
      className={`tool-action-btn scene-reorder-btn${reorder ? ' active' : ''}`}
      title={reorder ? 'Exit reorder mode (discards unapplied order)' : 'Drag scenes into a new order'}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={() => setReorder(!reorder)}
    >Reorder</button>
  );
}

/** v4.27 template Controls slot: the row-2 cluster. v4.35 batch-v9 #2: all
 *  four controls — Filter, Reorder, View, Search — render in BOTH views;
 *  filter/search narrow the card wall too and reorder drags list rows as
 *  well as cards, so nothing here is a silent no-op anymore. */
export function SceneControls() {
  const data = useEditorStore((s) => s.sceneNavData);
  const filters = useEditorStore((s) => s.sceneFilters);
  const setFilters = useEditorStore((s) => s.setSceneFilters);
  const search = useEditorStore((s) => s.sceneSearch);
  const setSearch = useEditorStore((s) => s.setSceneSearch);
  const mode = useEditorStore((s) => s.scenesViewMode);
  const setMode = useEditorStore((s) => s.setScenesViewMode);
  const cardsView = mode === 'cards';
  const activeCount = countActiveSceneFilters(filters);
  const hasActiveFilter = activeCount > 0;
  const patch = (p: Partial<SceneFilters>) => setFilters({ ...filters, ...p });

  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('.fs-scene-filterpop') && t !== btnRef.current && !btnRef.current?.contains(t)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', key); };
  }, [open]);

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.right - 240, window.innerWidth - 256)) });
    }
    setOpen((v) => !v);
  };

  return (
    <>
      {/* v5.01, Derek: Reorder LEFT this cluster — a tool's own action belongs
          in the first row of its body (ToolActionRow in ScenesTool), not among
          the Filter / View / Search controls every tool shares. */}
      <button
        ref={btnRef}
        className={`tool-ctl${open ? ' open' : ''}`}
        title="Filter"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={toggle}
      >
        <span className="tool-ctl-label">Filter</span>
        {activeCount > 0 && <span className="tool-ctl-chip">{activeCount}</span>}
      </button>
      {open && pos && createPortal(
        <div className="fs-scene-filterpop scene-filters" style={{ top: pos.top, left: pos.left }}>
          <div className="scene-filter-group">
            <select
              className="scene-filter-select"
              value=""
              onChange={(e) => { if (e.target.value && !filters.characters.includes(e.target.value)) patch({ characters: [...filters.characters, e.target.value] }); }}
            >
              <option value="">Character...</option>
              {data.characters.filter((c) => !filters.characters.includes(c)).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {filters.characters.length > 0 && (
              <div className="filter-tags">
                {filters.characters.map((c) => (
                  <span key={c} className="filter-tag">{c}<button onClick={() => patch({ characters: filters.characters.filter((x) => x !== c) })}>×</button></span>
                ))}
              </div>
            )}
          </div>
          <div className="scene-filter-row">
            <select className="scene-filter-select" value={filters.location} onChange={(e) => patch({ location: e.target.value })}>
              <option value="">Location...</option>
              {data.locations.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <select className="scene-filter-select" value={filters.prefix} onChange={(e) => patch({ prefix: e.target.value })}>
              <option value="">INT/EXT...</option>
              {data.prefixes.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="scene-filter-row">
            <select className="scene-filter-select" value={filters.time} onChange={(e) => patch({ time: e.target.value })}>
              <option value="">Time of Day...</option>
              {data.times.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <div className="scene-filter-colors">
              {SCENE_FILTER_COLORS.map((c) => (
                <button
                  key={c || 'all'}
                  className={`scene-filter-color-dot${filters.color === c ? ' active' : ''}`}
                  style={{ background: c || 'var(--fd-text)', opacity: c ? 1 : 0.25 }}
                  onClick={() => patch({ color: c })}
                  title={c ? c : 'All colors'}
                />
              ))}
            </div>
          </div>
          <div className="scene-filter-row">
            <input
              className="scene-filter-input"
              type="text"
              placeholder="Synopsis contains..."
              value={filters.synopsis}
              onChange={(e) => patch({ synopsis: e.target.value })}
            />
          </div>
          {hasActiveFilter && (
            <div className="scene-filter-row">
              <button className="filter-clear-btn" onClick={() => setFilters({ ...EMPTY_SCENE_FILTERS })}>Clear All</button>
            </div>
          )}
        </div>,
        document.body,
      )}
      <ControlDropdown
        title="View"
        current={cardsView ? 'Cards' : 'List'}
        icon={cardsView ? <LuLayoutGrid /> : <LuList />}
        items={[
          { label: 'List', active: !cardsView, onSelect: () => setMode('list') },
          { label: 'Cards', active: cardsView, onSelect: () => setMode('cards') },
        ]}
      />
      <ControlSearch value={search} onChange={setSearch} placeholder="Search headings & synopses..." />
    </>
  );
}

export default SceneNavigator;
