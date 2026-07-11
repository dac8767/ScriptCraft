/**
 * Cached demo-mode flag from the backend.
 *
 * The backend returns `demo: true` from /api/demo-info only when the DEMO_MODE
 * env var is set. Before we relied on string-matching the collab server URL
 * against a specific Cloud Run instance, which false-positived whenever a
 * user's settings still pointed at that URL — even in normal mode.
 *
 * The flag is fetched once per page load and cached. Callers that need it
 * synchronously (e.g. during render) should read `isDemoMode()` after the
 * module has been initialized via `initDemoInfo()`.
 */

import { api, type DemoInfo } from './api';
import { getApiBase } from '../config';

let cached: DemoInfo | null = null;
let pending: Promise<DemoInfo> | null = null;

export async function initDemoInfo(): Promise<DemoInfo> {
  if (cached) return cached;
  if (pending) return pending;
  // No cloud backend configured (desktop running offline on local SQLite) —
  // skip the probe entirely rather than firing a startup request at whatever
  // host happens to be defaulted. Demo mode is a hosted-backend concept.
  if (!getApiBase()) {
    cached = { demo: false, message: null };
    return cached;
  }
  pending = api.getDemoInfo()
    .then((info) => { cached = info; return info; })
    .catch(() => {
      const fallback: DemoInfo = { demo: false, message: null };
      cached = fallback;
      return fallback;
    })
    .finally(() => { pending = null; });
  return pending;
}

export function isDemoMode(): boolean {
  return Boolean(cached?.demo);
}

export function demoMessage(): string | null {
  return cached?.message ?? null;
}
