// devtools/check-v561.mjs — full-length suggestions, one scroll: the
// .rw-grow mirror makes the draft textarea match its content height with no
// inner scroll (probed against the real stylesheet), and the beat list no
// longer scrolls itself.
import { launch, boot } from './driver.mjs';
let pass = 0, fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FAIL: ${label}`); }
};
const { browser, page } = await launch();
await boot(page);

const probe = await page.evaluate(() => {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:0;top:0;width:340px;';
  host.innerHTML = '<div class="rw-grow"><textarea class="rw-card-edit" rows="2"></textarea></div>';
  document.body.appendChild(host);
  const wrap = host.querySelector('.rw-grow');
  const ta = host.querySelector('textarea');
  const long = Array.from({ length: 6 }, (_, i) =>
    `Paragraph ${i + 1} carrying enough words to wrap across several visual lines inside a narrow card without any newline characters at all.`)
    .join('\n\n');
  ta.value = long;
  wrap.setAttribute('data-value', `${long}\n`);
  const tall = { h: ta.clientHeight, scroll: ta.scrollHeight, wrapH: wrap.clientHeight };
  const short = 'One line.';
  ta.value = short;
  wrap.setAttribute('data-value', `${short}\n`);
  const small = { h: ta.clientHeight };
  const overflow = getComputedStyle(ta).overflowY;
  host.remove();
  return { tall, small, overflow };
});
ok(probe.tall.h > 300, `a long draft renders at full height (${probe.tall.h}px, no cap)`);
ok(probe.tall.scroll <= probe.tall.h + 2, 'the textarea has NO inner scroll (scrollHeight == clientHeight)');
ok(probe.overflow === 'hidden', 'textarea overflow is hidden — the body owns scrolling');
ok(probe.small.h < 80 && probe.small.h < probe.tall.h, `it shrinks back with the content (${probe.small.h}px)`);
ok(await page.evaluate(() => {
  const host = document.createElement('div');
  host.innerHTML = '<div class="rw-beat-list"></div>';
  document.body.appendChild(host);
  const mh = getComputedStyle(host.firstChild).maxHeight;
  host.remove();
  return mh === 'none';
}), 'the beat list no longer scrolls itself (max-height gone)');

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
