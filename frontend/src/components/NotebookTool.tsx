/**
 * NotebookTool (v1.87; reshaped in v1.96) — a Notion / OneNote-style notebook.
 *
 * Adapted from Derek's Airtable Notebook extension. What survived: the
 * sidebar tree (sections with unlimited nesting, drag pages/sections
 * anywhere, drop into/before/after/top), the structured editable tables
 * (uncontrolled cells — his "first character disappears" fix), the
 * draggable/resizable canvas boxes (text, table, image with aspect-locked
 * resize), and image compression.
 *
 * v1.96, per Derek: the Notebook is NOT a normal tool window. The panel
 * window holds ONLY the tree (sections/pages) and always sits inline in
 * the dock; opening it puts the notebook's writing surface — a free canvas,
 * the flowing-document type is gone — over the entire editor area
 * (NotebookSurface, rendered by ScreenplayEditor like Statistics/Outline).
 * "Return to editor" in the surface header closes both.
 *
 * Tags that link notebook items to other tools come later, per Derek.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  useNotebookStore, newTable, nbUid,
  type NbNode, type NbTable, type NbBox,
} from '../stores/notebookStore';
import { useEditorStore } from '../stores/editorStore';
import { showToast } from './Toast';

const IMAGE_BUDGET = 300_000;   // dataURL chars — localStorage is the store

/* ── image helpers (his, typed) ── */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}
function compressImage(dataUrl: string, maxDim: number, quality: number): Promise<{ src: string; w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('no canvas')); return; }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      try { resolve({ src: canvas.toDataURL('image/jpeg', quality), w, h }); }
      catch (e) { reject(e); }
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/* ── structured table (his EditableTable, typed) ── */
function Cell({ value, onCommit, align }: {
  value: string; onCommit: (v: string) => void; align: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  useEffect(() => {
    // set once via ref; never re-applied mid-edit (his first-character fix)
    if (ref.current && !initialized.current) {
      ref.current.textContent = value || '';
      initialized.current = true;
    }
  }, [value]);
  return (
    <div
      ref={ref}
      className="fs-nb-cell"
      style={{ textAlign: align as 'left' }}
      contentEditable
      suppressContentEditableWarning
      onMouseDown={(e) => e.stopPropagation()}
      onBlur={() => onCommit(ref.current ? ref.current.textContent || '' : '')}
    />
  );
}

function EditableTable({ data, onChange, onDelete, selected }: {
  data: NbTable; onChange: (t: NbTable) => void; onDelete?: () => void; selected: boolean;
}) {
  const colWidths = data.colWidths;
  const rowHeights = data.rowHeights;
  const setCell = (ri: number, ci: number, value: string) =>
    onChange({ ...data, rows: data.rows.map((r, i) => (i === ri ? r.map((c, j) => (j === ci ? value : c)) : r)) });
  const addRow = () => onChange({ ...data, rows: [...data.rows, Array(data.rows[0]?.length || 2).fill('')], rowHeights: [...rowHeights, 32] });
  const delRow = () => { if (data.rows.length > 1) onChange({ ...data, rows: data.rows.slice(0, -1), rowHeights: rowHeights.slice(0, -1) }); };
  const addCol = () => onChange({ ...data, rows: data.rows.map((r) => [...r, '']), colWidths: [...colWidths, 90] });
  const delCol = () => { if ((data.rows[0]?.length || 0) > 1) onChange({ ...data, rows: data.rows.map((r) => r.slice(0, -1)), colWidths: colWidths.slice(0, -1) }); };

  const startColResize = (ci: number) => (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX;
    const startW = colWidths[ci] || 90;
    const move = (ev: MouseEvent) => {
      const next = colWidths.slice();
      next[ci] = Math.max(36, startW + (ev.clientX - startX));
      onChange({ ...data, colWidths: next });
    };
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  };
  const startRowResize = (ri: number) => (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const startY = e.clientY;
    const startH = rowHeights[ri] || 32;
    const move = (ev: MouseEvent) => {
      const next = rowHeights.slice();
      next[ri] = Math.max(24, startH + (ev.clientY - startY));
      onChange({ ...data, rowHeights: next });
    };
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  };

  // v1.99: an all-empty table is invisible on the canvas without help —
  // it gets the defined "I'm empty" border (same rule as empty text boxes).
  const isEmpty = data.rows.every((r) => r.every((c) => !c || !c.trim()));

  return (
    <div className={`fs-nb-table-wrap${isEmpty ? ' fs-nb-table-empty' : ''}`}>
      {selected && (
        <div className="fs-nb-table-bar">
          <button onMouseDown={(e) => { e.preventDefault(); addRow(); }}>+ Row</button>
          <button onMouseDown={(e) => { e.preventDefault(); delRow(); }}>− Row</button>
          <button onMouseDown={(e) => { e.preventDefault(); addCol(); }}>+ Col</button>
          <button onMouseDown={(e) => { e.preventDefault(); delCol(); }}>− Col</button>
          {(['left', 'center', 'right'] as const).map((a) => (
            <button key={a} className={data.align === a ? 'active' : ''}
              onMouseDown={(e) => { e.preventDefault(); onChange({ ...data, align: a }); }}>{a[0].toUpperCase()}</button>
          ))}
          {onDelete && <button className="fs-nb-danger" onMouseDown={(e) => { e.preventDefault(); onDelete(); }}>Delete</button>}
        </div>
      )}
      <table className="fs-nb-table" style={{ tableLayout: 'fixed' }}>
        <colgroup>{colWidths.map((w, ci) => <col key={ci} style={{ width: w }} />)}</colgroup>
        <tbody>
          {data.rows.map((row, ri) => (
            <tr key={ri} style={{ height: rowHeights[ri] || 32 }}>
              {row.map((cell, ci) => (
                <td key={ci} style={{ height: rowHeights[ri] || 32 }}>
                  <Cell value={cell} onCommit={(v) => setCell(ri, ci, v)} align={data.align} />
                  {ri === 0 && <div className="fs-nb-colgrip" onMouseDown={startColResize(ci)} />}
                  {ci === 0 && <div className="fs-nb-rowgrip" onMouseDown={startRowResize(ri)} />}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── canvas boxes (his, typed; text boxes stay contentEditable — they're
      scraps pinned to a board, not the document ProseMirror owns) ── */
function useBoxDrag(box: NbBox, onChange: (b: NbBox) => void) {
  const dragState = useRef<{ type: 'move' | 'resize'; startX: number; startY: number; origX: number; origY: number; origW: number; origH: number } | null>(null);
  const onMove = useCallback((e: MouseEvent) => {
    const ds = dragState.current;
    if (!ds) return;
    const dx = e.clientX - ds.startX, dy = e.clientY - ds.startY;
    if (ds.type === 'move') onChange({ ...box, x: Math.max(0, ds.origX + dx), y: Math.max(0, ds.origY + dy) });
    else if (box.type === 'image') {
      const aspect = ds.origH > 0 ? ds.origW / ds.origH : 1;
      const w = Math.max(40, ds.origW + dx);
      onChange({ ...box, w, h: Math.max(24, Math.round(w / aspect)) });
    } else {
      onChange({ ...box, w: Math.max(80, ds.origW + dx), h: Math.max(40, ds.origH + dy) });
    }
  }, [box, onChange]);
  const onUp = useCallback(() => {
    dragState.current = null;
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  }, [onMove]);
  const startDrag = (e: React.MouseEvent, type: 'move' | 'resize') => {
    e.preventDefault(); e.stopPropagation();
    dragState.current = { type, startX: e.clientX, startY: e.clientY, origX: box.x, origY: box.y, origW: box.w, origH: box.h };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };
  return startDrag;
}

function TextBox({ box, focused, onChange, onFocusBox, onDelete }: {
  box: NbBox; focused: boolean; onChange: (b: NbBox) => void; onFocusBox: (id: string) => void; onDelete: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const loaded = useRef(false);
  const startDrag = useBoxDrag(box, onChange);
  useEffect(() => {
    if (ref.current && !loaded.current) {
      ref.current.innerHTML = box.html || '';
      loaded.current = true;
    }
  }, [box.html]);
  const isEmpty = !box.html || box.html.replace(/<[^>]*>/g, '').trim() === '';
  return (
    <div
      className={`fs-nb-box${focused ? ' focused' : ''}${isEmpty && !focused ? ' empty' : ''}`}
      style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {focused && (
        <div className="fs-nb-box-head" onMouseDown={(e) => startDrag(e, 'move')}>
          <span>⋮⋮</span>
          <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(box.id); }}>✕</button>
        </div>
      )}
      <div
        ref={ref}
        className="fs-nb-box-body"
        style={{ height: focused ? box.h - 20 : box.h }}
        contentEditable
        suppressContentEditableWarning
        onMouseDown={() => onFocusBox(box.id)}
        onInput={() => onChange({ ...box, html: ref.current?.innerHTML || '' })}
        spellCheck
      />
      {focused && <div className="fs-nb-box-grip" onMouseDown={(e) => startDrag(e, 'resize')} />}
    </div>
  );
}

function ImageBox({ box, focused, onChange, onFocusBox, onDelete }: {
  box: NbBox; focused: boolean; onChange: (b: NbBox) => void; onFocusBox: (id: string) => void; onDelete: (id: string) => void;
}) {
  const startDrag = useBoxDrag(box, onChange);
  const [hover, setHover] = useState(false);
  const show = focused || hover;
  return (
    <div
      className="fs-nb-imgbox"
      style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
      onMouseDown={(e) => { e.stopPropagation(); onFocusBox(box.id); }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <img src={box.src} alt="" draggable={false} onMouseDown={(e) => startDrag(e, 'move')} />
      {show && (<>
        <button className="fs-nb-img-x" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(box.id); }}>✕</button>
        <div className="fs-nb-box-grip" onMouseDown={(e) => startDrag(e, 'resize')} />
      </>)}
    </div>
  );
}

function TableBox({ box, focused, onChange, onFocusBox, onDelete }: {
  box: NbBox; focused: boolean; onChange: (b: NbBox) => void; onFocusBox: (id: string) => void; onDelete: (id: string) => void;
}) {
  const startDrag = useBoxDrag(box, onChange);
  return (
    <div className="fs-nb-tablebox" style={{ left: box.x, top: box.y }}
      onMouseDown={(e) => { e.stopPropagation(); onFocusBox(box.id); }}>
      {focused && (
        <div className="fs-nb-box-movegrip" onMouseDown={(e) => startDrag(e, 'move')}>⋮⋮ move</div>
      )}
      <EditableTable
        data={{ id: box.id, rows: box.rows || [['', ''], ['', '']], colWidths: box.colWidths || [90, 90], rowHeights: box.rowHeights || [32, 32], align: box.align || 'left' }}
        onChange={(t) => onChange({ ...box, rows: t.rows, colWidths: t.colWidths, rowHeights: t.rowHeights, align: t.align })}
        onDelete={() => onDelete(box.id)}
        selected={focused}
      />
    </div>
  );
}

function CanvasSurface({ boxes, onChangeBoxes }: {
  boxes: NbBox[]; onChangeBoxes: (b: NbBox[]) => void;
}) {
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const addTextBoxAt = (e: React.MouseEvent) => {
    if (e.target !== canvasRef.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const nb: NbBox = {
      id: nbUid(), type: 'text',
      x: Math.max(0, e.clientX - rect.left + canvasRef.current.scrollLeft - 10),
      y: Math.max(0, e.clientY - rect.top + canvasRef.current.scrollTop - 10),
      w: 220, h: 120, html: '',
    };
    onChangeBoxes([...boxes, nb]);
    setFocusedId(nb.id);
  };

  const addImageFromFile = useCallback(async (file: File, atX: number | null, atY: number | null) => {
    if (!file.type.startsWith('image/')) return;
    try {
      const rawUrl = await fileToDataUrl(file);
      // compress progressively until it fits localStorage comfortably (his ladder)
      const attempts: Array<[number, number]> = [[900, 0.75], [720, 0.7], [600, 0.6], [480, 0.55], [360, 0.5]];
      let result: { src: string; w: number; h: number } | null = null;
      for (const [dim, q] of attempts) {
        result = await compressImage(rawUrl, dim, q);
        if (result.src.length <= IMAGE_BUDGET) break;
      }
      if (!result || result.src.length > IMAGE_BUDGET) {
        showToast('That image is too detailed to store in the notebook — try a smaller one.', 'error');
        return;
      }
      const maxBox = 320;
      const scale = Math.min(1, maxBox / Math.max(result.w, result.h));
      const nb: NbBox = {
        id: nbUid(), type: 'image',
        x: Math.max(0, (atX ?? 24) - 10), y: Math.max(0, (atY ?? 24) - 10),
        w: Math.max(40, Math.round(result.w * scale)), h: Math.max(40, Math.round(result.h * scale)),
        src: result.src,
      };
      onChangeBoxes([...boxes, nb]);
      setFocusedId(nb.id);
    } catch { showToast('Failed to process image.', 'error'); }
  }, [boxes, onChangeBoxes]);

  // toolbar buttons reach the canvas via events, like his version
  useEffect(() => {
    const txtH = () => {
      const nb: NbBox = { id: nbUid(), type: 'text', x: 24, y: 24, w: 220, h: 120, html: '' };
      onChangeBoxes([...boxes, nb]); setFocusedId(nb.id);
    };
    const tblH = () => {
      const t = newTable();
      const nb: NbBox = { id: nbUid(), type: 'table', x: 24, y: 24, w: 0, h: 0, rows: t.rows, colWidths: t.colWidths, rowHeights: t.rowHeights, align: 'left' };
      onChangeBoxes([...boxes, nb]); setFocusedId(nb.id);
    };
    window.addEventListener('nb-add-textbox', txtH);
    window.addEventListener('nb-add-table-canvas', tblH);
    return () => {
      window.removeEventListener('nb-add-textbox', txtH);
      window.removeEventListener('nb-add-table-canvas', tblH);
    };
  }, [boxes, onChangeBoxes]);

  const updateBox = (b: NbBox) => onChangeBoxes(boxes.map((x) => (x.id === b.id ? b : x)));
  const deleteBox = (id: string) => { onChangeBoxes(boxes.filter((x) => x.id !== id)); if (focusedId === id) setFocusedId(null); };

  return (
    <div
      ref={canvasRef}
      className="fs-nb-canvas"
      onDoubleClick={addTextBoxAt}
      onMouseDown={(e) => { if (e.target === canvasRef.current) setFocusedId(null); }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (!canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const file = e.dataTransfer.files?.[0];
        if (file) void addImageFromFile(file, e.clientX - rect.left + canvasRef.current.scrollLeft, e.clientY - rect.top + canvasRef.current.scrollTop);
      }}
    >
      <input
        type="file"
        accept="image/*"
        className="fs-nb-filepick"
        id="fs-nb-filepick"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void addImageFromFile(f, null, null); }}
      />
      {boxes.length === 0 && (
        <div className="fs-nb-canvas-hint">Double-click to add a text box · drag an image in · or use the toolbar.</div>
      )}
      {boxes.map((b) =>
        b.type === 'image' ? <ImageBox key={b.id} box={b} focused={focusedId === b.id} onChange={updateBox} onDelete={deleteBox} onFocusBox={setFocusedId} />
        : b.type === 'table' ? <TableBox key={b.id} box={b} focused={focusedId === b.id} onChange={updateBox} onDelete={deleteBox} onFocusBox={setFocusedId} />
        : <TextBox key={b.id} box={b} focused={focusedId === b.id} onChange={updateBox} onDelete={deleteBox} onFocusBox={setFocusedId} />)}
    </div>
  );
}

/* ── sidebar tree (his TreeView, typed) ── */
function dragStartData(e: React.DragEvent, id: string) {
  e.dataTransfer.setData('text/plain', id);   // WebKit: no data, no drag
  e.dataTransfer.effectAllowed = 'move';
}

function TreeNodes({ nodes, depth }: { nodes: NbNode[]; depth: number }) {
  return (
    <>
      {nodes.map((node) => node.type === 'section'
        ? <SectionRow key={node.id} node={node} depth={depth} />
        : <PageRow key={node.id} id={node.id} depth={depth} />)}
    </>
  );
}

function PageRow({ id, depth }: { id: string; depth: number }) {
  const page = useNotebookStore((s) => s.pages[id]);
  const selected = useNotebookStore((s) => s.selectedPageId === id);
  const { selectPage, deletePage, moveNode } = useNotebookStore.getState();
  const [over, setOver] = useState<'before' | 'after' | null>(null);
  if (!page) return null;
  return (
    <div
      className={`fs-nb-pagerow${selected ? ' active' : ''}${over ? ` over-${over}` : ''}`}
      style={{ marginLeft: depth * 12 }}
      draggable
      onDragStart={(e) => dragStartData(e, id)}
      onDragOver={(e) => {
        e.preventDefault();
        const r = e.currentTarget.getBoundingClientRect();
        setOver(e.clientY > r.top + r.height / 2 ? 'after' : 'before');
      }}
      onDragLeave={() => setOver(null)}
      onDrop={(e) => {
        e.preventDefault();
        const dragged = e.dataTransfer.getData('text/plain');
        if (dragged && dragged !== id) moveNode(dragged, { kind: over ?? 'after', id });
        setOver(null);
      }}
    >
      <span className="fs-nb-grabber">⋮⋮</span>
      <span className="fs-nb-pageicon">📄</span>
      <button className="fs-nb-pagename" onClick={() => selectPage(id)}>{page.title || 'Untitled'}</button>
      <button className="fs-nb-rowdel" title="Delete page" onClick={() => {
        if (window.confirm(`Delete “${page.title || 'Untitled'}”? This cannot be undone.`)) deletePage(id);
      }}>🗑</button>
    </div>
  );
}

function SectionRow({ node, depth }: { node: Extract<NbNode, { type: 'section' }>; depth: number }) {
  const { toggleSection, renameSection, deleteSection, moveNode } = useNotebookStore.getState();
  const [editing, setEditing] = useState(false);
  const [into, setInto] = useState(false);
  return (
    <div style={{ marginLeft: depth * 12 }}>
      <div
        className={`fs-nb-sectionrow${into ? ' over-into' : ''}`}
        draggable={!editing}
        onDragStart={(e) => { e.stopPropagation(); dragStartData(e, node.id); }}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setInto(true); }}
        onDragLeave={() => setInto(false)}
        onDrop={(e) => {
          e.preventDefault(); e.stopPropagation();
          const dragged = e.dataTransfer.getData('text/plain');
          if (dragged && dragged !== node.id) moveNode(dragged, { kind: 'into', id: node.id });
          setInto(false);
        }}
      >
        <button className="fs-nb-collapse" onClick={() => toggleSection(node.id)}>
          {node.collapsed ? '▸' : '▾'}
        </button>
        <span className="fs-nb-grabber">⋮⋮</span>
        <span className="fs-nb-pageicon">📁</span>
        {editing ? (
          <input
            autoFocus
            defaultValue={node.name}
            className="fs-nb-sectionname-input"
            onBlur={(e) => { renameSection(node.id, e.target.value); setEditing(false); }}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          />
        ) : (
          <button className="fs-nb-sectionname" onClick={() => toggleSection(node.id)} onDoubleClick={() => setEditing(true)} title="Double-click to rename">
            {node.name}
          </button>
        )}
        <button className="fs-nb-rowdel" title="Delete section (pages move to the top level)" onClick={() => {
          if (window.confirm('Delete this section? Pages inside it move back to the top level.')) deleteSection(node.id);
        }}>🗑</button>
      </div>
      {!node.collapsed && (
        <div className="fs-nb-children">
          <TreeNodes nodes={node.children} depth={depth + 1} />
          {node.children.length === 0 && <div className="fs-nb-emptysec">empty — drop pages here</div>}
        </div>
      )}
    </div>
  );
}

/* ── the tool: the PANEL is the tree; the SURFACE takes over the editor ── */

/** Closes the notebook everywhere: the editor surface and whichever slot the
 *  tool window occupies (left dock, right dock, or a temporary window). */
export function closeNotebook() {
  useNotebookStore.getState().setNotebookOpen(false);
  const s = useEditorStore.getState();
  if (s.activeTool === 'notebook') s.setActiveTool(null);
  if (s.activeToolRight === 'notebook') s.setActiveToolRight(null);
  if (s.tempTool === 'notebook') s.setTempTool(null);
}

/** The tool-window content: ONLY the sections/pages tree. Mounting it (the
 *  window opening) is what raises the notebook surface over the editor. */
export default function NotebookTool() {
  const tree = useNotebookStore((s) => s.tree);
  const { addPage, addSection, moveNode } = useNotebookStore.getState();
  // The "Drop here for top level" zone only appears mid-drag — it's the
  // target for pulling a page/section out of every section, and it read as
  // mystery chrome when it sat there permanently (Derek asked what it did).
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    useNotebookStore.getState().setNotebookOpen(true);
    return () => { useNotebookStore.getState().setNotebookOpen(false); };
  }, []);

  return (
    <div
      className="fs-notebook fs-nb-panel"
      onDragStartCapture={() => setDragging(true)}
      onDragEndCapture={() => setDragging(false)}
      onDropCapture={() => setDragging(false)}
    >
      <div className="fs-nb-side-head">
        <span>Pages</span>
        <span className="fs-nb-side-btns">
          <button title="New section" onClick={addSection}>🗂</button>
          <button title="New page" onClick={() => addPage()}>＋</button>
        </span>
      </div>
      <div className="fs-nb-tree">
        <TreeNodes nodes={tree} depth={0} />
        {tree.length === 0 && (
          <div className="fs-nb-empty">
            No pages yet — ＋ adds a page, 🗂 adds a section.
          </div>
        )}
      </div>
      {dragging && (
        <div
          className="fs-nb-toplevel-drop"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const dragged = e.dataTransfer.getData('text/plain');
            if (dragged) moveNode(dragged, { kind: 'top' });
            setDragging(false);
          }}
        >
          Drop here to move out of all sections
        </div>
      )}
    </div>
  );
}

/** The writing surface — rendered by ScreenplayEditor over the whole editor
 *  area while the notebook is open. Free canvas only (v1.96). */
export function NotebookSurface() {
  const page = useNotebookStore((s) => (s.selectedPageId ? s.pages[s.selectedPageId] : null));
  const { renamePage, updatePage } = useNotebookStore.getState();

  return (
    <div className="fs-nb-takeover">
      <div className="fs-nb-takeover-head">
        {page ? (
          <input
            key={page.id}
            className="fs-nb-title"
            defaultValue={page.title}
            placeholder="Untitled"
            onBlur={(e) => renamePage(page.id, e.target.value || 'Untitled')}
          />
        ) : (
          <span className="fs-nb-title fs-nb-title-empty">Notebook</span>
        )}
        {page && (
          <div className="fs-nb-toolbar">
            <button onClick={() => window.dispatchEvent(new Event('nb-add-textbox'))}>+ Text box</button>
            <button onClick={() => window.dispatchEvent(new Event('nb-add-table-canvas'))}>+ Table</button>
            <button onClick={() => (document.getElementById('fs-nb-filepick') as HTMLInputElement | null)?.click()}>+ Image</button>
          </div>
        )}
        <button className="fs-nb-return" onClick={closeNotebook}>Return to editor</button>
      </div>
      {page ? (
        <CanvasSurface key={page.id} boxes={page.boxes} onChangeBoxes={(boxes) => updatePage(page.id, { boxes })} />
      ) : (
        <div className="fs-nb-empty">Select or create a page in the Notebook panel to start writing.</div>
      )}
    </div>
  );
}
