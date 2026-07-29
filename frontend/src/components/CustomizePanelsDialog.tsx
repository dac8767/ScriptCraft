import React from 'react';
import { FaRegQuestionCircle } from 'react-icons/fa';
import { UTILITY_ICONS } from './uiIcons';
/**
 * CustomizePanelsDialog — View → Customize Layout.
 *
 * Panels: each tool can live in the Left panel, the Right panel, or be Hidden.
 * (Defaults: script-structure tools left; notes/analytics/goals right.)
 * Hidden tools stay reachable from the Tools menu, opening as a temporary
 * window.
 *
 * Toolbar: a single flat list of items (v0.42) — every built-in control,
 * pinned tool/window, pinned command, and divider is individually placeable
 * with Left / Right / Hide. The old fixed groups and per-item deactivation
 * checkboxes (a ScriptCraft v5.5 holdover) are gone; hidden items are re-added
 * from the Add dropdown. Item registry: toolbarBuiltins.ts.
 */
import { useEditorStore, DEFAULT_TOOL_CONFIG, type ToolId, type ToolConfig, DEFAULT_TOOL_ORDER } from '../stores/editorStore';
import { ALL_TOOLS, WINDOW_IDS, PANEL_EXCLUDED_IDS } from './ToolDock';
import { saveDialog } from './ConfirmDialog';
import { DEFAULT_TOOLBAR_LEFT, stripTall } from './toolbarBuiltins';
import RibbonPalette from './RibbonPalette';
import { buildRibbonPalette } from './ribbonPaletteData';
import EditElementsDialog from './EditElementsDialog';
import SuggestionRulesEditor from './SuggestionRulesEditor';
import MoresContdsDialog from './MoresContdsDialog';
import { ResetSection, type CustomizeTabId } from './customizeResets';
import { showToast } from './Toast';
import ThemesTab from './ThemesTab';
import MarkupsCustomizeTab from './MarkupsCustomizeTab';
import ContextMenuTab from './ContextMenuTab';
import { exportCustomizationsFlow, importCustomizationsFlow } from './PresetsPanel';
import { QAT_OPTIONS, QAT_BY_ID, isQatDivider, isQatSpacer } from './TitleBar';

interface Props {
  /** Initial tab; the dialog always renders its own tab bar. */
  category?: 'toolbar' | 'panels' | 'elements' | 'themes' | 'context' | 'markups';
  open: boolean;
  onClose: () => void;
  /** Render only the content (no overlay/box) — used inside Preferences. */
  embedded?: boolean;
  /** v4.64: render ONE tab's content with no inner tab rail — Settings lists
   *  the customize tabs in its own sidebar now. Implies embedded. */
  soloCategory?: 'toolbar' | 'qat' | 'panels' | 'elements' | 'themes' | 'context' | 'markups';
}

/** Default spacer sizes — match the CSS so an unsized spacer doesn't jump when
 *  the slider is first touched. */
/** Title Case for every user-visible label (v0.84). Small words stay lowercase
 *  unless they lead — standard title case, not naive capitalization. */
const SMALL_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in',
  'of', 'on', 'or', 'the', 'to', 'up', 'via', 'with']);
export function titleCase(s: string): string {
  return s.split(/(\s+|\/)/).map((w, i) => {
    if (/^\s+$/.test(w) || w === '/') return w;
    const lower = w.toLowerCase();
    if (i > 0 && SMALL_WORDS.has(lower)) return lower;
    // Leave words that are already deliberately cased (To-Do, PDF, FDX).
    if (/[A-Z]/.test(w.slice(1))) return w;
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join('');
}

/* v3.39, Derek: every tab's helper text moved OUT of the body and into ONE
   info button (?-in-a-circle) pinned to the tab window's upper-right corner.
   The text lives in TAB_HINTS, keyed by the tab id, so there's a single place
   per tab and a single affordance for all of them. */
function TabInfo({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="fs-tabinfo">
      <button
        type="button"
        className={`fs-tabinfo-btn${open ? ' active' : ''}`}
        title="About this tab"
        aria-label="About this tab"
        onClick={() => setOpen((v) => !v)}
      ><FaRegQuestionCircle /></button>
      {open && <div className="fs-tabinfo-pop" onClick={() => setOpen(false)}>{children}</div>}
    </div>
  );
}
const TAB_HINTS: Record<string, React.ReactNode> = {
  toolbar: <>Your toolbar above is now the editor. While this tab is open the real ribbon is live: drag items from the palette straight onto it, drag a section by its body to move it, hover an item or section for its ×. Use a faint “+ Add” block on the bar to insert a section, divider, spacer, alignment split or any item. Drag an item off the bar to remove it. Close this window to lock the layout.</>,
  qat: <>The buttons beside the traffic lights in the titlebar. Drag between Shown and Hidden — where you drop one is where it sits. Add dividers and spacers to group them.</>,
  panels: <>Drag tools between Left Panel, Right Panel and Hidden — where you drop one is where it sits. The Show/Hide in a list’s header controls the whole panel (drag a panel’s inner edge in the app to resize it). Divider labels are edited here only.</>,
};


const CUSTOMIZE_SIZE_KEY = 'opendraft:customizeSize';

const DEFAULT_PANEL_SPACER = 50;   // v0.86 (the toolbar's lives in tokenMeta.ts)

/**
 * v0.86: was a slider, which couldn't be dragged — the whole ROW is draggable
 * (HTML5 drag-and-drop, for reordering), and that swallows the pointer before
 * the slider ever sees it. A number field has no drag gesture to steal, so it
 * just works. Declared at module scope (a component defined inside another
 * remounts on every render).
 */
function SpacerSize({ value, min, max, onChange }: {
  value: number; min: number; max: number; onChange: (px: number) => void;
}) {
  // v0.95: the minimum was enforced on EVERY keystroke, so typing "10" clamped
  // the "1" to 8 the instant it was typed and you could never get below 80. The
  // field now holds what you type as text and only commits — and clamps — when
  // you're done: Enter, or clicking away. Escape puts it back.
  const [draft, setDraft] = React.useState<string | null>(null);
  const shown = draft ?? String(value);

  const commit = () => {
    if (draft === null) return;
    const n = Number(draft);
    setDraft(null);
    if (!Number.isFinite(n) || draft.trim() === '') return;      // junk: keep the old size
    onChange(Math.max(min, Math.min(max, Math.round(n))));
  };

  return (
    <span
      className="fs-spacer-size"
      // Typing inside a draggable row: stop the row's drag from stealing the
      // caret while the field has focus.
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <label className="fs-spacer-label">Size:</label>
      <input
        type="number"
        className="fs-spacer-input"
        min={min}
        max={max}
        value={shown}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); (e.target as HTMLInputElement).blur(); }
          else if (e.key === 'Escape') { setDraft(null); (e.target as HTMLInputElement).blur(); }
        }}
        title={`Spacer size in pixels (${min}–${max})`}
      />
      <span className="fs-spacer-px">px</span>
    </span>
  );
}


/* ── v1.76: Outlook-ribbon-style columns ─────────────────────────────────
   Each customization surface renders as side-by-side COLUMNS ("Shown" /
   "Hidden", or "Left Panel" / "Right Panel" / "Hidden") and items move by
   drag-and-drop — drop ON a row to take its position, drop on a column's
   empty space to land at the bottom. The Hidden column is organized into
   the same categories the old + Add dropdown used, accepts drops anywhere
   (stashing has no order), and its rows drag back out. Every row also has
   a click fallback (× to hide, + to show) so nothing REQUIRES a drag.

   Module scope on purpose: a component declared inside the dialog would be
   a new type every render and remount mid-drag (the v0.75 slider lesson). */

export interface DndRow {
  key: string;
  content: React.ReactNode;
  /** Can't be dragged or hidden (File). */
  locked?: boolean;
}
export interface DndColumnSpec {
  id: string;
  title: string;
  /** Extra header widget (the panel Show/Hide toggle). */
  headerExtra?: React.ReactNode;
  /** Rows, in sections. Visible columns use ONE unlabeled section; the
   *  Hidden column uses one section per category. */
  sections: Array<{ label?: string; rows: DndRow[] }>;
  /** Hidden semantics: drops stash (position ignored), no reordering. */
  isHidden?: boolean;
}

export function DndColumns({ columns, onDrop }: {
  columns: DndColumnSpec[];
  /** src is key-based (rows move between sectioned lists); dst.idx is the
   *  flat index within the target column (ignored for Hidden). */
  onDrop: (src: { col: string; key: string }, dst: { col: string; idx: number }) => void;
}) {
  const [drag, setDrag] = React.useState<{ col: string; key: string } | null>(null);
  const [over, setOver] = React.useState<string | null>(null);   // column id under the drag

  const rowProps = (col: DndColumnSpec, row: DndRow, flatIdx: number) => ({
    draggable: !row.locked,
    onDragStart: (e: React.DragEvent) => {
      // WebKit refuses to start a drag without data (the app's oldest footgun).
      e.dataTransfer.setData('text/plain', row.key);
      e.dataTransfer.effectAllowed = 'move';
      setDrag({ col: col.id, key: row.key });
    },
    onDragOver: (e: React.DragEvent) => { if (drag) { e.preventDefault(); setOver(col.id); } },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (drag && !(drag.col === col.id && drag.key === row.key)) {
        onDrop(drag, { col: col.id, idx: flatIdx });
      }
      setDrag(null); setOver(null);
    },
    onDragEnd: () => { setDrag(null); setOver(null); },
  });

  return (
    <div className="fs-dnd-cols">
      {columns.map((col) => {
        const flatCount = col.sections.reduce((n, s) => n + s.rows.length, 0);
        let flatIdx = -1;
        return (
          <div
            key={col.id}
            className={`fs-dnd-col${over === col.id && drag ? ' drop-target' : ''}${col.isHidden ? ' fs-dnd-hiddencol' : ''}`}
            onDragOver={(e) => { if (drag) { e.preventDefault(); setOver(col.id); } }}
            onDragLeave={(e) => { if (e.currentTarget === e.target) setOver(null); }}
            onDrop={(e) => {
              e.preventDefault();
              if (drag) onDrop(drag, { col: col.id, idx: flatCount });
              setDrag(null); setOver(null);
            }}
          >
            <div className="fs-dnd-col-head">
              <span>{col.title}</span>
              {col.headerExtra}
            </div>
            <div className="fs-dnd-col-body">
              {col.sections.map((sec, si) => (
                <React.Fragment key={sec.label ?? si}>
                  {sec.label && sec.rows.length > 0 && (
                    <div className="fs-dnd-cat">{sec.label}</div>
                  )}
                  {sec.rows.map((row) => {
                    flatIdx += 1;
                    return (
                      <div
                        key={row.key}
                        className={`fs-dnd-row${drag?.key === row.key && drag.col === col.id ? ' dragging' : ''}${row.locked ? ' locked' : ''}`}
                        {...rowProps(col, row, flatIdx)}
                      >
                        {!row.locked && <span className="fs-customize-drag" title="Drag to move">⋮⋮</span>}
                        {row.content}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
              {flatCount === 0 && <div className="fs-dnd-empty">Drop items here</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function CustomizePanelsDialog({ open, onClose, embedded = false, category, soloCategory }: Props) {
  const {
    toolConfig, setToolConfig,
    toolbarPinnedTools,
    navigatorOpen, toggleNavigator, shelfOpen, toggleShelf,
    toolOrder, setToolOrder,
    toolbarMode, setToolbarMode,
    qatItems, setQatItems,
    uiResizeLocked,
  } = useEditorStore();


  const PANEL_PRODUCTION_IDS: ToolId[] = ['tags'];
  // PANEL_EXCLUDED_IDS (Asset Manager, Spell Check) lives in ToolDock now — one
  // list, so the dock and this dialog agree on what can be a side-panel tool.
  // One combined Panels tab (v0.48): every panel item in one list — the
  // Left / Right buttons on each row already choose the side, so separate
  // Left Panel and Right Panel tabs were redundant.
  const renderPanelsTab = () => {
    const order = toolOrder.length ? toolOrder : [...DEFAULT_TOOL_ORDER];
    const oIdx = (id: string) => {
      const i = order.indexOf(id);
      return i === -1 ? 1000 : i;
    };
    type Row =
      | { kind: 'tool'; id: ToolId; label: string; side: 'left' | 'right' }
      | { kind: 'divider'; id: string; label: string; side: 'left' | 'right'; spacer?: boolean; size?: number };
    const rows: Row[] = [
      ...ALL_TOOLS.filter((t) => cfgOf(t.id).enabled && !PANEL_EXCLUDED_IDS.includes(t.id)).map((t) => ({
        kind: 'tool' as const, id: t.id, label: t.label, side: cfgOf(t.id).side, ord: oIdx(t.id),
      })),
      ...panelDividers.map((d) => ({
        kind: 'divider' as const, id: d.id, label: d.label, side: d.side, spacer: d.spacer, size: d.size, ord: oIdx(`div:${d.id}`),
      })),
    ].sort((a, b) => a.ord - b.ord).map(({ ord: _o, ...r }) => r as Row);

    const orderTokenOf = (r: Row) => r.kind === 'tool' ? r.id : `div:${r.id}`;

    // v0.65: rows are grouped by side — all Left items, a separator, then all
    // Right items. Because the grouping is a STABLE partition of the flat
    // toolOrder, "last in toolOrder" is also "last within its side's group",
    // which is what lets a side switch land at the bottom of the target list.
    const leftRows = rows.filter((r) => r.side === 'left');
    const rightRows = rows.filter((r) => r.side === 'right');

    /** Full token order, materialized (toolOrder may be empty = defaults). */
    const fullOrder = () => {
      const toks = rows.map(orderTokenOf);
      const full = [...order];
      for (const t of toks) if (!full.includes(t)) full.push(t);
      return full;
    };

    const setRowSide = (r: Row, target: 'left' | 'right' | 'hidden') => {
      if (r.kind === 'divider') {
        if (target === 'hidden') {
          setPanelDividers(panelDividers.filter((x) => x.id !== r.id));
          setToolOrder(order.filter((t) => t !== `div:${r.id}`));
        } else {
          const changed = r.side !== target;
          setPanelDividers(panelDividers.map((x) => x.id === r.id ? { ...x, side: target } : x));
          if (changed) sendToBottom(`div:${r.id}`);
        }
        return;
      }
      if (target === 'hidden') { setTool(r.id, { enabled: false }); return; }
      if (cfgOf(r.id).side === target && cfgOf(r.id).enabled) return;   // no-op
      setTool(r.id, { enabled: true, side: target });
      sendToBottom(r.id);
    };

    /** Move a token to the end of the flat order = bottom of its side's group. */
    const sendToBottom = (token: string) => {
      const full = fullOrder().filter((t) => t !== token);
      setToolOrder([...full, token]);
    };
    /** Default side for a tool coming back from hidden. */
    const homeSide = (id: ToolId): 'left' | 'right' =>
      DEFAULT_TOOL_CONFIG[id]?.side ?? (WINDOW_IDS.includes(id) ? 'left' : 'right');
    const addOptions = [
      ...ALL_TOOLS.filter((t) => WINDOW_IDS.includes(t.id) && !PANEL_EXCLUDED_IDS.includes(t.id) && !cfgOf(t.id).enabled).map((t) => ({ group: 'Project Windows', value: `t:${t.id}`, label: t.label })),
      ...ALL_TOOLS.filter((t) => !WINDOW_IDS.includes(t.id) && !PANEL_PRODUCTION_IDS.includes(t.id) && !cfgOf(t.id).enabled).map((t) => ({ group: 'Tools', value: `t:${t.id}`, label: t.label })),
      ...ALL_TOOLS.filter((t) => PANEL_PRODUCTION_IDS.includes(t.id) && !cfgOf(t.id).enabled).map((t) => ({ group: 'Production', value: `t:${t.id}`, label: t.label })),
    ];
    const onAdd = (value: string) => {
      if (value === 'divider' || value === 'spacer') {
        // Spacers share the dividers list — a divider with spacer: true (v0.69).
        const id = String(Date.now());
        setPanelDividers([
          ...panelDividers,
          { id, label: '', side: 'left', ...(value === 'spacer' ? { spacer: true } : {}) },
        ]);
        setToolOrder([...order, `div:${id}`]);
      } else if (value.startsWith('all:')) {
        const group = value.slice(4);
        const next = { ...toolConfig };
        addOptions
          .filter((o) => o.group === group && o.value.startsWith('t:'))
          .forEach((o) => {
            const id = o.value.slice(2) as ToolId;
            next[id] = { ...cfgOf(id), enabled: true, side: homeSide(id) };
          });
        setToolConfig(next);
      } else if (value.startsWith('t:')) {
        const id = value.slice(2) as ToolId;
        setTool(id, { enabled: true, side: homeSide(id) });
      }
    };
    // v4.65: the panels reset lives in customizeResets (the Reset section).
    const removeAll = () => {
      const next = { ...toolConfig };
      ALL_TOOLS.forEach((t) => {
        const c = cfgOf(t.id);
        if (c.enabled) next[t.id] = { ...c, enabled: false };
      });
      setToolConfig(next);
      const divTokens = panelDividers.map((d) => `div:${d.id}`);
      setPanelDividers([]);
      if (divTokens.length) setToolOrder(order.filter((t) => !divTokens.includes(t)));
    };
    return (
      <section>
        <h3>Panel Items</h3>
        {/* v2.29, Derek: the per-side size rows are gone — panel width is
            all manual (drag the panel's inner edge; drag it small enough
            and it snaps into the icon rail). v4.65: the way back moved to
            the Reset section at the bottom (Reset Size covers width AND the
            vertical tool scaling — the old buttons missed the scaling). */}
        {/* v4.24, Derek: panel display names — Title Case or ALL CAPS. */}
        <div className="fs-customize-row fs-size-row">
          <span className="fs-customize-tool">Panel Name Style</span>
          <span className="fs-customize-seg">
            <button
              className={panelNameCase === 'title' ? 'active' : ''}
              onClick={() => useEditorStore.getState().setPanelNameCase('title')}
            >Title Case</button>
            <button
              className={panelNameCase === 'upper' ? 'active' : ''}
              onClick={() => useEditorStore.getState().setPanelNameCase('upper')}
            >ALL CAPS</button>
          </span>
        </div>
        {/* v1.76: Outlook-style — Left Panel, Right Panel, Hidden. Drag
            between the three; the column a tool lands in is its side, and
            drop position is its position. Dividers and spacers dropped on
            Hidden are deleted (they're structure, not tools). */}
        {(() => {
          const rowContent = (r: Row) => (
            <span className="fs-customize-tool">
              {iconSlot(r.kind === 'tool'
                ? (ALL_TOOLS.find((t) => t.id === r.id)?.icon ?? null)
                : UTILITY_ICONS[r.spacer ? 'spacer' : 'divider'])}
              {r.kind === 'divider' && r.spacer ? (
                <>
                  <span className="fs-spacer-row-label">— Spacer —</span>
                  <SpacerSize
                    value={r.size ?? DEFAULT_PANEL_SPACER}
                    min={8}
                    max={240}
                    onChange={(px) => setPanelDividers(
                      panelDividers.map((x) => (x.id === r.id ? { ...x, size: px } : x)),
                    )}
                  />
                </>
              ) : r.kind === 'divider' ? (
                <input
                  className="fs-divider-label-input"
                  value={r.label}
                  placeholder="Divider label (optional)"
                  onChange={(e) => setPanelDividers(panelDividers.map((x) => x.id === r.id ? { ...x, label: e.target.value } : x))}
                />
              ) : r.label}
              <button
                className="fs-dnd-rowbtn"
                title={r.kind === 'divider' ? 'Delete' : 'Hide (find it again under Hidden)'}
                onClick={() => setRowSide(r, 'hidden')}
              >×</button>
            </span>
          );
          const panelHeaderExtra = (side: 'left' | 'right') => {
            const [panelOpen, panelToggle] = side === 'left'
              ? [navigatorOpen, toggleNavigator] as const
              : [shelfOpen, toggleShelf] as const;
            return (
              <span className="fs-customize-seg">
                <button className={panelOpen ? 'active' : ''} onClick={() => { if (!panelOpen) panelToggle(); }}>Show</button>
                <button className={!panelOpen ? 'active' : ''} onClick={() => { if (panelOpen) panelToggle(); }}>Hide</button>
              </span>
            );
          };
          const hiddenRow = (id: ToolId, label: string) => ({
            key: id,
            content: (
              <span className="fs-customize-tool">
                {iconSlot(ALL_TOOLS.find((t) => t.id === id)?.icon ?? null)}
                {label}
                <button
                  className="fs-dnd-rowbtn"
                  title="Show in its default panel"
                  onClick={() => { setTool(id, { enabled: true, side: homeSide(id) }); sendToBottom(id); }}
                >+</button>
              </span>
            ),
          });
          const hiddenGroups = (['Project Windows', 'Tools', 'Production'] as const).map((group) => ({
            label: group,
            rows: addOptions.filter((o) => o.group === group)
              .map((o) => hiddenRow(o.value.slice(2) as ToolId, o.label)),
          }));
          return (
            <DndColumns
              columns={[
                {
                  id: 'left', title: 'Left Panel', headerExtra: panelHeaderExtra('left'),
                  sections: [{ rows: leftRows.map((r) => ({ key: orderTokenOf(r), content: rowContent(r) })) }],
                },
                {
                  id: 'right', title: 'Right Panel', headerExtra: panelHeaderExtra('right'),
                  sections: [{ rows: rightRows.map((r) => ({ key: orderTokenOf(r), content: rowContent(r) })) }],
                },
                {
                  id: 'hidden', title: 'Hidden', isHidden: true,
                  headerExtra: (
                    <button className="fs-dnd-headbtn" title="Hide everything in both panels" onClick={removeAll}>Hide All</button>
                  ),
                  sections: hiddenGroups,
                },
              ]}
              onDrop={(src, dst) => {
                const tok = src.key;   // tool id, or 'div:<id>'
                const isDiv = tok.startsWith('div:');
                if (dst.col === 'hidden') {
                  if (isDiv) {
                    setPanelDividers(panelDividers.filter((x) => `div:${x.id}` !== tok));
                    setToolOrder(order.filter((t) => t !== tok));
                  } else {
                    setTool(tok as ToolId, { enabled: false });
                  }
                  return;
                }
                const side = dst.col as 'left' | 'right';
                const left = leftRows.map(orderTokenOf).filter((t) => t !== tok);
                const right = rightRows.map(orderTokenOf).filter((t) => t !== tok);
                const target = side === 'left' ? left : right;
                target.splice(Math.min(dst.idx, target.length), 0, tok);
                setToolOrder([...left, ...right]);
                if (isDiv) {
                  setPanelDividers(panelDividers.map((d) => (`div:${d.id}` === tok ? { ...d, side } : d)));
                } else {
                  setTool(tok as ToolId, { enabled: true, side });
                }
              }}
            />
          );
        })()}
        <div className="fs-tbzone-adders fs-adders-equal">
          <button
            className="swn-add-btn"
            title="Add a divider line to the left panel"
            onClick={() => onAdd('divider')}
          >+ Divider</button>
          <button
            className="swn-add-btn"
            title="Add a spacer to the left panel"
            onClick={() => onAdd('spacer')}
          >+ Spacer</button>
          {/* v4.66: Hide All moved into the Hidden column header. */}
        </div>
      </section>
    );
  };

  // ALL hooks must run before this early return — a hook below it crashes
  // React ('Rendered more hooks than during the previous render').
  const { toolbarLeft: tbLeftRaw, toolbarRight: tbRightRaw, setToolbarZones, toolbarZonesSet } = useEditorStore();
  const { panelDividers, setPanelDividers, panelNameCase } = useEditorStore();
  // v4.22, Derek: default landing is the Editor tab (top of the list).
  // v4.28, Derek: the Menu Bar tab is GONE — the menus always live in the
  // macOS menu bar now; there is nothing to place or reorder in-window.
  const [activeCatState, setActiveCat] = React.useState<'toolbar' | 'qat' | 'panels' | 'elements' | 'themes' | 'context' | 'markups'>(category ?? 'elements');
  // v4.64, Derek: Settings lists the customize tabs directly in ITS sidebar
  // (no inner tab rail) — soloCategory pins this instance to one tab.
  const activeCat = soloCategory ?? activeCatState;

  // v0.84: the window forgot any size you gave it and snapped back to the
  // default on reopen. CSS `resize` writes inline width/height on the element,
  // so a ResizeObserver captures the size the user drags to; we persist it and
  // restore it on open. (Modal only — a docked panel is sized by its dock, and a
  // stored width would fight it.)
  const dialogRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (embedded || !open) return;
    const el = dialogRef.current;
    if (!el) return;

    try {
      const saved = JSON.parse(localStorage.getItem(CUSTOMIZE_SIZE_KEY) || 'null');
      if (saved && saved.w > 0 && saved.h > 0) {
        // Never restore a size bigger than the current screen — a window sized
        // on a large monitor would otherwise open off-screen on a laptop.
        el.style.width = `${Math.min(saved.w, window.innerWidth - 40)}px`;
        el.style.height = `${Math.min(saved.h, window.innerHeight - 40)}px`;
      }
    } catch { /* corrupt entry — keep the default */ }

    let t: number | undefined;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(t);
      t = window.setTimeout(() => {          // a drag fires this continuously
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          try {
            localStorage.setItem(CUSTOMIZE_SIZE_KEY,
              JSON.stringify({ w: Math.round(r.width), h: Math.round(r.height) }));
          } catch { /* quota */ }
        }
      }, 250);
    });
    ro.observe(el);
    return () => { window.clearTimeout(t); ro.disconnect(); };
  }, [open, embedded]);

  // `category` seeds useState only on first mount, but this dialog stays mounted
  // and merely toggles `open` — so without this, opening it from "Customize
  // Themes" would land on whatever tab was used last.
  React.useEffect(() => {
    if (open && category) setActiveCat(category);
  }, [open, category]);
  // v3.36, Derek: while the Toolbar tab is open, the REAL ribbon bar becomes
  // the editor (drop surface + handles). Closing the window, or leaving the
  // tab, locks the layout. The store flag drives Toolbar's edit rendering.
  // v4.4, Derek: NOT while locked — "Lock All" must freeze layout edits too
  // (the dialog veils its tabs, but the ribbon bar itself was still editable:
  // you could add sections and drag items). The lock veil tells you to unlock.
  // (Declared here — the window-position effect below reads it.)
  const editingToolbar = open && activeCat === 'toolbar' && !uiResizeLocked;

  // v3.29, Derek: the window OPENS below the toolbar ribbon so the whole bar
  // stays visible while editing (it's still draggable anywhere after).
  // Measured per open — the top chrome's height depends on his scaling.
  const [overlayPadTop, setOverlayPadTop] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (!open) { setOverlayPadTop(null); return; }
    // v4.22, Derek: re-measure after the ribbon's height settles — switching to
    // the Toolbar tab expands the bar into edit mode (taller), and the old
    // measurement (taken once on open, before that expansion) left the window
    // riding up over the bar. Measure in rAF so the new layout is painted, and
    // leave extra room in edit mode where the per-section + buttons hang below
    // the bar.
    let raf = 0;
    const measure = () => {
      const bar = document.querySelector('.toolbar-stack');
      const b = bar?.getBoundingClientRect().bottom ?? 0;
      setOverlayPadTop(b > 0 ? Math.round(b) + (editingToolbar ? 24 : 14) : null);
    };
    raf = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', measure); };
  }, [open, editingToolbar, tbLeftRaw]);
  React.useEffect(() => {
    useEditorStore.getState().setToolbarEditing(editingToolbar);
    return () => { useEditorStore.getState().setToolbarEditing(false); };
  }, [editingToolbar]);
  // v3.36, Derek: SPOTLIGHT the ribbon while editing — dim + block everything
  // in the app except the bar and this window. Two fixed strips (above and
  // below the bar) do it; the bar is full-width so nothing sits beside it.
  // Re-measured when the bar changes size (edits change tbLeftRaw).
  const [barRect, setBarRect] = React.useState<{ top: number; bottom: number } | null>(null);
  React.useEffect(() => {
    if (!editingToolbar) { setBarRect(null); return; }
    const measure = () => {
      const bar = document.querySelector('.toolbar-stack');
      if (!bar) { setBarRect(null); return; }
      const r = bar.getBoundingClientRect();
      setBarRect({ top: Math.round(r.top), bottom: Math.round(r.bottom) });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [editingToolbar, tbLeftRaw]);
  // v1.76: the old per-list drag plumbing (dragProps/zoneDragProps, v0.45 and
  // v0.95) is gone — DndColumns owns drag state for every customization list.

  // v3.49, Derek: Customize edits apply LIVE (the ribbon is edited on the real
  // bar), so "Cancel" means revert to how everything looked when the window
  // opened. Snapshot every persistent customization the moment it opens; Save
  // just closes, Cancel restores the snapshot, and closing via the X with
  // changes outstanding asks first. Snapshot is stored as JSON so the dirty
  // check is a plain string compare.
  const openSnapRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (open) openSnapRef.current = JSON.stringify(useEditorStore.getState().captureCustomizations());
    else openSnapRef.current = null;
  }, [open]);
  const isDirty = () => {
    const snap = openSnapRef.current;
    if (snap === null) return false;
    return JSON.stringify(useEditorStore.getState().captureCustomizations()) !== snap;
  };
  const revertCustomizations = () => {
    const snap = openSnapRef.current;
    if (snap) useEditorStore.getState().restoreCustomizations(JSON.parse(snap));
  };
  // v3.79, Derek: clicking the dialog's Save also commits a theme that's being
  // edited in the Themes tab (its own "Save Theme" button is easy to miss). The
  // ThemesTab listens for this and saves whatever it has open.
  const handleSave = () => { window.dispatchEvent(new CustomEvent('scriptcraft:customize-save')); onClose(); };
  const handleCancel = () => { revertCustomizations(); onClose(); };
  const requestClose = async () => {
    if (!isDirty()) { onClose(); return; }
    const choice = await saveDialog(
      'You have unsaved changes to your customizations. Save them before closing?',
      { title: 'Save changes?', confirmLabel: 'Save', tertiaryLabel: "Don’t Save", cancelLabel: 'Cancel' },
    );
    if (choice === 'cancel') return;      // stay open, keep editing
    if (choice === 'discard') revertCustomizations();
    onClose();
  };

  if (!open) return null;

  const cfgOf = (id: ToolId): ToolConfig =>
    toolConfig[id] ?? DEFAULT_TOOL_CONFIG[id] ?? { side: 'right', enabled: true };

  const setTool = (id: ToolId, patch: Partial<ToolConfig>) =>
    setToolConfig({ ...toolConfig, [id]: { ...cfgOf(id), ...patch } });

  const tbReady = toolbarZonesSet;
  // v2.95: the ribbon is ONE sequence (tbLeft); the right zone is retired but
  // anything a stale profile still stores there is treated as placed.
  const tbLeft = tbReady ? tbLeftRaw : [...DEFAULT_TOOLBAR_LEFT, ...toolbarPinnedTools.map((id) => `t:${id}`)];
  const tbRight = tbReady ? tbRightRaw : [];

  // ── Add-item categories: Toolbar / Edit / Insert / View / Tools / Project,
  //    mirroring the menu-bar taxonomy. v3.38, Derek: the whole list now lives
  //    in ribbonPaletteData.buildRibbonPalette — ONE source shared with the
  //    on-bar "+ Add" picker, so the dialog palette and the bar can't drift.
  //    (Ribbon tokens may carry the 2! span flag — compare flag-blind.)
  const tbPlaced = (v: string) => [...tbLeft, ...tbRight].some((t) => stripTall(t) === v);
  const tbAddCategories = buildRibbonPalette(tbPlaced);

  // v2.96: tokenIcon/tokenLabel/spacerPx moved to tokenMeta.ts — the ribbon
  // editor is a second consumer, and two copies is how lists drift.

  /** Icon slot: fixed width whether or not there's an icon, so labels align. */
  const iconSlot = (node: React.ReactNode) => (
    <span className="fs-customize-icon">{node}</span>
  );

  // v0.76: embedded (docked / Settings) previously forced overflowY: 'visible',
  // so a list longer than the window just ran off with no scrollbar. It now
  // scrolls like the modal does, and keeps side padding so the drag handles
  // aren't clipped.
  // v3.52, Derek: Lock All / Reset All — ONE definition, placed in the modal's
  // footer (left of Cancel/Save) for the window, and kept in the tab rail for
  // the embedded (Settings) view, which has no footer.
  // v4.65, Derek: Reset All MOVED to Settings ▸ Defaults (customizeResets'
  // ResetAllButton) — only the lock lives here now.
  const globalsButtons = (<>
    <button
      className={uiResizeLocked ? 'active' : ''}
      title={uiResizeLocked
        ? 'Customizations are locked — click to unlock'
        : 'Freeze every customization: sizing, spacing, and layout edits'}
      onClick={() => useEditorStore.getState().setUiResizeLocked(!uiResizeLocked)}
    >{uiResizeLocked ? 'Locked' : 'Lock All'}</button>
    {/* v4.79, Derek: carry these choices between installs or scripts. Both
        run the shared preset flows (PresetsPanel), so the Customize footer,
        the Presets window and Settings ▸ Presets can never drift. Import
        confirms first — it overrides everything here. */}
    <button
      title="Save every customization choice to a file"
      onClick={() => { void exportCustomizationsFlow(); }}
    >Export…</button>
    <button
      title="Load customization choices from a file — this replaces your current ones"
      onClick={() => { void importCustomizationsFlow(); }}
    >Import…</button>
  </>);

  const body = (
      // v0.83: tabs live in a LEFT SIDEBAR, the same shape as Settings
      // (.prefs-layout + .prefs-tabs). Across the top, seven tabs couldn't fit
      // the default width and forced a horizontal scrollbar; down the side they
      // simply stack, and adding an eighth costs no width at all.
      // v4.64, Derek: with soloCategory the rail is GONE — Settings' own
      // sidebar picks the tab, so this renders just the one tab's content
      // (globals row at the end instead of in the rail).
      <div className={soloCategory ? 'fs-customize-solo' : 'prefs-layout fs-customize-layout'}>
        {!soloCategory && (
        <div className="prefs-tabs fs-customize-tabs">
          {([['elements', 'Editor'], ['toolbar', 'Toolbar'], ['panels', 'Side Panels'], ['qat', 'Quick Access'], ['context', 'Context Menu'], ['markups', 'Annotations'], ['themes', 'Themes']] as const)
            .map(([id, label]) => (
            <button
              key={id}
              className={`prefs-tab${activeCat === id ? ' active' : ''}`}
              onClick={() => setActiveCat(id)}
            >{label}</button>
          ))}
          {/* v3.24, Derek's menu reorg #5: the global controls. v3.52: in the
              Customize WINDOW they moved to the footer (beside Cancel/Save);
              here they show only in the embedded (Settings) view, which has no
              footer. */}
          {embedded && (
            <div className="fs-customize-globals fs-customize-globals-row">{globalsButtons}</div>
          )}
        </div>
        )}
        {/* v4.64, Derek: the lock must hold BELOW the fold too — the veil is
            absolute in a scrolling body, so content past the first viewport
            (e.g. the Element Suggestions table) scrolled out from under it.
            The locked class kills pointer events on everything but the veil. */}
        <div className={`dialog-body fs-customize-body${uiResizeLocked ? ' fs-customize-locked' : ''}`}>
          {/* v3.39, Derek: the tab's helper text, one ?-in-a-circle pinned to
              the upper-right corner. Keyed by tab so it re-closes on switch. */}
          {TAB_HINTS[activeCat] && <TabInfo key={activeCat}>{TAB_HINTS[activeCat]}</TabInfo>}
          {/* v3.34, Derek: the lock covers ALL customizations — while it's
              on, every tab's editors are veiled (the rail's unlock button
              stays reachable). */}
          {uiResizeLocked && (
            <div className="fs-customize-lockveil">
              Customizations are locked — click “Customizations Locked” to unlock.
            </div>
          )}
          {activeCat === 'toolbar' && (<>
          <section>
            <h3>Toolbar Layout</h3>
            {/* v3.39: the helper text moved to the tab info icon (TAB_HINTS). */}
            {/* v3.36: the SOURCE side only — the real bar is the drop
                surface (see RibbonPalette / ribbonDrag). */}
            <RibbonPalette
              palette={tbAddCategories}
              headerControls={<>
                <span className="fs-customize-seg">
                  <button
                    className={toolbarMode !== 'hidden' ? 'active' : ''}
                    onClick={() => { if (toolbarMode === 'hidden') setToolbarMode('custom'); }}
                  >Show</button>
                  <button
                    className={toolbarMode === 'hidden' ? 'active' : ''}
                    onClick={() => setToolbarMode('hidden')}
                  >Hide</button>
                </span>
              </>}
            />
            {/* v4.65: the size + layout resets moved to the Reset section. */}
            <div className="fs-tbzone-adders fs-adders-equal">
              <button
                className="swn-add-btn"
                title="Hide every toolbar item (re-add items from the palette)"
                onClick={() => setToolbarZones([], [])}
              >Hide All</button>
            </div>
          </section>
          </>)}
          {activeCat === 'qat' && (<>
          <section>
            <h3>Quick Access Toolbar</h3>
            <DndColumns
              columns={[
                {
                  id: 'shown', title: 'Shown',
                  headerExtra: (
                    <button
                      className="fs-dnd-headbtn"
                      title="Show every Quick Access button"
                      onClick={() => setQatItems([...qatItems, ...QAT_OPTIONS.map((o) => o.id).filter((id) => !qatItems.includes(id))])}
                    >Show All</button>
                  ),
                  sections: [{
                    // v3.39: divider/spacer ids ride here too — they carry no
                    // QAT_BY_ID entry, so render them as their own chips.
                    rows: qatItems.filter((id) => QAT_BY_ID[id] || isQatDivider(id) || isQatSpacer(id)).map((id) => ({
                      key: id,
                      content: (
                        <span className="fs-customize-tool">
                          {isQatDivider(id) ? <>{iconSlot(UTILITY_ICONS.divider)}<em>Divider</em></>
                            : isQatSpacer(id) ? <>{iconSlot(UTILITY_ICONS.spacer)}<em>Spacer</em></>
                            : <>{iconSlot(QAT_BY_ID[id].icon)}{QAT_BY_ID[id].label}</>}
                          <button
                            className="fs-dnd-rowbtn"
                            title="Remove from the Quick Access Toolbar"
                            onClick={() => setQatItems(qatItems.filter((x) => x !== id))}
                          >×</button>
                        </span>
                      ),
                    })),
                  }],
                },
                {
                  id: 'hidden', title: 'Hidden', isHidden: true,
                  headerExtra: (
                    <button className="fs-dnd-headbtn" title="Hide every Quick Access button" onClick={() => setQatItems([])}>Hide All</button>
                  ),
                  sections: [{
                    label: 'Available',
                    rows: QAT_OPTIONS.filter((o) => !qatItems.includes(o.id)).map((o) => ({
                      key: o.id,
                      content: (
                        <span className="fs-customize-tool">
                          {iconSlot(o.icon)}
                          {o.label}
                          <button
                            className="fs-dnd-rowbtn"
                            title="Add to the Quick Access Toolbar"
                            onClick={() => setQatItems([...qatItems, o.id])}
                          >+</button>
                        </span>
                      ),
                    })),
                  }],
                },
              ]}
              onDrop={(src, dst) => {
                const id = src.key;
                if (dst.col === 'hidden') {
                  setQatItems(qatItems.filter((x) => x !== id));
                  return;
                }
                const next = qatItems.filter((x) => x !== id);
                next.splice(Math.min(dst.idx, next.length), 0, id);
                setQatItems(next);
              }}
            />
            <div className="fs-tbzone-adders fs-adders-equal">
              <button
                className="swn-add-btn"
                title="Add a divider (a thin line) to the end — drag it into place"
                onClick={() => setQatItems([...qatItems, `qdiv:${Date.now().toString(36)}`])}
              >Add Divider</button>
              <button
                className="swn-add-btn"
                title="Add a spacer (blank gap) to the end — drag it into place"
                onClick={() => setQatItems([...qatItems, `qsp:${Date.now().toString(36)}`])}
              >Add Spacer</button>
              {/* v4.65: Reset moved to the Reset section at the bottom. */}
            </div>
          </section>
          </>)}
          {activeCat === 'elements' && (<>
            {/* v4.63, Derek: Mores & Continueds leads the Editor tab. */}
            <section>
              <h3>Mores &amp; Continueds</h3>
              <MoresContdsDialog embedded onClose={() => showToast('Mores & Continueds applied', 'success')} />
            </section>
            <EditElementsDialog embedded />
            {/* v4.59, Derek: what the Enter-key suggestion list may offer,
                keyed on the element above — his follows-what table is the
                default, edited here; All Elements switches the filter off. */}
            <section>
              <h3>Element Suggestions</h3>
              <SuggestionRulesEditor />
            </section>
          </>)}
          {activeCat === 'themes' && <ThemesTab />}
          {activeCat === 'markups' && <MarkupsCustomizeTab />}
          {activeCat === 'context' && <ContextMenuTab />}
          {activeCat === 'panels' && renderPanelsTab()}
          {/* v4.65, Derek: every tab ends in its Reset section (one registry —
              customizeResets — also compiled by Settings ▸ Defaults). */}
          <ResetSection tab={activeCat as CustomizeTabId} />
          {/* Solo mode has no rail to host the global controls — they close
              the tab's content instead. */}
          {soloCategory && (
            <div className="fs-customize-globals fs-customize-globals-row fs-customize-globals-solo">{globalsButtons}</div>
          )}
        </div>
      </div>
  );

  if (embedded) return body;

  /** v2.09: drag the window by its header, like every other window. The
   *  box switches to fixed and is positioned by measured TOP/LEFT only
   *  (never bottom — the WebKit collapse footgun). Closing unmounts the
   *  box, so it reopens centered. */
  const startHeaderDrag = (e: React.PointerEvent) => {
    const el = dialogRef.current;
    if (!el || (e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    const r = el.getBoundingClientRect();
    const grabX = e.clientX - r.left;
    const grabY = e.clientY - r.top;
    const onMove = (ev: PointerEvent) => {
      // Keep the header reachable: some of it must stay on screen.
      const left = Math.min(Math.max(80 - r.width, ev.clientX - grabX), window.innerWidth - 80);
      const top = Math.min(Math.max(0, ev.clientY - grabY), window.innerHeight - 40);
      el.style.position = 'fixed';
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      el.style.margin = '0';
    };
    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };

  return (
    <>
    {/* v3.36, Derek: the SPOTLIGHT — two dim strips above and below the bar
        block + obscure the rest of the app, so only the ribbon and this
        window read as usable. The bar between them stays bright and
        droppable; the window (z above these) stays bright too. */}
    {editingToolbar && barRect && (<>
      <div className="fs-tbedit-scrim" style={{ top: 0, height: Math.max(0, barRect.top) }} />
      <div className="fs-tbedit-scrim" style={{ top: barRect.bottom, bottom: 0 }} />
    </>)}
    {/* v3.36, Derek: while editing the toolbar, the overlay lets pointer
       events THROUGH to the real bar above (so drags can drop on it) and
       drops its dimming — the dialog box re-enables its own events. */}
    <div
      className={`dialog-overlay${editingToolbar ? ' dialog-overlay-tbedit' : ''}`}
      style={overlayPadTop !== null ? { paddingTop: overlayPadTop } : undefined}
      onClick={editingToolbar ? undefined : requestClose}
    >
      {/* ref: also what the v0.84 size-persist ResizeObserver watches — it
          had come detached from the element entirely (dead code until now). */}
      <div ref={dialogRef} className="dialog-box fs-customize-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header fs-customize-draghandle" onPointerDown={startHeaderDrag}>
          Customize
          <button className="fs-dialog-x" onClick={requestClose} title="Close">&times;</button>
        </div>
        {body}
        {/* v3.49, Derek: Cancel reverts every customization to the open-time
            snapshot; Save just closes (edits already applied live). v3.52:
            Lock All / Reset All sit on this same row, left; Cancel/Save right. */}
        <div className="dialog-footer fs-customize-footer">
          <div className="fs-customize-globals fs-customize-footer-globals">{globalsButtons}</div>
          <div className="fs-customize-footer-actions">
            <button className="fs-customize-cancel" onClick={handleCancel}>Cancel</button>
            <button className="fs-customize-save" onClick={handleSave}>Save</button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
