// devtools/check-v528.mjs — annotation view controls everywhere + navigator
// polish: the View ▸ Annotations submenu, the ribbon visibility-menu button,
// indented color-matched navigator rows, the navigator Annotations toggle,
// and the relocated Scene Numbers toggle with circle badges.
import { launch, boot, seedScript, openTool, SCENES_4 } from './driver.mjs';

const SHOTS = process.env.SHOTS_DIR ?? '/tmp/v528';
let pass = 0, fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FAIL: ${label}`); }
};
const bodyPress = (page) => page.evaluate(() =>
  document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));

const { browser, page } = await launch();
await boot(page);
await seedScript(page, SCENES_4);
await openTool(page, 'Annotations');

// seed one range annotation in scene 2
await page.evaluate(() => {
  const ed = window.__scEditor;
  let scenes = 0, from = -1;
  ed.state.doc.descendants((node, pos) => {
    if (node.type.name === 'sceneHeading') { scenes++; return true; }
    if (scenes === 2 && from < 0 && node.type.name === 'action') { from = pos + 1; return false; }
    return true;
  });
  ed.chain().setTextSelection({ from, to: from + 12 }).run();
});
await page.click('.markups-add-btn');
await page.waitForSelector('.fs-markup-popover', { timeout: 5000 });
await page.keyboard.press('Escape');
await page.waitForSelector('.fs-markup-popover', { state: 'detached', timeout: 4000 });

// ── 1. View ▸ Annotations submenu ────────────────────────────────────────
await page.click('.menu-item:has-text("View")');
await page.waitForSelector('.menu-dropdown', { timeout: 4000 });
// :text-is — Working Notes' container text ALSO includes "Annotations"
// (its submenu children render inside it), so :has-text picks it first.
const sub = await page.$('.menu-dropdown-item.has-children span:text-is("Annotations")');
ok(!!sub, 'View menu carries an Annotations entry');
await sub.click();                       // opens the submenu
await page.waitForSelector('.menu-submenu.submenu-visible', { timeout: 4000 });
const subItems = await page.evaluate(() =>
  [...document.querySelectorAll('.menu-submenu.submenu-visible .menu-dropdown-item')]
    .map((el) => el.textContent?.trim() ?? ''));
ok(subItems.some((t) => t.includes('Show Annotations in Script')), 'submenu: master toggle present');
ok(subItems.some((t) => t.includes('Open Only')) && subItems.some((t) => t.includes('All Statuses')),
  'submenu: the status choices are there');
ok(subItems.some((t) => t.includes('Show “Flag”')), 'submenu: per-type toggle for the in-use type');
ok(subItems.some((t) => t.includes('Show All Types')) && subItems.some((t) => t.includes('Hide All Types')),
  'submenu: Show/Hide All Types present');
await page.screenshot({ path: `${SHOTS}/view-menu.png` });
// toggle the flag type off through the MENU — the script icon disappears
await page.click('.menu-submenu.submenu-visible .menu-dropdown-item:has-text("Show “Flag”")');
await page.waitForTimeout(250);
ok(await page.evaluate(() => document.querySelectorAll('.markup-margin-icon').length) === 0,
  'menu toggle hides the type in the script');
ok(await page.evaluate(() => window.__scStore.getState().markupHiddenIcons.includes('flag')),
  'same state the Show button drives (markupHiddenIcons)');
await page.evaluate(() => window.__scStore.getState().setMarkupHiddenIcons([]));
await page.keyboard.press('Escape');
await page.waitForTimeout(150);

// ── 2. ribbon: the Annotation Visibility menu button ─────────────────────
await page.evaluate(() => {
  const s = window.__scStore.getState();
  s.setToolbarZones([...s.toolbarLeft, 'b:annotationsMenu'], s.toolbarRight);
});
await page.waitForTimeout(250);
const ribBtn = await page.$('.toolbar-btn[title="Annotation Visibility"]');
ok(!!ribBtn, 'the ribbon button renders from the palette token');
await ribBtn.click();
await page.waitForSelector('.markup-filter-pop', { timeout: 4000 });
const ribPop = await page.evaluate(() => ({
  helps: [...document.querySelectorAll('.markup-filter-help')].map((el) => el.textContent),
  grid: document.querySelectorAll('.markup-filter-grid .markup-preset').length,
}));
ok(ribPop.helps.join('|') === 'Select one|Toggle visibility in script',
  'ribbon button opens the SCRIPT-visibility popover');
ok(ribPop.grid >= 1, 'with the in-use type grid');
await page.screenshot({ path: `${SHOTS}/ribbon-menu.png` });
await bodyPress(page);

// ── 3-5. navigator: toggle button, indent+color, scene-number badges ─────
await openTool(page, 'Navigator');
const nav = await page.evaluate(() => {
  const s = window.__scStore.getState();
  const annoBtn = [...document.querySelectorAll('.tool-ctl')].find((el) => el.textContent?.trim() === 'Annotations');
  const numBtn = [...document.querySelectorAll('.tool-ctl')].find((el) => el.textContent?.includes('Scene Numbers'));
  const row = document.querySelector('.fs-nav-item.markup');
  const scene = document.querySelector('.fs-nav-item.scene');
  const span = row?.querySelector('span[style]');
  const color = s.markups[0].color;
  return {
    annoBtn: !!annoBtn,
    numBtn: !!numBtn,
    numBtnRow2: annoBtn && numBtn
      ? numBtn.getBoundingClientRect().top > annoBtn.getBoundingClientRect().bottom - 2 : false,
    numBtnLeft: annoBtn && numBtn
      ? Math.abs(numBtn.getBoundingClientRect().left - annoBtn.getBoundingClientRect().left) < 8 : false,
    indent: row && scene
      ? row.querySelector('span')._ ?? (getComputedStyle(row).paddingLeft) : null,
    scenePad: scene ? getComputedStyle(scene).paddingLeft : null,
    rowColor: span ? getComputedStyle(span).color : null,
    expectColor: `rgb(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)})`,
  };
});
ok(nav.annoBtn, 'navigator has the Annotations toggle button');
ok(nav.numBtn && nav.numBtnRow2, 'Scene Numbers toggle sits on its own second row');
ok(nav.numBtnLeft, 'and is left-aligned with the row-1 lead');
ok(parseFloat(nav.indent) > parseFloat(nav.scenePad), `annotation rows indent past scene rows (${nav.indent} vs ${nav.scenePad})`);
ok(nav.rowColor === nav.expectColor, `annotation text wears its icon color (${nav.rowColor})`);

// Annotations toggle hides the rows
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.tool-ctl')].find((el) => el.textContent?.trim() === 'Annotations');
  btn.click();
});
await page.waitForTimeout(150);
ok(await page.evaluate(() => document.querySelectorAll('.fs-nav-item.markup').length) === 0,
  'the toggle hides annotation rows in the list');
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.tool-ctl')].find((el) => el.textContent?.trim() === 'Annotations');
  btn.click();
});

// scene numbers OFF by default? toggle ON → circle badges BEFORE headings
const before = await page.evaluate(() => document.querySelectorAll('.fs-nav-num-badge').length);
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.tool-ctl')].find((el) => el.textContent?.includes('Scene Numbers'));
  btn.click();
});
await page.waitForTimeout(150);
const badges = await page.evaluate(() => {
  const row = document.querySelector('.fs-nav-item.scene');
  const badge = row?.querySelector('.fs-nav-num-badge');
  if (!badge) return null;
  const b = badge.getBoundingClientRect();
  const txt = row.querySelector('span:not(.fs-nav-num-badge)').getBoundingClientRect();
  const cs = getComputedStyle(badge);
  return {
    n: document.querySelectorAll('.fs-nav-num-badge').length,
    beforeText: b.left < txt.left,
    round: cs.borderRadius === '50%',
    text: badge.textContent,
  };
});
ok((before === 0 || before === badges?.n) && badges && badges.n === SCENES_4.length,
  `toggle shows a badge per scene (${badges?.n})`);
ok(badges?.beforeText, 'the badge sits BEFORE the heading text');
ok(badges?.round && badges?.text === '1', `it is the Scenes circle badge ("${badges?.text}", round)`);
await page.screenshot({ path: `${SHOTS}/navigator.png` });

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
