// check-v710.mjs — Derek, three directives in one message:
//   · "remove the Action Rewrite tool completely from the app"
//   · "lets put the whole extensions idea on hold for now"
//   · page setup per template, and "Built ins" are editable too
//
// The first two are REMOVALS, and this repo's lesson about removals is that
// "gone" means gone from every surface — the dock rail, the menus, the ribbon
// palette and the Customize pickers each keep their own list.
import { launch, boot, settle, dismiss } from './driver.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};

const { browser, page } = await launch();
await boot(page);

// ── 1. Action Rewrite is gone from every surface ─────────────────────
console.log('\n1. Action Rewrite removed');

const railLabels = await page.evaluate(() =>
  [...document.querySelectorAll('.tool-dock-item')].map((e) => e.textContent.trim()));
ok('no dock row', !railLabels.some((l) => /Rewrite/i.test(l)), JSON.stringify(railLabels));

const registry = await page.evaluate(async () => {
  const m = await window.__scImport('/src/components/ToolDock.tsx');
  return {
    all: m.ALL_TOOLS.map((t) => t.id),
    available: m.availableTools().map((t) => t.id),
    hasAddonHooks: Object.keys(m).filter((k) => /addon/i.test(k)),
  };
});
ok('not in the tool registry', !registry.all.includes('rewrite'), JSON.stringify(registry.all));
ok('not in availableTools()', !registry.available.includes('rewrite'), '');
ok('the add-on gating hooks are gone with it', registry.hasAddonHooks.length === 0,
  JSON.stringify(registry.hasAddonHooks));

// menus: Tools and Help ▸ Developer
const menuHits = [];
for (const menu of ['Tools', 'Help']) {
  const trigger = await page.$(`.menu-bar-item:has-text("${menu}")`);
  if (!trigger) continue;
  await trigger.click();
  await settle(page);
  // walk submenus too — Help ▸ Developer is one
  const items = await page.evaluate(() =>
    [...document.querySelectorAll('.menu-dropdown-item, .menu-item')].map((e) => e.textContent.trim()));
  menuHits.push(...items);
  const dev = await page.$('.menu-dropdown-item:has-text("Developer")');
  if (dev) {
    await dev.hover();
    await settle(page);
    const sub = await page.evaluate(() =>
      [...document.querySelectorAll('.menu-dropdown-item, .menu-item')].map((e) => e.textContent.trim()));
    menuHits.push(...sub);
  }
  await dismiss(page);
}
ok('not in the Tools or Help ▸ Developer menus', !menuHits.some((l) => /Rewrite/i.test(l)),
  JSON.stringify(menuHits.filter((l) => /Rewrite/i.test(l))));

const leftovers = await page.evaluate(async () => {
  const store = await window.__scImport('/src/stores/editorStore.ts');
  const s = window.__scStore.getState();
  return {
    inDefaultOrder: store.DEFAULT_TOOL_ORDER.includes('rewrite'),
    inToolConfig: Object.prototype.hasOwnProperty.call(s.toolConfig || {}, 'rewrite'),
    settingsKeys: Object.keys(window.localStorage).filter((k) => /rewrite/i.test(k)),
  };
});
ok('not in the default tool order', !leftovers.inDefaultOrder, '');
ok('not in the default tool config', !leftovers.inToolConfig, '');

// ── 2. Extensions on hold — no tab in Settings ───────────────────────
console.log('\n2. Extensions on hold');
/* openPreferences() is the app's own entry point — the one check-v701 uses.
   The first cut here called a setter that does not exist, so Settings never
   opened and "no Extensions tab" passed against an EMPTY list. A removal
   assertion that can pass vacuously is worse than no assertion. */
await page.evaluate(() => window.__scStore.getState().openPreferences('general'));
await page.waitForSelector('.prefs-window .prefs-tab', { timeout: 8000 });
const tabs = await page.evaluate(() =>
  [...document.querySelectorAll('.prefs-window .prefs-tab')].map((e) => e.textContent.trim()));
ok('Settings opened with its tab list', tabs.length >= 5, JSON.stringify(tabs));
ok('no Extensions tab', !tabs.some((l) => /Extension|Add-?on/i.test(l)), JSON.stringify(tabs));
ok('Page Setup is still there', tabs.some((l) => /Page Setup/i.test(l)), JSON.stringify(tabs));

// ── 3. Page setup per template, built-ins included ───────────────────
console.log('\n3. page setup per template');
await page.evaluate(() => window.__scStore.getState().openPreferences('page'));
await page.waitForSelector('.pst-row-actions', { timeout: 8000 });
await settle(page);

const viewBtn = await page.$('.pst-row-actions button:has-text("View")');
ok('a template row offers View', Boolean(viewBtn), '');
if (viewBtn) {
  await viewBtn.click();
  await settle(page);
  await page.waitForTimeout(300);
  const fields = await page.evaluate(() => ({
    header: document.querySelector('.page-setup-dialog .dialog-header')?.textContent.trim() || '',
    sections: [...document.querySelectorAll('.page-setup-dialog .page-setup-section-title')].map((e) => e.textContent.trim()),
    inputs: document.querySelectorAll('.page-setup-dialog input, .page-setup-dialog select').length,
  }));
  ok('View opens a full page of fields, not an info box', fields.inputs >= 12, JSON.stringify(fields));
  ok('…with the real Page Setup sections', fields.sections.length >= 3, JSON.stringify(fields.sections));
  ok('…titled for that template', /Page Setup/.test(fields.header) && fields.header !== 'Page Setup', fields.header);

  /* Edit a BUILT-IN's page size through the dialog that is open, and prove it
     lands in storage under that template's id.

     Driven through the UI on purpose (v7.12): a dynamic import from the driver
     can hand back a SECOND copy of a store module, and writing to that copy
     proves nothing about the app — check-v712 hit exactly that, creating a
     template the mounted list never showed. localStorage is shared by both, so
     that is what gets asserted. */
  const saved = await page.evaluate(async () => {
    const widthInput = [...document.querySelectorAll('.page-setup-dialog input[type=number]')][0];
    const set = (el, v) => {
      const proto = Object.getPrototypeOf(el);
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, String(v));
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    set(widthInput, 8.27);
    await new Promise((r) => setTimeout(r, 120));
    const apply = [...document.querySelectorAll('.page-setup-dialog .dialog-actions button')]
      .find((b) => b.textContent.trim() === 'Apply');
    apply.click();
    await new Promise((r) => setTimeout(r, 250));
    const stored = JSON.parse(localStorage.getItem('opendraft:templatePageLayouts') || '{}');
    const ids = Object.keys(stored);
    return { ids, width: ids.length ? stored[ids[0]].pageWidth : null };
  });
  ok('a BUILT-IN template keeps an edited page size', saved.width === 8.27, JSON.stringify(saved));
  ok('…persisted under its own id', saved.ids.length === 1, JSON.stringify(saved.ids));
}

console.log(`\ncheck-v710: ${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
