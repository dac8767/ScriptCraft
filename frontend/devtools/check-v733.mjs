/* check-v733 — Derek's four, from one reload of v7.32.
 *
 *   1 "design tool is not in the dev menu like it should be."
 *   2 "'AI Writer' is an option for the side panels… Action Rewrite was
 *      supposed to be fully removed"
 *   4 "the menu icons are not pure white. they are dddddd. change the gear
 *      icon color to match"
 *
 * (3 was the gap reporting itself fixed — no code, see the commit message.)
 *
 * #1 and #2 are the same failure from opposite ends. Design EXISTS and had no
 * door: devOnly hides it from the tool rail and from Customize ▸ Panels, and
 * nothing in any menu opened it, so the only thing that could was a test. AI
 * Writer was DELETED and still had a door: the panel list is rebuilt from
 * persisted state, so a saved layout naming a tool brings it back however
 * thoroughly the component is gone. Neither is caught by reading the source —
 * both need the app open, which is what this does.
 */
import { readFileSync } from 'node:fs';
import { launch, boot, settle } from './driver.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};
const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

const openMenu = async (page, label) => {
  for (const el of await page.$$('.menu-bar *')) {
    if ((await el.textContent())?.trim() === label) { await el.click(); await settle(page); return true; }
  }
  return false;
};

const { browser, page } = await launch();
await boot(page);
await settle(page);

console.log('\n1. Design has a door');

ok('opened the Help menu', await openMenu(page, 'Help'));
await page.waitForSelector('.menu-dropdown', { timeout: 5000 });
/* Submenu children are always in the DOM (`.menu-submenu` is hidden by class,
   not unmounted), so the list can be read without driving a hover. */
const dev = await page.evaluate(() => {
  const row = [...document.querySelectorAll('.menu-dropdown-item.has-children')]
    .find((r) => (r.textContent || '').trim().startsWith('Developer'));
  if (!row) return { found: false };
  const labels = [...row.querySelectorAll('.menu-submenu .menu-dropdown-item')]
    .map((r) => [...r.children].filter((c) => !c.className).map((c) => c.textContent).join('').trim()
      || (r.textContent || '').trim())
    .filter(Boolean);
  return { found: true, labels };
});
ok('Help ▸ Developer found', dev.found === true, JSON.stringify(dev));
// Prove the scan sees the submenu at all before trusting what it says is in it.
ok('…the scan can read that submenu', (dev.labels || []).includes('Diagnostics'), JSON.stringify(dev.labels));
ok('…and it lists Design…', (dev.labels || []).includes('Design…'), JSON.stringify(dev.labels));

/* Measured HERE, while the Help menu from this section is already open. The
   gear lives on that menu's Settings… item, and Customize (section 2) leaves a
   .dialog-overlay that intercepts any later attempt to reopen it. Reported
   under 4 below. */
const ink = await page.evaluate(() => {
  const gear = document.querySelector('.icon-gear-mask');
  return {
    found: !!gear,
    gear: gear ? getComputedStyle(gear).backgroundColor : null,
    token: getComputedStyle(document.documentElement).getPropertyValue('--fd-icon-strong').trim(),
  };
});

const opened = await page.evaluate(async () => {
  const item = [...document.querySelectorAll('.menu-submenu .menu-dropdown-item')]
    .find((r) => /^Design…/.test((r.textContent || '').trim()));
  if (!item) return { clicked: false };
  item.click();
  await new Promise((r) => setTimeout(r, 1000));
  return {
    clicked: true,
    // the Design surface is identified by its own search box + groups
    rendered: !!document.querySelector('.dz-search-input') && !!document.querySelector('.dz-group'),
  };
});
ok('clicking it actually opens the Design window', opened.rendered === true, JSON.stringify(opened));

/* The point of the item: devOnly still hides Design everywhere else, so the
   menu is the ONLY door. If that stops being true the item is redundant, and
   if devOnly is dropped the item is not the door any more — either way this
   is the assumption worth pinning. */
const dock = src('components/ToolDock.tsx');
ok('Design is still devOnly (the menu is its only door)',
  /\{ id: 'design',[^\n]*devOnly: true/.test(dock), '');

console.log('\n2. AI Writer is gone');

await page.keyboard.press('Escape');
await settle(page);
const gone = await page.evaluate(async () => {
  const st = window.__scStore.getState();
  st.closeTool('design');
  // Put the dead id back the way a stale saved layout would, then look at
  // what the app rebuilds from it.
  st.setToolConfig({ ...st.toolConfig, aiwriter: { side: 'right', enabled: true } });
  await new Promise((r) => setTimeout(r, 400));
  const railLabels = [...document.querySelectorAll('.tool-dock-item')].map((e) => (e.textContent || '').trim());
  return { railLabels, inRail: railLabels.some((l) => /AI Writer/i.test(l)) };
});
ok('the rail rendered (else the next line proves nothing)',
  (gone.railLabels || []).includes('Scenes'), JSON.stringify(gone.railLabels));
ok('AI Writer is not in the tool rail', gone.inRail === false, JSON.stringify(gone.railLabels));

/* Customize is MenuBar-local state, opened from View ▸ Customize… — the
   side-panel list Derek was actually looking at. */
await openMenu(page, 'View');
await page.waitForSelector('.menu-dropdown', { timeout: 5000 });
const cz = await page.evaluate(async () => {
  const item = [...document.querySelectorAll('.menu-dropdown-item')]
    .find((r) => /^Customize/.test((r.textContent || '').trim()));
  if (!item) return { opened: false, why: 'no Customize item' };
  item.click();
  await new Promise((r) => setTimeout(r, 1100));
  const body = document.body.innerText || '';
  return {
    opened: /Panels/i.test(body),
    // every OTHER panel tool must still be listed — that is what makes the
    // absence of one name meaningful rather than an empty dialog passing.
    listsOtherTools: /Thesaurus/i.test(body) && /Goals/i.test(body),
    anywhereOnScreen: /AI Writer/i.test(body),
  };
});
ok('View ▸ Customize… opened the panel list', cz.opened === true, JSON.stringify(cz));
ok('…and that list has the other tools in it', cz.listsOtherTools === true, JSON.stringify(cz));
ok('…but not AI Writer', cz.anywhereOnScreen === false, '');

/* The component, its styles and the ribbon exception all went with it — a
   tool half-removed is the kind of thing that grows back. */
ok('the component file is gone', (() => {
  try { src('components/AiWriterTool.tsx'); return false; } catch { return true; }
})(), '');
ok('its stylesheet block is gone', !/fs-aiwriter/.test(src('styles/screenplay/20-tool-dock.css')), '');
ok('the ribbon no longer special-cases it', !/aiwriter/.test(src('components/ribbonPaletteData.ts')), '');
ok('the retirement map records it as DROPPED, not merged',
  /aiwriter:\s*null/.test(src('stores/editorStore.ts')), '');

console.log('\n4. the gear matches the menu ink');

// FIRST that the gear exists — "not white" was passing on a null before this.
ok('the gear is on screen to be measured', ink.found === true, JSON.stringify(ink));
ok('it is no longer pure white', ink.found && ink.gear !== 'rgb(255, 255, 255)', String(ink.gear));
ok('…it is #dddddd, the ink Derek measured', ink.gear === 'rgb(221, 221, 221)', String(ink.gear));
ok('…driven by the --fd-icon-strong token', ink.token === '#dddddd', ink.token);

/* ONE definition for two renderers: the macOS item rasterizes the same asset
   and must tint from the same token, or the in-app gear and the menu gear
   drift the moment either changes. */
const native = src('menu/nativeMenuSync.ts');
ok('the native menu tints from that same token', /--fd-icon-strong/.test(native), '');
ok('…keeping his alpha (source-in replaces colour, not shape)',
  /globalCompositeOperation\s*=\s*'source-in'/.test(native), '');
ok('…and a theme change rebuilds the menu, so the tint follows',
  /const ink[\s\S]{0,200}return JSON\.stringify\(\[ink,/.test(native), '');

console.log(`\ncheck-v733: ${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
