/* check-v635 — Derek: "for annotations, move the on-page icon to the left
   margin from the right." The icon now centers in the LEFT margin band
   (page edge → 1.5" text start), clear of the page edge and of the
   scene-number zone that hugs the text. */
import { launch, boot, seedScript, SCENES_4, settle } from './driver.mjs';

const { browser, page } = await launch({ width: 1500, height: 950 });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL', m); } };

try {
  await boot(page);
  await seedScript(page, SCENES_4);
  // select a run of action text and hang an annotation on it
  await page.evaluate(async () => {
    window.__scEditor.chain().setTextSelection({ from: 30, to: 55 }).run();
    const mod = await import('/src/utils/markupActions.ts');
    mod.createMarkupAtSelection(window.__scEditor);
  });
  await settle(page);
  // creating via the picker may open the edit window — close through the
  // store so the layer reverts to normal visibility rules
  await page.evaluate(() => window.__scStore.getState().setMarkupEditorId(null));
  await page.evaluate(() => window.__scStore.getState().setMarkupsVisible(true));
  await settle(page);

  const m = await page.evaluate(() => {
    const icon = document.querySelector('.markup-margin-icon');
    const pageEl = document.querySelector('.page');
    const content = document.querySelector('.screenplay-content');
    if (!icon || !pageEl || !content) return null;
    const i = icon.getBoundingClientRect();
    const p = pageEl.getBoundingClientRect();
    const c = content.getBoundingClientRect();
    const layout = window.__scStore.getState().pageLayout;
    const scale = p.width / (layout.pageWidth * 96);
    return {
      iconCenter: i.left + i.width / 2,
      pageLeft: p.left, pageRight: p.right,
      textLeft: c.left,
      expectedCenter: p.left + (layout.leftMargin * 96 * scale) / 2,
    };
  });
  ok(!!m, 'an annotation icon rendered on the page');
  if (m) {
    ok(Math.abs(m.iconCenter - m.expectedCenter) < 2,
      `icon centers in the LEFT margin band (${(m.iconCenter - m.pageLeft).toFixed(1)}px from page edge)`);
    ok(m.iconCenter < m.textLeft, 'icon sits left of the text column');
    ok(m.iconCenter < (m.pageLeft + m.pageRight) / 2, 'icon is on the LEFT half of the page');
  }
} catch (e) {
  console.log('PROBE ERROR:', e.message);
} finally { await browser.close(); }
console.log(`\ncheck-v635: ${pass} passed, ${fail} failed`);
