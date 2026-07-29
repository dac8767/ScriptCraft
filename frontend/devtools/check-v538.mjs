// devtools/check-v538.mjs — Scenes cards: a name that would truncate pushes
// the page/time metrics to a SECOND row; a name that fits keeps them beside
// it on one row.
import { launch, boot, seedScript, openTool, fullscreen, SCENES_4 } from './driver.mjs';
const SHOTS = '/tmp/claude-0/-home-user-ScriptCraft/e4449e3e-5198-5997-9e57-bd93d663743c/scratchpad';
let pass = 0, fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FAIL: ${label}`); }
};
const { browser, page } = await launch();
await boot(page);
await seedScript(page, [
  { heading: 'INT. LAB - DAY', lines: 4 },
  { heading: 'INT. THE EXTREMELY LONG CORRIDOR OF THE ABANDONED RESEARCH STATION ON THE OUTER RIM BEYOND THE LAST CHARTED SYSTEM - NIGHT', lines: 6 },
  ...SCENES_4.slice(2),
]);

await openTool(page, 'Scenes');
await fullscreen(page);
await page.evaluate(() => window.__scStore.setState({ scenesViewMode: 'cards' }));
await page.waitForSelector('.index-card', { timeout: 10000 });
await page.waitForTimeout(300);

const rows = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('.index-card')];
  const probe = (card) => {
    const head = card.querySelector('.index-card-heading')?.getBoundingClientRect();
    const meta = card.querySelector('.index-card-meta')?.getBoundingClientRect();
    const expand = card.querySelector('.ic-synopsis-expand')?.getBoundingClientRect();
    return head && meta ? {
      headTop: Math.round(head.top),
      metaTop: Math.round(meta.top),
      expandTop: expand ? Math.round(expand.top) : null,
      headText: card.querySelector('.index-card-heading')?.textContent ?? '',
    } : null;
  };
  return { short: probe(cards[0]), long: probe(cards[1]) };
});
ok(!!rows.short && !!rows.long, 'both probe cards render');
ok(Math.abs(rows.short.metaTop - rows.short.headTop) <= 4,
  `SHORT name: metrics share its row (Δtop ${rows.short.metaTop - rows.short.headTop}px)`);
ok(rows.long.metaTop > rows.long.headTop + 8,
  `LONG name: metrics dropped to a second row (Δtop ${rows.long.metaTop - rows.long.headTop}px)`);
ok(rows.long.expandTop !== null && Math.abs(rows.long.expandTop - rows.long.metaTop) <= 4,
  'the expand button rides the metrics row');
const longHeadH = await page.evaluate(() => Math.round(
  document.querySelectorAll('.index-card')[1].querySelector('.index-card-heading').getBoundingClientRect().height));
ok(longHeadH > 24, `and the long name spends the freed width on a second text line (${longHeadH}px tall)`);
await page.screenshot({ path: `${SHOTS}/v538-scenes-wrap.png` });

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
