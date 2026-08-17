/* check-icons — the app's face, in every slot it has one.
 *
 * v7.39, Derek: "replace the opendraft brand art with the art I gave you as
 * the dock icon."
 *
 * Fifteen PNGs, two containers and a splash screen all have to be the same
 * picture, and the one that drifts is always the one nobody looks at — a
 * Windows tile, or the 32px slot buried inside the .icns. Nothing in the app
 * fails when that happens; you find out when a build ships with two different
 * logos on it. So this reads the actual file headers rather than trusting that
 * build-app-icons.mjs was run.
 *
 * It cannot compare PIXELS — these are lossy rescales of each other — so it
 * checks the things that DO prove provenance: every file exists, every one is
 * the size its name claims, the containers hold the slots they should, and no
 * upstream OpenDraft art file is still being pointed at.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const ICONS = join(ROOT, 'src-tauri', 'icons');

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ FAIL ${name} ${extra}`); }
};

/** width/height straight out of the PNG IHDR. */
const pngSize = (p) => {
  const b = readFileSync(p);
  if (b.subarray(0, 8).toString('latin1') !== '\x89PNG\r\n\x1a\n') return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
};

const EXPECT = {
  '32x32.png': 32, '64x64.png': 64, '128x128.png': 128, '128x128@2x.png': 256,
  'icon.png': 512,
  'Square30x30Logo.png': 30, 'Square44x44Logo.png': 44, 'Square71x71Logo.png': 71,
  'Square89x89Logo.png': 89, 'Square107x107Logo.png': 107, 'Square142x142Logo.png': 142,
  'Square150x150Logo.png': 150, 'Square284x284Logo.png': 284, 'Square310x310Logo.png': 310,
  'StoreLogo.png': 50,
};

console.log('\nflat PNGs');
const wrong = [];
for (const [name, size] of Object.entries(EXPECT)) {
  const p = join(ICONS, name);
  if (!existsSync(p)) { wrong.push(`${name}: missing`); continue; }
  const s = pngSize(p);
  if (!s) { wrong.push(`${name}: not a PNG`); continue; }
  if (s.w !== size || s.h !== size) wrong.push(`${name}: ${s.w}x${s.h}, expected ${size}`);
}
ok(`all ${Object.keys(EXPECT).length} are present and square at their stated size`,
  wrong.length === 0, wrong.join('; '));

console.log('\ncontainers');
{
  const p = join(ICONS, 'icon.icns');
  ok('icon.icns exists', existsSync(p));
  if (existsSync(p)) {
    const b = readFileSync(p);
    ok('…it is a real icns (magic + self-declared length)',
      b.subarray(0, 4).toString('latin1') === 'icns' && b.readUInt32BE(4) === b.length,
      `magic=${b.subarray(0, 4).toString('latin1')} declared=${b.readUInt32BE(4)} actual=${b.length}`);
    // walk its table of contents
    const types = [];
    let i = 8;
    while (i + 8 <= b.length) {
      const type = b.subarray(i, i + 4).toString('latin1');
      const len = b.readUInt32BE(i + 4);
      if (len < 8 || i + len > b.length) break;
      types.push(type);
      i += len;
    }
    ok('…every chunk length walks cleanly to the end', i === b.length, `stopped at ${i}/${b.length}`);
    // ic10 is the 1024 retina slot macOS uses for the largest previews
    ok('…it carries the 1024 slot (ic10)', types.includes('ic10'), types.join(','));
    ok('…and the everyday dock sizes (ic07/ic08/ic09)',
      ['ic07', 'ic08', 'ic09'].every((t) => types.includes(t)), types.join(','));
  }
}
{
  const p = join(ICONS, 'icon.ico');
  ok('icon.ico exists', existsSync(p));
  if (existsSync(p)) {
    const b = readFileSync(p);
    const count = b.readUInt16LE(4);
    ok('…it is a real ico (reserved 0, type 1)',
      b.readUInt16LE(0) === 0 && b.readUInt16LE(2) === 1, `${b.readUInt16LE(0)}/${b.readUInt16LE(2)}`);
    ok('…with several sizes in it', count >= 5, `${count} entries`);
    // every entry's offset+length must land inside the file
    let sane = true;
    for (let i = 0; i < count; i++) {
      const o = 6 + i * 16;
      if (b.readUInt32LE(o + 12) + b.readUInt32LE(o + 8) > b.length) sane = false;
    }
    ok('…and every entry points inside the file', sane, '');
  }
}

console.log('\nthe other places the logo appears');
{
  const splash = join(ROOT, 'frontend', 'public', 'splash-logo.png');
  ok('the splash logo exists', existsSync(splash));
  if (existsSync(splash)) {
    const s = pngSize(splash);
    ok('…and is square', s && s.w === s.h, s ? `${s.w}x${s.h}` : 'not a PNG');
  }
  ok('the favicon exists', existsSync(join(ROOT, 'frontend', 'public', 'favicon.ico')));
  // upstream's lightning-bolt SVG was never referenced by anything — it went
  // with the rest of the OpenDraft art rather than sitting in public/ forever
  ok('upstream\'s unused favicon.svg is gone',
    !existsSync(join(ROOT, 'frontend', 'public', 'favicon.svg')), '');

  const md = readFileSync(join(ROOT, 'README.md'), 'utf8');
  ok('the README shows this fork\'s logo, not OpenDraft\'s',
    !/images\/OpenDraft/.test(md), (md.match(/images\/\S+?\.png/) || [''])[0]);
}

console.log('\nthe source is in the repo');
{
  const src = join(ROOT, 'images', 'logo_FINAL.png');
  ok('the icon source is committed (regenerating needs it)', existsSync(src));
  if (existsSync(src)) {
    const s = pngSize(src);
    ok('…and it is a PNG the builder can read', !!s, '');
    // 1024 would remove the one upscale in the set; not a failure, just said
    if (s && Math.max(s.w, s.h) < 1024) {
      console.log(`    note: source is ${s.w}x${s.h}; the .icns 1024 slot is upscaled from it.`);
    }
  }
  ok('the builder that made all of this is committed too',
    existsSync(join(ROOT, 'frontend', 'devtools', 'build-app-icons.mjs')), '');
}

console.log(`\ncheck-icons: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
