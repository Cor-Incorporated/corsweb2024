import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4322';

export default defineConfig({
  testDir: './e2e',
  testMatch: /a11y\.spec\.ts/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/a11y', open: 'never' }],
    ['json', { outputFile: 'test-results/a11y/playwright.json' }],
  ],
  use: {
    baseURL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    viewport: { width: 390, height: 844 },
  },
  projects: [
    {
      name: 'chromium-a11y',
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
        env: { COR_BROWSER_TEST: '1' },
      },
});