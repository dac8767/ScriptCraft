// devtools/check-v532.mjs — Navigator: ONE header row; Annotations + Scene
// Numbers are blue buttons in the body's first row.
import { launch, boot, seedScript, openTool, SCENES_4 } from './driver.mjs';
let pass = 0, fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FAIL: ${label}`); }
};
const { browser, page } = await launch();
await boot(page);
await seedScript(page, SCENES_4);
await openTool(page, 'Navigator');

const layout = await page.evaluate(() => {
  const chrome = [...document.querySelectorAll('.tool-inline-header .tool-ctl, .tool-inline .tool-ctl')]
    .filter((el) => !el.closest('.fs-navigator'));
  const chromeTops = chrome.map((el) => Math.round(el.getBoundingClientRect().top));
  const row = document.querySelector('.fs-nav-action-row');
  const btns = row ? [...row.querySelectorAll('button')] : [];
  const list = document.querySelector('.fs-nav-list');
  return {
    chromeHasAnno: chrome.some((el) => el.textContent?.includes('Annotations') || el.textContent?.includes('Scene Numbers')),
    oneRow: chromeTops.length > 0 && Math.max(...chromeTops) - Math.min(...chromeTops) <= 2,
    btnLabels: btns.map((b) => b.textContent?.trim()),
    blue: btns.length === 2 && btns[0].className.includes('dialog-btn-primary'),
    rowAboveList: row && list ? row.getBoundingClientRect().bottom <= list.getBoundingClientRect().top + 1 : false,
  };
});
ok(!layout.chromeHasAnno, 'the header chrome no longer carries the two buttons');
ok(layout.oneRow, 'the header is ONE row');
ok(layout.btnLabels.length === 2 && layout.btnLabels[0] === 'Annotations' && layout.btnLabels[1]?.includes('Scene Numbers'),
  `the body's first row holds them (${layout.btnLabels.join(' / ')})`);
ok(layout.blue, 'Annotations wears the blue button style');
ok(layout.rowAboveList, 'the action row sits above the list');

// Scene Numbers toggle: blue when ON, badges appear
const sn = await page.evaluateHandle(() =>
  [...document.querySelectorAll('.fs-nav-action-row button')].find((b) => b.textContent?.includes('Scene Numbers')));
await sn.asElement().click();
await page.waitForTimeout(150);
const toggled = await page.evaluate(() => ({
  blue: [...document.querySelectorAll('.fs-nav-action-row button')]
    .find((b) => b.textContent?.includes('Scene Numbers'))?.className.includes('dialog-btn-primary'),
  badges: document.querySelectorAll('.fs-nav-num-badge').length,
}));
ok(toggled.blue === true, 'Scene Numbers fills blue when ON');
ok(toggled.badges === SCENES_4.length, `and the circle badges appear (${toggled.badges})`);

// Annotations button opens the shared filter popover
await page.click('.fs-nav-action-row button:has-text("Annotations")');
ok(await page.waitForSelector('.markup-filter-pop', { timeout: 4000 }).then(() => true).catch(() => false),
  'Annotations opens the shared filter popover');
await page.screenshot({ path: '/tmp/v532-navigator.png' });
await page.keyboard.press('Escape');

// v5.32: the ACTIVE icon chip is unmistakable (thick accent ring)
await openTool(page, 'Annotations');
await page.evaluate(() => {
  const ed = window.__scEditor;
  ed.chain().setTextSelection(4).run();
});
await page.click('.markups-add-btn');
await page.waitForSelector('.fs-markup-popover', { timeout: 5000 });
const ring = await page.evaluate(() => {
  const active = document.querySelector('.markup-pop-icon-group .markup-preset.active');
  if (!active) return null;
  const cs = getComputedStyle(active);
  return { shadow: cs.boxShadow !== 'none', border: cs.borderTopWidth };
});
ok(ring && ring.shadow && ring.border === '2px', `active chip wears the thick ring (${ring?.border}, shadow ${ring?.shadow})`);
await page.screenshot({ path: '/tmp/v532-active.png', clip: await page.$('.fs-markup-popover').then((e) => e.boundingBox()) });

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
