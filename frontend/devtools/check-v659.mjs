/* check-v659 — Derek: "when a preset is used but beats already exist, it
   should use the existing beats instead of creating new ones. it can change
   the page estimates of existing beats to work with the new preset
   structure. changing the estimated page length on one outline variation
   does not change it on other variations."

   1 a preset dropped on an outline that already has beats RE-HOMES them:
     same cards, no second set piled on, nothing left in Unsorted
   2 the re-fitted estimates still add up to each section's page budget
   3 the writing on a re-homed card survives (title, notes, color)
   4 the whole re-home is ONE undo step
   5 a page estimate typed on one variation does not follow the beat to
     another — each arrangement sizes its own beats
   6 the estimate the Outline Bar shows is the BAR's tab's, and dragging a
     beat's right edge there writes that tab, not the one on the board */
import { launch, boot, seedScript, SCENES_4, settle } from './driver.mjs';

const { browser, page } = await launch({ width: 1500, height: 950 });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL', m); } };
const W = '.tool-window[data-tool="beatboard"]';

const board = () => page.evaluate(() => {
  const st = window.__scStore.getState();
  const cols = [...st.beatColumns].sort((a, b) => a.position - b.position);
  return {
    ids: st.beats.map((b) => b.id).sort(),
    orphans: st.beats.filter((b) => !cols.some((c) => c.id === b.columnId)).length,
    cols: cols.map((c) => {
      const inCol = st.beats.filter((b) => b.columnId === c.id);
      return { title: c.title, budget: c.targetPages, beats: inCol.length, pages: inCol.reduce((n, b) => n + (b.outlineSpan ?? 0), 0) };
    }),
  };
});

try {
  await boot(page);
  await seedScript(page, SCENES_4);
  await page.evaluate(() => {
    window.__scStore.setState((s) => ({ toolSizes: { ...s.toolSizes, beatboard: { w: 1300, h: 760 } } }));
    const st = window.__scStore.getState();
    st.setToolMode('beatboard', 'floating');
    st.openTool('beatboard');
  });
  await page.waitForSelector(`${W} [data-ctl="view"]`, { timeout: 8000 });
  await page.click(`${W} [data-ctl="view"]`);
  await page.click('.tool-ctl-menu .tool-ctl-menu-item:has-text("Sections")');
  await settle(page);

  /* ── 1–3: a preset over an existing outline ── */
  await page.evaluate(() => {
    const st = window.__scStore.getState();
    st.setBeatColumns([]); st.setBeats([]);
    st.addOutlineTab();                         // a clean tab for the preset
  });
  await settle(page);
  await page.selectOption(`${W} .beat-board-preset`, '3act');
  await settle(page);
  /* v7.75: the beats are WRITTEN here. Presets lay down sections only now
     (Derek: "the outline presets should just be sections, not beats"), so a
     preset can no longer manufacture the board this check needs — sixty cards
     across three acts, which is what v6.57's 3-Act used to produce. */
  await page.evaluate(() => {
    const st = window.__scStore.getState();
    const cols = [...st.beatColumns].sort((a, b) => a.position - b.position);
    for (const c of cols) for (let i = 0; i < 20; i++) st.addBeat('', c.id);
  });
  await settle(page);
  const seeded = await board();
  ok(seeded.ids.length === 60 && seeded.cols.length === 3, `3-Act gives 3 acts to fill with 60 beats (${seeded.ids.length}/${seeded.cols.length})`);

  // put real writing on the first card, so re-homing can be shown to keep it
  await page.evaluate(() => {
    const st = window.__scStore.getState();
    const first = [...st.beats].sort((a, b) => a.position - b.position)[0];
    st.updateBeat(first.id, { title: 'Ordinary World', description: 'Draft note', color: '#ef4444' });
  });
  await settle(page);

  await page.selectOption(`${W} .beat-board-preset`, 'savethecat');
  await page.waitForSelector('.fs-confirm-overlay', { timeout: 5000 });
  const dialog = await page.evaluate(() => document.querySelector('.fs-confirm-box')?.textContent ?? '');
  ok(/NOT deleted/.test(dialog) && !/Unsorted/.test(dialog),
    'the confirm no longer promises a pile of Unsorted cards');
  await page.click('.fs-confirm-ok');
  await settle(page);

  const rehomed = await board();
  ok(JSON.stringify(rehomed.ids) === JSON.stringify(seeded.ids),
    `the same 60 beats — none created, none deleted (${rehomed.ids.length})`);
  ok(rehomed.cols.length === 15, `Save the Cat's 15 sections replaced the acts (${rehomed.cols.length})`);
  ok(rehomed.orphans === 0, `nothing waits in Unsorted (${rehomed.orphans})`);
  ok(rehomed.cols.every((c) => c.beats > 0), 'every section came out filled');
  const offBudget = rehomed.cols.filter((c) => c.pages !== c.budget);
  ok(offBudget.length === 0,
    `each section's re-fitted beats add up to its budget (${offBudget.map((c) => `${c.title} ${c.pages}/${c.budget}`).join(', ') || 'all exact'})`);
  const cards = await page.evaluate((w) => document.querySelectorAll(`${w} .beat-column-cards .beat-card`).length, W);
  ok(cards === 60, `all 60 cards render on the new board (${cards})`);
  const kept = await page.evaluate(() => {
    const b = window.__scStore.getState().beats.find((x) => x.title === 'Ordinary World');
    return b ? { d: b.description, c: b.color } : null;
  });
  ok(kept && kept.d === 'Draft note' && kept.c === '#ef4444', 'the writing on a re-homed card rode along');

  /* ── 4: one undo ── */
  await page.evaluate(() => window.__scStore.getState().beatUndo());
  await settle(page);
  const undone = await board();
  ok(undone.cols.length === 3 && undone.cols.every((c) => c.beats === 20),
    `one undo puts the 3 acts back whole (${undone.cols.map((c) => c.beats).join('/')})`);

  /* ── 5: estimates are per outline variation ── */
  // the board draws columns and cards in position order, so the first page
  // field on screen belongs to the first beat of the first section
  const probe = await page.evaluate(() => {
    const st = window.__scStore.getState();
    const first = [...st.beatColumns].sort((a, b) => a.position - b.position)[0];
    const beat = st.beats.filter((b) => b.columnId === first.id).sort((a, b) => a.position - b.position)[0];
    return { tabA: st.viewedOutlineTab, beat: beat.id };
  });
  // type it into the card's own page field, the way Derek would
  const field = page.locator(`${W} .beat-column-cards .beat-card-pages input`).first();
  await field.waitFor({ timeout: 5000 });
  await field.fill('9');
  await settle(page);
  const onA = await page.evaluate((id) => window.__scStore.getState().beats.find((b) => b.id === id).outlineSpan, probe.beat);
  ok(onA === 9, `the estimate takes on this variation (${onA})`);

  const tabB = await page.evaluate(() => window.__scStore.getState().addOutlineTab());
  await settle(page);
  await page.evaluate((id) => window.__scStore.getState().updateBeat(id, { outlineSpan: 3 }), probe.beat);
  await settle(page);
  await page.evaluate((id) => window.__scStore.getState().switchOutlineTab(id), probe.tabA);
  await settle(page);
  const backOnA = await page.evaluate((id) => window.__scStore.getState().beats.find((b) => b.id === id).outlineSpan, probe.beat);
  ok(backOnA === 9, `variation A kept its own 9 pages after B was set to 3 (${backOnA})`);
  await page.evaluate((id) => window.__scStore.getState().switchOutlineTab(id), tabB);
  await settle(page);
  const backOnB = await page.evaluate((id) => window.__scStore.getState().beats.find((b) => b.id === id).outlineSpan, probe.beat);
  ok(backOnB === 3, `variation B kept its own 3 pages (${backOnB})`);

  /* ── 6: the Outline Bar edits the tab IT is showing ── */
  await page.evaluate((tab) => window.__scStore.getState().setOutlineBarTab(tab), probe.tabA);
  await settle(page);
  const barSpan = await page.evaluate((id) => {
    const st = window.__scStore.getState();
    return st.outlineStash[st.outlineBarTab]?.beatSlots[id]?.span;
  }, probe.beat);
  ok(barSpan === 9, `the bar reads variation A's own estimate while B is on the board (${barSpan})`);
  await page.evaluate((id) => window.__scStore.getState().barSetBeatSpan(id, 12), probe.beat);
  await settle(page);
  const split = await page.evaluate((id) => {
    const st = window.__scStore.getState();
    return {
      bar: st.outlineStash[st.outlineBarTab]?.beatSlots[id]?.span,
      viewed: st.beats.find((b) => b.id === id).outlineSpan,
    };
  }, probe.beat);
  ok(split.bar === 12 && split.viewed === 3,
    `a bar edit lands on the bar's tab and leaves the board's alone (bar ${split.bar}, board ${split.viewed})`);

  // and the bar DRAWS its own tab's estimate — the read path, not just the write
  await page.evaluate(() => window.__scStore.getState().setOutlineBarOpen(true));
  await page.waitForSelector('.fs-ob-beats .fs-ob-beat', { timeout: 5000 });
  await settle(page);
  const drawn = await page.evaluate(() => {
    const el = [...document.querySelectorAll('.fs-ob-beats .fs-ob-beat')]
      .find((n) => (n.getAttribute('title') || '').startsWith('Ordinary World'));
    return el ? /, (\d+)p/.exec(el.getAttribute('title'))?.[1] : null;
  });
  ok(drawn === '12', `the bar draws variation A's 12 pages while the board shows B's 3 (${drawn})`);

} catch (e) {
  console.log('PROBE ERROR:', e.message);
  fail++;
} finally { await browser.close(); }
console.log(`\ncheck-v659: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
