/**
 * Feedback backend (v6.84, Derek) — the app's OWN feedback pipeline,
 * replacing the Airtable iframe embed. Plain fetch against Derek's Supabase
 * project: email-code sign-in (Supabase's OTP flow — no passwords, no
 * deep-link redirects, which WKWebView makes fragile), one INSERT into the
 * `feedback` table, and screenshot uploads to the private `feedback-shots`
 * bucket. Deliberately NOT the supabase-js SDK: the surface we use is three
 * endpoints, and a dependency would put session-refresh timers and bundle
 * weight between us and them.
 *
 * SECURITY: the publishable key below is DESIGNED to ship in the app
 * (Supabase's replacement for the legacy anon key). What protects the data
 * is Row Level Security on the table: signed-in testers can INSERT rows
 * whose user_id is their own — nothing else. Derek reads submissions in the
 * Supabase dashboard. The secret key never appears anywhere in this repo.
 *
 * Failure is never silent: submit errors throw with a plain-words message,
 * and the form queues the submission locally for retry (the queue helpers
 * live here so they can be unit-tested).
 */
import { isTauri } from './platform';
import { APP_VERSION } from '../data/changelog';

export const FEEDBACK_BACKEND = {
  url: 'https://agfdfkpoxnmmisifbrdj.supabase.co',
  publishableKey: 'sb_publishable_7scoOBRcdzyGS8YVIVCtVA_Z1i5X4cA',
} as const;

const SESSION_KEY = 'opendraft:feedbackSession';
const QUEUE_KEY = 'opendraft:feedbackQueue';
/** Refresh when this close to expiry — a submit must never race the clock. */
const REFRESH_MARGIN_S = 120;
export const FEEDBACK_QUEUE_MAX = 10;

export interface FeedbackSession {
  accessToken: string;
  refreshToken: string;
  /** epoch seconds */
  expiresAt: number;
  userId: string;
  email: string;
  name: string | null;
}

export interface FeedbackPayload {
  category: string;
  message: string;
}

export interface QueuedFeedback {
  payload: FeedbackPayload;
  /** data: URL of the PNG, so a queued screenshot survives a restart */
  shotDataUrl?: string;
  queuedAt: string;
}

/** Plain-words error the form shows verbatim. */
export class FeedbackError extends Error {}
/** The session is gone (refresh failed / signed out) — the form returns to
 *  the sign-in step and says so. */
export class SignedOutError extends FeedbackError {
  constructor() { super('Your sign-in expired. Enter your email to sign in again.'); }
}

// ── session persistence ────────────────────────────────────────────────────

export function loadFeedbackSession(): FeedbackSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as FeedbackSession;
    return s && s.accessToken && s.refreshToken && s.userId ? s : null;
  } catch { return null; }
}
function saveSession(s: FeedbackSession | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch { /* quota — the session just won't survive a restart */ }
}
export function signOutFeedback(): void { saveSession(null); }

// ── transport ──────────────────────────────────────────────────────────────
// fetch is resolved at CALL time so the browser checks can stub
// window.fetch; nothing here captures a reference at import.

const base = () => FEEDBACK_BACKEND.url;
const keyHeaders = () => ({ apikey: FEEDBACK_BACKEND.publishableKey });

async function readError(res: Response, fallback: string): Promise<never> {
  let msg = fallback;
  try {
    const body = await res.json() as Record<string, unknown>;
    const m = body.error_description ?? body.msg ?? body.message ?? body.error;
    if (typeof m === 'string' && m) msg = m;
  } catch { /* non-JSON error body */ }
  throw new FeedbackError(msg);
}

// ── auth: email code (Supabase OTP) ────────────────────────────────────────

/** Ask Supabase to email a 6-digit code (creates the account on first use). */
export async function requestFeedbackCode(email: string): Promise<void> {
  const res = await fetch(`${base()}/auth/v1/otp`, {
    method: 'POST',
    headers: { ...keyHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, create_user: true }),
  });
  if (!res.ok) await readError(res, 'Could not send the code. Check the email address and try again.');
}

interface AuthTokenResponse {
  access_token: string; refresh_token: string; expires_in: number;
  user?: { id?: string; email?: string; user_metadata?: { name?: unknown } };
}
function sessionFrom(body: AuthTokenResponse, fallbackEmail: string, fallbackName: string | null): FeedbackSession {
  const name = body.user?.user_metadata?.name;
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: Math.floor(Date.now() / 1000) + (body.expires_in ?? 3600),
    userId: body.user?.id ?? '',
    email: body.user?.email ?? fallbackEmail,
    name: typeof name === 'string' && name.trim() ? name : fallbackName,
  };
}

/** Trade the emailed 6-digit code for a session. */
export async function verifyFeedbackCode(email: string, code: string): Promise<FeedbackSession> {
  const res = await fetch(`${base()}/auth/v1/verify`, {
    method: 'POST',
    headers: { ...keyHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'email', email, token: code.trim() }),
  });
  if (!res.ok) await readError(res, 'That code did not work. Codes expire quickly — request a fresh one.');
  const session = sessionFrom(await res.json() as AuthTokenResponse, email, null);
  if (!session.userId) throw new FeedbackError('Sign-in answered without a user id — try again.');
  saveSession(session);
  return session;
}

/** Pure decision — exported for tests. */
export function sessionNeedsRefresh(s: FeedbackSession, nowEpochS: number): boolean {
  return s.expiresAt - nowEpochS < REFRESH_MARGIN_S;
}

async function ensureFreshSession(): Promise<FeedbackSession> {
  const s = loadFeedbackSession();
  if (!s) throw new SignedOutError();
  if (!sessionNeedsRefresh(s, Math.floor(Date.now() / 1000))) return s;
  const res = await fetch(`${base()}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { ...keyHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: s.refreshToken }),
  });
  if (!res.ok) { saveSession(null); throw new SignedOutError(); }
  const fresh = sessionFrom(await res.json() as AuthTokenResponse, s.email, s.name);
  if (!fresh.userId) fresh.userId = s.userId;
  saveSession(fresh);
  return fresh;
}

/** First sign-in asks the tester's display name once; it lives in Supabase
 *  user metadata (so every device knows it) and in the saved session. */
export async function setFeedbackDisplayName(name: string): Promise<FeedbackSession> {
  const s = await ensureFreshSession();
  const res = await fetch(`${base()}/auth/v1/user`, {
    method: 'PUT',
    headers: { ...keyHeaders(), 'Content-Type': 'application/json', Authorization: `Bearer ${s.accessToken}` },
    body: JSON.stringify({ data: { name } }),
  });
  if (!res.ok) await readError(res, 'Could not save the name.');
  const next = { ...s, name };
  saveSession(next);
  return next;
}

// ── the submission ─────────────────────────────────────────────────────────

const platformLabel = () => (isTauri() ? 'desktop' : 'browser');

/** Upload the screenshot, then insert the row. Throws FeedbackError /
 *  SignedOutError with a message the form can show verbatim. */
export async function submitFeedback(payload: FeedbackPayload, shot?: Blob | null): Promise<void> {
  const s = await ensureFreshSession();

  let screenshotPath: string | null = null;
  if (shot) {
    screenshotPath = `${s.userId}/${Date.now()}.png`;
    const up = await fetch(`${base()}/storage/v1/object/feedback-shots/${screenshotPath}`, {
      method: 'POST',
      headers: { ...keyHeaders(), 'Content-Type': 'image/png', Authorization: `Bearer ${s.accessToken}` },
      body: shot,
    });
    if (!up.ok) await readError(up, 'The screenshot upload failed. Check the feedback-shots bucket exists (private, authenticated insert).');
  }

  const res = await fetch(`${base()}/rest/v1/feedback`, {
    method: 'POST',
    headers: {
      ...keyHeaders(),
      'Content-Type': 'application/json',
      Authorization: `Bearer ${s.accessToken}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      user_id: s.userId,
      name: s.name,
      email: s.email,
      category: payload.category,
      message: payload.message,
      app_version: APP_VERSION,
      platform: platformLabel(),
      screenshot_path: screenshotPath,
    }),
  });
  if (!res.ok) await readError(res, 'The feedback table did not accept the submission. Check the table and its insert policy exist.');
}

// ── the offline / failure queue ────────────────────────────────────────────

/** Pure — exported for tests. Oldest entries fall off past the cap. */
export function capQueue<T>(list: T[], max: number = FEEDBACK_QUEUE_MAX): T[] {
  return list.length <= max ? list : list.slice(list.length - max);
}

export function loadFeedbackQueue(): QueuedFeedback[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}
function saveQueue(q: QueuedFeedback[]) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(capQueue(q))); } catch { /* quota */ }
}

export function enqueueFeedback(entry: QueuedFeedback): number {
  const q = [...loadFeedbackQueue(), entry];
  saveQueue(q);
  return Math.min(q.length, FEEDBACK_QUEUE_MAX);
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

/** Send everything queued; keep what still fails. Returns the counts the
 *  form reports. A SignedOutError stops the drain (nothing else can send). */
export async function drainFeedbackQueue(): Promise<{ sent: number; left: number }> {
  const q = loadFeedbackQueue();
  const still: QueuedFeedback[] = [];
  let sent = 0;
  for (const entry of q) {
    try {
      const shot = entry.shotDataUrl ? await dataUrlToBlob(entry.shotDataUrl) : null;
      await submitFeedback(entry.payload, shot);
      sent++;
    } catch (e) {
      still.push(entry);
      if (e instanceof SignedOutError) { still.push(...q.slice(q.indexOf(entry) + 1)); break; }
    }
  }
  saveQueue(still);
  return { sent, left: still.length };
}
