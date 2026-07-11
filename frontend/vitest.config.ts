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
  },
})
