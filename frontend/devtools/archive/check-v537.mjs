// devtools/check-v537.mjs — one popped-out OR fullscreen window at a time:
// opening either kind closes the other; docked panels unaffected; Design
// exempt both ways; the annotation window never coexists with a takeover
// (it save-closes when one rises, and a Navigator annotation click steps
// the takeover aside).
import { launch, boot, seedScript, openTool, fullscreen, SCENES_4 } from './driver.mjs';
let pass = 0, fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FAIL: ${label}`); }
};
const { browser, page } = await launch();
await boot(page);
await seedScript(page, SCENES_4);

const snap = () => page.evaluate(() => {
  const s = window.__scStore.getState();
  return { fs: s.fullscreenTool, temp: s.tempTool, right: s.activeToolRight, left: s.activeTool };
});

// ── floating window lowers the fullscreen takeover ───────────────────────
await openTool(page, 'Scenes');
await fullscreen(page);
ok((await snap()).fs === 'scenes', 'Scenes takeover up');
await page.evaluate(() => {
  const s = window.__scStore.getState();
  s.setToolMode('sticky', 'floating');
  s.openTool('sticky');
});
await page.waitForTimeout(150);
let st = await snap();
ok(st.fs === null && st.right === 'sticky', `floating Notes window closed the takeover (fs=${st.fs})`);
ok(await page.$('.fs-tool-takeover') === null, 'takeover really left the DOM');

// ── entering fullscreen closes the floating window ───────────────────────
await page.evaluate(() => window.__scStore.getState().enterToolFullscreen('scenes'));
await page.waitForTimeout(150);
st = await snap();
ok(st.fs === 'scenes' && st.right === null, `fullscreen re-entry closed the float (right=${st.right})`);

// ── temp window lowers it too ────────────────────────────────────────────
await page.evaluate(() => window.__scStore.getState().openTool('analytics'));
await page.waitForTimeout(150);
st = await snap();
ok(st.fs === null && st.temp === 'analytics', `temp window closed the takeover (fs=${st.fs})`);

// ── Design is exempt both ways ───────────────────────────────────────────
await page.evaluate(() => {
  const s = window.__scStore.getState();
  s.setTempTool(null);
  s.enterToolFullscreen('scenes');
});
await page.waitForTimeout(120);
await page.evaluate(() => {
  const s = window.__scStore.getState();
  s.setToolMode('design', 'floating');
  s.openTool('design');
});
await page.waitForTimeout(150);
st = await snap();
ok(st.fs === 'scenes', 'opening Design leaves the takeover up');
const designOpen = st.left === 'design' || st.right === 'design' || st.temp === 'design';
ok(designOpen, 'and Design itself is open beside it');

// ── annotation window save-closes when a takeover rises ──────────────────
await page.evaluate(() => window.__scStore.getState().setFullscreenTool(null));
await page.waitForTimeout(120);
await openTool(page, 'Annotations');
await page.evaluate(() => window.__scEditor.chain().setTextSelection({ from: 4, to: 20 }).run());
await page.click('.markups-add-btn');
await page.waitForSelector('.fs-markup-popover', { timeout: 5000 });
await page.click('.markup-mini-editor .ProseMirror');
await page.keyboard.type('saved through takeover');
await page.evaluate(() => window.__scStore.getState().enterToolFullscreen('scenes'));
await page.waitForSelector('.fs-markup-popover', { state: 'detached', timeout: 4000 });
ok(true, 'the annotation window closed when fullscreen rose');
const savedContent = await page.evaluate(() => {
  const s = window.__scStore.getState();
  return JSON.stringify(s.markups[0]?.content ?? null);
});
ok(savedContent.includes('saved through takeover'), 'and it SAVED on the way out');

// ── a Navigator annotation click steps the takeover aside ────────────────
await openTool(page, 'Navigator');
await page.waitForSelector('.fs-nav-item.markup', { timeout: 5000 });
ok((await snap()).fs === 'scenes', 'takeover still up before the click');
await page.click('.fs-nav-item.markup');
await page.waitForSelector('.fs-markup-popover', { timeout: 5000 });
st = await snap();
ok(st.fs === null, 'clicking the annotation row lowered the takeover');
ok(await page.$('.fs-markup-popover') !== null, 'and opened the annotation window over the editor');

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
