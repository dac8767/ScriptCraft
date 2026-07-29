// v4.23: View / display preferences — how the script is presented (view style,
// Preview mode + options, element visibility toggles, zoom, font, page layout).
// `theme` stays in editorStore (it drives dynamic theme-apply imports).
// DEFAULT_PAGE_LAYOUT is value-imported (read only in the creator → live-binding
// safe). zoom/font use the shared clamp.
import type { StateCreator } from 'zustand';
import { _vs, saveViewState, clamp } from '../viewState';
import { DEFAULT_PAGE_LAYOUT, type EditorState, type PageLayout } from '../editorStore';

export interface ViewPrefsSlice {
  /** View > Editor: paged (simulated pages) vs continuous (thin page lines) */
  viewStyle: 'page' | 'continuous';
  setViewStyle: (v: 'page' | 'continuous') => void;

  /** File > Preview: read-only formatted presentation (markup hidden, chrome minimized) */
  previewMode: boolean;
  /** Preview sidebar options (File > Preview) */
  previewOpts: {
    sections: boolean; notes: boolean; sceneNumbers: boolean; todos: boolean;
    doubleSpaceHeaders: boolean; boldHeaders: boolean; underlineHeaders: boolean;
  };
  setPreviewOpt: (key: keyof EditorState['previewOpts'], value: boolean) => void;
  setPreviewMode: (v: boolean) => void;

  /** View > Preview: hide outline sections / script to-do lines in the script */
  sectionsVisible: boolean;
  setSectionsVisible: (v: boolean) => void;
  scriptTodosVisible: boolean;
  setScriptTodosVisible: (v: boolean) => void;
  /** v1.4: markers had no switch of their own — they were hidden with sections,
   *  which meant you couldn't keep your act breaks and drop the flags. */
  markersVisible: boolean;
  /** v5.25: Markups on the script — margin icons + highlight tints. */
  markupsVisible: boolean;
  setMarkupsVisible: (v: boolean) => void;
  /** v5.26: annotation TYPES (icons) hidden in the SCRIPT — the panel's
   *  "Show in Script" grid and each ⋮ menu's hide toggle, one list. */
  markupHiddenIcons: string[];
  setMarkupHiddenIcons: (list: string[]) => void;
  /** v5.27: scale (%) of the annotation icons in the page margin — a
   *  store-bound Design token (the layer needs the number for centering). */
  markupIconScalePct: number;
  setMarkupIconScalePct: (v: number) => void;
  /** v5.27: the Show popover's status toggle — which annotations render in
   *  the SCRIPT by state ('all' default; the panel Filter defaults 'open'). */
  markupScriptDone: 'open' | 'done' | 'all';
  setMarkupScriptDone: (v: 'open' | 'done' | 'all') => void;
  /** v5.26: recently APPLIED wheel colors / picked grid icons in the
   *  annotation pickers (presets don't record — Derek's rule). Newest first. */
  markupRecentColors: string[];
  addMarkupRecentColor: (c: string) => void;
  markupRecentIcons: string[];
  addMarkupRecentIcon: (icon: string) => void;
  setMarkersVisible: (v: boolean) => void;
  sceneNumbersVisible: boolean;
  setSceneNumbersVisible: (v: boolean) => void;
  sceneNumbersLocked: boolean;
  setSceneNumbersLocked: (v: boolean) => void;

  // Zoom
  zoomLevel: number;
  setZoomLevel: (level: number) => void;
  zoomPanelOpen: boolean;
  setZoomPanelOpen: (open: boolean) => void;

  // Font
  fontFamily: string;
  setFontFamily: (font: string) => void;
  fontSize: number;
  setFontSize: (size: number) => void;

  // Page layout
  pageLayout: PageLayout;
  setPageLayout: (layout: PageLayout) => void;
}

export const createViewPrefsSlice: StateCreator<EditorState, [], [], ViewPrefsSlice> = (set) => ({
  viewStyle: (_vs.viewStyle === 'continuous' ? 'continuous' : 'page') as 'page' | 'continuous',
  setViewStyle: (v) => {
    saveViewState({ viewStyle: v });
    set({ viewStyle: v });
  },
  previewMode: false,
  setPreviewMode: (v) => set({ previewMode: v }),
  previewOpts: {
    sections: false, notes: false, sceneNumbers: false, todos: false,
    doubleSpaceHeaders: false, boldHeaders: true, underlineHeaders: false,
  },
  setPreviewOpt: (key, value) => set((s) => ({ previewOpts: { ...s.previewOpts, [key]: value } })),
  markupsVisible: _vs.markupsVisible ?? true,
  setMarkupsVisible: (v) => {
    saveViewState({ markupsVisible: v });
    set({ markupsVisible: v });
  },
  markupHiddenIcons: (_vs.markupHiddenIcons as string[] | undefined) ?? [],
  setMarkupHiddenIcons: (list) => {
    saveViewState({ markupHiddenIcons: list });
    set({ markupHiddenIcons: list });
  },
  markupIconScalePct: (_vs.markupIconScalePct as number | undefined) ?? 100,
  setMarkupIconScalePct: (v) => {
    saveViewState({ markupIconScalePct: v });
    set({ markupIconScalePct: v });
  },
  markupScriptDone: (_vs.markupScriptDone as 'open' | 'done' | 'all' | undefined) ?? 'all',
  setMarkupScriptDone: (v) => {
    saveViewState({ markupScriptDone: v });
    set({ markupScriptDone: v });
  },
  markupRecentColors: (_vs.markupRecentColors as string[] | undefined) ?? [],
  addMarkupRecentColor: (c) => set((s) => {
    const next = [c, ...s.markupRecentColors.filter((x) => x !== c)].slice(0, 8);
    saveViewState({ markupRecentColors: next });
    return { markupRecentColors: next };
  }),
  markupRecentIcons: (_vs.markupRecentIcons as string[] | undefined) ?? [],
  addMarkupRecentIcon: (icon) => set((s) => {
    const next = [icon, ...s.markupRecentIcons.filter((x) => x !== icon)].slice(0, 8);
    saveViewState({ markupRecentIcons: next });
    return { markupRecentIcons: next };
  }),
  markersVisible: _vs.markersVisible ?? true,
  setMarkersVisible: (v) => {
    saveViewState({ markersVisible: v });
    set({ markersVisible: v });
  },
  sectionsVisible: true,
  setSectionsVisible: (v) => set({ sectionsVisible: v }),
  scriptTodosVisible: true,
  setScriptTodosVisible: (v) => set({ scriptTodosVisible: v }),
  sceneNumbersVisible: false,
  setSceneNumbersVisible: (v) => set({ sceneNumbersVisible: v }),
  sceneNumbersLocked: false,
  setSceneNumbersLocked: (v) => set({ sceneNumbersLocked: v }),
  zoomLevel: _vs.zoomLevel ?? 100,
  setZoomLevel: (level) => { const clamped = clamp(level, 50, 300); set({ zoomLevel: clamped }); saveViewState({ zoomLevel: clamped }); },
  zoomPanelOpen: false,
  setZoomPanelOpen: (open) => set({ zoomPanelOpen: open }),
  fontFamily: 'Courier Prime',
  setFontFamily: (font) => set({ fontFamily: font }),
  fontSize: 12,
  setFontSize: (size) => set({ fontSize: clamp(size, 8, 24) }),
  pageLayout: DEFAULT_PAGE_LAYOUT,
  setPageLayout: (layout) => set({ pageLayout: layout }),
});
