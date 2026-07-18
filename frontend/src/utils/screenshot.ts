/**
 * Screenshot (v3.80, Derek) — capture the script page the writer is looking at
 * and download it as a PNG. Uses html2canvas (already a dependency), lazily
 * imported so its weight only loads when the button is actually used.
 *
 * Target: the `.page` whose middle is nearest the viewport centre (what you're
 * reading), falling back to the whole editor content if pages aren't found.
 */
export async function captureScreenshot(): Promise<void> {
  const pages = Array.from(document.querySelectorAll<HTMLElement>('.page'));
  let target: HTMLElement | null = null;
  if (pages.length) {
    const cy = window.innerHeight / 2;
    const dist = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return Math.abs((r.top + r.bottom) / 2 - cy);
    };
    target = pages.reduce((best, p) => (dist(p) < dist(best) ? p : best), pages[0]);
  }
  target = target || document.querySelector<HTMLElement>('.ProseMirror');
  if (!target) return;

  const { default: html2canvas } = await import('html2canvas');
  const canvas = await html2canvas(target, { backgroundColor: '#ffffff', scale: 2, useCORS: true });

  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  const title = (document.title || 'script').replace(/[^\w-]+/g, '_').slice(0, 40) || 'script';
  link.download = `${title}-screenshot.png`;
  link.click();
}
