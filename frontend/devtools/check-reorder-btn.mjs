// devtools/check-reorder-btn.mjs — v5.19, Derek: "change the reorder button
// to match this format" (screenshot of a dialog's Cancel/Apply). The button
// wears `dialog-btn dialog-btn-primary` now, so the proof is computed-style
// EQUALITY against a real dialog-primary probe — not hardcoded colors.
// Active state must STAY amber (unapplied order ≠ available action).
import { launch, boot, seedScript, openTool, waitScenes, shot, SCENES_4, settle, useSceneList } from './driver.mjs';

const results = [];
const check = (n, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  results.push(ok);
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${n.padEnd(46)} got ${JSON.stringify(got)}${ok ? '' : `  want ${JSON.stringify(want)}`}`);
};

const { browser, page } = await launch({ width: 1500, height: 950 });
await boot(page);
await seedScript(page, SCENES_4);
/* v7.70: the shipped defaults remember Scenes as fullscreen; the panel below
   is the docked one. */
await page.evaluate(() => window.__scStore.getState().setToolMode('scenes', 'docked'));
await settle(page);
await openTool(page, 'Scenes');
await useSceneList(page);
await waitScenes(page, 4);
await page.waitForSelector('.scene-reorder-btn');

// The format IS the dialog-primary format: every visual property equals a
// live probe wearing the dialog classes, in the same document.
const cmp = await page.evaluate(() => {
  const btn = document.querySelector('.scene-reorder-btn');
  const probe = document.createElement('button');
  probe.className = 'dialog-btn dialog-btn-primary';
  probe.textContent = 'Apply';
  document.body.appendChild(probe);
  const props = ['backgroundColor', 'color', 'height', 'borderRadius',
    'fontSize', 'fontWeight', 'paddingLeft', 'paddingRight', 'borderTopColor'];
  const a = getComputedStyle(btn), b = getComputedStyle(probe);
  /* Lengths within half a pixel are the same length. v7.70: the shipped
     defaults carry Derek's panel scale, so the button in the panel computes
     to 33.9911px where a probe appended to <body> gets a flat 34px — a
     rounding artefact of a scale factor, not a difference in format, which is
     what this compares. Everything that is not a length still has to match
     exactly. */
  const near = (x, y) => {
    const nx = parseFloat(x), ny = parseFloat(y);
    return Number.isFinite(nx) && Number.isFinite(ny) && /px$/.test(x) && /px$/.test(y)
      ? Math.abs(nx - ny) < 0.5 : x === y;
  };
  const diff = props.filter((p) => !near(a[p], b[p])).map((p) => `${p}: ${a[p]} vs ${b[p]}`);
  const out = { diff, bg: a.backgroundColor, fg: a.color, h: a.height };
  probe.remove();
  return out;
});
check('every visual prop equals a dialog Apply probe', cmp.diff, []);
check('filled with the accent (not a grey wash)', cmp.bg !== 'rgba(0, 0, 0, 0)' && cmp.bg !== 'rgba(128, 128, 128, 0.22)', true);
check('white text', cmp.fg, 'rgb(255, 255, 255)');

await shot(page, '.tool-action-row', new URL('./last-reorder-btn.png', import.meta.url).pathname);

// Active = amber, still visually distinct from the primary blue.
await page.click('.scene-reorder-btn');
await page.mouse.move(10, 10);   // un-hover: :hover would read the hover shade
await settle(page);
const active = await page.evaluate(() => {
  const btn = document.querySelector('.scene-reorder-btn');
  return { cls: btn.className.includes('active'), bg: getComputedStyle(btn).backgroundColor };
});
check('reorder mode ON gets the active class', active.cls, true);
check('active state stays amber', active.bg, 'rgb(232, 155, 79)');
await page.click('.scene-reorder-btn');   // leave reorder mode

await browser.close();
console.log(results.every(Boolean) ? 'ALL OK' : 'FAILURES');
process.exit(results.every(Boolean) ? 0 : 1);
