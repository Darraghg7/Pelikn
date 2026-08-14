import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{js,jsx,ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/hooks/useShifts.js'],
      reporter: ['text', 'html'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'prompt',
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      // Disable auto-generated manifest — we use public/manifest.json instead.
      // Having two manifests confuses Android Chrome and can cause PWA install failures.
      manifest: false,
      injectManifest: {
        // The PDF/OCR vendors are ~800 kB of the precache between them, and the
        // service worker re-downloads the whole precache after every deploy.
        // Paying that on a kitchen's 4G for libraries most sessions never touch
        // is not worth it — they are runtime-cached on first use instead (see
        // the hashed-asset route in src/sw.js), so a venue that does export
        // PDFs still gets them offline from the second time onwards.
        globIgnores: ['**/pdf-vendor-*.js', '**/ocr-vendor-*.js'],
      },
    }),
  ],

  build: {
    rollupOptions: {
      output: {
        // Function form, not the object form — and that is load-bearing.
        //
        // With the object form, Rollup pulled Vite's `__vitePreload` helper
        // into `pdf-vendor`. The helper is used by *every* dynamic import, so
        // every lazy route chunk gained a static dependency on 593 kB of
        // jsPDF + html2canvas, and index.html modulepreloaded it. Nothing
        // could render — not the dashboard, not the login screen — until the
        // PDF library had downloaded and parsed. On mobile that was seconds.
        //
        // The helper is a virtual module (`\0vite/preload-helper`), so the
        // `node_modules` guard below returns undefined for it and Rollup
        // leaves it in the entry chunk where it belongs.
        //
        // The object form also force-bundles anything it can resolve, which is
        // how html2canvas ended up shipped despite zero imports in src/.
        manualChunks(id) {
          // Pin the preload helper to a chunk that is on the critical path
          // anyway. Left unassigned it is a sub-500-byte module, and Vite's
          // `experimentalMinChunkSize` merges chunks that small into an
          // arbitrary neighbour — which is exactly how it landed in pdf-vendor.
          if (id.includes('vite/preload-helper')) return 'react-vendor'

          if (!id.includes('node_modules')) return undefined
          const pkg = id.split('node_modules/').pop()

          // PDF / canvas export — only needed on demand, must stay lazy
          if (/^(jspdf|jspdf-autotable|html2canvas|canvg|dompurify)\//.test(pkg)) return 'pdf-vendor'
          // OCR — huge, and only used by the label scanner
          if (/^tesseract\.js/.test(pkg)) return 'ocr-vendor'
          // Core React runtime — cached forever after first load
          if (/^(react|react-dom|react-router|react-router-dom|scheduler)\//.test(pkg)) return 'react-vendor'
          // Data fetching layer
          if (/^@tanstack\//.test(pkg)) return 'query-vendor'
          // Supabase client — large but rarely changes
          if (/^@supabase\//.test(pkg)) return 'supabase-vendor'
          // Date utilities
          if (/^date-fns\//.test(pkg)) return 'date-vendor'
          // Drag-and-drop — only the dashboard widget grid uses it
          if (/^@dnd-kit\//.test(pkg)) return 'dnd-vendor'

          return undefined
        },
      },
    },
    // Raise threshold now we've intentionally split chunks
    chunkSizeWarningLimit: 600,
  },
})
