/**
 * PDF import classification (v2.79) — the pure half of pdfImporter, split
 * out so tests and the main bundle never load pdf.js (which needs DOM APIs
 * the moment it's imported).
 *
 * A PDF has no elements, only positioned text — each paragraph is classified
 * by its INDENT relative to the document's dominant left margin. Standard
 * screenplay layout offsets (pt): dialogue ~72 right of action,
 * parentheticals ~108, characters ~158, transitions far right.
 */
const SCENE_RE = /^(INT|EXT|EST|INT\.?\/EXT|I\/E)[\s./]/i;
const TRANSITION_RE = /(TO:|FADE OUT\.?|FADE IN:?|CUT TO BLACK\.?)$/;

/** Classify one paragraph by indent (pt right of the action margin). */
export function classifyParagraph(
  indent: number,
  text: string,
  prevType: string | null,
): string {
  const caps = text === text.toUpperCase() && /[A-Z]/.test(text);
  if (SCENE_RE.test(text) && indent < 40) return 'sceneHeading';
  if (caps && TRANSITION_RE.test(text.trim()) && indent > 40) return 'transition';
  if (indent >= 130 && indent <= 260 && caps && text.length < 45) return 'character';
  if (text.startsWith('(') && indent >= 60 && (prevType === 'character' || prevType === 'dialogue')) return 'parenthetical';
  if (indent >= 45 && indent < 130 && (prevType === 'character' || prevType === 'parenthetical' || prevType === 'dialogue')) return 'dialogue';
  return 'action';
}
