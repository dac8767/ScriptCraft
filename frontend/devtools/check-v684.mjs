/* check-v684 — Derek: "a new feedback system that does not require
   airtable" + "a log in system so my testers can send feedback and it will
   already know their name."

   Drives the REAL app: Help ▸ Feedback… opens the native tool (no Airtable
   iframe anywhere), the email → code → name sign-in runs against a stubbed
   window.fetch (the sandbox cannot reach Supabase; the stub answers with
   the documented shapes), a submission POSTs the row RLS expects, a server
   failure lands in the VISIBLE queue, and Retry drains it. */
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
    const { FEEDBACK_BACKEND } = await import('/src/services/feedbackBackend.ts');
    const BASE = FEEDBACK_BACKEND.url;
    window.__fbCalls = [];
    window.__fbFail = false;
    const real = window.fetch.bind(window);
    window.fetch = async (url, init) => {
      const u = String(url);
      if (!u.startsWith(BASE)) return real(url, init);
      window.__fbCalls.push({ url: u, method: init?.method, body: typeof init?.body === 'string' ? init.body : null });
      const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
      if (u.includes('/auth/v1/otp')) return json({});
      if (u.includes('/auth/v1/verify')) return json({
        access_token: 'at-1', refresh_token: 'rt-1', expires_in: 3600,
        user: { id: 'user-1', email: 'derek-tester@example.com', user_metadata: {} },
      });
      if (u.includes('/auth/v1/user')) return json({});
      if (u.includes('/rest/v1/feedback')) return window.__fbFail ? json({ message: 'unreachable' }, 503) : json({}, 201);
      if (u.includes('/storage/v1/object/')) return json({ Key: 'ok' });
      return json({});
    };
    localStorage.removeItem('opendraft:feedbackSession');
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

  /* ── sign-in: email → code → name ── */
  await page.fill(field('you@example.com'), 'derek-tester@example.com');
  await button('Send code');
  await page.waitForSelector(field('6-digit'), { timeout: 5000 });
  const otp = await page.evaluate(() => window.__fbCalls.find((c) => c.url.includes('/auth/v1/otp')));
  ok(!!otp && JSON.parse(otp.body).email === 'derek-tester@example.com',
    'Send code asks Supabase to email a code to that address');
  ok(await page.evaluate(() => document.querySelector('.feedback-tool-wrap').textContent.includes('Code sent')),
    'and says the code is on its way');

  await page.fill(field('6-digit'), '123456');
  await button('Verify');
  await page.waitForSelector(field('Your name'), { timeout: 5000 });
  ok(true, 'a first sign-in asks for the display name, once');
  await page.fill(field('Your name'), 'Derek Tester');
  await button('Save name');
  await page.waitForSelector('.fb-who', { timeout: 5000 });
  const who = await page.evaluate(() => document.querySelector('.fb-who').textContent);
  ok(/Derek Tester/.test(who) && /derek-tester@example.com/.test(who),
    `the form knows who is signing (${who.slice(0, 60)})`);

  /* ── a submission carries identity + version ── */
  await page.fill('.fb-text', 'The dialogue margin drifts on page 3.');
  await button('Send Feedback');
  await page.waitForFunction(() => window.__fbCalls.some((c) => c.url.includes('/rest/v1/feedback')), { timeout: 5000 });
  const row = await page.evaluate(() => JSON.parse(window.__fbCalls.find((c) => c.url.includes('/rest/v1/feedback')).body));
  ok(row.user_id === 'user-1' && row.name === 'Derek Tester' && row.email === 'derek-tester@example.com',
    'the row carries user_id + name + email — feedback already knows the tester');
  ok(row.message === 'The dialogue margin drifts on page 3.' && typeof row.app_version === 'string' && row.app_version.length > 0,
    `and the message + app version (${row.app_version})`);
  ok(await page.evaluate(() => document.querySelector('.feedback-tool-wrap').textContent.includes('Sent — thank you!')),
    'the form says it sent');

  /* ── failure is queued VISIBLY, and Retry drains it ── */
  await page.evaluate(() => { window.__fbFail = true; });
  await page.fill('.fb-text', 'This one hits a dead server.');
  await button('Send Feedback');
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

  /* ── sign out returns to the email step ── */
  await page.click('.fb-signout');
  await page.waitForSelector(field('you@example.com'), { timeout: 5000 });
  ok(await page.evaluate(() => !localStorage.getItem('opendraft:feedbackSession')),
    'Sign out forgets the session');

} catch (e) {
  console.log('PROBE ERROR:', e.message);
  fail++;
} finally { await browser.close(); }
console.log(`\ncheck-v684: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
