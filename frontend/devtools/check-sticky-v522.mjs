// devtools/check-sticky-v522.mjs — Derek's Sticky Notes refinement:
//  1. ONE interleaved list — Manual sort default (the array order),
//     Date Created interleaves legacy kinds newest-first
//  2. blue add buttons (computed equal to a dialog-primary probe)
//  3. one "+ Add Note" button
//  4. no kind tabs
//  5. legacy checklists render as rich checklist notes and can add items
//  6. v5.36 removed the kind tabs when checklists became note content
import { launch, boot, seedScript, shot, SCENES_4, settle } from './driver.mjs';

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
check('Manual sort default: array order', await cardOrder(), ['todo', 'n1', 'n2']   /* v5.36: Type sort gone; this is Manual/array order */);
await page.click('.fs-tool-takeover-sticky .tool-ctl:has-text("Sort")');
await page.click('.tool-ctl-menu-item:has-text("Date Created")');
check('Date Created interleaves both kinds newest-first', await cardOrder(), ['n2', 'todo', 'n1']);
await page.click('.fs-tool-takeover-sticky .tool-ctl:has-text("Sort")');
const sortItems = await page.evaluate(() =>
  [...document.querySelectorAll('.tool-ctl-menu .tool-ctl-menu-item')].map((i) => i.textContent));
check('Sort offers Manual · Date Created (no Type)', sortItems, ['Manual', 'Date Created'] /* v5.36: the Type sort was removed */);
await page.click('.tool-ctl-menu-item:has-text("Manual")');
check('Manual restores the array order', await cardOrder(), ['todo', 'n1', 'n2']);

// ── 2. blue buttons — computed equality against a dialog-primary probe ──────
const blue = await page.evaluate(() => {
  const btn = document.querySelector('.fs-tool-takeover-sticky .sticky-add-btn');
  const probe = document.createElement('button');
  probe.className = 'dialog-btn dialog-btn-primary';
  document.body.appendChild(probe);
  const a = getComputedStyle(btn), b = getComputedStyle(probe);
  // v5.23: the buttons are deliberately COMPACT (26px) — the dialog-primary
  // COLORS and radius still must match the probe exactly.
  const diff = ['backgroundColor', 'color', 'borderRadius'].filter((p) => a[p] !== b[p]);
  probe.remove();
  return diff;
});
check('add buttons wear the dialog-primary colors', blue, []);

// ── 4+6. tabs: v5.36 retired note/checklist kinds ─────────────────────────
const chrome = await page.evaluate(() => ({
  buttons: [...document.querySelectorAll('.fs-tool-takeover-sticky .tool-action-row button.sticky-add-btn')].map((b) => b.textContent),
  tabs: [...document.querySelectorAll('.fs-tool-takeover-sticky .tool-chrome-tabs:not(.tool-chrome-tabs-measure) .tool-chrome-tab')].map((t) => t.textContent),
}));
check('v5.36 Notes has one add button and no kind tabs', chrome, { buttons: ['+ Add Note'], tabs: [] });
/* v5.36: the Notes/Checklists tab strip, tab narrowing, tab drag order, and
   stickyTabOrder persistence were removed with the separate checklist kind. */

// ── 5. the legacy checklist is rich note content now ───────────────────────
const migrated = await page.evaluate(() => {
  const card = [...document.querySelectorAll('.fs-tool-takeover-sticky .swn-card')]
    .find((c) => c.textContent.includes('email agent'));
  return {
    blankRow: !!card?.querySelector('.swn-todo-blank'),
    dashedField: !!card?.querySelector('.swn-todo-new'),
    richEditor: !!card?.querySelector('.swn-note-editor .ProseMirror'),
    checks: card?.querySelectorAll('.swn-note-editor input[type="checkbox"]').length ?? 0,
  };
});
check('legacy checklist renders as a rich checklist note', migrated, { blankRow: false, dashedField: false, richEditor: true, checks: 1 } /* v5.36: blank checklist rows were removed */);
const checklistEnd = await page.evaluate(() => {
  const pm = [...document.querySelectorAll('.fs-tool-takeover-sticky .swn-card')]
    .find((c) => c.textContent.includes('email agent'))
    ?.querySelector('.swn-note-editor .ProseMirror');
  const walker = document.createTreeWalker(pm, NodeFilter.SHOW_TEXT);
  let node = null;
  while ((node = walker.nextNode())) {
    if (node.nodeValue?.includes('email agent')) {
      const r = document.createRange();
      r.setStart(node, Math.max(0, node.nodeValue.length - 1));
      r.setEnd(node, node.nodeValue.length);
      const box = r.getBoundingClientRect();
      return { x: box.right + 2, y: box.top + box.height / 2 };
    }
  }
  return null;
});
await page.mouse.click(checklistEnd.x, checklistEnd.y);
for (let i = 0; i < 20; i++) await page.keyboard.press('ArrowRight');
await page.keyboard.press('Enter');
await page.keyboard.type('call the studio');
await settle(page);
const afterAdd = await page.evaluate(() => ({
  items: window.__scStore.getState().shelfCards.find((c) => c.id === 't1').text.split(/\n+/).filter(Boolean),
  checks: [...document.querySelectorAll('.fs-tool-takeover-sticky .swn-card')]
    .find((c) => c.textContent.includes('email agent'))
    ?.querySelectorAll('.swn-note-editor input[type="checkbox"]').length ?? 0,
}));
check('Enter in the rich checklist adds another item', afterAdd, { items: ['email agent', 'call the studio'], checks: 2 });

await shot(page, '.fs-tool-takeover-sticky', new URL('./last-sticky-v522.png', import.meta.url).pathname, 620);
await browser.close();
console.log(results.every(Boolean) ? 'ALL OK' : 'FAILURES');
process.exit(results.every(Boolean) ? 0 : 1);
