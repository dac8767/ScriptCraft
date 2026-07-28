// @vitest-environment jsdom
/**
 * The scene list ROW (v5.02, Derek's mockup: "make spacing and alignment
 * uniform").
 *
 * Two things make the columns line up, and both are easy to undo by accident:
 *
 *  1. Every row renders all five cells — number, heading, synopsis field,
 *     metrics, length icon — whether or not it HAS a number, a synopsis or a
 *     page length. v5.01 rendered the synopsis only when there was one, and
 *     the column existed on some rows and not others. A missing cell leaves
 *     its grid track unoccupied and the row reads ragged.
 *  2. No track may size to its own row's content. That is a CSS fact, so the
 *     stylesheet is read and asserted directly — an `auto` track in the narrow
 *     template measured "0.19 page" against "1.7 pages" and put the synopsis
 *     fields six pixels apart, which is the exact misalignment being fixed.
 *
 * Plus the field's write path: commit on blur, revert on Escape, and CLEARING
 * writes the empty string back rather than quietly keeping the old text.
 *
 * The editor is null here — deliberately. The cells must render from store
 * data alone, which is what proves they are unconditional.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import SceneNavigator from './SceneNavigator';
import { useEditorStore, type SceneInfo } from '../stores/editorStore';

const scene = (n: number, heading: string, synopsis = '', sceneNumber: number | null = n): SceneInfo =>
  ({ id: `s${n}`, heading, sceneNumber, color: '', synopsis });

const SCENES: SceneInfo[] = [
  scene(1, 'INT. COFFEE SHOP - DAY'),
  scene(2, 'EXT. ALLEY - NIGHT', 'She loses the tail in the rain.'),
  scene(3, 'INT. CAR - CONTINUOUS', '', null),   // no number either
];

let host: HTMLElement;
let root: Root;

beforeEach(() => {
  useEditorStore.setState({ scenes: SCENES.map((s) => ({ ...s })), sceneSearch: '', scenesViewMode: 'list' });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(<SceneNavigator editor={null} view="scenes" />));
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const rows = () => Array.from(host.querySelectorAll('.navigator-scene'));
const fields = () => Array.from(host.querySelectorAll<HTMLInputElement>('.scene-synopsis-field'));

/** What a real keystroke does — React ignores a raw .value assignment. */
function typeInto(el: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

/** React 17+ maps onBlur to the native FOCUSOUT (blur itself doesn't bubble,
 *  and React listens at the root container). Dispatching 'blur' here fired
 *  nothing at all and the commit tests passed vacuously. */
function blur(el: HTMLInputElement) {
  el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
}

describe('every row carries the same five cells', () => {
  it('renders one row per scene', () => {
    expect(rows()).toHaveLength(3);
  });

  for (const cell of ['.scene-num-cell', '.scene-heading-text', '.scene-synopsis-field', '.scene-metrics', '.scene-length']) {
    it(`renders ${cell} on every row, including the empty ones`, () => {
      for (const r of rows()) expect(r.querySelector(cell), `${cell} missing`).toBeTruthy();
    });
  }

  /* v5.04, Derek: "remove the helper text in the synopsis field." The field's
     own box is the affordance and the column header names it; "Synopsis"
     repeated down every empty row was noise. The FIELD still renders on every
     row — that part is what keeps the column a column. */
  it('renders an empty, placeholder-free field on rows with no synopsis', () => {
    const f = fields();
    expect(f.map((el) => el.placeholder)).toEqual(['', '', '']);
    expect(f.map((el) => el.value)).toEqual(['', 'She loses the tail in the rain.', '']);
  });

  /* v5.03, Derek: "always show a page count and a time here. for this first
     item, make the time 0:00." With no editor there are no page lengths and
     no timings at all, which is the harshest version of that case. */
  it('prints a page count AND a time on every row, even with nothing measured', () => {
    for (const r of rows()) {
      expect(r.querySelector('.scene-metric-pages')?.textContent).toBeTruthy();
      expect(r.querySelector('.scene-metric-time')?.textContent).toBe('0:00');
    }
  });

  it('keeps the number cell even when the scene is unnumbered', () => {
    // The third scene has sceneNumber null: the badge is gone, the CELL is not.
    const third = rows()[2];
    expect(third.querySelector('.scene-num-cell')).toBeTruthy();
    expect(third.querySelector('.scene-number-badge')).toBeNull();
  });
});

describe('the inline synopsis field writes back', () => {
  it('commits on blur', () => {
    const f = fields()[0];
    act(() => { typeInto(f, 'The barista knows too much.'); blur(f); });
    expect(useEditorStore.getState().scenes[0].synopsis).toBe('The barista knows too much.');
  });

  it('trims what it commits', () => {
    const f = fields()[0];
    act(() => { typeInto(f, '   padded   '); blur(f); });
    expect(useEditorStore.getState().scenes[0].synopsis).toBe('padded');
  });

  it('CLEARING a synopsis writes the empty string, it does not keep the old text', () => {
    const f = fields()[1];
    act(() => { typeInto(f, ''); blur(f); });
    expect(useEditorStore.getState().scenes[1].synopsis).toBe('');
  });

  it('Escape reverts the field and writes nothing', () => {
    const f = fields()[1];
    act(() => {
      typeInto(f, 'THROWAWAY');
      f.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(f.value).toBe('She loses the tail in the rain.');
    expect(useEditorStore.getState().scenes[1].synopsis).toBe('She loses the tail in the rain.');
  });

  it('an unchanged field writes nothing on blur', () => {
    const before = useEditorStore.getState().scenes;
    act(() => { blur(fields()[1]); });
    expect(useEditorStore.getState().scenes).toBe(before);   // same array identity: no set() ran
  });

  /* v5.03, Derek: "remove the ability to show this info when clicking on a
     scene in the list view." Clicking a row jumps to the scene and does
     nothing else — the panel it used to unfold repeated the row's own page
     count, runtime and synopsis back at you. */
  it('clicking a row unfolds no detail panel', () => {
    act(() => { host.querySelector('.scene-info')!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(host.querySelector('.scene-synopsis-expanded')).toBeNull();
    expect(host.querySelector('.navigator-scene.expanded')).toBeNull();
    expect(host.querySelector('.scene-synopsis-edit-btn')).toBeNull();
  });
});

/* ── narrow mode (v5.09): the sub-item behind the caret ─────────────────
   jsdom has no ResizeObserver, so the component defaults to WIDE — which is
   what every test above relies on. Here we stub one that reports a 300px
   container the moment it observes, flipping the SAME component narrow. */
describe('narrow mode folds synopsis + figures behind the caret', () => {
  let RealRO: typeof ResizeObserver | undefined;
  beforeEach(() => {
    RealRO = (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
      cb: (entries: { contentRect: { width: number } }[]) => void;
      constructor(cb: (entries: { contentRect: { width: number } }[]) => void) { this.cb = cb; }
      observe() { this.cb([{ contentRect: { width: 300 } }]); }
      disconnect() {}
      unobserve() {}
    };
    // REMOUNT under the stub — the observer effect has [] deps, so a mere
    // re-render of the already-mounted (wide) instance never observes again.
    act(() => root.unmount());
    root = createRoot(host);
    act(() => root.render(<SceneNavigator editor={null} view="scenes" />));
  });
  afterEach(() => {
    (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver = RealRO;
  });

  it('rows keep caret · number · heading · icon, and no inline synopsis or metrics', () => {
    for (const r of rows()) {
      expect(r.querySelector('.scene-caret-btn')).toBeTruthy();
      expect(r.querySelector('.scene-num-cell')).toBeTruthy();
      expect(r.querySelector('.scene-heading-text')).toBeTruthy();
      expect(r.querySelector('.scene-length')).toBeTruthy();
      expect(r.querySelector('.scene-synopsis-field')).toBeNull();
      expect(r.querySelector('.scene-metrics')).toBeNull();
    }
  });

  it('hides the column header (no columns to head, no grips to drag)', () => {
    expect(host.querySelector('.scene-list-header')).toBeNull();
  });

  it('the caret reveals the sub-item — same field, same figures — and hides it again', () => {
    const caret = rows()[1].querySelector('.scene-caret-btn') as HTMLButtonElement;
    act(() => { caret.click(); });
    const sub = rows()[1].querySelector('.scene-sub-item')!;
    expect(sub).toBeTruthy();
    expect((sub.querySelector('.scene-synopsis-field') as HTMLInputElement).value).toBe('She loses the tail in the rain.');
    expect(sub.querySelector('.scene-metric-time')?.textContent).toBe('0:00');
    // only the caret's own row opened
    expect(host.querySelectorAll('.scene-sub-item')).toHaveLength(1);
    act(() => { caret.click(); });
    expect(rows()[1].querySelector('.scene-sub-item')).toBeNull();
  });

  it('the sub-item field commits through the same write path', () => {
    const caret = rows()[0].querySelector('.scene-caret-btn') as HTMLButtonElement;
    act(() => { caret.click(); });
    const f = rows()[0].querySelector('.scene-sub-item .scene-synopsis-field') as HTMLInputElement;
    act(() => { typeInto(f, 'Folded but not forked.'); blur(f); });
    expect(useEditorStore.getState().scenes[0].synopsis).toBe('Folded but not forked.');
  });
});

/* ── the CSS invariant: no track may size to its own row's content ──────── */
describe('scene-heading-row grid tracks', () => {
  // vitest runs from frontend/; import.meta.url is a Vite http URL here, not a file one.
  const css = readFileSync(resolve(process.cwd(), 'src/styles/screenplay/05-scene-navigator.css'), 'utf8');

  /** The `grid-template-columns` declarations inside .scene-heading-row rules. */
  const templates = Array.from(
    css.matchAll(/\.scene-heading-row\s*\{[^}]*?grid-template-columns:\s*([^;]+);/gs),
    (m) => m[1].replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\s+/g, ' ').trim(),
  );

  it('defines the wide template and the narrow caret-row template', () => {
    // v5.09: narrow is a different DOM (caret + sub-item), selected by a
    // ResizeObserver in the component — its template lives on .scene-row-narrow.
    expect(templates).toHaveLength(1);
    expect(css).toMatch(/\.scene-heading-row\.scene-row-narrow\s*\{[^}]*grid-template-columns/s);
    expect(css).toMatch(/"caret num head icon"/);
  });

  it('sizes no track to content — no auto / min-content / max-content / fit-content', () => {
    const narrow = css.match(/\.scene-heading-row\.scene-row-narrow\s*\{[^}]*grid-template-columns:\s*([^;]+);/s)![1];
    for (const t of [...templates, narrow]) {
      expect(t, `content-sized track in "${t}"`).not.toMatch(/\b(auto|min-content|max-content|fit-content)\b/);
    }
  });

  it('gives the wide template a fixed number track, a fixed metrics track and a fixed icon track', () => {
    for (const t of templates) {
      expect(t).toMatch(/--dz-nav-badge/);        // number
      expect(t).toMatch(/--scene-metrics-w/);     // metrics
      expect(t).toMatch(/\b16px\b/);              // length icon
    }
  });

  it('the column header is laid out by the same class as the rows', () => {
    // Not a lookalike template of its own: .scene-list-header ALSO carries
    // .scene-heading-row, so a resized column cannot line up in the header
    // and miss in the list.
    const header = host.querySelector('.scene-list-header');
    expect(header).toBeTruthy();
    expect(header!.classList.contains('scene-heading-row')).toBe(true);
  });

  /* v5.05, Derek: "make the column titles have the same format." All three are
     one class and DIRECT children of the header. Nested inside the data cells
     they inherited those cells' type — 14px monospace under .scene-heading-text,
     11px under .scene-metrics — and no styling of .scene-col-title could undo
     an inherited font it never set. Where they sit IS the format. */
  it('all three column titles are siblings of one class, straight under the header', () => {
    const header = host.querySelector('.scene-list-header')!;
    const titles = Array.from(header.querySelectorAll('.scene-col-title'));
    expect(titles.map((t) => t.textContent!.trim())).toEqual(['Scene', 'Synopsis', 'Length']);
    for (const t of titles) expect(t.parentElement, 'a title nested in a data cell inherits its font').toBe(header);
  });

  /* v5.05, Derek: "require a double click to jump to the chosen scene." */
  it('the row advertises double-click, and carries no single-click handler', () => {
    const info = host.querySelector('.scene-info') as HTMLElement;
    expect(info.title).toBe('Double-click to go to this scene');
    // React stores its props on the fiber; the row must have ondblclick wiring
    // and no onClick, or a stray single click would move the script again.
    const key = Object.keys(info).find((k) => k.startsWith('__reactProps$'))!;
    const props = (info as unknown as Record<string, { onClick?: unknown; onDoubleClick?: unknown }>)[key];
    expect(props.onDoubleClick, 'no double-click handler').toBeTypeOf('function');
    expect(props.onClick, 'a single click must not navigate').toBeUndefined();
  });

  /* v5.05, Derek: "the column resizing bar should be halfway between the end
     of the scene name column and the synopsis field." The grip's offset is
     computed FROM the grid's own gutter variable, so widening the gutter moves
     the bar with it — hard-coding the offset is how they drift apart. */
  it('the resize grips are positioned from the same variable as the column gutter', () => {
    expect(css).toMatch(/column-gap:\s*var\(--scene-col-gap/);
    const grips = css.match(/\.scene-col-grip[^{]*\{[^}]*\}/gs) ?? [];
    const offsets = grips.filter((g) => /(^|\s)(right|left):\s*calc/m.test(g));
    expect(offsets.length, 'a grip offset that ignores --scene-col-gap').toBeGreaterThanOrEqual(2);
    for (const g of offsets) expect(g).toMatch(/--scene-col-gap/);
  });

  /* v5.06, Derek's marked-up screenshot: a column is what the eye groups.
     "Scene" spans badge+heading, "Length" spans figures+icon — via the
     template's NAMED LINES, so the spans track the template. Centred on the
     bare head/metrics tracks, both titles sat visibly off his centre marks. */
  it('Scene and Length titles span their whole regions', () => {
    expect(css).toMatch(/\.scene-col-title-head\s*\{[^}]*grid-column:\s*num-start\s*\/\s*head-end/);
    expect(css).toMatch(/\.scene-col-title-met\s*\{[^}]*grid-column:\s*metrics-start\s*\/\s*icon-end/);
  });

  it('assigns every cell a grid area, so no cell can land in the wrong track', () => {
    for (const area of ['num', 'head', 'synopsis', 'metrics', 'icon']) {
      expect(css, `grid-area: ${area} unassigned`).toMatch(new RegExp(`grid-area:\\s*${area}\\s*;`));
    }
  });
});
