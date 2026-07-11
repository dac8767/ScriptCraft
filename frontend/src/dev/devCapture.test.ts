import { describe, it, expect } from 'vitest';
import { buildBundle, type Shot } from './devCapture';

// A 1x1 red PNG — a real, decodable image, so the test proves the bundle carries
// something that can actually be recovered, not just a plausible-looking string.
const RED_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const shot = (label: string): Shot => ({ id: 'x1', dataUrl: RED_PNG, label, at: '09:31' });

describe('the export bundle — one file, note plus pictures', () => {
  it('carries the note text', () => {
    const md = buildBundle('the Link field is misaligned on Notes — Right Panel', [], []);
    expect(md).toContain('the Link field is misaligned on Notes — Right Panel');
  });

  it('embeds each screenshot so the file stands alone', () => {
    const md = buildBundle('see attached', [shot('Screenshot 1'), shot('Screenshot 2')], []);
    expect(md).toContain('### 1. Screenshot 1 (09:31)');
    expect(md).toContain('### 2. Screenshot 2 (09:31)');
    expect((md.match(/data:image\/png;base64,/g) || []).length).toBe(2);
  });

  it('the embedded image is genuinely decodable — not just a plausible string', () => {
    const md = buildBundle('note', [shot('Screenshot 1')], []);
    const b64 = md.match(/data:image\/png;base64,([A-Za-z0-9+/=]+)/)![1];
    const bytes = Buffer.from(b64, 'base64');
    // PNG magic number: the file really is a PNG when it comes back out.
    expect([...bytes.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it('keeps the note readable even with no screenshots', () => {
    const md = buildBundle('just text', [], ['Theme: dark']);
    expect(md).toContain('just text');
    expect(md).toContain('- Theme: dark');
    expect(md).not.toContain('## Screenshots');
  });

  it('says so plainly rather than pretending, when the note is empty', () => {
    expect(buildBundle('', [shot('Screenshot 1')], [])).toContain('_(no note)_');
  });
});
