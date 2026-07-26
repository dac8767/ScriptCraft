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
 * Which kind of working-note line `text` is, or null for ordinary text. The
 * leading token is what matters:
 *   "# ..."  outline section (one or more #, then whitespace)
 *   "⚑ ..."  marker (U+2691)
 *   "[ ] .." / "[x] .."  script to-do line
 * v4.54: split out of isWorkingNoteText so the editor's ol- line classes and
 * the paginator's skip logic read the SAME classification the exporters use.
 */
export function workingNoteKind(text: string): 'section' | 'marker' | 'todo' | null {
  const t = text.trim();
  if (/^#+\s/.test(t)) return 'section';
  if (t.startsWith('⚑')) return 'marker';
  if (/^\[[ x]\]/.test(t)) return 'todo';
  return null;
}

/** True if `text` is a working-note line (any kind). */
export function isWorkingNoteText(text: string): boolean {
  return workingNoteKind(text) !== null;
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
