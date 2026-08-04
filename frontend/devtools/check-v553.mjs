// devtools/check-v553.mjs — the Thesaurus tool: the local WordNet data
// loads (v6.03: wn_en_31 with per-sense DEFINITIONS; MyThes before that),
// lookups group senses by part of speech with a definition each, chips
// chain (with Back), the script caret drives the lookup, ⇄ replaces the
// script word in place with case kept, fallbacks and misses speak up, and
// the Tools menu lists it.
import { launch, boot, seedScript, openTool, SCENES_4, settle } from './driver.mjs';
const SHOTS = '/tmp/claude-0/-home-user-ScriptCraft/e4449e3e-5198-5997-9e57-bd93d663743c/scratchpad';
let pass = 0, fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FAIL: ${label}`); }
};
const { browser, page } = await launch();
await boot(page);
await seedScript(page, SCENES_4);

// ── the tool opens from the dock and loads its data ──────────────────────
await openTool(page, 'Thesaurus');
await page.waitForSelector('.thesaurus-tool', { timeout: 8000 });
await page.waitForFunction(
  () => !document.querySelector('.thes-input')?.disabled,
  { timeout: 30000 },
);
ok(true, 'Thesaurus opens from the dock and the local data loads');

// ── manual lookup: senses grouped by part of speech ──────────────────────
await page.fill('.thes-input', 'happy');
await page.press('.thes-input', 'Enter');
await page.waitForSelector('.thes-sense', { timeout: 5000 });
const happy = await page.evaluate(() => ({
  senses: document.querySelectorAll('.thes-sense').length,
  poses: [...document.querySelectorAll('.thes-pos')].map((e) => e.textContent),
  words: [...document.querySelectorAll('.thes-word')].slice(0, 6).map((e) => e.textContent),
  useButtons: document.querySelectorAll('.thes-use').length,
}));
ok(happy.senses >= 3 && happy.poses.includes('adj.'),
  `"happy" returns ${happy.senses} senses incl. adj. (${happy.words.slice(0, 3).join(', ')}…)`);
ok(happy.useButtons === 0, 'no replace buttons before a script word is targeted');
// v6.03, Derek: each sense shows its DEFINITION
const defs = await page.evaluate(() =>
  [...document.querySelectorAll('.thes-def')].map((e) => e.textContent.trim()).filter(Boolean));
ok(defs.length >= 3 && defs.some((d) => /joy|pleasure/.test(d)),
  `#v603 senses carry definitions (${defs.length}, e.g. “${(defs[0] ?? '').slice(0, 42)}…”)`);
await page.screenshot({ path: `${SHOTS}/v553-happy.png` });

// ── chip click chains the lookup; Back walks the trail ───────────────────
const firstWord = await page.evaluate(() => document.querySelector('.thes-word')?.textContent);
await page.click('.thes-word');
await settle(page);
const chained = await page.evaluate(() => ({
  input: document.querySelector('.thes-input')?.value,
  backOn: !document.querySelector('.thes-back')?.disabled,
}));
ok(chained.input === firstWord && chained.backOn,
  `clicking “${firstWord}” chains the lookup and arms Back`);
await page.click('.thes-back');
await settle(page);
ok(await page.evaluate(() => document.querySelector('.thes-input')?.value) === 'happy',
  'Back returns to “happy”');

// ── the script caret drives the tool ─────────────────────────────────────
await page.evaluate(() => {
  const ed = window.__scEditor;
  let at = -1;
  ed.state.doc.descendants((node, pos) => {
    if (at !== -1) return false;
    if (node.isText && node.text.includes('occupy')) {
      at = pos + node.text.indexOf('occupy') + 2;   // caret INSIDE the word
      return false;
    }
  });
  ed.chain().focus().setTextSelection(at).run();
});
await page.waitForTimeout(600);   // sync debounce is 250ms
const scripted = await page.evaluate(() => ({
  input: document.querySelector('.thes-input')?.value,
  context: document.querySelector('.thes-context')?.textContent ?? '',
  useButtons: document.querySelectorAll('.thes-use').length,
}));
ok(scripted.input === 'occupy' && scripted.context.includes('occupy') && scripted.useButtons > 0,
  `caret in “occupy” auto-looks it up, targets it, shows ⇄ (${scripted.useButtons} chips)`);

// ── replace in place, case kept ──────────────────────────────────────────
// (v6.03: the FIRST synonym, whatever the data ranks first — the old check
// hardcoded MyThes's "inhabit" and would pin the tool to one data file.)
const countOf = (w) => page.evaluate((word) =>
  window.__scEditor.getText().split(word).length - 1, w);
const synonym = await page.evaluate(() => document.querySelector('.thes-word')?.textContent);
const beforeOcc = await countOf('occupy');
const beforeSyn = await countOf(synonym);
await page.click('.thes-use');
await page.waitForTimeout(600);
const afterOcc = await countOf('occupy');
const afterSyn = await countOf(synonym);
ok(afterOcc === beforeOcc - 1 && afterSyn === beforeSyn + 1,
  `⇄ replaced one “occupy” with “${synonym}” (${beforeOcc}→${afterOcc} occurrences)`);
const followed = await page.evaluate(() => document.querySelector('.thes-input')?.value);
ok(followed === synonym, 'after the replace the tool follows onto the new word');
await page.screenshot({ path: `${SHOTS}/v553-replaced.png` });

// ── fallbacks and misses say what happened ───────────────────────────────
await page.fill('.thes-input', 'Hoping');
await page.press('.thes-input', 'Enter');
await settle(page);
const note = await page.evaluate(() => document.querySelector('.thes-note')?.textContent ?? '');
ok(note.includes('hope'), `“Hoping” falls back with a note (${note.trim()})`);
await page.fill('.thes-input', 'zzzqqq');
await page.press('.thes-input', 'Enter');
await settle(page);
ok(await page.evaluate(() => (document.querySelector('.thes-status')?.textContent ?? '').includes('No synonyms')),
  'a miss reports “No synonyms found”');

// ── the Tools menu lists it ──────────────────────────────────────────────
await page.evaluate(() => {
  [...document.querySelectorAll('.menu-item')].find((m) =>
    m.querySelector('.menu-label')?.textContent.trim() === 'Tools')?.click();
});
await page.waitForSelector('.menu-dropdown', { timeout: 4000 });
const inMenu = await page.evaluate(() =>
  [...document.querySelectorAll('.menu-dropdown-item')].some((b) => b.textContent.includes('Thesaurus')));
ok(inMenu, 'Tools menu lists Thesaurus');

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
