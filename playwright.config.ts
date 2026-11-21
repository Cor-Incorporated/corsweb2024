import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4324';

export default defineConfig({
  testDir: './e2e',
  // CMS 管理画面はビルド済みの出力でだけ確かめる（playwright.admin.config.ts）。
  testIgnore: /admin-cms\.spec\.ts/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4324',
    env: { COR_BROWSER_TEST: '1' },
    url: baseURL,
  },
});