/**
 * build-app-icons — one source PNG becomes the whole platform icon set.
 *
 * v7.39, Derek: "replace the opendraft brand art with the art I gave you as
 * the dock icon" (images/ScriptCraft_Logo2_v4.png).
 *
 * WHY A SCRIPT AND NOT FIFTEEN HAND EXPORTS. Fifteen files that must all be
 * the same picture is fifteen chances for one of them to drift, and the one
 * that drifts is the one nobody looks at — a Windows tile, or the 32px slot
 * inside the .icns. Regenerating from a single source is the only way they
 * stay in step, and the only way replacing the art later is one command.
 *
 * TWO THINGS ABOUT THE SOURCE, handled here rather than assumed away:
 *
 *   · IT IS NOT SQUARE (704x682) and every target is. Padding the short axis
 *     blindly would sit the art off-centre in its box, so the ALPHA BOUNDING
 *     BOX is measured and the square is centred on the art itself, not on the
 *     canvas it happened to be exported in.
 *   · IT IS SMALLER THAN 1024, which macOS wants for the largest .icns slot.
 *     Everything at or below the source size is a genuine downscale; the 1024
 *     slot is an upscale and is reported as such, because a build that quietly
 *     upsamples is how a soft dock icon ships.
 *
 * Chromium does the resampling (no PIL / ImageMagick / rsvg in this
 * container). .icns and .ico are written by hand — both are simple containers
 * that take PNG payloads directly, so there is nothing to convert.
 *
 *   node devtools/build-app-icons.mjs [source.png]
 */
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const SRC = process.argv[2] || join(ROOT, 'images', 'ScriptCraft_Logo2_v4.png');
const ICONS = join(ROOT, 'src-tauri', 'icons');

/** Flat PNGs Tauri and the Windows/Store bundles expect, by edge length. */
const FLAT = {
  '32x32.png': 32, '64x64.png': 64, '128x128.png': 128, '128x128@2x.png': 256,
  'icon.png': 512,
  'Square30x30Logo.png': 30, 'Square44x44Logo.png': 44, 'Square71x71Logo.png': 71,
  'Square89x89Logo.png': 89, 'Square107x107Logo.png': 107, 'Square142x142Logo.png': 142,
  'Square150x150Logo.png': 150, 'Square284x284Logo.png': 284, 'Square310x310Logo.png': 310,
  'StoreLogo.png': 50,
};

/** Android launcher icons — one per density bucket. */
const ANDROID = {
  'mipmap-mdpi': 48, 'mipmap-hdpi': 72, 'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144, 'mipmap-xxxhdpi': 192,
};

/** .icns slots. Apple's type codes; every one takes a PNG payload. */
const ICNS = [
  ['icp4', 16], ['icp5', 32], ['icp6', 64],
  ['ic07', 128], ['ic08', 256], ['ic09', 512], ['ic10', 1024],
  ['ic11', 32], ['ic12', 64], ['ic13', 256], ['ic14', 512],
];
/** .ico slots — Windows reads PNG payloads for anything past 48px. */
const ICO = [16, 24, 32, 48, 64, 128, 256];

const srcBuf = readFileSync(SRC);
const srcW = srcBuf.readUInt32BE(16), srcH = srcBuf.readUInt32BE(20);
console.log(`source: ${SRC.replace(ROOT + '/', '')}  ${srcW}x${srcH}`);

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 64, height: 64 } });
await page.goto('about:blank');

const dataUrl = `data:image/png;base64,${srcBuf.toString('base64')}`;

/* Measure the art, not the canvas. */
const box = await page.evaluate(async (url) => {
  const img = new Image();
  img.src = url;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  const { data } = x.getImageData(0, 0, c.width, c.height);
  let minX = c.width, minY = c.height, maxX = -1, maxY = -1;
  for (let y = 0; y < c.height; y++) {
    for (let px = 0; px < c.width; px++) {
      if (data[(y * c.width + px) * 4 + 3] > 8) {
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { w: img.width, h: img.height, minX, minY, maxX, maxY };
}, dataUrl);

const artW = box.maxX - box.minX + 1, artH = box.maxY - box.minY + 1;
const side = Math.max(artW, artH);
console.log(`ink bounds: ${artW}x${artH} at (${box.minX},${box.minY}) → square side ${side}`);

/** Render the art centred in a `size`×`size` transparent canvas. */
const renderAt = async (size) => page.evaluate(async ([url, size, b, side]) => {
  const img = new Image();
  img.src = url;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = 'high';
  const scale = size / side;
  const artW = b.maxX - b.minX + 1, artH = b.maxY - b.minY + 1;
  // centre the INK in the square, then scale the whole square to `size`
  const dx = (side - artW) / 2 * scale, dy = (side - artH) / 2 * scale;
  x.drawImage(img, b.minX, b.minY, artW, artH, dx, dy, artW * scale, artH * scale);
  return c.toDataURL('image/png');
}, [dataUrl, size, box, side]);

const png = async (size) => Buffer.from((await renderAt(size)).split(',')[1], 'base64');

const write = (p, buf) => {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, buf);
};

let upscaled = [];
const at = async (size) => {
  if (size > side) upscaled.push(size);
  return png(size);
};

/* ── flat PNGs ─────────────────────────────────────────────────────────── */
for (const [name, size] of Object.entries(FLAT)) {
  write(join(ICONS, name), await at(size));
}
console.log(`wrote ${Object.keys(FLAT).length} flat PNGs`);

/* ── Android launcher icons ────────────────────────────────────────────── */
let androidCount = 0;
for (const [dir, size] of Object.entries(ANDROID)) {
  const target = join(ICONS, 'android', dir);
  if (!existsSync(target)) continue;
  const buf = await at(size);
  write(join(target, 'ic_launcher.png'), buf);
  write(join(target, 'ic_launcher_round.png'), buf);
  write(join(target, 'ic_launcher_foreground.png'), buf);
  androidCount += 3;
}
console.log(`wrote ${androidCount} Android launcher PNGs`);

/* ── icon.icns ─────────────────────────────────────────────────────────── */
{
  const parts = [];
  for (const [type, size] of ICNS) {
    const data = await at(size);
    const head = Buffer.alloc(8);
    head.write(type, 0, 'ascii');
    head.writeUInt32BE(data.length + 8, 4);
    parts.push(head, data);
  }
  const body = Buffer.concat(parts);
  const head = Buffer.alloc(8);
  head.write('icns', 0, 'ascii');
  head.writeUInt32BE(body.length + 8, 4);
  write(join(ICONS, 'icon.icns'), Buffer.concat([head, body]));
  console.log(`wrote icon.icns (${ICNS.length} slots)`);
}

/* ── icon.ico ──────────────────────────────────────────────────────────── */
{
  const images = [];
  for (const size of ICO) images.push({ size, data: await at(size) });
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);            // reserved
  header.writeUInt16LE(1, 2);            // type 1 = icon
  header.writeUInt16LE(images.length, 4);
  const dir = Buffer.alloc(16 * images.length);
  let offset = header.length + dir.length;
  images.forEach((im, i) => {
    const o = i * 16;
    dir[o] = im.size >= 256 ? 0 : im.size;      // 0 means 256
    dir[o + 1] = im.size >= 256 ? 0 : im.size;
    dir[o + 2] = 0;                              // palette
    dir[o + 3] = 0;                              // reserved
    dir.writeUInt16LE(1, o + 4);                 // colour planes
    dir.writeUInt16LE(32, o + 6);                // bits per pixel
    dir.writeUInt32LE(im.data.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += im.data.length;
  });
  write(join(ICONS, 'icon.ico'), Buffer.concat([header, dir, ...images.map((i) => i.data)]));
  console.log(`wrote icon.ico (${ICO.length} slots)`);
}

await browser.close();

if (upscaled.length) {
  const uniq = [...new Set(upscaled)].sort((a, b) => a - b);
  console.log(`\n⚠ UPSCALED from a ${side}px source: ${uniq.join(', ')}px.`);
  console.log('  Everything at or below', side + 'px', 'is a true downscale and is sharp.');
  console.log('  A 1024x1024 source would remove this note entirely.');
}
