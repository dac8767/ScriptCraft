/**
 * Feedback backend (v6.84 with email-code sign-in; v6.86 SIMPLIFIED) —
 * Derek: "I do not need to verify emails. This is being tested with
 * friends only."
 *
 * The app's OWN feedback pipeline, replacing the Airtable iframe embed:
 * plain fetch against Derek's Supabase project. Identity is a TESTER
 * PROFILE — name + email typed once, kept locally, attached to every
 * submission — no codes, no sign-in service, no SMTP. (The v6.84 verified
 * sign-in lives in git history; if the app ever goes public, it returns
 * and only the gate in front of the form changes.)
 *
 * SECURITY: the publishable key below is DESIGNED to ship in the app
 * (Supabase's replacement for the legacy anon key). The table's rules
 * allow INSERT only — nobody can read or edit rows through the app; Derek
 * reads submissions in the Supabase dashboard. The secret key never
 * appears anywhere in this repo.
 *
 * Failure is never silent: submit errors throw with a plain-words message,
 * and the form queues the submission locally for retry (the queue helpers
 * live here so they can be unit-tested).
 *
 * v6.87 (the first request submitted through the form itself): the table's
 * `attachments` column replaces `screenshot_path`, and Browse… means an
 * attachment can be any image file — so the upload keeps the file's real
 * format instead of assuming PNG. The table also gained a `status` column
 * (Pending / In Progress / Complete); that is Derek's triage state, edited
 * in the dashboard — the app never writes it. v6.89: MULTIPLE attachments
 * — each uploads separately and `attachments` holds the paths
 * comma-joined (generated names never contain commas).
 */
import { isTauri } from './platform';
import { APP_VERSION } from '../data/changelog';

export const FEEDBACK_BACKEND = {
  url: 'https://agfdfkpoxnmmisifbrdj.supabase.co',
  publishableKey: 'sb_publishable_7scoOBRcdzyGS8YVIVCtVA_Z1i5X4cA',
} as const;

const PROFILE_KEY = 'opendraft:feedbackProfile';
const QUEUE_KEY = 'opendraft:feedbackQueue';
export const FEEDBACK_QUEUE_MAX = 10;

/** Who is sending — typed once, editable any time, honor system. */
export interface FeedbackProfile {
  name: string;
  email: string;
}

export interface FeedbackPayload {
  category: string;
  message: string;
}

export interface QueuedFeedback {
  payload: FeedbackPayload;
  /** data: URLs of the images, so queued attachments survive a restart */
  shotDataUrls?: string[];
  /** pre-v6.89 single-attachment entries — still drained */
  shotDataUrl?: string;
  queuedAt: string;
}

/** Plain-words error the form shows verbatim. */
export class FeedbackError extends Error {}

// ── the tester profile ─────────────────────────────────────────────────────

export function loadFeedbackProfile(): FeedbackProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as FeedbackProfile;
    return p && typeof p.name === 'string' && p.name.trim() && typeof p.email === 'string'
      ? { name: p.name.trim(), email: p.email.trim() } : null;
  } catch { return null; }
}

export function saveFeedbackProfile(p: FeedbackProfile): FeedbackProfile {
  const clean = { name: p.name.trim(), email: p.email.trim() };
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(clean)); } catch { /* quota */ }
  return clean;
}

// ── transport ──────────────────────────────────────────────────────────────
// fetch is resolved at CALL time so tests and checks can stub window.fetch;
// nothing here captures a reference at import.

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

// ── the submission ─────────────────────────────────────────────────────────

const platformLabel = () => (isTauri() ? 'desktop' : 'browser');

/** Storage-path extension from the blob's MIME type. Pure — exported for
 *  tests. Captures are PNG; Browse… can hand us jpeg/webp/anything. */
export function extFromType(type: string): string {
  const sub = /^image\/([a-z0-9.+-]+)$/i.exec(type)?.[1]?.toLowerCase() ?? '';
  if (sub === 'jpeg') return 'jpg';
  if (sub === 'svg+xml') return 'svg';
  return sub.replace(/[^a-z0-9]/g, '') || 'png';
}

/** Upload every attachment, then insert the row. Throws FeedbackError with
 *  a message the form can show verbatim. Requires a saved profile. */
export async function submitFeedback(payload: FeedbackPayload, shots?: Blob[] | null): Promise<void> {
  const profile = loadFeedbackProfile();
  if (!profile) throw new FeedbackError('Add your name and email first — the form asks once.');

  const paths: string[] = [];
  for (const shot of shots ?? []) {
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extFromType(shot.type)}`;
    const up = await fetch(`${base()}/storage/v1/object/feedback-shots/${path}`, {
      method: 'POST',
      headers: { ...keyHeaders(), 'Content-Type': shot.type || 'image/png' },
      body: shot,
    });
    if (!up.ok) await readError(up, 'The image upload failed — check the feedback-shots bucket allows uploads.');
    paths.push(path);
  }

  const res = await fetch(`${base()}/rest/v1/feedback`, {
    method: 'POST',
    headers: { ...keyHeaders(), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({
      name: profile.name,
      email: profile.email,
      category: payload.category,
      message: payload.message,
      app_version: APP_VERSION,
      platform: platformLabel(),
      attachments: paths.length ? paths.join(',') : null,
    }),
  });
  if (!res.ok) await readError(res, 'The feedback table did not accept the submission — check its insert rule allows anonymous submissions.');
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
 *  form reports. */
export async function drainFeedbackQueue(): Promise<{ sent: number; left: number }> {
  const q = loadFeedbackQueue();
  const still: QueuedFeedback[] = [];
  let sent = 0;
  for (const entry of q) {
    try {
      const urls = entry.shotDataUrls ?? (entry.shotDataUrl ? [entry.shotDataUrl] : []);
      await submitFeedback(entry.payload, await Promise.all(urls.map(dataUrlToBlob)));
      sent++;
    } catch {
      still.push(entry);
    }
  }
  saveQueue(still);
  return { sent, left: still.length };
}
