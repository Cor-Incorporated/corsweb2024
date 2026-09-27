import { expect, test, type Page } from '@playwright/test';

// Epic #330 / #293: KaTeX の CSS を jsDelivr から全 60 記事で描画ブロック読込していた（数式を描画する記事は
// ja 20 本中 1 本 = complete-markdown-guide。5 言語版を合わせて 5 本）。
// 数式記事だけで自前ホストの CSS を読み、数式の表示が崩れないこと・CDN / preload 警告が出ないことを確かめる。

function watch(page: Page) {
  const katexCdn: string[] = [];
  const fontFailures: string[] = [];
  const warnings: string[] = [];
  page.on('request', (request) => {
    if (/cdn\.jsdelivr\.net\/npm\/katex/.test(request.url())) katexCdn.push(request.url());
  });
  page.on('response', (response) => {
    if (/KaTeX_/.test(response.url()) && response.status() >= 400) fontFailures.push(`${response.status()} ${response.url()}`);
  });
  page.on('console', (message) => {
    if (/preload|katex/i.test(message.text())) warnings.push(message.text());
  });
  return { katexCdn, fontFailures, warnings };
}

test('renders math with self-hosted KaTeX CSS and fonts on a math article', async ({ page }) => {
  const seen = watch(page);
  await page.goto('/blog/complete-markdown-guide/');
  const display = page.locator('.katex-display').first();
  await display.scrollIntoViewIfNeeded();
  await expect(display).toBeVisible();

  // CSS が効いていれば MathML 側は視覚的に隠れ、KaTeX のフォントで HTML 側だけが描かれる
  const mathmlPosition = await page.locator('.katex .katex-mathml').first().evaluate((el) => getComputedStyle(el).position);
  expect(mathmlPosition).toBe('absolute');
  const fontFamily = await page.locator('.katex').first().evaluate((el) => getComputedStyle(el).fontFamily);
  expect(fontFamily).toContain('KaTeX_Main');
  await expect
    .poll(() =>
      page.evaluate(async () => {
        await document.fonts.ready;
        return [...document.fonts].some((face) => face.family.includes('KaTeX_Main') && face.status === 'loaded');
      }),
    )
    .toBe(true);
  await display.screenshot({ path: 'test-results/katex/math-display.png' });

  expect(seen.katexCdn).toEqual([]);
  expect(seen.fontFailures).toEqual([]);
  expect(seen.warnings).toEqual([]);
});

test('does not load KaTeX CSS on an article without math (#293 page)', async ({ page }) => {
  const seen = watch(page);
  await page.goto('/blog/ai-development-estimate-knowledge-asset/');
  await expect(page.locator('main h1').first()).toBeVisible();
  const hasKatexCss = await page.evaluate(() =>
    [...document.styleSheets].some((sheet) => {
      try {
        return [...sheet.cssRules].some((rule) => rule.cssText.includes('.katex'));
      } catch {
        return (sheet.href ?? '').includes('katex');
      }
    }),
  );
  expect(hasKatexCss).toBe(false);
  expect(seen.katexCdn).toEqual([]);
  expect(seen.warnings).toEqual([]);
});
