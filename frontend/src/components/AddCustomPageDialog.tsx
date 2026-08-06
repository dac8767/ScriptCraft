/**
 * AddCustomPageDialog — Insert ▸ Custom Page's "where?" window (v6.05).
 *
 * Derek: "When Custom Page is clicked, it should show a window asking where
 * to add the page (between which pages?). And make sure it works." The old
 * menu action inserted at the caret's top-level position — on a fresh
 * script the caret sits in the TITLE PAGE region, so the custom page landed
 * inside the title carve where pagination never shows it: a click that did
 * nothing visible. Asking for a page number removes the caret from the
 * story entirely; the position resolves through the SAME boundary math the
 * Pages tool uses (pagination.posAfterScriptPageIn), so the two doors agree.
 */
import { useMemo, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { useEditorStore } from '../stores/editorStore';
import { computePageBlocks, posAfterScriptPageIn } from '../editor/pagination';
import { insertCustomPageAt } from '../editor/extensions';
import Modal from './Modal';

export default function AddCustomPageDialog({ editor, onClose }: {
  editor: Editor;
  onClose: () => void;
}) {
  const pageLayout = useEditorStore((s) => s.pageLayout);
  // Computed once per open — the doc doesn't change under a modal.
  const pages = useMemo(
    () => computePageBlocks(editor.state.doc, pageLayout, { includeTitlePage: true }),
    [editor, pageLayout],
  );
  const lastPage = useMemo(
    () => pages.reduce((mx, p) => (!p.isTitle && !p.isCustom ? Math.max(mx, p.pageNumber) : mx), 0),
    [pages],
  );
  // Default to the end — the commonest place for a non-script page.
  const [after, setAfter] = useState(String(lastPage));
  const n = parseInt(after, 10);
  const valid = Number.isInteger(n) && n >= 0 && n <= lastPage;

  const submit = () => {
    if (!valid) return;
    const pos = posAfterScriptPageIn(pages, n, editor.state.doc.content.size);
    if (pos == null) return;
    insertCustomPageAt(editor, pos);
    onClose();
  };

  return (
    <Modal onClose={onClose} boxClassName="fs-addpage-dialog">
      <h3>Add a Custom Page</h3>
      <div className="fs-addpage-body">
        <label className="fs-addpage-row">
          Add the page after page
          <input
            autoFocus
            className="tool-action-field fs-addpage-num"
            type="text"
            inputMode="numeric"
            value={after}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setAfter(e.target.value.replace(/[^0-9]/g, ''))}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          />
          <span className="fs-addpage-of">of {lastPage}</span>
        </label>
        <div className="fs-addpage-hint">
          0 puts it before page 1. Custom pages carry no page number — the
          script flows around them.
        </div>
      </div>
      <div className="dialog-actions">
        <button onClick={onClose}>Cancel</button>
        <button className="primary" disabled={!valid} onClick={submit}>Add Page</button>
      </div>
    </Modal>
  );
}
