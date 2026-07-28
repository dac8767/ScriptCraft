// devtools/driver.mjs — shared Playwright driver kit (speed audit, 2026-07-28)
//
// WHY THIS EXISTS. Derek: "this is getting very slow again. the last few small
// updates took 11 minutes." The audit (docs/SPEED-AUDIT-2026-07-28.md) traced
// most of that to the verification drivers, each hand-written per check and
// each paying the same tax:
//
//   1. TYPING the fixture script through the UI — 30–110 lines at keystroke
//      granularity, ~30–60s per run. Fixed by injection: ScreenplayEditor
//      exposes the TipTap instance as window.__scEditor in DEV builds, and
//      seedScript() hands it a whole document at once.
//   2. FIXED WAITS — waitForTimeout(4000) after boot plus 6–9 scattered
//      600–2000ms sleeps. Fixed with event-driven waits on real conditions.
//   3. REBUILDING THE KIT — drivers lived in the session scratchpad, which
//      sandbox rollbacks wipe (it happened mid-audit). This kit lives in the
//      repo. It is dev tooling: outside src/, invisible to tsc, vitest and
//      the release build.
//
// Usage (from frontend/, with Vite on :5199):
//   import { launch, boot, seedScript, openTool, fullscreen, SCENES_4 } from './devtools/driver.mjs';
//   const { browser, page } = await launch();
//   await boot(page);                    // app up, dialogs cleared
//   await seedScript(page, SCENES_4);    // whole script injected in one call
//   await openTool(page, 'Scenes');
//   ... assertions ...
//   await browser.close();

import { chromium } from 'playwright-core';

export const VITE_URL = 'http://localhost:5199/';

/** The standard fixture: 4 scenes, unequal lengths so page counts, runtimes
 *  and the length icons all differ — the shapes the Scenes tools care about. */
export const SCENES_4 = [
  { heading: 'EXT. SPACE - OPENING SCROLL', lines: 2 },
  { heading: 'EXT. SPACE - BELKADAN', lines: 12 },
  { heading: 'INT. SPACE CARRIER - BRIDGE', lines: 40 },
  { heading: 'INT. CARRIER - HANGER BAY', lines: 20 },
];

export async function launch(opts = {}) {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage({
    viewport: { width: opts.width ?? 1500, height: opts.height ?? 900 },
    // dpr 1 unless a screenshot is the point — dpr 2 quadruples capture cost.
    deviceScaleFactor: opts.dpr ?? 1,
  });
  page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
  return { browser, page };
}

/** App booted, storage cleared, startup dialogs gone. Event-driven: waits on
 *  the editor existing, not on a stopwatch. */
export async function boot(page) {
  await page.goto(VITE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ProseMirror', { timeout: 25000 });
  // Startup dialogs (launcher etc.) — dismiss until none within a beat.
  for (let i = 0; i < 5; i++) {
    const overlay = await page.$('.dialog-overlay');
    if (!overlay) break;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
  }
  // The DEV editor handle must be up before seedScript can run.
  await page.waitForFunction(() => Boolean(window.__scEditor), { timeout: 10000 });
}

/** Inject a whole script in ONE setContent call — this replaces the per-
 *  keystroke typing loop, which was the single largest cost in every driver.
 *  scenes: [{ heading, lines }] or [{ heading, actions: [...] }]. */
export async function seedScript(page, scenes) {
  await page.evaluate((sc) => {
    const content = [];
    for (const s of sc) {
      content.push({ type: 'sceneHeading', content: [{ type: 'text', text: s.heading }] });
      const actions = s.actions ?? Array.from(
        { length: s.lines ?? 3 },
        (_, i) => `Action line ${i} carrying enough words to occupy some space on the page.`,
      );
      for (const a of actions) content.push({ type: 'action', content: [{ type: 'text', text: a }] });
    }
    window.__scEditor.commands.setContent({ type: 'doc', content });
  }, scenes);
  // Confirm against the EDITOR's own state — the scenes store only rescans
  // while a reader tool is open (SCENES_READERS), so DOM row counts are not
  // a valid readiness signal here. waitScenes() covers that after openTool().
  await page.waitForFunction(
    (n) => {
      let count = 0;
      window.__scEditor?.state.doc.descendants((node) => {
        if (node.type.name === 'sceneHeading') count++;
        return true;
      });
      return count >= n;
    },
    scenes.length,
    { timeout: 10000 },
  );
}

/** Open a tool from the side panel by its label. */
export async function openTool(page, label) {
  const row = await page.$(`.tool-dock-item:has-text("${label}")`);
  if (!row) throw new Error(`no dock row labelled ${label}`);
  await row.click();
  await page.waitForSelector('.tool-inline-header, .tool-window', { timeout: 8000 });
  return row;
}

export async function fullscreen(page) {
  await page.click('button[title="Fullscreen"]');
  await page.waitForSelector('.tool-fullscreen, .scenes-tool', { timeout: 8000 });
}

/** Wait until the Scenes list has n rows (rescans are debounced). */
export async function waitScenes(page, n) {
  await page.waitForFunction(
    (want) => document.querySelectorAll('.navigator-scene').length >= want,
    n,
    { timeout: 10000 },
  );
}

/** Screenshot an element, clipped, capped height. */
export async function shot(page, selector, path, maxH = 340) {
  const el = await page.$(selector);
  const b = await el?.boundingBox();
  if (!b || b.width < 2 || b.height < 2) { console.log(`(no box for ${selector})`); return; }
  await page.screenshot({ path, clip: { x: Math.max(0, b.x), y: Math.max(0, b.y), width: b.width, height: Math.min(b.height, maxH) } });
}
