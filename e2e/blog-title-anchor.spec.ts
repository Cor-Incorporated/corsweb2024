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

test('390pxの記事見出しは固定リンクと重ならず、最終行に話の1文字を残さない', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/blog/zundamon-lt-project/');
  await page.evaluate(() => document.fonts.ready);
  // 端末間の字幅の差を含め、CIの390pxで観測された折り返しを再現する。
  for (const spacing of ['0px', '0.5px', '1px']) {
    const lines = await page.getByRole('heading', { level: 1 }).evaluate((heading, spacing) => {
      const clause = heading.querySelector<HTMLElement>('.lb-clause')!;
      clause.style.letterSpacing = spacing;
      const text = clause.firstChild as Text;
      const link = heading.parentElement!.querySelector('a')!.getBoundingClientRect();
      const range = document.createRange();
      const byLine = new Map<number, string>();
      let overlaps = false;
      for (let i = 0; i < text.length; i++) {
        range.setStart(text, i);
        range.setEnd(text, i + 1);
        // WebKitは行頭の文字に、前の行末の幅0の矩形も返す。
        const box = Array.from(range.getClientRects()).find(rect => rect.width > 0);
        if (!box) continue;
        byLine.set(box.top, (byLine.get(box.top) ?? '') + text.data[i]);
        overlaps ||= box.top < link.bottom && box.bottom > link.top &&
          box.left < link.right && box.right > link.left;
      }
      return { last: [...byLine.values()].at(-1), overlaps, linkWidth: link.width, linkHeight: link.height };
    }, spacing);
    expect(lines.last).toMatch(/.話$/u);
    expect(lines.overlaps).toBe(false);
    expect(Math.min(lines.linkWidth, lines.linkHeight)).toBeGreaterThanOrEqual(44);
  }
});
