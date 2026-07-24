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
  const t = text.trim();
  const caps = text === text.toUpperCase() && /[A-Z]/.test(text);
  // Scene headings are identified by TEXT — the INT./EXT. prefix is a stronger
  // signal than position, so a heading drifted into the character indent band
  // (centered, re-margined PDFs) is still a heading.
  if (SCENE_RE.test(text)) return 'sceneHeading';
  // FADE IN: is the one classic transition that sits at the LEFT margin; every
  // other transition keeps the far-right indent requirement.
  if (caps && /^FADE IN[:.]?$/.test(t)) return 'transition';
  if (caps && TRANSITION_RE.test(t) && indent > 40) return 'transition';
  // A line starting with '(' is never a character cue — '(V.O.)' fragments at
  // character indent fall through to the parenthetical rule instead.
  if (indent >= 130 && indent <= 260 && caps && text.length < 45 && !text.startsWith('(')) return 'character';
  // Parentheticals share the dialogue band's floor (45pt — some layouts indent
  // them barely past dialogue), and can follow another parenthetical.
  if (text.startsWith('(') && indent >= 45 && (prevType === 'character' || prevType === 'dialogue' || prevType === 'parenthetical')) return 'parenthetical';
  // Dialogue band is closed at 130 (no dead gap against the character band),
  // and empty runs never count as dialogue.
  if (t !== '' && indent >= 45 && indent <= 130 && (prevType === 'character' || prevType === 'parenthetical' || prevType === 'dialogue')) return 'dialogue';
  return 'action';
}
