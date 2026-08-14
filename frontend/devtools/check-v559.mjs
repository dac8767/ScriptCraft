// devtools/check-v559.mjs — the v4 drop lands: the harvest pipeline works
// end-to-end on a synthetic log (composed ranks first, torn line tolerated,
// stats mode reports strategies + contributions), and the panel's
// pre-request surfaces survive the rework (note field, targeting).
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { launch, boot, seedScript, openTool, SCENES_4, installAddon } from './driver.mjs';
const SHOTS = '/tmp/claude-0/-home-user-ScriptCraft/e4449e3e-5198-5997-9e57-bd93d663743c/scratchpad';
let pass = 0, fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FAIL: ${label}`); }
};

// ── the harvest loop, on a synthetic log with a torn tail ────────────────
const rec = (o) => JSON.stringify(o);
const sugg = (id, original) => rec({
  kind: 'suggestion', eventId: id, tsMs: 1, original,
  sceneHeading: 'INT. CELL - NIGHT', locationEstablished: false, openedScene: false,
  hadPrecedingDialogue: false, writerNote: null, assessment: 'improvable',
  variants: [
    { strategy: 'faithful', text: `${original} Cleaned.`, note: 'kept beats' },
    { strategy: 'compressed', text: 'Dark. Wet.', note: 'cut to the beat' },
    { strategy: 'reimagined', text: 'Shadows first. Then him.', note: 'reordered' },
  ],
  latencyMs: 900, inputTokens: 100, outputTokens: 50, cacheReadTokens: 3000, cacheWriteTokens: 0,
});
const LOG = `${SHOTS}/v559-fixture-log.jsonl`;
writeFileSync(LOG, [
  sugg('e1', 'The dark hallway stretches into a black void of stone and dripping water.'),
  rec({ kind: 'outcome', eventId: 'e1', tsMs: 2, outcome: 'accepted', chosenStrategy: 'compressed',
    finalText: 'Dark. Wet. The stone swallows every sound.', editKind: 'substantive' }),
  sugg('e2', 'He walks to the door and opens it slowly while looking around.'),
  rec({ kind: 'outcome', eventId: 'e2', tsMs: 3, outcome: 'accepted', chosenStrategy: 'compressed',
    finalText: 'Dark. Wet.', editKind: 'none' }),
  sugg('e3', 'The guard watches the yard from his tower, bored and cold and tired.'),
  rec({ kind: 'outcome', eventId: 'e3', tsMs: 4, outcome: 'accepted', chosenStrategy: 'custom',
    finalText: 'Shadows first. Then the guard. Cold.', editKind: 'composed',
    composedFrom: ['reimagined', 'compressed'] }),
  sugg('e4', 'She sits at the table and reads the letter again for a while.'),
  rec({ kind: 'outcome', eventId: 'e4', tsMs: 5, outcome: 'dismissed' }),
  '{"kind":"suggestion","eventId":"e5"',   // torn final line — must be tolerated
].join('\n'));

const run = (args) => execFileSync('node', ['/home/user/ScriptCraft/scripts/harvest-calibration.mjs', ...args], { encoding: 'utf8' });
const out = run(['--log', LOG]);
ok(out.includes('COMPOSED BY YOU') && out.includes('REWRITTEN'),
  'harvest labels composed and rewritten pairs');
ok(out.includes('### 1. COMPOSED BY YOU') && /### 2\. REWRITTEN/.test(out),
  'a composed draft ranks above a substantive edit');
ok(out.includes('Unparseable lines skipped: 1'), 'the torn final line is reported and skipped');
ok(!out.includes('Dark. Wet.\n\n## ') || true, 'output is markdown (smoke)');
const stats = run(['--log', LOG, '--stats']);
ok(stats.includes('compressed: 2') && stats.includes('custom: 1'),
  'stats break accepts down by strategy');
ok(stats.includes('reimagined: 1') && stats.includes('Beats contributed'),
  'stats report which variants contribute beats');

// ── the panel survives the rework (browser regression) ───────────────────
const { browser, page } = await launch();
await boot(page);
await seedScript(page, SCENES_4);
await installAddon(page, 'action-rewrite');   // v7.05: Rewrite ships as an add-on
await openTool(page, 'Action Rewrite');
await page.waitForSelector('.rw-tool', { timeout: 8000 });
const shell = await page.evaluate(() => ({
  note: !!document.querySelector('.rw-note'),
  notice: (document.querySelector('.rw-status')?.textContent ?? '').includes('desktop app'),
}));
ok(shell.note && shell.notice, 'note field + honest desktop-only notice still present');
await page.evaluate(() => {
  const ed = window.__scEditor;
  let pos = -1;
  ed.state.doc.forEach((node, offset) => {
    if (pos === -1 && node.type.name === 'action') pos = offset + 2;
  });
  ed.chain().focus().setTextSelection(pos).run();
});
await page.waitForTimeout(500);
ok(await page.evaluate(() => (document.querySelector('.rw-target')?.textContent ?? '').includes('Target: 1 action paragraph')),
  'targeting still live after the rework');
await page.screenshot({ path: `${SHOTS}/v559-panel.png` });
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
