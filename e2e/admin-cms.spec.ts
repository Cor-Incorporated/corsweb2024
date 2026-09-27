import { expect, test } from '@playwright/test';

// CMS の管理画面（ADR-0018）。ビルド済みの dist を astro preview で配信して確かめる
// （playwright.admin.config.ts から実行。dev サーバーでは CSS の除去が効かないため対象外）。
// GitHub へのログインはしない。ログイン画面が日本語で出るところまでを見る。

test.use({ locale: 'ja-JP' });

test('/admin/ に Sveltia CMS のログイン画面が日本語で出て、CMS 本体は自サイトから読まれる', async ({
  page,
  request,
  baseURL,
}) => {
  // 配信される HTML そのもの（クローラーが見るもの）を確かめる。属性の順序は minify で変わるので先読みで判定する。
  const html = await (await request.get('/admin/')).text();
  expect(html).toMatch(/<meta\b(?=[^>]*\bname=["']?robots\b)[^>]*\bcontent=["']?noindex/);
  expect(html).toMatch(
    /<link\b(?=[^>]*\brel=["']?cms-config-url\b)[^>]*\bhref=["']?\/admin\/config\.yml/
  );
  expect(html, 'サイトの CSS を管理画面に読み込まない').not.toMatch(/rel=["']?stylesheet/);

  const origin = new URL(baseURL ?? page.url()).origin;
  const offOrigin: string[] = [];
  page.on('request', (req) => {
    const type = req.resourceType();
    const url = req.url();
    if (
      ['script', 'stylesheet', 'font'].includes(type) &&
      url.startsWith('http') &&
      new URL(url).origin !== origin
    ) {
      offOrigin.push(`${type} ${url}`);
    }
  });

  await page.goto('/admin/');
  await expect(page.getByRole('button', { name: /GitHub\S* にログイン/ })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText('Cor.inc コンテンツ管理', { exact: true })).toBeVisible();
  expect(offOrigin, 'CMS の JS・CSS・フォントは CDN ではなく自サイトから読む').toEqual([]);
});
