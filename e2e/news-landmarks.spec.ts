import { expect, test } from '@playwright/test';

for (const locale of ['ja', 'en', 'zh', 'ko', 'es']) {
  test(`${locale}のニュースと報道向けページは本文ランドマークを各1つ持つ`, async ({ page }) => {
    const prefix = locale === 'ja' ? '' : '/' + locale;
    const news = prefix + '/news/';
    const press = news + 'press/';

    await page.goto(news);
    const main = page.getByRole('main');
    await expect(main).toHaveCount(1);
    const newsTitle = await main.getByRole('heading', { level: 1 }).innerText();
    const pressLink = main.locator(`a[href="${press}"]`);
    await expect(pressLink).toHaveAccessibleName(/\S/);
    await pressLink.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(press + '$'));
    await expect(main).toHaveCount(1);
    await expect(main.getByRole('heading', { level: 1 })).toBeVisible();

    await page.goBack();
    await expect(main).toHaveCount(1);
    await expect(main.getByRole('heading', { level: 1 })).toHaveText(newsTitle);
  });
}
