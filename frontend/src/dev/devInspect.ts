/**
 * devInspect — turn a clicked DOM element into the name we'd both use for it.
 *
 * The point isn't saving keystrokes. It's that "the link isn't working in the
 * notes thing" costs a round trip to disambiguate, while "Notes — Right Panel"
 * doesn't. So this resolves a click to the name the CODE uses, read from the same
 * registries the UI renders from (ALL_TOOLS, the menu bar, the toolbar built-ins),
 * not from a hand-written list that would drift.
 *
 * DEV ONLY. Nothing in the app imports this outside the Dev Picker tool, so the
 * whole feature lifts out by deleting src/dev/ and three small hooks.
 */
import { ALL_TOOLS } from '../components/ToolDock';
import { TOOLBAR_BUILTINS } from '../components/toolbarBuiltins';

export interface Capture {
  /** What gets written into the composer, e.g. "Notes — Right Panel". */
  name: string;
  /** Where it came from, for the hint line under the composer. */
  kind: string;
}

const text = (el: Element | null): string =>
  (el?.textContent || '').replace(/\s+/g, ' ').trim();

/** The label a control advertises, in the order a human would read it. */
const labelOf = (el: HTMLElement): string =>
  el.getAttribute('data-dev-label')
  || el.getAttribute('title')
  || el.getAttribute('aria-label')
  || text(el.querySelector('.menu-label, .tool-dock-label, .fs-customize-tool, .swn-card-title'))
  || text(el)
  || '(unlabelled)';

/** Which side panel an element sits in, if any. */
const panelSide = (el: HTMLElement): 'Left' | 'Right' | null => {
  const wrap = el.closest('.tool-dock-wrap');
  if (!wrap) return null;
  return wrap.classList.contains('tool-dock-left') ? 'Left'
    : wrap.classList.contains('tool-dock-right') ? 'Right'
    : null;
};

/** The tool a click landed inside, resolved through ALL_TOOLS by its label. */
const toolFromLabel = (label: string) =>
  ALL_TOOLS.find((t) => t.label.toLowerCase() === label.toLowerCase());

/**
 * Resolve the most specific thing under the cursor.
 *
 * Ordered most-specific first: a click on the Notes tab in the right panel should
 * come back as the Notes tab, not as "the right panel", even though both are true.
 */
export function describeElement(target: EventTarget | null): Capture | null {
  let el = target as HTMLElement | null;
  if (!el || !(el instanceof Element)) return null;
  if (el.closest('[data-dev-panel]')) return null;   // never capture our own UI

  // ── Side panel: the tool tabs down the dock ──
  const dockItem = el.closest('.tool-dock-item') as HTMLElement | null;
  if (dockItem) {
    const label = labelOf(dockItem);
    const side = panelSide(dockItem);
    const tool = toolFromLabel(label);
    return {
      name: `${tool?.label ?? label} — ${side ?? 'Unknown'} Panel`,
      kind: tool ? `tool id: ${tool.id}` : 'panel tab',
    };
  }

  // ── Inside an open panel or a floating window ──
  const windowTitle = el.closest('.tool-window')?.querySelector('.tool-window-title');
  if (windowTitle) {
    const label = text(windowTitle);
    const tool = toolFromLabel(label);
    const inner = innerControl(el);
    return {
      name: inner ? `${inner} — ${label} Window` : `${label} — Window`,
      kind: tool ? `tool id: ${tool.id}` : 'floating window',
    };
  }
  const side = panelSide(el);
  if (side) {
    const active = el.closest('.tool-dock')?.querySelector('.tool-dock-item.active');
    const label = active ? labelOf(active as HTMLElement) : null;
    const inner = innerControl(el);
    const tool = label ? toolFromLabel(label) : undefined;
    return {
      name: inner
        ? `${inner} — ${label ?? 'panel'} (${side} Panel)`
        : `${label ?? 'Panel'} — ${side} Panel`,
      kind: tool ? `tool id: ${tool.id}` : `${side.toLowerCase()} panel`,
    };
  }

  // ── Menu bar ──
  const menuItem = el.closest('.menu-item') as HTMLElement | null;
  if (menuItem) return { name: `${labelOf(menuItem)} — Menu Bar`, kind: 'menu' };

  const menuRow = el.closest('.menu-dropdown-item') as HTMLElement | null;
  if (menuRow) {
    const menu = openMenuName();
    const label = labelOf(menuRow).replace(/^✓\s*/, '');
    return {
      name: menu ? `${menu} > ${label}` : `${label} — Menu Item`,
      kind: 'menu item',
    };
  }

  // ── Toolbar ──
  const tbBtn = el.closest('.toolbar-btn, .toolbar-select, .view-style-selector') as HTMLElement | null;
  if (tbBtn && el.closest('.toolbar')) {
    const label = labelOf(tbBtn);
    const builtin = TOOLBAR_BUILTINS.find((b) => b.label.toLowerCase() === label.toLowerCase());
    return {
      name: `${builtin?.label ?? label} — Toolbar`,
      kind: builtin ? `toolbar key: ${builtin.key}` : 'toolbar control',
    };
  }

  // ── Customize dialog ──
  const custRow = el.closest('.fs-customize-row') as HTMLElement | null;
  if (custRow) {
    const tab = text(document.querySelector('.fs-customize-cat.active, .fs-customize-sidebar .active'));
    const label = text(custRow.querySelector('.fs-customize-tool')) || labelOf(custRow);
    return {
      name: `"${label}" row — Customize${tab ? ` > ${tab}` : ''}`,
      kind: 'customize row',
    };
  }
  if (el.closest('.fs-customize-dialog, .fs-customize-body')) {
    const tab = text(document.querySelector('.fs-customize-cat.active, .fs-customize-sidebar .active'));
    const inner = innerControl(el);
    return {
      name: `${inner ?? 'Customize'}${tab ? ` — Customize > ${tab}` : ' — Customize'}`,
      kind: 'customize',
    };
  }

  // ── Cards (Notes / To-Do) ──
  const card = el.closest('.swn-card') as HTMLElement | null;
  if (card) {
    const isTodo = !!card.querySelector('.swn-todo-item, .swn-todo-list');
    const inner = innerControl(el);
    const what = isTodo ? 'To-Do card' : 'Note card';
    return { name: inner ? `${inner} — ${what}` : what, kind: 'card' };
  }

  // ── The script itself ──
  const elem = el.closest('.screenplay-element') as HTMLElement | null;
  if (elem) {
    const type = elem.getAttribute('data-type') || 'element';
    const snippet = text(elem).slice(0, 40);
    return {
      name: `${type} element${snippet ? ` ("${snippet}${text(elem).length > 40 ? '…' : ''}")` : ''} — Script`,
      kind: `element type: ${type}`,
    };
  }

  // ── Anything else with a name ──
  const named = el.closest('button, [title], [aria-label]') as HTMLElement | null;
  if (named) return { name: labelOf(named), kind: named.tagName.toLowerCase() };
  return null;
}

/** A named control INSIDE a bigger thing — the button you actually hit. */
function innerControl(el: HTMLElement): string | null {
  const btn = el.closest('button, input, select, textarea, a') as HTMLElement | null;
  if (!btn) return null;
  const label = labelOf(btn);
  if (!label || label === '(unlabelled)') return null;
  // Long labels are usually body text, not a control name.
  return label.length > 40 ? null : label;
}

/** Which menu is currently open, so a dropdown row reads "File > Preferences…". */
function openMenuName(): string | null {
  const active = document.querySelector('.menu-item.active .menu-label');
  return active ? text(active) : null;
}
