/**
 * Chrome size scales (v0.72).
 *
 * Each customizable surface has a Compact and a Comfortable size. 'custom'
 * lets the user pick any size on a slider running from HALF of Compact to
 * DOUBLE of Comfortable, per Derek's spec.
 *
 * Menu bar and Toolbar scale by HEIGHT; side panels scale by WIDTH. These
 * numbers must stay in sync with screenplay.css (.menu-bar, .toolbar,
 * .tool-dock) and, for the panels, with DOCK_W / DOCK_W_COMPACT in ToolDock —
 * inline tool windows are gated against the panel width, so a mismatch would
 * let a docked window overflow its panel.
 */
export type ChromeSurface = 'menu' | 'toolbar' | 'panelLeft' | 'panelRight';

/** Side-panel size modes. 'icons' (v2.06) collapses the panel to a rail of
 *  square tool icons — every window opens floating, no pop-in. */
export type PanelSizeMode = 'compact' | 'comfortable' | 'custom' | 'icons';

/** Width of the v2.06 icon rail. */
export const ICON_RAIL_W = 48;

export interface ChromeScale {
  /** px at Compact */
  compact: number;
  /** px at Comfortable */
  comfortable: number;
  /** 'height' for the bars, 'width' for the side panels */
  axis: 'height' | 'width';
}

export const CHROME_SCALES: Record<ChromeSurface, ChromeScale> = {
  menu:       { compact: 28,  comfortable: 44,  axis: 'height' },
  toolbar:    { compact: 30,  comfortable: 36,  axis: 'height' },
  panelLeft:  { compact: 232, comfortable: 300, axis: 'width' },
  panelRight: { compact: 232, comfortable: 300, axis: 'width' },
};

/** Slider bounds: all the way left = half Compact; all the way right = double Comfortable. */
export const chromeMin = (s: ChromeSurface) => Math.round(CHROME_SCALES[s].compact / 2);
export const chromeMax = (s: ChromeSurface) => Math.round(CHROME_SCALES[s].comfortable * 2);

/** Resolve a surface's size in px for a given mode. */
export function chromePx(
  s: ChromeSurface,
  mode: 'compact' | 'comfortable' | 'custom' | 'icons',
  customPx: number | undefined,
): number {
  const sc = CHROME_SCALES[s];
  if (mode === 'icons') return ICON_RAIL_W;   // panels only
  if (mode === 'compact') return sc.compact;
  if (mode === 'comfortable') return sc.comfortable;
  const fallback = sc.comfortable;
  const v = typeof customPx === 'number' && Number.isFinite(customPx) ? customPx : fallback;
  return Math.min(chromeMax(s), Math.max(chromeMin(s), Math.round(v)));
}

/** Scale factor vs Compact — used to grow padding/type with the surface. */
export function chromeScaleFactor(s: ChromeSurface, px: number): number {
  return px / CHROME_SCALES[s].compact;
}
