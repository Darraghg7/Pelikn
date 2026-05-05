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
    }),
  ],

  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React runtime — tiny, cached forever after first load
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Data fetching layer
          'query-vendor': ['@tanstack/react-query'],
          // Supabase client — large but rarely changes
          'supabase-vendor': ['@supabase/supabase-js'],
          // Date utilities
          'date-vendor': ['date-fns'],
          // PDF / canvas export — only needed on demand
          'pdf-vendor': ['jspdf', 'html2canvas'],
        },
      },
    },
    // Raise threshold now we've intentionally split chunks
    chunkSizeWarningLimit: 600,
  },
})
