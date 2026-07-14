/**
 * windowMemory (v1.60) — Settings > General > "Remember last window size".
 *
 * The window launches maximized (tauri.conf.json). In 'remember' mode this
 * un-maximizes at startup and restores the saved bounds, then keeps saving
 * them (debounced) on resize/move — but never while maximized, so a
 * maximize doesn't overwrite the remembered floating size.
 */
import { isTauri } from './platform';
import { useSettingsStore } from '../stores/settingsStore';

const KEY = 'opendraft:windowBounds';

interface Bounds { w: number; h: number; x?: number; y?: number }

export async function initWindowMemory(): Promise<void> {
  if (!isTauri()) return;
  try {
    const { getCurrentWindow, PhysicalSize, PhysicalPosition } = await import('@tauri-apps/api/window');
    const win = getCurrentWindow();

    if (useSettingsStore.getState().windowStartup === 'remember') {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
          const b = JSON.parse(raw) as Bounds;
          if (b && b.w >= 400 && b.h >= 300) {
            await win.unmaximize();
            await win.setSize(new PhysicalSize(Math.round(b.w), Math.round(b.h)));
            if (Number.isFinite(b.x) && Number.isFinite(b.y)) {
              await win.setPosition(new PhysicalPosition(Math.round(b.x!), Math.round(b.y!)));
            }
          }
        }
      } catch { /* malformed bounds — stay maximized */ }
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    const save = async () => {
      try {
        if (await win.isMaximized()) return;
        const size = await win.innerSize();
        const pos = await win.outerPosition();
        localStorage.setItem(KEY, JSON.stringify({ w: size.width, h: size.height, x: pos.x, y: pos.y }));
      } catch { /* ignore */ }
    };
    const debounced = () => { clearTimeout(timer); timer = setTimeout(() => { void save(); }, 400); };
    void win.onResized(debounced);
    void win.onMoved(debounced);
  } catch (err) {
    console.warn('[windowMemory] init failed:', err);
  }
}
