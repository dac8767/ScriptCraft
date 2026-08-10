/* check-v667 — Derek (two screenshots, 50% and 90%): "annotation do not
   scale or adapt when the zoom is changed, putting them in the wrong place."

   Every number in MarkupIconLayer is MEASURED off the rendered page
   (coordsAtPos / getBoundingClientRect), and the page is drawn with
   transform: scale(zoom) — so a zoom change makes every stored position
   stale. zoomLevel was never in the effect's deps, and the chip's size
   ignored zoom entirely, so at 90% an icon sat inside the text.

   1 at 100%, an annotation's icon sits on the row it annotates
   2 …and in the page's LEFT MARGIN, clear of the text
   3 after zooming OUT it is still on that row and still in the margin
   4 after zooming IN it is still on that row and still in the margin
   5 the chip SCALES with the page — smaller zoomed out, bigger zoomed in
   6 it never overlaps the text column at any zoom */
import { launch, boot, seedScript, SCENES_4, settle } from './driver.mjs';

const { browser, page } = await launch({ width: 1500, height: 950 });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL', m); } };

const setZoom = async (z) => {
  await page.evaluate((v) => window.__scStore.getState().setZoomLevel(v), z);
  await settle(page);
};
/** The icon, the element it annotates, and the page — all in viewport px. */
const geo = () => page.evaluate(() => {
  const icon = document.querySelector('.markup-margin-icon');
  const id = icon?.getAttribute('data-markup-icon');
  const anchored = [...document.querySelectorAll('.ProseMirror > *')]
    .find((el) => el.getAttribute('data-markup-block') === id);
  const pageEl = document.querySelector('.page');
  if (!icon || !anchored || !pageEl) return null;
  const i = icon.getBoundingClientRect();
  const a = anchored.getBoundingClientRect();
  const p = pageEl.getBoundingClientRect();
  return {
    icon: { cx: i.left + i.width / 2, cy: i.top + i.height / 2, w: i.width, right: i.right },
    row: { top: a.top, bottom: a.bottom, left: a.left },
    page: { left: p.left, right: p.right, width: p.width },
  };
});
/** On the annotated row, inside the page, left of the text. */
const verdict = (g) => ({
  onRow: g.icon.cy >= g.row.top - 4 && g.icon.cy <= g.row.bottom + 4,
  onPage: g.icon.cx > g.page.left && g.icon.cx < g.page.right,
  clearOfText: g.icon.right <= g.row.left + 1,
});

try {
  await boot(page);
  await seedScript(page, SCENES_4);
  await setZoom(100);
  // one annotation on a known element, made the way the app makes them
  await page.evaluate(() => {
    const st = window.__scStore.getState();
    const ed = window.__scEditor;
    st.setMarkups([]);
    let at = null;
    ed.state.doc.forEach((n, pos) => { if (at === null && n.type.name === 'action') at = pos; });
    const id = 'zoom-probe-1';
    const node = ed.state.doc.nodeAt(at);
    ed.view.dispatch(ed.state.tr.setNodeMarkup(at, undefined, { ...node.attrs, markupId: id }));
    st.addMarkup({
      id, content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'zoom probe' }] }] },
      icon: 'hashtag', color: '#4a9eff', highlight: null, anchor: 'point', done: false, createdAt: new Date().toISOString(),
    });
  });
  await page.waitForSelector('.markup-margin-icon', { timeout: 5000 });
  await settle(page);

  const at100 = await geo();
  ok(!!at100, 'the annotation renders an icon at 100%');
  let v = verdict(at100);
  ok(v.onRow, `at 100% it sits on the row it annotates (icon ${Math.round(at100.icon.cy)}, row ${Math.round(at100.row.top)}–${Math.round(at100.row.bottom)})`);
  ok(v.onPage && v.clearOfText, `and in the page's left margin, clear of the text (icon right ${Math.round(at100.icon.right)} ≤ text left ${Math.round(at100.row.left)})`);

  await setZoom(50);
  const at50 = await geo();
  v = verdict(at50);
  ok(v.onRow, `zoomed OUT to 50% it is still on that row (icon ${Math.round(at50.icon.cy)}, row ${Math.round(at50.row.top)}–${Math.round(at50.row.bottom)})`);
  ok(v.onPage && v.clearOfText, `still in the margin, still clear of the text (${Math.round(at50.icon.right)} ≤ ${Math.round(at50.row.left)})`);

  await setZoom(150);
  const at150 = await geo();
  v = verdict(at150);
  ok(v.onRow, `zoomed IN to 150% it is still on that row (icon ${Math.round(at150.icon.cy)}, row ${Math.round(at150.row.top)}–${Math.round(at150.row.bottom)})`);
  ok(v.onPage && v.clearOfText, `still in the margin, still clear of the text (${Math.round(at150.icon.right)} ≤ ${Math.round(at150.row.left)})`);

  /* ── 5: the chip scales with the page ── */
  const ratio50 = at50.icon.w / at100.icon.w;
  const ratio150 = at150.icon.w / at100.icon.w;
  ok(Math.abs(ratio50 - 0.5) < 0.15, `at 50% the chip is about half the size (${at50.icon.w.toFixed(0)}px vs ${at100.icon.w.toFixed(0)}px)`);
  ok(Math.abs(ratio150 - 1.5) < 0.2, `at 150% it is about half again (${at150.icon.w.toFixed(0)}px vs ${at100.icon.w.toFixed(0)}px)`);
  // it stays a proportional share of the page at every zoom
  const share = (g) => g.icon.w / g.page.width;
  const shares = [share(at50), share(at100), share(at150)];
  ok(Math.max(...shares) - Math.min(...shares) < 0.01,
    `it keeps the same share of the page at every zoom (${shares.map((s) => (s * 100).toFixed(1) + '%').join(' / ')})`);

  await setZoom(100);

} catch (e) {
  console.log('PROBE ERROR:', e.message);
  fail++;
} finally { await browser.close(); }
console.log(`\ncheck-v667: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
