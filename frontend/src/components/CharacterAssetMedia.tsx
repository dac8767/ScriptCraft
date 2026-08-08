import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../services/api';

/** v4.22, Derek: asset images are served from an AUTHENTICATED endpoint, so a
 *  plain <img src> gets a 401 and shows the broken-image "?". Fetch the bytes
 *  with the auth token and hand the <img> a blob URL instead.
 *  v4.30 batch-v7 #1, Derek: stepping a slideshow used to clear the url while
 *  the next image loaded — one frame of grey placeholder, with the 1/2 count
 *  flashing in the middle. The PREVIOUS image now stays up until the new one
 *  is ready; the old blob URL is revoked only after the swap. */
export const AssetImage: React.FC<{
  projectId: string; assetId: string; className?: string; alt?: string;
  onClick?: (e: React.MouseEvent) => void;
  /** v5.76: the loaded <img>, for callers that need its natural size (the
   *  Locations map fits its pin stage to the image's aspect ratio). */
  onLoad?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
  /** v5.76: told when the bytes can't be read, so a caller can show its own
   *  message instead of this component's one-character "!" box. */
  onFailed?: () => void;
}> = ({ projectId, assetId, className, alt, onClick, onLoad, onFailed }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const objRef = useRef<string | null>(null);
  /* v6.38: onFailed was an effect dependency, and callers pass inline
     arrows — so EVERY parent re-render re-fetched the bytes (the Locations
     map re-renders on rotate, ghost-pin moves…), and any transient failure
     re-branded a working image broken. The callback rides a ref; the fetch
     runs only when the asset actually changes. */
  const onFailedRef = useRef(onFailed);
  onFailedRef.current = onFailed;
  useEffect(() => {
    let dead = false;
    setFailed(false);
    (async () => {
      try {
        // Load raw bytes and build a blob URL. This works on every backend;
        // fetching getAssetUrl directly does not, because on desktop that URL
        // is an asset:// path the webview can only load via <img src>.
        const bytes = await api.getAssetBytes(projectId, assetId);
        const obj = URL.createObjectURL(new Blob([bytes as BlobPart]));
        if (dead) { URL.revokeObjectURL(obj); return; }
        if (objRef.current) URL.revokeObjectURL(objRef.current);
        objRef.current = obj;
        setUrl(obj);
      } catch {
        if (!dead) { setFailed(true); onFailedRef.current?.(); }
      }
    })();
    return () => { dead = true; };
  }, [projectId, assetId]);
  // Revoke the last blob URL only when the component leaves for good.
  useEffect(() => () => { if (objRef.current) URL.revokeObjectURL(objRef.current); }, []);
  if (failed) return <div className={`char-profile-image-broken ${className ?? ''}`} title="Image unavailable">!</div>;
  if (!url) return <div className={`char-profile-image-loading ${className ?? ''}`} />;
  return <img src={url} className={className} alt={alt} onClick={onClick} onLoad={onLoad} />;
};

/** v4.26 batch-v5 #3, Derek: the image (or its placeholder) IS the upload
 *  control now — this is the shared source menu it opens, portalled to <body>
 *  and positioned by the caller from the clicked element (panels clip
 *  absolutely-positioned children — see AddMenu). With an image present the
 *  caller passes onRemove and the menu gains "Remove Image". Replaces the
 *  v4.22 "Upload Image ▾" row button. */
export const ImageSourceMenu: React.FC<{
  pos: { top: number; left: number };
  onLocal: () => void;
  /** v4.73: optional — the Title Page offers assets only when a project is
   *  open; absent hides the row rather than shipping a dead menu item. */
  onAssets?: () => void;
  onRemove?: () => void;
  onClose: () => void;
}> = ({ pos, onLocal, onAssets, onRemove, onClose }) => {
  useEffect(() => {
    // The opening click can itself emit a scroll a frame later (focus scroll /
    // scroll anchoring in the character list) — without a grace window that
    // closed the menu the same frame it opened. Genuine user scrolling still
    // dismisses it.
    const openedAt = performance.now();
    const close = () => onClose();
    const closeOnScroll = () => { if (performance.now() - openedAt > 150) onClose(); };
    window.addEventListener('pointerdown', close);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', closeOnScroll, true);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', closeOnScroll, true);
    };
  }, [onClose]);
  return createPortal(
    <div className="char-upload-menu" style={{ top: pos.top, left: pos.left }} onPointerDown={(e) => e.stopPropagation()}>
      <button className="char-upload-menu-item" onClick={() => { onClose(); onLocal(); }}>From local device…</button>
      {onAssets && (
        <button className="char-upload-menu-item" onClick={() => { onClose(); onAssets(); }}>From Asset Manager…</button>
      )}
      {onRemove && (
        <button className="char-upload-menu-item" onClick={() => { onClose(); onRemove(); }}>Remove Image</button>
      )}
    </div>,
    document.body,
  );
};
