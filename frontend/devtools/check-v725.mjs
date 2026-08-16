/* check-v725 — Derek: "move the 'Saved' indicator so it is on the white page,
 * centered and about an inch down from the ruler. make the indicator larger."
 *
 * Measured against the REAL page, because every number here is one the app
 * computes at runtime: the page's centre moves with the side panels, and its
 * inch moves with the zoom. Asserting "left: 50%" or "top: 96px" would pass on
 * a screen Derek never looks at.
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
await settle(page);

/** Fire a save flash and read back where it actually landed, next to the
 *  page and ruler it is supposed to be placed against. */
const flashAt = async () => page.evaluate(async () => {
  const m = await window.__scImport('/src/utils/saveFlash.ts');
  m.flashSaved();
  await new Promise((r) => setTimeout(r, 250));
  const el = document.querySelector('.fs-page-saved');
  if (!el) return { found: false };
  const b = el.getBoundingClientRect();
  const pg = document.querySelector('.page')?.getBoundingClientRect() ?? null;
  const ru = document.querySelector('.fs-ruler-h')?.getBoundingClientRect() ?? null;
  const cs = getComputedStyle(el);
  return {
    found: true,
    text: el.textContent,
    position: cs.position,
    fontPx: parseFloat(cs.fontSize),
    parentIsBody: el.parentElement === document.body,
    // where it is, relative to the things it is placed against
    offCentre: pg ? Math.round((b.left + b.width / 2) - (pg.left + pg.width / 2)) : null,
    dropPx: ru ? Math.round(b.top - ru.bottom) : null,
    pageWidth: pg ? Math.round(pg.width) : null,
    onWhite: pg ? (b.left >= pg.left && b.right <= pg.right && b.top >= pg.top) : false,
  };
});

console.log('\n1. it is on the white page, centered, an inch under the ruler');
await page.evaluate(() => window.__scStore.getState().setRulersVisible(true));
await settle(page);
const a = await flashAt();
ok('the flash appears at all', a.found === true, JSON.stringify(a));
ok('…saying "Saved"', a.text === 'Saved', String(a.text));
ok('…centered on the page (within a pixel)', Math.abs(a.offCentre) <= 1, `off by ${a.offCentre}px`);
/* An inch of the PAGE. At 100% an 8.5in page is 816px, so its inch is 96 —
   but the assertion is written against the measured page so it holds if the
   default zoom or page size ever changes. */
const inch = Math.round(a.pageWidth / 8.5);
ok('…dropped one page-inch below the ruler', Math.abs(a.dropPx - inch) <= 2, `drop ${a.dropPx}px vs inch ${inch}px`);
ok('…and it lands ON the white page, not in the grey', a.onWhite === true, JSON.stringify(a));

console.log('\n2. larger, and fixed rather than trapped in the scroller');
ok('the text is bigger than the 10.5px it wore in the title bar', a.fontPx >= 15, `${a.fontPx}px`);
ok('positioned fixed — measured top/left, never bottom', a.position === 'fixed', a.position);
ok('portalled to the body, so the scroller\'s overflow cannot clip it', a.parentIsBody === true, '');

console.log('\n3. it holds when the page moves under it');
/* THE REASON IT IS MEASURED. A side panel shifts the page; a zoom changes
   what an inch is. Both would break a hardcoded left:50% / top:96px. */
const zoomed = await page.evaluate(async () => {
  window.__scStore.getState().setZoomLevel(150);
  await new Promise((r) => setTimeout(r, 400));
  return document.querySelector('.page')?.getBoundingClientRect().width ?? 0;
});
if (zoomed > 900) {
  const z = await flashAt();
  const zInch = Math.round(z.pageWidth / 8.5);
  ok('zoomed in: still centered on the page', Math.abs(z.offCentre) <= 1, `off by ${z.offCentre}px`);
  ok('…and still one PAGE-inch down, not a flat 96px',
    Math.abs(z.dropPx - zInch) <= 3 && zInch > 120, `drop ${z.dropPx}px vs inch ${zInch}px`);
} else {
  ok('zoom drove the page wider', false, `page width ${zoomed}px — zoom setter not found`);
}

console.log('\n4. one renderer, and the old one is gone');
const tb = readFileSync(new URL('../src/components/TitleBar.tsx', import.meta.url), 'utf8');
ok('the Quick Access copy is gone, not left behind beside the new one',
  !/fs-titlebar-saved/.test(tb) && !/subscribeSaveFlash/.test(tb), '');
const css = readFileSync(new URL('../src/styles/screenplay/25-confirm-outline-tabs.css', import.meta.url), 'utf8');
ok('…and its CSS went with it', !/\.fs-titlebar-saved/.test(css), '');
ok('the flash still animates out on its own', /animation: fs-saved-flash/.test(css), '');
const tokens = readFileSync(new URL('../src/design/designTokens.ts', import.meta.url), 'utf8');
ok('the size is a Design knob', /--dz-saved-font/.test(tokens) && /var\(--dz-saved-font, 17px\)/.test(css), '');

/* It must LEAVE. A confirmation that stays is a smudge on the page. */
const gone = await page.evaluate(async () => {
  await new Promise((r) => setTimeout(r, 2000));
  return !document.querySelector('.fs-page-saved');
});
ok('and it fades away rather than sitting on the page', gone === true, '');

console.log(`\ncheck-v725: ${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
