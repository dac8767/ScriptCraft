// check-v570 — filter-menu clarity + Reset.
//  1. "Show all types" / "Hide all types" — the labels say what they cover
//     (both doors of the shared section)
//  2. the Navigator filter's Reset row puts EVERY control back to defaults:
//     scene filters (segment/location/contains) AND the shared annotation
//     filters (status, hidden types) — and the list + chip recover
import { launch, boot, seedScript, openTool, SCENES_4 } from './driver.mjs';

const { browser, page } = await launch();
let pass = 0, fail = 0;
const ok = (cond, label) => {
  console.log(`${cond ? '  ✓' : '  ✗ FAIL'} ${label}`);
  cond ? pass++ : fail++;
};
const waitRows = (n) => page.waitForFunction(
  (want) => document.querySelectorAll('.fs-nav-item.scene').length === want, n, { timeout: 6000 });

try {
  await boot(page);
  await seedScript(page, SCENES_4);
  await openTool(page, 'Navigator');
  await waitRows(4);
  await page.evaluate(() => {
    window.__scStore.getState().addMarkup({
      id: 'chk-570', content: null, icon: 'flag', color: '#e5484d',
      highlight: null, anchor: 'point', done: false, createdAt: new Date().toISOString(),
    });
  });

  // ── 1. the labels say "types" ──
  await page.click('.markup-ctl-filter');
  await page.waitForSelector('.markup-filter-allrow', { timeout: 5000 });
  const allLabels = await page.$$eval('.markup-filter-allrow .markup-hl-clear', (els) => els.map((e) => e.textContent));
  ok(allLabels.join('|') === 'Show all types|Hide all types',
    `the pair reads Show/Hide all TYPES (${allLabels.join(' / ')})`);

  // ── 2. dirty every control, then Reset ──
  await page.click('.markup-filter-pop .fs-nav-filter-title + .markup-filter-statusrow .markup-seg button:has-text("EXT.")');
  await page.selectOption('.fs-nav-scnf-select', 'SPACE - BELKADAN');
  await page.fill('.fs-nav-scnf-input', 'belka');
  // annotation half: status → All (the Status row is found by its label —
  // the INT./EXT. row wears the same segment classes), hide the flag type
  await page.$$eval('.markup-filter-pop .markup-filter-statusrow', (rows) => {
    const status = rows.find((r) => r.textContent?.includes('Status'));
    const btn = Array.from(status?.querySelectorAll('button') ?? []).find((b) => b.textContent === 'All');
    btn?.click();
  });
  await page.click('.markup-filter-typerow .markup-preset');   // hide the flag type
  await waitRows(1);
  const chipBefore = await page.$eval('.markup-ctl-filter .tool-ctl-chip', (e) => e.textContent).catch(() => null);
  ok(Number(chipBefore) >= 4, `every control dirty — chip counts ${chipBefore}`);

  await page.click('.fs-nav-filter-reset');
  await waitRows(4);
  ok(true, 'Reset restores all 4 scene rows');
  const state = await page.evaluate(() => {
    const s = window.__scStore.getState();
    return { scnf: s.navSceneFilters, mk: s.markupFilters };
  });
  ok(state.scnf.intExt === 'all' && state.scnf.location === '' && state.scnf.contains === ''
    && state.mk.done === 'open' && state.mk.hiddenIcons.length === 0,
    'store back to the defaults (scene + annotation filters alike)');
  const controls = await page.evaluate(() => {
    const pop = document.querySelector('.markup-filter-pop');
    const segs = Array.from(pop.querySelectorAll('.markup-filter-statusrow'));
    const activeOf = (row) => row?.querySelector('.markup-seg button.active')?.textContent;
    const intExtRow = segs.find((r) => r.textContent?.includes('INT. / EXT.'));
    const statusRow = segs.find((r) => r.textContent?.includes('Status'));
    return {
      intExt: activeOf(intExtRow),
      status: activeOf(statusRow),
      loc: pop.querySelector('.fs-nav-scnf-select')?.value,
      contains: pop.querySelector('.fs-nav-scnf-input')?.value,
      typeActive: !!pop.querySelector('.markup-filter-typerow .markup-preset.active'),
    };
  });
  ok(controls.intExt === 'All' && controls.status === 'Open' && controls.loc === ''
    && controls.contains === '' && controls.typeActive,
    `the visible controls show defaults again (${controls.intExt}/${controls.status}/type shown)`);
  ok(!(await page.$('.markup-ctl-filter .tool-ctl-chip')), 'the chip is gone after Reset');
  await page.keyboard.press('Escape');

  // ── 3. the shared section carries the labels in the Annotations window too ──
  await openTool(page, 'Annotations');
  const btns = await page.$$('.markup-ctl-filter');
  await btns[btns.length - 1].click();
  await page.waitForSelector('.markup-filter-allrow', { timeout: 5000 });
  const annoLabels = await page.$$eval('.markup-filter-allrow .markup-hl-clear', (els) => els.map((e) => e.textContent));
  ok(annoLabels.join('|') === 'Show all types|Hide all types',
    'the Annotations window shows the same clarified labels');
  ok(!(await page.$('.markup-filter-pop .fs-nav-filter-reset')),
    'Reset stays a Navigator-menu action (not added elsewhere unasked)');
} catch (e) {
  console.log('  ✗ SCRIPT ERROR:', e.message);
  fail++;
} finally {
  await browser.close();
}
console.log(`\ncheck-v570: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
