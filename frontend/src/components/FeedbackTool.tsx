/**
 * FeedbackTool (v4.23 as an Airtable iframe; v6.84 native; v6.86 SIMPLE) —
 * Derek: "I do not need to verify emails. This is being tested with
 * friends only."
 *
 * The form asks name + email ONCE (a local tester profile, honor system,
 * editable any time) and every submission carries them — no codes, no
 * sign-in service, no SMTP. Submissions go to Derek's own Supabase table
 * through services/feedbackBackend; images attach via the labeled
 * Attachment area — capture the window or an area, or Browse… any image
 * file (v6.87, the first request submitted through the form itself). (The
 * v6.84 verified email-code sign-in lives in git history for the day the
 * app goes public.)
 *
 * Failure is never silent: a submit that can't reach the server lands in a
 * visible local queue with a Retry button.
 */
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { FaCamera, FaCrop, FaFolderOpen, FaPaperclip, FaTimes } from 'react-icons/fa';
import {
  type FeedbackProfile,
  loadFeedbackProfile, saveFeedbackProfile,
  submitFeedback, enqueueFeedback, loadFeedbackQueue, drainFeedbackQueue,
} from '../services/feedbackBackend';
import { captureToCanvas } from '../utils/screenshot';
import { showToast } from './Toast';

const CATEGORIES = ['Bug', 'Idea', 'Praise', 'Other'] as const;

interface Shot { blob: Blob; url: string; dataUrl: string; name: string }

async function canvasToShot(canvas: HTMLCanvasElement): Promise<Shot> {
  const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) throw new Error('Could not encode the image.');
  return { blob, url: URL.createObjectURL(blob), dataUrl: canvas.toDataURL('image/png'), name: 'Screenshot' };
}

/** Browse…: any image file from disk becomes the attachment, format kept. */
async function fileToShot(file: File): Promise<Shot> {
  if (!file.type.startsWith('image/')) throw new Error('Only image files can be attached here.');
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error('Could not read that file.'));
    r.readAsDataURL(file);
  });
  return { blob: file, url: URL.createObjectURL(file), dataUrl, name: file.name };
}

export default function FeedbackTool() {
  const [profile, setProfile] = useState<FeedbackProfile | null>(() => loadFeedbackProfile());
  const [editingProfile, setEditingProfile] = useState(false);
  const [nameDraft, setNameDraft] = useState(profile?.name ?? '');
  const [emailDraft, setEmailDraft] = useState(profile?.email ?? '');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('Bug');
  const [message, setMessage] = useState('');
  const [shot, setShot] = useState<Shot | null>(null);
  const [queued, setQueued] = useState(() => loadFeedbackQueue().length);
  const [sentNote, setSentNote] = useState<string | null>(null);

  useEffect(() => () => { if (shot) URL.revokeObjectURL(shot.url); }, [shot]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setNote(null);
    try { await fn(); } catch (e) {
      setNote(e instanceof Error ? e.message : 'Something went wrong — try again.');
    } finally { setBusy(false); }
  };

  const saveProfile = () => {
    const p = saveFeedbackProfile({ name: nameDraft, email: emailDraft });
    setProfile(p);
    setEditingProfile(false);
    setNote(null);
  };

  const capture = (mode: 'full' | 'area') => run(async () => {
    const canvas = await captureToCanvas(mode, 'fs-shot-veil-feedback');
    if (!canvas) return;                      // cancelled the area drag
    if (shot) URL.revokeObjectURL(shot.url);
    setShot(await canvasToShot(canvas));
  });

  const fileInput = useRef<HTMLInputElement>(null);
  const pickFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';                      // so the same file can be re-picked
    if (!file) return;
    run(async () => {
      const next = await fileToShot(file);
      if (shot) URL.revokeObjectURL(shot.url);
      setShot(next);
    });
  };

  const submit = () => run(async () => {
    const payload = { category, message: message.trim() };
    try {
      await submitFeedback(payload, shot?.blob ?? null);
      setMessage('');
      if (shot) { URL.revokeObjectURL(shot.url); setShot(null); }
      setSentNote('Sent — thank you!');
      window.setTimeout(() => setSentNote(null), 4000);
    } catch (e) {
      // Not silent, not lost: queue it where the writer can SEE it.
      const left = enqueueFeedback({ payload, shotDataUrl: shot?.dataUrl, queuedAt: new Date().toISOString() });
      setQueued(left);
      setMessage('');
      if (shot) { URL.revokeObjectURL(shot.url); setShot(null); }
      throw new Error(`Could not reach the feedback server — saved to the local queue instead (${left} waiting). ${e instanceof Error ? e.message : ''}`);
    }
  });

  const retryQueue = () => run(async () => {
    const { sent, left } = await drainFeedbackQueue();
    setQueued(left);
    if (sent > 0) showToast(`Sent ${sent} queued feedback item${sent === 1 ? '' : 's'}`, 'success');
    if (left > 0) throw new Error(`${left} still could not be sent — they stay in the queue.`);
  });

  /* ── first open (or Edit): the once-only profile card ── */
  if (!profile || editingProfile) {
    const canSave = nameDraft.trim().length > 0 && emailDraft.trim().length > 0;
    return (
      <div className="feedback-tool-wrap fb-signin">
        <h3 className="fb-title">Send Feedback</h3>
        <p className="fb-hint">
          Tell the form who you are — once. Your name and email ride along
          with every piece of feedback so Derek knows who sent it.
        </p>
        {note && <div className="fb-note">{note}</div>}
        <div className="fb-row">
          <input
            className="fb-input"
            placeholder="Your name"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
          />
        </div>
        <div className="fb-row">
          <input
            className="fb-input"
            type="email"
            placeholder="you@example.com"
            value={emailDraft}
            onChange={(e) => setEmailDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && canSave) saveProfile(); }}
          />
          <button className="dialog-btn dialog-btn-primary fb-go" disabled={!canSave} onClick={saveProfile}>
            Start
          </button>
          {profile && (
            <button className="dialog-btn fb-back" onClick={() => setEditingProfile(false)}>
              Cancel
            </button>
          )}
        </div>
      </div>
    );
  }

  /* ── the form ── */
  return (
    <div className="feedback-tool-wrap fb-form">
      <div className="fb-who">
        Sending as <strong>{profile.name}</strong>
        <span className="fb-who-mail"> ({profile.email})</span>
        <button
          className="fb-signout"
          title="Change the name or email on your feedback"
          onClick={() => { setNameDraft(profile.name); setEmailDraft(profile.email); setEditingProfile(true); }}
        >Edit</button>
      </div>

      {note && <div className="fb-note">{note}</div>}
      {sentNote && <div className="fb-sent">{sentNote}</div>}
      {queued > 0 && (
        <div className="fb-queued">
          {queued} feedback item{queued === 1 ? '' : 's'} waiting to send
          <button className="dialog-btn fb-retry" disabled={busy} onClick={retryQueue}>Retry now</button>
        </div>
      )}

      <label className="fb-label">
        Category
        <select className="fb-select" value={category} onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number])}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>

      <label className="fb-label fb-label-grow">
        What happened, or what should change?
        <textarea
          className="fb-text"
          placeholder="Describe it — steps, what you expected, what you got."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </label>

      <div className="fb-attach">
        <div className="fb-attach-head"><FaPaperclip aria-hidden /> Attachment</div>
        {!shot ? (
          <>
            <div className="fb-attach-btns">
              <button className="dialog-btn" disabled={busy} title="Attach a screenshot of the whole window" onClick={() => capture('full')}>
                <FaCamera aria-hidden /> Screenshot
              </button>
              <button className="dialog-btn" disabled={busy} title="Attach a screenshot of a selected area" onClick={() => capture('area')}>
                <FaCrop aria-hidden /> Area
              </button>
              <button className="dialog-btn" disabled={busy} title="Attach an image file from disk" onClick={() => fileInput.current?.click()}>
                <FaFolderOpen aria-hidden /> Browse…
              </button>
            </div>
            <div className="fb-attach-hint">A picture helps — grab the whole window, drag out an area, or pick an image file.</div>
          </>
        ) : (
          <span className="fb-shotchip">
            <img className="fb-shotthumb" src={shot.url} alt="Attached image" />
            <span className="fb-shotname">{shot.name}</span>
            <button
              className="fb-shot-x"
              title="Remove the attachment"
              onClick={() => { URL.revokeObjectURL(shot.url); setShot(null); }}
            ><FaTimes aria-hidden /></button>
          </span>
        )}
        <input ref={fileInput} className="fb-file" type="file" accept="image/*" onChange={pickFile} />
      </div>

      <div className="fb-shotrow">
        <span className="fb-spacer" />
        <button
          className="dialog-btn dialog-btn-primary fb-send"
          disabled={busy || !message.trim()}
          title="Send this feedback"
          onClick={submit}
        >{busy ? 'Sending…' : 'Send Feedback'}</button>
      </div>
    </div>
  );
}
