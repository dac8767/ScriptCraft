/* check-v616 — v6.16, Derek: "if the window size is expanded to a point where
   all of the tabs would fit, this drop down is supposed to automatically
   change into the tab format. but it is not. this should be the case for both
   a popped out window and a window in the side panel."
   Root cause: the docked strip's controls span is a flex-GROW spacer (v4.90) —
   its stretched offsetWidth absorbs every free pixel, so counting it in
   naturalWidth() made `need` track the row's width and the fit test could
   never succeed once the tabs collapsed. Same self-defeating arithmetic
   v4.91 killed for the auto margin, through the width this time. */
import { launch, boot, seedScript, SCENES_4, settle } from './driver.mjs';

const { browser, page } = await launch({ width: 1500, height: 950 });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL', m); } };

/* dd = the strip is the collapsed dropdown; rowW just narrates the geometry. */
const tabState = (scope) => page.evaluate((sel) => {
  const host = document.querySelector(`${sel} .tool-chrome-tabs:not(.tool-chrome-tabs-measure)`);
  return { dd: !!host?.classList.contains('tool-chrome-tabs-dd'), rowW: host?.parentElement?.clientWidth };
}, scope);

try {
  await boot(page); await seedScript(page, SCENES_4);

  // ── in the side panel (Characters docks LEFT) ──
  await page.evaluate(() => {
    const s = window.__scStore.getState();
    s.setToolMode('characters', 'docked');
    s.openTool('characters');
  });
  await page.waitForSelector('.tool-inline[data-tool="characters"]');
  await settle(page);
  const setPanel = async (px) => {
    await page.evaluate((w) => {
      const s = window.__scStore.getState();
      s.setPanelSizeMode('left', 'custom');
      s.setChromeCustomPx('panelLeft', w);
    }, px);
    await settle(page); await settle(page);
  };
  await setPanel(250);
  let st = await tabState('.tool-inline[data-tool="characters"]');
  ok(st.dd, `narrow panel collapses the tabs into the dropdown (rowW ${st.rowW})`);
  await setPanel(700);
  st = await tabState('.tool-inline[data-tool="characters"]');
  ok(!st.dd, `widening the panel expands the dropdown back into tabs (rowW ${st.rowW})`);
  await setPanel(250);
  st = await tabState('.tool-inline[data-tool="characters"]');
  ok(st.dd, 're-narrowing the panel re-collapses them');

  // ── popped out ──
  await page.evaluate(() => {
    const s = window.__scStore.getState();
    s.closeTool('characters');
    s.setToolMode('characters', 'floating');
    s.openTool('characters');
  });
  await page.waitForSelector('.tool-window');
  await settle(page);
  const setWin = async (w) => {
    await page.evaluate((width) => window.__scStore.getState().setToolSize('characters', width, 500), w);
    await settle(page); await settle(page);
  };
  await setWin(360);
  st = await tabState('.tool-window');
  ok(st.dd, `narrow floating window collapses the tabs (rowW ${st.rowW})`);
  await setWin(900);
  st = await tabState('.tool-window');
  ok(!st.dd, `widening the window expands the dropdown back into tabs (rowW ${st.rowW})`);
  await setWin(360);
  st = await tabState('.tool-window');
  ok(st.dd, 're-narrowing the window re-collapses them');
} catch (e) {
  console.log('PROBE ERROR:', e.message);
  await page.screenshot({ path: '/tmp/v616-err.png' }).catch(() => {});
} finally { await browser.close(); }
console.log(`\ncheck-v616: ${pass} passed, ${fail} failed`);
