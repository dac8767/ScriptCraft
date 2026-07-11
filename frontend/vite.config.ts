import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Vite 8 uses Rolldown which does NOT transpile JS syntax via build.target.
// For legacy macOS builds (Catalina / older WKWebView) we run each output
// chunk through esbuild to down-level modern syntax (optional chaining,
// nullish coalescing, logical assignment, class fields, etc.).
//
// We use an ES-year target (e.g. "es2019") instead of a Safari-specific
// target because esbuild 0.28+ cannot transform destructuring for Safari
// targets below 15 — even though Safari 13+ supports it fine.
function legacyTranspile(): Plugin | null {
  const target = process.env.BUILD_TARGET
  if (!target) return null

  return {
    name: 'legacy-transpile',
    apply: 'build',
    async generateBundle(_options, bundle) {
      const { transform } = await import('esbuild')
      for (const [, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'chunk') {
          const result = await transform(chunk.code, {
            target,
            loader: 'js',
          })
          chunk.code = result.code
        }
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), legacyTranspile()].filter(Boolean),

  // Allow Tauri dev server to connect
  server: {
    host: true,
    strictPort: true,
  },

  // Tauri expects a fixed output directory
  build: {
    outDir: 'dist',
    rollupOptions: {
      /**
       * html2canvas is used ONLY by the Dev Picker's screenshot button, which is
       * dev-only and correctly absent from dist. Rollup still emitted the library
       * as its own chunk, because it treats a dynamic import as an entry point
       * even when the code that would call it has been eliminated — ~200KB of a
       * screenshot library shipping inside the .dmg for no reason. Marking it
       * external means the build never pulls it in; the only import() that
       * referenced it lives in code that production doesn't contain.
       */
      external: ['html2canvas'],
    },
    // build.target is kept for CSS transpilation (cssTarget inherits from it)
    ...(process.env.BUILD_TARGET ? { target: process.env.BUILD_TARGET } : {}),
  },
})
