// Shared color palettes (single source of truth). Consolidate verbatim-duplicated
// swatch lists here rather than redeclaring them per component.

/** The scene color swatches (the highlight palette + white). Consumers add the
 *  "no color" ('') option at whichever end they render it — SceneNavigator shows
 *  it first, SynopsisModal shows it last — so this list stays position-agnostic. */
export const SCENE_SWATCH_COLORS = ['#8b5cf6', '#4f46e5', '#2563eb', '#059669', '#eab308', '#f97316', '#ef4444', '#000000', '#ffffff'];

/** v2.44 (moved here v4.37): black-or-white for anything painted ON a user
 *  color — the ONE dark/light system. YIQ-weighted luminance of the hex
 *  (0.299R + 0.587G + 0.114B); above 150 the surface counts as light and
 *  gets near-black ink, otherwise white. Non-hex input returns '' so callers
 *  can fall back to their default. */
export function readableTextOn(bg: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(bg);
  if (!m) return '';
  const n = parseInt(m[1], 16);
  const lum = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum > 150 ? '#111111' : '#ffffff';
}
