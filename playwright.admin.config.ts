import { defineConfig, devices } from '@playwright/test';

// CMS 管理画面（https://cor-jp-cms-admin.web.app/ 、ADR-0018）の確認用。
// ビルド済みの cms/dist を、cms/firebase.json のヘッダー（CSP など）付きで配信して実行する。
//   npm run build:cms && npm run test:e2e:admin
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4323';

export default defineConfig({
  testDir: './e2e',
  testMatch: /admin-cms\.spec\.ts/,
  // CMS 本体（約 2 MB）の読み込みと画像の変換を含むので、既定の 30 秒より長くする。
  timeout: 60_000,
  // 失敗の記録（trace・error-context.md）は CI の成果物に載せる（visual-text.yml の Upload の path と同じ）。
  outputDir: 'test-results/admin-cms',
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
        command: 'node cms/scripts/serve.mjs',
        url: baseURL,
        env: { PORT: new URL(baseURL).port },
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
      },
});
