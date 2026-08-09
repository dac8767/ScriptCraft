/* check-v652 — Derek's five:
   1 the beat count sits LEFT, beside the outline tabs (not in the cluster)
   2 beat cards visibly separate from the board background in EVERY theme
     (color-mix step toward the theme's text color — sampled on two themes)
   3 Helper Text is a real tool: floats like a window AND docks into a panel
   4 freeform cards drag by the whole header row (title input still focuses
     on a plain click; v6.53 rebuilt the connect flow — see check-v653) */
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
    const info = win?.querySelector('.tool-window-header .beat-board-info');
    if (!info) return { text: null };
    const strip = win.querySelector('.tool-chrome-tabs:not(.tool-chrome-tabs-measure)');
    const i = info.getBoundingClientRect(), s = strip.getBoundingClientRect();
    const row = info.parentElement.getBoundingClientRect();
    const cs = getComputedStyle(info);
    return {
      text: info.textContent,
      afterStrip: i.left >= s.right,                       // beside the tabs
      boxed: !!strip.contains(info),                       // v6.56: not inside the pill
      gap: Math.round(i.left - s.right),
      border: cs.borderStyle !== 'none' && parseFloat(cs.borderWidth) > 0,
      // centered in the header row (within a pixel of the row's middle)
      offCenter: Math.abs((i.top + i.bottom) / 2 - (row.top + row.bottom) / 2),
      inCluster: !!win.querySelector('.beat-header-controls .beat-board-info'),
    };
  }, W);
  ok(/\d+ beats?/.test(count.text || ''), `the beat count sits beside the tabs (${JSON.stringify(count.text)})`);
  ok(!count.inCluster, 'and no longer in the right-hand cluster');
  // v6.56, Derek: out of the tab pill (no box), spaced off the + button, centered
  ok(!count.boxed && !count.border, 'the count is bare text — outside the tab strip\'s box');
  ok(count.afterStrip && count.gap >= 8, `there is space between it and the + button (${count.gap}px)`);
  ok(count.offCenter <= 1.5, `it sits vertically centered in the header (off by ${count.offCenter.toFixed(1)}px)`);

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
  /* (v6.53 replaced arm-then-drag with click-place-click and moved the
     Connect button to the card's corner — that flow, its highlights and the
     edge anchors are covered end to end by check-v653.) */

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

  // ── v6.57: a preset fills each section, and the divider before + ──
  await page.evaluate(() => window.__scStore.getState().openTool('beatboard'));
  await page.waitForSelector(`${'.tool-window[data-tool="beatboard"]'} [data-ctl="view"]`, { timeout: 8000 });
  await page.click(`${W} [data-ctl="view"]`);
  await page.click('.tool-ctl-menu .tool-ctl-menu-item:has-text("Sections")');
  await settle(page);
  await page.evaluate(() => {
    const st = window.__scStore.getState();
    st.setBeatColumns([]); st.setBeats([]);
    st.addOutlineTab();                       // a clean tab for the preset
  });
  await settle(page);
  await page.selectOption(`${W} .beat-board-preset`, '3act');
  await settle(page);
  const preset = await page.evaluate(() => {
    const st = window.__scStore.getState();
    const cols = [...st.beatColumns].sort((a, b) => a.position - b.position);
    return cols.map((c) => {
      const inCol = st.beats.filter((b) => b.columnId === c.id);
      return {
        title: c.title,
        budget: c.targetPages,
        beats: inCol.length,
        pages: inCol.reduce((sum, b) => sum + (b.outlineSpan ?? 0), 0),
        spans: [...new Set(inCol.map((b) => b.outlineSpan))],
      };
    });
  });
  ok(preset.length === 3 && preset.every((c) => c.beats === 20),
    `3-Act fills each act with 20 beats (${preset.map((c) => c.beats).join('/')})`);
  ok(preset.every((c) => c.spans.length === 1 && c.spans[0] === 2),
    'every one of them is a 2-page beat');
  ok(preset.every((c) => c.pages === c.budget),
    `each act's beats add up to its page budget (${preset.map((c) => `${c.pages}/${c.budget}`).join(' ')})`);
  // the cards really are on the board, not just in the store
  const cards = await page.evaluate((w) => document.querySelectorAll(`${w} .beat-column-cards .beat-card`).length, W);
  ok(cards === 60, `all 60 cards render (${cards})`);
  // ONE undo step takes the whole preset back (not 60)
  await page.evaluate(() => window.__scStore.getState().beatUndo());
  await settle(page);
  const undone = await page.evaluate(() => ({
    beats: window.__scStore.getState().beats.length,
    cols: window.__scStore.getState().beatColumns.length,
  }));
  ok(undone.beats === 0 && undone.cols === 0, `one undo removes the whole preset (${JSON.stringify(undone)})`);

  // v6.58, Derek: closing a tab DELETES that arrangement — say delete
  const tabX = await page.evaluate((w) => {
    const x = document.querySelector(`${w} .tool-chrome-tabs:not(.tool-chrome-tabs-measure) .tool-chrome-tab-x`);
    return x ? x.getAttribute('title') : null;
  }, W);
  ok(tabX && /^Delete/.test(tabX) && !/close/i.test(tabX), `the tab's × says delete (${JSON.stringify(tabX)})`);

  // Derek: "add a clear divider between the outline tabs and the + button"
  const divider = await page.evaluate((w) => {
    const add = document.querySelector(`${w} .tool-chrome-tabs:not(.tool-chrome-tabs-measure) .beat-tab-add`);
    const cs = getComputedStyle(add);
    return { w: parseFloat(cs.borderLeftWidth), style: cs.borderLeftStyle, color: cs.borderLeftColor };
  }, W);
  ok(divider.w >= 1 && divider.style === 'solid', `the + button carries a divider rule (${divider.w}px ${divider.style})`);

} catch (e) {
  console.log('PROBE ERROR:', e.message);
  fail++;
} finally { await browser.close(); }
console.log(`\ncheck-v652: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
