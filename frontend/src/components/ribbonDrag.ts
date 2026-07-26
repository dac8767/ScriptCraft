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

/** v4.25, Derek: the drop spot, extended with VERTICAL intent — "rows emerge
 *  by dragging". Hovering the upper/lower band of a ONE-ROW section's row
 *  means "split this section into two rows here": `newRow: 'above'` drops the
 *  dragged item alone into a new TOP row (existing items move underneath),
 *  `'below'` alone into a new BOTTOM row. The middle band keeps the plain
 *  left/right insertion (`row`/`idx` — ignored when `newRow` is set).
 *  Structurally a RibDropSpot, so it rides the store's ribEdit unchanged;
 *  this module is the only writer of that field. */
export interface RibDropSpotEx extends RibDropSpot { newRow?: 'above' | 'below' }

const EMPTY_SECTION: RibbonSection = { top: [], bottom: [], hasBreak: false, breakLine: false };

// The section a double-click quick-add lands in: the one most recently created
// or added to (where the user is actively building), rather than always the
// last section — which, past the align split, is right-aligned. Updated by the
// section-create, item-drop and title-edit mutations; clamped on read.
let lastTouchedSection: number | null = null;

const clone = (m: RibbonModel): RibbonModel => ({
  // Field-by-field on purpose — but EVERY RibbonSection field must ride along,
  // or an unrelated edit silently strips it (v4.75: noSepBefore joined).
  sections: m.sections.map((s) => ({ top: [...s.top], bottom: [...s.bottom], hasBreak: s.hasBreak, breakLine: s.breakLine, title: s.title, noSepBefore: s.noSepBefore })),
  splitAt: m.splitAt,
});

const getModel = (): RibbonModel => parseRibbon(useEditorStore.getState().toolbarLeft);

// v3.71: a small undo stack for ribbon edits so Cmd/Ctrl+Z works while editing
// the toolbar (the script's own undo shouldn't swallow it). Every commit snaps
// the PRE-change toolbarLeft; ribUndo restores the last snapshot.
let undoStack: string[][] = [];
export const ribResetHistory = () => { undoStack = []; };
export const ribCanUndo = () => undoStack.length > 0;
export const ribUndo = () => {
  const st = useEditorStore.getState();
  const prev = undoStack.pop();
  if (prev) st.setToolbarZones([...prev], st.toolbarRight);
};

const commit = (m: RibbonModel) => {
  const st = useEditorStore.getState();
  undoStack.push([...st.toolbarLeft]);          // snapshot before the change
  if (undoStack.length > 100) undoStack.shift();
  st.setToolbarZones(serializeRibbon(m), st.toolbarRight);
};
const removeEverywhere = (m: RibbonModel, tok: string) => {
  for (const s of m.sections) {
    s.top = s.top.filter((t) => t !== tok);
    s.bottom = s.bottom.filter((t) => t !== tok);
  }
};

/** The concrete token an ITEM drag payload inserts: `tok:` (an on-bar item
 *  moving) and `new:` (a palette item) carry it; a dropped utility mints a
 *  fresh unique id. Null for the structural payloads (`sec:`, alignsplit),
 *  which never insert a token. */
const payloadToken = (payload: string): string | null => {
  if (payload.startsWith('tok:') || payload.startsWith('new:')) return payload.slice(4);
  if (payload === 'util:spacer') return `s:${Date.now()}`;
  if (payload === 'util:divider') return `d:${Date.now()}`;
  return null;
};

/* ── pure mutations (ported from RibbonEditor) ── */

/** v4.25, Derek: drop `tok` as a NEW ROW of section `sec` (pure — exported
 *  for testing). 'below' keeps the section's items on top and puts the
 *  dropped item alone underneath; 'above' puts it alone on top and moves the
 *  items down. The token is deduped from the whole ribbon first (an on-bar
 *  item is MOVING). If nothing else remains in the section — the dragged
 *  item WAS its only content, or it was empty — a break would leave a
 *  phantom empty row, so it stays one row with just the item. */
export const dropAsNewRowInModel = (m: RibbonModel, sec: number, tok: string, where: 'above' | 'below'): RibbonModel => {
  const s = m.sections[sec];
  if (!s) return m;
  removeEverywhere(m, tok);            // replaces s.top/s.bottom in place
  const rest = [...s.top, ...s.bottom];
  if (rest.length === 0) {
    m.sections[sec] = { ...s, top: [tok], bottom: [], hasBreak: false };
  } else {
    m.sections[sec] = where === 'above'
      ? { ...s, top: [tok], bottom: rest, hasBreak: true }
      : { ...s, top: rest, bottom: [tok], hasBreak: true };
  }
  return m;
};

/** v4.25, Derek: drop `tok` into BLANK ribbon space at section boundary `at`
 *  — a new one-row section holding just that item (pure — exported for
 *  testing). Same split bookkeeping as ribInsertSection: at or left of the
 *  align split, the split shifts and the section joins the LEFT run; past
 *  it, the split stays and the section is right-aligned. */
export const dropNewSectionInModel = (m: RibbonModel, at: number, tok: string): RibbonModel => {
  removeEverywhere(m, tok);
  const i = Math.max(0, Math.min(at, m.sections.length));
  m.sections.splice(i, 0, { top: [tok], bottom: [], hasBreak: false, breakLine: false });
  if (m.splitAt !== null && i <= m.splitAt) m.splitAt += 1;
  return m;
};

export const ribApplyDrop = (payload: string, at: RibDropSpotEx | null) => {
  if (!payload || !at) return;
  const m = clone(getModel());
  const target = m.sections[at.sec];
  if (!target) return;
  const tok = payloadToken(payload);
  if (!tok) return;
  if (at.newRow) {
    // v4.25: the upper/lower band of a one-row section — split it into two
    // rows around the dropped item instead of inserting beside the others.
    dropAsNewRowInModel(m, at.sec, tok, at.newRow);
  } else {
    const rowArr = at.row === 'top' ? target.top : target.bottom;
    let idx = Math.min(at.idx, rowArr.length);
    if (payload.startsWith('tok:')) {
      const before = rowArr.indexOf(tok);
      if (before >= 0 && before < idx) idx -= 1;
      removeEverywhere(m, tok);
    }
    // re-read: removeEverywhere REPLACES the row arrays it filters.
    const arr = at.row === 'top' ? target.top : target.bottom;
    arr.splice(Math.min(idx, arr.length), 0, tok);
  }
  lastTouchedSection = at.sec;   // the section just edited is the quick-add target
  commit(m);
};

/** v4.25, Derek: blank-space drop — the dragged item lands in a NEW one-row
 *  section at boundary `at` (rows then emerge by dragging above/below). */
export const ribDropNewSection = (payload: string, at: number | null) => {
  if (!payload || at === null) return;
  const tok = payloadToken(payload);
  if (!tok) return;
  const m = clone(getModel());
  const i = Math.max(0, Math.min(at, m.sections.length));
  dropNewSectionInModel(m, i, tok);
  lastTouchedSection = i;   // the just-made section becomes the quick-add target
  commit(m);
};

/** v4.25, Derek: sections are born ONE-ROW — a second row emerges by dragging
 *  an item to the row's upper/lower band, so the old 'single' | 'double'
 *  choice (and the '2 Row Section' menu entry) is gone. */
export const ribInsertSection = (at: number) => {
  const m = clone(getModel());
  m.sections.splice(at, 0, { top: [], bottom: [], hasBreak: false, breakLine: false });
  if (m.splitAt !== null && at <= m.splitAt) m.splitAt += 1;
  lastTouchedSection = at;   // a just-made section becomes the quick-add target
  commit(m);
};

/** v3.37, Derek: the on-bar "+ Add" adds a section at a boundary. `rightSide`
 *  picks whether the new section lands LEFT of the split (end of the
 *  left-aligned run) or RIGHT of it (start of the right-aligned run) — the
 *  split index shifts for a left insert but stays for a right one. */
export const ribAddSectionAtBoundary = (at: number, rightSide: boolean) => {
  const m = clone(getModel());
  m.sections.splice(at, 0, { top: [], bottom: [], hasBreak: false, breakLine: false });
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

/** v4.22, Derek: the per-section "+" adds a token straight INTO section
 *  `secIdx` (the old boundary +Add guessed the nearest section, which is how
 *  dividers kept landing in the wrong one). Appends at the section's end — the
 *  bottom row of a two-row section, the single row otherwise — and honours the
 *  right-aligned fill direction past the split. Builtins dedupe; dividers /
 *  spacers carry a unique id so they never do. */
export const ribAddToSection = (tok: string, secIdx: number) => {
  const m = clone(getModel());
  if (m.sections.length === 0) m.sections.push({ ...EMPTY_SECTION });
  const sec = Math.max(0, Math.min(secIdx, m.sections.length - 1));
  removeEverywhere(m, tok);
  const target = m.sections[sec];
  const row = target.hasBreak ? target.bottom : target.top;
  const rightAligned = m.splitAt !== null && sec >= m.splitAt;
  if (rightAligned) row.unshift(tok); else row.push(tok);
  lastTouchedSection = sec;
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
  commit(moveSectionInModel(clone(getModel()), from, to));
};

/** Move a section, keeping the align split honest: only the MOVED section
 *  changes sides (based on where it lands relative to the split); every other
 *  section stays on its own side. The old move left splitAt fixed, so moving a
 *  section across the split shoved a section on the far side over to fill the
 *  index. Exported pure for testing. */
export const moveSectionInModel = (m: RibbonModel, from: number, to: number): RibbonModel => {
  const split = m.splitAt;
  const [s] = m.sections.splice(from, 1);
  const dest = to > from ? to - 1 : to;
  m.sections.splice(dest, 0, s);
  if (split !== null) {
    // Boundary after the removal (it shifts left if the moved section came from
    // the left run), then +1 if the section is re-inserted on the left side.
    const afterRemoval = from < split ? split - 1 : split;
    m.splitAt = dest <= afterRemoval ? afterRemoval + 1 : afterRemoval;
  }
  return m;
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

/** v4.75, Derek: show/hide the divider LINE at section i's leading boundary —
 *  the sections stay separate either way (nd: vs 2!d: on serialize). */
export const ribToggleSectionSep = (i: number) => {
  const m = clone(getModel());
  const s = m.sections[i];
  if (!s || i === 0) return;
  s.noSepBefore = !s.noSepBefore;
  commit(m);
};

export const ribRemoveToken = (tok: string) => {
  const m = clone(getModel());
  removeEverywhere(m, tok);
  commit(m);
};

// v3.67: a ribbon spacer is `s:<id>` with an optional `:<px>` width. Dragging
// its edge in edit mode rewrites that width in place.
export const SPACER_MIN_PX = 5;
export const SPACER_MAX_PX = 400;
/** Set the pixel width of the spacer whose token is `tok` (matched by its
 *  `s:<id>` identity, whatever width it currently carries). */
export const ribSetSpacerWidth = (tok: string, px: number) => {
  const m = clone(getModel());
  const parts = tok.split(':');
  const id = `${parts[0]}:${parts[1]}`;            // 's:<id>'
  const w = Math.max(SPACER_MIN_PX, Math.min(SPACER_MAX_PX, Math.round(px)));
  const next = `${id}:${w}`;
  const matches = (t: string) => t === id || t.startsWith(`${id}:`);
  let changed = false;
  const remap = (arr: string[]) => arr.map((t) => (matches(t) ? ((changed = true), next) : t));
  for (const s of m.sections) { s.top = remap(s.top); s.bottom = remap(s.bottom); }
  if (changed) commit(m);
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
 *  itself agreeing, so there's no fluttering seam at the section edge.
 *
 *  v4.25, Derek: a ONE-ROW section's row gets three vertical bands. The
 *  middle keeps the left/right insertion; the upper/lower ~30% (everything
 *  past the row's edges — the title strip, the section padding — included)
 *  means "new top/bottom row here" (`newRow`). A two-row section keeps the
 *  plain nearest-row behavior — a section has at most two rows. `payload`
 *  lets the band check skip a spot that could never split: when the dragged
 *  item is the section's only content, there'd be nothing for the other row. */
const spotFromPoint = (x: number, y: number, payload?: string): RibDropSpotEx | null => {
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
  const sec = Number(row.dataset.sec);
  const s = getModel().sections[sec];
  if (s && !s.hasBreak) {
    const dragTok = payload && (payload.startsWith('tok:') || payload.startsWith('new:'))
      ? payload.slice(4) : null;
    const rest = [...s.top, ...s.bottom].filter((t) => t !== dragTok);
    if (rest.length > 0) {
      const r = row.getBoundingClientRect();
      const band = r.height * 0.3;
      if (y < r.top + band) return { sec, row: 'top', idx: 0, newRow: 'above' };
      if (y > r.bottom - band) return { sec, row: 'bottom', idx: 0, newRow: 'below' };
    }
  }
  return { sec, row: row.dataset.row as Row, idx: rowIdxAt(row, x) };
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

/** v4.25, Derek: boundary index when the cursor is over the ribbon's BLANK
 *  space — inside the bar but over no section (their padding counts as the
 *  section; used to be a dead drop). An item released here lands in a NEW
 *  one-row section at this boundary. */
const blankSpotFromPoint = (x: number, y: number): number | null => {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  if (!el?.closest('.toolbar-ribbon')) return null;
  if (el.closest('.rib-section')) return null;
  return secSpotFromPoint(x, y);
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
  const boundaryDrag = payload.startsWith('sec:') || payload === 'util:alignsplit';

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
    else {
      // v4.25: an ITEM drag over blank ribbon space previews a NEW section —
      // the boundary indicator (secSpot) doubles as its full-height drop line.
      const spot = op ? null : spotFromPoint(ev.clientX, ev.clientY, payload);
      const blank = op || spot ? null : blankSpotFromPoint(ev.clientX, ev.clientY);
      setEdit({ spot, secSpot: blank });
    }
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
        else ribMoveSection(Number(payload.slice(4)), to);
      }
    } else {
      const spot = spotFromPoint(ev.clientX, ev.clientY, payload);
      if (spot) ribApplyDrop(payload, spot);
      else ribDropNewSection(payload, blankSpotFromPoint(ev.clientX, ev.clientY));
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
