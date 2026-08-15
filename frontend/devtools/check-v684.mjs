/* check-v684 — Derek: "a new feedback system that does not require
   airtable" + feedback that already knows the tester. v6.86: friends-only
   — the once-only PROFILE (name + email, no verification) replaced the
   email-code sign-in.

   Drives the REAL app: Help ▸ Feedback… opens the native tool (no Airtable
   iframe anywhere), the profile card saves locally with zero network, a
   submission POSTs name+email+version anonymously (stubbed window.fetch —
   the sandbox cannot reach Supabase), a server failure lands in the
   VISIBLE queue, and Retry drains it. v6.87 (the first request submitted
   through the form itself): the labeled Attachment area — Screenshot /
   Area / Browse… — where a browsed JPEG keeps its real format and lands
   in the table's `attachments` column. */
import { launch, boot, seedScript, SCENES_4, settle } from './driver.mjs';

const { browser, page } = await launch({ width: 1500, height: 950 });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL', m); } };

const openMenu = async (name) => {
  for (let i = 0; i < 3; i++) {
    await page.click(`.menu-item:has-text("${name}")`);
    await settle(page);
    if (await page.evaluate(() => !!document.querySelector('.menu-dropdown'))) return;
  }
  throw new Error(`could not open the ${name} menu`);
};
const field = (ph) => `.feedback-tool-wrap :is(input, textarea)[placeholder*="${ph}"]`;
const button = (t) => page.evaluate((txt) => {
  const b = [...document.querySelectorAll('.feedback-tool-wrap button')].find((x) => x.textContent.trim() === txt);
  if (!b) throw new Error(`no button ${txt}`);
  b.click();
}, t);

try {
  await boot(page);
  await seedScript(page, SCENES_4);
  await settle(page);

  // the fetch stub — Supabase URLs only; everything else passes through
  await page.evaluate(async () => {
    const { FEEDBACK_BACKEND } = await window.__scImport('/src/services/feedbackBackend.ts');
    const BASE = FEEDBACK_BACKEND.url;
    window.__fbCalls = [];
    window.__fbFail = false;
    const real = window.fetch.bind(window);
    window.fetch = async (url, init) => {
      const u = String(url);
      if (!u.startsWith(BASE)) return real(url, init);
      window.__fbCalls.push({ url: u, method: init?.method, body: typeof init?.body === 'string' ? init.body : null, type: init?.headers?.['Content-Type'] ?? null });
      const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
      if (u.includes('/rest/v1/feedback')) return window.__fbFail ? json({ message: 'unreachable' }, 503) : json({}, 201);
      if (u.includes('/storage/v1/object/')) return json({ Key: 'ok' });
      return json({});
    };
    localStorage.removeItem('opendraft:feedbackProfile');
    localStorage.removeItem('opendraft:feedbackQueue');
  });

  /* ── the door: Help ▸ Feedback… opens the NATIVE tool ── */
  await openMenu('Help');
  await page.click('.menu-dropdown :text("Feedback…")');
  await page.waitForSelector('.feedback-tool-wrap', { timeout: 8000 });
  const noAirtable = await page.evaluate(() => ({
    frame: !!document.querySelector('.feedback-tool-frame, .feedback-frame-host, iframe[src*="airtable"]'),
    chipBtns: document.querySelectorAll('.feedback-shot-btns').length,
  }));
  ok(!noAirtable.frame, 'Help ▸ Feedback opens the native form — NO Airtable iframe anywhere');
  ok(noAirtable.chipBtns === 0, 'and the old screenshot-chip header buttons are gone');

  /* ── the once-only profile: name + email, no verification, no network ── */
  await page.fill(field('Your name'), 'Derek Tester');
  await page.fill(field('you@example.com'), 'derek-tester@example.com');
  await button('Start');
  await page.waitForSelector('.fb-who', { timeout: 5000 });
  const who = await page.evaluate(() => document.querySelector('.fb-who').textContent);
  ok(/Name:/.test(who) && /Derek Tester/.test(who) && !/@/.test(who),
    `the form shows Name: without the email (${who.slice(0, 60)})`);
  ok(await page.evaluate(() => window.__fbCalls.length) === 0,
    'and identity cost ZERO network — no codes, no sign-in service');

  /* ── a submission carries identity + version ── */
  await page.fill('.fb-text', 'The dialogue margin drifts on page 3.');
  await button('Submit');
  await page.waitForFunction(() => window.__fbCalls.some((c) => c.url.includes('/rest/v1/feedback')), { timeout: 5000 });
  const row = await page.evaluate(() => JSON.parse(window.__fbCalls.find((c) => c.url.includes('/rest/v1/feedback')).body));
  ok(row.name === 'Derek Tester' && row.email === 'derek-tester@example.com',
    'the row carries name + email — feedback already knows the tester');
  ok(row.message === 'The dialogue margin drifts on page 3.' && typeof row.app_version === 'string' && row.app_version.length > 0,
    `and the message + app version (${row.app_version})`);
  await page.waitForSelector('.fb-sent-veil', { timeout: 5000 });
  const veil = await page.evaluate(() => {
    const v = document.querySelector('.fb-sent-veil');
    const cs = getComputedStyle(v);
    return { text: v.textContent, blur: cs.backdropFilter || cs.webkitBackdropFilter || '' };
  });
  ok(/Your feedback has been sent\. Thank you!/.test(veil.text) && /blur/.test(veil.blur),
    `v6.89 sent = a centered thank-you above a real blur veil (${veil.blur})`);
  await page.waitForFunction(() => !document.querySelector('.fb-sent-veil'), { timeout: 6000 });
  ok(true, 'and the veil clears itself after a few seconds');

  /* ── failure is queued VISIBLY, and Retry drains it ── */
  await page.evaluate(() => { window.__fbFail = true; });
  await page.fill('.fb-text', 'This one hits a dead server.');
  await button('Submit');
  await page.waitForSelector('.fb-queued', { timeout: 5000 });
  const queued = await page.evaluate(() => ({
    chip: document.querySelector('.fb-queued')?.textContent ?? '',
    stored: JSON.parse(localStorage.getItem('opendraft:feedbackQueue') || '[]').length,
  }));
  ok(/1 feedback item waiting/.test(queued.chip) && queued.stored === 1,
    `a failed send lands in the visible queue (${queued.chip.slice(0, 40)}…)`);
  await page.evaluate(() => { window.__fbFail = false; });
  await button('Retry now');
  await page.waitForFunction(() => !document.querySelector('.fb-queued'), { timeout: 5000 });
  ok(await page.evaluate(() => JSON.parse(localStorage.getItem('opendraft:feedbackQueue') || '[]').length) === 0,
    'Retry sends it and the queue empties');

  /* ── v6.87: the labeled Attachment area, and Browse… keeps the format ── */
  const attach = await page.evaluate(() => {
    const area = document.querySelector('.fb-attach');
    return {
      label: area?.querySelector('.fb-attach-head')?.textContent.trim() ?? '',
      btns: [...(area?.querySelectorAll('.fb-attach-btns button') ?? [])].map((b) => b.textContent.trim()),
      file: !!area?.querySelector('input[type="file"]'),
    };
  });
  ok(/Attach a Screenshot/.test(attach.label), `the form has a labeled attachment area ("${attach.label}")`);
  ok(attach.btns.join(',') === 'Full Screen,Area,Browse…' && attach.file,
    `with Full Screen / Area / Browse… and a real file input behind it (${attach.btns.join(' / ')})`);
  ok(await page.evaluate(() => {
    const head = document.querySelector('.fb-attach-head');
    return !!head?.querySelector('.fb-attach-btns') && head.lastElementChild?.classList.contains('fb-attach-btns');
  }), 'v6.93/94: the three buttons sit ON the header row, no ? after them');
  ok(await page.evaluate(() => !document.querySelector('.fb-attach-help') && !document.body.textContent.includes('A screenshot helps me a ton')),
    'v6.94: the ? and its how-to text are gone entirely');

  /* ── v6.97: typed lists continue on Enter (the v6.96 buttons are GONE) ── */
  ok(await page.evaluate(() => !document.querySelector('.fb-fmt-row')),
    'v6.97: the v6.96 formatting buttons are gone');
  /* v7.12: WAIT for the controlled value instead of reading it on the next
     line. fill → focus → setSelectionRange → keypress is four round trips, and
     under a loaded dev server (check-all runs four browsers) the keystroke
     could land before React had re-rendered the field, so this pair failed
     only in the full suite. Waiting on the value is the real condition. */
  const fbValue = () => page.evaluate(() => document.querySelector('.fb-text').value);
  const waitValue = async (want) => {
    try {
      await page.waitForFunction((w) => document.querySelector('.fb-text')?.value === w, want, { timeout: 4000 });
      return true;
    } catch { return false; }
  };
  await page.fill('.fb-text', '- alpha');
  await waitValue('- alpha');
  await page.focus('.fb-text');
  await page.evaluate(() => {
    const ta = document.querySelector('.fb-text');
    ta.setSelectionRange(ta.value.length, ta.value.length);
  });
  await page.keyboard.press('Enter');
  /* v7.15: WAIT for the caret, not for a delay. .fb-text is a CONTROLLED
     textarea, so the Enter handler re-applies both value AND caret through
     React; typing before the caret restore lands writes into the OLD
     position, and "beta" came out "etab" — scrambled, not missing. A
     per-keystroke delay (v7.12's fix) only made the race less likely, and it
     came back under the full suite's four concurrent browsers. The real
     precondition is: the continued value is in, and the caret is at its end.
     Typing one character at a time and waiting for each to appear at the end
     turns any remaining stall into a clean failure instead of a scramble. */
  const waitCaretEnd = () => page.waitForFunction(() => {
    const ta = document.querySelector('.fb-text');
    return !!ta && ta.selectionStart === ta.value.length && ta.selectionEnd === ta.value.length;
  }, null, { timeout: 4000 }).then(() => true, () => false);
  const typeSteady = async (text) => {
    for (const ch of text) {
      const want = (await fbValue()) + ch;
      await page.keyboard.type(ch);
      if (!(await waitValue(want))) return false;
    }
    return true;
  };
  const continued = await waitValue('- alpha\n- ') && await waitCaretEnd();
  ok(continued && await typeSteady('beta') && await waitValue('- alpha\n- beta'),
    `Enter continues a typed "- " list (${JSON.stringify(await fbValue())})`);
  await page.keyboard.press('Enter');
  await waitValue('- alpha\n- beta\n- ');
  await page.keyboard.press('Enter');
  ok(await waitValue('- alpha\n- beta\n'),
    `Enter on an empty item ends the list (${JSON.stringify(await fbValue())})`);
  await page.fill('.fb-text', '');
  await page.evaluate(async () => {
    const { applyDesignVars } = await import('/src/design/designTokens.ts');
    applyDesignVars({ fbRowGap: 24 });
  });
  ok(await page.evaluate(() => getComputedStyle(document.querySelector('.feedback-tool-wrap')).rowGap) === '24px',
    'the new Design knobs really move the window (row gap 10 → 24)');
  await page.evaluate(async () => {
    const { applyDesignVars } = await import('/src/design/designTokens.ts');
    applyDesignVars({});
  });
  await page.setInputFiles('.fb-attach input[type="file"]', {
    name: 'margin-bug.jpeg', mimeType: 'image/jpeg',
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]),
  });
  await page.waitForSelector('.fb-shotchip', { timeout: 5000 });
  ok(await page.evaluate(() => document.querySelector('.fb-shotchip').textContent.includes('margin-bug.jpeg')),
    'picking a file shows a chip with ITS name — not a silent no-op');
  ok(await page.evaluate(() => [...document.querySelectorAll('.fb-attach-btns button')].map((b) => b.textContent.trim()).join(',')) === 'Full Screen,Area,Browse…',
    'v6.89: the three buttons STAY after attaching');
  await page.setInputFiles('.fb-attach input[type="file"]', {
    name: 'second-shot.png', mimeType: 'image/png',
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]),
  });
  await page.waitForFunction(() => document.querySelectorAll('.fb-shotchip').length === 2, { timeout: 5000 });
  ok(true, 'a second pick APPENDS — two chips now');
  await page.fill('.fb-text', 'See the attached images.');
  await button('Submit');
  await page.waitForFunction(() => window.__fbCalls.filter((c) => c.url.includes('/storage/v1/object/feedback-shots/')).length === 2, { timeout: 5000 });
  const uploaded = await page.evaluate(() => {
    const ups = window.__fbCalls.filter((c) => c.url.includes('/storage/v1/object/feedback-shots/'));
    const row = [...window.__fbCalls].reverse().find((c) => c.url.includes('/rest/v1/feedback'));
    return { ups: ups.map((u) => ({ url: u.url, type: u.type })), row: row?.body ? JSON.parse(row.body) : {} };
  });
  ok(/\.jpg$/.test(uploaded.ups[0].url) && uploaded.ups[0].type === 'image/jpeg'
      && /\.png$/.test(uploaded.ups[1].url) && uploaded.ups[1].type === 'image/png',
    'each upload keeps its own real format (jpg + png)');
  const attPaths = uploaded.ups.map((u) => u.url.split('/feedback-shots/')[1]);
  ok(uploaded.row.attachments === attPaths.join(',') && !('screenshot_path' in uploaded.row),
    'the row records BOTH paths comma-joined in attachments (screenshot_path gone)');
  await page.waitForFunction(() => !document.querySelector('.fb-sent-veil'), { timeout: 6000 });

  /* ── v6.88: the draft SURVIVES the window moving between hosts ── */
  await page.fill('.fb-text', 'Half-written report — do not lose me.');
  await page.evaluate(() => window.__scStore.getState().setFullscreenTool('feedback'));
  await settle(page);
  ok(await page.evaluate(() => document.querySelector('.fb-text')?.value) === 'Half-written report — do not lose me.',
    'moving to the fullscreen takeover keeps the typed draft');
  await page.evaluate(() => window.__scStore.getState().setFullscreenTool(null));
  await settle(page);
  ok(await page.evaluate(() => document.querySelector('.fb-text')?.value) === 'Half-written report — do not lose me.',
    'and moving back keeps it too — the draft outlives every host');
  await page.fill('.fb-text', '');

  /* ── Edit reopens the card, prefilled ── */
  await page.click('.fb-signout');
  await page.waitForSelector(field('Your name'), { timeout: 5000 });
  ok(await page.evaluate(() => document.querySelector('.fb-signin input').value) === 'Derek Tester',
    'Edit reopens the profile card with the saved name in place');

} catch (e) {
  console.log('PROBE ERROR:', e.message);
  fail++;
} finally { await browser.close(); }
console.log(`\ncheck-v684: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
