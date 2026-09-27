import { expect, test, type Page } from '@playwright/test';

// Epic #330 / ADR-0017（初期表示を外部 CDN の JS に依存させない）: 以前は <html x-cloak> でページ全体を隠し、jsDelivr の CDN から読んだ Alpine が起動して
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

test.describe('Alpine without CDN (ADR-0017)', () => {
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
    // Alpine が無くても、スイッチの読み上げ状態は描画前に当てた配色（dark）と一致する
    await expect(themeSwitch(page)).toHaveAttribute('aria-checked', 'true');
  });

  test('shows the penguins only after their first placement', async ({ page }) => {
    await page.goto('/');
    const layer = page.locator('[data-pw-layer]');
    await expect(layer).toHaveAttribute('data-pw-placed', '1');
    expect(await layer.evaluate((el) => getComputedStyle(el).visibility)).toBe('visible');
    const first = await layer.locator('.pw').first().boundingBox();
    const box = await layer.boundingBox();
    // 置かれた後は左上（レイヤーの原点）に張り付いていない
    expect(first && box && (first.x - box.x > 1 || first.y - box.y > 1)).toBe(true);
  });

  // ネットワーク経由のスクリプト（Alpine を含むモジュール）を止め、インラインのスクリプトだけが動く状態の初期表示。
  // TODO（フォローアップ）: この状態ではファーストビューの [data-reveal] が opacity 0 のまま残る（html.js は
  // インラインで付くが、表示を戻す IntersectionObserver はモジュール側にある）。以前からの設計のため別途扱う。
  test('renders sensible defaults while network scripts are blocked (inline scripts only)', async ({ page }) => {
    await page.route('**/*', (route) =>
      route.request().resourceType() === 'script' ? route.abort() : route.continue(),
    );
    await page.goto('/');
    // FAQ の質問行は Alpine を待たずに見える（回答は閉じたまま）
    const faqQuestion = page.locator('button[aria-controls^="faq-question-"]').first();
    await faqQuestion.scrollIntoViewIfNeeded();
    await expect(faqQuestion).toBeVisible();
    await expect(page.locator('dd[id^="faq-question-"]').first()).toBeHidden();
    // ペンギンは位置が決まるまで左上に出さない
    const layer = page.locator('[data-pw-layer]');
    await expect(layer).toHaveCount(1);
    expect(await layer.evaluate((el) => getComputedStyle(el).visibility)).toBe('hidden');
    // スイッチとドロップダウンは ARIA の既定値を静的に持つ。ファーストビューのロゴは遅延読込しない
    await expect(themeSwitch(page)).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByRole('button', { name: /Language/ })).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('header a img').first()).not.toHaveAttribute('loading', 'lazy');
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

      // 遷移で <html> の属性が差し替わっても配色・js・font-loaded が保たれ、新しい body の Alpine ディレクティブが動く
      await expect(html(page)).toHaveClass(/(^|\s)dark(\s|$)/);
      await expect(html(page)).toHaveClass(/(^|\s)js(\s|$)/);
      await expect(html(page)).toHaveClass(/(^|\s)font-loaded(\s|$)/);
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
