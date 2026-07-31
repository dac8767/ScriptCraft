// check-v569 — the annotation type grid rides one row with a "Type:" label,
// matching the window's label-then-content format. Verified in BOTH doors of
// the shared TypeGridSection: the Navigator filter pop and the Annotations
// window's filter pop. Empty state sits inline on the row too.
import { launch, boot, seedScript, openTool, SCENES_4 } from './driver.mjs';

const { browser, page } = await launch();
let pass = 0, fail = 0;
const ok = (cond, label) => {
  console.log(`${cond ? '  ✓' : '  ✗ FAIL'} ${label}`);
  cond ? pass++ : fail++;
};

async function assertTypeRow(where) {
  await page.waitForSelector('.markup-filter-typerow', { timeout: 5000 });
  const label = await page.$eval('.markup-filter-typerow .markup-filter-help', (e) => e.textContent?.trim());
  ok(label === 'Type:', `${where}: the label reads "Type:" (${label})`);
  ok(!(await page.$('.markup-filter-pop >> text=Annotation Types')), `${where}: the old caption is gone`);
  // same-row proof: the label and the first button share a horizontal band
  const row = await page.$eval('.markup-filter-typerow', (e) => {
    const help = e.querySelector('.markup-filter-help');
    const btn = e.querySelector('.markup-preset');
    const empty = e.querySelector('.markup-filter-empty');
    const a = help.getBoundingClientRect();
    const b = (btn ?? empty).getBoundingClientRect();
    return { kind: btn ? 'buttons' : 'empty', overlap: Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top), after: b.left > a.right - 2 };
  });
  ok(row.overlap > 0 && row.after,
    `${where}: the ${row.kind} sit AFTER the label on the same row (overlap ${Math.round(row.overlap)}px)`);
}

try {
  await boot(page);
  await seedScript(page, SCENES_4);
  await openTool(page, 'Navigator');

  // empty state first — inline on the row
  await page.click('.markup-ctl-filter');
  await assertTypeRow('Navigator (no annotations)');

  // seed one annotation so a type button renders
  await page.evaluate(() => {
    window.__scStore.getState().addMarkup({
      id: 'chk-569', content: null, icon: 'flag', color: '#e5484d',
      highlight: null, anchor: 'point', done: false, createdAt: new Date().toISOString(),
    });
  });
  await page.waitForSelector('.markup-filter-typerow .markup-preset', { timeout: 5000 });
  await assertTypeRow('Navigator (with a type)');
  await page.keyboard.press('Escape');

  // the second door: the Annotations window's own Filter pop
  await openTool(page, 'Annotations');
  const filterBtns = await page.$$('.markup-ctl-filter');
  await filterBtns[filterBtns.length - 1].click();   // the Annotations window's (navigator's came first)
  await assertTypeRow('Annotations window');
} catch (e) {
  console.log('  ✗ SCRIPT ERROR:', e.message);
  fail++;
} finally {
  await browser.close();
}
console.log(`\ncheck-v569: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
