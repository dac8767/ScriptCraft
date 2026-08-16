/* check-v722 — Derek's gear, in both renderers.
 *
 * "replace the settings icon with this. i've already make it white, so all you
 * need to do is scale it to match the other icons in the ScriptCraft menu."
 *
 * The art is now HIS FILE (src/assets/settings-gear.png). Two things this
 * check exists to catch, both of which fail silently:
 *   · the mask URL not resolving — a mask that 404s paints NOTHING, and an
 *     empty span looks exactly like a menu item that has no icon
 *   · the white file being used as an <img> instead of a mask, which is
 *     invisible on the light themes (his file is pure white — measured)
 */
import { readFileSync } from 'node:fs';
import { launch, boot, settle } from './driver.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};

const { browser, page } = await launch();
await boot(page);
await settle(page);

console.log('\n1. the asset is served');
const asset = await page.evaluate(async () => {
  const css = [...document.styleSheets].flatMap((s) => {
    try { return [...s.cssRules].map((r) => r.cssText); } catch { return []; }
  }).find((t) => t.includes('icon-gear-mask'));
  if (!css) return { css: null };
  const url = (css.match(/url\(["']?([^"')]+)["']?\)/) || [])[1];
  let status = 0;
  try { status = (await fetch(url, { method: 'GET' })).status; } catch { /* below */ }
  return { css, url, status };
});
ok('the mask rule reaches the browser', !!asset.css, 'no .icon-gear-mask rule found');
ok('…and names the gear file', /settings-gear\.png/.test(asset.url || ''), String(asset.url));
ok('…which the server actually serves (a 404 mask paints nothing)',
  asset.status === 200, `HTTP ${asset.status} for ${asset.url}`);

console.log('\n2. the in-app icon paints');
/* The Settings entry lives under Help. Open it and measure the icon. */
const icon = await page.evaluate(async () => {
  /* The top-level triggers are the PARENTS of `.menu-label` — clicking the
     label span itself does nothing, which is why the first cut of this check
     reported "no gear" against a perfectly good icon. */
  const help = [...document.querySelectorAll('.menu-label')]
    .find((l) => /^Help$/i.test(l.textContent.trim()))?.parentElement;
  help?.click();
  await new Promise((r) => setTimeout(r, 250));
  const el = document.querySelector('.icon-gear-mask');
  if (!el) return { found: false };
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return {
    found: true,
    w: Math.round(r.width), h: Math.round(r.height),
    mask: cs.webkitMaskImage || cs.maskImage,
    bg: cs.backgroundColor,
    display: cs.display,
  };
});
ok('the Settings item renders the gear', icon.found, JSON.stringify(icon));
ok('…at a real size, not a collapsed span',
  icon.found && icon.w >= 8 && icon.h >= 8, JSON.stringify(icon));
ok('…as a MASK, so it takes the theme colour rather than being white',
  /url\(/.test(icon.mask || ''), String(icon.mask).slice(0, 60));
ok('…painted with an actual colour', icon.found && icon.bg !== 'rgba(0, 0, 0, 0)', String(icon.bg));

console.log('\n3. one gear, two renderers');
const nat = readFileSync(new URL('../src/menu/nativeMenuSync.ts', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../src/components/uiIcons.tsx', import.meta.url), 'utf8');
ok('the macOS menu item reads the same file',
  /assets\/settings-gear\.png/.test(nat) && /drawImage\(/.test(nat), '');
ok('…scaled, not stretched to the full box', /INSET/.test(nat) && /rasterizeGear\(32\)/.test(nat), '');
ok('no drawn gear is left to drift out of step',
  !/GEAR_PATH|GEAR_D\b/.test(ui) && !/new Path2D/.test(nat), '');

console.log(`\ncheck-v722: ${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
