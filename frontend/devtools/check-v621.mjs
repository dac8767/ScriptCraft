/* check-v621 — v6.21, Derek's Goals batch: (1+2) the CURRENT word/page
   total rides the Reach row, right-aligned, on both count tabs; (3) the
   window footer is ONE row; (4) the readout placement options read
   Header / Footer (the stored value keeps the name 'toolbar' — persisted),
   and the header chip hugs the ribbon's right edge. */
import { launch, boot, seedScript, SCENES_4, settle } from './driver.mjs';

const { browser, page } = await launch({ width: 1500, height: 950 });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL', m); } };

try {
  await boot(page); await seedScript(page, SCENES_4);
  await page.evaluate(() => {
    const s = window.__scStore.getState();
    s.setToolMode('goals', 'floating');
    s.openTool('goals');
    s.setGoalKind('words');
  });
  await page.waitForSelector('.fs-goals');
  await settle(page);

  const readTab = () => page.evaluate(() => {
    const now = document.querySelector('.fs-goal-nowcount');
    const row = now?.closest('.fs-goal-timemode');
    const rr = row?.getBoundingClientRect(); const nr = now?.getBoundingClientRect();
    const footer = document.querySelector('.fs-goal-footer');
    const tops = footer ? [...footer.children].map((c) => Math.round(c.getBoundingClientRect().top)) : [];
    return {
      now: now?.textContent ?? null,
      rightAligned: rr && nr ? Math.abs(rr.right - nr.right) < 14 : false,
      oneRow: tops.length === 2 && Math.abs(tops[0] - tops[1]) < 8,
      labels: [...document.querySelectorAll('.fs-goal-showin button')].map((b) => b.textContent).join('|'),
    };
  });

  let t = await readTab();
  ok(t.now !== null && /\d/.test(t.now), `Words tab shows the current total on the Reach row (${t.now})`);
  ok(t.rightAligned, 'and it sits right-aligned in the row');
  ok(t.oneRow, 'the footer is one row');
  ok(t.labels === 'Header|Footer', `the placement options read Header / Footer (${t.labels})`);

  await page.evaluate(() => window.__scStore.getState().setGoalKind('pages'));
  await settle(page);
  t = await readTab();
  ok(t.now !== null && /\d/.test(t.now) && t.rightAligned,
    `Pages tab shows its current total the same way (${t.now})`);

  // the header chip: Show in Header (stored value 'toolbar') + a running goal
  await page.evaluate(() => {
    const s = window.__scStore.getState();
    s.setGoalShowIn('toolbar');
    s.setGoal({ kind: 'words', target: 5000 });
  });
  await settle(page); await settle(page);
  const chip = await page.evaluate(() => {
    const chip = document.querySelector('.toolbar-goalchip');
    const bar = chip?.closest('.toolbar');
    if (!chip || !bar) return null;
    return Math.round(bar.getBoundingClientRect().right - chip.getBoundingClientRect().right);
  });
  ok(chip !== null && chip <= 16, `Show in Header parks the chip at the ribbon's right edge (${chip}px in)`);
} catch (e) {
  console.log('PROBE ERROR:', e.message);
  await page.screenshot({ path: '/tmp/v621-err.png' }).catch(() => {});
} finally { await browser.close(); }
console.log(`\ncheck-v621: ${pass} passed, ${fail} failed`);
