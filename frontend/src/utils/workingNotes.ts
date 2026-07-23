// v4.24: The single source of truth for "is this doc node writer scaffolding?"
//
// Outline sections (# ...), markers (⚑ ...) and script to-do lines ([ ] / [x])
// are the writer's working notes, not the script. CLAUDE.md §4: they must NEVER
// leave the app — hidden in Preview, suppressed in print, and filtered out of
// EVERY exporter. The Fountain exporter had this check inlined; FDX, DOCX and PDF
// never got it, so drafts sent in those formats carried the author's private
// to-do list. This module is now the one predicate all four route through — add a
// new kind of working note here and every export path excludes it at once.
import type { JSONContent } from '@tiptap/react';

/**
 * True if `text` is a working-note line. Works on the raw element text — the
 * leading token is what matters:
 *   "# ..."  outline section (one or more #, then whitespace)
 *   "⚑ ..."  marker (U+2691)
 *   "[ ] .." / "[x] .."  script to-do line
 */
export function isWorkingNoteText(text: string): boolean {
  const t = text.trim();
  return /^#+\s/.test(t) || t.startsWith('⚑') || /^\[[ x]\]/.test(t);
}

/** Raw concatenated text of a node's direct text children (no mark wrappers). */
function rawNodeText(node: JSONContent): string {
  if (!node.content) return '';
  return node.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text || '')
    .join('');
}

/**
 * True if `node` is a working-note `general` block — the form every exporter must
 * skip. Working notes only ever live as `general` nodes with a leading token, so
 * script content (dialogue, action, a scene heading) is never mistaken for one.
 */
export function isWorkingNoteNode(node: JSONContent): boolean {
  return node.type === 'general' && isWorkingNoteText(rawNodeText(node));
}
