/* check-v620 — v6.20, Derek: "create a new item in the dev window called
   'Helper Text' … edit every single piece of helper text in the app."
   v6.22 moved it to its OWN window (Help ▸ Developer ▸ Helper Text…), gave
   every row the control's icon/visible text, and dropped the row cap.
   Overrides key on the default string and land through the DOM applier
   (title/placeholder) and ht() (rendered hints). This drives the real UI
   end to end: open from the menu, edit → a live tooltip, a live field
   placeholder, and the script's own element hint all change — and reset
   restores them. */
import { launch, boot, seedScript, settle } from './driver.mjs';

const { browser, page } = await launch({ width: 1500, height: 950 });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL', m); } };

/** Override the row whose default text is `dflt` (search narrows first). */
async function overrideRow(dflt, value) {
  await page.fill('.htw-panel .dz-search-input', dflt);
  await settle(page);
  await page.fill(`.htw-panel .ht-input[value="${dflt}"]`, value);
  await page.keyboard.press('Enter');
  await settle(page);
}

try {
  await boot(page);
  await seedScript(page, [{ heading: 'INT. BRIDGE - NIGHT', actions: ['A line.'] }]);

  // A tool window whose chrome carries the Fullscreen tooltip.
  await page.evaluate(() => {
    const s = window.__scStore.getState();
    s.setToolMode('characters', 'floating');
    s.openTool('characters');
  });
  await page.waitForSelector('.tool-window');

  // 1 ── opens from Help ▸ Developer ▸ Helper Text…
  await page.evaluate(() => {
    [...document.querySelectorAll('.menu-item')].find((m) =>
      m.querySelector('.menu-label')?.textContent.trim() === 'Help')?.click();
  });
  await page.waitForSelector('.menu-dropdown');
  await page.evaluate(() => {
    [...document.querySelectorAll('.menu-dropdown-item')].find((b) => b.textContent.includes('Developer'))?.click();
  });
  await settle(page);
  await page.evaluate(() => {
    // EXACT text — the Developer parent row's textContent contains the whole
    // nested submenu, so a substring match clicks the parent instead.
    [...document.querySelectorAll('.menu-dropdown-item')].find((b) => b.textContent.trim() === 'Helper Text…')?.click();
  });
  await page.waitForSelector('.htw-panel .ht-row');
  ok(true, 'Help ▸ Developer ▸ Helper Text… opens the window');

  // 2 ── every row renders (no cap), and rows carry control context
  const counts = await page.evaluate(() => ({
    rows: document.querySelectorAll('.htw-panel .ht-row').length,
    withIcon: document.querySelectorAll('.htw-panel .ht-ctx-icon svg').length,
    capNote: !!document.querySelector('.htw-panel .ht-more'),
  }));
  ok(counts.rows > 300, `all rows render at once (${counts.rows})`);
  ok(!counts.capNote, 'no "N more — refine the search" note');
  ok(counts.withIcon > 80, `rows show the control's icon (${counts.withIcon} icons)`);

  // 3 ── the Design window no longer hosts the group
  await page.evaluate(() => window.__scStore.getState().setDesignPanelOpen(true));
  await page.waitForSelector('.dz-panel:not(.htw-panel)');
  const inDesign = await page.evaluate(() =>
    [...document.querySelectorAll('.dz-panel:not(.htw-panel) .dz-group-head')]
      .some((b) => b.textContent.includes('Helper Text')));
  ok(!inDesign, 'the Design window no longer lists Helper Text');
  await page.evaluate(() => window.__scStore.getState().setDesignPanelOpen(false));
  await settle(page);

  // 4 ── tooltip: Fullscreen → Big mode, live on the real button
  await overrideRow('Fullscreen', 'Big mode');
  await page.waitForFunction(() =>
    !!document.querySelector('.tool-window button[title="Big mode"]'), { timeout: 4000 });
  ok(true, 'editing the “Fullscreen” tooltip retitles the real window button');

  // 5 ── the script's element hint (Action...) through ht()
  await page.fill('.htw-panel .dz-search-input', 'Action...');
  await settle(page);
  await page.fill('.htw-panel .ht-input[value="Action..."]', 'Describe the mayhem…');
  await page.keyboard.press('Enter');
  await settle(page);
  await page.evaluate(() => {
    const ed = window.__scEditor;
    ed.chain().focus('end').run();
    ed.commands.insertContent({ type: 'action' });
  });
  await settle(page); await settle(page);
  const hint = await page.evaluate(() =>
    [...document.querySelectorAll('.ProseMirror [data-placeholder]')]
      .map((el) => el.getAttribute('data-placeholder')).join('|'));
  ok(hint.includes('Describe the mayhem…'), `the empty action's hint shows the override (${hint || 'none painted'})`);

  // 6 ── reset restores the app's own text
  await page.fill('.htw-panel .dz-search-input', 'Fullscreen');
  await settle(page);
  await page.evaluate(() => {
    [...document.querySelectorAll('.htw-panel .ht-row')].find((r) => r.querySelector('.ht-default'))
      ?.querySelector('.dz-reset')?.click();
  });
  await settle(page);
  await page.waitForFunction(() =>
    !!document.querySelector('.tool-window button[title="Fullscreen"]'), { timeout: 4000 });
  ok(true, 'reset puts the original tooltip back on the live button');

  // 7 ── overrides persist through the view-state save
  const saved = await page.evaluate(() => {
    const raw = localStorage.getItem('opendraft:viewState');
    return raw ? JSON.parse(raw).helperTextOverrides ?? null : null;
  });
  ok(saved && saved['Action...'] === 'Describe the mayhem…' && !('Fullscreen' in saved),
    'overrides persist in the view state (and the reset one is gone)');
} catch (e) {
  console.log('PROBE ERROR:', e.message);
  await page.screenshot({ path: '/tmp/v620-err.png' }).catch(() => {});
} finally { await browser.close(); }
console.log(`\ncheck-v620: ${pass} passed, ${fail} failed`);
