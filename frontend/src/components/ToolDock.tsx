/**
 * ToolDock — Photoshop-style tool columns flanking the editor. Each dock is a
 * vertical list of tools (icon + title); clicking one opens a floating window
 * beside the dock (one per dock at a time). Which tools live on which side —
 * and whether they're shown at all — comes from toolConfig, editable via
 * View → Customize Toolbar & Panels.
 *
 * Window sizes: dragging the bottom-right handle saves that size as the
 * tool's default (persisted in view state).
 *
 * Clicking back into the script minimizes any open tool window (the dock
 * stays). Tools disabled in both panels open as a temporary centered window
 * via the Tools menu (TempToolWindow, mounted once in ScreenplayEditor).
 */
import React, { useEffect, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import { CHROME_SCALES, chromePx } from './chromeSizes';
import AssetManager from './AssetManager';
import TitlePagePanel from './TitlePagePanel';
import VersionHistory from './VersionHistory';
import CustomizePanelsDialog from './CustomizePanelsDialog';
import SpellCheckPanel from './SpellCheckPanel';
import {
  FaRegCompass, FaFilm, FaRegClone, FaMapMarkerAlt, FaUserFriends,
  FaChartBar, FaBullseye, FaRegStickyNote, FaRegClipboard, FaCheckSquare,
  FaTh, FaStream, FaTags, FaHighlighter, FaBoxes, FaSpellCheck, FaFileAlt, FaSlidersH, FaHistory,} from 'react-icons/fa';
import { useEditorStore, toolConfigFor, type ToolId, type ToolSide } from '../stores/editorStore';
import { useProjectStore } from '../stores/projectStore';
import SceneNavigator, { type NavTab } from './SceneNavigator';
import NavigatorTool from './NavigatorTool';
import AnalyticsTool from './AnalyticsTool';
import GoalsTool from './GoalsTool';
import CharacterProfiles from './CharacterProfiles';
import { StickyNotesTool, FragmentsTool, TodoTool } from './StickyNotes';
import HighlightsTool from './HighlightsTool';
import TagsPanel from './TagsPanel';
import IndexCards from './IndexCards';
import BeatBoard from './BeatBoard';

export interface ToolDef {
  id: ToolId;
  label: string;
  icon: React.ReactNode;
  defaultSize: { w: number; h: number };
  /** v0.74: never shrink this window to fit the panel. Most tools clamp their
   *  default width to the dock so they dock inline (v0.66); Customize keeps
   *  its full size and opens as a floating window instead. */
  noPanelFit?: boolean;
  /** v0.89: the window hugs its content and offers no resize handle. */
  fixedSize?: boolean;
  /** dock group separators, Photoshop-style (per side, in order) */
  group: number;
}

// Default heights sit at ~60% of the original panel lengths (v0.25) — drag
// the resize handle to make any window taller; the new size sticks.
export const ALL_TOOLS: ToolDef[] = [
  { id: 'navigator', label: 'Navigator', icon: <FaRegCompass />, defaultSize: { w: 300, h: 312 }, group: 0 },
  { id: 'scenes', label: 'Scenes', icon: <FaFilm />, defaultSize: { w: 320, h: 336 }, group: 1 },
  { id: 'pages', label: 'Pages', icon: <FaRegClone />, defaultSize: { w: 340, h: 348 }, group: 1 },
  { id: 'locations', label: 'Locations', icon: <FaMapMarkerAlt />, defaultSize: { w: 320, h: 324 }, group: 1 },
  { id: 'characters', label: 'Characters', icon: <FaUserFriends />, defaultSize: { w: 420, h: 360 }, group: 1 },
  { id: 'indexcards', label: 'Index Cards', icon: <FaTh />, defaultSize: { w: 680, h: 372 }, group: 1 },
  { id: 'beatboard', label: 'Outline', icon: <FaStream />, defaultSize: { w: 960, h: 372 }, group: 1 },
  { id: 'sticky', label: 'Notes', icon: <FaRegStickyNote />, defaultSize: { w: 300, h: 336 }, group: 2 },
  { id: 'fragments', label: 'Snippets', icon: <FaRegClipboard />, defaultSize: { w: 300, h: 312 }, group: 2 },
  { id: 'todo', label: 'To-Do', icon: <FaCheckSquare />, defaultSize: { w: 300, h: 288 }, group: 2 },
  { id: 'highlights', label: 'Highlights', icon: <FaHighlighter />, defaultSize: { w: 300, h: 312 }, group: 2 },
  { id: 'tags', label: 'Production Tags', icon: <FaTags />, defaultSize: { w: 340, h: 336 }, group: 2 },
  { id: 'analytics', label: 'Analytics', icon: <FaChartBar />, defaultSize: { w: 620, h: 384 }, group: 3 },
  { id: 'goals', label: 'Goals', icon: <FaBullseye />, defaultSize: { w: 340, h: 264 }, group: 3 },
  // v0.89: fixed — the Title Page form is a set-size box, so the window is sized
  // to it exactly and can't be resized. Nothing else is fixed; every other tool
  // genuinely uses the space it's given.
  { id: 'titlepage', label: 'Title Page', icon: <FaFileAlt />, defaultSize: { w: 520, h: 560 }, group: 3, noPanelFit: true, fixedSize: true },
  // Same size as the Customize dialog; noPanelFit keeps it that size in a panel.
  { id: 'customize', label: 'Customize', icon: <FaSlidersH />, defaultSize: { w: 560, h: 680 }, group: 3, noPanelFit: true },
  { id: 'assets', label: 'Asset Manager', icon: <FaBoxes />, defaultSize: { w: 620, h: 372 }, group: 3 },
  { id: 'spelling', label: 'Spelling & Grammar', icon: <FaSpellCheck />, defaultSize: { w: 420, h: 440 }, group: 3 },
  // v0.84: Script History is dockable again — VersionHistory already had an
  // `embedded` mode, it just wasn't registered as a tool.
  { id: 'history', label: 'Script History', icon: <FaHistory />, defaultSize: { w: 420, h: 480 }, group: 3 },
];

export const toolDef = (id: ToolId | null) => ALL_TOOLS.find((t) => t.id === id) || null;

/** Windows summarize script info; everything else is a Tool (v0.24 taxonomy). */
export const WINDOW_IDS: ToolId[] = ['navigator', 'pages', 'scenes', 'locations', 'characters', 'assets', 'spelling', 'titlepage', 'customize', 'history'];
export const isWindowTool = (id: ToolId) => WINDOW_IDS.includes(id);

const MIN_W = 240;
const MIN_H = 260;
/** Dock column width; tools whose remembered width fits open inline. */
export const DOCK_W = CHROME_SCALES.panelLeft.comfortable;   // 300 (default)
export const DOCK_W_COMPACT = CHROME_SCALES.panelLeft.compact; // 232
/** Dock column width for a panel's size mode — including 'custom', where the
 *  user's slider value (half-compact … double-comfortable) applies. Inline
 *  tool windows are sized and GATED against this, so a window docked in a
 *  narrowed panel still fits inside it. */
export const dockWidthFor = (
  side: 'left' | 'right',
  mode: 'compact' | 'comfortable' | 'custom',
  customPx?: number,
) => chromePx(side === 'left' ? 'panelLeft' : 'panelRight', mode, customPx);

/** Shared tool-content renderer (docked and temporary windows). */
export function ToolContent({ id, editor, scrollContainer, onClose }: {
  id: ToolId; editor: Editor | null; scrollContainer?: HTMLDivElement | null;
  /** v0.89: lets a hosted modal (Title Page) close the window it lives in —
   *  its Cancel/Apply buttons call onClose, which used to be a no-op. */
  onClose?: () => void;
}) {
  const { currentProject } = useProjectStore();
  switch (id) {
    case 'navigator':
      return <NavigatorTool editor={editor} scrollContainer={scrollContainer} />;
    case 'scenes':
    case 'pages':
    case 'structure':
    case 'locations':
      return <SceneNavigator editor={editor} scrollContainer={scrollContainer} view={id as NavTab} />;
    case 'characters':
      return <CharacterProfiles editor={editor} projectId={currentProject?.id || ''} embedded />;
    case 'titlepage':
      return <TitlePagePanel editor={editor} onClose={onClose} />;
    case 'customize':
      return <CustomizePanelsDialog open embedded onClose={() => {}} />;
    case 'assets':
      return <AssetManager projectId={currentProject?.id || ''} embedded />;
    case 'spelling':
      return <SpellCheckPanel editor={editor} />;
    case 'history':
      return <VersionHistory embedded />;
    case 'analytics':
      return <AnalyticsTool editor={editor} />;
    case 'goals':
      return <GoalsTool editor={editor} />;
    case 'sticky':
      return <StickyNotesTool editor={editor} />;
    case 'fragments':
      return <FragmentsTool editor={editor} />;
    case 'highlights':
      return <HighlightsTool editor={editor} scrollContainer={scrollContainer ?? null} />;
    case 'todo':
      return <TodoTool editor={editor} />;
    case 'tags':
      return <TagsPanel editor={editor} embedded />;
    case 'indexcards':
      return <IndexCards editor={editor} scrollContainer={scrollContainer ?? null} embedded />;
    case 'beatboard':
      return <BeatBoard embedded />;
    default:
      return null;
  }
}

/** Resizable window chrome shared by docked and temporary tool windows. */
export function ToolWindowFrame({ tool, onClose, temporary, side, children }: {
  tool: ToolDef; onClose: () => void; temporary?: boolean; side?: ToolSide; children: React.ReactNode;
}) {
  const { toolSizes, setToolSize, panelSizeMode, chromeCustomPx } = useEditorStore();
  const windowRef = useRef<HTMLDivElement>(null);
  // Docked windows default to inline (see ToolDock below), so this frame only
  // renders windows the user has explicitly sized/popped out, plus temporary
  // Tools-menu windows — both of which should keep their own size.
  const size = toolSizes[tool.id] || tool.defaultSize;
  // Pop-back-in must target the width of the panel it's returning to, or a
  // compact panel would reject the window as too wide and it would keep floating.
  const popInW = side ? dockWidthFor(side, panelSizeMode[side], chromeCustomPx[side === 'left' ? 'panelLeft' : 'panelRight']) : DOCK_W;

  const startResize = (e: React.PointerEvent) => {
    if (!windowRef.current) return;
    e.preventDefault();
    const el = windowRef.current;
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = el.offsetWidth;
    const startH = el.offsetHeight;
    let w = startW;
    let h = startH;
    const onMove = (ev: PointerEvent) => {
      // Right-docked windows are anchored on their right edge, so they grow
      // AWAY from the side panel (leftward); the handle sits bottom-left and
      // dragging left widens the window.
      const dx = ev.clientX - startX;
      w = Math.max(MIN_W, startW + (side === 'right' ? -dx : dx));
      h = Math.max(MIN_H, startH + (ev.clientY - startY));
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;

      // v0.85: stop growing once the content no longer fills the window.
      // Rather than hardcode a max size per tool, measure it: the gap between
      // the body's clientHeight (space given) and scrollHeight (space the
      // content actually wants) IS the dead space. Give that slack back.
      //
      // This self-selects correctly. A panel whose content stretches (Scenes,
      // Notes…) always has scrollHeight === clientHeight, so slack is 0 and it
      // resizes freely. A fixed-layout window like Title Page has a box of a
      // set size, so past that point slack appears and the window stops — no
      // more dragging out a window that's mostly empty grey.
      const body = el.querySelector('.tool-window-body') as HTMLElement | null;
      if (body) {
        const slackH = body.clientHeight - body.scrollHeight;
        const slackW = body.clientWidth - body.scrollWidth;
        if (slackH > 1) {
          h = Math.max(MIN_H, h - slackH);
          el.style.height = `${h}px`;
        }
        if (slackW > 1) {
          w = Math.max(MIN_W, w - slackW);
          el.style.width = `${w}px`;
        }
      }
    };
    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      // the resized size becomes this tool's default from now on
      setToolSize(tool.id, w, h);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };

  return (
    <div
      ref={windowRef}
      className={`tool-window${temporary ? ' tool-window-temp' : ''}${tool.fixedSize ? ' tool-window-fixed' : ''}`}
      // A fixed window takes its size from its content (CSS max-content), so no
      // width/height is imposed here and there's nothing to drag.
      style={tool.fixedSize ? undefined : { width: size.w, height: size.h }}
    >
      <div className="tool-window-header">
        <span className="tool-window-title">{tool.label}</span>
        <button className="tool-window-close" onClick={onClose} title="Close">×</button>
      </div>
      <div className="tool-window-body">{children}</div>
      {!temporary && (
        <button
          className={`tool-window-popin${side === 'right' ? ' tool-window-popin-right' : ''}`}
          title="Pop back into the side panel"
          onClick={() => setToolSize(tool.id, popInW, size.h)}
        >{side === 'right' ? '\u2922' : '\u2921'}</button>
      )}
      {!tool.fixedSize && (
        <div
          className={`tool-window-resize${side === 'right' ? ' tool-window-resize-left' : ''}`}
          onPointerDown={startResize}
          title="Drag to resize — the new size becomes this tool's default"
        />
      )}
    </div>
  );
}

interface ToolDockProps {
  side: ToolSide;
  editor: Editor | null;
  scrollContainer?: HTMLDivElement | null;
}

export default function ToolDock({ side, editor, scrollContainer }: ToolDockProps) {
  const {
    activeTool, setActiveTool, activeToolRight, setActiveToolRight, toolConfig,
  } = useEditorStore();

  const { toolOrder } = useEditorStore();
  const orderIdx = (id: string) => {
    const i = toolOrder.indexOf(id);
    return i === -1 ? 1000 + ALL_TOOLS.findIndex((t) => t.id === id) : i;
  };
  const tools = ALL_TOOLS.filter((t) => {
    const cfg = toolConfigFor(toolConfig, t.id);
    return cfg.enabled && cfg.side === side;
  }).sort((a, b) => orderIdx(a.id) - orderIdx(b.id));

  // Labeled divider lines (Customize > Dividers), ordered among the tools via
  // div:<id> tokens in toolOrder. Rendered as entries interleaved by order.
  const { panelDividers } = useEditorStore();
  type DockEntry =
    | { kind: 'tool'; tool: typeof ALL_TOOLS[number] }
    | { kind: 'divider'; id: string; label: string }
    | { kind: 'spacer'; id: string; size?: number };
  const entries: DockEntry[] = [
    ...tools.map((t) => ({ kind: 'tool' as const, tool: t, ord: orderIdx(t.id) })),
    // Spacers (v0.69) share the panelDividers list — a divider with spacer:true.
    // Persisted entries from before v0.69 have no flag, so they stay dividers.
    ...panelDividers.filter((d) => d.side === side).map((d) => (
      d.spacer
        ? { kind: 'spacer' as const, id: d.id, size: d.size, ord: orderIdx(`div:${d.id}`) }
        : { kind: 'divider' as const, id: d.id, label: d.label, ord: orderIdx(`div:${d.id}`) }
    )),
  ].sort((a, b) => a.ord - b.ord).map(({ ord: _o, ...rest }) => rest as DockEntry);

  const activeId = side === 'left' ? activeTool : activeToolRight;
  const setActive = side === 'left' ? setActiveTool : setActiveToolRight;
  const active = tools.find((t) => t.id === activeId) || null;
  const { toolSizes, setToolSize, panelSizeMode, chromeCustomPx } = useEditorStore();
  const dockW = dockWidthFor(side, panelSizeMode[side], chromeCustomPx[side === 'left' ? 'panelLeft' : 'panelRight']);
  // v0.66: by DEFAULT every window opens INSIDE its side panel (inline),
  // pushing the dock's remaining items down — so nothing floats over the
  // editor unasked. `inline` is decided by width <= DOCK_W, and most tools'
  // defaultSize.w exceeded it (Goals 340, Analytics 620, Index Cards 680...),
  // which is why they floated. Clamping the default HERE is what matters: the
  // v0.64 clamp lived in the floating frame and never reached this decision.
  // A size the user has chosen (drag-resize or pop-out) is stored in toolSizes
  // and still wins — pop-out sets w = DOCK_W + 140, which floats as before.
  const activeSize = active
    ? (toolSizes[active.id] || (active.noPanelFit
        // Not shrunk to the panel — opens floating at its natural size.
        ? { w: active.defaultSize.w, h: active.defaultSize.h }
        : { w: Math.min(active.defaultSize.w, dockW), h: active.defaultSize.h }))
    : null;
  const inline = !!(active && activeSize && activeSize.w <= dockW);

  const startInlineResize = (e: React.PointerEvent) => {
    if (!active || !activeSize) return;
    e.preventDefault();
    const startY = e.clientY;
    const startH = activeSize.h;
    const el = (e.currentTarget as HTMLElement).previousElementSibling as HTMLElement | null;
    let h = startH;
    const onMove = (ev: PointerEvent) => {
      h = Math.max(160, startH + (ev.clientY - startY));
      if (el) el.style.height = `${h}px`;
    };
    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      setToolSize(active.id, activeSize.w, h);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };

  // Clicking back into the script minimizes the open tool window
  useEffect(() => {
    if (!active) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('.editor-center')) setActive(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [active, setActive]);

  if (tools.length === 0) return null;

  return (
    <div className={`tool-dock-wrap tool-dock-${side} tool-dock-${panelSizeMode[side]}`}>
      <div className="tool-dock" style={{ width: dockW }}>
        {entries.map((entry) => entry.kind === 'spacer' ? (
          // v0.82: sizeable. Older spacers have no size and keep the default.
          <div
            key={`sp-${entry.id}`}
            className="tool-dock-spacer"
            style={entry.size ? { height: entry.size } : undefined}
          />
        ) : entry.kind === 'divider' ? (
          <div key={`div-${entry.id}`} className="tool-dock-divider">
            <span className="tool-dock-divider-line" />
            {entry.label && <span className="tool-dock-divider-label">{entry.label}</span>}
            {entry.label && <span className="tool-dock-divider-line" />}
          </div>
        ) : (() => { const t = entry.tool; return (
          <React.Fragment key={t.id}>
            <button
              className={'tool-dock-item' + (activeId === t.id ? ' active' : '')}
              onClick={() => setActive(activeId === t.id ? null : t.id)}
              title={t.label}
            >
              <span className="tool-dock-icon">{t.icon}</span>
              <span className="tool-dock-label">{t.label}</span>
            </button>
            {inline && active && active.id === t.id && (
              <div className="tool-inline">
                <button
                  className={`tool-inline-popout${side === 'right' ? ' tool-inline-popout-left' : ''}`}
                  title="Pop out into a floating window for resizing"
                  onClick={() => setToolSize(active.id, dockW + 140, activeSize!.h)}
                >{side === 'right' ? '\u2921' : '\u2922'}</button>
                <div className="tool-inline-body" style={{ height: activeSize!.h }}>
                  <ToolContent id={active.id} editor={editor} scrollContainer={scrollContainer} onClose={() => setActive(null)} />
                </div>
                <div
                  className="tool-inline-resize"
                  onPointerDown={startInlineResize}
                  title="Drag to resize — the new height becomes this tool's default"
                />
              </div>
            )}
          </React.Fragment>
        ); })())}
      </div>

      {active && !inline && (
        <ToolWindowFrame tool={active} side={side} onClose={() => setActive(null)}>
          <ToolContent id={active.id} editor={editor} scrollContainer={scrollContainer} onClose={() => setActive(null)} />
        </ToolWindowFrame>
      )}
    </div>
  );
}

/** Temporary window for tools disabled in both panels (opened from the Tools menu). */
export function TempToolWindow({ editor, scrollContainer }: {
  editor: Editor | null; scrollContainer?: HTMLDivElement | null;
}) {
  const { tempTool, setTempTool } = useEditorStore();

  // Clicking back into the script closes the temporary window too
  useEffect(() => {
    if (!tempTool) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('.editor-center')) setTempTool(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [tempTool, setTempTool]);

  const tool = toolDef(tempTool);
  if (!tool) return null;
  return (
    <div className="tool-temp-anchor">
      <ToolWindowFrame tool={tool} onClose={() => setTempTool(null)} temporary>
        <ToolContent id={tool.id} editor={editor} scrollContainer={scrollContainer} onClose={() => setTempTool(null)} />
      </ToolWindowFrame>
    </div>
  );
}
