/**
 * SpellCheckPanel (v0.62) — Spelling & Grammar as a dockable Project window.
 *
 * SpellCheckModal is a dialog with its own overlay and a required onClose.
 * Rather than fork its logic, this hosts it inside a panel: onClose is a no-op
 * (a docked panel is closed via its dock, not a button) and CSS neutralizes the
 * modal's overlay/centering so it lays out as ordinary panel content.
 */
import type { Editor } from '@tiptap/react';
import SpellCheckModal from './SpellCheckModal';

interface SpellCheckPanelProps {
  editor: Editor | null;
}

export default function SpellCheckPanel({ editor }: SpellCheckPanelProps) {
  if (!editor) {
    return <div className="fs-panel-empty">Open a script to run spelling &amp; grammar.</div>;
  }
  return (
    <div className="fs-spellcheck-panel">
      <SpellCheckModal editor={editor} onClose={() => {}} />
    </div>
  );
}
