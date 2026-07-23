import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../services/api';

/** v4.22, Derek: asset images are served from an AUTHENTICATED endpoint, so a
 *  plain <img src> gets a 401 and shows the broken-image "?". Fetch the bytes
 *  with the auth token and hand the <img> a blob URL instead. */
export const AssetImage: React.FC<{
  projectId: string; assetId: string; className?: string; alt?: string; onClick?: () => void;
}> = ({ projectId, assetId, className, alt, onClick }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let dead = false;
    let obj: string | null = null;
    setUrl(null); setFailed(false);
    (async () => {
      try {
        // Load raw bytes and build a blob URL. This works on every backend;
        // fetching getAssetUrl directly does not, because on desktop that URL
        // is an asset:// path the webview can only load via <img src>.
        const bytes = await api.getAssetBytes(projectId, assetId);
        obj = URL.createObjectURL(new Blob([bytes as BlobPart]));
        if (!dead) setUrl(obj); else URL.revokeObjectURL(obj);
      } catch {
        if (!dead) setFailed(true);
      }
    })();
    return () => { dead = true; if (obj) URL.revokeObjectURL(obj); };
  }, [projectId, assetId]);
  if (failed) return <div className={`char-profile-image-broken ${className ?? ''}`} title="Image unavailable">!</div>;
  if (!url) return <div className={`char-profile-image-loading ${className ?? ''}`} />;
  return <img src={url} className={className} alt={alt} onClick={onClick} />;
};

/** v4.23, Derek: play an uploaded voice-reference clip. Loads bytes → blob URL
 *  (same reason as AssetImage — the desktop asset URL can't be fetched), then
 *  hands it to a native <audio> element. */
export const AssetAudio: React.FC<{ projectId: string; assetId: string }> = ({ projectId, assetId }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let dead = false;
    let obj: string | null = null;
    setUrl(null); setFailed(false);
    (async () => {
      try {
        const bytes = await api.getAssetBytes(projectId, assetId);
        obj = URL.createObjectURL(new Blob([bytes as BlobPart]));
        if (!dead) setUrl(obj); else URL.revokeObjectURL(obj);
      } catch {
        if (!dead) setFailed(true);
      }
    })();
    return () => { dead = true; if (obj) URL.revokeObjectURL(obj); };
  }, [projectId, assetId]);
  if (failed) return <span className="char-profile-voice-broken" title="Audio unavailable">Voice clip unavailable</span>;
  if (!url) return <span className="char-profile-voice-loading">Loading…</span>;
  return <audio className="char-profile-voice-audio" src={url} controls preload="none" />;
};

/** v4.22, Derek: one "Upload Image" button that opens a menu — local file or the
 *  Asset Manager. The menu is portalled to <body> and positioned from the button
 *  (panels clip absolutely-positioned children — see AddMenu). */
export const UploadImageButton: React.FC<{ uploading: boolean; onLocal: () => void; onAssets: () => void }> = ({ uploading, onLocal, onAssets }) => {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    window.addEventListener('pointerdown', close);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [pos]);
  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (pos) { setPos(null); return; }
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, left: r.left });
  };
  return (
    <>
      <button
        ref={btnRef}
        className="char-profile-img-btn"
        disabled={uploading}
        onClick={toggle}
        title="Add a character image"
      >
        {uploading ? 'Uploading…' : 'Upload Image ▾'}
      </button>
      {pos && createPortal(
        <div className="char-upload-menu" style={{ top: pos.top, left: pos.left }} onPointerDown={(e) => e.stopPropagation()}>
          <button className="char-upload-menu-item" onClick={() => { setPos(null); onLocal(); }}>From local device…</button>
          <button className="char-upload-menu-item" onClick={() => { setPos(null); onAssets(); }}>From Asset Manager…</button>
        </div>,
        document.body,
      )}
    </>
  );
};
