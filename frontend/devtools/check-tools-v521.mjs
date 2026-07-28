// devtools/check-tools-v521.mjs — Derek's seven-item batch, live:
//  1. Title Page ALWAYS opens as the fullscreen takeover (no shrink button)
//  2. Sticky Notes merge: + Note / + To-Do action row, header Filter/Sort/
//     Search, kind filter narrows, dock row renamed, To-Do row gone
//  3. scene list rows wear the Locations-style faint separators
//  4. one floating window at a time
//  5. (Window menu is native/Rust — verified by cargo parse + zero refs)
//  6. Pages fullscreen floors per-row at 2 (store value untouched)
//  7. the Airtable dev panel is gone even in DEV
import { launch, boot, seedScript, openTool, waitScenes, shot, SCENES_4 } from './driver.mjs';

const results = [];
const check = (n, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  results.push(ok);
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${n.padEnd(52)} got ${JSON.stringify(got)}${ok ? '' : `  want ${JSON.stringify(want)}`}`);
};
const store = (page, fn) => page.evaluate(fn);

const { browser, page } = await launch({ width: 1500, height: 950 });
await boot(page);
await seedScript(page, SCENES_4);

// ── 1. Title Page fullscreen-only ───────────────────────────────────────────
await store(page, () => window.__scStore.getState().openTool('titlepage'));
await page.waitForSelector('.fs-tool-takeover-titlepage');
const tp = await page.evaluate(() => ({
  takeover: !!document.querySelector('.fs-tool-takeover-titlepage'),
  floatingWin: !!document.querySelector('.tool-window[data-tool="titlepage"]'),
  minimizeBtn: !!document.querySelector('.fs-tool-takeover .tool-window-minimize'),
}));
check('Title Page opens as the takeover', tp.takeover, true);
check('…never as a floating window', tp.floatingWin, false);
check('…and offers no shrink-to-window button', tp.minimizeBtn, false);
await store(page, () => window.__scStore.getState().setFullscreenTool(null));

// ── 2. Sticky Notes merge ───────────────────────────────────────────────────
const dockLabels = await page.evaluate(() =>
  [...document.querySelectorAll('.tool-dock-label')].map((e) => e.textContent));
check('dock row renamed to Sticky Notes', dockLabels.includes('Sticky Notes'), true);
check('the To-Do dock row is gone', dockLabels.includes('To-Do'), false);
check('no Airtable (dev) row even in DEV', dockLabels.includes('Airtable (dev)'), false);

await openTool(page, 'Sticky Notes');
await page.waitForSelector('.tool-inline[data-tool="sticky"] .tool-action-row');
const sticky = await page.evaluate(() => {
  const win = document.querySelector('.tool-inline[data-tool="sticky"]');
  const btns = [...win.querySelectorAll('.tool-action-row .tool-action-btn')].map((b) => b.textContent);
  const ctls = [...win.querySelectorAll('.tool-chrome-controls .tool-ctl')].map((b) => b.textContent || b.getAttribute('title'));
  const labels = [...win.querySelectorAll('.sticky-group-label')].map((e) => e.textContent);
  return { btns, ctls, labels };
});
check('+ Note / + To-Do lead the body', sticky.btns, ['+ Note', '+ To-Do']);
check('header carries Filter · Sort · Search',
  sticky.ctls.some((t) => t?.includes('Filter')) && sticky.ctls.some((t) => t?.includes('Sort')) && sticky.ctls.some((t) => t === 'Search'),
  true);
check('both group labels under All', sticky.labels, ['Notes', 'To-Do']);

await page.click('.tool-inline[data-tool="sticky"] .tool-action-row button:has-text("+ Note")');
await page.click('.tool-inline[data-tool="sticky"] .tool-action-row button:has-text("+ To-Do")');
const counts = await store(page, () => {
  const s = window.__scStore.getState();
  return { notes: s.shelfCards.filter((c) => c.type === 'comment').length, todos: s.shelfCards.filter((c) => c.type === 'todo').length };
});
check('the + buttons add their card kinds', counts, { notes: 1, todos: 1 });
const title = await page.evaluate(() =>
  document.querySelector('.tool-dock-item[title="Sticky Notes"] .tool-title-count')?.textContent);
check('the title count sums both lists', title, '· 2');

await page.click('.tool-inline[data-tool="sticky"] .tool-chrome-controls .tool-ctl:has-text("Filter")');
await page.click('.tool-ctl-menu-item:has-text("To-Dos")');
const narrowed = await page.evaluate(() => {
  const win = document.querySelector('.tool-inline[data-tool="sticky"]');
  return {
    labels: win.querySelectorAll('.sticky-group-label').length,
    notesShown: !!win.querySelector('.script-notes-list .swn-card, .script-notes-list .sticky-card') &&
      [...win.querySelectorAll('.script-notes-list')].length,
  };
});
check('kind filter drops the group labels', narrowed.labels, 0);
await store(page, () => window.__scStore.getState().setStickyKindFilter('all'));

await shot(page, '.tool-inline[data-tool="sticky"]', new URL('./last-sticky-merged.png', import.meta.url).pathname, 500);

// ── 3. scene list separators ────────────────────────────────────────────────
await openTool(page, 'Scenes');
await waitScenes(page, 4);
const sep = await page.evaluate(() => {
  const row = document.querySelector('.navigator-scene');
  const cs = getComputedStyle(row);
  return { w: cs.borderBottomWidth, style: cs.borderBottomStyle };
});
check('scene rows wear the faint separator', sep, { w: '1px', style: 'solid' });

// ── 4. one floating window at a time ────────────────────────────────────────
await store(page, () => window.__scStore.getState().openTool('analytics'));
await page.waitForSelector('.tool-window[data-tool="analytics"]');
await store(page, () => {
  const st = window.__scStore.getState();
  st.setToolMode('sticky', 'floating');
  st.openTool('sticky');
});
await page.waitForSelector('.tool-window[data-tool="sticky"]');
const wins = await page.evaluate(() => [...document.querySelectorAll('.tool-window')].map((w) => w.dataset.tool));
check('opening a second window closed the first', wins, ['sticky']);
await store(page, () => { const st = window.__scStore.getState(); st.closeTool('sticky'); st.setToolMode('sticky', 'docked'); });

// ── 6. Pages fullscreen floors per-row at 2 ─────────────────────────────────
await store(page, () => { const st = window.__scStore.getState(); st.setPagesPerRow(1); st.openTool('pages'); });
await page.waitForSelector('.tool-inline[data-tool="pages"] .tool-action-count, .tool-window[data-tool="pages"] .tool-action-count');
const docked = await page.evaluate(() => document.querySelector('.tool-action-count')?.textContent);
check('docked Pages honors 1 per row', docked, '1');
await store(page, () => window.__scStore.getState().enterToolFullscreen('pages'));
await page.waitForSelector('.fs-tool-takeover-pages');
const fs = await page.evaluate(() => {
  const t = document.querySelector('.fs-tool-takeover-pages');
  const minus = t.querySelector('button[title="Fewer pages per row (bigger pages)"]');
  return {
    shown: t.querySelector('.tool-action-count')?.textContent,
    minusDisabled: minus?.disabled,
    raw: window.__scStore.getState().pagesPerRow,
  };
});
check('fullscreen floors the display at 2', fs.shown, '2');
check('the minus button stops at the floor', fs.minusDisabled, true);
check('the STORE still remembers 1', fs.raw, 1);
await store(page, () => window.__scStore.getState().setFullscreenTool(null));

await browser.close();
console.log(results.every(Boolean) ? 'ALL OK' : 'FAILURES');
process.exit(results.every(Boolean) ? 0 : 1);
