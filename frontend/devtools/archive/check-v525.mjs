// devtools/check-v525.mjs — Markups: the whole feature, driven like a user.
// Range + point creation, popover editing (icon/color/highlight/rich text),
// save-on-close, margin icons, the tool window (cards, meta line, open-only
// default, complete), the eye toggle beating the inline highlight, the
// Navigator rows, the Customize presets tab, and the print exclusion.
import { launch, boot, seedScript, openTool, SCENES_4 } from './driver.mjs';

const SHOTS = process.env.SHOTS_DIR ?? '/tmp/v525';
let pass = 0, fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FAIL: ${label}`); }
};

const { browser, page } = await launch();
await boot(page);
await seedScript(page, SCENES_4);

// ── 1. open the Markups window, make a RANGE markup ───────────────────────
await openTool(page, 'Annotations');   // renamed from Markups in v5.25
ok(await page.$('.markups-add-btn') !== null, 'Markups window has the + Markup Script button');

// select a run of text inside scene 3's first action line
await page.evaluate(() => {
  const ed = window.__scEditor;
  let scenes = 0, from = -1;
  ed.state.doc.descendants((node, pos) => {
    if (node.type.name === 'sceneHeading') { scenes++; return true; }
    if (scenes === 3 && from < 0 && node.type.name === 'action') { from = pos + 1; return false; }
    return true;
  });
  ed.chain().setTextSelection({ from, to: from + 18 }).run();
});
await page.click('.markups-add-btn');
await page.waitForSelector('.fs-markup-popover', { timeout: 5000 });
let st = await page.evaluate(() => {
  const s = window.__scStore.getState();
  return { n: s.markups.length, anchor: s.markups[0]?.anchor, editing: s.markupEditorId };
});
ok(st.n === 1 && st.anchor === 'range', 'selection → one RANGE markup in the store');
ok(st.editing !== null, 'its popover opened on creation');
ok(await page.$('.markup-hl-row') !== null, 'range markup offers the highlight row');

// ── 2. edit it: text, star preset, a highlight color ─────────────────────
await page.click('.markup-mini-editor .ProseMirror');
await page.keyboard.type('Fix the pacing through this stretch');
await page.click('.markup-pop-row .markup-preset:nth-child(2)');       // star preset
await page.click('.markup-hl-row .markup-dot');                        // first highlight
const hl = await page.evaluate(() => {
  const el = document.querySelector('.script-markup-highlight');
  return el ? getComputedStyle(el).backgroundColor : null;
});
ok(hl && hl !== 'rgba(0, 0, 0, 0)', `highlight paints the selection (${hl})`);
await page.screenshot({ path: `${SHOTS}/popover.png`, clip: await page.$('.fs-markup-popover').then((e) => e.boundingBox()) });

// margin icon present, right of the page edge
const iconGeo = await page.evaluate(() => {
  const icon = document.querySelector('.markup-margin-icon');
  const pg = document.querySelector('.page');
  if (!icon || !pg) return null;
  return { il: icon.getBoundingClientRect().left, pr: pg.getBoundingClientRect().right };
});
ok(iconGeo && iconGeo.il >= iconGeo.pr, 'margin icon sits in the RIGHT margin, past the page edge');

// ── 3. save-on-close (outside press), content persisted ───────────────────
// The house driver gotcha: a body-targeted press, NOT a mouse.down() (the
// pointer still hovers the popover from the last click) and NOT an editor
// click (that minimizes the tool window by design).
await page.evaluate(() => document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
await page.waitForSelector('.fs-markup-popover', { state: 'detached', timeout: 4000 });
st = await page.evaluate(() => {
  const s = window.__scStore.getState();
  return { icon: s.markups[0].icon, content: !!s.markups[0].content, editing: s.markupEditorId, hl: s.markups[0].highlight };
});
ok(st.editing === null, 'outside press closed the popover');
ok(st.content, 'save-on-close persisted the rich text');
ok(st.icon === 'star', `preset click set the icon (${st.icon})`);
ok(!!st.hl, `highlight color stored (${st.hl})`);

// ── 4. the tool window card: meta line, jump target, complete ─────────────
const card = await page.evaluate(() => {
  const meta = document.querySelector('.markup-card-meta')?.textContent ?? '';
  return { cards: document.querySelectorAll('.markup-card').length, meta };
});
ok(card.cards === 1, 'one card in the Markups window');
ok(/^p\. \d+/.test(card.meta), `card meta leads with the page number ("${card.meta}")`);
ok(card.meta.includes('INT. SPACE CARRIER - BRIDGE'), 'card meta carries the scene heading');
await page.screenshot({ path: `${SHOTS}/panel.png` });

await page.click('.markup-card-check');
ok(await page.evaluate(() => document.querySelectorAll('.markup-card').length) === 0,
  'completing a markup drops it from the default OPEN-only view');
await page.evaluate(() => {
  const s = window.__scStore.getState();
  s.setMarkupFilters({ ...s.markupFilters, done: 'all' });
});
ok(await page.evaluate(() => document.querySelectorAll('.markup-card.done').length) === 1,
  'the All filter shows it again, dimmed as done');
await page.evaluate(() => {
  const s = window.__scStore.getState();
  s.updateMarkup(s.markups[0].id, { done: false });
  s.setMarkupFilters({ ...s.markupFilters, done: 'open' });
});

// ── 5. a POINT markup at a bare cursor (whole-element mark, NEVER a phantom) ─
await page.evaluate(() => window.__scEditor.chain().setTextSelection(4).run());
await page.click('.markups-add-btn');
await page.waitForSelector('.fs-markup-popover', { timeout: 5000 });
ok(await page.$('.markup-hl-row') === null, 'point markup offers NO highlight row');
st = await page.evaluate(() => {
  const s = window.__scStore.getState();
  return {
    n: s.markups.length,
    anchor: s.markups[1]?.anchor,
    // the regression the atom shipped: a markup in the store with NO anchor
    // in the doc. Every markup must have its mark span in the DOM.
    spans: new Set([...document.querySelectorAll('.script-markup-highlight[data-markup-id]')]
      .map((el) => el.getAttribute('data-markup-id'))).size,
  };
});
ok(st.n === 2 && st.anchor === 'point', 'cursor → a POINT markup (whole-element mark)');
ok(st.spans === 2, `every markup has a real anchor span in the doc (${st.spans}/2) — no phantoms`);
await page.keyboard.press('Escape');
await page.waitForSelector('.fs-markup-popover', { state: 'detached', timeout: 4000 });
ok(await page.evaluate(() => document.querySelectorAll('.markup-margin-icon').length) === 2,
  'two margin icons now ride the right margin');

// empty element + cursor → toast, store untouched (never a phantom markup)
await page.evaluate(() => {
  const ed = window.__scEditor;
  const end = ed.state.doc.content.size;
  ed.chain().insertContentAt(end, { type: 'action' }).setTextSelection(end + 1).run();
});
await page.click('.markups-add-btn');
await page.waitForTimeout(400);
st = await page.evaluate(() => ({
  n: window.__scStore.getState().markups.length,
  // Toast.tsx renders class-less inline-styled divs — detect by the message.
  toast: document.body.textContent.includes('Nothing to markup here'),
  pop: !!document.querySelector('.fs-markup-popover'),
}));
ok(st.n === 2 && !st.pop, 'empty element: no markup created, no popover');
ok(st.toast, 'empty element: the refusal is SAID (toast), not silent');
await page.screenshot({ path: `${SHOTS}/margin.png` });

// ── 6. the eye toggle: icons unmount, highlight neutralized ───────────────
await page.click('.tags-visibility-btn');
const hidden = await page.evaluate(() => ({
  icons: document.querySelectorAll('.markup-margin-icon').length,
  hl: getComputedStyle(document.querySelector('.script-markup-highlight')).backgroundColor,
  vis: window.__scStore.getState().markupsVisible,
}));
ok(!hidden.vis && hidden.icons === 0, 'eye off → margin icons gone');
ok(hidden.hl === 'rgba(0, 0, 0, 0)', `eye off → highlight neutralized despite inline style (${hidden.hl})`);
await page.click('.tags-visibility-btn');
ok(await page.evaluate(() => document.querySelectorAll('.markup-margin-icon').length) === 2, 'eye on → icons return');

// ── 7. margin icon click reopens the popover ──────────────────────────────
await page.click('.markup-margin-icon');
ok(await page.waitForSelector('.fs-markup-popover', { timeout: 4000 }).then(() => true).catch(() => false),
  'clicking a margin icon opens its popover');
await page.keyboard.press('Escape');
await page.waitForSelector('.fs-markup-popover', { state: 'detached', timeout: 4000 });

// ── 8. Navigator rows ─────────────────────────────────────────────────────
await openTool(page, 'Navigator');
ok(await page.evaluate(() => document.querySelectorAll('.fs-nav-item.markup').length) === 2,
  'Navigator lists both markups with their icons');

// ── 9. Customize ▸ Markups presets tab ────────────────────────────────────
await page.evaluate(() => window.dispatchEvent(new CustomEvent('scriptcraft:command', { detail: 'customize' })));
await page.waitForSelector('.prefs-tab', { timeout: 5000 });
await page.click('.prefs-tab:has-text("Markups")');
await page.waitForSelector('.fs-markup-cz-chip', { timeout: 4000 });
ok(await page.evaluate(() => document.querySelectorAll('.fs-markup-cz-chip').length) === 6,
  'Customize ▸ Markups shows the six default preset chips');
await page.click('.fs-markup-cz-grid .markup-preset:nth-child(3)');   // pick a different icon
await page.click('.fs-markup-cz-add');
ok(await page.evaluate(() => window.__scStore.getState().markupPresets.length) === 7,
  '+ Add Preset appends the picked combo');
await page.screenshot({ path: `${SHOTS}/customize.png` });
await page.evaluate(() => {
  const s = window.__scStore.getState();
  s.setMarkupPresets(s.markupPresets.slice(0, 6));
});

// ── 10. print never shows markups ─────────────────────────────────────────
await page.emulateMedia({ media: 'print' });
const printState = await page.evaluate(() => ({
  icon: getComputedStyle(document.querySelector('.markup-margin-icon')).display,
  hl: getComputedStyle(document.querySelector('.script-markup-highlight')).backgroundColor,
}));
ok(printState.icon === 'none', 'print: margin icons display:none');
ok(printState.hl === 'rgba(0, 0, 0, 0)', 'print: highlight background stripped');
await page.emulateMedia({ media: 'screen' });

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
