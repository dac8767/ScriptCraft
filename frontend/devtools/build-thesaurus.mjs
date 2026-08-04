/**
 * build-thesaurus.mjs — generates public/thesaurus/wn_en_31.dat from the
 * Princeton WordNet 3.1 dict files (v6.03, Derek: the thesaurus should show
 * definitions — MyThes th_en_US_v2 had none, so the data source moved to
 * WordNet proper, which carries a gloss per sense).
 *
 * One-time generator; the produced .dat is COMMITTED (same precedent as the
 * old MyThes file). To regenerate:
 *   1. curl -sL https://registry.npmjs.org/wordnet-db/-/wordnet-db-3.1.14.tgz | tar xz
 *   2. node devtools/build-thesaurus.mjs package/dict
 *
 * Output format — MyThes-shaped with a GLOSS as the first sense field:
 *   line 1        UTF-8
 *   head line     lemma|senseCount            (lemma lowercase, spaces ok)
 *   sense line    (pos)|gloss|syn|syn|ant (antonym)
 * utils/thesaurus.ts reads field[1] as the definition; the qualifier
 * suffix "(antonym)" survives from the MyThes grammar.
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const dictDir = process.argv[2];
if (!dictDir) { console.error('usage: node build-thesaurus.mjs <wordnet dict dir>'); process.exit(1); }

const POS_FILES = [['n', 'noun'], ['v', 'verb'], ['a', 'adj'], ['r', 'adv']];
const POS_LABEL = { n: '(noun)', v: '(verb)', a: '(adj)', s: '(adj)', r: '(adv)' };
const dataFileOf = (p) => (p === 's' ? 'a' : p);

// strip the adjective syntax markers word(a) / word(p) / word(ip)
const unmark = (w) => w.replace(/\((a|p|ip)\)$/, '');
const toText = (w) => unmark(w).replace(/_/g, ' ');

/* ── data.pos: offset → { words, gloss, ptrs } ─────────────────────────── */
const synsets = { n: new Map(), v: new Map(), a: new Map(), r: new Map() };
for (const [p, name] of POS_FILES) {
  const raw = readFileSync(join(dictDir, `data.${name}`), 'utf8');
  for (const line of raw.split('\n')) {
    if (!line || line.startsWith('  ')) continue;
    const bar = line.indexOf(' | ');
    const head = bar === -1 ? line : line.slice(0, bar);
    const gloss = bar === -1 ? '' : line.slice(bar + 3).trim();
    const f = head.split(' ');
    const offset = f[0];
    const wCnt = parseInt(f[3], 16);
    const words = [];
    let i = 4;
    for (let k = 0; k < wCnt; k++, i += 2) words.push(f[i]);
    const pCnt = parseInt(f[i], 10); i += 1;
    const ptrs = [];
    for (let k = 0; k < pCnt; k++, i += 4) {
      ptrs.push({ sym: f[i], offset: f[i + 1], pos: f[i + 2], st: f[i + 3] });
    }
    synsets[p].set(offset, { words, gloss, ptrs });
  }
  console.log(`data.${name}: ${synsets[p].size} synsets`);
}

/* Definition only — the quoted example sentences are noise here and a third
   of the bytes. A gloss that is ONLY examples keeps its first segment. */
function cleanGloss(gloss) {
  const parts = gloss.split(/;\s+/);
  const defs = parts.filter((s) => !s.startsWith('"') && !s.startsWith('“'));
  let out = (defs.length ? defs : [parts[0]]).join('; ');
  out = out.replace(/^"|"$/g, '');
  return out.replace(/\|/g, '/').replace(/\s+/g, ' ').trim();
}

/* ── index.pos: lemma → offsets (sense-frequency order) ───────────────── */
// lemma → array of { p, offsets }
const lemmas = new Map();
for (const [p, name] of POS_FILES) {
  const raw = readFileSync(join(dictDir, `index.${name}`), 'utf8');
  let count = 0;
  for (const line of raw.split('\n')) {
    if (!line || line.startsWith('  ')) continue;
    const f = line.split(' ').filter(Boolean);
    const lemma = f[0];
    const synsetCnt = parseInt(f[2], 10);
    const offsets = f.slice(f.length - synsetCnt);
    if (!offsets.length) continue;
    const key = lemma.replace(/_/g, ' ');
    if (!lemmas.has(key)) lemmas.set(key, []);
    lemmas.get(key).push({ p, offsets });
    count++;
  }
  console.log(`index.${name}: ${count} lemmas`);
}

/* ── emit ─────────────────────────────────────────────────────────────── */
const out = ['UTF-8'];
let senseTotal = 0;
const sortedLemmas = [...lemmas.keys()].sort();
for (const lemma of sortedLemmas) {
  const lines = [];
  for (const { p, offsets } of lemmas.get(lemma)) {
    for (const off of offsets) {
      const syn = synsets[p].get(off);
      if (!syn) continue;
      const meIdx = syn.words.findIndex((w) => toText(w).toLowerCase() === lemma);
      const others = syn.words.filter((_, i) => i !== meIdx).map(toText);
      // lexical antonyms: `!` pointers whose SOURCE is this lemma's word slot
      const ants = [];
      for (const ptr of syn.ptrs) {
        if (ptr.sym !== '!') continue;
        const src = parseInt(ptr.st.slice(0, 2), 16);
        if (meIdx !== -1 && src !== 0 && src !== meIdx + 1) continue;
        const target = synsets[dataFileOf(ptr.pos)]?.get(ptr.offset);
        if (!target) continue;
        const tgt = parseInt(ptr.st.slice(2), 16);
        const w = target.words[tgt > 0 ? tgt - 1 : 0];
        if (w) ants.push(`${toText(w)} (antonym)`);
      }
      // pos label from the DATA file's own type when reachable: satellite
      // adjectives live in data.adj with ss_type s — POS_LABEL maps both to
      // (adj), so the index pos char is enough.
      const gloss = cleanGloss(syn.gloss);
      const fields = [POS_LABEL[p], gloss, ...others, ...ants];
      lines.push(fields.join('|'));
    }
  }
  if (lines.length) {
    out.push(`${lemma}|${lines.length}`);
    out.push(...lines);
    senseTotal += lines.length;
  }
}

const target = join(import.meta.dirname, '../public/thesaurus/wn_en_31.dat');
writeFileSync(target, out.join('\n') + '\n', 'utf8');
console.log(`wrote ${target}: ${lemmas.size} lemmas, ${senseTotal} senses, ${(out.join('\n').length / 1e6).toFixed(1)} MB`);
