/**
 * Screenshot (v3.80, Derek; reworked v3.94) — capture the app AS IT LOOKS ON
 * SCREEN and download it as a PNG. Uses html2canvas (a dependency), lazily
 * imported so its weight only loads when the button is used.
 *
 * v3.94: this now grabs the whole window (menus, toolbar, panels, and whatever
 * you're looking at), cropped to the visible viewport — NOT the `.page`, which
 * is the entire multi-page script and rendered top-to-bottom as one tall image.
 *
 * v3.89: the download anchor is appended to the document before .click() —
 * WebKit (and thus the Tauri app) will not start a download from a detached
 * anchor, which is why the button "did nothing." Errors surface as a toast
 * instead of a silent unhandled rejection.
 */
import { showToast } from '../components/Toast';

export async function captureScreenshot(): Promise<void> {
  const root = document.body;
  if (!root) { showToast('Nothing on screen to capture.', 'error'); return; }
  try {
    const { default: html2canvas } = await import('html2canvas');
    const w = window.innerWidth;
    const h = window.innerHeight;
    const bg = getComputedStyle(root).backgroundColor || '#1e1e1e';
    const canvas = await html2canvas(root, {
      backgroundColor: bg,
      scale: window.devicePixelRatio || 2,
      useCORS: true,
      logging: false,
      // Crop to the visible viewport (top-left origin) so it's a picture of the
      // current screen, not the full scrollable document.
      x: window.scrollX,
      y: window.scrollY,
      width: w,
      height: h,
      windowWidth: w,
      windowHeight: h,
      scrollX: 0,
      scrollY: 0,
    });
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    const title = (document.title || 'screen').replace(/[^\w-]+/g, '_').slice(0, 40) || 'screen';
    link.download = `${title}-screenshot.png`;
    // WebKit needs the anchor in the document for a programmatic download.
    document.body.appendChild(link);
    link.click();
    link.remove();
    showToast('Screenshot saved to Downloads.', 'success');
  } catch (e) {
    console.error('screenshot failed', e);
    showToast('Could not capture a screenshot of this view.', 'error');
  }
}
