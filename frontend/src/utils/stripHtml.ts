// THE stripHtml. Two drifted copies used to exist — CharacterProfiles
// (DOMPurify, correct entity decoding, but block boundaries collapsed: "a</p>
// <p>b" → "ab") and fdxExporter (hand-rolled regex knowing only 6 entities, so
// FDX cast descriptions exported "&mdash;" literally, but it did space out
// block boundaries). This merges the correct halves of both: block/line-break
// boundaries become spaces, then DOMPurify drops every tag and decodes every
// entity.
import DOMPurify from 'dompurify';

/** Strip HTML to plain text: entities decoded, block boundaries spaced. */
export function stripHtml(html: string): string {
  if (!html) return '';
  const spaced = html
    .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ');
  // sanitize() drops every tag but SERIALIZES back to HTML, so &/</> stay
  // encoded (&amp;…) — the old DOMPurify-only copy had that hole too. Reading
  // textContent off a detached parse decodes them to true plain text (no
  // scripts execute in a DOMParser document).
  const sanitized = DOMPurify.sanitize(spaced, { ALLOWED_TAGS: [] });
  const parsed = new DOMParser().parseFromString(sanitized, 'text/html');
  return (parsed.body.textContent || '').replace(/\s+/g, ' ').trim();
}
