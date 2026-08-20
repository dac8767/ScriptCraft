/* check-v767 — Odia spell-check actually loads.
 *
 * It had not been loading at all. languageCatalog.ts fetched it from
 * `https://cdn.jsdelivr.net/gh/dac8767/ScriptCraft@main/dictionaries-extra`,
 * and jsDelivr's `/gh/` endpoint serves PUBLIC repositories only — this one is
 * private. So the download 404'd every time and the language quietly did
 * nothing, which is this app's cardinal sin arriving as a network error: a
 * failed download is indistinguishable from a language nobody picked.
 *
 * WHY IT WAS NEVER CAUGHT: no sandbox that touched that line could reach
 * jsDelivr, so every previous verification checked the URL's SHAPE against the
 * repo's tree instead of fetching it. A shape can be right while the thing at
 * the end of it does not exist. This file fetches.
 *
 * The dictionary ships with the app now, the same way en_US already did, so
 * there is nothing left to be unreachable.
 */
import { readFileSync, existsSync } from 'node:fs';
import { launch, boot, settle } from './driver.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};

const root = (p) => new URL(`../../${p}`, import.meta.url);
const pub = (p) => new URL(`../public/${p}`, import.meta.url);

console.log('\nthe dictionary ships with the app');
ok('the shipped copy exists', existsSync(pub('dictionaries-extra/or_IN/or_IN.dic')), '');
ok('…with its affix file', existsSync(pub('dictionaries-extra/or_IN/or_IN.aff')), '');
/* MPL-2.0 requires the notice travel with the files. It is the reason the
   folder has a NOTICE.md at all. */
ok('…and its MPL-2.0 notice', existsSync(pub('dictionaries-extra/or_IN/NOTICE.md')), '');

/* The repo-root folder stays the source of record. Two copies of a 7.6 MB word
   list is exactly the kind of pair that drifts, so they are compared. */
const same = (a, b) => readFileSync(a).equals(readFileSync(b));
ok('the shipped copy matches the source of record byte for byte',
  same(root('dictionaries-extra/or_IN/or_IN.dic'), pub('dictionaries-extra/or_IN/or_IN.dic'))
  && same(root('dictionaries-extra/or_IN/or_IN.aff'), pub('dictionaries-extra/or_IN/or_IN.aff')), '');

console.log('\nand nothing reaches for a CDN to get it');
const cat = readFileSync(new URL('../src/editor/languageCatalog.ts', import.meta.url), 'utf8');
const base = /const OPENDRAFT_EXTRA_BASE = '([^']+)'/.exec(cat)?.[1];
ok('the base is a path inside the app', base === '/dictionaries-extra', JSON.stringify(base));
/* Named, because "put jsDelivr back" is the natural-looking edit — the URL
   reads as more correct than a bare path right up until you fetch it. */
ok('…not jsDelivr, which cannot serve a private repo',
  !/cdn\.jsdelivr\.net\/gh\//.test(cat), '');

console.log('\nthe app can actually fetch it');
const { browser, page } = await launch({ width: 1200, height: 800 });
await boot(page);
await settle(page);

const fetched = await page.evaluate(async () => {
  const get = async (u) => {
    try {
      const r = await fetch(u);
      if (!r.ok) return { ok: false, status: r.status, lines: 0 };
      const t = await r.text();
      /* LINES, not length. The first attempt compared `.text().length` against
         a byte figure and failed a healthy file: this list is 7.8 MB of UTF-8
         but only 2.8 M JS characters, because every Odia codepoint is three
         bytes and one UTF-16 unit. */
      return { ok: true, status: r.status, lines: t.split('\n').filter(Boolean).length };
    } catch (e) { return { ok: false, status: 0, lines: 0, err: String(e) }; }
  };
  return {
    aff: await get('/dictionaries-extra/or_IN/or_IN.aff'),
    dic: await get('/dictionaries-extra/or_IN/or_IN.dic'),
  };
});
ok('the affix file is served', fetched.aff.ok, JSON.stringify(fetched.aff));
ok('the word list is served', fetched.dic.ok, JSON.stringify(fetched.dic));
/* The whole list, not a truncated read and not an HTML error page served with
   a 200 — a dev server that answers index.html for a missing path would sail
   through an `ok` check. NOTICE.md records 321,831 words; the count is the
   thing that proves this is the real dictionary. */
ok('…and it is the whole ~321k-word list, not an error page',
  fetched.dic.lines > 300_000, `${fetched.dic.lines} lines`);

console.log('\nand the language reaches the spell-checker');
const loaded = await page.evaluate(async () => {
  const mod = await import('/src/editor/languageCatalog.ts');
  const lang = mod.findLanguage('or_IN');
  if (!lang) return { found: false };
  const urls = mod.urlsFor(lang);
  const r = await fetch(urls.dic);
  return { found: true, urls, served: r.ok, status: r.status };
});
ok('or_IN is in the catalog', loaded.found === true, JSON.stringify(loaded));
/* THE assertion the old verification could not make: follow the URLs the app
   itself would use, and fetch them. */
ok('…and the URLs it hands the downloader resolve',
  loaded.served === true, JSON.stringify(loaded));

await browser.close();
console.log(`\ncheck-v767: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
