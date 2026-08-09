/* check-v664 — Derek: "the 'send to script' button in the outline toolbar
   adds the section header as an annotation at the indicated page location.
   if section info changes, such as the name or the estimated page amount,
   the change should be indicated in the annotation as well."

   Driven in the real document, because a store assert would pass while the
   script on screen said something else (the v6.62 lesson).

   1 the button sends SECTIONS (it used to append one line per beat)
   2 each line lands at the page the outline puts the section on
   3 the line carries the name AND the page estimate
   4 renaming the section rewrites the line — on the spot, no re-send
   5 changing the page estimate rewrites it too
   6 it mirrors with the Outline Bar CLOSED (the rename happens on the board)
   7 sending again updates instead of duplicating
   8 the mirror is not an undo step — Undo takes back the rename itself
   9 deleting the section leaves the writer's line alone */
import { launch, boot, seedScript, SCENES_4, settle } from './driver.mjs';

const { browser, page } = await launch({ width: 1500, height: 950 });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL', m); } };

/** Every general line in the doc that was sent from the outline. */
const sentLines = () => page.evaluate(() => {
  const out = [];
  window.__scEditor.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'general') return;
    if (node.attrs.outlineSectionId) out.push({ id: node.attrs.outlineSectionId, text: node.textContent, pos });
    return false;
  });
  return out;
});
const lineFor = async (id) => (await sentLines()).find((l) => l.id === id);

try {
  await boot(page);
  await seedScript(page, SCENES_4);
  await page.evaluate(() => window.__scStore.getState().setOutlineBarOpen(true));
  await page.waitForSelector('.fs-ob-main', { timeout: 8000 });
  const ids = await page.evaluate(() => {
    const st = window.__scStore.getState();
    st.setBeatColumns([]); st.setBeats([]);
    const a = st.addBeatColumn('Act I', 4);
    const b = st.addBeatColumn('Act II', 8);
    st.addBeat('Opening', a);
    return { a, b };
  });
  // the bar learns the script's page ranges on a debounce — the placement
  // is only meaningful once it has them
  await page.waitForSelector('.fs-ob-scenes .fs-ob-scene', { timeout: 8000 });
  await settle(page);

  /* ── 1–3: send ── */
  await page.click('button[title^="Send to Script"]');
  await page.waitForSelector('.fs-confirm-overlay', { timeout: 5000 });
  const prompt = await page.evaluate(() => document.querySelector('.fs-confirm-box')?.textContent ?? '');
  ok(/2 sections/.test(prompt) && /mirroring/.test(prompt),
    `the confirm says sections, and that the line keeps mirroring ("${prompt.slice(0, 60)}…")`);
  await page.click('.fs-confirm-ok');
  await settle(page);

  const lines = await sentLines();
  ok(lines.length === 2, `one line per SECTION, not per beat (${lines.length})`);
  const byId = Object.fromEntries(lines.map((l) => [l.id, l]));
  ok(byId[ids.a]?.text === '# Act I — 4 pages' && byId[ids.b]?.text === '# Act II — 8 pages',
    `each carries its name and page estimate (${lines.map((l) => l.text).join(' | ')})`);
  ok(byId[ids.a].pos < byId[ids.b].pos,
    `Act I's line comes before Act II's in the script (${byId[ids.a].pos} < ${byId[ids.b].pos})`);
  // Act I starts on page 1, so its line belongs at the top of the script —
  // not appended to the end with everything else.
  const docEnd = await page.evaluate(() => window.__scEditor.state.doc.content.size);
  ok(byId[ids.a].pos < docEnd / 2,
    `it is placed at its page, near the top, not appended (${byId[ids.a].pos} of ${docEnd})`);

  // the link has to survive save/load — it rides the node's HTML like todoId
  const html = await page.evaluate(() => window.__scEditor.getHTML());
  const stamped = (html.match(/data-outline-section=/g) || []).length;
  ok(stamped === 2, `the section link is written into the saved document (${stamped} stamps)`);

  /* ── 4: rename ── */
  await page.evaluate((id) => window.__scStore.getState().updateBeatColumn(id, { title: 'Act One' }), ids.a);
  await settle(page);
  const renamed = await lineFor(ids.a);
  ok(renamed.text === '# Act One — 4 pages', `renaming the section rewrote the line (${renamed.text})`);

  /* ── 5: page estimate ── */
  await page.evaluate((id) => window.__scStore.getState().updateBeatColumn(id, { targetPages: 12 }), ids.a);
  await settle(page);
  const repaged = await lineFor(ids.a);
  ok(repaged.text === '# Act One — 12 pages', `changing the estimate rewrote it too (${repaged.text})`);
  ok((await lineFor(ids.b)).text === '# Act II — 8 pages', 'and the other section was left alone');

  /* ── 6: with the bar CLOSED — the rename happens on the board ── */
  await page.evaluate(() => window.__scStore.getState().setOutlineBarOpen(false));
  await settle(page);
  await page.evaluate((id) => window.__scStore.getState().updateBeatColumn(id, { title: 'Act I Revised', targetPages: 20 }), ids.a);
  await settle(page);
  const closedBar = await lineFor(ids.a);
  ok(closedBar.text === '# Act I Revised — 20 pages',
    `it mirrors with the Outline Bar closed (${closedBar.text})`);
  await page.evaluate(() => window.__scStore.getState().setOutlineBarOpen(true));
  await settle(page);

  /* ── 7: send again ── */
  await page.evaluate(() => window.__scStore.getState().addBeatColumn('Act III', 6));
  await settle(page);
  await page.click('button[title^="Send to Script"]');
  await page.waitForSelector('.fs-confirm-overlay', { timeout: 5000 });
  await page.click('.fs-confirm-ok');
  await settle(page);
  const after = await sentLines();
  ok(after.length === 3, `sending again added only the new section — no duplicates (${after.length})`);
  ok(after.filter((l) => l.id === ids.a).length === 1, 'the section already there is still one line');

  /* ── 8: the mirror is not an undo step ── */
  await page.evaluate((id) => window.__scStore.getState().updateBeatColumn(id, { title: 'Undo Me' }), ids.b);
  await settle(page);
  ok((await lineFor(ids.b)).text.startsWith('# Undo Me'), 'a rename lands before the undo test');
  await page.evaluate(() => window.__scStore.getState().beatUndo());
  await settle(page);
  const undone = await page.evaluate((id) => window.__scStore.getState().beatColumns.find((c) => c.id === id)?.title, ids.b);
  const undoneLine = await lineFor(ids.b);
  ok(undone === 'Act II' && undoneLine.text === '# Act II — 8 pages',
    `Undo takes back the rename and the line follows (${undone} / ${undoneLine.text})`);

  /* ── 9: a deleted section never deletes the writer's line ── */
  const before = (await sentLines()).length;
  await page.evaluate((id) => window.__scStore.getState().deleteBeatColumn(id), ids.b);
  await settle(page);
  const kept = await sentLines();
  ok(kept.length === before && kept.some((l) => l.id === ids.b),
    `deleting the section leaves its line in the script (${kept.length} of ${before})`);
  ok(kept.find((l) => l.id === ids.b).text === '# Act II — 8 pages',
    'exactly as it was written — the mirror never rewrites for a section that is gone');

} catch (e) {
  console.log('PROBE ERROR:', e.message);
  fail++;
} finally { await browser.close(); }
console.log(`\ncheck-v664: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
