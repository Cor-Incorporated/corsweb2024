import { expect, test, type Page } from '@playwright/test';

// C1: 以前は <html x-cloak> でページ全体を隠し、jsDelivr の CDN から読んだ Alpine が起動して
// 初めて表示していた。CDN が遮断・遅延すると白紙（または FCP 遅延）になる。
// Alpine を npm からバンドルし、<html> の x-cloak を外したことを実ブラウザで確かめる。

const JSDELIVR = /^https:\/\/cdn\.jsdelivr\.net\//;

async function blockJsdelivr(page: Page) {
  await page.route(JSDELIVR, (route) => route.abort());
}

async function waitForAlpine(page: Page) {
  await page.waitForFunction(() => {
    const alpine = (window as unknown as { Alpine?: { store?: (name: string) => unknown } }).Alpine;
    return Boolean(alpine?.store?.('theme'));
  });
}

function collectAlpineErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => {
    if (/alpine|\$store/i.test(`${error.message}\n${error.stack ?? ''}`)) errors.push(error.message);
  });
  return errors;
}

const themeSwitch = (page: Page) => page.locator('header button[role="switch"]');
const html = (page: Page) => page.locator('html');

test.describe('Alpine without CDN (C1)', () => {
  for (const path of ['/', '/blog/complete-markdown-guide/']) {
    test(`shows the page body with jsDelivr blocked: ${path}`, async ({ page }) => {
      await blockJsdelivr(page);
      await page.goto(path);
      await expect(page.locator('main h1').first()).toBeVisible();
      // CDN を遮断しても Alpine（同梱版）は起動し、ヘッダーの操作が効く
      await waitForAlpine(page);
      await page.getByRole('button', { name: /Language/ }).click();
      await expect(page.locator('ul[aria-label="Language"]')).toBeVisible();
    });
  }

  test('applies the saved dark theme before and without any external script', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('theme', 'dark'));
    await page.route('**/*', (route) =>
      route.request().resourceType() === 'script' ? route.abort() : route.continue(),
    );
    await page.goto('/');
    await expect(html(page)).toHaveClass(/(^|\s)dark(\s|$)/);
    await expect(page.locator('main h1').first()).toBeVisible();
  });
});

test.describe('Alpine interactions', () => {
  test('theme switch toggles dark mode and persists across reload', async ({ page }) => {
    const errors = collectAlpineErrors(page);
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await waitForAlpine(page);
    await expect(html(page)).not.toHaveClass(/(^|\s)dark(\s|$)/);

    await themeSwitch(page).click();
    await expect(html(page)).toHaveClass(/(^|\s)dark(\s|$)/);
    await expect(themeSwitch(page)).toHaveAttribute('aria-checked', 'true');
    expect(await page.evaluate(() => window.localStorage.getItem('theme'))).toBe('dark');

    await page.reload();
    await waitForAlpine(page);
    await expect(html(page)).toHaveClass(/(^|\s)dark(\s|$)/);
    await expect(themeSwitch(page)).toHaveAttribute('aria-checked', 'true');

    await themeSwitch(page).click();
    await expect(html(page)).not.toHaveClass(/(^|\s)dark(\s|$)/);
    expect(await page.evaluate(() => window.localStorage.getItem('theme'))).toBe('light');
    expect(errors).toEqual([]);
  });

  test('language dropdown opens and switches to the English page', async ({ page }) => {
    const errors = collectAlpineErrors(page);
    await page.goto('/about/');
    await waitForAlpine(page);
    const list = page.locator('ul[aria-label="Language"]');
    await expect(list).toBeHidden();
    await page.getByRole('button', { name: /Language/ }).click();
    await expect(list).toBeVisible();
    await list.locator('a[hreflang="en"]').click();
    await expect(page).toHaveURL(/\/en\/about\/?$/);
    await expect(html(page)).toHaveAttribute('lang', 'en');
    expect(errors).toEqual([]);
  });

  for (const { from, link, to } of [
    { from: '/', link: 'header nav[aria-label="主要ページ"] a[href$="/works"]', to: /\/works\/?$/ },
    { from: '/blog/', link: '[data-testid="blog-post"] a[href*="/blog/"]', to: /\/blog\/[^/]+\/?$/ },
  ]) {
    test(`keeps theme and Alpine working after a View Transitions navigation from ${from}`, async ({ page }) => {
      const errors = collectAlpineErrors(page);
      await page.emulateMedia({ colorScheme: 'light' });
      await page.goto(from);
      await waitForAlpine(page);
      await themeSwitch(page).click();
      await expect(html(page)).toHaveClass(/(^|\s)dark(\s|$)/);

      // フルリロードではなく View Transitions で遷移したことを、window に置いた目印で確かめる
      await page.evaluate(() => {
        (window as unknown as { __vtMarker?: boolean }).__vtMarker = true;
      });
      await page.locator(link).first().click();
      await expect(page).toHaveURL(to);
      expect(await page.evaluate(() => (window as unknown as { __vtMarker?: boolean }).__vtMarker)).toBe(true);

      // 遷移で <html> の属性が差し替わっても配色が保たれ、新しい body の Alpine ディレクティブが動く
      await expect(html(page)).toHaveClass(/(^|\s)dark(\s|$)/);
      await expect(html(page)).not.toHaveAttribute('x-cloak');
      const list = page.locator('ul[aria-label="Language"]');
      const langButton = page.getByRole('button', { name: /Language/ });
      await langButton.click();
      await expect(list).toBeVisible();
      // WebKit はクリックでボタンにフォーカスしないため、Escape ではなく再クリックで閉じる
      await langButton.click();
      await expect(list).toBeHidden();
      await themeSwitch(page).click();
      await expect(html(page)).not.toHaveClass(/(^|\s)dark(\s|$)/);
      expect(errors).toEqual([]);
    });
  }
});
