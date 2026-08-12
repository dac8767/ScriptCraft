/* check-v672 — Derek's snapshot/auto-save batch:
   1 "add a Take Snapshot button to the upper left of this snapshot window"
   2 "remove the first option 'Local version history (always on)' — this was
     adding autosaves to the snapshot window, which we do not want"
   3 the auto-save hint says what an auto save actually is
   4 "remove all helper text from AUTO SAVE LOCATIONS"
   5 "this has two choose folder buttons. change the text to 'Local device
     folder'"
   The substance behind 2: the auto-save timer no longer takes a version
   check-in, so an auto save can never appear among the snapshots. */
import { launch, boot, seedScript, SCENES_4, settle } from './driver.mjs';

const { browser, page } = await launch({ width: 1500, height: 950 });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL', m); } };

try {
  await boot(page);
  await seedScript(page, SCENES_4);

  /* ── 1: the Take Snapshot button (v6.76, Derek: "move the 'Take
     Snapshot' button out of the window title section and down into the
     script history window" — it lives in the tool BODY now) ── */
  await page.evaluate(() => window.__scStore.getState().openTool('history'));
  await page.waitForSelector('.version-history-body', { timeout: 8000 });
  const btn = await page.evaluate(() => {
    const b = document.querySelector('.version-history-body .version-history-actions .version-history-take');
    const inChrome = document.querySelector('.tool-window-header .version-history-take, .tool-inline-header .version-history-take');
    return { inBody: !!b, text: b?.textContent.trim() ?? '', inChrome: !!inChrome };
  });
  ok(btn.inBody && /Take Snapshot/i.test(btn.text), `the Take Snapshot button is IN the window body ("${btn.text}")`);
  ok(!btn.inChrome, 'and no longer in the window title chrome');
  await page.evaluate(() => window.__scStore.getState().closeTool('history'));

  /* ── 2–5: the Save & Locations settings ── */
  await page.evaluate(() => window.__scStore.getState().openPreferences('saveloc'));
  await page.waitForSelector('#prefs-save-locations', { timeout: 8000 });
  await settle(page);
  const sections = await page.evaluate(() => {
    const hs = [...document.querySelectorAll('.prefs-general section')];
    const auto = hs.find((s) => s.querySelector('h3')?.textContent === 'Auto Save Locations');
    if (!auto) return null;
    return {
      rows: [...auto.querySelectorAll('.prefs-check-row span')].map((s) => s.textContent.trim()),
      hints: [...auto.querySelectorAll('.prefs-hint')].map((h) => h.textContent.trim()),
      chooseBtns: auto.querySelectorAll('.prefs-inline-btn').length,
      body: document.body.innerText,
    };
  });
  ok(!!sections, 'the Auto Save Locations section is on the Save & Locations tab');
  ok(!sections.rows.some((r) => /version history/i.test(r)),
    `"Local version history (always on)" is gone (${sections.rows.length} rows: ${sections.rows.map((r) => r.split('\n')[0]).join(' | ')})`);
  ok(sections.hints.length === 0, `no helper text left in the section (${sections.hints.length} paragraphs)`);
  const local = sections.rows.find((r) => /Local device folder/.test(r));
  ok(!!local, `the folder row reads "Local device folder" (${local ?? 'not found'})`);
  ok(local && !/choose a folder/i.test(local),
    'and says it once — the row text no longer duplicates the Choose Folder… button');

  /* ── 3: the auto-save hint ── */
  const hint = await page.evaluate(() => {
    const ps = [...document.querySelectorAll('.prefs-general .prefs-hint')];
    return ps.map((p) => p.textContent.replace(/\s+/g, ' ').trim()).find((t) => /auto save/i.test(t)) ?? '';
  });
  ok(/spare copy/i.test(hint) && /not snapshots/i.test(hint),
    `the auto-save text says what it is, and that it is not a snapshot ("${hint.slice(0, 80)}…")`);
  ok(!/squash|baseline|checkpoint|Maximum Project Versions/i.test(hint),
    'and no longer describes version checkpoints or squashing');
  const keepField = await page.locator('#prefs-autosnap-keep').count();
  ok(keepField === 0, `the "Maximum Project Versions" field is gone with the behaviour it counted (${keepField})`);

  /* ── the substance: an auto save can no longer become a snapshot ── */
  const src = await page.evaluate(async () => {
    const r = await fetch('/src/components/ScreenplayEditor.tsx');
    return r.ok ? await r.text() : '';
  });
  if (src) {
    const at = src.indexOf('Preferences: AUTO SAVE');
    // strip comments first — the block's own comment NAMES the calls it
    // retired, and matching that reported a failure the code didn't have
    // the slice STARTS inside the block comment, so drop everything up to
    // its close first — otherwise the comment (which names the retired
    // calls) has no opening /* for the stripper to match
    const raw = src.slice(at, at + 1800);
    const timer = raw.slice(raw.indexOf('*/') + 2)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    ok(!/api\.checkin/.test(timer), 'the auto-save timer no longer takes a version check-in');
    ok(!/pruneVersions/.test(timer), 'and no longer prunes the shared history');
    ok(/mirrorSnapshot/.test(timer), 'it writes the timestamped file copies instead');
  } else {
    ok(false, 'could not read the editor source to confirm the timer');
  }

} catch (e) {
  console.log('PROBE ERROR:', e.message);
  fail++;
} finally { await browser.close(); }
console.log(`\ncheck-v672: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
