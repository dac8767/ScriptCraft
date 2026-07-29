// devtools/check-v552.mjs — the icon/color window commits live with an
// OK/Cancel footer (hex auto-applies, Apply is gone, picks stop closing);
// filter grids draw each type in its annotation's color; a one-checkbox
// list never shows the big Navigator icon; + Add Annotation is a bare +
// leading the panel header.
import { launch, boot, seedScript, openTool, SCENES_4 } from './driver.mjs';
const SHOTS = '/tmp/claude-0/-home-user-ScriptCraft/e4449e3e-5198-5997-9e57-bd93d663743c/scratchpad';
let pass = 0, fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FAIL: ${label}`); }
};
const rgb = (hex) => {
  const h = hex.replace('#', '');
  return `rgb(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)})`;
};
const { browser, page } = await launch();
await boot(page);
await seedScript(page, SCENES_4);

// ── the + leads the Annotations window header; the body row is gone ──────
await openTool(page, 'Annotations');
await page.waitForSelector('.markup-ctl-filter', { timeout: 6000 });
const seat = await page.evaluate(() => {
  const plus = document.querySelector('.markups-add-btn');
  const filter = document.querySelector('.markup-ctl-filter');
  if (!plus || !filter) return null;
  const p = plus.getBoundingClientRect(), f = filter.getBoundingClientRect();
  return {
    inHeader: !!plus.closest('.tool-chrome-controls'),
    ordered: p.right <= f.left,
    gap: f.left - p.right,
    text: plus.textContent.trim(),
    hasSvg: !!plus.querySelector('svg'),
    bodyRow: !!document.querySelector('.markups-add-row'),
  };
});
ok(seat && seat.inHeader && seat.ordered && seat.gap > 30 && seat.text === '' && seat.hasSvg && !seat.bodyRow,
  `+ is a bare icon leading the header, body row gone (gap to Filter ${seat?.gap?.toFixed(0)}px)`);

// ── header + with a selection creates the annotation ─────────────────────
await page.evaluate(() => window.__scEditor.chain().focus().setTextSelection({ from: 30, to: 55 }).run());
await page.click('.markups-add-btn');
await page.waitForSelector('.fs-markup-popover', { timeout: 5000 });
ok(await page.evaluate(() => window.__scStore.getState().markups.length === 1),
  'header + creates the annotation from the selection');

// ── icon/color window: live commits + OK/Cancel footer ───────────────────
const before = await page.evaluate(() => {
  const m = window.__scStore.getState().markups[0];
  return { icon: m.icon, color: m.color, iconManual: !!m.iconManual };
});
await page.click('.markup-combo-current');
await page.waitForSelector('.markup-icon-pop', { timeout: 4000 });
const chrome = await page.evaluate(() => ({
  apply: !!document.querySelector('.markup-icon-pop .color-picker-apply'),
  foot: [...document.querySelectorAll('.markup-icon-pop-foot button')].map((b) => b.textContent.trim()),
}));
ok(chrome && !chrome.apply && chrome.foot.join(',') === 'Cancel,OK',
  `no Apply in the hex row; footer holds Cancel + OK (${chrome?.foot.join(' / ')})`);

await page.fill('.markup-icon-pop .color-picker-hex', '#12ab34');
await page.waitForTimeout(150);
ok(await page.evaluate(() => window.__scStore.getState().markups[0].color === '#12ab34'),
  'typing a full hex auto-applies the color (no Apply click)');

await page.click('.markup-icon-pop-left .markup-icon-pop-row .markup-preset');
await page.waitForTimeout(120);
const afterPreset = await page.evaluate(() => ({
  open: !!document.querySelector('.markup-icon-pop'),
  m: (({ icon, color }) => ({ icon, color }))(window.__scStore.getState().markups[0]),
}));
ok(afterPreset.open && (afterPreset.m.icon !== before.icon || afterPreset.m.color !== '#12ab34'),
  `a preset pick applies live and the window STAYS open (${afterPreset.m.icon} ${afterPreset.m.color})`);
await page.screenshot({ path: `${SHOTS}/v552-icon-pop.png` });

await page.evaluate(() => {
  [...document.querySelectorAll('.markup-icon-pop-foot button')].find((b) => b.textContent.trim() === 'Cancel')?.click();
});
await page.waitForSelector('.markup-icon-pop', { state: 'detached', timeout: 4000 });
const afterCancel = await page.evaluate(() => {
  const m = window.__scStore.getState().markups[0];
  return { icon: m.icon, color: m.color, iconManual: !!m.iconManual };
});
ok(afterCancel.icon === before.icon && afterCancel.color === before.color && afterCancel.iconManual === before.iconManual,
  `Cancel restores the open-time combo (${afterCancel.icon} ${afterCancel.color})`);

await page.click('.markup-combo-current');
await page.waitForSelector('.markup-icon-pop', { timeout: 4000 });
await page.click('.markup-icon-pop-left .markup-icon-pop-row .markup-preset:nth-child(2)');
const kept = await page.evaluate(() => (({ icon, color }) => ({ icon, color }))(window.__scStore.getState().markups[0]));
await page.evaluate(() => {
  [...document.querySelectorAll('.markup-icon-pop-foot button')].find((b) => b.textContent.trim() === 'OK')?.click();
});
await page.waitForSelector('.markup-icon-pop', { state: 'detached', timeout: 4000 });
ok(await page.evaluate(([i, c]) => {
  const m = window.__scStore.getState().markups[0];
  return m.icon === i && m.color === c;
}, [kept.icon, kept.color]), `OK closes and keeps the picked combo (${kept.icon} ${kept.color})`);

// ── one empty checkbox: ☐ line in the preview, NO big icon anywhere ──────
await page.click('.fs-markup-popover .markup-mini-editor .ProseMirror');
await page.click('.markup-mini-btn[title="Checklist"]');
await page.waitForTimeout(500);   // live-mirror debounce is 250ms
const preview = await page.evaluate(() => ({
  check: !!document.querySelector('.fs-markup-popover .markup-prev-lines .fs-nav-line-check'),
  content: (() => { const m = window.__scStore.getState().markups[0]; return m.content ? 'stored' : 'null'; })(),
}));
ok(preview.check && preview.content === 'stored',
  `a lone empty checkbox is STORED as content and previews as ☐ (${preview.content})`);
await page.click('.markup-save');
await page.waitForTimeout(200);

await openTool(page, 'Navigator');
await page.waitForSelector('.fs-nav-list', { timeout: 6000 });
const navRow = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.fs-nav-list .fs-nav-anno')];
  if (!rows.length) return null;
  return {
    bigIcon: rows.some((r) => r.querySelector('.fs-nav-markup-icon')),
    check: rows.some((r) => r.querySelector('.fs-nav-line-check')),
  };
});
ok(navRow && !navRow.bigIcon && navRow.check,
  'Navigator row: one-checkbox list shows the ☐ line and NO big icon');
await page.screenshot({ path: `${SHOTS}/v552-nav-onecheck.png` });

// ── filter grids draw the type in its annotation's color (both doors) ────
// Navigator and Annotations dock on DIFFERENT sides — both windows are live
// at once and both filter buttons are .markup-ctl-filter, so every click is
// scoped to the window that owns it (and dock items are never re-clicked:
// that TOGGLES the tool closed).
const annoColor = await page.evaluate(() => window.__scStore.getState().markups[0].color);
const toggleFilter = (bodySel) => page.evaluate((sel) => {
  const wrap = document.querySelector(sel)?.closest('.tool-dock-wrap');
  wrap?.querySelector('.markup-ctl-filter')?.click();
}, bodySel);
await toggleFilter('.fs-nav-list');
await page.waitForSelector('.markup-filter-pop .markup-filter-grid .markup-preset', { timeout: 4000 });
const navGrid = await page.evaluate(() => {
  const g = document.querySelector('.markup-filter-pop .markup-filter-grid .markup-preset .markup-glyph');
  return g ? getComputedStyle(g).color : null;
});
ok(navGrid === rgb(annoColor), `Navigator filter grid icon wears the annotation color (${navGrid})`);
await toggleFilter('.fs-nav-list');
await page.waitForSelector('.markup-filter-pop', { state: 'detached', timeout: 4000 });

await toggleFilter('.markups-list');
await page.waitForSelector('.markup-filter-pop .markup-filter-grid .markup-preset', { timeout: 4000 });
const panelGrid = await page.evaluate(() => {
  const g = document.querySelector('.markup-filter-pop .markup-filter-grid .markup-preset .markup-glyph');
  return g ? getComputedStyle(g).color : null;
});
ok(panelGrid === rgb(annoColor), `Annotations panel filter grid icon wears it too (${panelGrid})`);
await page.screenshot({ path: `${SHOTS}/v552-grid-color.png` });
await toggleFilter('.markups-list');
await page.waitForSelector('.markup-filter-pop', { state: 'detached', timeout: 4000 });

// ── header + with NOTHING selected still arms the pick banner ────────────
await page.evaluate(() => window.__scEditor.chain().setTextSelection(2).run());
await page.click('.markups-add-btn');
await page.waitForSelector('.markup-pick-banner', { timeout: 4000 });
ok(true, 'empty-selection + arms the select-text banner (request crossed to the body)');
await page.keyboard.press('Escape');
await page.waitForSelector('.markup-pick-banner', { state: 'detached', timeout: 4000 });

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
