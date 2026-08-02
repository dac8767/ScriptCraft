// check-v571 — collapsed-tabs caret + the All Pages tab + tab renames.
//  1. a narrow window's collapsed tab dropdown carries a visible ▾ caret
//     (every tabbed window — Pages and Characters both checked)
//  2. Pages tabs read All Pages / Script Pages / Title Page / Custom Pages
//  3. All Pages compiles the other tabs: title page + script pages + custom
//     pages in document order (title thumb labeled, custom unlabeled-pos)
//  4. Script Pages still excludes both title and custom pages
import { launch, boot, seedScript, openTool, SCENES_4 } from './driver.mjs';

const { browser, page } = await launch();
let pass = 0, fail = 0;
const ok = (cond, label) => {
  console.log(`${cond ? '  ✓' : '  ✗ FAIL'} ${label}`);
  cond ? pass++ : fail++;
};

async function gotoTab(label) {
  const strip = await page.$(`.tool-chrome-tabs:not(.tool-chrome-tabs-measure) .tool-chrome-tab:has-text("${label}")`);
  if (strip && await strip.isVisible()) { await strip.click(); return; }
  await page.click('.tool-chrome-tabs-dd .tool-ctl');
  await page.click(`.tool-ctl-menu .tool-ctl-menu-item:has-text("${label}")`);
}

try {
  await boot(page);
  await seedScript(page, SCENES_4);

  // give the doc a title page + a custom page (real commands, no UI detour)
  await page.evaluate(() => {
    const ed = window.__scEditor;
    ed.commands.insertContentAt(0, [
      { type: 'titlePage', attrs: { field: 'title', tpTitle: 'BELKADAN RISING' }, content: [{ type: 'text', text: 'BELKADAN RISING' }] },
      { type: 'titlePage', attrs: { field: 'credit' }, content: [{ type: 'text', text: 'Written by Derek Carl' }] },
    ]);
  });

  // ── 1. the caret on collapsed tab dropdowns — Characters first (it and
  // Pages share the LEFT slot; ending on Pages lets the rest run there) ──
  await openTool(page, 'Characters');
  await page.waitForSelector('.tool-chrome-tabs-dd, .tool-chrome-tabs:not(.tool-chrome-tabs-measure) .tool-chrome-tab', { timeout: 8000 });
  const charCaret = await page.$$eval('.tool-chrome-tabs-dd .tool-ctl-caret svg', (els) => els.length);
  ok(charCaret >= 1, `Characters' collapsed tab dropdown carries the ▾ (${charCaret} visible)`);

  await openTool(page, 'Pages');
  await page.waitForSelector('.page-thumbnails-grid', { timeout: 8000 });
  const pagesCollapsed = await page.$('.tool-chrome-tabs-dd');
  ok(!!pagesCollapsed, 'narrow dock: the Pages tabs collapse to the dropdown');
  const caret = await page.$('.tool-chrome-tabs-dd .tool-ctl-caret svg');
  ok(!!caret && await caret.isVisible(), 'the collapsed Pages dropdown shows the ▾ caret');

  // ── 2. the renamed tab set ──
  const tabTexts = await page.$$eval('.tool-chrome-tabs-measure .tool-chrome-tab',
    (els) => els.map((e) => e.textContent?.trim()));
  // the labels were shortened after v5.71 — the TABS are the subject here,
  // not their wording, so this tracks what they say today.
  const wanted = ['Script', 'Title', 'Custom', 'All'];
  ok(wanted.every((t) => tabTexts.includes(t)) && tabTexts.length >= 4,
    `tabs read ${tabTexts.filter((t) => wanted.includes(t)).join(' / ')}`);

  // seed a custom page via the Custom Pages tab (after page 1)
  await gotoTab('Custom');
  await page.waitForSelector('.fs-pages-addpage', { timeout: 5000 });
  await page.click('.fs-pages-addpage');
  await page.fill('#fs-pages-addafter', '1');
  await page.click('.fs-pages-pop-form button[type="submit"]');
  await page.waitForSelector('.page-thumb-number:has-text("Custom Page")', { timeout: 5000 });
  ok(true, 'custom page added from the Custom Pages tab');

  // ── 3. All Pages compiles everything in document order ──
  await gotoTab('All');
  await page.waitForFunction(() => {
    const labels = Array.from(document.querySelectorAll('.page-thumb-number')).map((e) => e.textContent || '');
    return labels.some((t) => t.includes('Title Page')) && labels.some((t) => t.includes('Custom Page'));
  }, { timeout: 6000 });
  const allLabels = await page.$$eval('.page-thumb-number', (els) => els.map((e) => (e.textContent || '').trim()));
  ok(allLabels[0] === 'Title Page', `the title page leads the All Pages grid (${allLabels[0]})`);
  ok(allLabels[1] === 'Page 1' && allLabels[2] === 'Custom Page',
    `document order holds: ${allLabels.slice(0, 4).join(' | ')}`);
  ok(allLabels.filter((t) => /^Page \d+$/.test(t)).length >= 2, 'script pages number through unchanged');
  const titleText = await page.$eval('.page-thumbnail[data-page="title"] .page-thumb-content', (e) => e.textContent);
  ok((titleText || '').includes('BELKADAN RISING'), 'the title thumb renders the real title text');
  ok(!(await page.$('.page-thumbnail[data-page="title"] .page-thumb-kebab')), 'no ⋮ menu on the title thumb');
  const searchVisible = await page.$('.fs-pages-goto-btn');
  ok(!!searchVisible, 'the # / search controls ride the All Pages tab too');

  // ── 4. Script Pages: still script only ──
  await gotoTab('Script');
  await page.waitForFunction(() => {
    const labels = Array.from(document.querySelectorAll('.page-thumb-number')).map((e) => e.textContent || '');
    return labels.length > 0 && labels.every((t) => /^Page \d+$/.test(t.trim()));
  }, { timeout: 6000 });
  ok(true, 'Script Pages lists only numbered script pages (no title, no custom)');
} catch (e) {
  console.log('  ✗ SCRIPT ERROR:', e.message);
  fail++;
} finally {
  await browser.close();
}
console.log(`\ncheck-v571: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
