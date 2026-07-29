/**
 * v5.25/v5.26: the annotation margin layer — each annotation's icon ON the
 * page, horizontally CENTERED in the right margin (the white part), and
 * vertically seated on the row where it was added: a cursor-made annotation
 * rides its element's first line; a selection-made one centers on the
 * selected text (v5.26, Derek's #12). Rendered as absolutely-positioned
 * children INSIDE the editor's scroll container so they ride the content;
 * positions recompute on doc / annotation changes, not on scroll.
 *
 * Also v5.26: annotation TYPES hidden via "Show in Script" (or a ⋮ menu)
 * drop their icons here AND have their highlight tint neutralized — the
 * span carries only a markup id, so the icon→span mapping is synced as a
 * class from here (the one place that already watches both).
 */
import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { useEditorStore } from '../stores/editorStore';
import { findMarkupPos } from '../utils/markupActions';
import { MarkupIcon } from './markupIcons';

interface IconSpot { id: string; top: number; left: number; icon: string; color: string; done: boolean }

const ICON = 22;   // .markup-margin-icon box (px)

export default function MarkupIconLayer({ editor, container }: {
  editor: Editor | null;
  container: HTMLDivElement | null;
}) {
  const markups = useEditorStore((s) => s.markups);
  const markupsVisible = useEditorStore((s) => s.markupsVisible);
  const markupHiddenIcons = useEditorStore((s) => s.markupHiddenIcons);
  const previewMode = useEditorStore((s) => s.previewMode);
  const pageLayout = useEditorStore((s) => s.pageLayout);
  const setMarkupEditorId = useEditorStore((s) => s.setMarkupEditorId);
  const [spots, setSpots] = useState<IconSpot[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!editor) return;
    const bump = () => setTick((t) => t + 1);
    editor.on('update', bump);
    return () => { editor.off('update', bump); };
  }, [editor]);

  // Hidden-type highlight neutralization: tag every span whose annotation's
  // TYPE is hidden. Runs even while the whole layer is off (markupsVisible
  // false unmounts icons via the render below, but spans always exist).
  useEffect(() => {
    const hidden = new Set(markupHiddenIcons);
    for (const m of markups) {
      const spans = document.querySelectorAll(`.script-markup-highlight[data-markup-id="${CSS.escape(m.id)}"]`);
      spans.forEach((el) => el.classList.toggle('markup-type-hidden', hidden.has(m.icon)));
    }
  }, [markups, markupHiddenIcons, tick]);

  useEffect(() => {
    if (!editor || !container || !markupsVisible || previewMode) { setSpots([]); return; }
    const crect = container.getBoundingClientRect();
    const page = container.querySelector('.page');
    const prect = page?.getBoundingClientRect();
    // Rendered right-margin width: layout inches × 96, scaled by the page's
    // on-screen size (zoom). The icon centers inside that band, ON the page.
    const scale = prect ? prect.width / (pageLayout.pageWidth * 96) : 1;
    const marginPx = pageLayout.rightMargin * 96 * scale;
    const next: IconSpot[] = [];
    for (const m of markups) {
      if (markupHiddenIcons.includes(m.icon)) continue;
      const pos = findMarkupPos(editor, m.id);
      if (pos == null) continue;
      let centerY: number | null = null;
      if (m.anchor === 'range') {
        // vertical CENTER of the selected text — union of its highlight spans
        const spans = container.querySelectorAll(`.script-markup-highlight[data-markup-id="${CSS.escape(m.id)}"]`);
        if (spans.length) {
          let top = Infinity, bottom = -Infinity;
          spans.forEach((el) => {
            const r = el.getBoundingClientRect();
            top = Math.min(top, r.top);
            bottom = Math.max(bottom, r.bottom);
          });
          centerY = (top + bottom) / 2;
        }
      }
      if (centerY == null) {
        // block-anchored (or span lookup failed): the element's first line
        try {
          const c = editor.view.coordsAtPos(Math.min(pos + 1, editor.state.doc.content.size));
          centerY = (c.top + c.bottom) / 2;
        } catch { continue; }
      }
      next.push({
        id: m.id,
        top: centerY - crect.top + container.scrollTop - ICON / 2,
        left: prect
          ? prect.right - crect.left + container.scrollLeft - marginPx / 2 - ICON / 2
          : crect.width - 40 + container.scrollLeft,
        icon: m.icon,
        color: m.color,
        done: m.done,
      });
    }
    setSpots(next);
  }, [editor, container, markups, markupsVisible, markupHiddenIcons, previewMode, pageLayout, tick]);

  if (!markupsVisible || previewMode) return null;
  return (
    <>
      {spots.map((s) => (
        <button
          key={s.id}
          className={`markup-margin-icon${s.done ? ' done' : ''}`}
          style={{ top: s.top, left: s.left }}
          title="Open annotation"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); setMarkupEditorId(s.id); }}
        >
          <MarkupIcon icon={s.icon} color={s.color} />
        </button>
      ))}
    </>
  );
}
