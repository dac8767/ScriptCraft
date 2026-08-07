/* check-v624 — Derek's Helper Text batch: (a) the found-in info renders ON
   SCREEN, not as hover text; (b) every row has a show/hide button — hidden
   rows leave the list, live in the Hidden view, persist, and can be put
   back; (c) rows are GROUPED by where they're found (Ribbon Toolbar, Menus,
   windows, …); (d) a go-there button opens the surface the text lives in
   WITHOUT closing the Helper Text window. */
import { launch, boot, settle } from './driver.mjs';

const { browser, page } = await launch({ width: 1500, height: 950 });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL', m); } };

try {
  await boot(page);
  await page.evaluate(() => window.__scStore.getState().setHelperTextWindowOpen(true));
  await page.waitForSelector('.htw-panel .ht-row');
  await settle(page);

  // (c) grouped by area, Derek's surfaces leading
  const heads = await page.$$eval('.htw-panel .dz-group-head', (els) => els.map((e) => e.textContent.replace(/\d+$/, '').trim()));
  ok(heads.length > 10, `the list is grouped by area (${heads.length} groups)`);
  ok(heads[0] === 'Ribbon Toolbar', `Ribbon Toolbar leads (${heads.slice(0, 3).join(' · ')})`);
  // (The Quick Access Toolbar has no literal-title entries — its tooltips
  // are computed from the QAT registry — so that group is legitimately
  // absent until such a literal exists.)
  ok(heads.includes('Menus') && heads.includes('Status Bar'),
    'the named surfaces are groups (Menus, Status Bar)');

  // (a) found-in is visible text on the row
  const where = await page.$eval('.htw-panel .ht-row .ht-where', (el) => el.textContent);
  ok(/^Found in: .+/.test(where), `the found-in info is on screen ("${where.slice(0, 40)}…")`);

  // (b) hide a row → it leaves the list, appears under Hidden, persists
  const firstText = await page.$eval('.htw-panel .ht-row .ht-input', (el) => el.value);
  await page.click('.htw-panel .ht-row .ht-hide');
  await settle(page);
  const stillThere = await page.$$eval('.htw-panel .ht-row .ht-input', (els, t) => els.some((e) => e.value === t), firstText);
  ok(!stillThere, 'hiding a row removes it from the main list');
  await page.click('.htw-panel .ht-hiddenchip');
  await settle(page);
  const inHidden = await page.$$eval('.htw-panel .ht-row .ht-input', (els, t) => els.some((e) => e.value === t), firstText);
  ok(inHidden, 'the Hidden view lists it');
  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('opendraft:viewState') ?? '{}').helperTextHidden ?? []);
  ok(persisted.length === 1, 'the hidden set persists in the view state');
  await page.click('.htw-panel .ht-row .ht-hide');   // put it back (eye)
  await settle(page);
  const hiddenCount = await page.$eval('.htw-panel .ht-hiddenchip', (el) => el.textContent);
  ok(hiddenCount.includes('(0)'), 'the put-it-back eye empties the Hidden view');
  await page.click('.htw-panel .ht-hiddenchip');     // back to the main list
  await settle(page);

  // (d) go-there opens the window the text lives in; Helper Text stays open
  await page.fill('.htw-panel .dz-search-input', 'Notes per row');
  await settle(page);
  const hasGoto = await page.$('.htw-panel .ht-row .ht-goto');
  ok(!!hasGoto, 'a tool-window row carries the go-there button');
  await page.click('.htw-panel .ht-row .ht-goto');
  await settle(page); await settle(page);
  const after = await page.evaluate(() => ({
    htwOpen: !!document.querySelector('.htw-panel'),
    stickyOpen: window.__scStore.getState().isToolOpen('sticky'),
  }));
  ok(after.stickyOpen, 'clicking it opens the Notes window');
  ok(after.htwOpen, 'and the Helper Text window stays open');

  // (e) line breaks: a two-line override lands verbatim in the live title
  await page.fill('.htw-panel .dz-search-input', 'Fullscreen');
  await settle(page);
  await page.fill('.htw-panel .ht-input[data-ht-for="Fullscreen"]', 'Big mode\nFills the screen');
  await page.evaluate(() => document.activeElement?.blur());
  await settle(page);
  await page.evaluate(() => {
    const s = window.__scStore.getState();
    s.setToolMode('characters', 'floating');
    s.openTool('characters');
  });
  await page.waitForFunction(() =>
    [...document.querySelectorAll('.tool-window button')].some((b) => b.title === 'Big mode\nFills the screen'),
    { timeout: 4000 });
  ok(true, 'a two-line override lands with its line break in the live tooltip');
  await page.evaluate(() => window.__scStore.getState().setHelperTextOverride('Fullscreen', null));
} catch (e) {
  console.log('PROBE ERROR:', e.message);
  await page.screenshot({ path: '/tmp/v624-err.png' }).catch(() => {});
} finally { await browser.close(); }
console.log(`\ncheck-v624: ${pass} passed, ${fail} failed`);
