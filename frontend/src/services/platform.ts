/**
 * Platform detection utilities.
 *
 * Determines whether we are running as:
 *  - a plain web app in the browser,
 *  - a Tauri desktop app (macOS / Windows / Linux), or
 *  - a Tauri mobile app (iOS / Android).
 *
 * On mobile Tauri the Python sidecar backend is unavailable, so the
 * frontend uses a local SQLite database for storage instead of HTTP.
 */

/** True when running inside any Tauri WebView (desktop or mobile). */
export function isTauri(): boolean {
  return !!(window as any).__TAURI_INTERNALS__;
}

/** True when running inside a Tauri *mobile* WebView (iOS or Android). */
export function isMobileTauri(): boolean {
  if (!isTauri()) return false;
  const ua = navigator.userAgent || '';
  // iPadOS 13+ sends a desktop-class UA ("Macintosh") so also check touch
  return /android/i.test(ua) || /iphone|ipad|ipod/i.test(ua) ||
    (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

/** True when running as a Tauri desktop app (has sidecar backend). */
export function isDesktopTauri(): boolean {
  return isTauri() && !isMobileTauri();
}

/** True when running as a plain browser web app (no Tauri). */
export function isWeb(): boolean {
  return !isTauri();
}

/** Detects the OS from the user agent. */
export function getOS(): 'macos' | 'windows' | 'linux' | 'android' | 'ios' | 'unknown' {
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  // iPadOS 13+ uses a desktop-class user agent containing "Macintosh".
  // Detect it via touch support — real Macs have maxTouchPoints === 0.
  if (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return 'ios';
  if (/macintosh|mac os x/i.test(ua)) return 'macos';
  if (/windows/i.test(ua)) return 'windows';
  if (/linux/i.test(ua)) return 'linux';
  return 'unknown';
}

/**
 * fetch(), under the name every caller already uses.
 *
 * v7.96 (app-health hardening): this used to tunnel Tauri requests through a
 * Rust `http_fetch` command so the webview could reach a plain-http backend
 * (the old sidecar on localhost:18321) despite mixed-content rules. That
 * command was a proxy to anywhere, outside the CSP, and the backend it served
 * no longer ships — so requests now go through the webview like any other,
 * and the CSP's connect-src decides where they may go. A future cloud server
 * must be https, send CORS headers, and be added to connect-src.
 */
export function platformFetch(url: string, options?: RequestInit): Promise<Response> {
  return fetch(url, options);
}
