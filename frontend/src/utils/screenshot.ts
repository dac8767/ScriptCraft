/**
 * Screenshot (v3.80, Derek; reworked v3.94/v3.95) — capture the app as it looks
 * on screen and save it as a PNG. Uses html2canvas-pro (a dependency), lazily
 * imported so its weight only loads when used.
 *
 * Two modes (a small chooser appears on click):
 *   • Full Screen — the whole window, cropped to the visible viewport.
 *   • Select Area — drag a rectangle; only that region is captured.
 *
 * Where it saves: if a Screenshot folder is set in Settings ▸ Save Options (and
 * we're in the desktop app) the PNG is written there; otherwise it downloads to
 * the browser's Downloads folder.
 */
import { showToast } from '../components/Toast';
import { useSettingsStore } from '../stores/settingsStore';

type Rect = { x: number; y: number; width: number; height: number };

/* ── the mode chooser: a dropdown anchored under the Screenshot button ──── */
function chooseMode(): Promise<'full' | 'area' | null> {
  return new Promise((resolve) => {
    const btn = document.querySelector<HTMLElement>('[data-key="screenshot"]');
    const catcher = document.createElement('div');   // transparent click-away catcher
    catcher.className = 'fs-shot-catch';
    const menu = document.createElement('div');
    menu.className = 'fs-shot-menu';
    menu.innerHTML = `
      <button data-mode="full" class="fs-shot-item">Full Screen</button>
      <button data-mode="area" class="fs-shot-item">Select Area…</button>`;
    document.body.appendChild(catcher);
    document.body.appendChild(menu);

    const MENU_W = 176;
    if (btn) {
      const r = btn.getBoundingClientRect();
      menu.style.top = `${r.bottom + 3}px`;
      menu.style.left = `${Math.max(6, Math.min(r.left, window.innerWidth - MENU_W - 6))}px`;
    } else {                                          // button not on the bar — center-top
      menu.style.top = '52px';
      menu.style.left = `${Math.round(window.innerWidth / 2 - MENU_W / 2)}px`;
    }

    const done = (v: 'full' | 'area' | null) => { catcher.remove(); menu.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') done(null); };
    document.addEventListener('keydown', onKey);
    catcher.addEventListener('mousedown', () => done(null));
    menu.addEventListener('click', (e) => {
      const m = (e.target as HTMLElement).getAttribute('data-mode');
      if (m === 'full') done('full');
      else if (m === 'area') done('area');
    });
  });
}

/* ── drag-to-select a region ───────────────────────────────────────────── */
function selectArea(): Promise<Rect | null> {
  return new Promise((resolve) => {
    const layer = document.createElement('div');
    layer.className = 'fs-shot-select';
    const box = document.createElement('div');
    box.className = 'fs-shot-selbox';
    box.style.display = 'none';
    const hint = document.createElement('div');
    hint.className = 'fs-shot-selhint';
    hint.textContent = 'Drag to select an area · Esc to cancel';
    layer.appendChild(box);
    layer.appendChild(hint);
    document.body.appendChild(layer);

    let start: { x: number; y: number } | null = null;
    const cleanup = () => { layer.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { cleanup(); resolve(null); } };
    document.addEventListener('keydown', onKey);

    const rectFrom = (a: { x: number; y: number }, b: { x: number; y: number }): Rect => ({
      x: Math.min(a.x, b.x), y: Math.min(a.y, b.y),
      width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y),
    });
    const paint = (r: Rect) => {
      box.style.display = 'block';
      box.style.left = `${r.x}px`; box.style.top = `${r.y}px`;
      box.style.width = `${r.width}px`; box.style.height = `${r.height}px`;
    };
    layer.addEventListener('mousedown', (e) => { start = { x: e.clientX, y: e.clientY }; hint.style.display = 'none'; });
    layer.addEventListener('mousemove', (e) => { if (start) paint(rectFrom(start, { x: e.clientX, y: e.clientY })); });
    layer.addEventListener('mouseup', (e) => {
      if (!start) { cleanup(); resolve(null); return; }
      const r = rectFrom(start, { x: e.clientX, y: e.clientY });
      cleanup();
      resolve(r.width >= 4 && r.height >= 4 ? r : null);
    });
  });
}

/** One name for every capture, wherever it ends up (disk, Downloads, or the
 *  Feedback attachment chip) — app title + timestamp. */
export function screenshotFilename(): string {
  const base = (document.title || 'screen').replace(/[^\w-]+/g, '_').slice(0, 40) || 'screen';
  const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
  return `${base}-${stamp}.png`;
}

/* ── copy the canvas to the clipboard as a PNG (v4.98) ───────────────────
   Derek: dragging the Feedback capture into the Airtable form doesn't work in
   the desktop webview. Pasting doesn't depend on drag support at all, so this
   is the route that survives whatever WKWebView will or won't carry in a drag.

   The ClipboardItem value is the PENDING promise, not an awaited Blob, and
   that is load-bearing on WebKit: awaiting the encode first spends the user
   activation, and the write is then refused as "not triggered by the user".
   Chromium accepts either form, so the promise shape is right for both.

   Returns false rather than throwing — the caller decides what to say. */
export async function copyCanvasToClipboard(canvas: HTMLCanvasElement): Promise<boolean> {
  const CI = (globalThis as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem;
  if (!CI || !navigator.clipboard?.write) return false;
  try {
    const png = new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode the image.'))), 'image/png');
    });
    await navigator.clipboard.write([new CI({ 'image/png': png })]);
    return true;
  } catch {
    return false;
  }
}

/* ── save the canvas (chosen folder on desktop, else browser download) ──── */
export async function saveScreenshotCanvas(canvas: HTMLCanvasElement): Promise<void> {
  const filename = screenshotFilename();

  const folder = useSettingsStore.getState().screenshotFolder;
  const { isTauri } = await import('../services/platform');
  if (folder && isTauri()) {
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/png'));
    if (!blob) throw new Error('Could not encode the image.');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    const sep = folder.endsWith('/') || folder.endsWith('\\') ? '' : '/';
    await writeFile(`${folder}${sep}${filename}`, bytes);
    showToast(`Screenshot saved to ${folder}.`, 'success');
    return;
  }
  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = filename;
  document.body.appendChild(link); // WebKit needs it in the document to download
  link.click();
  link.remove();
  showToast('Screenshot saved to Downloads.', 'success');
}

async function renderToCanvas(crop?: Rect): Promise<HTMLCanvasElement> {
  // v4.70: html2canvas-pro, not html2canvas — the original is unmaintained and
  // throws "unsupported color function" on the modern color() / color-mix()
  // values this app's styles lean on (the capture button was dead because of
  // it). The fork is API-compatible; same lazy import, same options.
  const { default: html2canvas } = await import('html2canvas-pro');
  const bg = getComputedStyle(document.body).backgroundColor || '#1e1e1e';
  const dpr = window.devicePixelRatio || 2;
  // v4.1: capture the whole window with MINIMAL options (the crop/window options
  // added in v3.94 made html2canvas throw on the full app — the button stopped
  // working). Crop AFTER capture instead. The app is a fixed-viewport window, so
  // document.body ≈ the visible screen.
  const full = await html2canvas(document.body, {
    backgroundColor: bg,
    scale: dpr,
    useCORS: true,
    logging: false,
  });
  const region: Rect = crop ?? { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(region.width * dpr));
  out.height = Math.max(1, Math.round(region.height * dpr));
  const ctx = out.getContext('2d');
  if (!ctx) return full;
  ctx.drawImage(full, Math.round(region.x * dpr), Math.round(region.y * dpr), out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

/** v4.70, Derek: capture WITHOUT saving — the Feedback window turns the canvas
 *  into an attachable file instead. Runs the mode's UI (the area drag for
 *  'area'); `veilClass` goes on <body> for the WHOLE interaction so CSS can
 *  hide the caller's own window — the shot shows the app, not the tool that
 *  took it. Returns null when the user cancels. Errors propagate. */
export async function captureToCanvas(
  mode: 'full' | 'area',
  veilClass?: string,
): Promise<HTMLCanvasElement | null> {
  if (veilClass) document.body.classList.add(veilClass);
  try {
    let crop: Rect | undefined;
    if (mode === 'area') {
      const r = await selectArea();
      if (!r) return null;                  // cancelled
      crop = r;
    }
    return await renderToCanvas(crop);
  } finally {
    if (veilClass) document.body.classList.remove(veilClass);
  }
}

export async function captureScreenshot(mode: 'full' | 'area' | 'choose' = 'choose'): Promise<void> {
  try {
    let m: 'full' | 'area' | null = mode === 'choose' ? await chooseMode() : mode;
    if (!m) return;                       // cancelled
    let crop: Rect | undefined;
    if (m === 'area') {
      const r = await selectArea();
      if (!r) return;                     // cancelled
      crop = r;
    }
    await saveScreenshotCanvas(await renderToCanvas(crop));
  } catch (e) {
    console.error('screenshot failed', e);
    showToast('Could not capture a screenshot of this view.', 'error');
  }
}
