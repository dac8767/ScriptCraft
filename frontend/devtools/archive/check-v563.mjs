// devtools/check-v563.mjs — the visual language restored: card headers are
// plain text (no dark block), and the draft field wears EXACTLY the same
// input dress as the note field (same background, same border), with the
// grow mechanism still exact despite the added border.
import { launch, boot, seedScript, openTool, SCENES_4, installAddon } from './driver.mjs';
const SHOTS = '/tmp/claude-0/-home-user-ScriptCraft/e4449e3e-5198-5997-9e57-bd93d663743c/scratchpad';
let pass = 0, fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FAIL: ${label}`); }
};
const { browser, page } = await launch();
await boot(page);
await seedScript(page, SCENES_4);
await installAddon(page, 'action-rewrite');   // v7.05: Rewrite ships as an add-on
await openTool(page, 'Action Rewrite');
await page.waitForSelector('.rw-note', { timeout: 8000 });

const styles = await page.evaluate(() => {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:0;top:0;width:340px;';
  host.innerHTML = `
    <div class="rw-card">
      <div class="rw-card-head"><span class="rw-card-label">Faithful</span><span class="rw-card-blurb">blurb</span></div>
      <div class="rw-grow" data-value="Text here.\n"><textarea class="rw-card-edit">Text here.</textarea></div>
    </div>`;
  document.body.appendChild(host);
  const note = getComputedStyle(document.querySelector('.rw-note'));
  const head = getComputedStyle(host.querySelector('.rw-card-head'));
  const edit = getComputedStyle(host.querySelector('.rw-card-edit'));
  const ta = host.querySelector('textarea');
  ta.focus();
  const focusBorder = getComputedStyle(ta).borderColor;
  ta.blur();
  const long = Array.from({ length: 5 }, () =>
    'A paragraph long enough to wrap over several visual lines in a narrow card.').join('\n\n');
  ta.value = long;
  host.querySelector('.rw-grow').setAttribute('data-value', `${long}\n`);
  const grown = { h: ta.clientHeight, scroll: ta.scrollHeight };
  const out = {
    headBg: head.backgroundColor,
    sameBg: edit.backgroundColor === note.backgroundColor,
    sameBorder: edit.borderTopColor === note.borderTopColor && edit.borderTopWidth === note.borderTopWidth,
    noteBg: note.backgroundColor,
    editBg: edit.backgroundColor,
    focusChanged: focusBorder !== edit.borderTopColor,
    grown,
  };
  host.remove();
  return out;
});
ok(styles.headBg === 'rgba(0, 0, 0, 0)' || styles.headBg === 'transparent',
  `card headers are plain text — no dark block (${styles.headBg})`);
ok(styles.sameBg, `the draft field wears the input background (${styles.editBg})`);
ok(styles.sameBorder, 'the draft field wears the input border — same as the note field');
ok(styles.focusChanged, 'focus turns the border accent, like every other field');
ok(styles.grown.h > 250 && styles.grown.scroll <= styles.grown.h + 2,
  `the grow mechanism stays exact with the border (${styles.grown.h}px, no inner scroll)`);
await page.screenshot({ path: `${SHOTS}/v563-language.png` });
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
