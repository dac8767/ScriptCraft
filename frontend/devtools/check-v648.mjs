/* check-v648 — Derek's seven-item batch:
   1 View menu says "Themes" (was "Theme")
   2 clicking a theme row in Customize ▸ Themes APPLIES the theme
   3 applying an outline preset names the tab after it
   4 the outline Presets dropdown wears the standard input background
   5 Script History says Snapshot everywhere (no "Auto Save" left)
   6 the per-tab ◉ is gone; "Show in Outline Bar" checkbox in the header
   7 the outline variation tabs live in the WINDOW HEADER (shared strip),
     with + / double-click-rename / × riding along */
import { launch, boot, seedScript, SCENES_4, settle, showAllHelperText } from './driver.mjs';

const { browser, page } = await launch({ width: 1500, height: 950 });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL', m); } };

/* The menu bar is a TOGGLE — a click while another menu is open just closes
   it. Click until this menu's dropdown is actually open. */
async function openMenu(name) {
  for (let i = 0; i < 3; i++) {
    await page.click(`.menu-item:has-text("${name}")`);
    await settle(page);
    if (await page.evaluate(() => !!document.querySelector('.menu-dropdown'))) return;
  }
  throw new Error(`could not open the ${name} menu`);
}

try {
  await boot(page);
  /* v7.70: the shipped defaults are Derek's preset, and he has ~200 helper
     strings hidden. This window filters those out, so every count and lookup
     below was reading his housekeeping instead of the app's. */
  await showAllHelperText(page);
  await seedScript(page, SCENES_4);

  // ── 1: View ▸ Themes ──
  await openMenu('View');
  const viewItems = await page.evaluate(() => {
    const root = document.querySelector('.menu-dropdown');
    return [...(root?.querySelectorAll(':scope > .menu-dropdown-item') ?? [])]
      .map((el) => el.textContent.trim()).filter(Boolean);
  });
  ok(viewItems.some((t) => t.startsWith('Themes')), `View menu holds "Themes" (${JSON.stringify(viewItems.filter((t) => t.includes('Theme')))})`);
  ok(!viewItems.some((t) => t === 'Theme'), 'the bare "Theme" label is gone');
  await page.keyboard.press('Escape');
  await settle(page);

  // ── 5: File ▸ Script History flyout says Snapshot ──
  await openMenu('File');
  await page.hover('.menu-dropdown-item:has-text("Script History")');
  await settle(page);
  const flyout = await page.evaluate(() => {
    // collect every open dropdown's items — the flyout markup nests
    return [...document.querySelectorAll('.menu-dropdown .menu-dropdown-item')]
      .map((el) => el.textContent.trim()).filter(Boolean);
  });
  ok(flyout.some((t) => t.startsWith('Take Snapshot')), `flyout: Take Snapshot… (${JSON.stringify(flyout)})`);
  ok(flyout.includes('Snapshots'), 'flyout: Snapshots');
  ok(flyout.some((t) => t.startsWith('Compare with Snapshot')), 'flyout: Compare with Snapshot…');
  ok(flyout.some((t) => t.includes('Since Last Snapshot')), 'flyout: Track Changes Since Last Snapshot');
  ok(!flyout.some((t) => /auto.?save/i.test(t)), 'no "Auto Save" left in the flyout');
  await page.keyboard.press('Escape');
  await settle(page);

  /* Every menu really shut, verified — not "an Escape was pressed".
     ESCAPE DOES NOT CLOSE THE IN-APP MENU. Measured both ways in v7.70, with
     menuSystem native and app, flyout hovered or not: the dropdown stays up.
     A click away closes it. That is a real gap and it is NOT new — this check
     has been pressing Escape and leaving the File menu open since it was
     written; it only started failing when the shipped defaults moved the
     preferences window under where the dropdown lands, so the leftover menu
     began swallowing the click below. Reported to Derek as its own item;
     fixing the menu is not this version's job, but a check that believes it
     closed something it did not is worth nothing either way. */
  for (let i = 0; i < 6; i++) {
    if (!await page.evaluate(() => !!document.querySelector('.menu-dropdown'))) break;
    await page.keyboard.press('Escape');
    await settle(page);
    if (await page.evaluate(() => !!document.querySelector('.menu-dropdown'))) {
      await page.mouse.click(1200, 700);      // away from the bar and the dropdown
      await settle(page);
    }
  }
  if (await page.evaluate(() => !!document.querySelector('.menu-dropdown'))) {
    throw new Error('a menu dropdown is still open — it would swallow the clicks below');
  }

  // ── 2: clicking a theme row applies it (Settings ▸ Themes = same tab) ──
  await page.evaluate(() => window.__scStore.getState().openPreferences('cz-themes'));
  await page.waitForSelector('.prefs-window .fs-theme-click', { timeout: 8000 });
  await page.click('.prefs-window .fs-theme-click:has-text("Sepia")');
  await settle(page);
  const applied = await page.evaluate(() => ({
    attr: document.documentElement.getAttribute('data-theme'),
    store: window.__scStore.getState().theme,
  }));
  ok(applied.store === 'sepia' && applied.attr === 'sepia', `clicking the Sepia row applied it (data-theme=${applied.attr})`);
  await page.evaluate(() => window.__scStore.getState().setTheme('dark'));
  await page.evaluate(() => window.__scStore.getState().closePreferences?.());
  await page.keyboard.press('Escape');
  await settle(page);

  // ── 7: the Outline window's tabs live in the HEADER strip ──
  await page.evaluate(() => {
    // Wide enough for the full strip — at narrow widths the tabs collapse
    // into the v5.71 dropdown pill by design (two-stage overflow).
    window.__scStore.setState((s) => ({ toolSizes: { ...s.toolSizes, beatboard: { w: 1400, h: 700 } } }));
    const st = window.__scStore.getState();
    st.setToolMode('beatboard', 'floating');
    st.openTool('beatboard');
  });
  await page.waitForSelector('.tool-window[data-tool="beatboard"]', { timeout: 8000 });
  const W = '.tool-window[data-tool="beatboard"]';
  const headerTabs = await page.evaluate((w) => {
    const win = document.querySelector(w);
    return {
      stripTabs: [...(win?.querySelectorAll('.tool-chrome-tabs:not(.tool-chrome-tabs-measure) .tool-chrome-tab') ?? [])].map((b) => b.textContent.replace('×', '').trim()),
      addBtn: !!win?.querySelector('.tool-chrome-tabs:not(.tool-chrome-tabs-measure) .beat-tab-add'),
      bodyTabsRow: !!win?.querySelector('.beat-tabs'),
      dot: !!document.querySelector('.beat-tab-use'),
    };
  }, W);
  ok(headerTabs.stripTabs.length >= 1, `variation tabs render in the header strip (${JSON.stringify(headerTabs.stripTabs)})`);
  ok(headerTabs.addBtn, 'the + (new variation) button rides the header strip');
  ok(!headerTabs.bodyTabsRow, 'the in-board tabs row is gone in window mode');
  ok(!headerTabs.dot, 'the per-tab ◉ bar-picker is gone everywhere');

  // ── 6: "Show in Outline Bar" checkbox in the header ──
  const cb0 = await page.evaluate((w) => {
    const c = document.querySelector(`${w} .beat-bar-check input`);
    return c ? { checked: c.checked, disabled: c.disabled } : null;
  }, W);
  ok(cb0 && cb0.checked && cb0.disabled, `single tab: checkbox checked + locked (${JSON.stringify(cb0)})`);
  await page.click(`${W} .tool-chrome-tabs:not(.tool-chrome-tabs-measure) .beat-tab-add`);
  await settle(page);
  const cb1 = await page.evaluate((w) => {
    const c = document.querySelector(`${w} .beat-bar-check input`);
    return { checked: c.checked, disabled: c.disabled, tabs: window.__scStore.getState().outlineTabs.length };
  }, W);
  ok(cb1.tabs === 2 && !cb1.checked && !cb1.disabled, `new tab is viewed: checkbox unchecked + live (${JSON.stringify(cb1)})`);
  await page.click(`${W} .beat-bar-check input`);
  await settle(page);
  const cb2 = await page.evaluate(() => {
    const s = window.__scStore.getState();
    return { moved: s.outlineBarTab === s.viewedOutlineTab };
  });
  ok(cb2.moved, 'checking it points the Outline Bar at the viewed tab');

  // ── 3 + 4: the Presets dropdown — standard background, apply names the tab ──
  const presetBg = await page.evaluate((w) => {
    const el = document.querySelector(`${w} .beat-board-preset`);
    return el ? getComputedStyle(el).backgroundColor : null;
  }, W);
  ok(presetBg && presetBg !== 'rgba(0, 0, 0, 0)' && presetBg !== 'transparent',
    `Presets dropdown has a real background (${presetBg})`);
  await page.selectOption(`${W} .beat-board-preset`, '3act');
  await settle(page);
  const named = await page.evaluate((w) => {
    const s = window.__scStore.getState();
    const tab = s.outlineTabs.find((t) => t.id === s.viewedOutlineTab);
    const strip = [...(document.querySelector(w)?.querySelectorAll('.tool-chrome-tabs:not(.tool-chrome-tabs-measure) .tool-chrome-tab.active') ?? [])]
      .map((b) => b.textContent.replace('×', '').trim());
    return { store: tab?.name, strip };
  }, W);
  ok(named.store === '3-Act Structure', `applying a preset renames the tab in the store (${named.store})`);
  ok(named.strip.includes('3-Act Structure'), `…and the header strip shows it (${JSON.stringify(named.strip)})`);

  // ── 7b: double-click rename swaps in the input; Escape backs out ──
  await page.dblclick(`${W} .tool-chrome-tabs:not(.tool-chrome-tabs-measure) .tool-chrome-tab.active`);
  const renameInput = await page.$(`${W} .tool-chrome-tab-rename`);
  ok(!!renameInput, 'double-click swaps the tab for a rename input');
  await page.keyboard.press('Escape');
  await settle(page);
  const renameGone = await page.evaluate((w) => !document.querySelector(`${w} .tool-chrome-tab-rename`), W);
  ok(renameGone, 'Escape leaves rename without committing');
} catch (e) {
  console.log('PROBE ERROR:', e.message);
  fail++;
} finally { await browser.close(); }
console.log(`\ncheck-v648: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
