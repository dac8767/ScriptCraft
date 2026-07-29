/**
 * v5.25: the Markups icon system — ONE registry the popover picker, the
 * margin layer, the tool window, the Navigator and Customize ▸ Markups all
 * read (the house single-source rule). Preset combos (icon + color) are
 * user-editable in Customize and persist in viewState.markupPresets; these
 * are the shipped defaults. Emoji are allowed HERE by Derek's explicit ask —
 * they are user content on the page, not UI chrome.
 */
import React from 'react';
import {
  FaRegFlag, FaRegStar, FaHashtag, FaCircle, FaCheck, FaExclamation,
  FaRegBookmark, FaRegHeart, FaRegQuestionCircle, FaRegLightbulb, FaRegBell,
  FaRegEye, FaBolt, FaFire, FaRegClock, FaRegComment, FaArrowUp, FaArrowDown,
  FaAsterisk, FaRegGem, FaKey, FaSearch, FaTimes, FaPlus,
} from 'react-icons/fa';

/** The full monotone icon list (id → glyph). The first six are the shipped
 *  preset defaults, in Derek's order. */
export const MARKUP_ICONS: Record<string, React.ReactNode> = {
  flag: <FaRegFlag />,
  star: <FaRegStar />,
  hashtag: <FaHashtag />,
  dot: <FaCircle />,
  check: <FaCheck />,
  exclaim: <FaExclamation />,
  bookmark: <FaRegBookmark />,
  heart: <FaRegHeart />,
  question: <FaRegQuestionCircle />,
  idea: <FaRegLightbulb />,
  bell: <FaRegBell />,
  eye: <FaRegEye />,
  bolt: <FaBolt />,
  fire: <FaFire />,
  clock: <FaRegClock />,
  comment: <FaRegComment />,
  up: <FaArrowUp />,
  down: <FaArrowDown />,
  asterisk: <FaAsterisk />,
  gem: <FaRegGem />,
  key: <FaKey />,
  search: <FaSearch />,
  x: <FaTimes />,
  plus: <FaPlus />,
};

/** Common emoji offered beside the icons (stored as 'emoji:<char>'). */
export const MARKUP_EMOJI = [
  '⭐', '❗', '❓', '✅', '🔥', '💡', '📌', '📎', '🎬', '🎯', '✂️', '🔍',
  '💬', '📝', '🚧', '⏰', '🎵', '💀', '❤️', '👀', '🙂', '😢', '😡', '🤔',
];

export { DEFAULT_MARKUP_PRESETS, type MarkupPreset } from '../stores/slices/markupsSlice';

/** Icon colors offered as quick dots in the popover (free pick beside them). */
export const MARKUP_COLORS = ['#e05555', '#e8b44f', '#4a9eff', '#2d8a4e', '#9a68d8', '#e8794f', '#9a9a9a', '#e8e8e8'];

/** Highlight colors for range markups (background tints on the script). */
export const MARKUP_HIGHLIGHTS = ['#ffe066', '#a1e3a1', '#a8d4ff', '#f3b3d0', '#e0c3ff', '#ffd2a8'];

/** Render any icon value — an id from MARKUP_ICONS or 'emoji:<char>'. */
export function MarkupIcon({ icon, color }: { icon: string; color?: string }) {
  if (icon.startsWith('emoji:')) return <span className="markup-emoji">{icon.slice(6)}</span>;
  return <span className="markup-glyph" style={color ? { color } : undefined}>{MARKUP_ICONS[icon] ?? MARKUP_ICONS.flag}</span>;
}
