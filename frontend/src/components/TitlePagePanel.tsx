/**
 * TitlePagePanel (v0.63) — the title-page editor as hosted panel content.
 *
 * TitlePageEditor is a modal (overlay + required onClose). Rather than fork its
 * logic, this hosts it as panel content: CSS neutralizes the overlay/centering.
 * v5.67: its host is the Pages window's Title Page TAB (the standalone tool is
 * retired), so the -fixed sizing variant is gone — the box caps at the host's
 * width and scrolls, and the tab's fs-tp-narrow class stacks the columns.
 */
import type { Editor } from '@tiptap/react';
import TitlePageEditor from './TitlePageEditor';

interface TitlePagePanelProps {
  editor: Editor | null;
  /** v0.89: TitlePageEditor's Cancel and Apply both call onClose — it was
   *  once wired to a no-op, which is why they appeared to do nothing.
   *  v5.67: the Pages tab wires it back to the Script tab. */
  onClose?: () => void;
}

export default function TitlePagePanel({ editor, onClose }: TitlePagePanelProps) {
  if (!editor) {
    return <div className="fs-panel-empty">Open a script to edit its title page.</div>;
  }
  return (
    <div className="fs-modal-as-panel">
      <TitlePageEditor editor={editor} onClose={() => onClose?.()} />
    </div>
  );
}
