import { defineConfig, devices } from '@playwright/test';

// CMS 管理画面（/admin/, ADR-0018）の確認用。ビルド済みの dist を astro preview で配信して実行する。
//   npm run build && npm run test:e2e:admin
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4322';

export default defineConfig({
  testDir: './e2e',
  testMatch: /admin-cms\.spec\.ts/,
  forbidOnly: !!process.env.CI,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npm run preview:ci',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
