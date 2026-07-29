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
  FaRegTrashAlt,
} from 'react-icons/fa';
import { useEditorStore } from '../stores/editorStore';
import { useNotebookStore } from '../stores/notebookStore';
import { AUTO_ICON, MarkupIcon } from './markupIcons';
import { DEFAULT_MARKUP_HIGHLIGHT } from '../stores/slices/markupsSlice';
import { confirmDialog } from './ConfirmDialog';
import { FullscreenIcon } from './uiIcons';
import { convertMarkupToPoint, convertMarkupToRange } from '../utils/markupActions';
import { MarkupColorSwatch, MarkupUsedRow, MarkupDotsMenu } from './MarkupPickers';
import { findMarkupPos, setMarkupHighlight, firstContentKind, markupNavLines } from '../utils/markupActions';

const POP_W = 380;

export default function MarkupPopover({ editor }: { editor: Editor | null }) {
  const id = useEditorStore((s) => s.markupEditorId);
  const markup = useEditorStore((s) => s.markups.find((m) => m.id === id) ?? null);
  const setMarkupEditorId = useEditorStore((s) => s.setMarkupEditorId);
  const updateMarkup = useEditorStore((s) => s.updateMarkup);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [scrapPicker, setScrapPicker] = useState(false);
  // v5.30 window chrome: drag override + fullscreen; a ref mirrors them so
  // the scroll/resize re-seat handler can stand down once the user takes over.
  const [dragPos, setDragPos] = useState<{ top: number; left: number } | null>(null);
  const [maximized, setMaximized] = useState(false);
  // v5.31: "Add Highlighted Text in Script" — the window stays open while
  // the user selects; a ref lets the outside-press saver stand down.
  const [pickingRange, setPickingRange] = useState(false);
  const pickingRef = useRef(false);
  pickingRef.current = pickingRange;
  const overrideRef = useRef(false);
  overrideRef.current = dragPos !== null || maximized;
  // what the annotation looked like when this window opened — the X button's
  // discard restores it ("close without saving")
  const snapRef = useRef<{ json: string; icon: string; color: string; highlight: string | null; done: boolean } | null>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const nbPages = useNotebookStore((s) => s.pages);
  // v5.33, Derek: "Displays as:" — the Navigator row, previewed LIVE.
  const [navPreview, setNavPreview] = useState<string[]>([]);
  // the seat function, reachable from the ResizeObserver effect below
  const reseatRef = useRef<(() => void) | null>(null);

  const mini = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, codeBlock: false, blockquote: false, horizontalRule: false }),
      // v5.33: 'scrapbook' must be an ALLOWED protocol — tiptap's Link
      // strips the href of any scheme it doesn't know at render time, which
      // left Scrapbook links as dead <a href=""> anchors.
      Link.configure({ openOnClick: false, protocols: ['scrapbook'] }),
      Image,
      TaskList,
      TaskItem.configure({ nested: false }),
    ],
    content: null,
  }, []);

  // Load the annotation's content whenever a different one opens — and
  // snapshot its state for the × button's are-you-sure discard (v5.30).
  useEffect(() => {
    if (!mini || !markup) return;
    mini.commands.setContent((markup.content as never) ?? '');
    snapRef.current = {
      json: JSON.stringify(mini.getJSON()),
      icon: markup.icon,
      color: markup.color,
      highlight: markup.highlight,
      done: markup.done,
    };
    setScrapPicker(false);
    setDragPos(null);
    setMaximized(false);
    setPickingRange(false);
  }, [mini, id]);   // eslint-disable-line react-hooks/exhaustive-deps

  // v5.31: while picking, the next real selection in the SCRIPT converts
  // this point annotation into a range annotation (yellow default).
  useEffect(() => {
    if (!pickingRange || !editor || !id) return;
    const dom = editor.view.dom;
    const onUp = () => {
      window.setTimeout(() => {
        const sel = editor.state.selection;
        if (sel.empty) return;
        convertMarkupToRange(editor, id, sel.from, sel.to);
        setPickingRange(false);
      }, 0);
    };
    dom.addEventListener('mouseup', onUp);
    return () => dom.removeEventListener('mouseup', onUp);
  }, [pickingRange, editor, id]);

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

  // v5.33: the "Displays as:" lines track the mini editor keystroke-live —
  // the same capper the Navigator renders with (markupNavLines).
  useEffect(() => {
    if (!mini || !id) return;
    const syncPreview = () => setNavPreview(markupNavLines(mini.getJSON()));
    syncPreview();
    mini.on('update', syncPreview);
    return () => { mini.off('update', syncPreview); };
  }, [mini, id]);

  // Seat UNDER the annotation's on-script margin icon (v5.33, Derek), with
  // the window's right edge on the side panel's left edge — or centered
  // under the icon when no right panel is showing. When the icon is hidden
  // (type filtered out, layer off) the highlight/block rect stands in; an
  // anchorless (orphaned) annotation seats screen-center so it can still be
  // read, edited and deleted (v5.26 — "unable to edit some items").
  useLayoutEffect(() => {
    if (!id) { setPos(null); return; }
    const place = () => {
      if (overrideRef.current) return;   // dragged or fullscreen — user owns it
      const el = document.querySelector(`.markup-margin-icon[data-markup-icon="${CSS.escape(id)}"]`)
        || document.querySelector(`.script-markup-highlight[data-markup-id="${CSS.escape(id)}"]`)
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
      // live offsetWidth — the window is user-resizable (v5.33)
      const w = popRef.current?.offsetWidth || POP_W;
      const h = popRef.current?.offsetHeight || 320;
      if (!r) {
        setPos({ top: Math.max(8, (window.innerHeight - h) / 2), left: Math.max(8, (window.innerWidth - w) / 2) });
        return;
      }
      const below = r.bottom + 6;
      let top = below + h > window.innerHeight ? r.top - h - 6 : below;
      top = Math.max(8, Math.min(top, window.innerHeight - h - 8));
      const dockR = document.querySelector('.tool-dock-wrap.tool-dock-right')?.getBoundingClientRect();
      const left = dockR && dockR.width > 0
        ? dockR.left - w
        : r.left + r.width / 2 - w / 2;
      setPos({ top, left: Math.max(8, Math.min(left, window.innerWidth - w - 8)) });
    };
    reseatRef.current = place;
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

  // v5.33: the window is user-resizable — when its SIZE changes, re-seat so
  // the right edge stays pinned to the panel edge (the box grows leftward).
  // A dragged or maximized window is the user's own geometry; place()
  // already stands down for those.
  const hasPos = pos !== null;
  useEffect(() => {
    if (!hasPos || !popRef.current || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => reseatRef.current?.());
    ro.observe(popRef.current);
    return () => ro.disconnect();
  }, [id, hasPos]);

  // Outside press closes AND SAVES (save-on-close = the sticky-card model).
  // Presses inside a picker/menu sub-popover count as INSIDE this window.
  useEffect(() => {
    if (!id) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (popRef.current?.contains(t)) return;
      if (t.closest?.('.markup-subpop')) return;
      // v5.30: the ×'s are-you-sure dialog is outside this window — its
      // buttons must not double as an outside-press save.
      if (t.closest?.('.fs-confirm-overlay')) return;
      // v5.31: script clicks while picking a highlight ARE the flow.
      if (pickingRef.current) return;
      save();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (document.querySelector('.fs-confirm-overlay')) return;   // dialog owns Esc
      if (pickingRef.current) { setPickingRange(false); return; }  // cancel the pick only
      save();
    };
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
    // v5.33: a REAL link mark, not an HTML string — the Link extension's
    // scheme validation rejected the scrapbook: protocol on parse, so the
    // raw <a…> markup landed in the note as plain text.
    mini?.chain().focus().insertContent([
      {
        type: 'text',
        text: `📖 ${title || 'Scrapbook page'}`,
        marks: [{ type: 'link', attrs: { href: `scrapbook:${pageId}` } }],
      },
      { type: 'text', text: ' ' },
    ]).run();
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

  // v5.30: window chrome — drag by the title bar; × discards (with a
  // confirm when something changed); the square maximizes.
  const isDirty = () => {
    const snap = snapRef.current;
    if (!snap || !mini) return false;
    return JSON.stringify(mini.getJSON()) !== snap.json
      || markup.icon !== snap.icon || markup.color !== snap.color
      || markup.highlight !== snap.highlight || markup.done !== snap.done;
  };
  const closeWithoutSaving = async () => {
    const snap = snapRef.current;
    if (isDirty() && snap) {
      const sure = await confirmDialog('Are you sure you want to close this annotation without saving?');
      if (!sure) return;
      updateMarkup(id, { icon: snap.icon, color: snap.color, highlight: snap.highlight, done: snap.done });
      if (editor) setMarkupHighlight(editor, id, snap.highlight);
    }
    setMarkupEditorId(null);
  };
  const startDrag = (e: React.PointerEvent) => {
    if (maximized) return;
    const start = dragPos ?? pos;
    if (!start) return;
    const sx = e.clientX, sy = e.clientY;
    const move = (ev: PointerEvent) => setDragPos({
      top: Math.max(8, Math.min(start.top + ev.clientY - sy, window.innerHeight - 60)),
      left: Math.max(8, Math.min(start.left + ev.clientX - sx, window.innerWidth - 120)),
    });
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    e.preventDefault();
  };

  // width lives in CSS (v5.33: the window is user-resizable — the browser's
  // resize handle writes inline width/height that React must not clobber)
  const winStyle = maximized
    ? { top: 48, left: 48, right: 48, bottom: 48 }
    : { top: (dragPos ?? pos).top, left: (dragPos ?? pos).left };

  return createPortal(
    <div ref={popRef} className={`fs-markup-popover${maximized ? ' maximized' : ''}`} style={winStyle}
      onPointerDown={(e) => e.stopPropagation()}>
      {/* the draggable title bar — fullscreen and × like every window;
          v5.33, Derek: the ⋮ rides here too, left of the fullscreen button */}
      <div className="markup-pop-titlebar" onPointerDown={startDrag}>
        <span className="markup-pop-title">Annotation</span>
        <span className="markup-titlebar-dots" onPointerDown={(e) => e.stopPropagation()}>
          <MarkupDotsMenu markup={markup} editor={editor} onDeleted={() => setMarkupEditorId(null)} />
        </span>
        <button className="markup-win-btn" title={maximized ? 'Exit full screen' : 'Full screen'}
          onPointerDown={(e) => e.stopPropagation()} onClick={() => setMaximized((v) => !v)}>
          <FullscreenIcon />
        </button>
        <button className="markup-win-btn markup-win-close" title="Close without saving"
          onPointerDown={(e) => e.stopPropagation()} onClick={closeWithoutSaving}>
          ×
        </button>
      </div>
      {/* ONE head row (v5.29, Derek): "Icon:" swatches · "Highlight:"
          swatch (range annotations only). Spacing/padding are Design knobs.
          v5.33: the row wraps — when the Used combos leave no room, the
          highlight group drops to a second row (Derek). */}
      <div className="markup-pop-row markup-pop-head">
        <span className="markup-pop-group markup-pop-icon-group">
          <span className="markup-pop-grouplabel">Icon:</span>
          {/* v5.31: the USED combos ride the window itself; + = the
              combined icon-and-color picker */}
          <MarkupUsedRow markup={markup} />
        </span>
        <span className="markup-pop-spacer" />
        {markup.anchor === 'range' ? (
          <span className="markup-pop-group">
            <span className="markup-pop-grouplabel">Highlight:</span>
            <MarkupColorSwatch
              value={markup.highlight ?? DEFAULT_MARKUP_HIGHLIGHT}
              title="Highlight color"
              usedKind="highlight"
              onPick={(color) => setHighlight(color)}
            />
            {/* v5.31, Derek: DELETE the highlight — the annotation stays,
                re-anchored to the element as a cursor-made one. */}
            <button
              className="markup-hl-eye markup-hl-del"
              title="Delete highlight (the annotation stays)"
              onClick={() => { if (editor) convertMarkupToPoint(editor, id); }}
            >
              <FaRegTrashAlt />
            </button>
          </span>
        ) : (
          <span className="markup-pop-group">
            <button
              className={`markup-hl-clear markup-add-hl${pickingRange ? ' active' : ''}`}
              title="Highlight text in the script and link it to this annotation"
              onClick={() => setPickingRange((v) => !v)}
            >
              {pickingRange ? 'Select text in the script…' : 'Link Script Text'}
            </button>
          </span>
        )}
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
      {/* v5.33, Derek: "Displays as:" — the Navigator row this annotation
          will produce, live. Same classes as the real row so they can't
          drift apart. Empty content = icon only, exactly like the row. */}
      <div className="markup-pop-row markup-pop-preview">
        <span className="markup-pop-grouplabel">Displays as:</span>
        <span className="fs-nav-anno markup-nav-preview" style={{ color: markup.color }}>
          <span className="fs-nav-kind-icon fs-nav-markup-icon">
            <MarkupIcon icon={markup.icon} color={markup.color} />
          </span>
          {navPreview.length > 0 && (
            <span className="fs-nav-anno-lines">
              {navPreview.map((l, i) => (
                <span key={i} className="fs-nav-anno-line">{l}</span>
              ))}
            </span>
          )}
        </span>
      </div>
      <div className="markup-pop-row markup-pop-foot">
        <span className="markup-pop-spacer" />
        <button className="dialog-btn dialog-btn-primary markup-save" onClick={save}>Save</button>
      </div>
    </div>,
    document.body,
  );
}
