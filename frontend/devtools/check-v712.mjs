// check-v712.mjs — Derek:
//   1 "add a list of all of the page setup templates to the top of the page
//     setup tab. this list is where the view, edit, and delete (for custom
//     templates only) buttons are. bellow that is the shown and hidden columns"
//   2 "use a different gear icon for settings"
import { readFileSync } from 'node:fs';
import { launch, boot, settle } from './driver.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};

const { browser, page } = await launch();
await boot(page);

// ── 1. the template list above the columns ───────────────────────────
console.log('\n1. Page Setup: list on top, columns below');
await page.evaluate(() => window.__scStore.getState().openPreferences('page'));
await page.waitForSelector('.prefs-content .pst-list', { timeout: 8000 });
await settle(page);

const layout = await page.evaluate(() => {
  const list = document.querySelector('.pst-list');
  const cols = document.querySelector('.fs-dnd-cols');
  const box = (el) => el?.getBoundingClientRect();
  return {
    listRows: document.querySelectorAll('.pst-listrow').length,
    listBottom: box(list)?.bottom ?? 0,
    colsTop: box(cols)?.top ?? 0,
    heads: [...document.querySelectorAll('.prefs-content h3')].map((h) => h.textContent.trim()),
  };
});
ok('every template is in the list', layout.listRows >= 6, `rows=${layout.listRows}`);
ok('the list sits ABOVE the columns', layout.listBottom <= layout.colsTop + 1,
  `list ends ${Math.round(layout.listBottom)}, columns start ${Math.round(layout.colsTop)}`);
ok('the two areas are named', layout.heads.length >= 2, JSON.stringify(layout.heads));

const buttons = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.pst-listrow')];
  const read = (r) => ({
    name: r.querySelector('.fmt-card-name span')?.textContent.trim(),
    isDefault: !!r.querySelector('.pst-default-badge'),
    btns: [...r.querySelectorAll('button')].map((b) => b.textContent.trim()),
  });
  return rows.map(read);
});
const builtIns = buttons.filter((r) => r.isDefault);
ok('every row offers View', buttons.every((r) => r.btns.includes('View')), JSON.stringify(buttons[0]));
ok('built-ins offer View only — no Edit, no Delete',
  builtIns.length >= 6 && builtIns.every((r) => r.btns.join() === 'View'), JSON.stringify(builtIns.map((r) => r.btns)));

/* A custom template gets Edit + Delete. Driven through the UI on purpose: a
   dynamic import from the driver can hand back a SECOND module instance, whose
   store the mounted component is not subscribed to — the first cut created a
   template that existed in that copy and never appeared in the list. Clicking
   the app's own buttons cannot lie about which store it used. */
await page.click('.pst-newrow button');
await settle(page);
await page.waitForSelector('.pst-newrow .dialog-btn-primary', { timeout: 8000 });
await page.click('.pst-newrow .dialog-btn-primary');
await page.waitForTimeout(600);
// Creating opens the template editor on the copy — close it and read the list.
await page.keyboard.press('Escape');
await settle(page);
await page.waitForTimeout(300);
const custom = await page.evaluate(() => {
  const own = [...document.querySelectorAll('.pst-listrow')].find((r) => !r.querySelector('.pst-default-badge'));
  return own ? {
    name: own.querySelector('.fmt-card-name span')?.textContent.trim(),
    btns: [...own.querySelectorAll('button')].map((b) => b.textContent.trim()),
  } : null;
});
ok('a custom template appears in the list',
  Boolean(custom) && /Copy/.test(custom.name || ''), JSON.stringify(custom));
ok('…offering View, Edit and Delete',
  custom && ['View', 'Edit', 'Delete'].every((t) => custom.btns.includes(t)), JSON.stringify(custom));

// the columns are visibility only now
const colRows = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.fs-dnd-col .fs-dnd-row')];
  return {
    count: rows.length,
    labels: rows.slice(0, 3).map((r) => [...r.querySelectorAll('button')].map((b) => b.textContent.trim())),
    handles: document.querySelectorAll('.fs-dnd-col .fs-customize-drag').length,
  };
});
ok('the columns carry no View/Edit/Delete',
  colRows.labels.every((b) => !b.some((t) => ['View', 'Edit', 'Delete'].includes(t))), JSON.stringify(colRows.labels));
ok('…just the one visibility toggle per row',
  colRows.labels.every((b) => b.length === 1 && ['×', '+'].includes(b[0])), JSON.stringify(colRows.labels));
ok('rows still drag', colRows.handles === colRows.count, JSON.stringify(colRows));

// ── 2. the gear ──────────────────────────────────────────────────────
console.log('\n2. the Settings gear');
const icons = await page.evaluate(async () => {
  const m = await import('/src/components/toolbarCommands.tsx');
  const cmd = m.TOOLBAR_COMMANDS.find((c) => c.id === 'settings');
  // react-icons render as an <svg> whose path data identifies the glyph;
  // compare Settings' icon against the wrench the Tools menu wears.
  const { MENU_ICONS, TOOLBAR_ICONS } = await import('/src/components/uiIcons.tsx');
  return {
    hasSettingsCmd: !!cmd,
    toolsIsWrench: !!MENU_ICONS.Tools,
    customizeIsWrench: !!TOOLBAR_ICONS.customize,
  };
});
ok('the Settings command still exists', icons.hasSettingsCmd, '');

/* v7.13, Derek sent the gear he wants: a stroked OUTLINE gear, eight teeth,
   hollow centre — drawn in uiIcons (react-icons has no gear that shape) — and
   "make the lines white". Dropdown icons are painted --fd-text-muted, so the
   white is a real, checkable difference from every other icon in that menu. */
const glyphs = await page.evaluate(() => {
  const svgPath = (el) => el?.querySelector('svg path')?.getAttribute('d') ?? null;
  const menuTools = [...document.querySelectorAll('.menu-item')].find((e) => /Tools/.test(e.textContent));
  return { toolsPath: svgPath(menuTools) };
});
ok('the Tools menu still has its wrench', Boolean(glyphs.toolsPath), '');

/* Clear the decks first: section 1 leaves the Settings window and the template
   editor it opened on screen, and an overlay eats the menu click — Playwright
   calls that "intercepts pointer events", not a miss. The template editor has
   NO Escape handler (only Cancel and an overlay click), so pressing Escape at
   it does nothing; click the button it actually has. */
const cancel = await page.$('.template-editor-header .dialog-btn');
if (cancel) { await cancel.click(); await settle(page); }
await page.evaluate(() => window.__scStore.getState().closePreferences());
await settle(page);
await page.waitForSelector('.template-editor-overlay, .prefs-window', { state: 'detached', timeout: 8000 }).catch(() => {});

const help = await page.$('.menu-item:has-text("Help")');
await help.click();
await settle(page);
const gear = await page.evaluate(() => {
  const item = [...document.querySelectorAll('.menu-dropdown-item')].find((e) => /Settings/.test(e.textContent));
  const svg = item?.querySelector('svg');
  const other = [...document.querySelectorAll('.menu-dropdown-item')]
    .find((e) => !/Settings/.test(e.textContent) && e.querySelector('.menu-dropdown-icon svg'));
  const g = svg ? getComputedStyle(svg) : null;
  const o = other ? getComputedStyle(other.querySelector('.menu-dropdown-icon svg')) : null;
  return {
    cls: svg?.getAttribute('class') ?? null,
    stroke: svg?.getAttribute('stroke') ?? null,
    fill: svg?.getAttribute('fill') ?? null,
    teeth: (svg?.querySelector('path')?.getAttribute('d')?.match(/A186/g) || []).length,
    hollow: !!svg?.querySelector('circle'),
    color: g?.color ?? null,
    otherColor: o?.color ?? null,
  };
});
ok('Settings wears the drawn gear', gear.cls === 'icon-gear-strong', JSON.stringify(gear));
ok('…as an OUTLINE — stroked, not filled', gear.stroke === 'currentColor' && gear.fill === 'none', JSON.stringify(gear));
ok('…with eight teeth and a hollow centre', gear.teeth === 8 && gear.hollow, JSON.stringify(gear));
ok('…and WHITE lines', gear.color === 'rgb(255, 255, 255)', gear.color);
ok('…brighter than the other icons in that menu, which stay muted',
  gear.otherColor && gear.otherColor !== gear.color, JSON.stringify({ gear: gear.color, other: gear.otherColor }));

/* A light theme must not paint it white — that is an invisible icon. */
const onLight = await page.evaluate(async () => {
  document.documentElement.setAttribute('data-theme', 'light');
  await new Promise((r) => setTimeout(r, 80));
  const svg = [...document.querySelectorAll('.menu-dropdown-item')]
    .find((e) => /Settings/.test(e.textContent))?.querySelector('svg');
  const c = svg ? getComputedStyle(svg).color : null;
  document.documentElement.setAttribute('data-theme', 'dark');
  return c;
});
ok('a light theme paints it dark instead of white', onLight !== null && onLight !== 'rgb(255, 255, 255)', String(onLight));

const src = readFileSync(new URL('../src/menu/nativeMenuSync.ts', import.meta.url), 'utf8');
ok('the native menu uses the plain GEAR, not the Advanced pane icon',
  /NativeIcon\.PreferencesGeneral/.test(src) && !/NativeIcon\.Advanced/.test(src), '');
ok('…still with the fallback that keeps the menu alive',
  /catch[\s\S]{0,200}MenuItem\.new\(opts\)/.test(src), '');

/* Read the SOURCE, not the served module: Vite compiles JSX away, so
   `<FaCog />` never appears in what the browser is given. */
const menuSrc = readFileSync(new URL('../src/components/MenuBar.tsx', import.meta.url), 'utf8');
ok('the in-app Settings… item uses the drawn gear', /<GearIcon \/>, label: 'Settings…'/.test(menuSrc), '');

console.log(`\ncheck-v712: ${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
