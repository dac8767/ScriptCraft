// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { sanitizeNotebookHtml } from './notebookHtml';

describe('sanitizeNotebookHtml (v7.94, app-health S3)', () => {
  it('keeps the formatting a Scrapbook box actually produces', () => {
    const html = '<div><b>Bold</b> <i>it</i> <u>u</u> <span style="color: rgb(255, 0, 0); font-size: 18px;">red</span>'
      + '<font size="7">big</font><ul><li>one</li></ul><a href="https://example.com">link</a></div>';
    const out = sanitizeNotebookHtml(html);
    for (const bit of ['<b>Bold</b>', '<i>it</i>', '<u>u</u>', 'style="color: rgb(255, 0, 0); font-size: 18px;"', '<font size="7">', '<li>one</li>', 'href="https://example.com"']) {
      expect(out).toContain(bit);
    }
  });

  it('strips scripts, handlers and the tags that act without a script', () => {
    const out = sanitizeNotebookHtml(
      '<img src="x" onerror="alert(1)"><script>alert(2)</script>'
      + '<iframe srcdoc="<script src=https://accounts.google.com/x></script>"></iframe>'
      + '<meta http-equiv="refresh" content="0;url=https://evil.example"><style>body{display:none}</style>'
      + '<link rel="stylesheet" href="https://evil.example/x.css"><base href="https://evil.example/">'
      + '<form action="https://evil.example"><input name="p"></form><a href="javascript:alert(3)">x</a>',
    );
    for (const bad of ['onerror', '<script', '<iframe', 'srcdoc', '<meta', '<style', '<link', '<base', '<form', '<input', 'javascript:']) {
      expect(out.toLowerCase()).not.toContain(bad);
    }
  });

  it('treats empty and missing html as empty', () => {
    expect(sanitizeNotebookHtml('')).toBe('');
  });
});
