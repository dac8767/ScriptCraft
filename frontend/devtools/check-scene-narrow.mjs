// devtools/check-scene-narrow.mjs — v5.09: docked (narrow) the synopsis field
// and figures fold behind a per-scene caret; fullscreen (wide) keeps the full
// five-column table. Plus the card view's always-on 0:00 time estimate.
import { launch, boot, seedScript, openTool, fullscreen, waitScenes, shot, SCENES_4, settle } from './driver.mjs';

const results = [];
const check = (name, got, want) => {
  const ok = got === want;
  results.push(ok);
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name.padEnd(34)} got ${JSON.stringify(got)}${ok ? '' : `  want ${JSON.stringify(want)}`}`);
};

const { browser, page } = await launch();
await boot(page);
await seedScript(page, SCENES_4);
await openTool(page, 'Scenes');
await waitScenes(page, 4);

// ── DOCKED: the side panel is ~277px — narrow mode ──
let r = await page.evaluate(() => ({
  navW: Math.round(document.querySelector('.scene-navigator').getBoundingClientRect().width),
  carets: document.querySelectorAll('.scene-caret-btn').length,
  inlineFields: document.querySelectorAll('.scene-heading-row .scene-synopsis-field').length,
  inlineMetrics: document.querySelectorAll('.scene-heading-row .scene-metrics').length,
  header: !!document.querySelector('.scene-list-header'),
  subItems: document.querySelectorAll('.scene-sub-item').length,
}));
check('docked width < 520', r.navW < 520, true);
check('carets on every row', r.carets, 4);
check('no inline synopsis fields', r.inlineFields, 0);
check('no inline metrics', r.inlineMetrics, 0);
check('no column header', r.header, false);
check('no sub-items before a caret click', r.subItems, 0);

// v5.11: CARET-ONLY toggling again (v5.10's whole-row toggle reverted), with
// a hit area worth aiming at. Row clicks must do nothing; double-click jumps.
const rowHead = (await page.$$('.scene-row-narrow .scene-heading-label'))[1];
await rowHead.click();
await settle(page);
check('row click does NOT open the fold', await page.$$eval('.scene-sub-item', (e) => e.length), 0);
const caretBox = await (await page.$('.scene-caret-btn')).boundingBox();
check('caret hit area ≥ 24px wide', caretBox.width >= 24, true);
check('caret hit area spans the row (≥ 36px tall)', caretBox.height >= 36, true);
const before = await page.evaluate(() => Math.round(document.querySelector('.editor-main')?.scrollTop ?? -1));
await rowHead.dblclick();
await page.waitForTimeout(900);
check('double-click still jumps the script',
  (await page.evaluate(() => Math.round(document.querySelector('.editor-main')?.scrollTop ?? -1))) !== before, true);
check('double-click opens no fold', await page.$$eval('.scene-sub-item', (e) => e.length), 0);

const caret = (await page.$$('.scene-caret-btn'))[1];
await caret.click();
await page.waitForSelector('.scene-sub-item', { timeout: 4000 });
r = await page.evaluate(() => ({
  subItems: document.querySelectorAll('.scene-sub-item').length,
  time: document.querySelector('.scene-sub-item .scene-metric-time')?.textContent,
  pages: document.querySelector('.scene-sub-item .scene-metric-pages')?.textContent ?? '',
}));
check('caret opens ONE sub-item', r.subItems, 1);
check('sub-item shows a time', typeof r.time === 'string' && /^\d+:\d\d$/.test(r.time), true);
check('sub-item shows a page count', /page/.test(r.pages), true);

await page.click('.scene-sub-item .scene-synopsis-field');
await page.keyboard.type('Folded synopsis.');
await page.keyboard.press('Enter');
await page.waitForTimeout(900);
await caret.click();                       // collapse
await settle(page);
await caret.click();                       // reopen
await page.waitForSelector('.scene-sub-item', { timeout: 4000 });
check('typed synopsis survives fold/unfold',
  await page.$eval('.scene-sub-item .scene-synopsis-field', (el) => el.value), 'Folded synopsis.');
await shot(page, '.scene-navigator', new URL('./last-scene-narrow.png', import.meta.url).pathname, 340);

// ── FULLSCREEN: wide — the full table, no carets ──
await fullscreen(page);
await waitScenes(page, 4);
r = await page.evaluate(() => ({
  carets: document.querySelectorAll('.scene-caret-btn').length,
  inlineFields: document.querySelectorAll('.scene-heading-row .scene-synopsis-field').length,
  header: !!document.querySelector('.scene-list-header'),
  synopsis2: document.querySelectorAll('.scene-synopsis-field')[1]?.value,
}));
check('fullscreen: no carets', r.carets, 0);
check('fullscreen: field on every row', r.inlineFields, 4);
check('fullscreen: column header back', r.header, true);
check('fullscreen: folded edit visible in the table', r.synopsis2, 'Folded synopsis.');

// ── CARD VIEW: time estimate always, 0:00 fallback ──
// The View control is a ControlDropdown: .tool-ctl trigger, portalled
// .tool-ctl-menu with .tool-ctl-menu-item entries. Real clicks throughout —
// the menu closes on window pointerdown, so Playwright's click (a genuine
// pointer event on the item) is the honest path.
// When the header is tight the trigger compacts to its CURRENT value
// ("List"), dropping the "View" label — v4.91 behaviour, so match either.
const viewBtn = page.locator('.fs-tool-takeover .tool-ctl', { hasText: /^(View|List|Cards)/ }).first();
await viewBtn.click({ timeout: 8000 });
await page.locator('.tool-ctl-menu .tool-ctl-menu-item', { hasText: 'Cards' }).click();
await page.waitForSelector('.index-card', { timeout: 6000 });
r = await page.evaluate(() => {
  const metas = [...document.querySelectorAll('.index-card')].map((c) =>
    [...c.querySelectorAll('.ic-meta-item')].map((m) => m.textContent).join(' '));
  return { cards: metas.length, allHaveTime: metas.every((m) => /\d+:\d\d/.test(m)), metas: metas.slice(0, 4) };
});
check('cards render', r.cards, 4);
check('every card shows a time', r.allHaveTime, true);
console.log('     card metas:', JSON.stringify(r.metas));

// v5.11, Derek: "use the same color for the time estimate in both the list
// and card view." The card time wears the SAME .scene-metric-time class —
// computed colours must be identical.
const cardTimeColor = await page.$eval('.index-card .scene-metric-time', (el) => getComputedStyle(el).color);
const listTimeColor = await page.evaluate(() => {
  const probe = document.createElement('span');
  probe.className = 'scene-metric-time';
  document.body.appendChild(probe);
  const c = getComputedStyle(probe).color;
  probe.remove();
  return c;
});
check('card time colour === list time colour', cardTimeColor, listTimeColor);

await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
