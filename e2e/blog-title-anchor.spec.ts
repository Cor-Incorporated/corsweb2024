import { expect, test } from '@playwright/test';

const publishedAnchors = {
  ja: '阿部寛のホームページに挑み続けたらすごいhpができた話',
  en: 'how-constantly-taking-on-hiroshi-abes-homepage-led-to-an-incredible-website',
  zh: '不断挑战阿部宽的个人主页最终打造出一个惊人网站的故事',
  ko: '아베-히로시의-홈페이지에-끊임없이-도전했더니-엄청난-홈페이지가-완성된-이야기',
  es: 'la-historia-de-cómo-creé-un-sitio-web-increíble-tras-desafiar-continuamente-la-página-web-de-hiroshi-abe',
};

for (const [locale, anchor] of Object.entries(publishedAnchors)) {
  test(locale + 'の記事は元の固定リンクで表示され、見出しとリンクの読み上げ名を持つ', async ({ page }) => {
    const prefix = locale === 'ja' ? '' : '/' + locale;
    await page.goto(prefix + '/blog/abe-hiroshi-website-challenge/#' + encodeURIComponent(anchor));
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toHaveCount(1);
    await expect(heading).toHaveAttribute('id', anchor);
    await expect(heading).toBeInViewport();
    const title = (await heading.locator('.lb-clause').allTextContents()).map(text => text.trim()).join(' ');
    await expect(heading).toHaveAccessibleName(title);
    const link = page.getByRole('link', {name: title, exact: true});
    await expect(link).toHaveAttribute('href', '#' + anchor);
    const target = await link.boundingBox();
    expect(target?.width).toBeGreaterThanOrEqual(44);
    expect(target?.height).toBeGreaterThanOrEqual(44);
    await link.focus();
    await expect(link).toBeFocused();
    await expect(link).toHaveAccessibleName(title);
    await page.keyboard.press('Enter');
    expect(decodeURIComponent(new URL(page.url()).hash.slice(1))).toBe(anchor);
    await expect(page.getByRole('heading', { level: 2 }).first()).toBeAttached();
  });
}
