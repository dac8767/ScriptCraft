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

  it('shows the Synopsis placeholder on rows that have no synopsis yet', () => {
    const f = fields();
    expect(f.map((el) => el.placeholder)).toEqual(['Synopsis', 'Synopsis', 'Synopsis']);
    expect(f.map((el) => el.value)).toEqual(['', 'She loses the tail in the rain.', '']);
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

  it('clicking the field does not toggle the row open', () => {
    // The row's own click handler expands it and jumps the editor to the
    // scene. Clicking into the synopsis must do neither — a field that
    // scrolls the script out from under you as you click it is unusable.
    // Asserted through the rendered result, not a native listener: React
    // dispatches from the root, so a hand-attached listener sees every click
    // regardless of stopPropagation and would pass no matter what.
    act(() => { fields()[0].dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(host.querySelector('.navigator-scene.expanded')).toBeNull();
  });

  it('and clicking the ROW still does toggle it open', () => {
    act(() => { host.querySelector('.scene-info')!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(host.querySelector('.navigator-scene.expanded')).toBeTruthy();
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

  it('defines both the wide and the narrow template', () => {
    expect(templates).toHaveLength(2);
  });

  it('sizes no track to content — no auto / min-content / max-content / fit-content', () => {
    for (const t of templates) {
      expect(t, `content-sized track in "${t}"`).not.toMatch(/\b(auto|min-content|max-content|fit-content)\b/);
    }
  });

  it('gives both templates a fixed number track, a fixed metrics track and a fixed icon track', () => {
    for (const t of templates) {
      expect(t).toMatch(/--dz-nav-badge/);        // number
      expect(t).toMatch(/--scene-metrics-w/);     // metrics
      expect(t).toMatch(/\b16px\b/);              // length icon
    }
  });

  it('assigns every cell a grid area, so no cell can land in the wrong track', () => {
    for (const area of ['num', 'head', 'synopsis', 'metrics', 'icon']) {
      expect(css, `grid-area: ${area} unassigned`).toMatch(new RegExp(`grid-area:\\s*${area}\\s*;`));
    }
  });
});
