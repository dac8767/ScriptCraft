/* check-helper-catalog (v6.20) — the committed helperTextCatalog.json must
   match a fresh scan of src/. When this fails, someone added/renamed helper
   text without regenerating:   node devtools/build-helper-catalog.mjs
   (Same single-source guard shape as the designTokens test: the CODE is the
   source; the generated file must track it.) */
import { readFileSync } from 'fs';
import { buildCatalog, catalogToJson, CATALOG_PATH } from './build-helper-catalog.mjs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL', m); } };

const fresh = buildCatalog();
let committed = null;
try { committed = readFileSync(CATALOG_PATH, 'utf8'); } catch { /* missing */ }

ok(committed !== null, 'src/data/helperTextCatalog.json exists');
ok(fresh.length > 300, `the scan finds a real catalog (${fresh.length} strings)`);
if (committed !== null) {
  const same = committed === catalogToJson(fresh);
  ok(same, same
    ? 'the committed catalog matches the code'
    : 'catalog DRIFTED — run: node devtools/build-helper-catalog.mjs');
}
// A few strings that must exist as long as their features do — canaries that
// the scan regexes still bite.
for (const [text, why] of [
  ['Action...', 'the element hint map routes through ht()'],
  ['Fullscreen', 'tool window chrome tooltips are cataloged'],
]) {
  ok(fresh.some((e) => e.text === text), `catalog carries “${text}” (${why})`);
}

console.log(`\ncheck-helper-catalog: ${pass} passed, ${fail} failed`);
