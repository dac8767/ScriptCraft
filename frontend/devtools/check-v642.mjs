/* check-v642 — Derek's local-first batch:
   1 the always-on row shows + edits the device folder (Choose Folder…)
   2 Auto Save Locations has NO "Cloud" row
   3 (engine: local auto saves path gains /Auto Saves/ — asserted on the
     mirrorSnapshot source path string, the UI has no surface for it)
   4 Save Options has NO "ScriptCraft Account" section and NO Cloud row
   5 the System tab is login-free (Reset only)
   6 Settings is a real WINDOW: standard header, drag moves it, resize
     handles present, fullscreen fills the viewport
   7 the Annotations window's button says "Display" (class/id unchanged) */
import { launch, boot, seedScript, openTool, SCENES_4, settle } from './driver.mjs';

const { browser, page } = await launch({ width: 1500, height: 950 });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL', m); } };

try {
  await boot(page);
  await seedScript(page, SCENES_4);

  // ── 6: the Settings WINDOW ──
  await page.evaluate(() => window.__scStore.getState().openPreferences('saveloc'));
  await page.waitForSelector('.prefs-window', { timeout: 8000 });
  const win = await page.evaluate(() => {
    const p = document.querySelector('.prefs-window');
    return {
      header: !!p?.querySelector('.tool-window-header .tool-window-title'),
      fsBtn: !!p?.querySelector('.htw-fsbtn.char-profiles-fullscreen-btn svg'),
      closeBtns: !!p?.querySelector('.tool-window-close svg'),
      resizeZones: [...(p?.querySelectorAll('.fs-edge') ?? [])].length >= 4,
      x: p?.getBoundingClientRect().x,
    };
  });
  ok(win.header && win.fsBtn && win.closeBtns, 'Settings wears the standard window header (title, fullscreen, close)');
  ok(win.resizeZones, 'any-edge resize zones are mounted');
  // drag by the header
  const before = await page.evaluate(() => document.querySelector('.prefs-window').getBoundingClientRect().x);
  const hb = await page.$eval('.prefs-window .tool-window-header', (el) => {
    const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.mouse.move(hb.x, hb.y);
  await page.mouse.down();
  await page.mouse.move(hb.x + 120, hb.y + 40, { steps: 4 });
  await page.mouse.up();
  await settle(page);
  const after = await page.evaluate(() => document.querySelector('.prefs-window').getBoundingClientRect().x);
  ok(Math.abs(after - before - 120) < 8, `dragging the header moves the window (${Math.round(before)} → ${Math.round(after)})`);
  await page.click('.prefs-window .htw-fsbtn');
  await settle(page);
  const fs = await page.evaluate(() => {
    const r = document.querySelector('.prefs-window').getBoundingClientRect();
    return r.width >= window.innerWidth - 1 && r.height >= window.innerHeight - 1 && r.x === 0;
  });
  ok(fs, 'fullscreen fills the viewport');
  await page.click('.prefs-window .htw-fsbtn');
  await settle(page);

  // ── 4 + 1 + 2: the Save Options tab ──
  const saveTab = await page.evaluate(() => {
    const w = document.querySelector('.prefs-window');
    const txt = w.textContent || '';
    const rows = [...w.querySelectorAll('#prefs-save-locations .prefs-check-row')].map((r) => r.textContent);
    const alwaysOn = rows.find((t) => t.includes('Local System (always on)')) || '';
    return {
      noAccountSection: ![...w.querySelectorAll('h3')].some((h) => h.textContent.includes('Account')),
      noCloudRow: !txt.includes('Cloud - ScriptCraft Account') && !txt.includes('Cloud — timestamped'),
      alwaysOnHasChooser: alwaysOn.includes('Choose Folder'),
      backupRow: rows.some((t) => t.includes('Local System (backup location)')),
    };
  });
  ok(saveTab.noAccountSection, 'no Account section in Save Options');
  ok(saveTab.noCloudRow, 'no Cloud save or Cloud autosave rows');
  ok(saveTab.alwaysOnHasChooser, 'the always-on row carries Choose Folder…');
  ok(saveTab.backupRow, 'the backup-location row is still there');
  // the always-on chip reflects localSaveFolder — the SAME field Save As
  // writes (vite serves the module, so this is the app's own store instance)
  const chip = await page.evaluate(async () => {
    const { useSettingsStore } = await import('/src/stores/settingsStore.ts');
    useSettingsStore.getState().setLocalSaveFolder('/tmp/scriptcraft-primary');
    await new Promise((r) => setTimeout(r, 50));
    return document.querySelector('#prefs-save-locations .prefs-check-row code')?.textContent ?? null;
  });
  ok(chip === '/tmp/scriptcraft-primary', `the always-on chip shows the chosen folder (${chip})`);
  await page.evaluate(async () => {
    const { useSettingsStore } = await import('/src/stores/settingsStore.ts');
    useSettingsStore.getState().setLocalSaveFolder('');
  });

  // ── 5: the System tab ──
  await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('.prefs-tab')];
    tabs.find((t) => t.textContent.trim() === 'System')?.click();
  });
  await settle(page);
  const system = await page.evaluate(() => {
    const w = document.querySelector('.prefs-window');
    const titles = [...w.querySelectorAll('.settings-section-title')].map((h) => h.textContent.trim());
    const txt = w.textContent || '';
    return {
      titles,
      noLogin: !txt.includes('Sign in') && !txt.includes('Sign In') && !txt.includes('Account') && !txt.includes('Cloud API'),
    };
  });
  ok(system.titles.length === 1 && system.titles[0] === 'Reset', `System tab holds only Reset (${system.titles.join(', ')})`);
  ok(system.noLogin, 'no login/account/server-URL text anywhere in the System tab');
  await page.evaluate(() => {
    document.querySelector('.prefs-window .tool-window-close')?.click();
  });
  await settle(page);

  // ── 7: the Annotations button says Display ──
  await openTool(page, 'Annotations');
  await settle(page);
  const label = await page.evaluate(() => document.querySelector('.markup-ctl-filter .tool-ctl-label')?.textContent);
  ok(label === 'Display', `the annotations button reads "Display" (${label})`);
  // and still opens the popover through the unchanged class
  await page.click('.markup-ctl-filter');
  await settle(page);
  ok(await page.$('.markup-filter-pop') !== null, 'clicking it still opens the visibility popover');

  // ── 3: the local auto save path carries /Auto Saves/ (source-level) ──
  const src = await page.evaluate(async () => (await fetch('/src/services/saveLocations.ts')).text());
  ok(src.includes("/Auto Saves/Auto Save — "), 'mirrorSnapshot writes into the "Auto Saves" folder');
  ok(!src.includes("snapToCloud"), 'mirrorSnapshot has no Cloud destination left');

  // ── v6.43: File menu — Settings… is second-to-last, Script History last ──
  await page.click('.menu-item:has-text("File")').catch(() => null);
  await settle(page);
  const fileTail = await page.evaluate(() => {
    // the ROOT dropdown only — Script History's hover flyout is a second
    // .menu-dropdown holding its children
    const root = document.querySelector('.menu-dropdown');
    const items = [...(root?.querySelectorAll(':scope > .menu-dropdown-item') ?? [])]
      .map((el) => el.textContent.trim()).filter(Boolean);
    return items.slice(-2);
  });
  ok(fileTail[0]?.startsWith('Settings') && fileTail[1]?.startsWith('Script History'),
    `File menu ends …Settings…, Script History (${JSON.stringify(fileTail)})`);
  await page.keyboard.press('Escape');
  await settle(page);

  // ── the status bar carries no account indicator ──
  const noAuth = await page.evaluate(() => !document.querySelector('.auth-indicator'));
  ok(noAuth, 'no account indicator anywhere in the chrome');
} catch (e) {
  console.log('PROBE ERROR:', e.message);
  fail++;
} finally { await browser.close(); }
console.log(`\ncheck-v642: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
