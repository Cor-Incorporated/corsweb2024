import { expect, test } from '@playwright/test';

test.use({ javaScriptEnabled: false, viewport: { width: 390, height: 840 } });

test('メール保護による置換後も開示窓口を本文から読める', async ({ page }) => {
  const address = 'company@cor-jp.com';
  for (const prefix of ['', '/en', '/zh', '/ko', '/es']) {
    const path = prefix + '/privacy/';
    await page.route('**' + path, async (route) => {
      const response = await route.fetch();
      // Cloudflareは通常のアドレスをリンクへ置換し、noscriptの内容は保持する。
      const body = (await response.text()).replace(
        /(<span\b[^>]*class="privacy-decoded-address"[^>]*>[^<]*)company@cor-jp\.com([^<]*<\/span>)/,
        '$1<a href="/cdn-cgi/l/email-protection">[email protected]</a>$2',
      );
      await route.fulfill({ response, body });
    });
    await page.goto(path);
    const cell = page.locator('main td').filter({ has: page.locator('.privacy-decoded-address') });
    const protectedLink = cell.getByRole('link', { name: '[email protected]', includeHidden: true });
    await expect(protectedLink).toHaveCount(1);
    await expect(protectedLink).toBeHidden();
    const text = await cell.innerText();
    expect(text.split(address)).toHaveLength(2);
    expect(text).not.toContain('[email protected]');
    await page.unroute('**' + path);
  }
});
