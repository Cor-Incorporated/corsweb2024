import type { Page } from '@playwright/test';

/** Disable motion and reveal delays so audits read the settled DOM. */
export async function settlePageForAudit(page: Page, route: string): Promise<number | null> {
  const response = await page.goto(route, { waitUntil: 'load', timeout: 60_000 });
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        scroll-behavior: auto !important;
      }
      html.js [data-reveal] {
        opacity: 1 !important;
        transform: none !important;
      }
    `,
  });
  await page.evaluate(async () => {
    await (document as Document & { fonts?: FontFaceSet }).fonts?.ready;
  });
  await page.waitForTimeout(100);
  return response?.status() ?? null;
}