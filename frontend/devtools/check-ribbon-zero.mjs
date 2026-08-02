import { settle } from './driver.mjs';
// devtools/check-ribbon-zero.mjs — v5.16, Derek: "make sure that 0 is
// actually 0 for all options." Seeds every ribbon spacing knob at zero and
// asserts the computed layout carries ZERO of each — no hidden +3s, no hard
// 2px insets, bar height exactly the content height.
import { chromium } from 'playwright-core';

const results = [];
const check = (n, got, want) => {
  const ok = got === want;
  results.push(ok);
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${n.padEnd(42)} got ${JSON.stringify(got)}${ok ? '' : `  want ${JSON.stringify(want)}`}`);
};

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
await page.addInitScript(() => {
  if (localStorage.getItem('__ribzero_seeded')) return;
  localStorage.clear();
  localStorage.setItem('__ribzero_seeded', '1');
  localStorage.setItem('opendraft:viewState', JSON.stringify({
    toolbarLeft: [
      'b:bold', 'b:italic', 'r:t1', 'b:alignLeft', 'b:alignCenter',
      '2!d:d1',
      'st:Go', 'b:find', 'b:goto', 'r:t2', 'b:undo', 'b:redo',
      '2!d:d2',
      'b:copy',
      'a:sp', 'b:customize',
    ],
    toolbarZonesSet: true,
    chromeGapPx: { toolbar: 0 },
    designVars: {
      ribPadTop: 0, ribPadBottom: 0, ribPadLeft: 0, ribPadRight: 0,
      ribPadXTitled: 0, ribPadTopTitled: 0, ribPadBottomTitled: 0,
      ribRowGapTitled: 0, ribBtnGapTopTitled: 0, ribBtnGapBottomTitled: 0, ribTitleGap: 0,
      ribPadXUntitled: 0, ribPadTopUntitled: 0, ribPadBottomUntitled: 0,
      ribRowGapUntitled: 0, ribBtnGapTopUntitled: 0, ribBtnGapBottomUntitled: 0,
      ribPadXSingle: 0, ribPadTopSingle: 0, ribPadBottomSingle: 0,
    },
  }));
  for (const f of ['BigZone202', 'SepDividers214', 'SurfaceToggles234', 'LockResize255',
                   'ResetSizes267', 'TwoRows294', 'Ribbon295', 'RibbonSections296',
                   'CustomizeItem302', 'DropPanelToggles325']) {
    localStorage.setItem(`opendraft:toolbar${f}`, '1');
  }
});
await page.goto('http://localhost:5199/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.ProseMirror', { timeout: 25000 });
for (let i = 0; i < 5; i++) { if (!(await page.$('.dialog-overlay'))) break; await page.keyboard.press('Escape'); await settle(page); }
await page.waitForSelector('.toolbar-ribbon .rib-kind-titled', { timeout: 8000 });

const r = await page.evaluate(() => {
  const bar = document.querySelector('.toolbar-ribbon');
  const cs = getComputedStyle(bar);
  const ti = document.querySelector('.rib-kind-titled:not(.rib-single)');
  const un = document.querySelector('.rib-kind-untitled:not(.rib-single)');
  const single = document.querySelector('.rib-single');
  const P = (el) => { const c = getComputedStyle(el); return `${c.paddingTop} ${c.paddingRight} ${c.paddingBottom} ${c.paddingLeft}`; };
  const tiRows = [...ti.querySelectorAll('.rib-row')];
  const unRows = [...un.querySelectorAll('.rib-row')];
  const secs = [ti, un, single].map((s) => s.getBoundingClientRect());
  const seps = [...bar.querySelectorAll('.rib-section-sep')].map((s) => s.getBoundingClientRect());
  // v5.18: button spacing is a margin now (so it can go negative), so the
  // honest measure is box-edge to box-edge of a row's first adjacent pair.
  const pairGap = (row) => {
    const els = [...row.children].filter((c) => !c.classList.contains('rib-row-line'));
    if (els.length < 2) return null;
    const a = els[0].getBoundingClientRect(), b = els[1].getBoundingClientRect();
    return Math.round((b.left - a.right) * 10) / 10;
  };
  return {
    tiTopPair: pairGap(tiRows[0]), tiBotPair: pairGap(tiRows[1]),
    unTopPair: pairGap(unRows[0]), unBotPair: pairGap(unRows[1]),
    barGap: cs.columnGap || cs.gap,
    barPadTop: cs.paddingTop, barPadBottom: cs.paddingBottom,
    barPadLeft: cs.paddingLeft, barPadRight: cs.paddingRight,
    barH: bar.getBoundingClientRect().height,
    contentH: parseFloat(cs.getPropertyValue('--rib-content-h')),
    tiPad: P(ti), unPad: P(un), singlePad: P(single),
    tiRow2Mt: getComputedStyle(tiRows[1]).marginTop,
    unRow2Mt: getComputedStyle(unRows[1]).marginTop,
    titleMt: getComputedStyle(ti.querySelector('.rib-sec-title + .rib-row')).marginTop,
    titlePad: P(ti.querySelector('.rib-sec-title')),
    // horizontal truth: the seed order is [untitled] d1 [titled] d2 [single],
    // so untitled meets d1's LEFT edge and titled meets its RIGHT edge.
    sepToUntitled: Math.round((seps[0].left - secs[1].right) * 10) / 10,
    sepToTitled: Math.round((secs[0].left - seps[0].right) * 10) / 10,
  };
});

check('bar gap 0', r.barGap, '0px');
check('bar top padding 0', r.barPadTop, '0px');
check('bar bottom padding 0', r.barPadBottom, '0px');
check('bar LEFT padding 0 (beats auto-align)', r.barPadLeft, '0px');
check('bar RIGHT padding 0', r.barPadRight, '0px');
check('bar height == content height exactly', r.barH, r.contentH);
check('titled section padding all-zero', r.tiPad, '0px 0px 0px 0px');
check('untitled section padding all-zero', r.unPad, '0px 0px 0px 0px');
check('single-row section padding all-zero', r.singlePad, '0px 0px 0px 0px');
check('titled TOP-row button boxes touch', r.tiTopPair, 0);
check('titled BOTTOM-row button boxes touch', r.tiBotPair, 0);
check('untitled TOP-row button boxes touch', r.unTopPair, 0);
check('untitled BOTTOM-row button boxes touch', r.unBotPair, 0);
check('titled row spacing 0', r.tiRow2Mt, '0px');
check('untitled row spacing 0', r.unRow2Mt, '0px');
check('title-to-buttons space 0', r.titleMt, '0px');
check('title band own padding all-zero', r.titlePad, '0px 0px 0px 0px');
check('titled section touches its divider', Math.abs(r.sepToTitled) <= 0.5, true);
check('untitled side of the divider touches too', Math.abs(r.sepToUntitled) <= 0.5, true);

await page.screenshot({ path: new URL('./last-ribbon-zero.png', import.meta.url).pathname, clip: { x: 0, y: 0, width: 900, height: 120 } });
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
