/**
 * v5.25: THE markup editor window — opens at the markup's spot on the page
 * (the ScriptNotePopover seating rules: portalled, measured top/left, never
 * bottom-anchored). A self-contained mini TipTap editor: rich text, links,
 * bullet/numbered/check lists, images by URL, link-to-Scrapbook-page. Icon
 * presets come from Customize ▸ Markups; plus the full icon + emoji list and
 * a color per markup. Range-anchored markups also offer a highlight color.
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
  FaBold, FaItalic, FaListUl, FaListOl, FaCheckSquare, FaLink, FaRegImage, FaBook, FaRegTrashAlt,
} from 'react-icons/fa';
import { useEditorStore } from '../stores/editorStore';
import { useNotebookStore } from '../stores/notebookStore';
import { MARKUP_ICONS, MARKUP_EMOJI, MARKUP_COLORS, MARKUP_HIGHLIGHTS, MarkupIcon } from './markupIcons';
import { findMarkupPos, removeMarkupFromDoc, setMarkupHighlight } from '../utils/markupActions';

const POP_W = 380;

export default function MarkupPopover({ editor }: { editor: Editor | null }) {
  const id = useEditorStore((s) => s.markupEditorId);
  const markup = useEditorStore((s) => s.markups.find((m) => m.id === id) ?? null);
  const presets = useEditorStore((s) => s.markupPresets);
  const setMarkupEditorId = useEditorStore((s) => s.setMarkupEditorId);
  const updateMarkup = useEditorStore((s) => s.updateMarkup);
  const removeMarkup = useEditorStore((s) => s.removeMarkup);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [morePicker, setMorePicker] = useState(false);
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

  // Load the markup's content whenever a different markup opens.
  useEffect(() => {
    if (!mini || !markup) return;
    mini.commands.setContent((markup.content as never) ?? '');
    setMorePicker(false);
    setScrapPicker(false);
  }, [mini, id]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Seat under the margin icon (or the highlight span) — top/left only.
  useLayoutEffect(() => {
    if (!id) { setPos(null); return; }
    const place = () => {
      const el = document.querySelector(`.script-markup-highlight[data-markup-id="${CSS.escape(id)}"]`);
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
      if (!r) return;
      const h = popRef.current?.offsetHeight ?? 320;
      const top = r.bottom + 6 + h > window.innerHeight ? Math.max(8, r.top - h - 6) : r.bottom + 6;
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
  useEffect(() => {
    if (!id) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (popRef.current?.contains(t)) return;
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

  const del = () => {
    if (editor) {
      removeMarkupFromDoc(editor, id);
      editor.emit('update', { editor, transaction: editor.state.tr });
    }
    removeMarkup(id);
    setMarkupEditorId(null);
  };

  const setIconColor = (patch: { icon?: string; color?: string }) => updateMarkup(id, patch);
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

  const miniBtn = (active: boolean, title: string, onClick: () => void, child: React.ReactNode) => (
    <button className={`markup-mini-btn${active ? ' active' : ''}`} title={title} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>{child}</button>
  );

  return createPortal(
    <div ref={popRef} className="fs-markup-popover" style={{ top: pos.top, left: pos.left, width: POP_W }}
      onPointerDown={(e) => e.stopPropagation()}>
      {/* icon presets + more + color */}
      <div className="markup-pop-row">
        {presets.map((p, i) => (
          <button
            key={`${p.icon}-${i}`}
            className={`markup-preset${markup.icon === p.icon && markup.color === p.color ? ' active' : ''}`}
            title="Preset icon"
            onClick={() => setIconColor({ icon: p.icon, color: p.color })}
          ><MarkupIcon icon={p.icon} color={p.color} /></button>
        ))}
        <button className={`markup-preset markup-more${morePicker ? ' active' : ''}`} title="More icons & emoji" onClick={() => setMorePicker((v) => !v)}>…</button>
        <span className="markup-color-dots">
          {MARKUP_COLORS.map((c) => (
            <button key={c} className={`markup-dot${markup.color === c ? ' active' : ''}`} style={{ background: c }} title="Icon color" onClick={() => setIconColor({ color: c })} />
          ))}
          <input type="color" className="markup-dot markup-dot-custom" value={markup.color} title="Custom color" onChange={(e) => setIconColor({ color: e.target.value })} />
        </span>
      </div>
      {morePicker && (
        <div className="markup-pop-grid">
          {Object.keys(MARKUP_ICONS).map((k) => (
            <button key={k} className={`markup-preset${markup.icon === k ? ' active' : ''}`} onClick={() => { setIconColor({ icon: k }); setMorePicker(false); }}>
              <MarkupIcon icon={k} color={markup.color} />
            </button>
          ))}
          {MARKUP_EMOJI.map((e) => (
            <button key={e} className={`markup-preset${markup.icon === `emoji:${e}` ? ' active' : ''}`} onClick={() => { setIconColor({ icon: `emoji:${e}` }); setMorePicker(false); }}>
              <span className="markup-emoji">{e}</span>
            </button>
          ))}
        </div>
      )}
      {/* highlight color — range markups only */}
      {markup.anchor === 'range' && (
        <div className="markup-pop-row markup-hl-row">
          <span className="markup-pop-label">Highlight:</span>
          {MARKUP_HIGHLIGHTS.map((c) => (
            <button key={c} className={`markup-dot${markup.highlight === c ? ' active' : ''}`} style={{ background: c }} title="Highlight text" onClick={() => setHighlight(c)} />
          ))}
          <input type="color" className="markup-dot markup-dot-custom" value={markup.highlight ?? '#ffe066'} title="Custom highlight" onChange={(e) => setHighlight(e.target.value)} />
          <button className="markup-hl-clear" title="No highlight" onClick={() => setHighlight(null)}>None</button>
        </div>
      )}
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
      <div className="markup-mini-editor"><EditorContent editor={mini} /></div>
      <div className="markup-pop-row markup-pop-foot">
        <label className="markup-done">
          <input type="checkbox" checked={markup.done} onChange={() => updateMarkup(id, { done: !markup.done })} />
          Complete
        </label>
        <span className="markup-foot-actions">
          <button className="markup-del" title="Delete markup" onClick={del}><FaRegTrashAlt /></button>
          <button className="dialog-btn dialog-btn-primary markup-save" onClick={save}>Save</button>
        </span>
      </div>
    </div>,
    document.body,
  );
}
