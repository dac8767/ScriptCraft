/* check-v627 — Derek's pair:
   (1) "the title page tool does not scale with the title page window … the
   info column also has a scroll bar." The embedded editor fills the Pages
   window now (the 780px modal cap applied only to the modal), the form
   column is minmax(400,460) with minmax(0,1fr) field tracks (no horizontal
   scroll bar, ever), the preview takes the rest and Fit re-scales, and the
   narrow host stacks at <700 (was 560 — the form's new floor would have
   left a sliver preview between). Bonus: the Contact placeholder was
   showing a literal \n — JSX attr strings keep the backslash.
   (2) "nothing happens when clicking Asset Manager in the File menu."
   openTool seated panel-EXCLUDED tools (assets, spelling) in a panel slot
   the dock refuses to render — invisible, and the stale slot turned the
   next click into a toggle-close. PANEL_EXCLUDED_IDS lives in editorStore
   now (ONE list for the dock, Customize and openTool) and excluded tools
   open as windows. */
import { launch, boot, seedScript, SCENES_4, settle } from './driver.mjs';

const { browser, page } = await launch({ width: 1500, height: 950 });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL', m); } };

try {
  await boot(page); await seedScript(page, SCENES_4);

  // ── (1) the Title tab scales with the window ──
  await page.evaluate(() => {
    const s = window.__scStore.getState();
    s.setToolMode('pages', 'floating');
    s.openTool('pages');
    s.setPagesTab('title');
    s.setToolSize('pages', 1040, 900);
  });
  await page.waitForSelector('.tp-editor-body');
  await settle(page); await settle(page);
  let g = await page.evaluate(() => {
    const dlg = document.querySelector('.tp-editor-dialog');
    const win = document.querySelector('.tool-window');
    const form = document.querySelector('.tp-editor-form');
    const pg = document.querySelector('.tp-scale-page');
    const contact = document.querySelector('.props-textarea');
    return {
      fills: Math.abs(dlg.getBoundingClientRect().width - win.getBoundingClientRect().width) < 4,
      hScroll: form.scrollWidth > form.clientWidth + 1,
      pageW: pg ? Math.round(pg.getBoundingClientRect().width) : 0,
      ph: contact?.placeholder ?? '',
    };
  });
  ok(g.fills, 'the editor fills the Pages window (no dead grey around a capped box)');
  ok(!g.hScroll, 'the info column has no horizontal scroll bar');
  ok(g.pageW > 450, `the preview page grows with the window (${g.pageW}px wide)`);
  ok(g.ph.includes('\n') && !g.ph.includes('\\n'), 'the Contact ghost text carries real line breaks');

  await page.evaluate(() => window.__scStore.getState().setToolSize('pages', 640, 800));
  await settle(page); await settle(page);
  ok(await page.$('.fs-tp-narrow') !== null, 'a narrow host stacks the two columns');
  await page.evaluate(() => window.__scStore.getState().closeTool('pages'));
  await settle(page);

  // ── (2) File ▸ Asset Manager opens a WINDOW, even from a stale slot ──
  await page.evaluate(() => window.__scStore.setState({ activeTool: 'assets' }));   // pre-fix leftover
  await page.evaluate(() => {
    [...document.querySelectorAll('.menu-item')].find((el) =>
      el.querySelector('.menu-label')?.textContent.trim() === 'File')?.click();
  });
  await page.waitForSelector('.menu-dropdown');
  await page.evaluate(() => {
    [...document.querySelectorAll('.menu-dropdown-item')].find((b) => b.textContent.trim() === 'Asset Manager')?.click();
  });
  await settle(page); await settle(page);
  const a = await page.evaluate(() => ({
    title: document.querySelector('.tool-window .tool-window-title')?.textContent ?? null,
    temp: window.__scStore.getState().tempTool,
    active: window.__scStore.getState().activeTool,
  }));
  ok(a.title === 'Asset Manager' && a.temp === 'assets', 'File ▸ Asset Manager opens the window');
  ok(a.active === null, 'and the stale invisible panel slot is cleared');

  // spelling shares the exclusion — same path
  await page.evaluate(() => {
    const s = window.__scStore.getState();
    s.closeTool('assets');
    s.openTool('spelling');
  });
  await settle(page);
  const spTitle = await page.evaluate(() => document.querySelector('.tool-window .tool-window-title')?.textContent ?? null);
  ok(spTitle === 'Spelling & Grammar', 'Spell Check Panel opens as a window too');
} catch (e) {
  console.log('PROBE ERROR:', e.message);
  await page.screenshot({ path: '/tmp/v627-err.png' }).catch(() => {});
} finally { await browser.close(); }
console.log(`\ncheck-v627: ${pass} passed, ${fail} failed`);
