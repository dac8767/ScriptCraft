/**
 * Shared-environment file-boundary reset (speed audit follow-up, 2026-07-28).
 *
 * `isolate: false` made the suite 3× faster, and one day in it produced the
 * predicted failure mode: order-dependent flakes. Two Scrapbook caret/focus
 * tests (imagefocus, clicktype) failed only when SOME other file had run
 * first in the same worker — a fresh jsdom starts with an empty <body> and no
 * focused element, and those tests implicitly relied on that, while other
 * files leave hosts, portals and focus behind.
 *
 * Those two leaks are FIXED here (empty body, no stray focus, notebook store
 * rewound per file) — but a fifth-run flake remained, so the config went back
 * to full isolation; see vitest.config.ts. This file stays: the hygiene is
 * real (leaked DOM and accumulated pages are bugs in tests regardless of the
 * runner mode), it costs nothing under isolation, and it is one leak-hunt
 * fewer if shared environments are ever attempted again.
 */
import { beforeAll } from 'vitest';
import { useNotebookStore } from '../stores/notebookStore';

beforeAll(() => {
  if (typeof document === 'undefined') return;   // node-env test files
  (document.activeElement as HTMLElement | null)?.blur?.();
  document.body.replaceChildren();
  // The Scrapbook store accumulates PAGES across files (every notebook test's
  // beforeEach calls addPage() and nothing ever deletes them), and with pages
  // from other files present, box/canvas queries in a later file can land on
  // a stale page's DOM. Replace-reset it to its module-initial state at each
  // file boundary — zustand v5's getInitialState is the full initial object,
  // actions included, so setState(…, true) is a clean rewind.
  useNotebookStore.setState(useNotebookStore.getInitialState(), true);
});
