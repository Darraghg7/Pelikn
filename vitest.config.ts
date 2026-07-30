import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    // Playwright specs live in tests/ and must not run under vitest. Patterns are
    // depth-independent so nested copies (e.g. agent git worktrees under .claude/)
    // and build output are never collected.
    exclude: [
      ...configDefaults.exclude,
      '**/tests/**',
      '**/test-results/**',
      '**/playwright-report/**',
      '**/.claude/**',
      '**/dist/**',
    ],
  },
})
