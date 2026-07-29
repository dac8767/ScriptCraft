// devtools/check-v524.mjs — Derek's batch:
//  1. "# of Columns:" + masonry (no row alignment — verified via columnCount)
//  2. CARD DRAG WORKS — the v5.22 regression: the grip passed a bare closure
//     and nobody called dataTransfer.setData (the WebKit footgun). The grip
//     sets its own payload now; a real drag must reorder the array.
//  3+4. new Design tokens drive computed styles (window + card spot checks)
//  5. non-active header tabs wear a visible button wash (all tab windows)
import { launch, boot, seedScript, SCENES_4, shot } from './driver.mjs';

const results = [];
const check = (n, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  results.push(ok);
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${n.padEnd(56)} got ${JSON.stringify(got)}${ok ? '' : `  want ${JSON.stringify(want)}`}`);
};

const { browser, page } = await launch({ width: 1500, height: 950 });
await boot(page);
await seedScript(page, SCENES_4);
await page.evaluate(() => {
  window.__scStore.getState().setShelfCards([
    { id: 'a', type: 'comment', color: '#fff8b8', text: 'alpha', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'b', type: 'comment', color: '#fff8b8', text: 'beta', createdAt: '2026-01-02T00:00:00Z' },
    { id: 'c', type: 'todo', color: '#fff8b8', items: [{ text: 'gamma item', done: false }], createdAt: '2026-01-03T00:00:00Z' },
  ]);
});
await page.evaluate(() => window.__scStore.getState().enterToolFullscreen('sticky'));
await page.waitForSelector('.fs-tool-takeover-sticky .swn-card');

// ── 5. tabs read as buttons ─────────────────────────────────────────────────
const tab = await page.evaluate(() => {
  const inactive = [...document.querySelectorAll('.fs-tool-takeover-sticky .tool-chrome-tabs:not(.tool-chrome-tabs-measure) .tool-chrome-tab')]
    .find((t) => !t.classList.contains('active'));
  return getComputedStyle(inactive).backgroundColor;
});
check('non-active tabs wear a visible wash', tab !== 'rgba(0, 0, 0, 0)' && tab !== 'transparent', true);

// ── 1. masonry columns ──────────────────────────────────────────────────────
await page.click('.fs-tool-takeover-sticky button[title="More columns (smaller cards)"]');
const masonry = await page.$eval('.fs-tool-takeover-sticky .swn-scroll', (el) => ({
  cols: getComputedStyle(el).columnCount,
  grid: getComputedStyle(el).display,
}));
check('2 columns of masonry (multicol, not grid)', masonry, { cols: '2', grid: 'block' });

// ── 2. THE DRAG FIX — drag card "a"'s grip onto card "c" ────────────────────
const orderBefore = await page.evaluate(() => window.__scStore.getState().shelfCards.map((c) => c.id));
check('array starts a,b,c', orderBefore, ['a', 'b', 'c']);
// Dispatch the DnD sequence directly: pointer-driven dnd stalls under
// Playwright here because dragstart INSERTS the drop zones (the target
// moves mid-gesture and the driver never settles). Dispatching exercises
// the same React handlers — and lets us read the payload the grip set,
// which IS the WebKit fix under test.
const payload = await page.evaluate(() => {
  const grip = document.querySelector('.fs-tool-takeover-sticky .swn-card .swn-drag-grip');   // first card ('a')
  const dt = new DataTransfer();
  window.__dndDt = dt;
  grip.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
  return dt.getData('text/plain');
});
check('the grip sets its own drag payload (the WebKit fix)', payload, 'a');
// let React commit dragId (real drags have frames between start and drop)
await page.waitForTimeout(120);
await page.evaluate(() => {
  const dt = window.__dndDt;
  const takeover = document.querySelector('.fs-tool-takeover-sticky');
  const target = [...takeover.querySelectorAll('.swn-card')].find((c) => c.textContent.includes('gamma'));
  target.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: dt }));
  target.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt }));
  takeover.querySelector('.swn-drag-grip')?.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
});
const afterDrag = await page.evaluate(() => ({
  order: window.__scStore.getState().shelfCards.map((c) => c.id),
  sort: window.__scStore.getState().stickySort,
}));
check('dropping on a card inserts before it', afterDrag.order, ['b', 'a', 'c']);
check('…and snaps Sort to Manual', afterDrag.sort, 'manual');

// ── 3+4. Design tokens drive computed styles ────────────────────────────────
await page.evaluate(() => {
  const st = window.__scStore.getState();
  st.setDesignVar('stickyPadX', 24);
  st.setDesignVar('stickyRowGap', 3);
  st.setDesignVar('cardPadX', 17);
  st.setDesignVar('cardActionsGap', 11);
});
await page.waitForTimeout(200);
const tokens = await page.evaluate(() => {
  const scroll = document.querySelector('.fs-tool-takeover-sticky .swn-scroll');
  const card = document.querySelector('.fs-tool-takeover-sticky .swn-card');
  return {
    scrollPadX: getComputedStyle(scroll).paddingLeft,
    cardMb: getComputedStyle(card).marginBottom,
    cardPadX: getComputedStyle(card).paddingLeft,
    actionsGap: getComputedStyle(card.querySelector('.swn-card-actions')).gap,
  };
});
check('window side padding knob applies', tokens.scrollPadX, '24px');
check('row gap knob applies (card bottom margin)', tokens.cardMb, '3px');
check('card side padding knob applies', tokens.cardPadX, '17px');
check('card button spacing knob applies', tokens.actionsGap, '11px');
await page.evaluate(() => {
  const st = window.__scStore.getState();
  ['stickyPadX', 'stickyRowGap', 'cardPadX', 'cardActionsGap'].forEach((id) => st.resetDesignVar(id));
});

await shot(page, '.fs-tool-takeover-sticky', new URL('./last-sticky-v524.png', import.meta.url).pathname, 620);
await browser.close();
console.log(results.every(Boolean) ? 'ALL OK' : 'FAILURES');
process.exit(results.every(Boolean) ? 0 : 1);
