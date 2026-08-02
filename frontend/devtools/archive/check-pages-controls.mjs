// devtools/check-pages-controls.mjs — v5.08 Pages-tool controls:
// "Pages per row: N" stepper (buttons only, clamped, drives the real column
// count), "Go to page:" label, no placeholder, and the page/label gap token.
import { launch, boot, seedScript, openTool, fullscreen } from './driver.mjs';

const { browser, page } = await launch();
await boot(page);
await seedScript(page, [
  { heading: 'EXT. SPACE - OPENING SCROLL', lines: 60 },
  { heading: 'INT. SPACE CARRIER - BRIDGE', lines: 60 },
  { heading: 'INT. CARRIER - HANGER BAY', lines: 60 },
]);
await openTool(page, 'Pages');
await fullscreen(page);
await page.waitForSelector('.page-thumbnail', { timeout: 10000 });

const read = () => page.evaluate(() => ({
  label: document.querySelector('#fs-pages-perrow-label')?.textContent,
  count: document.querySelector('.tool-action-count')?.textContent,
  cols: getComputedStyle(document.querySelector('.page-thumbnails-grid')).gridTemplateColumns.split(' ').length,
  gotoLabel: document.querySelector('label[for="fs-pages-goto"]')?.textContent,
  placeholder: document.querySelector('#fs-pages-goto')?.placeholder,
  wrapperGap: getComputedStyle(document.querySelector('.page-thumb-wrapper')).marginBottom,
  minusDisabled: document.querySelector('button[title*="Fewer pages"]')?.disabled,
  plusDisabled: document.querySelector('button[title*="More pages"]')?.disabled,
}));

const results = [];
const check = (name, got, want) => {
  const ok = got === want;
  results.push(ok);
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name.padEnd(26)} got ${JSON.stringify(got)}${ok ? '' : `  want ${JSON.stringify(want)}`}`);
};

let r = await read();
check('label', r.label, 'Pages per row:');
check('goto label', r.gotoLabel, 'Go to page #');   // the colon became a # later
check('placeholder removed', r.placeholder, '');
check('default count', r.count, '3');
check('grid columns = count', r.cols, 3);
check('wrapper gap default', r.wrapperGap, '14px');

// step down to the floor: 3 → 1, minus disables, columns follow
const minus = await page.$('button[title*="Fewer pages"]');
const plus = await page.$('button[title*="More pages"]');
await minus.click(); await minus.click();
await page.waitForTimeout(150);
r = await read();
check('floor count', r.count, '1');
check('floor columns', r.cols, 1);
check('minus disabled at floor', r.minusDisabled, true);

// step up to the ceiling: 1 → 8 — click while enabled; the disable at the
// ceiling IS the clamp working (a blind 9th click just times out on it)
while (!(await plus.isDisabled())) await plus.click();
await page.waitForTimeout(150);
r = await read();
check('ceiling count', r.count, '8');
check('ceiling columns', r.cols, 8);
check('plus disabled at ceiling', r.plusDisabled, true);

// the Design token actually drives the gap end-to-end
await page.evaluate(() => document.documentElement.style.setProperty('--dz-pages-row-gap', '30px'));
r = await read();
check('token drives the gap', r.wrapperGap, '30px');

await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
