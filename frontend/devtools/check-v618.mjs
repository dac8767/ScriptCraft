/* check-v618 — v6.18, Derek: "if the action element is active and I copy and
   paste text into the script, that text that was pasted should be added into
   the action element. right now it adds it below the action element, which
   makes the paragraph spacing incorrect."
   Root cause: schema order decides where ProseMirror puts content with no
   matching parse rule, and CustomElement registered before Action — so
   external-clipboard paragraphs and plain text lines became ATTRLESS custom
   elements (no customTypeId, no template rule, wrong margins) instead of
   action. Action now registers first among the block nodes; these pin the
   fallback AND the behaviors that ride on Action's registration (its Tab
   keymap, typed-element HTML parsing, mid-text merge). */
import { launch, boot, settle } from './driver.mjs';

const { browser, page } = await launch({ width: 1500, height: 950 });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL', m); } };

const seedEmptyAction = () => page.evaluate(() => {
  const ed = window.__scEditor;
  ed.commands.setContent({ type: 'doc', content: [
    { type: 'sceneHeading', content: [{ type: 'text', text: 'INT. BRIDGE - NIGHT' }] },
    { type: 'action' },
  ] });
  let pos = null;
  ed.state.doc.descendants((n, p) => { if (n.type.name === 'action' && n.content.size === 0) pos = p + 1; return true; });
  ed.chain().focus().setTextSelection(pos).run();
});

const paste = (payloads) => page.evaluate((data) => {
  const dt = new DataTransfer();
  for (const [mime, s] of Object.entries(data)) dt.setData(mime, s);
  document.querySelector('.ProseMirror').dispatchEvent(
    new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
}, payloads);

const blocks = () => page.evaluate(() => {
  const out = [];
  window.__scEditor.state.doc.forEach((n) => out.push({ type: n.type.name, text: n.textContent, empty: n.content.size === 0 }));
  return out;
});

try {
  await boot(page);

  // 1 ── plain-text clipboard into an empty active action
  await seedEmptyAction();
  await paste({ 'text/plain': 'The co-pilot summons a hologram.\n\nIt flickers twice.' });
  await settle(page);
  let b = await blocks();
  ok(b.length === 3 && b[1].type === 'action' && b[2].type === 'action',
    `plain-text paste fills the action as action blocks (${b.map((x) => x.type).join(',')})`);
  ok(!b.some((x) => x.type === 'customElement'), 'no attrless customElement minted');
  ok(!b.some((x) => x.empty && x.type === 'action'), 'no leftover empty action above the paste');

  // 2 ── external HTML clipboard (bare <p> — no parse rule matches)
  await seedEmptyAction();
  await paste({ 'text/html': '<p>From a web page.</p><p>Second paragraph.</p>', 'text/plain': 'From a web page.\n\nSecond paragraph.' });
  await settle(page);
  b = await blocks();
  ok(b[1]?.type === 'action' && b[2]?.type === 'action' && b[2].text === 'Second paragraph.',
    `external <p> HTML lands as action too (${b.map((x) => x.type).join(',')})`);

  // 3 ── caret mid-text: first paragraph merges, the rest continue as action
  await seedEmptyAction();
  await page.evaluate(() => window.__scEditor.chain().focus().insertContent('Already here. ').run());
  await paste({ 'text/plain': 'Joined on.\n\nNew block.' });
  await settle(page);
  b = await blocks();
  ok(b[1]?.text === 'Already here. Joined on.' && b[2]?.type === 'action' && b[2].text === 'New block.',
    'mid-text paste merges into the action and continues as action');

  // 4 ── typed screenplay HTML still parses by its own rule, not the fallback
  await seedEmptyAction();
  await paste({ 'text/html': '<div data-type="dialogue">Copied dialogue line.</div>' });
  await settle(page);
  b = await blocks();
  ok(b.some((x) => x.type === 'dialogue' && x.text === 'Copied dialogue line.'),
    'div[data-type="dialogue"] still becomes dialogue (parse rules beat the fallback)');

  // 5 ── Action's Tab keymap survived the earlier registration slot
  await seedEmptyAction();
  await page.evaluate(() => window.__scEditor.chain().focus().insertContent('He runs.').run());
  await page.keyboard.press('Tab');
  await settle(page);
  b = await blocks();
  ok(b[b.length - 1].type === 'character', 'Tab from action still splits to character');
} catch (e) {
  console.log('PROBE ERROR:', e.message);
  await page.screenshot({ path: '/tmp/v618-err.png' }).catch(() => {});
} finally { await browser.close(); }
console.log(`\ncheck-v618: ${pass} passed, ${fail} failed`);
