import DOMPurify from 'dompurify';

/**
 * v7.94 (app-health S3): the Scrapbook's text boxes are contentEditable HTML,
 * and that HTML can arrive from outside — an imported preset or backup carries
 * `opendraft:notebook` — so it is cleaned before it reaches innerHTML.
 *
 * Formatting the boxes really produce (execCommand spans and styles, <font>,
 * lists, tables, pasted links and images) survives. What goes: scripts and
 * event handlers (DOMPurify's defaults), plus the tags that act without a
 * script — <meta http-equiv> navigation, <style>/<link> restyling the whole
 * app, <base>, forms, and frames (an <iframe srcdoc> inherits the app's CSP).
 */
const CONFIG = {
  FORBID_TAGS: ['style', 'link', 'meta', 'base', 'form', 'input', 'button', 'textarea', 'select', 'iframe', 'frame', 'frameset', 'object', 'embed'],
  FORBID_ATTR: ['srcdoc', 'formaction'],
};

export function sanitizeNotebookHtml(html: string): string {
  return html ? DOMPurify.sanitize(html, CONFIG) : '';
}
