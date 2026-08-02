// devtools/check-v539.mjs — Title Page: the hand-grabber tool pans the
// zoomed preview; off = drags do nothing.
import { launch, boot, seedScript, openTool, SCENES_4 } from './driver.mjs';
const SHOTS = '/tmp/claude-0/-home-user-ScriptCraft/e4449e3e-5198-5997-9e57-bd93d663743c/scratchpad';
let pass = 0, fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FAIL: ${label}`); }
};
const { browser, page } = await launch();
await boot(page);
await seedScript(page, SCENES_4);

await openTool(page, 'Title Page');
await page.waitForSelector('.tp-preview-scroll', { timeout: 8000 });
ok(!!(await page.$('.tp-preview-zoom .tp-pan-toggle')), 'the hand button sits in the zoom cluster');

// zoom until the page overflows the scroll box
for (let i = 0; i < 6; i++) await page.click('.tp-preview-zoom button[title="Zoom in"]');
await page.waitForTimeout(200);
const dims = await page.evaluate(() => {
  const el = document.querySelector('.tp-preview-scroll');
  return { sw: el.scrollWidth, cw: el.clientWidth, sh: el.scrollHeight, ch: el.clientHeight };
});
console.log(`  (dims: ${JSON.stringify(dims)})`);
ok(dims.sw > dims.cw && dims.sh > dims.ch, 'zoomed page overflows the preview (something to pan)');

const scrollBox = await (await page.$('.tp-preview-scroll')).boundingBox();
const cx = scrollBox.x + scrollBox.width / 2, cy = scrollBox.y + scrollBox.height / 2;
const drag = async () => {
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 80, cy - 60, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(120);
};
const scrollNow = () => page.evaluate(() => {
  const el = document.querySelector('.tp-preview-scroll');
  return { l: Math.round(el.scrollLeft), t: Math.round(el.scrollTop) };
});

// hand OFF: a drag moves nothing
const before = await scrollNow();
await drag();
const offDrag = await scrollNow();
ok(offDrag.l === before.l && offDrag.t === before.t,
  `hand OFF — drag pans nothing (${offDrag.l},${offDrag.t})`);

// hand ON: the same drag pans
await page.click('.tp-pan-toggle');
const cursor = await page.evaluate(() => getComputedStyle(document.querySelector('.tp-preview-scroll')).cursor);
ok(cursor === 'grab', `hand ON — grab cursor (${cursor})`);
await drag();
const onDrag = await scrollNow();
ok(onDrag.l >= before.l + 60 && onDrag.t >= before.t + 40,
  `and the drag PANS the preview (Δ ${onDrag.l - before.l},${onDrag.t - before.t})`);
await page.screenshot({ path: `${SHOTS}/v539-titlepage-pan.png` });

// toggle back off
await page.click('.tp-pan-toggle');
const cursorOff = await page.evaluate(() => getComputedStyle(document.querySelector('.tp-preview-scroll')).cursor);
ok(cursorOff !== 'grab', `off again — cursor back (${cursorOff})`);

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
