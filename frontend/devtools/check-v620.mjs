/* check-v620 — v6.20, Derek: "create a new item in the dev window called
   'Helper Text' … edit every single piece of helper text in the app."
   The Design window grows a Helper Text group (generated catalog: tooltips,
   placeholders, hints). Overrides are keyed by the default string and land
   through the DOM applier (title/placeholder) and ht() (rendered hints).
   This drives the real UI end to end: edit in the window → a live tooltip,
   a live field placeholder, and the script's own element hint all change —
   and reset restores them. */
import { launch, boot, seedScript, settle } from './driver.mjs';

const { browser, page } = await launch({ width: 1500, height: 950 });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL', m); } };

/** Type into the Helper Text row whose default text is `dflt`. */
async function overrideRow(dflt, value) {
  await page.fill('.dz-search-input', dflt);
  await settle(page);
  const row = page.locator('.ht-row', { has: page.locator(`.ht-input[value="${dflt}"]`) }).first();
  // the input VALUE is the default until overridden — target by value.
  await page.fill(`.ht-input[value="${dflt}"]`, value);
  await page.keyboard.press('Enter');
  await settle(page);
  return row;
}

try {
  await boot(page);
  await seedScript(page, [{ heading: 'INT. BRIDGE - NIGHT', actions: ['A line.'] }]);

  // A tool window whose chrome carries the Fullscreen tooltip.
  await page.evaluate(() => {
    const s = window.__scStore.getState();
    s.setToolMode('characters', 'floating');
    s.openTool('characters');
    s.openTool('design');
  });
  await page.waitForSelector('.dz-search-input');
  await settle(page);

  // Expand the Helper Text group.
  await page.evaluate(() => {
    [...document.querySelectorAll('.dz-group-head')]
      .find((b) => b.textContent.includes('Helper Text'))?.click();
  });
  await page.waitForSelector('.ht-row');
  ok(true, 'the Design window lists the Helper Text group with rows');

  // 1 ── tooltip: Fullscreen → Big mode, live on the real button
  await overrideRow('Fullscreen', 'Big mode');
  await page.waitForFunction(() =>
    !!document.querySelector('.tool-window button[title="Big mode"]'), { timeout: 4000 });
  ok(true, 'editing the “Fullscreen” tooltip retitles the real window button');

  // 2 ── placeholder: the Design window's own search field
  await page.fill('.dz-search-input', '');
  await settle(page);
  await overrideRow('Search settings…', 'Find a knob…');
  const ph = await page.$eval('.dz-search-input', (el) => el.placeholder);
  ok(ph === 'Find a knob…', `field placeholders go live too (search says “${ph}”)`);

  // 3 ── the script's element hint (Action...) through ht()
  await page.fill('.dz-search-input', 'Action...');
  await settle(page);
  await page.fill('.ht-input[value="Action..."]', 'Describe the mayhem…');
  await page.keyboard.press('Enter');
  await settle(page);
  await page.evaluate(() => {
    const ed = window.__scEditor;
    ed.chain().focus('end').run();
    ed.commands.insertContent({ type: 'action' });   // a fresh EMPTY action under the caret
  });
  await settle(page); await settle(page);
  const hint = await page.evaluate(() =>
    [...document.querySelectorAll('.ProseMirror [data-placeholder]')]
      .map((el) => el.getAttribute('data-placeholder')).join('|'));
  ok(hint.includes('Describe the mayhem…'), `the empty action's hint shows the override (${hint || 'none painted'})`);

  // 4 ── reset restores the app's own text
  await page.fill('.dz-search-input', 'Fullscreen');
  await settle(page);
  await page.evaluate(() => {
    [...document.querySelectorAll('.ht-row')].find((r) => r.querySelector('.ht-default'))
      ?.querySelector('.dz-reset')?.click();
  });
  await settle(page);
  await page.waitForFunction(() =>
    !!document.querySelector('.tool-window button[title="Fullscreen"]'), { timeout: 4000 });
  ok(true, 'reset puts the original tooltip back on the live button');

  // 5 ── overrides persist through the view-state save
  const saved = await page.evaluate(() => {
    const raw = localStorage.getItem('opendraft:viewState');
    return raw ? JSON.parse(raw).helperTextOverrides ?? null : null;
  });
  ok(saved && saved['Search settings…'] === 'Find a knob…' && !('Fullscreen' in saved),
    'overrides persist in the view state (and the reset one is gone)');
} catch (e) {
  console.log('PROBE ERROR:', e.message);
  await page.screenshot({ path: '/tmp/v620-err.png' }).catch(() => {});
} finally { await browser.close(); }
console.log(`\ncheck-v620: ${pass} passed, ${fail} failed`);
