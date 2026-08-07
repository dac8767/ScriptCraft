import { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';

/**
 * Image/media source for an asset with a self-healing fallback (v6.33).
 *
 * Starts from api.getAssetUrl — the backend HTTP URL in a browser, an
 * asset:// protocol URL on desktop. If that source ERRORS (the v6.31–v6.33
 * broken-thumbnail saga was the desktop protocol 404ing), the caller wires
 * `onError` to the media element and this hook re-reads the bytes through
 * the storage layer — the same fs road uploads use, proven — and serves a
 * blob: URL instead. If the bytes read ALSO fails, the file is genuinely
 * gone from disk and `missing` turns on so the UI can say so instead of
 * showing a broken-image glyph forever.
 */
export function useAssetDisplayUrl(
  projectId: string,
  assetId: string,
  filename?: string,
  mime?: string,
): { url: string; missing: boolean; onError: () => void } {
  const [url, setUrl] = useState<string>(() => api.getAssetUrl(projectId, assetId, filename));
  const [missing, setMissing] = useState(false);
  const blobRef = useRef<string | null>(null);

  useEffect(() => {
    setUrl(api.getAssetUrl(projectId, assetId, filename));
    setMissing(false);
    return () => {
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current);
        blobRef.current = null;
      }
    };
  }, [projectId, assetId, filename]);

  const onError = () => {
    if (blobRef.current) {
      // The blob fallback itself failed to render — treat as missing.
      setMissing(true);
      return;
    }
    void api
      .getAssetBytes(projectId, assetId)
      .then((bytes: Uint8Array) => {
        const blobUrl = URL.createObjectURL(
          new Blob([bytes as unknown as BlobPart], mime ? { type: mime } : undefined),
        );
        blobRef.current = blobUrl;
        setUrl(blobUrl);
      })
      .catch(() => setMissing(true));
  };

  return { url, missing, onError };
}
