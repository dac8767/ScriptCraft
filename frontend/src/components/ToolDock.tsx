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
import {
  FaRegCompass, FaFilm, FaRegClone, FaMapMarkerAlt, FaUserFriends,
  FaChartBar, FaBullseye, FaRegStickyNote, FaRegClipboard, FaCheckSquare,
  FaTh, FaStream, FaTags, FaHighlighter,
} from 'react-icons/fa';
import { useEditorStore, DEFAULT_TOOL_CONFIG, type ToolId, type ToolSide } from '../stores/editorStore';
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
];

export const toolDef = (id: ToolId | null) => ALL_TOOLS.find((t) => t.id === id) || null;

/** Windows summarize script info; everything else is a Tool (v0.24 taxonomy). */
export const WINDOW_IDS: ToolId[] = ['navigator', 'pages', 'scenes', 'locations', 'characters'];
export const isWindowTool = (id: ToolId) => WINDOW_IDS.includes(id);

const MIN_W = 240;
const MIN_H = 260;
/** Dock column width; tools whose remembered width fits open inline. */
export const DOCK_W = 300;

/** Shared tool-content renderer (docked and temporary windows). */
export function ToolContent({ id, editor, scrollContainer }: {
  id: ToolId; editor: Editor | null; scrollContainer?: HTMLDivElement | null;
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
  const { toolSizes, setToolSize } = useEditorStore();
  const size = toolSizes[tool.id] || tool.defaultSize;
  const windowRef = useRef<HTMLDivElement>(null);

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
      className={`tool-window${temporary ? ' tool-window-temp' : ''}`}
      style={{ width: size.w, height: size.h }}
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
          onClick={() => setToolSize(tool.id, DOCK_W, size.h)}
        >{side === 'right' ? '\u2922' : '\u2921'}</button>
      )}
      <div
        className={`tool-window-resize${side === 'right' ? ' tool-window-resize-left' : ''}`}
        onPointerDown={startResize}
        title="Drag to resize — the new size becomes this tool's default"
      />
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
    const cfg = toolConfig[t.id] ?? DEFAULT_TOOL_CONFIG[t.id];
    return cfg && cfg.enabled && cfg.side === side;
  }).sort((a, b) => orderIdx(a.id) - orderIdx(b.id));

  // Labeled divider lines (Customize > Dividers), ordered among the tools via
  // div:<id> tokens in toolOrder. Rendered as entries interleaved by order.
  const { panelDividers } = useEditorStore();
  type DockEntry = { kind: 'tool'; tool: typeof ALL_TOOLS[number] } | { kind: 'divider'; id: string; label: string };
  const entries: DockEntry[] = [
    ...tools.map((t) => ({ kind: 'tool' as const, tool: t, ord: orderIdx(t.id) })),
    ...panelDividers.filter((d) => d.side === side).map((d) => ({ kind: 'divider' as const, id: d.id, label: d.label, ord: orderIdx(`div:${d.id}`) })),
  ].sort((a, b) => a.ord - b.ord).map(({ ord: _o, ...rest }) => rest as DockEntry);

  const activeId = side === 'left' ? activeTool : activeToolRight;
  const setActive = side === 'left' ? setActiveTool : setActiveToolRight;
  const active = tools.find((t) => t.id === activeId) || null;
  const { toolSizes, setToolSize } = useEditorStore();
  const activeSize = active ? (toolSizes[active.id] || active.defaultSize) : null;
  // Small-enough windows open inline, pushing the buttons below them down.
  const inline = !!(active && activeSize && activeSize.w <= DOCK_W);

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
    <div className={`tool-dock-wrap tool-dock-${side}`}>
      <div className="tool-dock">
        {entries.map((entry) => entry.kind === 'divider' ? (
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
                  onClick={() => setToolSize(active.id, DOCK_W + 140, activeSize!.h)}
                >{side === 'right' ? '\u2921' : '\u2922'}</button>
                <div className="tool-inline-body" style={{ height: activeSize!.h }}>
                  <ToolContent id={active.id} editor={editor} scrollContainer={scrollContainer} />
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
          <ToolContent id={active.id} editor={editor} scrollContainer={scrollContainer} />
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
        <ToolContent id={tool.id} editor={editor} scrollContainer={scrollContainer} />
      </ToolWindowFrame>
    </div>
  );
}
