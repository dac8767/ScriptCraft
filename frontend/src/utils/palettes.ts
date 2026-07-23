// Shared color palettes (single source of truth). Consolidate verbatim-duplicated
// swatch lists here rather than redeclaring them per component.

/** The scene color swatches (the highlight palette + white). Consumers add the
 *  "no color" ('') option at whichever end they render it — SceneNavigator shows
 *  it first, SynopsisModal shows it last — so this list stays position-agnostic. */
export const SCENE_SWATCH_COLORS = ['#8b5cf6', '#4f46e5', '#2563eb', '#059669', '#eab308', '#f97316', '#ef4444', '#000000', '#ffffff'];
