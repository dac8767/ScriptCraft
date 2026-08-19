/* check-v762 — Derek, getting ready to hand the app to a handful of testers:
 * "create the public releases repo now, build the notify-only version, do the
 * version-sync fix."
 *
 * NOTIFY ONLY. The banner tells you a newer build exists and links to it; it
 * does not install anything. Installing in place is tauri-plugin-updater's job
 * and it waits for a Developer ID — an unsigned macOS app replacing its own
 * bundle is the one failure you cannot talk a tester through over a message.
 *
 * TWO CHECKS WITH TWO DIFFERENT MANNERS, which is the whole design and the
 * thing most likely to be flattened by someone tidying later:
 *
 *   AUTOMATIC (on launch) — silent unless it has good news. A writer opening a
 *   script on a train did not ask about updates and must not be told the
 *   network is down.
 *
 *   MANUAL (Help ▸ Check for Updates…) — always answers, including "you're up
 *   to date" and including the error. A question that gets silence back cannot
 *   be told apart from a broken feature, which is this app's cardinal sin
 *   wearing a network error as a disguise.
 *
 * The manifest is served from a route intercept here, so the assertions are
 * about THIS app's behaviour rather than about whether a repo exists yet.
 * The version comparison — where "7.10 < 7.9" would quietly kill the feature
 * at the first release past x.9 — is unit-tested in services/updateCheck.test.ts.
 */
import { readFileSync } from 'node:fs';
import { launch, boot, settle } from './driver.mjs';
import { readAppVersion, readBundleVersion, toSemver } from './sync-version.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};

/** A page with the manifest endpoint stubbed to `body` (or failing). */
const withManifest = async (body, { status = 200, abort = false } = {}) => {
  const { browser, page } = await launch({ width: 1400, height: 900 });
  await page.route('**/latest.json*', (r) => (abort
    ? r.abort()
    : r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })));
  await boot(page);
  await settle(page);
  return { browser, page };
};

const banner = (page) => page.evaluate(() => {
  const b = document.querySelector('.update-banner');
  if (!b) return null;
  const a = b.querySelector('a');
  return {
    text: b.textContent.trim(),
    href: a?.getAttribute('href') ?? null,
    target: a?.getAttribute('target') ?? null,
    rel: a?.getAttribute('rel') ?? null,
  };
});

/* ── a newer version ─────────────────────────────────────────────────────── */
{
  console.log('\na newer version announces itself, once the app has opened');
  const { browser, page } = await withManifest({
    version: '9.99', url: 'https://example.com/dl', notes: 'faster pagination', date: '2026-08-19',
  });

  /* The check waits for startup. Asserting the banner is ABSENT first is what
     separates "it waits" from "it never ran" — without it, a broken check and a
     working delay look the same. */
  ok('nothing competes with the app opening', (await banner(page)) === null, '');
  await page.waitForTimeout(5200);
  const b = await banner(page);
  ok('…then the banner appears', b !== null, '');
  ok('…naming the version on offer', /9\.99/.test(b.text), JSON.stringify(b.text));
  ok('…and the version you have', /you have/.test(b.text), JSON.stringify(b.text));
  ok('…and the note from the manifest', /faster pagination/.test(b.text), JSON.stringify(b.text));
  /* A LINK, not a button that implies installation. */
  ok('the action is a link to the download', b.href === 'https://example.com/dl', JSON.stringify(b));
  ok('…opening outside the app, safely',
    b.target === '_blank' && /noopener/.test(b.rel || ''), JSON.stringify(b));

  console.log('\ndismissing means "not this one", not "never again"');
  await page.evaluate(() => document.querySelector('.update-banner-x')?.click());
  await page.waitForTimeout(300);
  ok('the banner goes', (await banner(page)) === null, '');
  ok('…and the VERSION is what was remembered, not a flag',
    (await page.evaluate(() => localStorage.getItem('opendraft:updateDismissed'))) === '9.99', '');
  await browser.close();
}

/* ── already current ─────────────────────────────────────────────────────── */
{
  console.log('\nbeing up to date is silent');
  const app = /APP_VERSION = '([^']+)'/.exec(
    readFileSync(new URL('../src/data/changelog.ts', import.meta.url), 'utf8'))[1];
  const { browser, page } = await withManifest({ version: app, url: 'https://example.com/dl' });
  await page.waitForTimeout(5200);
  ok('no banner when the manifest matches this build', (await banner(page)) === null, '');
  await browser.close();
}

/* ── a manifest offering an OLDER build ──────────────────────────────────── */
{
  console.log('\nand a rolled-back manifest never pushes anyone backwards');
  const { browser, page } = await withManifest({ version: '0.1', url: 'https://example.com/dl' });
  await page.waitForTimeout(5200);
  ok('no banner for a version older than this one', (await banner(page)) === null, '');
  await browser.close();
}

/* ── the network is down ─────────────────────────────────────────────────── */
{
  console.log('\nthe automatic check is silent when it cannot find out');
  const { browser, page } = await withManifest(null, { abort: true });
  await page.waitForTimeout(5200);
  ok('no banner', (await banner(page)) === null, '');
  /* And no toast either. THIS is the assertion that matters: an unasked check
     that reports its own failure is worse than one that says nothing, because
     it teaches the writer that the app interrupts for things they cannot act
     on. */
  ok('…and no error is put on screen',
    (await page.evaluate(() => document.querySelectorAll('.fs-toast').length)) === 0,
    await page.evaluate(() => [...document.querySelectorAll('.fs-toast')].map((t) => t.textContent)));
  await browser.close();
}

/* ── a manifest that is not usable ───────────────────────────────────────── */
{
  console.log('\na manifest with a hostile url is refused outright');
  const { browser, page } = await withManifest({ version: '9.99', url: 'javascript:alert(1)' });
  await page.waitForTimeout(5200);
  /* The manifest is a file on the internet and its url ends up in an anchor the
     user is invited to click. Anything but https is not shown at all. */
  ok('no banner offering a javascript: link', (await banner(page)) === null, '');
  await browser.close();
}

/* ── the check the user ASKED for ────────────────────────────────────────── */
{
  console.log('\nHelp ▸ Check for Updates… always answers');
  const { browser, page } = await withManifest(null, { abort: true });
  /* Same broken network as the block above, where silence was correct. Here it
     is not: the difference between the two is the entire design. */
  await page.evaluate(async () => {
    [...document.querySelectorAll('.menu-item')].find((m) => m.textContent.trim() === 'Help')?.click();
    await new Promise((r) => setTimeout(r, 500));
  });
  const item = await page.evaluate(() => {
    const el = [...document.querySelectorAll('.menu-dropdown-item')]
      .find((x) => /Check for Updates/.test(x.textContent));
    if (!el) return null;
    el.click();
    return el.textContent.trim();
  });
  ok('the Help menu offers it', item !== null, JSON.stringify(item));
  await page.waitForTimeout(1500);
  const toasts = await page.evaluate(() =>
    [...document.querySelectorAll('.fs-toast')].map((t) => t.textContent.trim()));
  ok('…and a failed check SAYS so, unlike the silent one',
    toasts.some((t) => /update server|timed out/i.test(t)), JSON.stringify(toasts));
  await browser.close();
}

{
  console.log('\n…including when there is simply nothing new');
  const app = /APP_VERSION = '([^']+)'/.exec(
    readFileSync(new URL('../src/data/changelog.ts', import.meta.url), 'utf8'))[1];
  const { browser, page } = await withManifest({ version: app, url: 'https://example.com/dl' });
  await page.evaluate(async () => {
    [...document.querySelectorAll('.menu-item')].find((m) => m.textContent.trim() === 'Help')?.click();
    await new Promise((r) => setTimeout(r, 500));
    [...document.querySelectorAll('.menu-dropdown-item')]
      .find((x) => /Check for Updates/.test(x.textContent))?.click();
    await new Promise((r) => setTimeout(r, 1500));
  });
  const toasts = await page.evaluate(() =>
    [...document.querySelectorAll('.fs-toast')].map((t) => t.textContent.trim()));
  ok('"you are up to date" is an answer, and it is given',
    toasts.some((t) => /latest version/i.test(t)), JSON.stringify(toasts));
  await browser.close();
}

/* ── the source side: the version sync ───────────────────────────────────── */
console.log('\nthe app and the bundle ship the same number');
/* check-version-sync owns this in full; the one assertion repeated here is the
   one that made the feature necessary — an updater comparing a frozen 0.19.0
   against a frozen 0.19.0 would report "up to date" forever.
   v7.63: compared through toSemver, because the bundle version is three
   components ("7.63.0") and APP_VERSION is two ("7.63"). Matching them as raw
   strings is the mistake that shipped a config Tauri refused to parse. */
ok('tauri.conf.json carries the app\'s version, not the stale 0.19.0',
  readBundleVersion() === toSemver(readAppVersion())
  && readBundleVersion() !== '0.19.0',
  `${readAppVersion()} vs ${readBundleVersion()}`);

/* The manifest lives on a PUBLIC host. The source repo is private, and a
   private repo's assets need an authenticated request — which would mean
   shipping a GitHub token inside the app. */
const svc = readFileSync(new URL('../src/services/updateCheck.ts', import.meta.url), 'utf8');
/* Comments stripped before the credential sweep. The comment EXPLAINING why no
   token is shipped contains the word "token", so a naive regex fails against
   correct code — the third time this suite's author has walked into matching
   his own prose. */
const svcCode = svc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
ok('the manifest URL is public and https',
  /UPDATE_MANIFEST_URL =\s*\n?\s*'https:\/\/raw\.githubusercontent\.com\/[^']+'/.test(svc), '');
ok('…and no credential is shipped alongside it',
  !/Authorization|Bearer|ghp_|github_pat_/i.test(svcCode)
  && !/headers\s*:/i.test(svcCode), '');

console.log(`\ncheck-v762: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
