/* check-v669 — Derek: "clicking on 'Snapshots' shows a window that is forever
   stuck on 'Loading snapshots...'".

   Root cause: services/api.ts had NO empty-base guard, while cloudApi.ts —
   the other client against the same server — has had one all along. The
   desktop app configures no HTTP base at all (config.ts: "on Tauri the HTTP
   backend is NOT used"), so every Snapshots load fired at a relative URL
   through the Tauri invoke bridge and waited on a request that could never
   arrive.

   1 the menu path opens the Snapshots window
   2 with a script open it does NOT sit on "Loading snapshots..."
   3 it says something the writer can act on
   4 the failure offers a way to try again
   5 the wait is bounded — the spinner is gone well inside the budget
   6 with no script open it still says so plainly, and never spins */
import { launch, boot, seedScript, SCENES_4, settle } from './driver.mjs';

const { browser, page } = await launch({ width: 1400, height: 900 });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL', m); } };

const look = () => page.evaluate(() => {
  // v6.74: Snapshots is a side-panel TOOL — the body class is the marker
  const box = document.querySelector('.version-history-body');
  return {
    open: !!box,
    loading: !!document.querySelector('.version-history-loading'),
    empty: document.querySelector('.version-history-empty')?.textContent?.trim() ?? null,
    error: document.querySelector('.version-history-error')?.textContent?.trim() ?? null,
    retry: !!document.querySelector('.version-history-retry'),
  };
});
async function openMenu(name) {
  for (let i = 0; i < 3; i++) {
    await page.click(`.menu-item:has-text("${name}")`);
    await settle(page);
    if (await page.evaluate(() => !!document.querySelector('.menu-dropdown'))) return;
  }
  throw new Error(`could not open the ${name} menu`);
}

try {
  await boot(page);
  await seedScript(page, SCENES_4);

  /* ── 6 first: no script open ── */
  await openMenu('File');
  await page.click('.menu-dropdown :text("Script History")');
  await settle(page);
  await page.click('.menu-dropdown :text-is("Snapshots")');
  await settle(page);
  let s = await look();
  ok(s.open, 'File ▸ Script History ▸ Snapshots opens the TOOL in the side panel');
  const asTool = await page.evaluate(() => {
    const w = document.querySelector('.version-history-body')?.closest('.tool-window, .tool-inline-body, .fs-tool-takeover, [data-tool]');
    return !!w;
  });
  ok(asTool, 'and it is hosted by the standard tool chrome, not a bespoke sidebar');
  ok(!s.loading && !!s.empty, `with nothing open it says so instead of spinning ("${s.empty}")`);
  await page.evaluate(() => window.__scStore.getState().closeTool?.('history'));
  await settle(page);

  /* ── 1–5: Derek's state — a script IS open ── */
  const t0 = Date.now();
  await page.evaluate(() => {
    const ps = window.__scProjectStore.getState();
    ps.setCurrentProject({ id: 'proj-1', name: 'Episode X', properties: {} });
    ps.setCurrentScriptId('script-1');
    window.__scStore.getState().openTool('history');
  });
  await settle(page);
  s = await look();
  ok(s.open, 'it opens with a script loaded too');
  ok(!s.loading, `and does NOT sit on "Loading snapshots..." (loading ${s.loading})`);
  const said = s.error || s.empty;
  ok(!!said && said.length > 10, `it says something the writer can act on ("${(said || '').slice(0, 70)}")`);
  if (s.error) ok(s.retry, 'and offers a way to try again');
  else ok(true, 'no error to retry — the load answered');

  // the spinner must be gone well inside the budget, however the transport behaves
  const settled = Date.now() - t0;
  ok(settled < 12_000, `the wait is bounded (${settled}ms, budget 12000ms)`);

  // and it stays settled — no loop that re-arms the spinner
  await new Promise((r) => setTimeout(r, 2500));
  const later = await look();
  ok(!later.loading, 'still not spinning two seconds later — nothing re-arms it');

} catch (e) {
  console.log('PROBE ERROR:', e.message);
  fail++;
} finally { await browser.close(); }
console.log(`\ncheck-v669: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
