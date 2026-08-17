/* check-v734 — "add spelling & grammar tool as something that can be in the
 * side panels."
 *
 * The change is one deletion from PANEL_EXCLUDED_IDS, which is exactly why it
 * needs checking in the running app rather than in the source: that list is
 * read by THREE things (the dock, Customize ▸ Side Panels, openTool), and the
 * reason it existed at all was that openTool used to seat an excluded tool in
 * a slot the dock refused to render — a silent no-op that also poisoned the
 * next click (v6.27). Listing the tool and actually SEATING it are separate
 * facts, so both get asserted.
 *
 * The other half is width. v1.35 moved the 490px off .spell-modal onto
 * .spell-modal-floating because "the docked panel clipped a third of the UI" —
 * so the panel body must fit inside the side panel, not overhang it. Measured,
 * not eyeballed.
 */
import { launch, boot, settle } from './driver.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};

const { browser, page } = await launch();
await boot(page);
await settle(page);

console.log('\nSpelling & Grammar is a side-panel tool');

const list = await page.evaluate(async () => {
  const m = await window.__scImport('/src/stores/editorStore.ts');
  return {
    excluded: m.PANEL_EXCLUDED_IDS,
    rail: [...document.querySelectorAll('.tool-dock-item')].map((e) => (e.textContent || '').trim()),
  };
});
ok('the exclusion list no longer holds it', !list.excluded.includes('spelling'), JSON.stringify(list.excluded));
// …and still holds the one that genuinely cannot dock, so this is a targeted
// removal rather than the list being emptied.
ok('…while Asset Manager stays excluded', list.excluded.includes('assets'), JSON.stringify(list.excluded));
ok('the rail rendered', list.rail.includes('Scenes'), JSON.stringify(list.rail));
ok('…and Spelling & Grammar is in it', list.rail.some((l) => /Spelling/i.test(l)), JSON.stringify(list.rail));

/* SEATED, not just listed — the v6.27 failure was a tool that opened into a
   slot nothing rendered. */
const seated = await page.evaluate(async () => {
  window.__scStore.getState().openTool('spelling');
  await new Promise((r) => setTimeout(r, 900));
  const st = window.__scStore.getState();
  const panel = document.querySelector('.tool-panel, .side-panel, .tool-inline-header');
  const body = document.querySelector('.spell-modal');
  return {
    activeTool: st.activeTool,
    activeToolRight: st.activeToolRight,
    mode: st.toolMode.spelling ?? 'docked',
    hasPanel: !!panel,
    hasBody: !!body,
    floating: !!document.querySelector('.spell-modal-floating'),
  };
});
ok('openTool seats it in a panel slot', seated.activeTool === 'spelling' || seated.activeToolRight === 'spelling',
  JSON.stringify(seated));
ok('…docked, not forced into a floating window', seated.mode === 'docked' && seated.floating === false,
  JSON.stringify(seated));
ok('…and its body actually rendered there', seated.hasBody === true, JSON.stringify(seated));

/* WIDTH. The fixed 490px belongs to the floating dialog; docked it must fit
   the panel it is in. Overhang here is the v1.35 bug returning. */
const fit = await page.evaluate(() => {
  const body = document.querySelector('.spell-modal');
  if (!body) return { measured: false };
  // the panel is the nearest ancestor that scrolls/clips the tool
  const host = body.closest('.tool-panel, .tool-panel-body, .side-panel, .tool-content') || body.parentElement;
  const b = body.getBoundingClientRect();
  const h = host.getBoundingClientRect();
  return {
    measured: true,
    bodyW: Math.round(b.width), hostW: Math.round(h.width),
    overhang: Math.round(b.right - h.right),
    host: host.className,
  };
});
ok('the panel body was measurable', fit.measured === true, JSON.stringify(fit));
ok('…it fits its panel instead of overhanging it', fit.measured && fit.overhang <= 1, JSON.stringify(fit));
ok('…and is not stuck at the floating dialog width', fit.measured && fit.bodyW <= fit.hostW, JSON.stringify(fit));

/* Customize ▸ Side Panels is the door Derek asked about by name. */
await page.evaluate(() => window.__scStore.getState().closeTool('spelling'));
await settle(page);
for (const el of await page.$$('.menu-bar *')) {
  if ((await el.textContent())?.trim() === 'View') { await el.click(); await settle(page); break; }
}
await page.waitForSelector('.menu-dropdown', { timeout: 5000 });
const cz = await page.evaluate(async () => {
  const item = [...document.querySelectorAll('.menu-dropdown-item')]
    .find((r) => /^Customize/.test((r.textContent || '').trim()));
  if (!item) return { opened: false };
  item.click();
  await new Promise((r) => setTimeout(r, 1100));
  const body = document.body.innerText || '';
  return {
    opened: /Panels/i.test(body),
    listsOthers: /Thesaurus/i.test(body),
    listsSpelling: /Spelling/i.test(body),
    // the Asset Manager must NOT appear — it is still panel-excluded, and an
    // dialog listing everything would pass the line above for the wrong reason
    listsAssets: /Asset Manager/i.test(body),
  };
});
ok('View ▸ Customize… opened the panel list', cz.opened === true, JSON.stringify(cz));
ok('…it lists the other panel tools', cz.listsOthers === true, JSON.stringify(cz));
ok('…and Spelling & Grammar is offered there', cz.listsSpelling === true, JSON.stringify(cz));
ok('…while Asset Manager still is not', cz.listsAssets === false, JSON.stringify(cz));

console.log(`\ncheck-v734: ${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
