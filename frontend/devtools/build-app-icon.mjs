/* build-app-icon.mjs (v7.65) — fit the logo to Apple's icon grid.
 *
 * Derek: "the script craft icon is larger than all other icons in the mac
 * dock." It is, and by a knowable amount. images/logo_FINAL.png draws its
 * rounded square edge to edge on a 1024×1024 canvas, but macOS reserves a
 * margin inside that canvas: since Big Sur the icon body occupies 824×824
 * centred, with 100px of transparency on every side, and the Dock lays out
 * icons on the canvas — not on the artwork. Filling the canvas therefore
 * renders 1024/824 ≈ 24% wider than every icon that follows the grid, which
 * is exactly what the screenshot shows.
 *
 * This writes the gridded source. Regenerating the icon set from it is the
 * Tauri CLI's job:
 *
 *   node frontend/devtools/build-app-icon.mjs
 *   ./frontend/node_modules/.bin/tauri icon images/app-icon.png
 *
 * The artwork is untouched — only its scale on the canvas changes — so this
 * can be re-run whenever logo_FINAL.png is redrawn.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const SRC = new URL('../../images/logo_FINAL.png', import.meta.url);
const OUT = new URL('../../images/app-icon.png', import.meta.url);

/** Apple's macOS app-icon grid, on a 1024 canvas. */
export const CANVAS = 1024;
export const BODY = 824;

const b64 = readFileSync(SRC).toString('base64');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage();

const dataUrl = await page.evaluate(async ({ src, canvasPx, bodyPx }) => {
  const img = new Image();
  img.src = src;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = canvasPx;
  c.height = canvasPx;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const inset = (canvasPx - bodyPx) / 2;
  ctx.drawImage(img, inset, inset, bodyPx, bodyPx);
  return c.toDataURL('image/png');
}, { src: `data:image/png;base64,${b64}`, canvasPx: CANVAS, bodyPx: BODY });

await browser.close();
writeFileSync(OUT, Buffer.from(dataUrl.split(',')[1], 'base64'));
console.log(`wrote images/app-icon.png — ${BODY}px body centred on a ${CANVAS}px canvas`
  + ` (${(BODY / CANVAS * 100).toFixed(1)}% of the canvas, per Apple's grid)`);
