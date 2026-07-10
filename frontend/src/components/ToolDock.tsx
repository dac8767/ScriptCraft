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
} from 'react-icons/fa';
import { useEditorStore, DEFAULT_TOOL_CONFIG, type ToolId, type ToolSide } from '../stores/editorStore';
import { useProjectStore } from '../stores/projectStore';
import SceneNavigator, { type NavTab } from './SceneNavigator';
import NavigatorTool from './NavigatorTool';
import AnalyticsTool from './AnalyticsTool';
import GoalsTool from './GoalsTool';
import CharacterProfiles from './CharacterProfiles';
import { StickyNotesTool, FragmentsTool, TodoTool } from './StickyNotes';

export interface ToolDef {
  id: ToolId;
  label: string;
  icon: React.ReactNode;
  defaultSize: { w: number; h: number };
  /** dock group separators, Photoshop-style (per side, in order) */
  group: number;
}

export const ALL_TOOLS: ToolDef[] = [
  { id: 'navigator', label: 'Navigator', icon: <FaRegCompass />, defaultSize: { w: 300, h: 520 }, group: 0 },
  { id: 'scenes', label: 'Scenes', icon: <FaFilm />, defaultSize: { w: 320, h: 560 }, group: 1 },
  { id: 'pages', label: 'Pages', icon: <FaRegClone />, defaultSize: { w: 340, h: 580 }, group: 1 },
  { id: 'locations', label: 'Locations', icon: <FaMapMarkerAlt />, defaultSize: { w: 320, h: 540 }, group: 1 },
  { id: 'characters', label: 'Characters', icon: <FaUserFriends />, defaultSize: { w: 420, h: 600 }, group: 1 },
  { id: 'sticky', label: 'Sticky Notes', icon: <FaRegStickyNote />, defaultSize: { w: 320, h: 560 }, group: 2 },
  { id: 'fragments', label: 'Fragments', icon: <FaRegClipboard />, defaultSize: { w: 320, h: 520 }, group: 2 },
  { id: 'todo', label: 'To-Do', icon: <FaCheckSquare />, defaultSize: { w: 300, h: 480 }, group: 2 },
  { id: 'analytics', label: 'Analytics', icon: <FaChartBar />, defaultSize: { w: 620, h: 640 }, group: 3 },
  { id: 'goals', label: 'Goals', icon: <FaBullseye />, defaultSize: { w: 340, h: 440 }, group: 3 },
];

export const toolDef = (id: ToolId | null) => ALL_TOOLS.find((t) => t.id === id) || null;

const MIN_W = 240;
const MIN_H = 260;

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
    case 'todo':
      return <TodoTool editor={editor} />;
    default:
      return null;
  }
}

/** Resizable window chrome shared by docked and temporary tool windows. */
export function ToolWindowFrame({ tool, onClose, temporary, children }: {
  tool: ToolDef; onClose: () => void; temporary?: boolean; children: React.ReactNode;
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
      w = Math.max(MIN_W, startW + (ev.clientX - startX));
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
      <div
        className="tool-window-resize"
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

  const tools = ALL_TOOLS.filter((t) => {
    const cfg = toolConfig[t.id] ?? DEFAULT_TOOL_CONFIG[t.id];
    return cfg && cfg.enabled && cfg.side === side;
  });

  const activeId = side === 'left' ? activeTool : activeToolRight;
  const setActive = side === 'left' ? setActiveTool : setActiveToolRight;
  const active = tools.find((t) => t.id === activeId) || null;

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
        {tools.map((t, i) => (
          <React.Fragment key={t.id}>
            {i > 0 && tools[i - 1].group !== t.group && <div className="tool-dock-sep" />}
            <button
              className={'tool-dock-item' + (activeId === t.id ? ' active' : '')}
              onClick={() => setActive(activeId === t.id ? null : t.id)}
              title={t.label}
            >
              <span className="tool-dock-icon">{t.icon}</span>
              <span className="tool-dock-label">{t.label}</span>
            </button>
          </React.Fragment>
        ))}
      </div>

      {active && (
        <ToolWindowFrame tool={active} onClose={() => setActive(null)}>
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
