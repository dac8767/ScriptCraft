// check-v709.mjs — Derek: "i exported a title page as a pdf and it did not
// export all of the information." The title page is a LINE GRID; the exporter
// added 4pt after every block (blanks included), drifting the bottom block off
// the page, where a fit guard dropped it silently.
//
// This runs the REAL export and reads the produced PDF back. jsPDF embeds
// Courier Prime, so the strings in the content stream are hex glyph ids — the
// check decodes them through the font's own /ToUnicode CMap, which is exactly
// what a PDF reader does, so what is asserted is what a reader would show.
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { launch, boot, settle } from './driver.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};

const { browser, page } = await launch();
await boot(page);

const TITLE_DATA = {
  tpTitle: 'SCRIPTCRAFT',
  tpTitle2: '"The best screenwriting app in the world ... for free."',
  tpTitle2FontSize: 12,
  tpWrittenBy: 'You',
  tpBasedOn: '',
  tpDraft: '1st Draft',
  tpDraftDate: '',
  tpContact: 'Name\nAgency\nemail@example.com',
  tpCopyright: 'Copyright 2026 Author Name',
  tpWgaRegistration: 'WGAw #123456',
  tpNotes: 'No code? Join our newsletter for updates about a public release.',
  tpTitleFontSize: 32,
};

await page.evaluate(async (data) => {
  const tp = await import('/src/utils/titlePageLayout.ts');
  window.__scEditor.commands.setContent({
    type: 'doc',
    content: [
      ...tp.titlePageJsonNodes(data),
      { type: 'sceneHeading', content: [{ type: 'text', text: 'INT. ROOM - DAY' }] },
      { type: 'action', content: [{ type: 'text', text: 'Rain falls on the window.' }] },
    ],
  });
}, TITLE_DATA);
await settle(page);

// Run the real exporter and take the file it saves.
const dl = page.waitForEvent('download', { timeout: 30000 });
await page.evaluate(async () => {
  const m = await import('/src/utils/pdfExporter.ts');
  await m.exportPDF(window.__scEditor.getJSON(), 'TitlePageTest', window.__scStore.getState().pageLayout, {});
});
const download = await dl;
const pdfPath = await download.path();
const bytes = readFileSync(pdfPath);
await browser.close();

// ── read the PDF back ────────────────────────────────────────────────
const latin = bytes.toString('latin1');

/** /ToUnicode CMap → { glyphHex: character }, so the hex strings decode. */
function buildCmap(src) {
  const map = new Map();
  for (const m of src.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const p of m[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
      map.set(p[1].toLowerCase(), String.fromCharCode(parseInt(p[2].slice(0, 4), 16)));
    }
  }
  for (const m of src.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const p of m[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
      const lo = parseInt(p[1], 16), hi = parseInt(p[2], 16), dst = parseInt(p[3].slice(0, 4), 16);
      for (let g = lo; g <= hi && g - lo < 65536; g++) {
        map.set(g.toString(16).padStart(p[1].length, '0'), String.fromCharCode(dst + (g - lo)));
      }
    }
  }
  return map;
}

/** Every stream in the file, inflated when it is Flate-encoded. */
function streams(buf, str) {
  const out = [];
  const re = /stream\r?\n/g;
  let m;
  while ((m = re.exec(str))) {
    const start = m.index + m[0].length;
    const end = str.indexOf('endstream', start);
    if (end < 0) continue;
    const raw = buf.subarray(start, end);
    const head = str.slice(Math.max(0, m.index - 300), m.index);
    if (/FlateDecode/.test(head)) {
      try { out.push(inflateSync(raw).toString('latin1')); } catch { /* not inflatable */ }
    } else {
      out.push(raw.toString('latin1'));
    }
  }
  return out;
}

const all = streams(bytes, latin);
const cmap = buildCmap(all.join('\n') + latin);
// Content streams are the ones carrying text operators.
const contents = all.filter((s) => /\bTj\b|\bTJ\b/.test(s));
const decodeStream = (s) => {
  const parts = [];
  for (const m of s.matchAll(/<([0-9a-fA-F]+)>\s*Tj/g)) {
    const hex = m[1];
    let word = '';
    for (let i = 0; i + 4 <= hex.length; i += 4) word += cmap.get(hex.slice(i, i + 4).toLowerCase()) ?? '�';
    parts.push(word);
  }
  for (const m of s.matchAll(/\(((?:\\.|[^()\\])*)\)\s*Tj/g)) parts.push(m[1]);
  return parts;
};

const pagesText = contents.map(decodeStream);
console.log(`\nPDF: ${contents.length} content stream(s), cmap ${cmap.size} glyphs`);
const p1 = pagesText[0] || [];
console.log('page 1 text runs:');
for (const t of p1) console.log(`   ${JSON.stringify(t)}`);

const p1Joined = p1.join('\n');
ok('the PDF has a title page and a script page', pagesText.length >= 2, `pages=${pagesText.length}`);
ok('page 1 decoded to real text', /SCRIPTCRAFT/i.test(p1Joined), p1Joined.slice(0, 120));
ok('title is exported', p1Joined.includes('SCRIPTCRAFT'), '');
ok('subtitle is exported', /best screenwriting app/.test(p1Joined), '');
ok('credit line is exported', /Written by You/.test(p1Joined), '');
ok('draft is exported', /1st Draft/.test(p1Joined), 'THE BUG: the bottom block fell off the page');
ok('contact is exported', /email@example\.com/.test(p1Joined), 'THE BUG');
ok('copyright is exported', /Copyright 2026/.test(p1Joined), 'THE BUG');
ok('WGA registration is exported', /WGAw #123456/.test(p1Joined), 'THE BUG');
ok('notes are exported', /newsletter/.test(p1Joined), 'THE BUG');
ok('the script is on page 2, not the title page', !/INT\. ROOM/.test(p1Joined)
  && pagesText.slice(1).join('\n').includes('INT. ROOM'), '');

console.log(`\ncheck-v709: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
