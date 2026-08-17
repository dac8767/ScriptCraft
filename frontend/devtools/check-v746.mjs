/* check-v746 — the zoom control, now its own component.
 *
 * Queue #7. Toolbar's renderBuiltinControl is 661 lines closing over 79
 * values, which reads like an unsplittable knot. It is not: the 79 is the
 * UNION across 33 cases and the median case uses three. What made it look
 * knotted is four cases carrying their own state, and zoom is the biggest —
 * five state fields, three effects, two measuring functions, 179 lines.
 *
 * A pure move would be verified by tsc. This one is not a pure move: the
 * state left Toolbar's scope, so what has to be proven is that the pieces
 * still find each other. The stepper, the editable percentage and the menu
 * were three parts of one component's state; if any one lost its wiring
 * nothing would fail to compile and nothing would throw — the button would
 * simply stop doing anything, which is this project's cardinal sin.
 *
 * And Fit Page cannot be checked by reading: it MEASURES. Three versions got
 * it wrong (v0.85, v0.87, v0.89) because .page holds the whole script — page
 * breaks are decorations, not elements — so measuring the element fits the
 * entire document instead of one page. The assertion here is the one that
 * catches that: after Fit Page, ONE page must fill the view, not all of them.
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
/* Enough script to run past one page, so "fit one page" and "fit the whole
   document" give different answers. */
await page.evaluate(() => {
  window.__scEditor.commands.setContent({
    type: 'doc',
    content: Array.from({ length: 140 }, (_, i) => ({
      type: 'action',
      content: [{ type: 'text', text: `Action line ${i} carrying enough words to occupy real space.` }],
    })),
  });
});
/* Zoom is not in the DEFAULT ribbon, so put it there — this is about the
   control, not about which layout ships with it. */
await page.evaluate(() => {
  window.__scStore.getState().setToolbarZones(['b:zoom'], []);
});
await settle(page);
await page.waitForTimeout(700);

const zoom = () => page.evaluate(() => window.__scStore.getState().zoomLevel);
const wrap = '.zoom-menu-wrap';

console.log('\nthe control renders and still drives the store');
ok('the zoom control is on the toolbar', Boolean(await page.$(wrap)));

const start = await zoom();
await page.click('.zoom-tb-step[title="Zoom in"]');
await settle(page);
const inZ = await zoom();
ok('Zoom in raises the level', inZ > start, `${start} → ${inZ}`);

await page.click('.zoom-tb-step[title="Zoom out"]');
await settle(page);
ok('Zoom out lowers it again', (await zoom()) === start, `back to ${await zoom()}`);

/* The editable percentage — click to type. It reads its value from the store
   and writes back on Enter; those are two directions of one wire, and the
   extraction could have broken either. */
console.log('\nthe percentage reads and writes');
const typed = await page.evaluate(async () => {
  const mid = document.querySelector('.zoom-tb-mid span:not(.zoom-tb-icon)')
    ?? document.querySelector('.zoom-tb-mid');
  mid.click();
  await new Promise((r) => setTimeout(r, 200));
  const input = document.querySelector('.zoom-tb-input');
  if (!input) return { editable: false };
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, '125');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await new Promise((r) => setTimeout(r, 300));
  return { editable: true, level: window.__scStore.getState().zoomLevel };
});
ok('clicking the percentage makes it editable', typed.editable === true, JSON.stringify(typed));
ok('…and typing a value applies it', typed.level === 125, JSON.stringify(typed));

/* Out of range must be REFUSED, not clamped silently to something the writer
   did not ask for — and must not leave the field holding a number the app is
   not using. */
const refused = await page.evaluate(async () => {
  const before = window.__scStore.getState().zoomLevel;
  const mid = document.querySelector('.zoom-tb-mid span:not(.zoom-tb-icon)') ?? document.querySelector('.zoom-tb-mid');
  mid.click();
  await new Promise((r) => setTimeout(r, 200));
  const input = document.querySelector('.zoom-tb-input');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, '9999');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await new Promise((r) => setTimeout(r, 300));
  return { before, after: window.__scStore.getState().zoomLevel };
});
ok('a value past the maximum is refused, not applied',
  refused.after === refused.before, JSON.stringify(refused));

console.log('\nthe menu behind the caret');
const menu = await page.evaluate(async () => {
  document.querySelector('.zoom-tb-caret').click();
  await new Promise((r) => setTimeout(r, 250));
  const items = [...document.querySelectorAll('.zoom-menu-item')].map((b) => b.textContent.trim());
  return { open: Boolean(document.querySelector('.zoom-menu')), items };
});
ok('the caret opens the menu', menu.open === true, JSON.stringify(menu));
ok('…with Reset, Fit Page and Max Width',
  ['Reset', 'Fit Page to Screen', 'Scale to Max Width'].every((t) => menu.items.includes(t)),
  JSON.stringify(menu.items));

const reset = await page.evaluate(async () => {
  [...document.querySelectorAll('.zoom-menu-item')].find((b) => b.textContent.trim() === 'Reset').click();
  await new Promise((r) => setTimeout(r, 300));
  return { level: window.__scStore.getState().zoomLevel, menuGone: !document.querySelector('.zoom-menu') };
});
ok('Reset returns to 100', reset.level === 100, JSON.stringify(reset));
ok('…and closes the menu behind it', reset.menuGone === true, JSON.stringify(reset));

/* THE MEASURING ONE. Fit Page must fit ONE page, not the whole document. */
console.log('\nFit Page fits one page, not the script');
const fit = await page.evaluate(async () => {
  document.querySelector('.zoom-tb-caret').click();
  await new Promise((r) => setTimeout(r, 200));
  [...document.querySelectorAll('.zoom-menu-item')]
    .find((b) => b.textContent.trim() === 'Fit Page to Screen').click();
  await new Promise((r) => setTimeout(r, 500));
  const scroller = document.querySelector('.editor-main');
  const pageEl = document.querySelector('.page');
  const level = window.__scStore.getState().zoomLevel;
  // one page's on-screen height at this zoom, from the layout (not the element,
  // which holds the whole script)
  const { pageHeight } = window.__scStore.getState().pageLayout;
  const onePageH = pageHeight * 96 * (level / 100);
  return {
    level,
    onePageH: Math.round(onePageH),
    availH: scroller.clientHeight,
    docH: Math.round(pageEl.getBoundingClientRect().height),
  };
});
ok('it chose a real zoom level', fit.level >= 50 && fit.level <= 300, JSON.stringify(fit));
// one page should very nearly fill the view — if it fitted the whole DOCUMENT
// instead, one page would be a small fraction of the height
ok('one page fills most of the view', fit.onePageH > fit.availH * 0.6, JSON.stringify(fit));
ok('…and does not overflow it', fit.onePageH <= fit.availH + 2, JSON.stringify(fit));
// the document is many pages, so it must NOT have been what was fitted
ok('the whole document was not what got fitted', fit.docH > fit.availH * 1.5, JSON.stringify(fit));

console.log('\nthe extraction itself');
const zc = readFileSync(new URL('../src/components/ZoomControl.tsx', import.meta.url), 'utf8');
const tb = readFileSync(new URL('../src/components/Toolbar.tsx', import.meta.url), 'utf8');
ok('ZoomControl takes no props — its state was never Toolbar\'s',
  /const ZoomControl: React\.FC = \(\) =>/.test(zc), '');
ok('Toolbar renders it instead of the old case body',
  /case 'zoom': return <ZoomControl \/>;/.test(tb), '');
ok('…and no longer holds zoom state', !/zoomMenuOpen|zoomEditing/.test(tb), '');
ok('the bounds went with it', /ZOOM_MAX = 300/.test(zc) && !/ZOOM_MAX/.test(tb), '');
/* Fit Page reads the page height from pageLayout. Asking the DOM is the
   mistake that took three versions to stop making. */
ok('Fit Page still takes the page height from the layout, not the element',
  /pageLayout\.pageHeight \* CSS_PX_PER_IN/.test(zc), '');

console.log(`\ncheck-v746: ${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
