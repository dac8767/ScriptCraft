/**
 * Screenshot (v3.80, Derek; hardened v3.89) — capture what the writer is
 * looking at and download it as a PNG. Uses html2canvas (a dependency), lazily
 * imported so its weight only loads when the button is used.
 *
 * Target: the `.page` whose middle is nearest the viewport centre (what you're
 * reading). Falls back to the Scrapbook board, then the editor content, so the
 * button always captures *something*.
 *
 * v3.89: the download anchor is now appended to the document before .click() —
 * WebKit (and thus the Tauri app) will not start a download from a detached
 * anchor, which is why the button "did nothing." Errors now surface as a toast
 * instead of a silent unhandled rejection.
 */
import { showToast } from '../components/Toast';

function pickTarget(): HTMLElement | null {
  const pages = Array.from(document.querySelectorAll<HTMLElement>('.page'));
  if (pages.length) {
    const cy = window.innerHeight / 2;
    const dist = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return Math.abs((r.top + r.bottom) / 2 - cy);
    };
    return pages.reduce((best, p) => (dist(p) < dist(best) ? p : best), pages[0]);
  }
  // Scrapbook (the notebook surface takes over the editor area), then the
  // ProseMirror doc, then the whole editor centre as a last resort.
  return document.querySelector<HTMLElement>('.fs-nb-takeover')
    || document.querySelector<HTMLElement>('.ProseMirror')
    || document.querySelector<HTMLElement>('.editor-center');
}

export async function captureScreenshot(): Promise<void> {
  const target = pickTarget();
  if (!target) { showToast('Nothing on screen to capture.', 'error'); return; }
  try {
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(target, {
      backgroundColor: '#ffffff', scale: 2, useCORS: true, logging: false,
    });
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    const title = (document.title || 'script').replace(/[^\w-]+/g, '_').slice(0, 40) || 'script';
    link.download = `${title}-screenshot.png`;
    // WebKit needs the anchor in the document for a programmatic download.
    document.body.appendChild(link);
    link.click();
    link.remove();
    showToast('Screenshot saved.', 'success');
  } catch (e) {
    console.error('screenshot failed', e);
    showToast('Could not capture a screenshot of this view.', 'error');
  }
}
