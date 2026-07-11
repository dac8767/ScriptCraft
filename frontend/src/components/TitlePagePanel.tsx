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
  /** v0.89: closes the window this panel lives in. TitlePageEditor's Cancel and
   *  Apply both call onClose — it was wired to a no-op here, which is why they
   *  appeared to do nothing. */
  onClose?: () => void;
}

export default function TitlePagePanel({ editor, onClose }: TitlePagePanelProps) {
  if (!editor) {
    return <div className="fs-panel-empty">Open a script to edit its title page.</div>;
  }
  return (
    <div className="fs-modal-as-panel fs-modal-as-panel-fixed">
      <TitlePageEditor editor={editor} onClose={() => onClose?.()} />
    </div>
  );
}
