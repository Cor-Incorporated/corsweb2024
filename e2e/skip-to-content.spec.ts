import { expect, test } from '@playwright/test';

const labels = {
  ja: '本文へ移動',
  en: 'Skip to main content',
  zh: '跳至主要内容',
  ko: '본문으로 이동',
  es: 'Saltar al contenido principal',
};

test('相談の代替ページにも本文がひとつある', async ({ page }) => {
  await page.goto('/contact/chat/');
  const main = page.getByRole('main');
  await expect(main).toHaveCount(1);
  await expect(main.locator('[data-cloudia-unavailable-page]')).toBeVisible();
});

for (const javaScriptEnabled of [true, false]) {
  test.describe(javaScriptEnabled ? 'JavaScript有効' : 'JavaScript無効', () => {
    test.use({ javaScriptEnabled, contextOptions: { reducedMotion: 'reduce' }, viewport: { width: 390, height: 840 } });
    for (const [locale, label] of Object.entries(labels)) {
      for (const path of ['/news/', '/blog/grift-cli-oss-measurement/']) {
        test(`${locale}${path}の最初のTabとEnterで本文に移動できる`, async ({ page, browserName }) => {
          const next = browserName === 'webkit' ? 'Alt+Tab' : 'Tab';
          await page.goto((locale === 'ja' ? '' : '/' + locale) + path);
          const skip = page.getByRole('link', { name: label, exact: true });
          await page.keyboard.press(next);
          await expect(skip).toBeFocused();
          await expect(skip).toBeInViewport();
          expect(await skip.evaluate(el => {
            const rect = el.getBoundingClientRect();
            return el.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
          })).toBe(true);
          await page.keyboard.press('Enter');
          const main = page.getByRole('main');
          await expect(main).toBeFocused();
          await page.keyboard.press(next);
          const firstContentControl = main.locator(':focus');
          await expect(firstContentControl).toBeInViewport();
          expect(await firstContentControl.evaluate(el => {
            const rect = el.getBoundingClientRect();
            const x = Math.min(innerWidth - 1, Math.max(0, rect.left + rect.width / 2));
            const y = Math.min(innerHeight - 1, Math.max(0, rect.top + rect.height / 2));
            return el.contains(document.elementFromPoint(x, y));
          })).toBe(true);
          const scrollBefore = await page.evaluate(() => scrollY);
          await page.keyboard.press('PageDown');
          await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(scrollBefore);
        });
      }
    }
  });
}
