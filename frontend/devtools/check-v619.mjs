/* check-v619 — v6.19, Derek: "if I already have a word highlighted, and then
   I open the thesaurus tool, it should open with the thesaurus info for that
   word in the window. Currently you only get info if the Thesaurus window is
   open first and then you highlight. Add thesaurus as an option in the
   context menu."
   The tool's follow-the-script effect only listened for selectionUpdate /
   update events, so the selection the tool OPENED OVER was never looked up —
   sync now runs once at mount. The context menu grows a registry-driven
   Thesaurus item (Tools group) that opens the tool over the selection. */
import { launch, boot, seedScript, SCENES_4, settle } from './driver.mjs';

const { browser, page } = await launch({ width: 1500, height: 950 });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL', m); } };

/** Select the word "hologram" in the script (set via insertContent below). */
const selectWord = () => page.evaluate(() => {
  const ed = window.__scEditor;
  let hit = null;
  ed.state.doc.descendants((node, pos) => {
    if (hit || !node.isText) return true;
    const i = node.text.indexOf('hologram');
    if (i >= 0) hit = { from: pos + i, to: pos + i + 'hologram'.length };
    return true;
  });
  ed.chain().focus().setTextSelection(hit).run();
});

try {
  await boot(page);
  await seedScript(page, [{ heading: 'INT. BRIDGE - NIGHT', actions: ['The co-pilot summons a hologram over the console.'] }]);

  // 1 ── word selected FIRST, tool opened SECOND → looked up on open
  await selectWord();
  await page.evaluate(() => window.__scStore.getState().openTool('thesaurus'));
  await page.waitForSelector('.thesaurus-tool');
  await page.waitForSelector('.thes-sense', { timeout: 6000 });
  const input = await page.$eval('.thes-input', (el) => el.value);
  ok(input === 'hologram', `opening over a selection looks the word up (input: "${input}")`);
  ok(await page.$('.thes-def') !== null, 'and the senses show definitions');

  // close the tool so the context-menu path proves an independent open
  await page.evaluate(() => window.__scStore.getState().closeTool('thesaurus'));
  await settle(page);

  // 2 ── the editor context menu lists Thesaurus and it opens the tool
  await selectWord();
  const word = await page.evaluate(() => {
    const ed = window.__scEditor;
    const { from } = ed.state.selection;
    const coords = ed.view.coordsAtPos(from);
    return coords;
  });
  await page.mouse.click(word.left + 4, word.top + 4, { button: 'right' });
  await page.waitForSelector('.script-context-menu');
  const items = await page.$$eval('.script-context-menu .ctx-item', (els) => els.map((e) => e.textContent.trim()));
  ok(items.includes('Thesaurus'), `context menu lists Thesaurus (${items.length} items)`);
  await page.click('.script-context-menu .ctx-item:text-is("Thesaurus")');
  await page.waitForSelector('.thesaurus-tool');
  await page.waitForSelector('.thes-sense', { timeout: 6000 });
  const input2 = await page.$eval('.thes-input', (el) => el.value);
  ok(input2 === 'hologram', `the context-menu open looks up the selection too (input: "${input2}")`);
} catch (e) {
  console.log('PROBE ERROR:', e.message);
  await page.screenshot({ path: '/tmp/v619-err.png' }).catch(() => {});
} finally { await browser.close(); }
console.log(`\ncheck-v619: ${pass} passed, ${fail} failed`);
