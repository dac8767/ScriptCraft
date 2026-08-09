/* check-v652 — Derek's five:
   1 the beat count sits LEFT, beside the outline tabs (not in the cluster)
   2 beat cards visibly separate from the board background in EVERY theme
     (color-mix step toward the theme's text color — sampled on two themes)
   3 Helper Text is a real tool: floats like a window AND docks into a panel
   4 freeform connect: the origin card stays lit; the hovered card lights up
   5 freeform cards drag by the whole header row (title input still focuses
     on a plain click) */
import { launch, boot, seedScript, SCENES_4, settle } from './driver.mjs';

const { browser, page } = await launch({ width: 1500, height: 950 });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL', m); } };
const W = '.tool-window[data-tool="beatboard"]';
const rgb = (s) => (s.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number);
const delta = (a, b) => Math.max(...rgb(a).map((v, i) => Math.abs(v - rgb(b)[i])));

try {
  await boot(page);
  await seedScript(page, SCENES_4);
  await page.evaluate(() => {
    window.__scStore.setState((s) => ({ toolSizes: { ...s.toolSizes, beatboard: { w: 1300, h: 700 } } }));
    const st = window.__scStore.getState();
    st.setToolMode('beatboard', 'floating');
    st.openTool('beatboard');
  });
  await page.waitForSelector(W, { timeout: 8000 });
  await settle(page);

  // ── 1: the count rides the tab strip, not the right cluster ──
  const count = await page.evaluate((w) => {
    const win = document.querySelector(w);
    return {
      inStrip: win?.querySelector('.tool-chrome-tabs:not(.tool-chrome-tabs-measure) .beat-board-info')?.textContent ?? null,
      inCluster: !!win?.querySelector('.beat-header-controls .beat-board-info'),
    };
  }, W);
  ok(/\d+ beats?/.test(count.inStrip || ''), `the beat count sits beside the tabs (${JSON.stringify(count.inStrip)})`);
  ok(!count.inCluster, 'and no longer in the right-hand cluster');

  // ── 2: card ↔ board separation, dark AND light ──
  await page.evaluate(() => {
    const st = window.__scStore.getState();
    const colId = st.addBeatColumn('Act I');
    st.addBeat('Alpha', colId);
  });
  await settle(page);
  const sep = async () => page.evaluate((w) => {
    const card = document.querySelector(`${w} .beat-card`);
    const board = document.querySelector(`${w} .beat-board`);
    return { card: getComputedStyle(card).backgroundColor, board: getComputedStyle(board).backgroundColor };
  }, W);
  const dark = await sep();
  ok(delta(dark.card, dark.board) >= 15, `dark theme: card clearly off the board (Δ${delta(dark.card, dark.board)} — ${dark.card} vs ${dark.board})`);
  await page.evaluate(() => window.__scStore.getState().setTheme('light'));
  await settle(page);
  const light = await sep();
  ok(delta(light.card, light.board) >= 15, `light theme: card clearly off the board (Δ${delta(light.card, light.board)})`);
  await page.evaluate(() => window.__scStore.getState().setTheme('dark'));
  await settle(page);

  // ── 3: Helper Text floats as a standard tool window AND docks ──
  await page.evaluate(() => window.__scStore.getState().openTool('helpertext'));
  await page.waitForSelector('.tool-window[data-tool="helpertext"] .dz-search-input', { timeout: 8000 });
  ok(true, 'Helper Text opens as a standard tool window (Help ▸ Developer)');
  await page.evaluate(() => {
    const st = window.__scStore.getState();
    st.setToolConfig({ ...st.toolConfig, helpertext: { side: 'right', enabled: true } });
    st.setToolMode('helpertext', 'docked');
    st.openTool('helpertext');
  });
  await settle(page);
  const docked = await page.evaluate(() => ({
    inline: !!document.querySelector('.tool-inline .htw-panel, .tool-dock-wrap .htw-panel'),
    floating: !!document.querySelector('.tool-window[data-tool="helpertext"]'),
  }));
  ok(docked.inline && !docked.floating, 'the same tool docks into the side panel (the dockInto path)');
  await page.evaluate(() => {
    const st = window.__scStore.getState();
    st.closeTool('helpertext');
    st.setToolConfig({ ...st.toolConfig, helpertext: { side: 'right', enabled: false } });
  });
  await settle(page);

  // ── 4 + 5: freeform — link highlights and header drag ──
  // (floating windows are exclusive — the Helper Text detour closed the
  // outline float; bring it back)
  await page.evaluate(() => window.__scStore.getState().openTool('beatboard'));
  await page.waitForSelector(`${W} [data-ctl="view"]`, { timeout: 8000 });
  await settle(page);
  await page.click(`${W} [data-ctl="view"]`);
  await page.click('.tool-ctl-menu .tool-ctl-menu-item:has-text("Freeform")');
  await settle(page);
  await page.evaluate(() => {
    const st = window.__scStore.getState();
    st.addBeat('Origin card', st.beatColumns[0]?.id || st.addBeatColumn('S'));
    st.addBeat('Target card', st.beatColumns[0]?.id);
    const beats = window.__scStore.getState().beats;
    const a = beats[beats.length - 2], b = beats[beats.length - 1];
    st.updateBeat(a.id, { x: 60, y: 60 });
    st.updateBeat(b.id, { x: 460, y: 60 });
  });
  await settle(page);
  const ids = await page.evaluate(() => {
    const beats = window.__scStore.getState().beats;
    return { a: beats[beats.length - 2].id, b: beats[beats.length - 1].id };
  });
  const cardSel = (id) => `${W} .beat-card-wrap-free[data-beat-id="${id}"]`;
  // arm the origin, start the line, hover the target
  await page.click(`${cardSel(ids.a)} .mind-arm-btn`);
  await settle(page);
  const armed = await page.evaluate((sel) => document.querySelector(sel)?.classList.contains('mind-armed'), cardSel(ids.a));
  ok(armed, 'arming lights the origin (mind-armed)');
  const aBox = await page.$eval(cardSel(ids.a), (el) => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  const bBox = await page.$eval(cardSel(ids.b), (el) => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.mouse.move(aBox.x, aBox.y);
  await page.mouse.down();
  await page.mouse.move(bBox.x, bBox.y, { steps: 6 });
  await settle(page);
  const midDrag = await page.evaluate((s) => ({
    origin: document.querySelector(s.a)?.classList.contains('mind-link-origin'),
    target: document.querySelector(s.b)?.classList.contains('mind-link-target'),
  }), { a: cardSel(ids.a), b: cardSel(ids.b) });
  ok(midDrag.origin, 'while the line is out, the ORIGIN card stays highlighted');
  ok(midDrag.target, 'the card under the pointer lights up as the would-be target');
  await page.mouse.up();
  await settle(page);
  const linked = await page.evaluate((aId) =>
    (window.__scStore.getState().beats.find((b) => b.id === aId)?.mindLinks ?? []).length > 0, ids.a);
  ok(linked, 'releasing over it makes the connection');

  // 5: drag by the header row (over the unfocused title input)
  const before = await page.evaluate((id) => {
    const b = window.__scStore.getState().beats.find((x) => x.id === id);
    return { x: b.x, y: b.y };
  }, ids.b);
  const title = await page.$eval(`${cardSel(ids.b)} .beat-card-title`, (el) => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.mouse.move(title.x, title.y);
  await page.mouse.down();
  await page.mouse.move(title.x + 80, title.y + 50, { steps: 5 });
  await page.mouse.up();
  await settle(page);
  const after = await page.evaluate((id) => {
    const b = window.__scStore.getState().beats.find((x) => x.id === id);
    return { x: b.x, y: b.y, focused: document.activeElement?.classList.contains('beat-card-title') ?? false };
  }, ids.b);
  ok(after.x - before.x > 50 && after.y - before.y > 30, `dragging the header (over the title) moves the card (${before.x},${before.y} → ${after.x},${after.y})`);
  ok(!after.focused, 'and the drag did not focus the title');
  // a plain click still focuses the title for editing
  await page.click(`${cardSel(ids.b)} .beat-card-title`);
  await settle(page);
  const focused = await page.evaluate(() => document.activeElement?.classList.contains('beat-card-title') ?? false);
  ok(focused, 'a plain click on the title still focuses it');
} catch (e) {
  console.log('PROBE ERROR:', e.message);
  fail++;
} finally { await browser.close(); }
console.log(`\ncheck-v652: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
