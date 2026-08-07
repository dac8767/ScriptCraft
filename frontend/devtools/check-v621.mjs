/* check-v621 — Derek's Goals batches (v6.21 + v6.23):
   v6.21: the CURRENT word/page total rides the Reach row, right-aligned, on
   both count tabs; the placement options read Header / Footer (stored value
   keeps the name 'toolbar'); the header chip hugs the ribbon's right edge.
   v6.23: ONE ▶ Start at the body's top-left that becomes ■ Stop while a
   goal runs (Dismiss when done); the Header/Footer toggle rides the same
   row, aligned right; the footer is just the Vomit checkbox (one row); the
   Words and Pages tabs have Quick start rows that launch relative goals. */
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

  const shape = () => page.evaluate(() => {
    const now = document.querySelector('.fs-goal-nowcount');
    const row = now?.closest('.fs-goal-timemode');
    const rr = row?.getBoundingClientRect(); const nr = now?.getBoundingClientRect();
    const top = document.querySelector('.fs-goal-toprow');
    const btn = top?.querySelector('.fs-goal-main');
    const showin = top?.querySelector('.fs-goal-showin');
    const tr = top?.getBoundingClientRect(); const br = btn?.getBoundingClientRect(); const sr = showin?.getBoundingClientRect();
    const footer = document.querySelector('.fs-goal-footer');
    return {
      now: now?.textContent ?? null,
      nowRight: rr && nr ? Math.abs(rr.right - nr.right) < 14 : false,
      btnLabel: btn?.textContent ?? null,
      btnLeft: tr && br ? Math.abs(br.left - tr.left) < 6 : false,
      showinRight: tr && sr ? Math.abs(sr.right - tr.right) < 6 : false,
      sameRow: br && sr ? Math.abs(br.top + br.height / 2 - (sr.top + sr.height / 2)) < 8 : false,
      labels: [...document.querySelectorAll('.fs-goal-showin button')].map((b) => b.textContent).join('|'),
      footerKids: footer ? footer.children.length : -1,
      quick: [...document.querySelectorAll('.fs-goal-quick button')].map((b) => b.textContent.trim()),
    };
  });

  let t = await shape();
  ok(t.now !== null && /\d/.test(t.now) && t.nowRight, `Words: current total right-aligned on the Reach row (${t.now})`);
  ok(t.btnLabel === '▶ Start' && t.btnLeft, 'the Start button sits top-left of the body');
  ok(t.showinRight && t.sameRow, 'Show in rides the same row, aligned right');
  ok(t.labels === 'Header|Footer', `the options read Header / Footer (${t.labels})`);
  ok(t.footerKids === 1, 'the footer is just the Vomit checkbox — one row');
  ok(t.quick.length === 5 && t.quick[1] === '500 words', `Words tab has a Quick start row (${t.quick.join(', ')})`);

  // Start → Stop → cleared. Aim ABOVE the current total first — a reach
  // goal the script has already met completes instantly and reads Dismiss.
  await page.fill('.fs-goals .fs-goal-timemode input[type="number"]', '5000');
  await settle(page);
  await page.click('.fs-goal-main');
  await settle(page);
  t = await shape();
  ok(t.btnLabel === '■ Stop', 'clicking Start turns the button into Stop');
  await page.click('.fs-goal-main');
  await settle(page);
  t = await shape();
  ok(t.btnLabel === '▶ Start', 'Stop clears the goal and it reads Start again');

  // Pages tab: total + quick start launches a RELATIVE goal
  await page.evaluate(() => window.__scStore.getState().setGoalKind('pages'));
  await settle(page);
  t = await shape();
  ok(t.now !== null && /\d/.test(t.now) && t.nowRight, `Pages: current total right-aligned (${t.now})`);
  ok(t.quick.length === 5 && t.quick[0] === '1 page', `Pages tab has a Quick start row (${t.quick.join(', ')})`);
  await page.click('.fs-goal-quick button:text-is("2 pages")');
  await settle(page);
  const g = await page.evaluate(() => window.__scStore.getState().goal);
  ok(g && g.kind === 'pages' && g.target === 2 && g.mode === 'relative' && typeof g.baseline === 'number',
    `a quick start launches a relative goal (${JSON.stringify(g)})`);
  await page.click('.fs-goal-main');   // stop it
  await settle(page);

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
