/*
 * Shortening a path for display — at SEGMENT boundaries, not mid-word.
 *
 * The Save dialog used to clip long paths with CSS (`direction: rtl` +
 * `text-overflow: ellipsis`), which cuts wherever the pixels run out:
 * "…s/dcarl/Downloads/". A path truncated mid-segment reads as a different
 * folder. The rule: drop whole leading segments until it fits, so the result
 * is always "…/dcarl/Downloads/" — every segment you can see is real.
 *
 * Pure function: the caller supplies `fits`, a predicate that knows the
 * available width (measured text, character budget, whatever). That keeps
 * this testable without a DOM.
 */
export function shortenPathToFit(path: string, fits: (s: string) => boolean): string {
  if (fits(path)) return path;

  // Try suffixes starting at each successive "/" — skipping a leading slash
  // (dropping nothing but "/" saves no room) and the trailing one ("…/" alone
  // names no folder at all).
  let idx = path.indexOf('/', 1);
  while (idx !== -1 && idx < path.length - 1) {
    const candidate = '…' + path.slice(idx);
    if (fits(candidate)) return candidate;
    idx = path.indexOf('/', idx + 1);
  }

  // Even the last segment alone doesn't fit. Return it anyway — the caller's
  // CSS ellipsis is the backstop — because "…/Downloads/" clipped is still
  // more honest than nothing.
  const trimmed = path.endsWith('/') ? path.slice(0, -1) : path;
  const last = trimmed.lastIndexOf('/');
  return '…' + (last === -1 ? path : path.slice(last));
}
