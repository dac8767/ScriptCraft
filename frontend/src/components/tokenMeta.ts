/**
 * tokenMeta (v2.96) — how a toolbar token looks in customization UIs.
 *
 * ONE resolver for icons and labels, reading the SAME registries the real
 * controls draw from (TOOLBAR_ICONS, a tool's own ToolDef.icon, a command's
 * own icon) — Customize and the ribbon editor both import from here, so a
 * row can't show an icon the button doesn't have. Extracted from
 * CustomizePanelsDialog when the ribbon editor became a second consumer.
 */
import type React from 'react';
import { TOOLBAR_ICONS, UTILITY_ICONS } from './uiIcons';
import { ALL_TOOLS } from './ToolDock';
import { TOOLBAR_COMMANDS } from './toolbarCommands';
import { BUILTIN_BY_KEY } from './toolbarBuiltins';

export const DEFAULT_TOOLBAR_SPACER = 50;   // v0.86

export const spacerPx = (tok: string): number => {
  const n = Number(tok.split(':')[2]);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TOOLBAR_SPACER;
};

export const tokenIcon = (tok: string): React.ReactNode => {
  if (tok.startsWith('b:')) return TOOLBAR_ICONS[tok.slice(2)] ?? null;
  if (tok.startsWith('t:')) return ALL_TOOLS.find((t) => t.id === tok.slice(2))?.icon ?? null;
  // v2.04: commands carry their OWN icon (TOOLBAR_COMMANDS) — reading
  // TOOLBAR_ICONS here was a second list, and every command id missing
  // from it rendered an iconless row. One source: the pinned button's icon.
  if (tok.startsWith('c:')) return TOOLBAR_COMMANDS.find((c) => c.id === tok.slice(2))?.icon ?? null;
  return UTILITY_ICONS[tok.startsWith('s:') ? 'spacer' : 'divider'];
};

export const tokenLabel = (tok: string): string => {
  if (tok.startsWith('b:')) return BUILTIN_BY_KEY[tok.slice(2)]?.label || tok;
  if (tok.startsWith('t:')) return ALL_TOOLS.find((t) => t.id === tok.slice(2))?.label || tok;
  if (tok.startsWith('c:')) return TOOLBAR_COMMANDS.find((c) => c.id === tok.slice(2))?.label || tok;
  if (tok.startsWith('s:')) return 'Spacer';
  return 'Divider';
};
