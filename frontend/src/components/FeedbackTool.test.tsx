// @vitest-environment jsdom
/**
 * v6.84 — the NATIVE Feedback form (the Airtable iframe and its v4.70
 * screenshot chip are gone). These drive the form against a stubbed fetch:
 * the sign-in steps, what a submission actually POSTs, and the visible
 * local queue when the server is unreachable. The REAL network path is
 * proven by Derek's first sign-in on the desktop (the sandbox cannot reach
 * Supabase) — what these pin is that every request the form makes is the
 * one the backend contract expects.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import FeedbackTool from './FeedbackTool';
import { FEEDBACK_BACKEND, loadFeedbackQueue } from '../services/feedbackBackend';

type Call = { url: string; init?: RequestInit };
let calls: Call[] = [];
let replies: Array<(url: string) => Response | null> = [];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const sessionBody = () => ({
  access_token: 'at-1', refresh_token: 'rt-1', expires_in: 3600,
  user: { id: 'user-1', email: 'tester@example.com', user_metadata: {} },
});

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  localStorage.clear();
  calls = [];
  replies = [];
  vi.stubGlobal('fetch', vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url);
    if (!u.startsWith(FEEDBACK_BACKEND.url)) throw new Error(`unexpected fetch ${u}`);
    calls.push({ url: u, init });
    for (const r of replies) { const res = r(u); if (res) return res; }
    return json({});
  }));
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const mount = () => act(() => { root.render(<FeedbackTool />); });
/** Let pending promises resolve and React re-render. */
const flush = async (rounds = 4) => {
  for (let i = 0; i < rounds; i++) {
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  }
};
const byPlaceholder = (p: string) => {
  const el = [...container.querySelectorAll('input, textarea')]
    .find((e) => (e as HTMLInputElement).placeholder.includes(p)) as HTMLInputElement | HTMLTextAreaElement | undefined;
  if (!el) throw new Error(`no field with placeholder "${p}"`);
  return el;
};
const clickText = (t: string) => {
  const b = [...container.querySelectorAll('button')].find((x) => x.textContent?.trim() === t);
  if (!b) throw new Error(`no button "${t}"`);
  act(() => b.click());
};
const setValue = (el: HTMLInputElement | HTMLTextAreaElement, value: string) => act(() => {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
});

const signedInSession = () => localStorage.setItem('opendraft:feedbackSession', JSON.stringify({
  accessToken: 'at-1', refreshToken: 'rt-1',
  expiresAt: Math.floor(Date.now() / 1000) + 3600,
  userId: 'user-1', email: 'tester@example.com', name: 'Tester T',
}));

describe('FeedbackTool — sign-in', () => {
  it('walks email → code → name, hitting the OTP endpoints', async () => {
    replies.push((u) => (u.includes('/auth/v1/verify') ? json(sessionBody()) : null));
    mount();

    setValue(byPlaceholder('you@example.com'), 'tester@example.com');
    clickText('Send code');
    await flush();
    const otp = calls.find((c) => c.url.includes('/auth/v1/otp'));
    expect(otp).toBeTruthy();
    expect(JSON.parse(String(otp!.init?.body))).toEqual({ email: 'tester@example.com', create_user: true });

    setValue(byPlaceholder('6-digit code'), '123456');
    clickText('Verify');
    await flush();
    expect(JSON.parse(String(calls.find((c) => c.url.includes('/auth/v1/verify'))!.init?.body)))
      .toEqual({ type: 'email', email: 'tester@example.com', token: '123456' });

    // no name in metadata yet → the name step, saved via PUT /auth/v1/user
    setValue(byPlaceholder('Your name'), 'Tester T');
    clickText('Save name');
    await flush();
    expect(calls.some((c) => c.url.includes('/auth/v1/user') && c.init?.method === 'PUT')).toBe(true);
    expect(container.textContent).toContain('Tester T');
  });
});

describe('FeedbackTool — submitting', () => {
  it('POSTs the row RLS expects: user_id + name + message + version', async () => {
    signedInSession();
    mount();
    setValue(byPlaceholder('Describe it'), 'The margins drift.');
    clickText('Send Feedback');
    await flush();
    const post = calls.find((c) => c.url.includes('/rest/v1/feedback'));
    expect(post).toBeTruthy();
    const body = JSON.parse(String(post!.init?.body));
    expect(body.user_id).toBe('user-1');                 // RLS: auth.uid() = user_id
    expect(body.name).toBe('Tester T');
    expect(body.email).toBe('tester@example.com');
    expect(body.message).toBe('The margins drift.');
    expect(typeof body.app_version).toBe('string');
    const headers = post!.init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer at-1');
    expect(headers.apikey).toBe(FEEDBACK_BACKEND.publishableKey);
    expect(container.textContent).toContain('Sent — thank you!');
  });

  it('a failed send lands in the VISIBLE queue, never the void', async () => {
    signedInSession();
    replies.push((u) => (u.includes('/rest/v1/feedback') ? json({ message: 'server down' }, 503) : null));
    mount();
    setValue(byPlaceholder('Describe it'), 'Lost words?');
    clickText('Send Feedback');
    await flush();
    expect(container.textContent).toContain('saved to the local queue');
    expect(loadFeedbackQueue()).toHaveLength(1);
    expect(loadFeedbackQueue()[0].payload.message).toBe('Lost words?');
    expect(container.textContent).toContain('1 feedback item waiting to send');

    // the server comes back — Retry drains it
    replies.length = 0;
    clickText('Retry now');
    await flush();
    expect(loadFeedbackQueue()).toHaveLength(0);
  });
});
