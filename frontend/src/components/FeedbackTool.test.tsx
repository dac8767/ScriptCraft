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
import FeedbackTool, { resetFeedbackDraft } from './FeedbackTool';
import { FEEDBACK_BACKEND, extFromType, loadFeedbackQueue } from '../services/feedbackBackend';

type Call = { url: string; init?: RequestInit };
let calls: Call[] = [];
let replies: Array<(url: string) => Response | null> = [];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  localStorage.clear();
  resetFeedbackDraft();
  calls = [];
  replies = [];
  vi.stubGlobal('fetch', vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url);
    if (!u.startsWith(FEEDBACK_BACKEND.url)) throw new Error(`unexpected fetch ${u}`);
    calls.push({ url: u, init });
    for (const r of replies) { const res = r(u); if (res) return res; }
    return json({}, 201);
  }));
  // jsdom lacks object URLs; the chip's <img> just needs A string
  Object.assign(URL, { createObjectURL: () => 'blob:fb-test', revokeObjectURL: () => {} });
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
    expect(body.attachments).toBeNull();               // v6.87 column — screenshot_path is gone
    expect('screenshot_path' in body).toBe(false);
    const headers = post!.init?.headers as Record<string, string>;
    expect(headers.apikey).toBe(FEEDBACK_BACKEND.publishableKey);
    expect(headers.Authorization).toBeUndefined();     // no auth — insert-only rule
    expect(container.querySelector('.fb-sent-veil')?.textContent)
      .toContain('Your feedback has been sent. Thank you!');
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

describe('FeedbackTool — the attachment area (v6.87)', () => {
  it('offers Screenshot, Area and Browse… under a labeled Attachment area', async () => {
    savedProfile();
    mount();
    expect(container.querySelector('.fb-attach-head')?.textContent).toContain('Attach an Image');
    const labels = [...container.querySelectorAll('.fb-attach-btns button')].map((b) => b.textContent?.trim());
    expect(labels).toEqual(['Screenshot', 'Area', 'Browse…']);
    expect(container.querySelector('.fb-attach input[type="file"]')).toBeTruthy();
  });

  it('a browsed image becomes the attachment and uploads in its REAL format', async () => {
    savedProfile();
    mount();
    const input = container.querySelector('.fb-attach input[type="file"]') as HTMLInputElement;
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'margin-bug.jpeg', { type: 'image/jpeg' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    act(() => { input.dispatchEvent(new Event('change', { bubbles: true })); });
    await flush(6);                                    // FileReader is async
    expect(container.querySelector('.fb-shotchip')?.textContent).toContain('margin-bug.jpeg');

    setValue(byPlaceholder('Describe it'), 'See the attached image.');
    clickText('Send Feedback');
    await flush(6);
    const up = calls.find((c) => c.url.includes('/storage/v1/object/feedback-shots/'));
    expect(up).toBeTruthy();
    expect(up!.url).toMatch(/\.jpg$/);
    expect((up!.init?.headers as Record<string, string>)['Content-Type']).toBe('image/jpeg');
    const post = calls.find((c) => c.url.includes('/rest/v1/feedback'));
    const body = JSON.parse(String(post!.init?.body));
    expect(typeof body.attachments).toBe('string');
    expect(up!.url.endsWith(body.attachments)).toBe(true);
    expect(container.querySelector('.fb-shotchip')).toBeNull();   // cleared after send
  });

  it('takes MORE than one attachment and the buttons stay (v6.89)', async () => {
    savedProfile();
    mount();
    const input = container.querySelector('.fb-attach input[type="file"]') as HTMLInputElement;
    expect(input.multiple).toBe(true);
    const one = new File([new Uint8Array([1])], 'one.jpeg', { type: 'image/jpeg' });
    Object.defineProperty(input, 'files', { value: [one], configurable: true });
    act(() => { input.dispatchEvent(new Event('change', { bubbles: true })); });
    await flush(6);
    // the three buttons are still there, and a second pick APPENDS
    const labels = [...container.querySelectorAll('.fb-attach-btns button')].map((b) => b.textContent?.trim());
    expect(labels).toEqual(['Screenshot', 'Area', 'Browse…']);
    const two = new File([new Uint8Array([2])], 'two.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { value: [two], configurable: true });
    act(() => { input.dispatchEvent(new Event('change', { bubbles: true })); });
    await flush(6);
    expect(container.querySelectorAll('.fb-shotchip')).toHaveLength(2);

    setValue(byPlaceholder('Describe it'), 'Two shots attached.');
    clickText('Send Feedback');
    await flush(6);
    const ups = calls.filter((c) => c.url.includes('/storage/v1/object/feedback-shots/'));
    expect(ups).toHaveLength(2);
    expect(ups[0].url).toMatch(/\.jpg$/);
    expect(ups[1].url).toMatch(/\.png$/);
    const post = calls.find((c) => c.url.includes('/rest/v1/feedback'));
    const body = JSON.parse(String(post!.init?.body));
    expect(body.attachments).toBe(ups.map((u) => u.url.split('/feedback-shots/')[1]).join(','));
    expect(container.querySelectorAll('.fb-shotchip')).toHaveLength(0);   // cleared after send
  });

  it('extFromType keeps the real format and falls back to png', () => {
    expect(extFromType('image/png')).toBe('png');
    expect(extFromType('image/jpeg')).toBe('jpg');
    expect(extFromType('image/webp')).toBe('webp');
    expect(extFromType('image/svg+xml')).toBe('svg');
    expect(extFromType('')).toBe('png');
    expect(extFromType('application/pdf')).toBe('png');
  });
});

describe('FeedbackTool — the draft survives moving the window (v6.88)', () => {
  it('remounting rehydrates message and attachment instead of wiping them', async () => {
    savedProfile();
    mount();
    setValue(byPlaceholder('Describe it'), 'Half-written thought.');
    const input = container.querySelector('.fb-attach input[type="file"]') as HTMLInputElement;
    const file = new File([new Uint8Array([1, 2, 3])], 'still-here.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    act(() => { input.dispatchEvent(new Event('change', { bubbles: true })); });
    await flush(6);
    expect(container.querySelector('.fb-shotchip')?.textContent).toContain('still-here.png');

    // the window moves hosts: unmount, fresh root, remount
    act(() => root.unmount());
    root = createRoot(container);
    mount();
    expect((byPlaceholder('Describe it') as HTMLTextAreaElement).value).toBe('Half-written thought.');
    expect(container.querySelector('.fb-shotchip')?.textContent).toContain('still-here.png');
  });
});
