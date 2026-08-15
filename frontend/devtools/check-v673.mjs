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
    /* v7.15: the APP's api module, not a private second copy of it — see
       __scImport in driver.mjs. A bare import here patched a module nothing
       on screen was using, and the panel went on calling the real server. */
    const { api } = await window.__scImport('/src/services/api.ts');
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
    // currentScriptId arms Take Snapshot's save-first step — stub it too
    api.saveScript = async () => ({ message: 'saved' });
    api.getScriptAtVersion = async (_p, hash) => ({
      content: { type: 'doc', content: [{ type: 'action', content: [{ type: 'text', text: `Body of ${hash}` }] }] },
    });
    const ps = window.__scProjectStore.getState();
    ps.setCurrentProject({ id: 'proj-1', name: 'Episode X', properties: {} });
    ps.setCurrentScriptId('script-1');
    window.__scStore.getState().openTool('history');   // v6.74: the tool
  });
  await page.waitForSelector('.version-history-body .version-item', { timeout: 8000 });
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

  /* ── v6.74, Derek: "the compare feature will open in the main editor
     window" — the diff owns the EDITOR AREA, inside the chrome, never over
     it (his screenshot had its buttons on top of the ribbon). ── */
  await page.evaluate(() => {
    // exactly two snapshots to compare ("Fresh from the window" retires)
    window.__memVersions.length = 0;
    window.__memVersions.push(
      { hash: 'cmp-a', short_hash: 'cmpa', message: 'compare A', date: new Date().toISOString() },
      { hash: 'cmp-b', short_hash: 'cmpb', message: 'compare B', date: new Date().toISOString() },
    );
    window.__scProjectStore.getState().bumpVersionsTick?.();
    /* v6.80 — DEREK'S EXACT HOSTING (his screenshot): a dock row on the
       right, the tool open in FLOATING mode. On his Mac the summary showed
       nowhere; comparing must SEAT the tool into the docked panel. */
    const st = window.__scStore.getState();
    st.setTempTool(null);
    st.setToolConfig({ ...st.toolConfig, history: { side: 'right', enabled: true } });
    st.setToolMode('history', 'floating');
  });
  await settle(page);
  await page.evaluate(() => document.querySelector('[data-tool-row="history"]').click());
  await settle(page);
  await page.waitForFunction(() => document.querySelectorAll('.version-item').length === 2, { timeout: 5000 });

  /* v6.79, Derek: "make the items in the snapshot list take up less room.
     move the item buttons so all info is in one row" — name, age and every
     button share ONE line, and the row is genuinely slim. */
  const row = await page.evaluate(() => {
    const item = document.querySelector('.version-item');
    const mid = (el) => { const b = el.getBoundingClientRect(); return b.top + b.height / 2; };
    const parts = ['.version-message', '.version-date', '.version-view-btn', '.version-restore-btn', '.version-delete-btn']
      .map((sel) => { const el = item.querySelector(sel); if (!el) throw new Error(`missing ${sel}`); return mid(el); });
    return { h: item.getBoundingClientRect().height, spread: Math.max(...parts) - Math.min(...parts) };
  });
  ok(row.spread < 8, `name, age and all three buttons sit on ONE row (spread ${Math.round(row.spread)}px)`);
  ok(row.h <= 34, `and the row is slim (${Math.round(row.h)}px tall)`);

  /* v6.75, Derek: "items start not selectable, but when I click 'Compare'
     it allows me to pick two items from the list." v6.79: no checkboxes —
     "clicking anywhere on an item in the list should select it".
     v6.80: Compare… lives BESIDE Take Snapshot, and the explaining sentence
     only appears once it is clicked. */
  const restBoxes = await page.locator('.version-compare-checkbox').count();
  ok(restBoxes === 0, `there are no checkboxes, at rest or ever (${restBoxes})`);
  const atRest = await page.evaluate(() => {
    const take = document.querySelector('.version-history-actions .version-history-take');
    const cmp = document.querySelector('.version-history-actions .version-compare-btn:not(.version-history-take)');
    const midY = (el) => { const b = el.getBoundingClientRect(); return b.top + b.height / 2; };
    const bg = (el) => getComputedStyle(el).backgroundColor;
    return {
      together: !!take && !!cmp && Math.abs(midY(take) - midY(cmp)) < 6,
      sameStyle: !!take && !!cmp && bg(take) === bg(cmp) && bg(take) !== 'rgba(0, 0, 0, 0)',
      bar: !!document.querySelector('.version-compare-bar'),
    };
  });
  ok(atRest.together, 'Compare… sits beside + Take Snapshot, same row');
  ok(atRest.sameStyle, 'and both wear the SAME accent styling (v6.81)');
  ok(!atRest.bar, 'and the explaining sentence is hidden until it is clicked');
  await page.click('.version-history-actions .version-compare-btn:not(.version-history-take)');   // Compare… enters the mode
  await settle(page);
  const barText = await page.evaluate(() => document.querySelector('.version-compare-bar')?.textContent ?? '');
  ok(/Compare two snapshots side by side/.test(barText),
    `clicking Compare… shows the sentence ("${barText.slice(0, 52)}…")`);
  await page.locator('.version-item').nth(0).click();
  const picked = await page.evaluate(() => ({
    sel: document.querySelectorAll('.version-item.compare-selected').length,
    buttons: document.querySelectorAll('.version-item .version-delete-btn').length,
  }));
  ok(picked.sel === 1, `clicking a ROW picks it (${picked.sel} selected)`);
  ok(picked.buttons === 0, 'the row buttons stand down while picking — the row is the picker');
  await page.locator('.version-item').nth(0).click();  // click again = unpick
  ok(await page.evaluate(() => document.querySelectorAll('.version-item.compare-selected').length) === 0,
    'clicking it again unpicks it');
  await page.locator('.version-item').nth(0).click();
  await page.locator('.version-item').nth(1).click();
  // the second pick IS the go — no separate confirm click
  await page.waitForSelector('.fs-compare-takeover .script-diff-view', { timeout: 8000 });
  await settle(page);
  /* v6.80, Derek's screenshot: with the tool in FLOATING mode his Mac
     showed an expanded dock row and NO summary anywhere. Starting a
     compare must SEAT the tool into the docked panel — a definite-height
     inline body the summary cannot vanish from. */
  const seated = await page.evaluate(() => {
    const host = document.querySelector('.tool-inline[data-tool="history"] .version-summary-host');
    const b = host?.getBoundingClientRect();
    return {
      mode: window.__scStore.getState().toolMode['history'],
      inlineHost: !!host,
      w: b ? Math.round(b.width) : 0,
      h: b ? Math.round(b.height) : 0,
    };
  });
  ok(seated.mode === 'docked', `comparing seats the tool INTO the docked panel (mode ${seated.mode})`);
  ok(seated.inlineHost && seated.w > 100 && seated.h > 60,
    `and the summary lives in the panel's inline body, visibly sized (${seated.w}×${seated.h}px)`);
  const geo = await page.evaluate(() => {
    const take = document.querySelector('.fs-compare-takeover').getBoundingClientRect();
    const center = document.querySelector('.editor-center').getBoundingClientRect();
    const toolbar = document.querySelector('.toolbar')?.getBoundingClientRect();
    const btns = [...document.querySelectorAll('.script-diff-mode-btn')].map((b) => b.textContent);
    return {
      insideCenter: take.left >= center.left - 1 && take.right <= center.right + 1 && take.top >= center.top - 1,
      belowRibbon: !toolbar || take.top >= toolbar.bottom - 1,
      btns,
    };
  });
  ok(geo.insideCenter, 'the compare view renders INSIDE the editor area');
  ok(geo.belowRibbon, 'and below the ribbon — its buttons cannot collide with the app chrome');
  ok(geo.btns.join(',') === 'Side-by-side,Unified,Changes only',
    `the view controls are all present (${geo.btns.join(' / ')})`);
  const paneled = await page.evaluate(() => !!document.querySelector('.version-history-body'));
  ok(paneled, 'the Snapshots tool stays open beside it');
  /* v6.75: the SUMMARY rides the side panel while comparing — and the diff
     view no longer carries its own summary sidebar. */
  const sum = await page.evaluate(() => {
    const host = document.querySelector('.version-history-body .version-summary-host .script-diff-summary');
    const inDiff = document.querySelector('.fs-compare-takeover .script-diff-summary');
    const box = host?.getBoundingClientRect();
    return { inPanel: !!host, inDiff: !!inDiff, text: host?.textContent ?? '', w: box?.width ?? 0, h: box?.height ?? 0 };
  });
  ok(sum.inPanel, 'the compare summary appears in the Snapshots side panel');
  /* v6.79, Derek: "the compare summary is not appearing" — existence is not
     enough; the block must have real on-screen SIZE (a %-height collapse
     would leave it in the DOM at 0px, and this check would have lied). */
  ok(sum.w > 100 && sum.h > 60, `and it is genuinely VISIBLE (${Math.round(sum.w)}×${Math.round(sum.h)}px)`);
  ok(!sum.inDiff, 'and not as a second copy inside the diff view');
  /* v6.76, Derek: "when in the compare window, hide the snapshot list from
     the side panel window (only show the comparison summary)". */
  const during = await page.evaluate(() => ({
    rows: document.querySelectorAll('.version-history-body .version-item').length,
    bar: !!document.querySelector('.version-history-body .version-compare-bar'),
    take: !!document.querySelector('.version-history-body .version-history-take'),
  }));
  ok(during.rows === 0 && !during.bar && !during.take,
    `while comparing, the panel shows ONLY the summary (${during.rows} rows, bar ${during.bar}, take ${during.take})`);
  ok(/added/.test(sum.text) && /modified/.test(sum.text), `it carries the counts ("${sum.text.slice(0, 40)}…")`);
  /* v6.75: no internal hash codes anywhere the writer reads. */
  const hashes = await page.evaluate(() => document.querySelectorAll('.version-hash').length);
  ok(hashes === 0, `the snapshot rows show no internal hash codes (${hashes})`);
  const rowClickRed = await page.evaluate(() => !!document.querySelector('.version-diff-area pre, .version-diff-area .diff-viewer'));
  ok(!rowClickRed, 'and no raw JSON diff dump is mounted anywhere');
  await page.click('.script-diff-close');
  await settle(page);
  const back = await page.evaluate(() => ({
    takeover: !!document.querySelector('.fs-compare-takeover'),
    editor: !!document.querySelector('.ProseMirror'),
    rows: document.querySelectorAll('.version-history-body .version-item').length,
    take: !!document.querySelector('.version-history-body .version-history-take'),
  }));
  ok(!back.takeover && back.editor, 'closing the compare returns the editor');
  ok(back.rows === 2 && back.take, `and the snapshot list comes back in the panel (${back.rows} rows)`);

  /* ── v6.81, Derek's second screenshot: he entered the compare from the
     tool's FULLSCREEN takeover — the panel row sat expanded and EMPTY.
     Comparing must leave the takeover and seat the tool docked. ── */
  await page.evaluate(() => {
    const st = window.__scStore.getState();
    if (st.activeTool === 'history') st.setActiveTool(null);
    if (st.activeToolRight === 'history') st.setActiveToolRight(null);
    st.setTempTool(null);
    st.setToolMode('history', 'fullscreen');           // his remembered shape
    st.setFullscreenTool('history');                   // and currently fullscreen
  });
  await page.waitForSelector('.fs-tool-takeover .version-history-body', { timeout: 5000 });
  await page.click('.version-history-actions .version-compare-btn:not(.version-history-take)');
  await settle(page);
  await page.locator('.version-item').nth(0).click();
  await page.locator('.version-item').nth(1).click();
  await page.waitForSelector('.fs-compare-takeover .script-diff-view', { timeout: 8000 });
  await settle(page);
  const fsSeat = await page.evaluate(() => {
    const host = document.querySelector('.tool-inline[data-tool="history"] .version-summary-host');
    const b = host?.getBoundingClientRect();
    return {
      fullscreen: window.__scStore.getState().fullscreenTool,
      mode: window.__scStore.getState().toolMode['history'],
      w: b ? Math.round(b.width) : 0,
      h: b ? Math.round(b.height) : 0,
    };
  });
  ok(fsSeat.fullscreen === null, 'comparing from FULLSCREEN leaves the takeover');
  ok(fsSeat.mode === 'docked' && fsSeat.w > 100 && fsSeat.h > 60,
    `and the summary seats into the docked panel there too (${fsSeat.w}×${fsSeat.h}px)`);
  await page.click('.script-diff-close');
  await settle(page);

  /* ── v6.80, Derek: "automatically create a snapshot when the draft
     number is changed. label it as the previous draft name." Driven
     through the real Project ▸ Set Draft Number… dialog. ── */
  await page.evaluate(() => {
    window.__checkinCalls.length = 0;
    window.__scStore.getState().setDraftLabel('1st Draft');
  });
  const openMenu = async (name) => {
    for (let i = 0; i < 3; i++) {
      await page.click(`.menu-item:has-text("${name}")`);
      await settle(page);
      if (await page.evaluate(() => !!document.querySelector('.menu-dropdown'))) return;
    }
    throw new Error(`could not open the ${name} menu`);
  };
  const setDraftTo = async (label) => {
    await openMenu('Project');
    await page.click('.menu-dropdown :text("Set Draft Number")');
    await page.waitForSelector('#draft-input', { timeout: 5000 });
    await page.fill('#draft-input', label);
    await page.click('.dialog-actions .dialog-btn-primary');   // v7.01: was .dialog-primary
    await settle(page);
  };
  await setDraftTo('2nd Draft');
  await page.waitForFunction(() => window.__checkinCalls.length === 1, { timeout: 5000 });
  const draftCalls = await page.evaluate(() => window.__checkinCalls);
  ok(draftCalls[0] === '1st Draft',
    `changing the draft files a snapshot named after the OLD draft ("${draftCalls[0]}")`);
  ok(await page.evaluate(() => window.__scStore.getState().draftLabel) === '2nd Draft',
    'and the draft label itself changes');
  await page.waitForFunction(() => [...document.querySelectorAll('.version-message')]
    .some((m) => m.textContent === '1st Draft'), { timeout: 5000 }).catch(() => {});
  ok(await page.evaluate(() => [...document.querySelectorAll('.version-message')]
    .some((m) => m.textContent === '1st Draft')),
    'the "1st Draft" snapshot appears in the open window right away');
  await setDraftTo('2nd Draft');                       // unchanged label
  await new Promise((r) => setTimeout(r, 600));
  ok((await page.evaluate(() => window.__checkinCalls)).length === 1,
    're-applying the SAME draft name takes no snapshot');

} catch (e) {
  console.log('PROBE ERROR:', e.message);
  fail++;
} finally { await browser.close(); }
console.log(`\ncheck-v673: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
