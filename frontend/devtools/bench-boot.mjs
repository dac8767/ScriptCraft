// devtools/bench-boot.mjs — measures the driver tax: old style (fixed waits +
// keystroke typing) vs the kit (event waits + setContent injection). Run from
// frontend/ with Vite on :5199. Both halves end in the same state: Scenes tool
// open on a 4-scene script, rows counted — so the comparison is honest.
import { launch, boot, seedScript, openTool, waitScenes, SCENES_4 } from './driver.mjs';

const stamp = () => process.hrtime.bigint();
const secs = (a, b) => Number(b - a) / 1e9;

// ── OLD STYLE: what every driver this session actually did ──────────────
async function oldStyle() {
  const { browser, page } = await launch();
  const t0 = stamp();
  await page.goto('http://localhost:5199/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);
  for (let i = 0; i < 4; i++) { if (!(await page.$('.dialog-overlay'))) break; await page.keyboard.press('Escape'); await page.waitForTimeout(400); }
  await page.waitForSelector('.ProseMirror', { timeout: 25000 });
  const t1 = stamp();
  const sel = (await page.$$('select'))[2];
  await (await page.$('.ProseMirror')).click();
  for (const s of SCENES_4) {
    await sel.selectOption({ label: 'Scene Heading' });
    await page.waitForTimeout(110);
    await page.keyboard.type(s.heading);
    await page.keyboard.press('Enter');
    await sel.selectOption({ label: 'Action' });
    await page.waitForTimeout(110);
    for (let i = 0; i < s.lines; i++) {
      await page.keyboard.type(`Action line ${i} carrying enough words to occupy some space on the page.`);
      await page.keyboard.press('Enter');
    }
  }
  await page.waitForTimeout(2000);
  const t2 = stamp();
  await (await page.$('.tool-dock-item:has-text("Scenes")')).click();
  await page.waitForTimeout(1800);
  const rows = await page.$$eval('.navigator-scene', (r) => r.length);
  const t3 = stamp();
  await browser.close();
  return { boot: secs(t0, t1), type: secs(t1, t2), open: secs(t2, t3), total: secs(t0, t3), rows };
}

// ── KIT: injection + event-driven waits ──────────────────────────────────
async function kitStyle() {
  const { browser, page } = await launch();
  const t0 = stamp();
  await boot(page);
  const t1 = stamp();
  await seedScript(page, SCENES_4);
  const t2 = stamp();
  await openTool(page, 'Scenes');
  await waitScenes(page, 4);
  const rows = await page.$$eval('.navigator-scene', (r) => r.length);
  const t3 = stamp();
  await browser.close();
  return { boot: secs(t0, t1), seed: secs(t1, t2), open: secs(t2, t3), total: secs(t0, t3), rows };
}

const fmt = (o) => Object.entries(o).map(([k, v]) => `${k} ${typeof v === 'number' ? v.toFixed(1) + 's' : v}`).join('  ');
const which = process.argv[2];
if (which !== 'kit') console.log('OLD :', fmt(await oldStyle()));
if (which !== 'old') console.log('KIT :', fmt(await kitStyle()));
