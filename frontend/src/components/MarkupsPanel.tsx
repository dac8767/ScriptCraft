/**
 * v5.25: the Markups tool window — every markup on the script in one list.
 * A card shows the markup's icon, a text preview, its page number and scene
 * heading; double-click jumps the script there (the Navigator's gesture),
 * the pencil opens its popover, the checkbox completes it. Filter narrows by
 * state (open / completed / all — OPEN is the default), by content kind, and
 * by icon. Header chrome: the count (TitleExtra), the eye toggle riding the
 * controls cluster (the Tags model), and Filter. The body's top row is the
 * Markup Script button — the same creator the ribbon and context menu call.
 */
import { useEffect, useMemo, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { FaRegEye, FaRegEyeSlash, FaPencilAlt, FaRegTrashAlt } from 'react-icons/fa';
import { useEditorStore } from '../stores/editorStore';
import { computePageBlocks } from '../editor/pagination';
import { ControlDropdown } from './ToolControls';
import { MarkupIcon } from './markupIcons';
import {
  createMarkupAtSelection, findMarkupPos, markupKinds, markupPreviewText,
  pageForPos, removeMarkupFromDoc, sceneHeadingBefore,
} from '../utils/markupActions';
import type { MarkupKind, ScriptMarkup } from '../stores/slices/markupsSlice';

const KIND_LABELS: Record<MarkupKind, string> = {
  note: 'Note', bullets: 'Bullet list', numbers: 'Numbered list',
  checklist: 'Checklist', link: 'Link', image: 'Image',
};
const ALL_KINDS = Object.keys(KIND_LABELS) as MarkupKind[];
const DONE_LABELS = { open: 'Open', done: 'Completed', all: 'All' } as const;

/** Icon-key → menu label ('emoji:🎬' shows the emoji itself). */
const iconLabel = (k: string) => (k.startsWith('emoji:') ? k.slice(6) : k[0].toUpperCase() + k.slice(1));

export function MarkupsTitleExtra() {
  const markups = useEditorStore((s) => s.markups);
  const filters = useEditorStore((s) => s.markupFilters);
  const shown = markups.filter((m) => filters.done === 'all' || (filters.done === 'done') === m.done).length;
  return <span className="tool-title-extra">· {shown}</span>;
}

/** The eye — the whole tool's show/hide, same state as ribbon + View menu. */
export function MarkupsWindowActions() {
  const markupsVisible = useEditorStore((s) => s.markupsVisible);
  const setMarkupsVisible = useEditorStore((s) => s.setMarkupsVisible);
  return (
    <button
      className={`tags-visibility-btn${markupsVisible ? ' active' : ''}`}
      onClick={() => setMarkupsVisible(!markupsVisible)}
      title={markupsVisible ? 'Hide markups in script' : 'Show markups in script'}
      aria-label={markupsVisible ? 'Hide markups in script' : 'Show markups in script'}
    >
      {markupsVisible ? <FaRegEye /> : <FaRegEyeSlash />}
    </button>
  );
}

export function MarkupsControls() {
  const filters = useEditorStore((s) => s.markupFilters);
  const setFilters = useEditorStore((s) => s.setMarkupFilters);
  const markups = useEditorStore((s) => s.markups);
  // Only icons actually in use are offered (plus any already-selected one,
  // so an active filter can always be un-picked even if its last markup went).
  const usedIcons = useMemo(
    () => [...new Set([...markups.map((m) => m.icon), ...filters.icons])],
    [markups, filters.icons],
  );
  const toggle = <T,>(list: T[], v: T) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  const chip = filters.icons.length + filters.kinds.length + (filters.done !== 'open' ? 1 : 0);
  return (
    <ControlDropdown
      label="Filter"
      chip={chip}
      items={[
        ...(['open', 'done', 'all'] as const).map((d) => ({
          label: DONE_LABELS[d],
          active: filters.done === d,
          keepOpen: true,
          onSelect: () => setFilters({ ...filters, done: d }),
        })),
        ...ALL_KINDS.map((k) => ({
          label: KIND_LABELS[k],
          active: filters.kinds.includes(k),
          keepOpen: true,
          onSelect: () => setFilters({ ...filters, kinds: toggle(filters.kinds, k) }),
        })),
        ...usedIcons.map((ic) => ({
          label: iconLabel(ic),
          active: filters.icons.includes(ic),
          keepOpen: true,
          onSelect: () => setFilters({ ...filters, icons: toggle(filters.icons, ic) }),
        })),
      ]}
    />
  );
}

interface Row { m: ScriptMarkup; pos: number | null; page: number | null; heading: string }

export default function MarkupsPanel({ editor }: { editor: Editor | null }) {
  const markups = useEditorStore((s) => s.markups);
  const filters = useEditorStore((s) => s.markupFilters);
  const updateMarkup = useEditorStore((s) => s.updateMarkup);
  const removeMarkup = useEditorStore((s) => s.removeMarkup);
  const setMarkupEditorId = useEditorStore((s) => s.setMarkupEditorId);
  const pageLayout = useEditorStore((s) => s.pageLayout);
  const [docTick, setDocTick] = useState(0);

  useEffect(() => {
    if (!editor) return;
    const bump = () => setDocTick((t) => t + 1);
    editor.on('update', bump);
    return () => { editor.off('update', bump); };
  }, [editor]);

  const rows = useMemo<Row[]>(() => {
    const pageContent = editor ? computePageBlocks(editor.state.doc, pageLayout) : [];
    const out: Row[] = markups.map((m) => {
      const pos = editor ? findMarkupPos(editor, m.id) : null;
      return {
        m,
        pos,
        page: pos != null ? pageForPos(pageContent, pos) : null,
        heading: pos != null && editor ? sceneHeadingBefore(editor, pos) : '',
      };
    });
    // Script order; markups whose anchor text was deleted sink to the end
    // (still listed — their content survives and stays deletable).
    out.sort((a, b) => (a.pos ?? Infinity) - (b.pos ?? Infinity));
    return out;
    // docTick re-scans positions after each doc change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, markups, pageLayout, docTick]);

  const visible = rows.filter(({ m }) => {
    if (filters.done !== 'all' && (filters.done === 'done') !== m.done) return false;
    if (filters.icons.length && !filters.icons.includes(m.icon)) return false;
    if (filters.kinds.length) {
      const kinds = markupKinds(m);
      if (!filters.kinds.some((k) => kinds.includes(k))) return false;
    }
    return true;
  });

  const jumpTo = (pos: number) => {
    const s = useEditorStore.getState();
    if (s.fullscreenTool) s.setFullscreenTool(null);
    s.requestEditorScroll(pos);
  };

  const del = (id: string) => {
    if (editor) {
      removeMarkupFromDoc(editor, id);
      editor.emit('update', { editor, transaction: editor.state.tr });
    }
    removeMarkup(id);
  };

  return (
    <div className="markups-panel">
      <div className="markups-add-row">
        <button
          className="dialog-btn dialog-btn-primary markups-add-btn"
          disabled={!editor}
          onClick={() => { if (editor) createMarkupAtSelection(editor); }}
        >
          + Markup Script
        </button>
      </div>
      <div className="markups-list">
        {visible.length === 0 && (
          <div className="markups-empty">
            {markups.length === 0
              ? 'Select text (or place the cursor) and hit Markup Script — your markups collect here.'
              : 'No markups match the current filter.'}
          </div>
        )}
        {visible.map(({ m, pos, page, heading }) => (
          <div
            key={m.id}
            className={`markup-card${m.done ? ' done' : ''}`}
            onDoubleClick={() => { if (pos != null) jumpTo(pos); }}
            title={pos != null ? 'Double-click to go to this markup' : undefined}
          >
            <span className="markup-card-icon"><MarkupIcon icon={m.icon} color={m.color} /></span>
            <div className="markup-card-main">
              <div className="markup-card-text">{markupPreviewText(m) || '(empty markup)'}</div>
              <div className="markup-card-meta">
                {pos != null
                  ? `p. ${page}${heading ? ` · ${heading}` : ''}`
                  : 'location removed from script'}
              </div>
            </div>
            <span className="markup-card-actions">
              <input
                type="checkbox"
                className="markup-card-check"
                checked={m.done}
                title={m.done ? 'Reopen' : 'Complete'}
                onChange={() => updateMarkup(m.id, { done: !m.done })}
              />
              <button className="markup-card-btn" title="Edit markup" onClick={() => setMarkupEditorId(m.id)}>
                <FaPencilAlt />
              </button>
              <button className="markup-card-btn markup-card-del" title="Delete markup" onClick={() => del(m.id)}>
                <FaRegTrashAlt />
              </button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
