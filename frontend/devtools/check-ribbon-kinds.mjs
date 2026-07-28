// devtools/check-ribbon-kinds.mjs — v5.14: mixed titled/untitled ribbon.
// Untitled two-row sections auto-stretch to a titled section's total height:
// bases level, untitled button tops level with the titled TITLE's top. The
// Design knobs then scale each kind separately.
import { chromium } from 'playwright-core';

const results = [];
const check = (n, got, want) => {
  const ok = typeof want === 'number' && typeof got === 'number' ? Math.abs(got - want) <= 1.5 : got === want;
  results.push(ok);
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${n.padEnd(40)} got ${JSON.stringify(got)}${ok ? '' : `  want ${JSON.stringify(want)}`}`);
};

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
// Seed BEFORE any app code runs (addInitScript). Seeding after a first goto
// races the live app's own autosaves — they clobbered the seed both ways
// (once via a legacy migration, once with plain defaults) until this.
await page.addInitScript(() => {
  if (localStorage.getItem('__rib_seeded')) return;
  localStorage.clear();
  localStorage.setItem('__rib_seeded', '1');
  localStorage.setItem('opendraft:viewState', JSON.stringify({
    toolbarLeft: [
      'b:bold', 'b:italic', 'b:underline', 'r:t1', 'b:alignLeft', 'b:alignCenter', 'b:alignRight',
      '2!d:d1',
      'st:Go', 'b:find', 'b:goto', 'r:t2', 'b:undo', 'b:redo',
      '2!d:d2',
      'b:copy',
      'a:sp', 'b:customize',
    ],
    toolbarZonesSet: true,
  }));
  // EVERY one-time toolbar migration flag, or one of them rewrites the seed.
  for (const f of ['BigZone202', 'SepDividers214', 'SurfaceToggles234', 'LockResize255',
                   'ResetSizes267', 'TwoRows294', 'Ribbon295', 'RibbonSections296',
                   'CustomizeItem302', 'DropPanelToggles325']) {
    localStorage.setItem(`opendraft:toolbar${f}`, '1');
  }
});
await page.goto('http://localhost:5199/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.ProseMirror', { timeout: 25000 });
for (let i = 0; i < 5; i++) { if (!(await page.$('.dialog-overlay'))) break; await page.keyboard.press('Escape'); await page.waitForTimeout(150); }
await page.waitForSelector('.toolbar-ribbon .rib-kind-untitled', { timeout: 8000 });

const read = () => page.evaluate(() => {
  const un = document.querySelector('.rib-kind-untitled');
  const ti = document.querySelector('.rib-kind-titled');
  const R = (el) => { const b = el.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, h: b.height }; };
  const unRows = [...un.querySelectorAll('.rib-row')];
  const tiTitle = ti.querySelector('.rib-sec-title');
  const tiRows = [...ti.querySelectorAll('.rib-row')];
  const unBtn = un.querySelector('.toolbar-btn');
  const tiBtn = ti.querySelector('.toolbar-btn');
  return {
    unFirstRowTop: R(unRows[0]).top,
    unLastRowBottom: R(unRows[unRows.length - 1]).bottom,
    tiTitleTop: R(tiTitle).top,
    tiLastRowBottom: R(tiRows[tiRows.length - 1]).bottom,
    unBandHidden: !un.querySelector('.rib-sec-title-empty') || getComputedStyle(un.querySelector('.rib-sec-title-empty')).display === 'none',
    unBtnH: R(unBtn).h, tiBtnH: R(tiBtn).h,
    unRowH: R(unRows[0]).h, tiRowH: R(tiRows[0]).h,
  };
});

await page.screenshot({ path: new URL('./last-ribbon-kinds.png', import.meta.url).pathname, clip: { x: 0, y: 0, width: 900, height: 140 } });
let r = await read();
console.log(`     untitled rows ${r.unFirstRowTop.toFixed(1)}→${r.unLastRowBottom.toFixed(1)}  titled ${r.tiTitleTop.toFixed(1)}→${r.tiLastRowBottom.toFixed(1)}  btnH ${r.unBtnH}/${r.tiBtnH}`);
check('untitled reserved band is gone', r.unBandHidden, true);
check('untitled TOP = titled TITLE top', r.unFirstRowTop, r.tiTitleTop);
check('bases level', r.unLastRowBottom, r.tiLastRowBottom);
check('untitled rows are TALLER (auto-fill)', r.unRowH > r.tiRowH, true);
check('untitled buttons grew with their rows', r.unBtnH > r.tiBtnH, true);

// ── the Design knobs scale each kind separately ──
await page.$eval('.tool-dock-item', () => {});   // app idle tick
const openDesign = async () => {
  const rows = await page.$$('.tool-dock-item');
  for (const row of rows) { if (((await row.textContent()) || '').includes('Design')) { await row.click(); break; } }
  await page.waitForSelector('.dz-group', { timeout: 8000 });
};
await openDesign();
// v5.15: knobs live in per-kind GROUPS and share labels ("Section scale (%)"
// in both Titled and Untitled) — so scope to the group, then the row.
const openGroup = async (groupLabel) => {
  // idempotent — the head TOGGLES, and a second visit was collapsing it
  const group = page.locator('.dz-group', { hasText: groupLabel }).first();
  if (await group.locator('.dz-row').count() > 0) return;
  await group.locator('.dz-group-head').first().click();
  await page.waitForTimeout(250);
};
const setKnob = async (groupLabel, rowLabel, value) => {
  const num = page.locator('.dz-group', { hasText: groupLabel })
    .locator('.dz-row', { hasText: rowLabel }).locator('.dz-num').first();
  await num.click({ clickCount: 3 });
  await page.keyboard.type(String(value));
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
};
await openGroup('Ribbon: Untitled Sections');
await setKnob('Ribbon: Untitled Sections', 'Section scale', 80);
let r2 = await read();
check('untitled scale 80% shrinks its rows', r2.unRowH < r.unRowH, true);
check('titled rows untouched by the untitled knob', r2.tiRowH, r.tiRowH);
await setKnob('Ribbon: Untitled Sections', 'Section scale', 100);
await openGroup('Ribbon: Titled Sections');
await setKnob('Ribbon: Titled Sections', 'Section scale', 150);
let r3 = await read();
check('titled scale 150% grows titled rows', r3.tiRowH > r.tiRowH, true);
check('untitled back at auto-fill, unaffected', r3.unRowH, r.unRowH);
await setKnob('Ribbon: Titled Sections', 'Section scale', 100);

// one knob per category proves each group's wiring end-to-end
await setKnob('Ribbon: Titled Sections', 'Side padding', 12);
check('titled side padding applies',
  await page.$eval('.rib-kind-titled:not(.rib-single)', (el) => getComputedStyle(el).paddingLeft), '12px');
await setKnob('Ribbon: Titled Sections', 'Horizontal button spacing', 7);
check('titled button spacing applies',
  await page.$eval('.rib-kind-titled:not(.rib-single) .rib-row', (el) => getComputedStyle(el).columnGap), '7px');
await openGroup('Ribbon: Untitled Sections');
await setKnob('Ribbon: Untitled Sections', 'Row spacing', 9);
check('untitled row spacing applies (and only there)',
  await page.$eval('.rib-kind-untitled:not(.rib-single) .rib-row + .rib-row, .rib-kind-untitled:not(.rib-single) .rib-row-line + .rib-row', (el) => getComputedStyle(el).marginTop), '9px');
check('titled row spacing still 0',
  await page.$eval('.rib-kind-titled:not(.rib-single) .rib-row + .rib-row, .rib-kind-titled:not(.rib-single) .rib-row-line + .rib-row', (el) => getComputedStyle(el).marginTop), '0px');
await openGroup('Ribbon: Single-Row Sections');
await setKnob('Ribbon: Single-Row Sections', 'Top padding', 6);
check('single-row top padding applies',
  await page.$eval('.rib-single', (el) => getComputedStyle(el).paddingTop), '6px');
await setKnob('Ribbon: Single-Row Sections', 'Icon size', 32);
check('single-row icon size applies',
  await page.$eval('.rib-single .toolbar-btn svg, .rib-tall-icon svg', (el) => getComputedStyle(el).height), '32px');

await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
