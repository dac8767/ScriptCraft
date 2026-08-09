/**
 * helperText (v6.20) — Derek's Helper Text editor: "edit every single piece
 * of helper text in the app … blank lists and fields, hover text, helper
 * text for buttons and windows, the ? button text."
 *
 * ONE mechanism, keyed by the DEFAULT STRING itself:
 *   - `helperTextOverrides` (editorStore, persisted) maps default → custom.
 *   - Editing "Delete" retitles every "Delete" tooltip in the app — which is
 *     the single-source behavior we want (they were the same string on
 *     purpose), and the only keying that doesn't demand hand-written ids on
 *     hundreds of call sites.
 *
 * Two delivery paths:
 *   1. DOM applier (installHelperTextDom) — hover `title` and field
 *      `placeholder` attributes app-wide. A MutationObserver swaps any
 *      attribute whose value matches an overridden default and remembers the
 *      original in data-ht-orig, so React re-renders (which write the JSX
 *      literal back) converge instead of fighting, and removing an override
 *      restores the original. This covers EVERY component — including TipTap
 *      node views and portals — without touching 500 call sites.
 *   2. ht()/useHt() — for helper text that renders as CONTENT (empty-list
 *      hints, the ? popover bodies, the element placeholder map). ht() is a
 *      plain read for non-React code; useHt() subscribes so components
 *      re-render when an override changes.
 *
 * The Design window's Helper Text section lists everything the generated
 * catalog (src/data/helperTextCatalog.json, devtools/build-helper-catalog.mjs)
 * knows about. The CODE is the source of truth — the catalog regenerates.
 */
import { useCallback } from 'react';
import { useEditorStore } from '../stores/editorStore';

/** Override-aware read for non-reactive call sites (plugins, callbacks). */
export function ht(dflt: string): string {
  return useEditorStore.getState().helperTextOverrides[dflt] ?? dflt;
}

/** Reactive form: components re-render when an override changes. */
export function useHt(): (dflt: string) => string {
  const overrides = useEditorStore((s) => s.helperTextOverrides);
  return useCallback((dflt: string) => overrides[dflt] ?? dflt, [overrides]);
}

const ATTRS = ['title', 'placeholder'] as const;
const ORIG = 'data-ht-orig';

function applyToElement(el: Element, overrides: Record<string, string>) {
  for (const attr of ATTRS) {
    const cur = el.getAttribute(attr);
    if (cur === null) continue;
    const memoAttr = `${ORIG}-${attr}`;
    let orig = el.getAttribute(memoAttr) ?? cur;
    /* v6.51: a DYNAMIC title can legitimately re-render to a DIFFERENT
       default (e.g. the outline bar checkbox's two ternary arms). When the
       current value is neither the remembered default nor that default's
       override, the component itself changed the text — adopt it as the
       new original instead of painting the stale arm's override over it. */
    if (cur !== orig && overrides[orig] !== undefined && cur !== overrides[orig]) {
      orig = cur;
      el.removeAttribute(memoAttr);
    }
    const want = overrides[orig];
    if (want !== undefined) {
      if (cur !== want) {
        el.setAttribute(memoAttr, orig);
        el.setAttribute(attr, want);
      } else if (!el.hasAttribute(memoAttr)) {
        el.setAttribute(memoAttr, orig);
      }
    } else if (el.hasAttribute(memoAttr)) {
      // override removed — restore the app's own text
      el.setAttribute(attr, orig);
      el.removeAttribute(memoAttr);
    }
  }
}

function applyEverywhere(overrides: Record<string, string>) {
  const sel = ATTRS.map((a) => `[${a}], [${ORIG}-${a}]`).join(', ');
  document.querySelectorAll(sel).forEach((el) => applyToElement(el, overrides));
}

/** Install the app-wide title/placeholder applier. Call once at app root.
 *  Returns a teardown (tests use it; the app never does). */
export function installHelperTextDom(): () => void {
  let overrides = useEditorStore.getState().helperTextOverrides;

  const observer = new MutationObserver((muts) => {
    if (!Object.keys(overrides).length && !document.querySelector(`[${ORIG}-title], [${ORIG}-placeholder]`)) return;
    for (const m of muts) {
      if (m.type === 'attributes') {
        applyToElement(m.target as Element, overrides);
      } else {
        for (const n of m.addedNodes) {
          if (!(n instanceof Element)) continue;
          applyToElement(n, overrides);
          const sel = ATTRS.map((a) => `[${a}]`).join(', ');
          n.querySelectorAll?.(sel).forEach((el) => applyToElement(el, overrides));
        }
      }
    }
  });
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: [...ATTRS],
  });

  const unsub = useEditorStore.subscribe((s) => {
    if (s.helperTextOverrides !== overrides) {
      overrides = s.helperTextOverrides;
      applyEverywhere(overrides);
    }
  });

  applyEverywhere(overrides);
  return () => { observer.disconnect(); unsub(); };
}
