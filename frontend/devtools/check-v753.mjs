/* check-v753 — Derek: "for all of the dark buttons in the settings and
 * customize tabs: they are too big and ugly. redesign them to be sleeker."
 *
 * THE PROBLEM WAS WIDTH, not height, and that is worth writing down because
 * "too big" reads like a height complaint. `.swn-add-btn` was 28px tall, which
 * is about right — but it carried `width: 100%`, so "Hide All" rendered 720px
 * wide, and `.fs-adders-equal` split whatever row it was in between however
 * many buttons were there. Export… and Import… were 613px each. Two-word
 * labels marooned in the middle of slabs the width of the window.
 *
 * Both rules were correct where they were WRITTEN and wrong where they ended
 * up: `.swn-add-btn` began in the sticky-note popover (200px wide, full-width
 * button is right) and `.fs-customize-globals` began in the 180px Customize
 * rail. They were reused into 700–1200px Settings panels, where filling the
 * container stopped meaning "neat" and started meaning "enormous".
 *
 * So nothing new was designed. Every one of them is `dialog-btn
 * dialog-btn-sm` — the compact size the style scale already defines, driven by
 * --dz-dialog-btn-h-sm — sized to its own text. The fossil classes are deleted
 * rather than left beside the new vocabulary.
 *
 * WHAT THIS CHECKS, and why by measurement rather than by class name: a
 * regression here would not throw and would not fail tsc. Someone reads
 * "make this row fill the width" and adds one `flex: 1` and the slabs are
 * back, with every class name still correct. So the assertions are geometric —
 * no labelled button in any Settings tab may exceed a share of its panel, and
 * every one must sit on a height the scale actually defines.
 *
 * v7.55 — THIS CHECK MISSED TWO, and the correction is the interesting part.
 * Derek came back with "these buttons were not fixed in the last round of
 * updates", of Export Themes… and Import Themes…. They slipped through twice
 * over: they are AddMenu components rather than plain `button`s, so the survey
 * below never queried them, and at 304px in a 1,308px panel they sat under a
 * threshold expressed as a SHARE OF THE PANEL.
 *
 * The share was the wrong measure. What makes a button look wrong is being far
 * wider than its own label — that reads as broken in a narrow panel and a wide
 * one alike, and it is scale-invariant, so it does not quietly stop applying
 * when a window is resized. The survey now measures SLACK: the control's width
 * minus the width its own text actually needs. It also queries selects and
 * AddMenu triggers, not just buttons, because "dark thing stretched across the
 * panel" was never really about the tag name.
 *
 * The specificity fix is checked too, because it is the one with reach beyond
 * these tabs. `.dialog-footer button` and `.dialog-actions button` are the
 * fallback for a bare button dropped in a footer, but at 0,1,1 they outranked
 * `.dialog-btn-primary` at 0,1,0 — so a button that explicitly asked to be a
 * primary got repainted plain by the box it sat in. The Customize footer's
 * Save had been carrying its own accent rule purely to out-specify that. Both
 * container rules exclude `.dialog-btn` now, which is what makes the class
 * authoritative; the Save button's fill is the witness.
 */
import { readFileSync } from 'node:fs';
import { launch, boot, settle } from './driver.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};

const { browser, page } = await launch();
await boot(page);

/* Controls that are deliberately NOT buttons-on-the-scale, each for its own
   reason: colour dots, swatch cells, shortcut-key chips, the tab rail itself,
   the borderless per-row Clear. Naming them here rather than loosening the
   rule keeps the exceptions visible and countable. */
const SPECIALISED = 'prefs-tab|tabinfo|headbtn|rowbtn|customize-seg|sugg-cell'
  + '|shortcut-key|shortcut-clear|markup-dot|markup-preset|markup-cz-x|presets-all';

console.log('\nno button is a slab any more');
const tabs = await page.evaluate(async () => {
  window.__scStore.getState().openPreferences('general');
  await new Promise((r) => setTimeout(r, 900));
  return [...document.querySelectorAll('.prefs-tab')].map((t) => t.textContent.trim());
});
ok('every Settings tab was reachable', tabs.length >= 10, `${tabs.length} tabs`);

const surveyed = [];
for (const label of tabs) {
  const rows = await page.evaluate(async ({ lab, spec }) => {
    [...document.querySelectorAll('.prefs-tab')].find((x) => x.textContent.trim() === lab).click();
    await new Promise((r) => setTimeout(r, 600));
    const c = document.querySelector('.prefs-content');
    if (!c) return [];
    const cw = c.getBoundingClientRect().width;
    const re = new RegExp(spec);
    /* Measure the width this control's own text needs, in its own font. */
    const textWidth = (el) => {
      const probe = document.createElement('span');
      probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font:'
        + getComputedStyle(el).font;
      probe.textContent = el.textContent || el.value || '';
      document.body.appendChild(probe);
      const w = probe.getBoundingClientRect().width;
      probe.remove();
      return w;
    };
    return [...c.querySelectorAll('button')]
      .filter((b) => b.getBoundingClientRect().height > 0 && b.textContent.trim().length > 1)
      // A segmented toggle's halves wear only `active`/nothing — the control
      // is identified by its wrapper, so ask the wrapper too.
      .filter((b) => !re.test(b.className) && b.className !== '' && b.className !== 'active'
        && !b.closest('.fs-customize-seg'))
      .map((b) => {
        const cs = getComputedStyle(b);
        const rc = b.getBoundingClientRect();
        return {
          tab: lab,
          label: b.textContent.trim().slice(0, 20),
          cls: b.className,
          h: Math.round(rc.height),
          pct: Math.round((rc.width / cw) * 100),
          font: cs.fontSize,
          radius: cs.borderRadius,
          slack: Math.round(rc.width - textWidth(b)),
        };
      });
  }, { lab: label, spec: SPECIALISED });
  surveyed.push(...rows);
}
ok('there are labelled buttons to check at all', surveyed.length >= 15,
  `${surveyed.length} across ${tabs.length} tabs`);

/* Every CONTROL that holds a label, not just <button> — a select and an
   AddMenu trigger stretch exactly the same way, and the two Derek had to
   report twice were AddMenus. The size-scale assertions further down stay
   button-only, because a dropdown has its own row on the scale. */
const controls = [];
for (const label of tabs) {
  const rows = await page.evaluate(async (lab) => {
    [...document.querySelectorAll('.prefs-tab')].find((x) => x.textContent.trim() === lab).click();
    await new Promise((r) => setTimeout(r, 600));
    const c = document.querySelector('.prefs-content');
    if (!c) return [];
    const textWidth = (el) => {
      const probe = document.createElement('span');
      probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font:'
        + getComputedStyle(el).font;
      probe.textContent = el.textContent || el.value || '';
      document.body.appendChild(probe);
      const w = probe.getBoundingClientRect().width;
      probe.remove();
      return w;
    };
    return [...c.querySelectorAll('button, select, .fs-addmenu-trigger')]
      .filter((e) => e.getBoundingClientRect().height > 0
        && String(e.textContent || e.value || '').trim().length > 1)
      .map((e) => ({
        tab: lab,
        label: String(e.textContent || e.value).trim().slice(0, 22),
        cls: e.className,
        w: Math.round(e.getBoundingClientRect().width),
        slack: Math.round(e.getBoundingClientRect().width - textWidth(e)),
      }));
  }, label);
  controls.push(...rows);
}
ok('the wider survey sees selects and menus too, not just buttons',
  controls.length > surveyed.length, `${controls.length} controls vs ${surveyed.length} buttons`);

/* THE ONE THAT WOULD CATCH A RELAPSE, and the one that FAILED to in v7.53.
   Slack — width minus the width the label needs — is the honest measure: it
   reads the same in a narrow panel and a wide one, where a share-of-panel
   threshold silently stops applying as the window grows. 140px of slack is
   already a button twice the size of its word; the ones Derek reported carried
   190px and the worst of the originals over 600px. */
const slabs = controls.filter((b) => b.slack > 140);
ok('no control is far wider than the label it holds',
  slabs.length === 0,
  JSON.stringify(slabs.slice(0, 4)));
const loosest = controls.reduce((a, b) => (b.slack > a.slack ? b : a), controls[0]);
ok('…and the loosest one is still comfortably label-sized',
  loosest.slack <= 140, JSON.stringify(loosest));

/* Every one on a height the scale defines — 34/14 for an action, 26/12 for a
   compact. A fourth size nobody chose is how this started. */
const offScale = surveyed.filter((b) => !((b.h === 34 && b.font === '14px')
  || (b.h === 26 && b.font === '12px')));
ok('every labelled button sits on the size scale',
  offScale.length === 0, JSON.stringify(offScale.slice(0, 4)));
const radii = [...new Set(surveyed.map((b) => b.radius))];
ok('…with one corner radius between them', radii.length === 1 && radii[0] === '5px',
  JSON.stringify(radii));

/* The Customize footer: compact utilities at the left, full-size actions at
   the right. Both sizes present is the point — it is a hierarchy, not a
   mistake. */
console.log('\nthe Customize footer keeps its hierarchy');
const footer = await page.evaluate(async () => {
  window.__scStore.getState().closePreferences?.();
  await new Promise((r) => setTimeout(r, 400));
  [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Customize').click();
  await new Promise((r) => setTimeout(r, 1200));
  const f = document.querySelector('.fs-customize-footer');
  if (!f) return { skipped: 'no Customize footer' };
  const read = (el) => {
    const cs = getComputedStyle(el);
    return {
      t: el.textContent.trim(), h: Math.round(el.getBoundingClientRect().height),
      font: cs.fontSize, bg: cs.backgroundColor, cls: el.className,
    };
  };
  return {
    buttons: [...f.querySelectorAll('button')].map(read),
    accent: getComputedStyle(document.documentElement).getPropertyValue('--fd-accent').trim(),
  };
});
if (footer.skipped) {
  console.log(`  SKIP the Customize footer — ${footer.skipped}`);
} else {
  /* v7.56: Export… / Import… left this footer — they moved the whole preset
     bundle regardless of the tab, so Derek replaced them with one Backup &
     Restore door beside the tabs. Lock All is what remains of the utilities. */
  const util = footer.buttons.filter((b) => /Lock/.test(b.t));
  const acts = footer.buttons.filter((b) => /^(Cancel|Save)$/.test(b.t));
  ok('the utility is compact', util.length === 1 && util.every((b) => b.h === 26),
    JSON.stringify(util.map((b) => [b.t, b.h])));
  ok('…and the preset pair is gone from the footer',
    !footer.buttons.some((b) => /Export|Import/.test(b.t)),
    JSON.stringify(footer.buttons.map((b) => b.t)));
  ok('…and Cancel / Save keep the full action size',
    acts.length === 2 && acts.every((b) => b.h === 34),
    JSON.stringify(acts.map((b) => [b.t, b.h])));
  /* THE SPECIFICITY WITNESS. Save asks to be a primary by class. Before the
     `:not(.dialog-btn)` fix, `.dialog-footer button` repainted it plain and
     the accent had to be restored by a bespoke rule. */
  const save = footer.buttons.find((b) => b.t === 'Save');
  const hex = footer.accent.replace('#', '');
  const rgb = `rgb(${parseInt(hex.slice(0, 2), 16)}, ${parseInt(hex.slice(2, 4), 16)}, ${parseInt(hex.slice(4, 6), 16)})`;
  ok('Save is painted by its own class, not by the box it sits in',
    save.bg === rgb, JSON.stringify({ got: save.bg, want: rgb, cls: save.cls }));
}

console.log('\nthe fossils are gone, not parked');
const css = ['19-sticky-notes', '23-toolbar-zones', '03-toolbar', '20-tool-dock', '22-tools-extra',
  '24-notebook', '27-markups', '07-dialogs-search']
  .map((f) => readFileSync(new URL(`../src/styles/screenplay/${f}.css`, import.meta.url), 'utf8'))
  .join('\n');
const src = ['CustomizePanelsDialog', 'EditElementsDialog', 'ThemesTab', 'KeyboardShortcutsTab',
  'PreferencesDialog', 'MarkupsCustomizeTab', 'customizeResets']
  .map((f) => readFileSync(new URL(`../src/components/${f}.tsx`, import.meta.url), 'utf8'))
  .join('\n');
/* Strip comments before looking. Each of these names still appears in the note
   recording WHY it went — which is the opposite of a relapse — so a bare
   substring search would flag the documentation as the bug. */
const cssRules = css.replace(/\/\*[\s\S]*?\*\//g, '');
for (const dead of ['swn-add-btn', 'swn-add-primary', 'fs-adders-equal']) {
  ok(`.${dead} has no rule left in the stylesheets`, !cssRules.includes(dead), '');
  ok(`…and no call site left in the components`, !src.includes(dead), '');
}
/* A retired class left in place is a second vocabulary waiting to be used. */
ok('the compact buttons ask for the scale by name, not by a bespoke rule',
  (src.match(/dialog-btn dialog-btn-sm/g) || []).length >= 12,
  `${(src.match(/dialog-btn dialog-btn-sm/g) || []).length} call sites`);
/* The container rules must defer to an explicit dialog-btn — this is what
   makes the class authoritative instead of the box. */
ok('.dialog-footer / .dialog-actions defer to an explicit dialog-btn',
  /\.dialog-footer button:not\(\.dialog-btn\)/.test(css)
  && /\.dialog-actions button:not\(\.dialog-btn\)/.test(css), '');
/* And the accent rule that only existed to out-specify them is gone, rather
   than left as a second source for the same colour. */
ok('…so the Save button\'s bespoke accent rule could go',
  !/\.fs-customize-footer \.fs-customize-save \{/.test(css), '');

console.log(`\ncheck-v753: ${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
