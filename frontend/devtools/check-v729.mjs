/* check-v729 — queue #7, window-mode memory incl. FULLSCREEN.
 *
 * "every tool reopens in its last shape — side panel / floating / fullscreen.
 * … what remains is persisting 'fullscreen' as a remembered mode and honoring
 * it in openTool/dock clicks." (deferred from v4.78)
 *
 * MEASURED FIRST, which changed what this version is. Half of it was already
 * done: toolMode persists 'fullscreen' and openTool honours it, across a
 * reload. The half that was missing is the windows that are NOT tools —
 * Settings is a FloatingWindow, and its shape lived in useState, so shrinking
 * it out of fullscreen and closing it reopened fullscreen every time.
 *
 * Both halves are asserted here. The already-working half is asserted too,
 * because "it was working when I looked" is not a guarantee that survives a
 * refactor of openTool.
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

console.log('\n1. a TOOL reopens in the shape it was left in');
const tool = await page.evaluate(async () => {
  const S = () => window.__scStore.getState();
  const log = {};
  S().setToolConfig({ ...S().toolConfig, goals: { side: 'right', enabled: false } });
  S().openTool('goals'); await new Promise((r) => setTimeout(r, 200));
  log.asFloat = S().tempTool;
  S().enterToolFullscreen('goals'); await new Promise((r) => setTimeout(r, 250));
  log.mode = S().toolMode.goals;
  S().setFullscreenTool(null); await new Promise((r) => setTimeout(r, 200));
  log.modeAfterClose = S().toolMode.goals;
  S().openTool('goals'); await new Promise((r) => setTimeout(r, 300));
  log.reopened = S().fullscreenTool;
  // …and shrinking it back to a window must be remembered the same way
  S().setFullscreenTool(null);
  S().setToolMode('goals', 'floating'); await new Promise((r) => setTimeout(r, 200));
  S().openTool('goals'); await new Promise((r) => setTimeout(r, 300));
  log.afterShrink = { fs: S().fullscreenTool, temp: S().tempTool };
  return log;
});
ok('it opens as a window when it has no dock home', tool.asFloat === 'goals', JSON.stringify(tool));
ok('going fullscreen records the mode', tool.mode === 'fullscreen', JSON.stringify(tool));
ok('…and closing it does not forget', tool.modeAfterClose === 'fullscreen', JSON.stringify(tool));
ok('…so it REOPENS fullscreen', tool.reopened === 'goals', JSON.stringify(tool));
ok('shrunk back to a window, it reopens as a window',
  tool.afterShrink.fs === null && tool.afterShrink.temp === 'goals', JSON.stringify(tool.afterShrink));

console.log('\n2. …and it survives a restart');
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('.ProseMirror', { timeout: 25000 });
await page.waitForFunction(() => Boolean(window.__scEditor), { timeout: 10000 });
const afterReload = await page.evaluate(async () => {
  const S = () => window.__scStore.getState();
  S().setToolMode('goals', 'fullscreen');
  await new Promise((r) => setTimeout(r, 150));
  return S().toolMode.goals;
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('.ProseMirror', { timeout: 25000 });
await page.waitForFunction(() => Boolean(window.__scEditor), { timeout: 10000 });
const persisted = await page.evaluate(() => window.__scStore.getState().toolMode.goals);
ok('the mode is written before the reload', afterReload === 'fullscreen', String(afterReload));
ok('…and read back after it', persisted === 'fullscreen', String(persisted));

console.log('\n3. the windows that are NOT tools remember too');
/* THE GAP. Settings is a FloatingWindow: shape in useState, so it reopened
   fullscreen no matter how you left it. Measured before the fix:
   1500 → shrink → 900 → close → reopen → 1500. */
const win = await page.evaluate(async () => {
  const S = () => window.__scStore.getState();
  const w = () => {
    const r = document.querySelector('.prefs-window')?.getBoundingClientRect();
    return r ? Math.round(r.width) : null;
  };
  const shrink = () => document.querySelector('.prefs-window .htw-fsbtn')?.click();
  S().openPreferences(); await new Promise((r) => setTimeout(r, 450));
  const opened = w();
  shrink(); await new Promise((r) => setTimeout(r, 300));
  const shrunk = w();
  S().closePreferences(); await new Promise((r) => setTimeout(r, 250));
  S().openPreferences(); await new Promise((r) => setTimeout(r, 450));
  const reopened = w();
  // and back to fullscreen must stick as well — memory in both directions
  shrink(); await new Promise((r) => setTimeout(r, 300));
  S().closePreferences(); await new Promise((r) => setTimeout(r, 250));
  S().openPreferences(); await new Promise((r) => setTimeout(r, 450));
  const reopenedFull = w();
  S().closePreferences();
  return { opened, shrunk, reopened, reopenedFull };
});
ok('Settings opens fullscreen the first time', win.opened > win.shrunk, JSON.stringify(win));
ok('…shrinking really shrinks it', win.shrunk > 0 && win.shrunk < win.opened, JSON.stringify(win));
ok('…and it REOPENS at the shrunken size, not fullscreen again',
  win.reopened === win.shrunk, `${win.shrunk} → closed → ${win.reopened}`);
ok('…memory works in both directions', win.reopenedFull === win.opened, JSON.stringify(win));

console.log('\n4. how it is stored');
const fw = readFileSync(new URL('../src/components/FloatingWindow.tsx', import.meta.url), 'utf8');
ok('the shape is keyed by the window\'s id', /function loadShape\(id\?: string\)/.test(fw), '');
ok('…and lives in the same viewState as toolMode, not a second store',
  /saveViewState\(\{ windowShape:/.test(fw), '');
ok('…written from the settled values, not on every pointer frame',
  /useEffect\(\(\) => \{\s*saveShape\(id, \{ full: fullscreen/.test(fw), '');
ok('a window with no id still works — it just forgets', /if \(!id\) return null;/.test(fw), '');
const prefs = readFileSync(new URL('../src/components/PreferencesDialog.tsx', import.meta.url), 'utf8');
ok('Settings passes one', /id="settings"/.test(prefs), '');

console.log(`\ncheck-v729: ${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
