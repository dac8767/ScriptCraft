/**
 * v5.46: image intake shared by the Scrapbook and the annotation window —
 * ONE file-to-dataURL reader and ONE canvas compressor (the v1.69 Scrapbook
 * pair, extracted verbatim). Both stores persist images as data URLs, so
 * both must bound them the same way.
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

export function compressImage(dataUrl: string, maxDim: number, quality: number): Promise<{ src: string; w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('no canvas')); return; }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      try { resolve({ src: canvas.toDataURL('image/jpeg', quality), w, h }); }
      catch (e) { reject(e); }
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}
