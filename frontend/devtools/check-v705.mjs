// check-v705.mjs — the add-on module, proven in the running app.
//
// The contract Derek asked for: an add-on contributes NOTHING to the app until
// it is installed, and removing it puts the app back. So the asserts check the
// tool's ABSENCE from every surface that offers tools — the Tools/Project
// menus, the ribbon palette, the Customize pickers — not just that a flag flipped.
import { launch, boot, seedScript, SCENES_4, settle } from './driver.mjs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL', m); } };

const { browser, page } = await launch();
try {
  await boot(page);
  await seedScript(page, SCENES_4);
  await settle(page);

  const addons = (fn, arg) => page.evaluate(async ({ f, a }) => {
    const m = await import('/src/addons/addonRegistry.ts');
    return m[f](a);
  }, { f: fn, a: arg });

  const offeredTools = () => page.evaluate(async () => {
    const { availableTools } = await import('/src/components/ToolDock.tsx');
    return availableTools().map((t) => t.id);
  });

  /* ── clean slate: nothing installed ─────────────────────────────────── */
  await addons('__resetAddonsForTest', []);
  let tools = await offeredTools();
  ok(!tools.includes('rewrite'),
    'with no add-ons installed, Action Rewrite is NOT among the offered tools');
  ok(!tools.includes('design'),
    'and the Design window is not offered either (developer surface)');
  ok(tools.includes('scenes') && tools.includes('characters'),
    `while the ordinary tools still are (${tools.length} offered)`);

  /* ── the menus must not offer it ────────────────────────────────────── */
  const menuHas = async (menu, text) => {
    // clicking a menu TOGGLES it, and an Escape from the previous one can land
    // mid-close — so make sure nothing is open, then open this one, and retry
    // once if the dropdown doesn't appear.
    for (let attempt = 0; attempt < 2; attempt++) {
      if (await page.$('.menu-dropdown')) { await page.keyboard.press('Escape'); await page.waitForTimeout(200); }
      await page.click(`.menu-item:has-text("${menu}")`);
      try { await page.waitForSelector('.menu-dropdown', { timeout: 3000 }); break; }
      catch { if (attempt === 1) throw new Error(`the ${menu} menu would not open`); }
    }
    const found = await page.evaluate((t) => {
      const hit = [...document.querySelectorAll('.menu-dropdown-item')]
        .some((el) => el.textContent.trim().toLowerCase().includes(t.toLowerCase()));
      return hit;
    }, text);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(120);
    return found;
  };
  ok(!(await menuHas('Tools', 'Action Rewrite')),
    'the Tools menu does not list Action Rewrite');
  ok(!(await menuHas('Help', 'Action Rewrite')),
    'and neither does Help ▸ Developer, where its entry lives');

  /* ── the ribbon palette / Customize pickers must not offer it ───────── */
  // the real export is buildRibbonPalette(placed) — it feeds the ribbon
  // "+Add" palette AND the Customize pickers, so it is the right thing to check.
  const paletteHas = (label) => page.evaluate(async (l) => {
    const { buildRibbonPalette } = await import('/src/components/ribbonPaletteData.ts');
    return JSON.stringify(buildRibbonPalette(() => false)).toLowerCase().includes(l.toLowerCase());
  }, label);
  ok((await paletteHas('Action Rewrite')) === false,
    'the ribbon / Customize picker does not offer Action Rewrite');
  ok((await paletteHas('Design')) === false,
    'and does not offer the Design window either');
  ok((await paletteHas('Scenes')) === true,
    'while still offering the ordinary tools');

  /* ── install it ─────────────────────────────────────────────────────── */
  await addons('installAddon', 'action-rewrite');
  tools = await offeredTools();
  ok(tools.includes('rewrite'),
    'installing the add-on makes the tool available');
  ok(await menuHas('Help', 'Action Rewrite'),
    'and its menu entry appears');
  ok((await paletteHas('Action Rewrite')) === true,
    'and it becomes offerable in the ribbon / Customize picker');

  /* ── the tool actually opens ────────────────────────────────────────── */
  await page.evaluate(() => window.__scStore.getState().openTool('rewrite'));
  await page.waitForTimeout(600);
  const opened = await page.evaluate(() =>
    !!document.querySelector('.rw-key-actions, [data-tool="rewrite"]')
    || [...document.querySelectorAll('.tool-window-title')].some((t) => /Rewrite/i.test(t.textContent)));
  ok(opened, 'and the Action Rewrite window opens');

  /* ── remove it: the app goes back ───────────────────────────────────── */
  await addons('removeAddon', 'action-rewrite');
  tools = await offeredTools();
  ok(!tools.includes('rewrite'), 'removing it takes the tool back out');
  ok(!(await menuHas('Help', 'Action Rewrite')), 'and its menu entry with it');

  /* ── install state survives a reload ─────────────────────────────────── */
  await addons('installAddon', 'action-rewrite');
  await page.reload();
  await boot(page);
  await settle(page);
  const afterReload = await offeredTools();
  ok(afterReload.includes('rewrite'), 'the install is remembered across a restart');
  await addons('__resetAddonsForTest', []);

} catch (e) {
  fail++;
  console.log('PROBE ERROR:', String(e).split('\n')[0]);
} finally {
  console.log(`\ncheck-v705: ${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
}
