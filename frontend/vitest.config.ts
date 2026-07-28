import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Unit tests. Most are pure-logic and need no DOM; the component tests (*.test.tsx)
// run in jsdom, which is how the v1.3.2 dropdown-placement bug got pinned down —
// the menu opened and picked correctly, so the fault had to be in WHERE it landed,
// and that's only visible if you render it and read the styles back.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environmentMatchGlobs: [['src/**/*.test.tsx', 'jsdom']],
    // Speed audit 2026-07-28, CONCLUDED THE OTHER WAY: `isolate: false` was
    // tried (34–50s → ~10s) and produced order-dependent flakes within a day
    // — Scrapbook caret/focus tests failing only when certain files shared a
    // worker, 2-of-3 full runs red, and still 1-of-5 after fixing the two
    // leaks we could find (document junk, notebookStore page accumulation —
    // both real, both now reset per file below). A gate that is sometimes
    // wrong is worse than one that is 20s slower, so the FULL SUITE runs
    // isolated and deterministic. Iterate with
    //   npx vitest related <changed files> --run     (~3s)
    // and run the full suite once before commit. `--no-isolate` exists for a
    // quick opportunistic pass, but red there proves nothing until it is red
    // under isolation too.
    setupFiles: ['./src/test/sharedEnvReset.ts'],
  },
})
