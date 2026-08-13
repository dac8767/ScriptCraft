// @vitest-environment jsdom
/**
 * v6.86 — the SIMPLE Feedback form (Derek: friends-only testing, no email
 * verification). These drive the form against a stubbed fetch: the
 * once-only profile card, what a submission actually POSTs (name + email
 * riding along, NO auth header — anonymous inserts under the table's
 * insert-only rule), and the visible local queue when the server is
 * unreachable.
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
    return json({}, 201);
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

const savedProfile = () => localStorage.setItem('opendraft:feedbackProfile',
  JSON.stringify({ name: 'Tester T', email: 'tester@example.com' }));

describe('FeedbackTool — the once-only profile', () => {
  it('asks name + email once, then shows the form sending as them', async () => {
    mount();
    expect(container.textContent).toContain('Tell the form who you are');
    setValue(byPlaceholder('Your name'), 'Tester T');
    setValue(byPlaceholder('you@example.com'), 'tester@example.com');
    clickText('Start');
    await flush();
    expect(container.textContent).toContain('Sending as');
    expect(container.textContent).toContain('Tester T');
    // saved — a remount skips straight to the form
    expect(JSON.parse(localStorage.getItem('opendraft:feedbackProfile')!))
      .toEqual({ name: 'Tester T', email: 'tester@example.com' });
    expect(calls).toHaveLength(0);                     // no network for identity
  });

  it('Edit reopens the card prefilled and updates the profile', async () => {
    savedProfile();
    mount();
    clickText('Edit');
    expect((byPlaceholder('Your name') as HTMLInputElement).value).toBe('Tester T');
    setValue(byPlaceholder('Your name'), 'Renamed');
    clickText('Start');
    await flush();
    expect(container.textContent).toContain('Renamed');
  });
});

describe('FeedbackTool — submitting', () => {
  it('POSTs name + email + message + version, anonymously (apikey only)', async () => {
    savedProfile();
    mount();
    setValue(byPlaceholder('Describe it'), 'The margins drift.');
    clickText('Send Feedback');
    await flush();
    const post = calls.find((c) => c.url.includes('/rest/v1/feedback'));
    expect(post).toBeTruthy();
    const body = JSON.parse(String(post!.init?.body));
    expect(body.name).toBe('Tester T');
    expect(body.email).toBe('tester@example.com');
    expect(body.message).toBe('The margins drift.');
    expect(typeof body.app_version).toBe('string');
    const headers = post!.init?.headers as Record<string, string>;
    expect(headers.apikey).toBe(FEEDBACK_BACKEND.publishableKey);
    expect(headers.Authorization).toBeUndefined();     // no auth — insert-only rule
    expect(container.textContent).toContain('Sent — thank you!');
  });

  it('a failed send lands in the VISIBLE queue, never the void', async () => {
    savedProfile();
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
