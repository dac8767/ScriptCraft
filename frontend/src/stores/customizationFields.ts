/**
 * The fields Customize can change — ONE list, read by everything that has to
 * know what "a customization" is (v7.69).
 *
 * It lived in editorStore.ts, which is also where the workspace slice lives.
 * When captureWorkspace started building itself from this list, that became a
 * circular import: the slice needs the names at module-init time and
 * editorStore has not finished evaluating yet, so the array was still
 * undefined. A constant shared between a module and the module that imports it
 * belongs in neither of them — the same lesson as menu/menuLabel.ts a version
 * earlier.
 */
/** v3.49: every persistent field the Customize dialog can change. The one
 *  list captureCustomizations / restoreCustomizations both read — so a
 *  Cancel reverts ALL of it, with nothing quietly left behind. Panel
 *  open/close and the active tool are view state, not customizations, so
 *  they're deliberately excluded (Cancel shouldn't slam panels shut). */
export const CUSTOMIZATION_FIELDS = [
  'toolbarLeft', 'toolbarRight', 'toolbarMode',
  'toolConfig', 'toolOrder', 'toolbarHiddenItems', 'toolbarPinnedTools',
  'menuBarOrder', 'menuBarHidden', 'menuMode',
  'panelDividers', 'panelSizeMode',
  'qatItems', 'toolbarDdWidths',
  'chromeCustomPx', 'chromeGapPx',
  'outlineBarRows', 'outlineBarZoom', 'outlineBarLabels', 'outlineBarRowScale',
  'outlineUnsortedWidth',
  'uiResizeLocked',
  // v4.79: fields Customize grew since v3.49 that had DRIFTED out of this
  // list — Cancel wasn't reverting them, and the customize export needs them.
  'contextMenuHidden', 'suggestionRules', 'suggestionMode',
  'panelItemScale', 'panelNameCase',
] as const;
