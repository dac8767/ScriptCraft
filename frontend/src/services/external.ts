/**
 * External links (v3.12) — ONE opener and ONE donate URL, shared by the Help
 * menu, the titlebar's donate button and the Notes link previews. Desktop
 * routes through Tauri's open_url command (default browser); web falls back
 * to window.open.
 */
import { isTauri } from './platform';

export const DONATE_URL = 'https://buymeacoffee.com/derektor';

export const openInBrowser = (url: string): void => {
  if (isTauri()) {
    void import('@tauri-apps/api/core').then(({ invoke }) => {
      invoke('open_url', { url }).catch((err: unknown) => console.error('Failed to open URL:', err));
    });
  } else {
    window.open(url, '_blank');
  }
};
