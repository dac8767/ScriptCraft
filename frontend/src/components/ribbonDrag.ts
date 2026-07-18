/**
 * ribbonDrag (v3.36, Derek) — the ribbon is edited IN PLACE on the real bar.
 *
 * The Customize > Toolbar tab shows only the palette + utilities; dragging
 * from there (or from an item already on the bar) drops onto the REAL
 * `.toolbar-ribbon`, and closing the window locks the layout. This module
 * is the shared brain: pure token-model mutations plus one pointer-drag
 * controller. Both the palette (in the dialog) and the bar's own items call
 * `startRibbonDrag`; the Toolbar renders the drop indicators from the store's
 * `ribEdit` state.
 *
 * The mutation set is a straight port of the old in-dialog RibbonEditor — the
 * token sequence in `toolbarLeft` stays the single source of truth the real
 * Toolbar renders from. Only the DOM the drop-spot math reads changed:
 * `.ribed-*` (the retired mini-strip) → `.toolbar-ribbon .rib-*` (the bar).
 */
import { parseRibbon, serializeRibbon, type RibbonModel, type RibbonSection } from './toolbarBuiltins';
import { tokenLabel } from './tokenMeta';
import { useEditorStore, type RibDropSpot } from '../stores/editorStore';

type Row = 'top' | 'bottom';

const EMPTY_SECTION: RibbonSection = { top: [], bottom: [], hasBreak: false, breakLine: false };

// The section a double-click quick-add lands in: the one most recently created
// or added to (where the user is actively building), rather than always the
// last section — which, past the align split, is right-aligned. Updated by the
// section-create, item-drop and title-edit mutations; clamped on read.
let lastTouchedSection: number | null = null;

const clone = (m: RibbonModel): RibbonModel => ({
  sections: m.sections.map((s) => ({ top: [...s.top], bottom: [...s.bottom], hasBreak: s.hasBreak, breakLine: s.breakLine, title: s.title })),
  splitAt: m.splitAt,
});

const getModel = (): RibbonModel => parseRibbon(useEditorStore.getState().toolbarLeft);
const commit = (m: RibbonModel) => {
  const st = useEditorStore.getState();
  st.setToolbarZones(serializeRibbon(m), st.toolbarRight);
};
const removeEverywhere = (m: RibbonModel, tok: string) => {
  for (const s of m.sections) {
    s.top = s.top.filter((t) => t !== tok);
    s.bottom = s.bottom.filter((t) => t !== tok);
  }
};

/* ── pure mutations (ported from RibbonEditor) ── */

export const ribApplyDrop = (payload: string, at: RibDropSpot | null) => {
  if (!payload || !at) return;
  const m = clone(getModel());
  const target = m.sections[at.sec];
  if (!target) return;
  const rowArr = at.row === 'top' ? target.top : target.bottom;
  let idx = Math.min(at.idx, rowArr.length);
  if (payload.startsWith('tok:')) {
    const tok = payload.slice(4);
    const before = rowArr.indexOf(tok);
    if (before >= 0 && before < idx) idx -= 1;
    removeEverywhere(m, tok);
    const arr = at.row === 'top' ? target.top : target.bottom;
    arr.splice(Math.min(idx, arr.length), 0, tok);
  } else if (payload === 'util:spacer') {
    rowArr.splice(idx, 0, `s:${Date.now()}`);
  } else if (payload === 'util:divider') {
    rowArr.splice(idx, 0, `d:${Date.now()}`);
  } else if (payload.startsWith('new:')) {
    rowArr.splice(idx, 0, payload.slice(4));
  }
  lastTouchedSection = at.sec;   // the section just edited is the quick-add target
  commit(m);
};

export const ribInsertSection = (type: 'single' | 'double', at: number) => {
  const m = clone(getModel());
  m.sections.splice(at, 0, { top: [], bottom: [], hasBreak: type === 'double', breakLine: false });
  if (m.splitAt !== null && at <= m.splitAt) m.splitAt += 1;
  lastTouchedSection = at;   // a just-made section becomes the quick-add target
  commit(m);
};

/** Double-clicking a block appends a section at the end. */
export const ribAppendSection = (type: 'single' | 'double') => {
  ribInsertSection(type, getModel().sections.length);
};

/** v3.37, Derek: the on-bar "+ Add" adds a section at a boundary. `rightSide`
 *  picks whether the new section lands LEFT of the split (end of the
 *  left-aligned run) or RIGHT of it (start of the right-aligned run) — the
 *  split index shifts for a left insert but stays for a right one. */
export const ribAddSectionAtBoundary = (type: 'single' | 'double', at: number, rightSide: boolean) => {
  const m = clone(getModel());
  m.sections.splice(at, 0, { top: [], bottom: [], hasBreak: type === 'double', breakLine: false });
  if (m.splitAt !== null && (rightSide ? at < m.splitAt : at <= m.splitAt)) m.splitAt += 1;
  lastTouchedSection = at;   // a just-made section becomes the quick-add target
  commit(m);
};

/** v3.38, Derek: the on-bar "+ Add" drops an item, divider or spacer at a
 *  run boundary. `at` is the section index the boundary sits before; the
 *  nearest existing section takes the token — the LAST left-aligned section
 *  (`at-1`) on the left of the split, the FIRST right-aligned section (`at`)
 *  on the right. A builtin/command/tool is deduped first (single instance);
 *  dividers/spacers carry a unique id so they never dedupe. Everything added
 *  this way stays draggable on the bar to reposition. */
export const ribAddInlineAtBoundary = (tok: string, at: number, rightSide: boolean) => {
  const m = clone(getModel());
  if (m.sections.length === 0) m.sections.push({ ...EMPTY_SECTION });
  removeEverywhere(m, tok);
  let secIdx = rightSide ? at : at - 1;
  secIdx = Math.max(0, Math.min(secIdx, m.sections.length - 1));
  const s = m.sections[secIdx];
  const row = s.hasBreak ? s.bottom : s.top;
  if (rightSide) row.unshift(tok); else row.push(tok);
  commit(m);
};

export const ribSetAlignSplit = (at: number) => {
  const m = clone(getModel());
  // Clamp ≥1: serializeRibbon only writes boundary tokens after a section.
  m.splitAt = Math.max(1, Math.min(at, m.sections.length));
  if (m.splitAt === m.sections.length) m.sections.push({ ...EMPTY_SECTION });
  commit(m);
};

export const ribMoveSection = (from: number, to: number) => {
  if (to === from || to === from + 1) return;
  const m = clone(getModel());
  const [s] = m.sections.splice(from, 1);
  const dest = to > from ? to - 1 : to;
  m.sections.splice(dest, 0, s);
  commit(m);
};

/** Close (remove) section `i` cleanly: the section AND its own boundary divider
 *  go, the neighbours stay SEPARATE sections (their divider intact — no merged
 *  "extra long" section), and the align split / the far side are untouched.
 *  A section that is the only one on its side (or the only section, period) is
 *  cleared to empty instead of deleted, so the split and the at-least-one
 *  -section invariant survive. Exported pure (no store) for testing. */
export const closeSectionInModel = (m: RibbonModel, i: number): RibbonModel => {
  const n = m.sections.length;
  if (i < 0 || i >= n) return m;
  const split = m.splitAt;
  const onLeft = split !== null && i < split;
  const onRight = split !== null && i >= split;
  const leftCount = split ?? n;
  const rightCount = split === null ? 0 : n - split;
  // Deleting would leave a side (or the whole bar) with no section — clear it
  // to empty instead, which keeps the split representable and the far side put.
  if (n <= 1 || (onLeft && leftCount <= 1) || (onRight && rightCount <= 1)) {
    m.sections[i] = { top: [], bottom: [], hasBreak: false, breakLine: false };
    return m;
  }
  m.sections.splice(i, 1);
  // Only a LEFT-side removal shifts the boundary; removing on the right leaves
  // splitAt where it is, so the right run stays right-aligned.
  if (m.splitAt !== null && i < m.splitAt) m.splitAt -= 1;
  return m;
};

export const ribCloseSection = (i: number) => {
  commit(closeSectionInModel(clone(getModel()), i));
};

export const ribRemoveToken = (tok: string) => {
  const m = clone(getModel());
  removeEverywhere(m, tok);
  commit(m);
};

export const ribRemoveSplit = () => {
  const m = clone(getModel());
  m.splitAt = null;
  commit(m);
};

export const ribRemoveBreak = (i: number) => {
  const m = clone(getModel());
  const s = m.sections[i];
  if (!s) return;
  m.sections[i] = { top: [...s.top, ...s.bottom], bottom: [], hasBreak: false, breakLine: false };
  commit(m);
};

/* ── v3.42, Derek: a section TITLE — a label on top of a section's rows.
   v3.50: every section carries an always-present title field in the editor,
   so there's no "add a title" step and no dragging one between sections. ── */

/** Set a section's title text. */
export const ribSetSectionTitle = (i: number, text: string) => {
  const m = clone(getModel());
  const s = m.sections[i];
  if (!s) return;
  m.sections[i] = { ...s, title: text };
  lastTouchedSection = i;   // titling a section counts as "working in" it
  commit(m);
};

/** Remove a section's title entirely (an empty title field clears it). */
export const ribRemoveSectionTitle = (i: number) => {
  const m = clone(getModel());
  const s = m.sections[i];
  if (!s) return;
  const { title: _drop, ...rest } = s;
  m.sections[i] = rest;
  commit(m);
};

export const ribToggleBreakLine = (i: number) => {
  const m = clone(getModel());
  const s = m.sections[i];
  if (!s) return;
  m.sections[i] = { ...s, breakLine: !s.breakLine };
  commit(m);
};

/** Double-click a palette item → append to the last section (RIGHT of the
 *  split fills right-to-left, so items go to the front there). */
export const ribQuickAdd = (tok: string) => {
  const m = clone(getModel());
  if (m.sections.length === 0) m.sections.push({ ...EMPTY_SECTION });
  // Land in the most recently created/updated section, not always the last one
  // (which is right-aligned past the split). Fall back to the last section if
  // nothing has been touched yet, and clamp a stale index back into range.
  let sec = lastTouchedSection ?? m.sections.length - 1;
  if (sec < 0 || sec >= m.sections.length) sec = m.sections.length - 1;
  const target = m.sections[sec];
  const row = target.hasBreak ? target.bottom : target.top;
  const rightAligned = m.splitAt !== null && sec >= m.splitAt;
  if (rightAligned) row.unshift(tok); else row.push(tok);
  lastTouchedSection = sec;   // keep building in the same section on repeat adds
  commit(m);
};

/* ── the one pointer-drag controller ── */

const payloadLabel = (payload: string): string => {
  if (payload.startsWith('tok:') || payload.startsWith('new:')) return tokenLabel(payload.slice(4));
  if (payload === 'util:divider') return 'Divider';
  if (payload === 'util:spacer') return 'Spacer';
  if (payload === 'util:alignsplit') return 'Align Split';
  if (payload === 'blk:single') return 'Single Row Section';
  if (payload === 'blk:double') return 'Two Row Section';
  if (payload.startsWith('sec:')) return 'Section';
  return '';
};

/** Insertion index within a row, from item GEOMETRY: how many item midpoints
 *  lie left of x. v3.38, Derek: this replaced elementFromPoint-on-a-specific-
 *  item math, which fluttered — inserting the drop indicator shifted the item
 *  under the cursor (or the cursor landed on the indicator itself, which is
 *  not a `.rib-edit-item`, collapsing the spot to "append to end"), so the
 *  computed index oscillated. Measuring the items (indicators excluded, and
 *  they barely move the row) is stable no matter what pixel we're over. */
const rowIdxAt = (rowEl: HTMLElement, x: number): number => {
  let idx = 0;
  for (const it of Array.from(rowEl.querySelectorAll<HTMLElement>('.rib-edit-item'))) {
    const r = it.getBoundingClientRect();
    if (x > r.left + r.width / 2) idx += 1;
  }
  return idx;
};

/** Drop-spot from a screen point. Resolve the target ROW (directly, or the
 *  nearest row of the section the cursor is over — its padding counts), then
 *  read the index from geometry. Row-first keeps section padding and the row
 *  itself agreeing, so there's no fluttering seam at the section edge. */
const spotFromPoint = (x: number, y: number): RibDropSpot | null => {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  if (!el?.closest('.toolbar-ribbon')) return null;
  let row = el.closest<HTMLElement>('.toolbar-ribbon .rib-row');
  if (!row) {
    const sec = el.closest<HTMLElement>('.toolbar-ribbon .rib-section');
    const rows = sec ? Array.from(sec.querySelectorAll<HTMLElement>('.rib-row')) : [];
    if (!rows.length) return null;
    // pick the row whose vertical centre is nearest the cursor (two-row cases)
    row = rows.reduce((best, r) => {
      const rc = r.getBoundingClientRect();
      const bc = best.getBoundingClientRect();
      return Math.abs(y - (rc.top + rc.bottom) / 2) < Math.abs(y - (bc.top + bc.bottom) / 2) ? r : best;
    });
  }
  if (!row.dataset.sec) return null;
  return { sec: Number(row.dataset.sec), row: row.dataset.row as Row, idx: rowIdxAt(row, x) };
};

/** Section boundary from a point — how many section midpoints lie left of x
 *  (geometry, not hit-testing: the cursor spends half its life over gaps). */
const secSpotFromPoint = (x: number, y: number): number | null => {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  if (!el?.closest('.toolbar-ribbon')) return null;
  let b = 0;
  for (const s of Array.from(document.querySelectorAll<HTMLElement>('.toolbar-ribbon .rib-section[data-sec]'))) {
    const r = s.getBoundingClientRect();
    if (x > r.left + r.width / 2) b += 1;
  }
  return b;
};

const overPalette = (x: number, y: number): boolean =>
  !!(document.elementFromPoint(x, y) as HTMLElement | null)?.closest('.ribed-palette, .ribed-tools');

export const startRibbonDrag = (e: React.PointerEvent, payload: string) => {
  if (e.button !== 0) return;
  const target = e.target as HTMLElement;
  if (target.closest('.rib-edit-x, .rib-edit-grip, .ribed-dd-grip, input')) return;
  e.preventDefault();
  const startX = e.clientX;
  const startY = e.clientY;
  let active = false;
  let ghost: HTMLElement | null = null;
  const setEdit = (p: Partial<{ dragging: boolean; spot: RibDropSpot | null; secSpot: number | null }>) =>
    useEditorStore.getState().setRibEdit(p);
  const boundaryDrag = payload.startsWith('sec:') || payload.startsWith('blk:') || payload === 'util:alignsplit';

  const move = (ev: PointerEvent) => {
    if (!active) {
      if (Math.abs(ev.clientX - startX) < 4 && Math.abs(ev.clientY - startY) < 4) return;
      active = true;
      setEdit({ dragging: true });
      ghost = document.createElement('div');
      ghost.className = 'ribed-ghost';
      ghost.textContent = payloadLabel(payload);
      document.body.appendChild(ghost);
    }
    if (ghost) {
      ghost.style.left = `${ev.clientX + 10}px`;
      ghost.style.top = `${ev.clientY + 12}px`;
    }
    const op = overPalette(ev.clientX, ev.clientY);
    if (boundaryDrag) setEdit({ secSpot: op ? null : secSpotFromPoint(ev.clientX, ev.clientY), spot: null });
    else setEdit({ spot: op ? null : spotFromPoint(ev.clientX, ev.clientY), secSpot: null });
  };
  const up = (ev: PointerEvent) => {
    cleanup();
    if (!active) { setEdit({ dragging: false, spot: null, secSpot: null }); return; }
    const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
    if (payload.startsWith('tok:') && el?.closest('.ribed-palette')) {
      ribRemoveToken(payload.slice(4));      // dragged out to the palette = remove
    } else if (boundaryDrag) {
      const to = secSpotFromPoint(ev.clientX, ev.clientY);
      if (to !== null) {
        if (payload === 'util:alignsplit') ribSetAlignSplit(to);
        else if (payload.startsWith('blk:')) ribInsertSection(payload.slice(4) as 'single' | 'double', to);
        else ribMoveSection(Number(payload.slice(4)), to);
      }
    } else {
      ribApplyDrop(payload, spotFromPoint(ev.clientX, ev.clientY));
    }
    setEdit({ dragging: false, spot: null, secSpot: null });
  };
  const cleanup = () => {
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', up);
    ghost?.remove();
  };
  document.addEventListener('pointermove', move);
  document.addEventListener('pointerup', up);
};
