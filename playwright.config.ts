import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html', { outputFolder: 'playwright-report' }], ['list']],

  // Assertions here are network-bound: nearly every one waits on content
  // rendered from a live Supabase read. The default 5 s made expect() the
  // tightest budget in the whole config — far tighter than actionTimeout
  // (15 s) or navigationTimeout (25 s) — so under full-suite load a slow
  // read would fail the assertion while everything else still had headroom.
  // That was the main source of run-to-run flake.
  expect: { timeout: 10000 },

  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 25000,
  },

  projects: [
    // Optional: run global-setup to generate real auth state files.
    // Tests that use injectManagerSession() work without this.
    {
      name: 'setup',
      testMatch: /global-setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // storageState is used only when real auth state files exist.
        // Tests that call injectManagerSession() bypass this entirely.
        storageState: process.env.USE_AUTH_STATE ? 'tests/auth/manager-state.json' : undefined,
      },
      // No dependency on setup — tests run without credentials by default.
    },
  ],

  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5173',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
    timeout: 30000,
  },
})
