// check-v577 — the Locations Map view, driven the way Derek described it:
// View dropdown (not tabs) → import → rotate → lock → click to pin → pick a
// location → merge two locations onto one pin → sidebar display name +
// custom field. Every step goes through the real UI.
import { launch, boot, seedScript, openTool, SCENES_4 } from './driver.mjs';
import { writeFileSync } from 'fs';
import { deflateSync } from 'zlib';

// A 800x600 map. Real size matters: DragEvent/pointer coords are integers,
// so a tiny fixture can't express a fractional position.
const W = 800, H = 600;
const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) {
  const row = y * (W * 4 + 1);
  for (let x = 0; x < W; x++) {
    const i = row + 1 + x * 4;
    raw[i] = 40 + ((x / W) * 120) | 0; raw[i + 1] = 60 + ((y / H) * 90) | 0; raw[i + 2] = 90; raw[i + 3] = 255;
  }
}
const crcTable = [...Array(256)].map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  let crc = 0xffffffff;
  for (const b of body) crc = crcTable[(crc ^ b) & 0xff] ^ (crc >>> 8);
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([len, body, crcBuf]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
const MAP_PATH = '/tmp/check-v577-map.png';
writeFileSync(MAP_PATH, Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
]));

const { browser, page } = await launch({ width: 1500, height: 950 });
let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`${cond ? '  ✓' : '  ✗ FAIL'} ${label}`); cond ? pass++ : fail++; };
const state = () => page.evaluate(() => ({
  places: window.__scStore.getState().locationPlaces,
  map: window.__scStore.getState().locationMapImage,
}));

/** Pick an item in the header's View dropdown. */
const setView = async (label) => {
  // Open only if it isn't already: clicking the trigger while the menu is
  // open TOGGLES it shut, which is what a blind click would do here.
  if (!(await page.$('.tool-ctl-menu'))) await page.click('.tool-ctl[title="View"]');
  await page.click(`.tool-ctl-menu .tool-ctl-menu-item:text-is("${label}")`);
  await page.waitForTimeout(250);
};
/** Click the map at fractions of the stage. */
const clickMap = async (xf, yf) => {
  const box = await page.$eval('.locmap-stage', (el) => {
    const b = el.getBoundingClientRect();
    return { x: b.x, y: b.y, w: b.width, h: b.height };
  });
  await page.mouse.click(box.x + box.w * xf, box.y + box.h * yf);
  await page.waitForTimeout(250);
};
const menuItem = (text) => page.click(`.locmap-pin-menu .locmap-pin-menu-item:text-is("${text}")`);

try {
  await boot(page);
  await seedScript(page, SCENES_4);
  await openTool(page, 'Locations');
  await page.click('button[title="Fullscreen"]');
  await page.waitForSelector('.fs-tool-takeover', { timeout: 8000 });

  // ── 1. List / Map is a VIEW dropdown in the header, not a tab strip ──
  const tabStrip = await page.$$eval('.tool-chrome-tabs:not(.tool-chrome-tabs-measure) .tool-chrome-tab',
    (els) => els.map((e) => e.textContent.trim()));
  ok(!tabStrip.includes('Map'), `no List/Map tab strip any more (found: ${tabStrip.join('/') || 'none'})`);
  await page.click('.tool-ctl[title="View"]');
  const viewItems = await page.$$eval('.tool-ctl-menu .tool-ctl-menu-item', (els) => els.map((e) => e.textContent.trim()));
  ok(viewItems.join('/') === 'List/Map', `the View dropdown offers List and Map (${viewItems.join('/')})`);
  await setView('Map');          // the menu is already open — pick from it
  await page.waitForSelector('.locmap', { timeout: 8000 });
  ok(true, 'the Map view renders');

  // ── 2. the header's options button ──────────────────────────────────
  ok(await page.$('.locmap-options-btn') !== null, 'the map options button is in the header');
  await page.click('.locmap-options-btn');
  const opts = await page.$$eval('.char-upload-menu .char-upload-menu-item', (els) => els.map((e) => e.textContent.trim()));
  ok(opts.some((o) => /background/i.test(o)), `options offer the background actions (${opts.join(' · ')})`);
  await page.keyboard.press('Escape');
  await page.mouse.click(5, 5);

  // ── 3. import → rotate → lock ───────────────────────────────────────
  await page.setInputFiles('.locmap input[type="file"]', MAP_PATH);
  await page.waitForSelector('.locmap-import-bar', { timeout: 8000 });
  ok(true, 'a fresh import opens the rotation bar');
  const beforeRot = await page.$eval('.locmap-stage', (el) => el.getBoundingClientRect().width / el.getBoundingClientRect().height);
  await page.click('.locmap-import-bar .locmap-tool-btn');       // rotate 90°
  await page.waitForTimeout(350);
  const afterRot = await page.$eval('.locmap-stage', (el) => el.getBoundingClientRect().width / el.getBoundingClientRect().height);
  ok((await state()).map.rotation === 90, 'Rotate turns the map 90°');
  ok(Math.abs(afterRot - 1 / beforeRot) < 0.05,
    `a quarter turn swaps the map's proportions (${beforeRot.toFixed(2)} → ${afterRot.toFixed(2)})`);
  ok(await page.$('.locmap-pin') === null, 'no pins can be dropped while the rotation is unset');

  await page.click('.locmap-import-bar .locmap-tool-btn');       // back to 180
  await page.click('.locmap-import-bar .locmap-tool-btn');       // 270
  await page.click('.locmap-import-bar .locmap-tool-btn');       // 0 — upright again
  await page.click('.locmap-import-confirm');
  await page.waitForTimeout(300);
  ok((await state()).map.rotationLocked === true, 'Set Rotation locks it');
  ok(await page.$('.locmap-import-bar') === null, 'and the rotation bar is gone for good');

  // ── 4. click the map → a pin + its dropdown ─────────────────────────
  await clickMap(0.3, 0.4);
  ok((await state()).places.length === 1, 'clicking the map drops a pin');
  ok(await page.$('.locmap-pin-menu') !== null, 'and its dropdown opens');
  const pin0 = (await state()).places[0];
  ok(Math.abs(pin0.x - 0.3) < 0.03 && Math.abs(pin0.y - 0.4) < 0.03,
    `the pin lands where it was clicked (${pin0.x.toFixed(2)}, ${pin0.y.toFixed(2)})`);

  // pick an existing location
  await menuItem('Add a script location…');
  const offered = await page.$$eval('.locmap-pin-menu .locmap-pin-menu-item-name', (els) => els.map((e) => e.textContent.trim()));
  ok(offered.length > 0, `the dropdown lists the script's locations (${offered.length})`);
  const firstLoc = offered[0];
  await page.click('.locmap-pin-menu .locmap-pin-menu-item:has(.locmap-pin-menu-item-name)');
  await page.waitForTimeout(250);
  ok((await state()).places[0].scriptNames[0] === firstLoc, `picking one attaches it (${firstLoc})`);
  ok(await page.$('.locmap-pin-menu') === null, 'and the dropdown closes');
  ok((await page.$eval('.locmap-pin .locmap-pin-label', (e) => e.textContent.trim())) === firstLoc,
    'the pin wears the location name');

  // ── 5. a SECOND location on the SAME pin (Derek's BELKADAN case) ────
  await page.click('.locmap-pin');
  await page.waitForSelector('.locmap-pin-menu', { timeout: 5000 });
  const title = await page.$eval('.locmap-pin-menu-title', (e) => e.textContent.trim());
  ok(title === firstLoc, `the dropdown leads with the display name (${title})`);
  await menuItem('Add a script location…');
  const second = (await page.$$eval('.locmap-pin-menu .locmap-pin-menu-item-name', (els) => els.map((e) => e.textContent.trim())))[0];
  await page.click('.locmap-pin-menu .locmap-pin-menu-item:has(.locmap-pin-menu-item-name)');
  await page.waitForTimeout(250);
  const merged = (await state()).places[0];
  ok(merged.scriptNames.length === 2 && merged.scriptNames.includes(second),
    `two script locations share one pin (${merged.scriptNames.join(' + ')})`);
  await page.click('.locmap-pin');
  await page.waitForSelector('.locmap-pin-menu', { timeout: 5000 });
  const listed = await page.$$eval('.locmap-pin-menu-attached-name', (els) => els.map((e) => e.textContent.trim()));
  ok(listed.length === 2, `and the dropdown lists BOTH attached script locations (${listed.join(', ')})`);
  await page.mouse.click(5, 5);
  await page.waitForTimeout(200);

  // ── 6. the sidebar: display name, description, custom field ─────────
  await page.click(`.locmap-rail-row:has-text("${firstLoc}")`);
  await page.waitForSelector('.locmap-rail-detail', { timeout: 5000 });
  ok(true, 'clicking a sidebar location expands it');
  const labels = await page.$$eval('.locmap-rail-detail .locmap-field-label', (els) => els.map((e) => e.textContent.trim()));
  ok(labels.includes('Display Name') && labels.includes('Description'),
    `it reveals the fields (${labels.join(', ')})`);
  await page.fill('.locmap-rail-detail .locmap-field-input', 'Belkadan');
  await page.waitForTimeout(300);
  const withDisplay = (await state()).places.find((p) => p.scriptNames.includes(firstLoc));
  ok(withDisplay?.displayName === 'Belkadan', 'the display name is stored');
  ok((await page.$eval('.locmap-pin .locmap-pin-label', (e) => e.textContent.trim())) === 'Belkadan',
    'the pin now shows the display name');
  const scriptUnchanged = await page.evaluate((name) => {
    let found = false;
    window.__scEditor.state.doc.descendants((n) => {
      if (n.type.name === 'sceneHeading' && n.textContent.toUpperCase().includes(name)) found = true;
      return true;
    });
    return found;
  }, firstLoc);
  ok(scriptUnchanged, 'and the SCRIPT still says the original name — the display name is window-only');

  ok(await page.$('.locmap-add-field') !== null, 'the expanded row offers "+ Add custom field"');

  // ── 6b. "Assign to an existing pin" — the merge Derek asked for ─────
  // A SECOND pin, with its own location, then merged onto the first.
  await clickMap(0.7, 0.7);
  await page.waitForSelector('.locmap-pin-menu', { timeout: 5000 });
  await menuItem('Add a script location…');
  const thirdLoc = (await page.$$eval('.locmap-pin-menu .locmap-pin-menu-item-name', (els) => els.map((e) => e.textContent.trim())))[0];
  await page.click('.locmap-pin-menu .locmap-pin-menu-item:has(.locmap-pin-menu-item-name)');
  await page.waitForTimeout(250);
  ok((await state()).places.length === 2, `a second pin carries ${thirdLoc}`);

  const pins = await page.$$('.locmap-pin');
  await pins[1].click();
  await page.waitForSelector('.locmap-pin-menu', { timeout: 5000 });
  await menuItem('Assign to an existing pin…');
  await page.click('.locmap-pin-menu .locmap-pin-menu-list .locmap-pin-menu-item');
  await page.waitForTimeout(300);
  const afterMerge = (await state()).places;
  ok(afterMerge.length === 1,
    `merging leaves ONE pin (${afterMerge.length}) carrying ${afterMerge[0].scriptNames.length} script locations`);
  ok(afterMerge[0].scriptNames.includes(thirdLoc), `and it carries ${thirdLoc}`);

  // ── 6c. "change the name in the script" from the dropdown ───────────
  await page.click('.locmap-pin');
  await page.waitForSelector('.locmap-pin-menu', { timeout: 5000 });
  await menuItem('Change the name in the script…');
  await page.click(`.locmap-pin-menu .locmap-pin-menu-item:text-is("${thirdLoc}")`);
  await page.waitForSelector('.fs-confirm-input', { timeout: 5000 });
  await page.fill('.fs-confirm-input', 'RENAMED PLACE');
  await page.click('.fs-confirm-ok');
  await page.waitForTimeout(400);
  const renamedInScript = await page.evaluate(() => {
    let found = false;
    window.__scEditor.state.doc.descendants((n) => {
      if (n.type.name === 'sceneHeading' && n.textContent.toUpperCase().includes('RENAMED PLACE')) found = true;
      return true;
    });
    return found;
  });
  ok(renamedInScript, 'the dropdown\'s rename rewrites the SCENE HEADING in the script');
  ok((await state()).places[0].scriptNames.includes('RENAMED PLACE'),
    'and the pin follows the rename instead of being orphaned');

  // ── 6d. deleting the background keeps the pins ──────────────────────
  const placesBefore = (await state()).places.length;
  await page.click('.locmap-options-btn');
  await page.click('.char-upload-menu .char-upload-menu-item:text-is("Delete background")');
  await page.waitForSelector('.fs-confirm-box', { timeout: 5000 });
  await page.click('.fs-confirm-ok');
  await page.waitForTimeout(300);
  ok((await state()).map === null, 'the options button deletes the background');
  ok((await state()).places.length === placesBefore, 'and the pins survive it');
  await page.setInputFiles('.locmap input[type="file"]', MAP_PATH);
  await page.waitForSelector('.locmap-import-bar', { timeout: 8000 });
  ok(true, 'a replacement map gets its own rotation pass');
  await page.click('.locmap-import-confirm');
  await page.waitForTimeout(300);

  // ── 7. the List view shows the display name too ─────────────────────
  await setView('List');
  const listNames = await page.$$eval('.location-name', (els) => els.map((e) => e.textContent.trim()));
  ok(listNames.some((n) => n.startsWith('Belkadan')),
    `the List view uses the display name as well (${listNames.slice(0, 2).join(' / ')})`);
  // …and still says WHICH script location each row is, so a shared display
  // name doesn't turn the list into the same word repeated.
  const subs = await page.$$eval('.location-name-sub', (els) => els.map((e) => e.textContent.trim()));
  ok(subs.length > 0 && new Set(subs).size === subs.length,
    `each row names its own script location (${subs.join(' | ')})`);
} catch (e) {
  console.log('  ✗ SCRIPT ERROR:', e.message);
  fail++;
} finally {
  await browser.close();
}
console.log(`\ncheck-v577: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
