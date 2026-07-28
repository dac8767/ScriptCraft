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
    // Speed audit 2026-07-28: workers REUSE their environment across test
    // files instead of building a fresh jsdom per file. Measured on this
    // suite: 34–50s → ~10s, 786/786 green either way. The trade is that
    // module state (zustand stores are module singletons) persists across
    // files within a worker — tests already reset what they touch in
    // beforeEach, and every NEW test file must keep doing that. If a failure
    // ever appears only in full runs and smells like cross-file leakage,
    // re-check with `npx vitest run --isolate` before chasing ghosts.
    isolate: false,
  },
})
