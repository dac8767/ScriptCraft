/* check-v628 — Derek: "i tried to import a pdf and got this error" — "PDF
   import failed: undefined is not a function (near '...value of
   readableStream...')". That error text is WEBKIT's: the modern pdf.js
   build assumes engine features Tauri's WKWebView lacks (ReadableStream
   async iteration among them). pdfImporter now loads the LEGACY pdf.js
   build (module + worker together). This drives the real pipeline on a
   hand-built PDF — pdf.js worker boot, text extraction, screenplay
   classification — so the import path never again ships with zero
   end-to-end coverage. (True WKWebView behavior is only observable on the
   Mac; this pins the pipeline itself and the legacy-build wiring.) */
import { launch } from './driver.mjs';

const { browser, page } = await launch({ width: 1200, height: 800 });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL', m); } };

try {
  await page.goto('http://localhost:5199/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ProseMirror', { timeout: 25000 });

  const out = await page.evaluate(async () => {
    const body = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length 90 >> stream
BT /F1 12 Tf 108 700 Td (INT. FARMHOUSE - NIGHT) Tj 0 -24 Td (A quiet room.) Tj ET
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Courier >> endobj
trailer << /Root 1 0 R >>`;
    const data = new TextEncoder().encode(body).buffer;
    try {
      const mod = await import('/src/utils/pdfImporter.ts');
      const res = await mod.parsePdfScreenplay(data);
      return {
        ok: true,
        pages: res.pages,
        types: res.doc.content.map((n) => n.type),
        first: res.doc.content[0]?.content?.[0]?.text ?? null,
      };
    } catch (e) {
      return { ok: false, err: String(e).slice(0, 200) };
    }
  });

  ok(out.ok, `the pdf.js pipeline runs (${out.ok ? 'parsed' : out.err})`);
  if (out.ok) {
    ok(out.pages === 1, `one page extracted (${out.pages})`);
    ok(out.first === 'INT. FARMHOUSE - NIGHT', `the text layer survives (${out.first})`);
    ok(out.types[0] === 'sceneHeading' && out.types[1] === 'action',
      `paragraphs classify as screenplay elements (${out.types.join(',')})`);
  }
} catch (e) {
  console.log('PROBE ERROR:', e.message);
} finally { await browser.close(); }
console.log(`\ncheck-v628: ${pass} passed, ${fail} failed`);
