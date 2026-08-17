import React, { useEffect, useState, useCallback } from 'react';
import { savedFlashSpot, DROP_IN } from './SavedFlash';
import { useEditorStore } from '../stores/editorStore';

/** A shade below the Save flash's own line, measured in the PAGE's inch like
 *  everything else anchored to the page — so a save and a message arriving
 *  together stack instead of printing over each other. */
const TOAST_DROP_IN = DROP_IN + 0.45;

interface ToastMessage {
  id: number;
  text: string;
  type: 'error' | 'success' | 'info';
}

let nextId = 0;
const listeners: Array<(msg: ToastMessage) => void> = [];

/** Call from anywhere to show a toast. */
export function showToast(text: string, type: ToastMessage['type'] = 'info') {
  const msg: ToastMessage = { id: ++nextId, text, type };
  listeners.forEach((fn) => fn(msg));
}

const Toast: React.FC = () => {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  const addMessage = useCallback((msg: ToastMessage) => {
    setMessages((prev) => [...prev, msg]);
    const duration = msg.type === 'error' ? 8000 : 4000;
    setTimeout(() => {
      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
    }, duration);
  }, []);

  useEffect(() => {
    listeners.push(addMessage);
    return () => {
      const idx = listeners.indexOf(addMessage);
      if (idx >= 0) listeners.splice(idx, 1);
    };
  }, [addMessage]);

  /* v7.35, Derek: "any type of save, warning or other, that has a status
     displayed in the lower right corner (like Settings Saved), should now show
     in the same location as Save (top of white page)."

     The bottom-right corner was the app's status corner until v7.25 moved the
     Save flash onto the page — which left one channel in each place and the
     eye in neither. This reads the SAME savedFlashSpot() the flash does, so
     the two cannot drift: change where a save lands and every status follows.
     TOAST_DROP_IN sits just under the flash's line so a save and a message
     arriving together stack instead of overprinting.

     There is a fallback, and it matters: savedFlashSpot returns null when
     there is no page to measure — Statistics, the Beat Board and every
     fullscreen takeover replace the editor entirely. A status pinned to a page
     that isn't there would render off-screen, which is worse than the corner
     it came from. */
  const spot = React.useMemo(() => {
    if (messages.length === 0) return null;
    const rect = (sel: string) => document.querySelector(sel)?.getBoundingClientRect() ?? null;
    const pageWidthIn = useEditorStore.getState().pageLayout.pageWidth;
    return savedFlashSpot(rect('.page'), rect('.fs-ruler-h'), rect('.editor-main'), pageWidthIn, TOAST_DROP_IN);
  }, [messages.length]);

  if (messages.length === 0) return null;

  return (
    <div
      className={`fs-toast-stack${spot ? '' : ' fs-toast-stack--corner'}`}
      style={spot ? { left: spot.left, top: spot.top } : undefined}
    >
      {messages.map((m) => (
        <div
          key={m.id}
          className={`fs-toast fs-toast--${m.type}`}
          onClick={() => setMessages((prev) => prev.filter((x) => x.id !== m.id))}
        >
          {m.text}
        </div>
      ))}
    </div>
  );
};

export default Toast;
