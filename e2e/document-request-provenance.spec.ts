import { expect, test, type Page } from '@playwright/test';
import { INDUSTRY_SLUGS } from '../src/config/industry-context';

// 資料請求のフォーム（#537）を実ブラウザで見る。フォームの inline script が送るものを記録して確かめる。
// API（Worker）は開発 server には無いので、ここでは応答の代わりを返す。Worker と D1 の規則は
// workers/contact-chat/src/__tests__/document-request-provenance.test.ts が見る。
const TOKEN = /^[0-9a-f]{32}$/;
const SUCCESS = { ok: true, status: 'stored', notification: 'queued', duplicate: false, delivered: false, receiptId: 'COR-20261123-E2E00001' };
const FORM = 'form[data-document-request]';

interface Sent {
  body: Record<string, string>;
  contentType: string;
}

/** フォームが出す要求を記録して、決まった応答を返す。 */
async function captureApi(page: Page): Promise<{ sent: Sent[]; respond(data: unknown, status: number): void }> {
  const sent: Sent[] = [];
  let next: { data: unknown; status: number } = { data: SUCCESS, status: 200 };
  await page.route('**/api/contact/document-request', async (route) => {
    const request = route.request();
    const contentType = request.headers()['content-type'] ?? '';
    const raw = request.postData() ?? '';
    const body = contentType.includes('application/json')
      ? (JSON.parse(raw) as Record<string, string>)
      : Object.fromEntries(new URLSearchParams(raw));
    sent.push({ body, contentType });
    await route.fulfill({ status: next.status, contentType: 'application/json', body: JSON.stringify(next.data) });
  });
  return {
    sent,
    respond: (data, status) => {
      next = { data, status };
    },
  };
}

async function fill(page: Page): Promise<void> {
  await page.locator('#document-request-name').fill('山田太郎');
  await page.locator('#document-request-email').fill('taro@example.com');
  await page.locator('#document-request-industry').selectOption('medical');
  await page.locator('#document-request-consent').check();
}

async function submit(page: Page): Promise<void> {
  await page.locator(`${FORM} button[type="submit"]`).click();
}

test.describe('資料請求のフォーム: トークンと元のページ', () => {
  for (const slug of INDUSTRY_SLUGS) {
    test(`業種 ${slug} のページから通常の読み込みで来たときは、path（query・hash を除く）と新しいトークンを送る`, async ({ page }, testInfo) => {
      const origin = new URL(testInfo.project.use.baseURL ?? 'http://127.0.0.1').origin;
      const api = await captureApi(page);
      await page.goto('/contact/materials/', {
        referer: `${origin}/industries/${slug}/?utm_source=x&email=taro@example.com#cta`,
      });
      await fill(page);
      await submit(page);
      await expect(page.locator('#document-request-result')).toContainText(SUCCESS.receiptId);

      expect(api.sent).toHaveLength(1);
      expect(api.sent[0].body.pagePath).toBe(`/industries/${slug}/`);
      expect(api.sent[0].body.formToken).toMatch(TOKEN);
      expect(api.sent[0].body.industry).toBe('medical');
    });
  }

  test('同じ表示のまま送り直すと、トークンも内容も同じ再送になる', async ({ page }) => {
    const api = await captureApi(page);
    await page.goto('/contact/materials/');
    await fill(page);
    api.respond({ error: 'storage' }, 503);
    await submit(page);
    await expect(page.locator('#document-request-result')).toHaveAttribute('role', 'alert');
    api.respond(SUCCESS, 200);
    await submit(page);
    await expect(page.locator('#document-request-result')).toContainText(SUCCESS.receiptId);

    expect(api.sent).toHaveLength(2);
    expect(api.sent[0].body.formToken).toMatch(TOKEN);
    expect(api.sent[1].body).toEqual(api.sent[0].body);
  });

  test('ページを開き直すと別のトークンになる（ビルド時の共通の値では無い）', async ({ page }) => {
    const api = await captureApi(page);
    await page.goto('/contact/materials/');
    await fill(page);
    await submit(page);
    await expect(page.locator('#document-request-result')).toContainText(SUCCESS.receiptId);
    await page.reload();
    await fill(page);
    await submit(page);
    await expect(page.locator('#document-request-result')).toContainText(SUCCESS.receiptId);

    expect(api.sent).toHaveLength(2);
    expect(api.sent[1].body.formToken).toMatch(TOKEN);
    expect(api.sent[1].body.formToken).not.toBe(api.sent[0].body.formToken);
  });

  test('同じ表示で業種を変えて送り直すと、トークンは同じで内容は変わる', async ({ page }) => {
    const api = await captureApi(page);
    await page.goto('/contact/materials/');
    await fill(page);
    await submit(page);
    await expect(page.locator('#document-request-result')).toContainText(SUCCESS.receiptId);
    await page.locator('#document-request-industry').selectOption('education');
    await submit(page);
    await expect(page.locator('#document-request-result')).toContainText(SUCCESS.receiptId);

    expect(api.sent).toHaveLength(2);
    expect(api.sent[1].body.formToken).toBe(api.sent[0].body.formToken);
    expect(api.sent[1].body.email).toBe(api.sent[0].body.email);
    expect([api.sent[0].body.industry, api.sent[1].body.industry]).toEqual(['medical', 'education']);
  });

  test('会社概要のリンクからは通常のページ読み込みで来る（data-astro-reload）ので、会社情報の path を送る', async ({ page }, testInfo) => {
    const origin = new URL(testInfo.project.use.baseURL ?? 'http://127.0.0.1').origin;
    const api = await captureApi(page);
    // 初回の読み込みの referrer は自社の別のページ。会社概要のリンクは通常のページ読み込みにしてある。
    await page.goto('/company/', { referer: `${origin}/about/` });
    await page.locator('nav[aria-labelledby="company-links"] a[href="/contact/materials/"]').click();
    await expect(page).toHaveURL(/\/contact\/materials\/$/);
    // この遷移がページ内遷移（View Transitions）ではないことを確かめる。
    const navigatedWithin = await page.evaluate(() => {
      const entry = performance.getEntriesByType('navigation')[0];
      return Boolean(entry) && new URL((entry as PerformanceEntry).name).pathname !== location.pathname;
    });
    expect(navigatedWithin).toBe(false);

    await fill(page);
    await submit(page);
    await expect(page.locator('#document-request-result')).toContainText(SUCCESS.receiptId);
    expect(api.sent).toHaveLength(1);
    expect(api.sent[0].body.formToken).toMatch(TOKEN);
    expect(api.sent[0].body.pagePath).toBe('/company/');
  });

  test('外部の site から来たときは referrer を送らない', async ({ page }) => {
    const api = await captureApi(page);
    await page.goto('/contact/materials/', { referer: 'https://www.google.com/search?q=%E5%B1%B1%E7%94%B0' });
    await fill(page);
    await submit(page);
    await expect(page.locator('#document-request-result')).toContainText(SUCCESS.receiptId);

    expect(api.sent[0].body.pagePath).toBe('');
    expect(JSON.stringify(api.sent[0].body)).not.toContain('google');
  });
});

test.describe('資料請求のフォーム: JS が無いとき', () => {
  test.use({ javaScriptEnabled: false });

  test('フォームの送信（JS 無し）はトークンも path も空で送る', async ({ page }) => {
    const api = await captureApi(page);
    await page.goto('/contact/materials/');
    await page.locator('#document-request-name').fill('山田太郎');
    await page.locator('#document-request-email').fill('taro@example.com');
    await page.locator('#document-request-industry').selectOption('medical');
    // JS が無いときは x-cloak の要素がみな表示される（Layout の noscript）ので、header が欄に重なる。
    // pointer の当たりに頼らず、keyboard で同意の欄を入れて送る。
    await page.locator('#document-request-consent').focus();
    await page.keyboard.press('Space');
    await page.locator(`${FORM} button[type="submit"]`).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/api\/contact\/document-request$/);

    expect(api.sent).toHaveLength(1);
    expect(api.sent[0].contentType).toContain('application/x-www-form-urlencoded');
    expect(api.sent[0].body.formToken).toBe('');
    expect(api.sent[0].body.pagePath).toBe('');
    expect(api.sent[0].body.consent).toBe('yes');
  });
});
