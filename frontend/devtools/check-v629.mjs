/* check-v629 — Derek's pair:
   (1) "the goal is still showing in the toolbar instead of the header. the
   app header is the same line with the quick action toolbar and the script
   name" — Show in: Header parks the chip in the TITLE BAR (absolute at its
   right edge; the ribbon seat remains only where no title bar exists, so
   the chip lives in exactly one place). Driven with the DEV titlebar flag —
   the browser has no Mac overlay bar.
   (2) "printing a page … shrinks the actual page down" — File ▸ Print now
   renders the exporter's exact-layout PDF and opens it with the print
   dialog queued (a blob: popup), instead of window.print(), which let the
   OS scale the page inside its own printer margins (his sample: Quartz
   print-to-PDF, everything ×0.74). */
import { launch, boot, seedScript, SCENES_4, settle } from './driver.mjs';

const { browser, page } = await launch({ width: 1500, height: 950 });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL', m); } };

try {
  await boot(page);
  /* the DEV titlebar flag AFTER boot — the driver's first-load init script
     clears localStorage, and init scripts run in add order. Its clear is
     once per session (sessionStorage marker), so a reload keeps the flag. */
  await page.evaluate(() => localStorage.setItem('scriptcraft:devTitlebar', '1'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ProseMirror', { timeout: 25000 });
  await page.waitForFunction(() => Boolean(window.__scEditor), { timeout: 10000 });
  await seedScript(page, SCENES_4);

  // (1) Header = the title bar
  await page.evaluate(() => {
    const s = window.__scStore.getState();
    s.setGoalShowIn('toolbar');
    s.setGoal({ kind: 'words', target: 5000 });
  });
  await settle(page); await settle(page);
  const chip = await page.evaluate(() => {
    const bar = document.querySelector('.fs-titlebar');
    const c = document.querySelector('.fs-titlebar-goal .status-goal');
    if (!bar || !c) return { bar: !!bar, chip: false };
    const b = bar.getBoundingClientRect(), r = c.getBoundingClientRect();
    return {
      bar: true, chip: true,
      inBar: r.top >= b.top - 1 && r.bottom <= b.bottom + 1,
      rightGap: Math.round(b.right - r.right),
      ribbonSeat: !!document.querySelector('.toolbar-goalchip'),
    };
  });
  ok(chip.chip && chip.inBar, 'Show in Header parks the chip in the title bar');
  ok(chip.rightGap <= 16, `at the bar's right edge (${chip.rightGap}px in)`);
  ok(!chip.ribbonSeat, 'and the ribbon seat is empty — one chip, one place');
  await page.evaluate(() => window.__scStore.getState().setGoal(null));

  // (2) Print opens the exporter's PDF with the dialog queued
  const popupP = page.waitForEvent('popup', { timeout: 8000 });
  await page.evaluate(() => {
    [...document.querySelectorAll('.menu-item')].find((m) =>
      m.querySelector('.menu-label')?.textContent.trim() === 'File')?.click();
  });
  await page.waitForSelector('.menu-dropdown');
  await page.evaluate(() => {
    [...document.querySelectorAll('.menu-dropdown-item')].find((b) => b.textContent.trim().startsWith('Print'))?.click();
  });
  const popup = await popupP;
  ok(popup.url().startsWith('blob:'), `Print opens the exact-layout PDF (${popup.url().slice(0, 24)}…)`);
} catch (e) {
  console.log('PROBE ERROR:', e.message);
  await page.screenshot({ path: '/tmp/v629-err.png' }).catch(() => {});
} finally { await browser.close(); }
console.log(`\ncheck-v629: ${pass} passed, ${fail} failed`);
