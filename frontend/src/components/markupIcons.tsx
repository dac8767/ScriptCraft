/**
 * v5.25: the Markups icon system — ONE registry the popover picker, the
 * margin layer, the tool window, the Navigator and Customize ▸ Markups all
 * read (the house single-source rule). Preset combos (icon + color) are
 * user-editable in Customize and persist in viewState.markupPresets; these
 * are the shipped defaults. Emoji are allowed HERE by Derek's explicit ask —
 * they are user content on the page, not UI chrome.
 */
import React from 'react';
import { useEditorStore } from '../stores/editorStore';
import {
  FaFlag, FaStar, FaHashtag, FaCircle, FaCheck, FaExclamation,
  FaBookmark, FaHeart, FaQuestionCircle, FaLightbulb, FaBell,
  FaEye, FaBolt, FaFire, FaClock, FaComment, FaArrowUp, FaArrowDown,
  FaAsterisk, FaGem, FaKey, FaSearch, FaTimes, FaPlus, FaLink, FaImage,
} from 'react-icons/fa';

/** The full icon list (id → glyph). v5.27, Derek: SOLID glyphs — the icon
 *  is a filled shape in the annotation's chosen color, not an outline.
 *  The first six are the shipped preset defaults, in Derek's order. */
export const MARKUP_ICONS: Record<string, React.ReactNode> = {
  flag: <FaFlag />,
  star: <FaStar />,
  hashtag: <FaHashtag />,
  dot: <FaCircle />,
  check: <FaCheck />,
  exclaim: <FaExclamation />,
  bookmark: <FaBookmark />,
  heart: <FaHeart />,
  question: <FaQuestionCircle />,
  idea: <FaLightbulb />,
  bell: <FaBell />,
  eye: <FaEye />,
  bolt: <FaBolt />,
  fire: <FaFire />,
  clock: <FaClock />,
  comment: <FaComment />,
  up: <FaArrowUp />,
  down: <FaArrowDown />,
  asterisk: <FaAsterisk />,
  gem: <FaGem />,
  key: <FaKey />,
  search: <FaSearch />,
  x: <FaTimes />,
  plus: <FaPlus />,
  // v5.26: auto-icon targets for link/image content (also pickable).
  link: <FaLink />,
  image: <FaImage />,
};

/** v5.26, Derek's auto-icon table: the FIRST content kind in the annotation
 *  decides its icon — unless the user picked one by hand (iconManual). */
export const AUTO_ICON: Record<string, string> = {
  numbers: 'hashtag',
  checklist: 'check',
  bullets: 'dot',
  link: 'link',
  image: 'image',
  note: 'comment',
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

/** Render any icon value — an id from MARKUP_ICONS, 'emoji:<char>', or an
 *  imported 'custom:<id>' (v5.29: a small data-URL image from the registry). */
export function MarkupIcon({ icon, color }: { icon: string; color?: string }) {
  const custom = useEditorStore((s) => (icon.startsWith('custom:') ? s.markupCustomIcons : EMPTY_CUSTOM));
  if (icon.startsWith('emoji:')) return <span className="markup-emoji">{icon.slice(6)}</span>;
  if (icon.startsWith('custom:')) {
    const data = custom.find((c) => c.id === icon.slice(7))?.data;
    if (data) return <img className="markup-custom-icon" src={data} alt="" />;
    return <span className="markup-glyph" style={color ? { color } : undefined}>{MARKUP_ICONS.flag}</span>;
  }
  return <span className="markup-glyph" style={color ? { color } : undefined}>{MARKUP_ICONS[icon] ?? MARKUP_ICONS.flag}</span>;
}
const EMPTY_CUSTOM: { id: string; data: string }[] = [];

/** v5.29: is a hex color too dark to read on the app's dark chrome? The
 *  pickers put a light chip behind icons drawn in dark colors. */
export function isDarkColor(hex: string): boolean {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return false;
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.42;
}
