/* check-v617 — v6.17, Derek: "if I drag a snippet into the script, it should
   add that text in the snippet to the script. right now dragging a snippet
   adds code to the script like this: '0d855902-f95d-4227-b7ce-39e146b8f1e5'."
   The card grip's text/plain payload had been the card's UUID since v5.24
   (set only to satisfy WebKit's no-data-no-drag rule) — and text/plain is
   exactly what ProseMirror pastes on drop. The payload is the card's TEXT
   now (cardDragText). The drag here is synthetic but runs the REAL handlers:
   dragstart on the grip lets the app write its own payload, and the same
   DataTransfer rides the drop into the editor. */
import { launch, boot, seedScript, SCENES_4, settle } from './driver.mjs';

const { browser, page } = await launch({ width: 1500, height: 950 });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL', m); } };

const SNIPPET_TEXT = 'The co-pilot summons a hologram.\nIt flickers twice.';

try {
  await boot(page); await seedScript(page, SCENES_4);

  // A snippet card in the store, then the Snippets window to render it.
  await page.evaluate((text) => {
    const s = window.__scStore.getState();
    s.addShelfCard({ id: 'feedbeef-0000-4000-8000-000000000000', type: 'snippet', text, color: '#f4d35e', createdAt: new Date().toISOString() });
    s.setToolMode('fragments', 'floating');
    s.openTool('fragments');
  }, SNIPPET_TEXT);
  await page.waitForSelector('.tool-window .swn-drag-grip');
  await settle(page);

  const result = await page.evaluate(() => {
    const grip = document.querySelector('.tool-window .swn-drag-grip');
    const dt = new DataTransfer();
    grip.dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true, cancelable: true }));
    const payload = dt.getData('text/plain');
    const pm = document.querySelector('.ProseMirror');
    const r = pm.getBoundingClientRect();
    const drop = new DragEvent('drop', {
      dataTransfer: dt, bubbles: true, cancelable: true,
      clientX: r.left + r.width / 2, clientY: r.top + 120,
    });
    pm.dispatchEvent(drop);
    grip.dispatchEvent(new DragEvent('dragend', { dataTransfer: dt, bubbles: true }));
    return { payload };
  });
  await settle(page);

  ok(result.payload.includes('summons a hologram'), 'the drag payload is the snippet TEXT');
  ok(!/[0-9a-f]{8}-[0-9a-f]{4}/.test(result.payload), 'and carries no UUID');

  const doc = await page.evaluate(() => window.__scEditor.state.doc.textBetween(0, window.__scEditor.state.doc.content.size, '\n'));
  ok(doc.includes('The co-pilot summons a hologram.'), 'dropping in the script inserted the text');
  ok(doc.includes('It flickers twice.'), 'both lines of a multi-line snippet arrived');
  ok(!doc.includes('feedbeef'), 'and no UUID landed in the script');

  const cardStillThere = await page.evaluate(() =>
    window.__scStore.getState().shelfCards.some((c) => c.id === 'feedbeef-0000-4000-8000-000000000000'));
  ok(cardStillThere, 'the snippet card survives the drag (copy, not move)');
} catch (e) {
  console.log('PROBE ERROR:', e.message);
  await page.screenshot({ path: '/tmp/v617-err.png' }).catch(() => {});
} finally { await browser.close(); }
console.log(`\ncheck-v617: ${pass} passed, ${fail} failed`);
