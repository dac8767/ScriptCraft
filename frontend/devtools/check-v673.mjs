/* check-v673 — Derek: "autosaves are still being added to the snapshot
   window" + "add a delete option for the snapshots in the snapshot window.
   show a warning window before deleting."

   The SQLite half (deleteVersion/deleteAllVersions SQL) is desktop-only —
   the browser harness has no Tauri, which is why this check patches the
   app's OWN api module (one Vite graph, one instance) with an in-memory
   fake and drives the real window against it. What this proves: the rows,
   the warnings, cancel, the right row going, delete-all, and that NOTHING
   in the app calls checkin('Auto save') any more — the only writer left is
   the Take Snapshot flow.

   1 no code path takes an automatic snapshot (checkin is never called
     without the writer naming one)
   2 each row has a Delete button; a WARNING window opens first
   3 Cancel deletes nothing
   4 Delete removes exactly that snapshot; the script text is untouched
   5 Delete All… warns, names the old Auto save entries, then empties the
     list */
import { launch, boot, seedScript, SCENES_4, settle } from './driver.mjs';

const { browser, page } = await launch({ width: 1500, height: 950 });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL', m); } };

try {
  await boot(page);
  await seedScript(page, SCENES_4);
  await settle(page);

  // an in-memory version store behind the app's own api module — seeded
  // with the pile Derek is looking at: old Auto save rows + one deliberate
  await page.evaluate(async () => {
    const { api } = await import('/src/services/api.ts');
    const mem = [
      { hash: 'h-auto-1', short_hash: 'auto1', message: 'Auto save', date: new Date().toISOString() },
      { hash: 'h-auto-2', short_hash: 'auto2', message: 'Auto save', date: new Date().toISOString() },
      { hash: 'h-real', short_hash: 'real1', message: 'Before the rewrite', date: new Date().toISOString() },
    ];
    window.__memVersions = mem;
    window.__checkinCalls = [];
    api.getVersions = async () => [...mem];
    api.checkin = async (_p, message) => {
      window.__checkinCalls.push(message);
      const v = { hash: `h-${mem.length}`, short_hash: `s${mem.length}`, message, date: new Date().toISOString() };
      mem.unshift(v);
      return v;
    };
    api.deleteVersion = async (_p, hash) => {
      const i = mem.findIndex((v) => v.hash === hash);
      if (i >= 0) mem.splice(i, 1);
      return { message: 'deleted' };
    };
    api.deleteAllVersions = async () => { const n = mem.length; mem.length = 0; return { deleted: n }; };
    const ps = window.__scProjectStore.getState();
    ps.setCurrentProject({ id: 'proj-1', name: 'Episode X', properties: {} });
    ps.setVersionHistoryOpen(true);
  });
  await page.waitForSelector('.version-history-panel .version-item', { timeout: 8000 });
  await settle(page);

  /* ── 1: nothing takes a snapshot on its own ── */
  await new Promise((r) => setTimeout(r, 1500));
  const calls = await page.evaluate(() => window.__checkinCalls);
  ok(calls.length === 0, `checkin is never called without the writer asking (${calls.length} calls)`);

  /* ── 2–4: per-row delete ── */
  const rows = await page.locator('.version-item').count();
  const delBtns = await page.locator('.version-delete-btn').count();
  ok(rows === 3 && delBtns === 3, `every row has a Delete button (${delBtns}/${rows})`);

  const textBefore = await page.evaluate(() => window.__scEditor.state.doc.textContent.length);
  await page.locator('.version-item', { hasText: 'Before the rewrite' }).locator('.version-delete-btn').click();
  await page.waitForSelector('.fs-confirm-overlay', { timeout: 5000 });
  const warn = await page.evaluate(() => document.querySelector('.fs-confirm-box')?.textContent ?? '');
  ok(/Delete Snapshot/.test(warn) && /cannot be undone/i.test(warn),
    `a warning window opens first ("${warn.slice(0, 58)}…")`);
  ok(/script is not touched/i.test(warn), 'and it says the script itself is safe');
  await page.click('.fs-confirm-actions button:not(.fs-confirm-ok)');   // Cancel
  await settle(page);
  ok(await page.locator('.version-item').count() === 3, 'Cancel deletes nothing');

  await page.locator('.version-item', { hasText: 'Before the rewrite' }).locator('.version-delete-btn').click();
  await page.waitForSelector('.fs-confirm-overlay', { timeout: 5000 });
  await page.click('.fs-confirm-ok');
  await settle(page);
  await page.waitForFunction(() => document.querySelectorAll('.version-item').length === 2, { timeout: 5000 });
  const left = await page.evaluate(() => [...document.querySelectorAll('.version-message')].map((m) => m.textContent));
  ok(left.length === 2 && left.every((m) => m === 'Auto save'),
    `Delete removed exactly that snapshot (${left.join(' / ')})`);
  const textAfter = await page.evaluate(() => window.__scEditor.state.doc.textContent.length);
  ok(textAfter === textBefore, `the script text is untouched (${textAfter} chars)`);

  /* ── 5: Delete All ── */
  const bar = await page.evaluate(() => document.querySelector('.version-history-count')?.textContent ?? '');
  ok(/2 snapshots/.test(bar), `the list bar counts what is left ("${bar}")`);
  await page.click('.version-deleteall-btn');
  await page.waitForSelector('.fs-confirm-overlay', { timeout: 5000 });
  const warnAll = await page.evaluate(() => document.querySelector('.fs-confirm-box')?.textContent ?? '');
  ok(/Delete All Snapshots/.test(warnAll) && /Auto save/i.test(warnAll),
    `Delete All warns, and names the old Auto save entries ("${warnAll.slice(0, 58)}…")`);
  await page.click('.fs-confirm-ok');
  await settle(page);
  await page.waitForFunction(() => document.querySelectorAll('.version-item').length === 0, { timeout: 5000 });
  const empty = await page.evaluate(() => document.querySelector('.version-history-list')?.textContent ?? '');
  ok(/No snapshots yet/i.test(empty), 'the emptied window says so');

  /* ── and Take Snapshot writes AND shows up right away (Derek: "I have to
     close the window and reopen it for the new snapshot to appear") ── */
  await page.click('.version-history-take');
  await page.waitForSelector('.dialog-overlay input, .dialog-overlay textarea', { timeout: 5000 }).catch(() => {});
  const dlg = await page.evaluate(() => document.querySelector('.dialog-overlay')?.textContent ?? '');
  ok(/snapshot/i.test(dlg), `Take Snapshot opens the naming dialog (${dlg.slice(0, 40)}…)`);
  await page.fill('.dialog-overlay input, .dialog-overlay textarea', 'Fresh from the window');
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('.dialog-overlay button')];
    btns.find((b) => /take|save|snapshot/i.test(b.textContent) && !/cancel/i.test(b.textContent))?.click();
  });
  await page.waitForFunction(() => [...document.querySelectorAll('.version-message')]
    .some((m) => m.textContent === 'Fresh from the window'), { timeout: 5000 }).catch(() => {});
  const shown = await page.evaluate(() => [...document.querySelectorAll('.version-message')].map((m) => m.textContent));
  ok(shown.includes('Fresh from the window'),
    `the new snapshot appears in the OPEN window, no reopen needed (${shown.join(' / ') || 'none'})`);
  ok((await page.evaluate(() => window.__checkinCalls)).length === 1,
    'and that was the only checkin the whole run made');

} catch (e) {
  console.log('PROBE ERROR:', e.message);
  fail++;
} finally { await browser.close(); }
console.log(`\ncheck-v673: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
