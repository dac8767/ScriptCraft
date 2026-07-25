/**
 * v4.35 batch-v9 #2: the Scenes tool's deferred-reorder machinery, shared by
 * BOTH views (card drag / list row drag). Extracted from IndexCards: the
 * pending order is a visual-only snapshot until Apply rewrites the whole
 * document — which is why filtering is suspended while reordering; a filtered
 * pending list would eat the hidden scenes on Apply.
 *
 * The store's scenesReorderMode flag is the single on/off switch (the chrome
 * Reorder control flips it); the snapshot rides the flag so every entry path
 * initializes the same way and flipping it off from outside cancels cleanly.
 * Exactly one ACTIVE consumer is mounted at a time (ScenesTool renders list
 * XOR cards). Pass active=false from bodies that share SceneNavigator but
 * aren't the scenes list (Pages / Locations / Structure), so their unmount
 * can't cancel a reorder they never owned.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { useEditorStore, type SceneInfo } from '../stores/editorStore';

export interface SceneReorder {
  /** Reorder mode is on and this consumer owns it. */
  dragMode: boolean;
  /** The pending (visual-only) order — null outside reorder mode. */
  pending: SceneInfo[] | null;
  /** What to render: the pending order during reorder, live scenes otherwise. */
  displayScenes: SceneInfo[];
  hasChanges: boolean;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  /** Discard the pending order and leave reorder mode. */
  cancel: () => void;
  /** Rewrite the document into the pending order and leave reorder mode. */
  apply: () => void;
  /** Splice pending[from] out and reinsert at `to` (pushes undo history). */
  move: (from: number, to: number) => void;
  /** The scene's 1-based position when reorder mode was entered. */
  originalIndexOf: (id: string) => number | undefined;
}

export function useSceneReorder(editor: Editor | null, active = true): SceneReorder {
  const scenes = useEditorStore((s) => s.scenes);
  const flag = useEditorStore((s) => s.scenesReorderMode);
  const dragMode = active && flag;

  // Deferred reorder state: pending changes are visual-only until Apply
  const [pendingScenes, setPendingScenes] = useState<SceneInfo[] | null>(null);
  const [originalScenes, setOriginalScenes] = useState<SceneInfo[] | null>(null);

  // Map from scene ID to its original 1-based position (for showing "was #N")
  const originalIndexMap = useRef(new Map<string, number>());

  // Undo/redo history for reorder operations
  const historyRef = useRef<{ stack: SceneInfo[][]; pointer: number }>({ stack: [], pointer: -1 });
  const [, setHistoryVersion] = useState(0); // trigger re-renders on undo/redo

  const canUndo = dragMode && historyRef.current.pointer > 0;
  const canRedo = dragMode && historyRef.current.pointer < historyRef.current.stack.length - 1;

  const pushHistory = useCallback((state: SceneInfo[]) => {
    const h = historyRef.current;
    // Truncate any redo states
    h.stack = h.stack.slice(0, h.pointer + 1);
    h.stack.push(state);
    h.pointer = h.stack.length - 1;
    setHistoryVersion(v => v + 1);
  }, []);

  const undo = useCallback(() => {
    const h = historyRef.current;
    if (h.pointer <= 0) return;
    h.pointer--;
    setPendingScenes(h.stack[h.pointer]);
    setHistoryVersion(v => v + 1);
  }, []);

  const redo = useCallback(() => {
    const h = historyRef.current;
    if (h.pointer >= h.stack.length - 1) return;
    h.pointer++;
    setPendingScenes(h.stack[h.pointer]);
    setHistoryVersion(v => v + 1);
  }, []);

  // Keyboard shortcuts for undo/redo in reorder mode
  useEffect(() => {
    if (!dragMode) return;
    const handleKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        e.stopImmediatePropagation();
        undo();
      } else if (mod && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        e.stopImmediatePropagation();
        redo();
      } else if (mod && e.key === 'y') {
        e.preventDefault();
        e.stopImmediatePropagation();
        redo();
      }
    };
    // Capture phase fires before ProseMirror's editor keymap handlers
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [dragMode, undo, redo]);

  // The chrome's Reorder control just flips the store flag — the snapshot
  // rides this effect, so every entry path (chrome or shortcut) initializes
  // the same way, and flipping the flag off from outside cancels cleanly.
  useEffect(() => {
    if (dragMode && pendingScenes === null) {
      const snapshot = [...scenes];
      setPendingScenes(snapshot);
      setOriginalScenes(snapshot);
      const map = new Map<string, number>();
      snapshot.forEach((s, i) => map.set(s.id, i + 1));
      originalIndexMap.current = map;
      historyRef.current = { stack: [snapshot], pointer: 0 };
      setHistoryVersion(0);
    } else if (!dragMode && pendingScenes !== null) {
      setPendingScenes(null);
      setOriginalScenes(null);
      originalIndexMap.current = new Map();
      historyRef.current = { stack: [], pointer: -1 };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshot on flag flip only
  }, [dragMode, pendingScenes]);

  // Leaving the view mid-reorder (view switch, tool close, fullscreen
  // enter/exit) = cancel — the pending snapshot dies with this instance.
  useEffect(() => {
    if (!active) return;
    return () => { useEditorStore.getState().setScenesReorderMode(false); };
  }, [active]);

  const cancel = useCallback(() => {
    setPendingScenes(null);
    setOriginalScenes(null);
    originalIndexMap.current = new Map();
    historyRef.current = { stack: [], pointer: -1 };
    useEditorStore.getState().setScenesReorderMode(false);
  }, []);

  // ── Get document ranges for each scene ──

  const getSceneRanges = useCallback(() => {
    if (!editor) return [];
    const { doc } = editor.state;
    const headingPositions: number[] = [];

    doc.descendants((node, pos) => {
      if (node.type.name === 'sceneHeading') {
        headingPositions.push(pos);
      }
    });

    const ranges: Array<{ from: number; to: number }> = [];
    for (let i = 0; i < headingPositions.length; i++) {
      const from = headingPositions[i];
      const to =
        i + 1 < headingPositions.length
          ? headingPositions[i + 1]
          : doc.content.size;
      ranges.push({ from, to });
    }
    return ranges;
  }, [editor]);

  const apply = useCallback(() => {
    if (!editor || !pendingScenes || !originalScenes) {
      cancel();
      return;
    }

    // Check if order actually changed
    const changed = pendingScenes.some((s, i) => s.id !== originalScenes[i]?.id);
    if (!changed) {
      cancel();
      return;
    }

    const ranges = getSceneRanges();
    if (ranges.length === 0 || ranges.length !== originalScenes.length) {
      cancel();
      return;
    }

    const { doc, tr } = editor.state;
    const sceneStart = ranges[0].from;
    const sceneEnd = ranges[ranges.length - 1].to;

    // Map original scene ID → original index in the document
    const idToOrigIdx = new Map<string, number>();
    originalScenes.forEach((s, i) => idToOrigIdx.set(s.id, i));

    // Extract slices for each scene from the document
    const sliceContents = ranges.map(r => doc.slice(r.from, r.to).content);

    // Build new order: for each scene in pendingScenes, get the original doc content
    const nodes: any[] = [];
    for (const scene of pendingScenes) {
      const origIdx = idToOrigIdx.get(scene.id);
      if (origIdx === undefined) continue;
      sliceContents[origIdx].forEach((node: any) => nodes.push(node));
    }

    // Replace the scene portion of the document
    tr.replaceWith(sceneStart, sceneEnd, nodes);
    editor.view.dispatch(tr);

    // Clean up
    setPendingScenes(null);
    setOriginalScenes(null);
    originalIndexMap.current = new Map();
    historyRef.current = { stack: [], pointer: -1 };
    useEditorStore.getState().setScenesReorderMode(false);
  }, [editor, pendingScenes, originalScenes, getSceneRanges, cancel]);

  // Ref so drag listeners built at pointer-down always splice the current
  // pending order, not the one captured when the drag began.
  const pendingRef = useRef(pendingScenes);
  pendingRef.current = pendingScenes;

  const move = useCallback((from: number, to: number) => {
    const cur = pendingRef.current;
    if (!cur) return;
    if (from === to || from < 0 || to < 0 || from >= cur.length || to >= cur.length) return;
    const updated = [...cur];
    const [moved] = updated.splice(from, 1);
    updated.splice(to, 0, moved);
    setPendingScenes(updated);
    pushHistory(updated);
  }, [pushHistory]);

  const originalIndexOf = useCallback(
    (id: string) => originalIndexMap.current.get(id),
    [],
  );

  const hasChanges = !!(pendingScenes && originalScenes &&
    pendingScenes.some((s, i) => s.id !== originalScenes[i]?.id));

  return {
    dragMode,
    pending: pendingScenes,
    // The pending order during reorder mode, otherwise live scenes
    displayScenes: pendingScenes ?? scenes,
    hasChanges,
    canUndo,
    canRedo,
    undo,
    redo,
    cancel,
    apply,
    move,
    originalIndexOf,
  };
}
