// devtools/check-sticky-v522.mjs — Derek's Sticky Notes refinement:
//  1. ONE interleaved list — Type sort default (notes before checklists),
//     Date Created interleaves both kinds newest-first
//  2. blue add buttons (computed equal to a dialog-primary probe)
//  3. "+ Add Note" / "+ Add Checklist" wording (checked in v521 driver too)
//  4. Checklists wording on the tabs
//  5. the blank check row adds items (no dashed .swn-todo-new field)
//  6. All · Notes · Checklists tabs — click narrows, DRAG reorders, order
//     persists and its [0] seeds the view the tool opens on
import { launch, boot, seedScript, openTool, shot, SCENES_4 } from './driver.mjs';

const results = [];
const check = (n, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  results.push(ok);
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${n.padEnd(52)} got ${JSON.stringify(got)}${ok ? '' : `  want ${JSON.stringify(want)}`}`);
};

const { browser, page } = await launch({ width: 1500, height: 950 });
await boot(page);
await seedScript(page, SCENES_4);

// Seed three cards with known dates: checklist newest-middle.
await page.evaluate(() => {
  window.__scStore.getState().setShelfCards([
    { id: 't1', type: 'todo', color: '#fff8b8', items: [{ text: 'email agent', done: false }], createdAt: '2026-01-02T00:00:00Z' },
    { id: 'n1', type: 'comment', color: '#fff8b8', text: 'find the harbor scene', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'n2', type: 'comment', color: '#fff8b8', text: 'act two sag', createdAt: '2026-01-03T00:00:00Z' },
  ]);
});

// Fullscreen: the header is wide, so the tab STRIP renders (docked panels
// may collapse it into the Section dropdown — that mode is not under test).
await page.evaluate(() => window.__scStore.getState().enterToolFullscreen('sticky'));
await page.waitForSelector('.fs-tool-takeover-sticky .swn-card');

const cardOrder = () => page.evaluate(() =>
  [...document.querySelectorAll('.fs-tool-takeover-sticky .swn-card')]
    .map((c) => c.textContent.includes('email agent') ? 'todo'
      : c.textContent.includes('harbor') ? 'n1' : 'n2'));

// ── 1. sorts ────────────────────────────────────────────────────────────────
check('Type sort default: notes first, array order', await cardOrder(), ['n1', 'n2', 'todo']);
await page.click('.fs-tool-takeover-sticky .tool-ctl:has-text("Sort")');
await page.click('.tool-ctl-menu-item:has-text("Date Created")');
check('Date Created interleaves both kinds newest-first', await cardOrder(), ['n2', 'todo', 'n1']);
await page.click('.fs-tool-takeover-sticky .tool-ctl:has-text("Sort")');
await page.click('.tool-ctl-menu-item:has-text("Type")');

// ── 2. blue buttons — computed equality against a dialog-primary probe ──────
const blue = await page.evaluate(() => {
  const btn = document.querySelector('.fs-tool-takeover-sticky .sticky-add-btn');
  const probe = document.createElement('button');
  probe.className = 'dialog-btn dialog-btn-primary';
  document.body.appendChild(probe);
  const a = getComputedStyle(btn), b = getComputedStyle(probe);
  const diff = ['backgroundColor', 'color', 'height', 'borderRadius'].filter((p) => a[p] !== b[p]);
  probe.remove();
  return diff;
});
check('add buttons wear the dialog-primary format', blue, []);

// ── 4+6. tabs: wording, click narrows, drag reorders, persistence ───────────
const tabLabels = () => page.evaluate(() =>
  [...document.querySelectorAll('.fs-tool-takeover-sticky .tool-chrome-tabs:not(.tool-chrome-tabs-measure) .tool-chrome-tab')]
    .map((t) => t.textContent));
check('tabs read All · Notes · Checklists', await tabLabels(), ['All', 'Notes', 'Checklists']);

await page.click('.fs-tool-takeover-sticky .tool-chrome-tab:has-text("Checklists")');
check('the Checklists tab narrows the list', await cardOrder(), ['todo']);
await page.click('.fs-tool-takeover-sticky .tool-chrome-tab:has-text("All")');

await page.dragAndDrop(
  '.fs-tool-takeover-sticky .tool-chrome-tabs:not(.tool-chrome-tabs-measure) .tool-chrome-tab:has-text("Checklists")',
  '.fs-tool-takeover-sticky .tool-chrome-tabs:not(.tool-chrome-tabs-measure) .tool-chrome-tab:has-text("All")',
);
check('dragging a tab reorders the strip', await tabLabels(), ['Checklists', 'All', 'Notes']);
const persisted = await page.evaluate(() => ({
  store: window.__scStore.getState().stickyTabOrder,
  vs: JSON.parse(localStorage.getItem('opendraft:viewState') ?? '{}').stickyTabOrder,
}));
check('the order persists (store + viewState)', persisted, { store: ['todo', 'all', 'note'], vs: ['todo', 'all', 'note'] });

// ── 5. the blank check row ──────────────────────────────────────────────────
const blank = await page.evaluate(() => ({
  blankRow: !!document.querySelector('.fs-tool-takeover-sticky .swn-todo-blank'),
  dashedField: !!document.querySelector('.fs-tool-takeover-sticky .swn-todo-new'),
}));
check('checklist card ends in a blank check row', blank, { blankRow: true, dashedField: false });
await page.fill('.fs-tool-takeover-sticky .swn-todo-blank-input', 'call the studio');
await page.keyboard.press('Enter');
const afterAdd = await page.evaluate(() => ({
  items: window.__scStore.getState().shelfCards.find((c) => c.id === 't1').items.map((i) => i.text),
  inputCleared: document.querySelector('.fs-tool-takeover-sticky .swn-todo-blank-input').value,
}));
check('typing + Enter commits the item and blanks the row', afterAdd, { items: ['email agent', 'call the studio'], inputCleared: '' });

await shot(page, '.fs-tool-takeover-sticky', new URL('./last-sticky-v522.png', import.meta.url).pathname, 620);
await browser.close();
console.log(results.every(Boolean) ? 'ALL OK' : 'FAILURES');
process.exit(results.every(Boolean) ? 0 : 1);
