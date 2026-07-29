/**
 * v5.25/v5.26: THE annotation editor window — opens at the annotation's spot
 * on the page (the ScriptNotePopover seating rules: portalled, measured
 * top/left, never bottom-anchored, clamped into the viewport; an annotation
 * whose anchor left the script seats screen-center so it is never
 * uneditable). A self-contained mini TipTap editor: rich text, links,
 * bullet/numbered/check lists, images by URL, link-to-Scrapbook-page.
 *
 * v5.26: the icon and color show as single swatches — clicking opens the
 * picker windows (MarkupPickers). "Highlight selection in script" is a
 * checkbox (range annotations only) gating the highlight color. The icon
 * follows the FIRST content kind automatically until the user picks one by
 * hand (iconManual). The ⋮ menu carries status / hide-type / delete.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import {
  FaBold, FaItalic, FaListUl, FaListOl, FaCheckSquare, FaLink, FaRegImage, FaBook,
  FaRegEye, FaRegEyeSlash,
} from 'react-icons/fa';
import { useEditorStore } from '../stores/editorStore';
import { useNotebookStore } from '../stores/notebookStore';
import { AUTO_ICON } from './markupIcons';
import { DEFAULT_MARKUP_HIGHLIGHT } from '../stores/slices/markupsSlice';
import { MarkupColorSwatch, MarkupIconSwatch, MarkupDotsMenu } from './MarkupPickers';
import { findMarkupPos, setMarkupHighlight, firstContentKind } from '../utils/markupActions';

const POP_W = 380;

export default function MarkupPopover({ editor }: { editor: Editor | null }) {
  const id = useEditorStore((s) => s.markupEditorId);
  const markup = useEditorStore((s) => s.markups.find((m) => m.id === id) ?? null);
  const setMarkupEditorId = useEditorStore((s) => s.setMarkupEditorId);
  const updateMarkup = useEditorStore((s) => s.updateMarkup);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [scrapPicker, setScrapPicker] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);
  const nbPages = useNotebookStore((s) => s.pages);

  const mini = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, codeBlock: false, blockquote: false, horizontalRule: false }),
      Link.configure({ openOnClick: false }),
      Image,
      TaskList,
      TaskItem.configure({ nested: false }),
    ],
    content: null,
  }, []);

  // Load the annotation's content whenever a different one opens.
  useEffect(() => {
    if (!mini || !markup) return;
    mini.commands.setContent((markup.content as never) ?? '');
    setScrapPicker(false);
  }, [mini, id]);   // eslint-disable-line react-hooks/exhaustive-deps

  // v5.26 auto-icon: the FIRST content kind decides — but a hand-picked icon
  // is never overwritten (iconManual). Live, so the swatch reads true.
  useEffect(() => {
    if (!mini || !id) return;
    const sync = () => {
      const st = useEditorStore.getState();
      const m = st.markups.find((x) => x.id === id);
      if (!m || m.iconManual) return;
      const kind = firstContentKind(mini.getJSON());
      const auto = kind ? AUTO_ICON[kind] : null;
      if (auto && auto !== m.icon) st.updateMarkup(id, { icon: auto });
    };
    mini.on('update', sync);
    return () => { mini.off('update', sync); };
  }, [mini, id]);

  // Seat at the anchor — highlight span or block-anchored element; an
  // anchorless (orphaned) annotation seats screen-center so it can still be
  // read, edited and deleted (v5.26 — "unable to edit some items").
  useLayoutEffect(() => {
    if (!id) { setPos(null); return; }
    const place = () => {
      const el = document.querySelector(`.script-markup-highlight[data-markup-id="${CSS.escape(id)}"]`)
        || document.querySelector(`[data-markup-block="${CSS.escape(id)}"]`);
      let r = el?.getBoundingClientRect();
      if ((!r || (r.width === 0 && r.height === 0)) && editor && markup) {
        const p = findMarkupPos(editor, id);
        if (p != null) {
          try {
            const c = editor.view.coordsAtPos(Math.min(p + 1, editor.state.doc.content.size));
            r = { top: c.top, bottom: c.bottom, left: c.left, right: c.right, width: 0, height: c.bottom - c.top } as DOMRect;
          } catch { /* keep last */ }
        }
      }
      const h = popRef.current?.offsetHeight ?? 320;
      if (!r) {
        setPos({ top: Math.max(8, (window.innerHeight - h) / 2), left: Math.max(8, (window.innerWidth - POP_W) / 2) });
        return;
      }
      const below = r.bottom + 6;
      let top = below + h > window.innerHeight ? r.top - h - 6 : below;
      top = Math.max(8, Math.min(top, window.innerHeight - h - 8));
      setPos({ top, left: Math.max(8, Math.min(r.left, window.innerWidth - POP_W - 8)) });
    };
    place();
    const raf = requestAnimationFrame(place);
    window.addEventListener('resize', place);
    document.addEventListener('scroll', place, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', place);
      document.removeEventListener('scroll', place, true);
    };
  }, [id, editor, markup]);

  // Outside press closes AND SAVES (save-on-close = the sticky-card model).
  // Presses inside a picker/menu sub-popover count as INSIDE this window.
  useEffect(() => {
    if (!id) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (popRef.current?.contains(t)) return;
      if (t.closest?.('.markup-subpop')) return;
      save();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') save(); };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  });   // deliberately unmemoized: `save` closes over live editors

  if (!id || !markup || !pos) return null;

  const save = () => {
    if (mini) {
      const json = mini.getJSON();
      const empty = !mini.getText().trim() && !JSON.stringify(json).includes('"image"');
      updateMarkup(id, { content: empty ? null : json });
    }
    if (editor) editor.emit('update', { editor, transaction: editor.state.tr });
    setMarkupEditorId(null);
  };

  const setHighlight = (hl: string | null) => {
    updateMarkup(id, { highlight: hl });
    if (editor) setMarkupHighlight(editor, id, hl);
  };

  const promptLink = () => {
    const url = window.prompt('Link URL:');
    if (url) mini?.chain().focus().setLink({ href: url }).run();
  };
  const promptImage = () => {
    const url = window.prompt('Image URL:');
    if (url) mini?.chain().focus().setImage({ src: url }).run();
  };
  const linkScrapPage = (pageId: string, title: string) => {
    mini?.chain().focus().insertContent(`<a href="scrapbook:${pageId}">📖 ${title || 'Scrapbook page'}</a> `).run();
    setScrapPicker(false);
  };

  // v5.26: links in the note are CLICKABLE — scrapbook: links open that
  // Scrapbook page (saving this window first); web links open externally.
  const onBodyClick = (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest('a');
    if (!a) return;
    const href = a.getAttribute('href') ?? '';
    if (href.startsWith('scrapbook:')) {
      e.preventDefault();
      const pageId = href.slice('scrapbook:'.length);
      save();
      const nb = useNotebookStore.getState();
      if (nb.pages[pageId]) nb.selectPage(pageId);
      useEditorStore.getState().openTool('notebook');
    } else if (/^https?:/i.test(href)) {
      e.preventDefault();
      window.open(href, '_blank', 'noopener');
    }
  };

  const miniBtn = (active: boolean, title: string, onClick: () => void, child: React.ReactNode) => (
    <button className={`markup-mini-btn${active ? ' active' : ''}`} title={title} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>{child}</button>
  );

  return createPortal(
    <div ref={popRef} className="fs-markup-popover" style={{ top: pos.top, left: pos.left, width: POP_W }}
      onPointerDown={(e) => e.stopPropagation()}>
      {/* ONE head row (v5.29, Derek): "Icon:" swatches · "Highlight:" eye +
          swatch (range annotations only) · ⋮. The eye replaces the hide
          checkbox — eye-slash = hidden. Spacing/padding are Design knobs. */}
      <div className="markup-pop-row markup-pop-head">
        <span className="markup-pop-group">
          <span className="markup-pop-grouplabel">Icon:</span>
          <MarkupIconSwatch markup={markup} />
          <MarkupColorSwatch
            value={markup.color}
            title="Icon color"
            usedKind="color"
            onPick={(color) => updateMarkup(id, { color })}
          />
        </span>
        {markup.anchor === 'range' && (
          <span className="markup-pop-group">
            <span className="markup-pop-grouplabel">Highlight:</span>
            <button
              className={`markup-hl-eye${markup.highlight !== null ? ' active' : ''}`}
              title="Hide (or show) highlight in script"
              onClick={() => setHighlight(markup.highlight === null ? DEFAULT_MARKUP_HIGHLIGHT : null)}
            >
              {markup.highlight !== null ? <FaRegEye /> : <FaRegEyeSlash />}
            </button>
            {markup.highlight !== null && (
              <MarkupColorSwatch
                value={markup.highlight}
                title="Highlight color"
                usedKind="highlight"
                onPick={(color) => setHighlight(color)}
              />
            )}
          </span>
        )}
        <span className="markup-pop-spacer" />
        <MarkupDotsMenu markup={markup} editor={editor} onDeleted={() => setMarkupEditorId(null)} />
      </div>
      {/* mini editor toolbar */}
      <div className="markup-pop-row markup-mini-bar">
        {miniBtn(!!mini?.isActive('bold'), 'Bold', () => mini?.chain().focus().toggleBold().run(), <FaBold />)}
        {miniBtn(!!mini?.isActive('italic'), 'Italic', () => mini?.chain().focus().toggleItalic().run(), <FaItalic />)}
        {miniBtn(!!mini?.isActive('bulletList'), 'Bullet list', () => mini?.chain().focus().toggleBulletList().run(), <FaListUl />)}
        {miniBtn(!!mini?.isActive('orderedList'), 'Numbered list', () => mini?.chain().focus().toggleOrderedList().run(), <FaListOl />)}
        {miniBtn(!!mini?.isActive('taskList'), 'Checklist', () => mini?.chain().focus().toggleTaskList().run(), <FaCheckSquare />)}
        {miniBtn(!!mini?.isActive('link'), 'Insert link', promptLink, <FaLink />)}
        {miniBtn(false, 'Insert image by URL', promptImage, <FaRegImage />)}
        {miniBtn(scrapPicker, 'Link a Scrapbook page', () => setScrapPicker((v) => !v), <FaBook />)}
      </div>
      {scrapPicker && (
        <div className="markup-scrap-list">
          {Object.values(nbPages).length === 0 && <div className="markup-scrap-empty">No Scrapbook pages yet.</div>}
          {Object.values(nbPages).map((p) => (
            <button key={p.id} className="markup-scrap-item" onClick={() => linkScrapPage(p.id, p.title)}>{p.title || '(untitled page)'}</button>
          ))}
        </div>
      )}
      <div className="markup-mini-editor" onClick={onBodyClick}><EditorContent editor={mini} /></div>
      <div className="markup-pop-row markup-pop-foot">
        <span className="markup-pop-spacer" />
        <button className="dialog-btn dialog-btn-primary markup-save" onClick={save}>Save</button>
      </div>
    </div>,
    document.body,
  );
}
