/**
 * HighlightsTool — the Highlights window (moved out of View → Highlights).
 *
 * Shows every text highlight (the toolbar highlighter's `highlight` mark) in
 * the script as a list: colored swatch + the highlighted text; click to jump.
 * "Highlight Selection" applies the highlighter to the current selection.
 * The old View-menu visibility toggles for note/tag highlights live at the
 * bottom so nothing was lost in the move.
 */
import { useEffect, useMemo, useState } from 'react';
import { FaRegTrashAlt } from 'react-icons/fa';
import type { Editor } from '@tiptap/react';
import { useEditorStore } from '../stores/editorStore';

interface Props {
  editor: Editor | null;
  scrollContainer: HTMLDivElement | null;
}

interface HighlightEntry {
  from: number;
  to: number;
  text: string;
  color: string | null;
}

const DEFAULT_HL = '#ffe066';

export default function HighlightsTool({ editor, scrollContainer }: Props) {
  const { notesVisible, setNotesVisible, tagsVisible, setTagsVisible } = useEditorStore();
  const [docTick, setDocTick] = useState(0);

  useEffect(() => {
    if (!editor) return;
    const onUpdate = () => setDocTick((t) => t + 1);
    editor.on('update', onUpdate);
    return () => { editor.off('update', onUpdate); };
  }, [editor]);

  const highlights = useMemo<HighlightEntry[]>(() => {
    const out: HighlightEntry[] = [];
    if (!editor) return out;
    const doc = editor.state.doc;
    let open: HighlightEntry | null = null;
    doc.descendants((node, pos) => {
      if (!node.isText) return true;
      const mark = node.marks.find((m) => m.type.name === 'highlight');
      if (mark) {
        const color = (mark.attrs?.color as string | undefined) ?? null;
        if (open && open.to === pos && open.color === color) {
          // contiguous continuation of the same highlight
          open.to = pos + node.nodeSize;
          open.text += node.text || '';
        } else {
          if (open) out.push(open);
          open = { from: pos, to: pos + node.nodeSize, text: node.text || '', color };
        }
      } else if (open) {
        out.push(open);
        open = null;
      }
      return true;
    });
    if (open) out.push(open);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, docTick]);

  const jumpTo = (entry: HighlightEntry) => {
    if (!editor) return;
    editor.chain().focus().setTextSelection({ from: entry.from, to: entry.to }).run();
    requestAnimationFrame(() => {
      try {
        const coords = editor.view.coordsAtPos(entry.from);
        if (scrollContainer) {
          const rect = scrollContainer.getBoundingClientRect();
          scrollContainer.scrollTo({
            top: scrollContainer.scrollTop + (coords.top - rect.top) - 80,
            behavior: 'auto',
          });
        }
      } catch { /* stale position — doc changed underneath us */ }
    });
  };

  const addHighlight = () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    if (from === to) return;
    (editor.chain().focus() as any).setHighlight({ color: DEFAULT_HL }).run();
  };

  const removeHighlight = (entry: HighlightEntry) => {
    if (!editor) return;
    (editor.chain().setTextSelection({ from: entry.from, to: entry.to }) as any).unsetHighlight().run();
  };

  const hasSelection = editor ? editor.state.selection.from !== editor.state.selection.to : false;

  return (
    <div className="fs-sticky-tool fs-highlights-tool">
      <div className="fs-sticky-toolbar">
        <span className="swn-group-label" style={{ padding: 0, flex: 1 }}>
          {highlights.length} highlight{highlights.length === 1 ? '' : 's'}
        </span>
        <button
          className="swn-add-btn"
          disabled={!hasSelection}
          title={hasSelection ? 'Highlight the selected text' : 'Select text in the script first'}
          onClick={addHighlight}
        >+ Highlight Selection</button>
      </div>

      <div className="fs-highlight-list">
        {highlights.length === 0 && (
          <div className="fs-nav-empty">
            No highlights yet.
            <br />
            Select text and use the toolbar highlighter — or the button above —
            to mark passages you want to find again.
          </div>
        )}
        {highlights.map((h, i) => (
          <div key={`${h.from}-${i}`} className="fs-highlight-row" onClick={() => jumpTo(h)}>
            <span className="fs-highlight-swatch" style={{ background: h.color || DEFAULT_HL }} />
            <span className="fs-highlight-text" title="Click to jump to this highlight">
              {h.text.length > 90 ? `${h.text.slice(0, 90)}…` : h.text}
            </span>
            <button
              className="fs-highlight-remove"
              title="Remove this highlight"
              onClick={(e) => { e.stopPropagation(); removeHighlight(h); }}
            ><FaRegTrashAlt /></button>
          </div>
        ))}
      </div>

      <div className="fs-highlight-toggles">
        <label>
          <input type="checkbox" checked={notesVisible} onChange={(e) => setNotesVisible(e.target.checked)} />
          <span>Show note highlights</span>
        </label>
        <label>
          <input type="checkbox" checked={tagsVisible} onChange={(e) => setTagsVisible(e.target.checked)} />
          <span>Show tag highlights</span>
        </label>
      </div>
    </div>
  );
}
