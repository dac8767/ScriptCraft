/**
 * TitlePagePanel (v0.63) — Title Page as a dockable Project window.
 *
 * TitlePageEditor is a modal (overlay + required onClose). Rather than fork its
 * logic, this hosts it as panel content: onClose is a no-op (a docked panel
 * closes via its dock) and CSS neutralizes the overlay/centering.
 */
import type { Editor } from '@tiptap/react';
import TitlePageEditor from './TitlePageEditor';

interface TitlePagePanelProps {
  editor: Editor | null;
}

export default function TitlePagePanel({ editor }: TitlePagePanelProps) {
  if (!editor) {
    return <div className="fs-panel-empty">Open a script to edit its title page.</div>;
  }
  return (
    <div className="fs-modal-as-panel">
      <TitlePageEditor editor={editor} onClose={() => {}} />
    </div>
  );
}
