// check-v714.mjs — five feedback rows Derek filed against v7.11, plus the
// reason the Settings gear never reached his screen.
//   · Lock All out of the Settings tabs, kept in the Customize window
//   · Backup & Restore its own tab, at the bottom, carrying Presets
//   · "Toolbar" → "Ribbon Toolbar"; Keyboard above it; Defaults above Backup
//   · the Downloads tab deleted, its two sections at the foot of Save Options
//   · the feedback attach buttons align with the paperclip
//   · the sent message favours the top
//   · "Saved" flashes in the Quick Access bar, not the bottom-right corner
import { readFileSync } from 'node:fs';
import { launch, boot, settle } from './driver.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};

const { browser, page } = await launch();
await boot(page);

// ── the Settings sidebar ─────────────────────────────────────────────
console.log('\n1. the Settings tab list');
await page.evaluate(() => window.__scStore.getState().openPreferences('general'));
await page.waitForSelector('.prefs-window .prefs-tab', { timeout: 8000 });
const tabs = await page.evaluate(() =>
  [...document.querySelectorAll('.prefs-window .prefs-tab')].map((e) => e.textContent.trim()));
const at = (label) => tabs.indexOf(label);

ok('the sidebar has its tabs', tabs.length >= 8, JSON.stringify(tabs));
ok('no Downloads tab', at('Downloads') === -1, JSON.stringify(tabs));
ok('"Toolbar" is "Ribbon Toolbar"', at('Ribbon Toolbar') >= 0 && at('Toolbar') === -1, JSON.stringify(tabs));
ok('Keyboard sits directly above Ribbon Toolbar',
  at('Keyboard') >= 0 && at('Ribbon Toolbar') === at('Keyboard') + 1, JSON.stringify(tabs));
ok('Backup & Restore is the LAST tab',
  at('Backup & Restore') === tabs.length - 1, JSON.stringify(tabs));
ok('Defaults sits directly above it',
  at('Defaults') === at('Backup & Restore') - 1, JSON.stringify(tabs));

// ── the tabs' contents ───────────────────────────────────────────────
console.log('\n2. what moved where');
await page.evaluate(() => window.__scStore.getState().openPreferences('saveloc'));
await settle(page);
await page.waitForTimeout(300);
const saveloc = await page.evaluate(() =>
  [...document.querySelectorAll('.prefs-content h3')].map((e) => e.textContent.trim()));
ok('Save Options carries Downloads', saveloc.includes('Downloads'), JSON.stringify(saveloc));
ok('…and Screenshots LAST', saveloc[saveloc.length - 1] === 'Screenshots', JSON.stringify(saveloc));

await page.evaluate(() => window.__scStore.getState().openPreferences('backup'));
await settle(page);
await page.waitForTimeout(300);
const backup = await page.evaluate(() => ({
  heads: [...document.querySelectorAll('.prefs-content h3')].map((e) => e.textContent.trim()),
  hasPresets: !!document.querySelector('.prefs-content .fs-presets'),
}));
ok('Backup & Restore holds the settings file', backup.heads.some((h) => /Backup/.test(h)), JSON.stringify(backup.heads));
ok('…and the Presets section', backup.heads.includes('Presets') && backup.hasPresets, JSON.stringify(backup));

await page.evaluate(() => window.__scStore.getState().openPreferences('general'));
await settle(page);
const general = await page.evaluate(() =>
  [...document.querySelectorAll('.prefs-content h3')].map((e) => e.textContent.trim()));
ok('General no longer holds Backup & Restore', !general.some((h) => /Backup/.test(h)), JSON.stringify(general));

await page.evaluate(() => window.__scStore.getState().openPreferences('defaults'));
await settle(page);
const defaults = await page.evaluate(() =>
  [...document.querySelectorAll('.prefs-content h3')].map((e) => e.textContent.trim()));
ok('Defaults no longer holds Presets', !defaults.includes('Presets'), JSON.stringify(defaults));

// ── Lock All ─────────────────────────────────────────────────────────
console.log('\n3. Lock All');
await page.evaluate(() => window.__scStore.getState().openPreferences('cz-toolbar'));
await settle(page);
await page.waitForTimeout(400);
const inSettings = await page.evaluate(() =>
  [...document.querySelectorAll('.prefs-content button')].map((b) => b.textContent.trim()));
ok('no Lock All on a Settings tab',
  !inSettings.some((t) => /^Lock All$|^Locked$/.test(t)), JSON.stringify(inSettings.filter((t) => /Lock/.test(t))));
ok('…but Export/Import are still offered there',
  inSettings.some((t) => /Export/.test(t)) && inSettings.some((t) => /Import/.test(t)), '');
await page.evaluate(() => window.__scStore.getState().closePreferences());
await settle(page);

await page.evaluate(() => window.__scStore.getState().setCustomizeOpen?.(true)
  ?? window.dispatchEvent(new CustomEvent('scriptcraft:command', { detail: 'customize' })));
await page.waitForSelector('.fs-customize-dialog', { timeout: 8000 }).catch(() => {});
const inWindow = await page.evaluate(() =>
  [...document.querySelectorAll('.fs-customize-footer button')].map((b) => b.textContent.trim()));
ok('the Customize WINDOW keeps Lock All',
  inWindow.some((t) => /^Lock All$|^Locked$/.test(t)), JSON.stringify(inWindow));
await page.keyboard.press('Escape');
await settle(page);

// ── the Feedback window ──────────────────────────────────────────────
console.log('\n4. the Feedback window');
const fbCss = readFileSync(new URL('../src/styles/screenplay/22-tools-extra.css', import.meta.url), 'utf8');
ok('the attach buttons carry no left margin of their own',
  /\.fb-attach-btns \{[^}]*\}/.test(fbCss) && !/\.fb-attach-btns \{[^}]*margin-left/.test(fbCss), '');
ok('…the head row spends that gap as a COLUMN gap instead',
  /\.fb-attach-head \{[^}]*gap: var\(--dz-fb-headrow-gap[^)]*\) var\(--dz-fb-head-gap/.test(fbCss), '');
ok('the sent message favours the top, not dead centre',
  /\.fb-sent-veil \{[^}]*align-items: flex-start/.test(fbCss), '');

// ── the Saved flash ──────────────────────────────────────────────────
console.log('\n5. the Saved flash');
const flash = await page.evaluate(async () => {
  const m = await import('/src/utils/saveFlash.ts');
  const seen = [];
  const off = m.subscribeSaveFlash((t) => seen.push(t));
  m.flashSaved();
  off();
  return { seen, ms: m.SAVE_FLASH_MS };
});
ok('flashSaved reaches its listeners', flash.seen.length === 1 && flash.seen[0] === 'Saved', JSON.stringify(flash));
ok('…and holds long enough to read', flash.ms >= 1200, String(flash.ms));

const menuSrc = readFileSync(new URL('../src/components/MenuBar.tsx', import.meta.url), 'utf8');
ok('a successful save no longer toasts',
  !/showToast\('Saved'/.test(menuSrc) && /flashSaved\(\)/.test(menuSrc), '');
const barSrc = readFileSync(new URL('../src/components/TitleBar.tsx', import.meta.url), 'utf8');
ok('the flash renders inside the Quick Access row',
  /fs-titlebar-qat[\s\S]{0,900}<SavedFlash \/>/.test(barSrc), '');

// ── the Settings gear, where he can actually see it ──────────────────
console.log('\n6. the native Settings gear');
const nat = readFileSync(new URL('../src/menu/nativeMenuSync.ts', import.meta.url), 'utf8');
ok('the macOS item rasterizes the DRAWN gear', /rasterizeGear\(/.test(nat) && /Image\.new\(/.test(nat), '');
// v7.15: sized and weighted against the system glyphs beside it.
ok('…at the menu\'s own 16pt box, inset like the system glyphs',
  /rasterizeGear\(32\)/.test(nat) && /INSET/.test(nat), '');
ok('…hairline, matching them', /ctx\.lineWidth = 16/.test(nat), '');
ok('…from the same path the React icon draws', /GEAR_PATH/.test(nat), '');
ok('…falling back to the system gear, then a plain item',
  /NativeIcon\.PreferencesGeneral/.test(nat) && /MenuItem\.new\(opts\)/.test(nat), '');
ok('which icon landed is reported, not swallowed',
  /lastSettingsIcon/.test(nat) && /__scSettingsIcon/.test(nat), '');
const diag = readFileSync(new URL('../src/services/diagnostics.ts', import.meta.url), 'utf8');
ok('…and Diagnostics prints it', /Settings menu icon/.test(diag), '');

console.log(`\ncheck-v714: ${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
