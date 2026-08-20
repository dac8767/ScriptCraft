/* check-v733 — Derek's four, from one reload of v7.32.
 *
 *   1 "design tool is not in the dev menu like it should be."
 *   2 "'AI Writer' is an option for the side panels…" — REVERSED in v7.68
 *     ("readd the ai writer tool"); check-v768 holds it now. Originally:
 *     "Action Rewrite was
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

console.log('\n2. AI Writer — MOVED to check-v768');
/* v7.68, Derek: "readd the ai writer tool." Everything this section asserted
   is now false ON PURPOSE, and check-v768 asserts the opposite: the tool is in
   the registry, opens, renders its line, has its stylesheet back, and carries
   no retirement entry that would strip it out of a saved layout again.
   The MECHANISM the section was really guarding — a null heir means DROPPED,
   so a deleted tool cannot come back from persisted state — outlived the tool
   and is exercised against a synthetic id in stores/toolMigrations.test.ts.
   Two checks asserting opposite things about the same four files is how one of
   them ends up quietly wrong. */

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
