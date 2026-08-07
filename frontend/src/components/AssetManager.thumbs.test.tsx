// @vitest-environment jsdom
/**
 * Asset list thumbnails (v6.30, Derek: "show a preview of the image in the
 * asset manager") — image assets render a real <img> thumbnail in the list
 * (same click-to-preview as the name); every other type keeps its mime icon.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import AssetManager from './AssetManager';
import { useAssetStore } from '../stores/assetStore';

const { IMG, PDF } = vi.hoisted(() => ({
  IMG: {
    id: 'a1', filename: 'still.png', original_name: 'still.png',
    mime_type: 'image/png', size_bytes: 1234, tags: [] as string[],
  },
  PDF: {
    id: 'a2', filename: 'notes.pdf', original_name: 'notes.pdf',
    mime_type: 'application/pdf', size_bytes: 5678, tags: [] as string[],
  },
}));

vi.mock('../services/api', () => ({
  api: {
    // the component re-fetches on mount — the MOCK must serve the fixtures,
    // or the fetch overwrites whatever the test seeded into the store.
    listAssets: vi.fn(async () => [IMG, PDF]),
    getAssetUrl: (p: string, id: string, f: string) => `http://test/assets/${p}/${id}/${f}`,
  },
}));

let host: HTMLElement | null = null;
afterEach(() => { host?.remove(); host = null; });

describe('AssetManager thumbnails', () => {
  it('images get an <img> thumbnail; other types keep the mime icon', async () => {
    useAssetStore.setState({ assets: [] as never });
    host = document.createElement('div');
    document.body.appendChild(host);
    await act(async () => {
      createRoot(host!).render(<AssetManager projectId="p1" embedded />);
    });
    const thumbs = host.querySelectorAll('img.asset-thumb');
    expect(thumbs.length).toBe(1);
    expect((thumbs[0] as HTMLImageElement).src).toBe('http://test/assets/p1/a1/still.png');
    // the pdf row keeps an icon cell without a thumbnail
    const rows = host.querySelectorAll('.asset-row');
    expect(rows.length).toBe(2);
    expect(rows[1].querySelector('img.asset-thumb')).toBeNull();
    expect(rows[1].querySelector('.asset-cell-icon span')).not.toBeNull();
  });
});
