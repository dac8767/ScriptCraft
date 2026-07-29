/**
 * v5.25: the Markups margin layer — each markup's chosen icon in the RIGHT
 * margin of the script, clickable to open its popover. Rendered as
 * absolutely-positioned children INSIDE the editor's scroll container, so
 * they ride the content while scrolling; positions recompute only on doc /
 * markup changes (the page-overlay model, not a scroll listener).
 * Hidden while markupsVisible is off, in preview, and in print (CSS).
 */
import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { useEditorStore } from '../stores/editorStore';
import { findMarkupPos } from '../utils/markupActions';
import { MarkupIcon } from './markupIcons';

interface IconSpot { id: string; top: number; left: number; icon: string; color: string; done: boolean }

export default function MarkupIconLayer({ editor, container }: {
  editor: Editor | null;
  container: HTMLDivElement | null;
}) {
  const markups = useEditorStore((s) => s.markups);
  const markupsVisible = useEditorStore((s) => s.markupsVisible);
  const previewMode = useEditorStore((s) => s.previewMode);
  const setMarkupEditorId = useEditorStore((s) => s.setMarkupEditorId);
  const [spots, setSpots] = useState<IconSpot[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!editor) return;
    const bump = () => setTick((t) => t + 1);
    editor.on('update', bump);
    return () => { editor.off('update', bump); };
  }, [editor]);

  useEffect(() => {
    if (!editor || !container || !markupsVisible || previewMode) { setSpots([]); return; }
    const crect = container.getBoundingClientRect();
    const page = container.querySelector('.page');
    const prect = page?.getBoundingClientRect();
    const next: IconSpot[] = [];
    for (const m of markups) {
      const pos = findMarkupPos(editor, m.id);
      if (pos == null) continue;
      try {
        const coords = editor.view.coordsAtPos(Math.min(pos + 1, editor.state.doc.content.size));
        next.push({
          id: m.id,
          top: coords.top - crect.top + container.scrollTop - 2,
          left: (prect ? prect.right - crect.left : crect.width - 40) + container.scrollLeft + 6,
          icon: m.icon,
          color: m.color,
          done: m.done,
        });
      } catch { /* position vanished mid-edit; next tick repaints */ }
    }
    setSpots(next);
  }, [editor, container, markups, markupsVisible, previewMode, tick]);

  if (!markupsVisible || previewMode) return null;
  return (
    <>
      {spots.map((s) => (
        <button
          key={s.id}
          className={`markup-margin-icon${s.done ? ' done' : ''}`}
          style={{ top: s.top, left: s.left }}
          title="Open markup"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); setMarkupEditorId(s.id); }}
        >
          <MarkupIcon icon={s.icon} color={s.color} />
        </button>
      ))}
    </>
  );
}
