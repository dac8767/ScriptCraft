// check-v575 — the Locations window's List / Map tabs.
// Drives the REAL tab strip, uploads a real map file through the real file
// input, drags a location out of the rail onto the map, and reads back where
// the pin landed — the whole chain Derek asked for, in the app.
import { launch, boot, seedScript, openTool, SCENES_4 } from './driver.mjs';
import { writeFileSync } from 'fs';

// A realistically sized map (800x600). NOT a 2x1 test pixel: DragEvent's
// clientX/clientY are INTEGERS, so on a 1px-tall image every drop rounds to
// the same row and a fractional drop can't be measured at all.
import { deflateSync } from 'zlib';
const W = 800, H = 600;
const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) {
  const row = y * (W * 4 + 1);
  raw[row] = 0;                                   // filter: none
  for (let x = 0; x < W; x++) {
    const i = row + 1 + x * 4;
    raw[i] = 40 + ((x / W) * 120) | 0;            // a soft gradient, so the
    raw[i + 1] = 60 + ((y / H) * 90) | 0;         // map is visibly a map in
    raw[i + 2] = 90;                              // any screenshot
    raw[i + 3] = 255;
  }
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crcTable = [...Array(256)].map((_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  let crc = 0xffffffff;
  for (const b of body) crc = crcTable[(crc ^ b) & 0xff] ^ (crc >>> 8);
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([len, body, crcBuf]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 6;                          // 8-bit RGBA
const MAP_PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
]);
const MAP_PATH = '/tmp/check-v575-map.png';
writeFileSync(MAP_PATH, MAP_PNG);

const { browser, page } = await launch({ width: 1400, height: 900 });
let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`${cond ? '  ✓' : '  ✗ FAIL'} ${label}`); cond ? pass++ : fail++; };

const goto = async (label) => {
  const strip = await page.$(`.tool-chrome-tabs:not(.tool-chrome-tabs-measure) .tool-chrome-tab:text-is("${label}")`);
  if (strip && await strip.isVisible()) return strip.click();
  await page.click('.tool-chrome-tabs-dd .tool-ctl');
  await page.click(`.tool-ctl-menu .tool-ctl-menu-item:text-is("${label}")`);
};

/** A real HTML5 drag: WebKit/Chromium only start one when dragstart sets
 *  data, so this drives the actual handlers rather than calling the store. */
const dragOnto = (fromSel, toSel, xFrac, yFrac) => page.evaluate(([fs, ts, xf, yf]) => {
  const src = document.querySelector(fs);
  const stage = document.querySelector(ts);
  if (!src || !stage) return { ok: false, why: 'missing element' };
  const dt = new DataTransfer();
  src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
  // Nothing set on the dataTransfer ⇒ WebKit would refuse the drag.
  const carried = dt.getData('application/x-scriptcraft-location');
  const r = stage.getBoundingClientRect();
  const clientX = r.left + r.width * xf;
  const clientY = r.top + r.height * yf;
  const target = document.elementFromPoint(clientX, clientY) || stage;
  for (const type of ['dragover', 'drop']) {
    target.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt, clientX, clientY }));
  }
  return { ok: true, carried };
}, [fromSel, toSel, xFrac, yFrac]);

const pins = () => page.evaluate(() => window.__scStore.getState().locationPins);

try {
  await boot(page);
  await seedScript(page, SCENES_4);
  await openTool(page, 'Locations');
  // Fullscreen the window: docked at its 320px default the chrome COLLAPSES
  // its tab strip into a dropdown, and the map deserves the room anyway.
  await page.click('button[title="Fullscreen"]');
  await page.waitForSelector('.fs-tool-takeover', { timeout: 8000 });

  // ── the tabs exist, List is the default and holds the old list ──────
  const tabs = await page.$$eval('.tool-chrome-tabs:not(.tool-chrome-tabs-measure) .tool-chrome-tab',
    (els) => els.filter((e) => e.offsetParent !== null).map((e) => e.textContent.trim()));
  ok(tabs.join('/') === 'List/Map', `the window has List and Map tabs (${tabs.join('/') || 'none'})`);
  ok(await page.$('.location-group') !== null, 'List tab shows the location list');
  ok(await page.$('.locmap') === null, 'the map is not rendered on the List tab');

  // ── Map tab: empty state ───────────────────────────────────────────
  await goto('Map');
  await page.waitForSelector('.locmap', { timeout: 8000 });
  ok(await page.$('.location-group') === null, 'Map tab replaces the list');
  ok(await page.$('.locmap-empty') !== null, 'with no map yet, the Map tab offers to add one');
  const railCount = await page.$$eval('.locmap-rail-item', (e) => e.length);
  ok(railCount > 0, `the rail lists the locations to place (${railCount})`);
  ok(await page.$eval('.locmap-rail-item', (e) => !e.draggable), 'rail rows are NOT draggable before a map exists');

  // ── upload a map through the real input ────────────────────────────
  await page.setInputFiles('.locmap input[type="file"]', MAP_PATH);
  await page.waitForSelector('.locmap-stage img.locmap-img', { timeout: 8000 });
  ok(true, 'a local image file becomes the map background');
  ok(await page.$eval('.locmap-rail-item', (e) => e.draggable), 'rail rows become draggable once a map is there');

  // ── drag a location onto the map ───────────────────────────────────
  const firstName = await page.$eval('.locmap-rail-item .locmap-rail-name', (e) => e.textContent.trim());
  const drag = await dragOnto('.locmap-rail-item', '.locmap-stage', 0.25, 0.75);
  ok(drag.carried === firstName, `dragstart sets dataTransfer data — WebKit requirement (${drag.carried || 'NOTHING'})`);
  await page.waitForTimeout(200);
  const after = await pins();
  ok(after.length === 1 && after[0].name === firstName, `dropping pins the location (${after[0]?.name})`);
  ok(Math.abs(after[0].x - 0.25) < 0.02 && Math.abs(after[0].y - 0.75) < 0.02,
    `the pin lands where it was dropped (${after[0]?.x.toFixed(2)}, ${after[0]?.y.toFixed(2)})`);
  ok(await page.$('.locmap-pin') !== null, 'the pin is drawn on the map');
  const railAfter = await page.$$eval('.locmap-rail-item', (e) => e.length);
  ok(railAfter === railCount - 1, 'the pinned location leaves the rail');

  // ── the pin holds its spot when the window resizes ─────────────────
  const posBefore = await page.$eval('.locmap-pin', (el) => {
    const s = el.closest('.locmap-stage').getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x: (r.left + r.width / 2 - s.left) / s.width, y: (r.bottom - s.top) / s.height };
  });
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.waitForTimeout(300);
  const posAfter = await page.$eval('.locmap-pin', (el) => {
    const s = el.closest('.locmap-stage').getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x: (r.left + r.width / 2 - s.left) / s.width, y: (r.bottom - s.top) / s.height };
  });
  ok(Math.abs(posBefore.x - posAfter.x) < 0.02 && Math.abs(posBefore.y - posAfter.y) < 0.02,
    'the pin keeps its place on the map when the window is resized');
  // The map must FIT the narrowed window — not size the tab and push itself
  // (and the rail) out of view, which is exactly what it used to do.
  const fits = await page.evaluate(() => {
    const stage = document.querySelector('.locmap-stage').getBoundingClientRect();
    const scroll = document.querySelector('.locmap-scroll').getBoundingClientRect();
    return { stageW: Math.round(stage.width), scrollW: Math.round(scroll.width), inside: stage.width <= scroll.width + 1 };
  });
  ok(fits.inside, `the map fits the narrowed tab (map ${fits.stageW}px in ${fits.scrollW}px)`);
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.waitForTimeout(300);

  // ── moving a pin, and taking it off ────────────────────────────────
  await dragOnto('.locmap-pin', '.locmap-stage', 0.8, 0.2);
  await page.waitForTimeout(200);
  const moved = await pins();
  ok(moved.length === 1 && Math.abs(moved[0].x - 0.8) < 0.02,
    `dragging a pin MOVES it rather than adding a second (${moved.length} pin, x=${moved[0]?.x.toFixed(2)})`);

  await page.hover('.locmap-pin');
  await page.click('.locmap-pin-remove');
  await page.waitForTimeout(200);
  ok((await pins()).length === 0, 'the pin\'s × takes it off the map');
  ok(await page.$$eval('.locmap-rail-item', (e) => e.length) === railCount, 'and it returns to the rail');

  // ── the tab choice persists; the List tab is untouched ─────────────
  await goto('List');
  ok(await page.$('.location-group') !== null, 'List tab still shows the original list');
} catch (e) {
  console.log('  ✗ SCRIPT ERROR:', e.message);
  fail++;
} finally {
  await browser.close();
}
console.log(`\ncheck-v575: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
