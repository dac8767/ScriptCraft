/**
 * useFileAssociation — how a file reaches the app from OUTSIDE it: a
 * double-clicked .odraft, "Open with" on Android, a cold-start argument
 * (v5.88, lifted verbatim out of ScreenplayEditor).
 *
 * The split is plumbing vs meaning. This owns HOW a path arrives — the
 * window-scoped Tauri listener, the cold-start poll, the Android new-intent
 * check on foreground, and the de-duplication that keeps one file from being
 * opened twice by two of those routes at once. The caller owns WHAT to do
 * with the path, because that is editor work, not delivery work.
 *
 * Three things here look redundant and are not, which is why they are moved
 * verbatim rather than tidied:
 *  - the listener is window-SCOPED (emit_to(label)), so a second open window
 *    does not have its content replaced;
 *  - the launch poll retries five times over ~3s, because on a cold start
 *    RunEvent::Opened can fire after the WebView has loaded;
 *  - the visibilitychange re-check exists because on mobile warm start the
 *    JS event does not reliably arrive at all.
 */
import { useEffect } from 'react';
import { showToast } from '../components/Toast';

export function useFileAssociation(ready: boolean, onFile: (path: string) => void) {
    useEffect(() => {
      if (!ready) return;

      let cancelled = false;
      let unlistenFn: (() => void) | null = null;
      let handledPath: string | null = null;
      let pollTimer: ReturnType<typeof setTimeout> | null = null;
      let invokeRef: ((cmd: string) => Promise<string | null>) | null = null;

      (async () => {
        const { isTauri } = await import('../services/platform');
        if (!isTauri() || cancelled) return;

        const { invoke } = await import('@tauri-apps/api/core');
        invokeRef = (cmd: string) => invoke<string | null>(cmd);

        // Set up event listener FIRST to catch re-emitted events from Rust.
        // Use window-scoped listener so emit_to(label) only reaches THIS window
        // and doesn't replace content in other open windows.
        try {
          const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
          const currentWindow = getCurrentWebviewWindow();
          const unlisten = await currentWindow.listen<string>('open-file', (event) => {
            if (!cancelled && event.payload !== handledPath) {
              console.log('[file-assoc] open-file event:', event.payload);
              handledPath = event.payload;
              onFile(event.payload);
            }
          });
          if (cancelled) {
            unlisten();
          } else {
            unlistenFn = unlisten;
          }
        } catch (err) {
          console.error('Failed to listen for open-file events:', err);
        }

        // Check for a file passed at launch — poll a few times because
        // on cold start RunEvent::Opened may fire after the WebView loads
        const pollPending = async (attempt: number) => {
          if (cancelled || handledPath) return;
          try {
            const pending = await invoke<string | null>('get_opened_file');
            if (pending && !cancelled && pending !== handledPath) {
              console.log(`[file-assoc] pending file (attempt ${attempt}):`, pending);
              handledPath = pending;
              onFile(pending);
              return;
            }
          } catch (err) {
            console.error('get_opened_file failed:', err);
          }
          // Retry up to 5 times over ~3 seconds for cold-start timing
          if (attempt < 5 && !cancelled && !handledPath) {
            pollTimer = setTimeout(() => pollPending(attempt + 1), 600);
          }
        };
        pollPending(1);
      })();

      // On iOS/Android warm start, RunEvent::Opened fires in Rust but the
      // Tauri JS event may not reach the listener reliably. When the app
      // returns to foreground, re-check the pending file state.
      const onVisibilityChange = async () => {
        if (document.visibilityState !== 'visible' || cancelled || !invokeRef) return;
        try {
          // On Android, check for warm-start "Open with" intents first.
          // onNewIntent() stores the URI in a companion-object field.
          const { getOS } = await import('../services/platform');
          if (getOS() === 'android') {
            try {
              const newIntent = await invokeRef('android_check_new_intent');
              if (newIntent && newIntent !== handledPath) {
                console.log('[file-assoc] Android new intent:', newIntent);
                handledPath = newIntent;
                onFile(newIntent);
                return;
              }
            } catch (err) {
              console.error('[file-assoc] android_check_new_intent failed:', err);
              showToast(`Open with failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
            }
          }
          // Fallback: check pending file state (works on all platforms)
          const pending = await invokeRef('get_opened_file');
          if (pending && pending !== handledPath) {
            console.log('[file-assoc] foreground check found pending file:', pending);
            handledPath = pending;
            onFile(pending);
          }
        } catch (err) {
          console.error('[file-assoc] foreground check failed:', err);
        }
      };
      document.addEventListener('visibilitychange', onVisibilityChange);

      return () => {
        cancelled = true;
        unlistenFn?.();
        if (pollTimer) clearTimeout(pollTimer);
        document.removeEventListener('visibilitychange', onVisibilityChange);
      };
    }, [ready, onFile]);
}
