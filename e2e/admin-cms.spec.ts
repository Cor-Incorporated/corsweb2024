import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';
import sharp from 'sharp';
import { expect, test, type Page } from '@playwright/test';

// CMS の管理画面（ADR-0018）を、本番と同じヘッダー（cms/firebase.json）で配信して確かめる。
// 実行: npm run build:cms && npm run test:e2e:admin（サーバーは cms/scripts/serve.mjs）。
// GitHub へのログインはしない。ログイン後の画面は、Sveltia の test-repo バックエンド（ブラウザ内のみ）で開く。

type HeaderRule = { source: string; headers: Array<{ key: string; value: string }> };
const firebase = JSON.parse(readFileSync('cms/firebase.json', 'utf8')) as {
  hosting: { headers: HeaderRule[] };
};
const declared = (source: string, key: string) =>
  firebase.hosting.headers
    .find((rule) => rule.source === source)
    ?.headers.find((header) => header.key === key)?.value;
const CSP = declared('**', 'Content-Security-Policy') ?? '';

test.use({ locale: 'ja-JP' });

// CI のランナーの遅さを手元で再現する（例: CMS_E2E_CPU_THROTTLE=6 npm run test:e2e:admin）。CI では使わない。
// 値を打ち間違えて黙って効かなくなる（「再現しない」と誤る）のを防ぐため、1 以上の数でなければ止める。
const throttleEnv = process.env.CMS_E2E_CPU_THROTTLE;
const cpuThrottle = throttleEnv === undefined || throttleEnv === '' ? 1 : Number(throttleEnv);
if (!Number.isFinite(cpuThrottle) || cpuThrottle < 1) {
  throw new Error(`CMS_E2E_CPU_THROTTLE は 1 以上の数にしてください（${throttleEnv}）`);
}
test.beforeEach(async ({ page, browserName }) => {
  if (cpuThrottle > 1) {
    // CPU を遅くする CDP の命令は Chromium だけにある
    if (browserName !== 'chromium') throw new Error(`CMS_E2E_CPU_THROTTLE は Chromium でだけ使えます（${browserName}）`);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuThrottle });
  }
});

// CSP 違反を集める。文書の securitypolicyviolation イベントと、コンソールの CSP エラーの両方を見る。
const watchCsp = async (page: Page) => {
  const fromConsole: string[] = [];
  page.on('console', (message) => {
    if (/Content Security Policy|Refused to/i.test(message.text()))
      fromConsole.push(message.text());
  });
  await page.addInitScript(() => {
    const store = window as unknown as { __csp: string[] };
    store.__csp = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      store.__csp.push(`${event.effectiveDirective} ${event.blockedURI}`);
    });
  });
  return async () => [
    ...(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)),
    ...fromConsole,
  ];
};

// config.yml を test-repo バックエンドに差し替えて、ログインせずに編集画面を開く（CSP は本物のまま）。
const openEditorWithTestBackend = async (page: Page) => {
  const config = yaml.load(readFileSync('cms/public/config.yml', 'utf8')) as Record<
    string,
    unknown
  >;
  const body = yaml.dump({ ...config, backend: { name: 'test-repo' }, publish_mode: 'simple' });
  await page.route('**/config.yml*', (route) =>
    route.fulfill({ status: 200, contentType: 'text/yaml', body })
  );
  await page.goto('/');
  await page.getByRole('button').filter({ hasText: 'テストリポジトリで作業' }).click();
  await page.getByRole('button').filter({ hasText: '新規作成' }).first().click();
  // 見出しは「⁨ブログ記事⁩ を作成」（Sveltia は差し込む語を方向制御文字で囲む）なので、保存ボタンで判定する。
  await expect(page.getByRole('button', { name: '保存', exact: true })).toBeVisible();
};

// 画像欄に PNG をアップロードする。config.yml の設定で WebP に変換される（WebAssembly のエンコーダーを使う）。
//
// Sveltia CMS（0.221.7）は、エディタの各欄も、オブジェクトの中の欄も、画面に入ってから描く（@sveltia/ui の
// VisibilityObserver。entry-editor.svelte と object-body.svelte）。画面の外の欄は高さ 64px の空の枠のまま待つ。
// 1. 「アイキャッチ画像」の欄そのものが、まだ描かれていないことがある（上に欄が増える・画面が低いとき）。描かれた最後の
//    欄を画面の上に寄せて、次の欄を画面に入れることを、チェックボックスが現れるまで繰り返す。
// 2. チェックのあと、中の欄（画像・代替テキスト）を画面に入れる。2026-10-01 の CI で 2 回落ちた（run 36837085826・
//    36839110638）: 編集画面を開く画面遷移（Sveltia は document.startViewTransition を使う）がまだ終わっておらず、
//    遷移中はどこを指しても <html> に当たるため、最初のクリックが `<html> intercepts pointer events` で弾かれ、
//    Playwright がやり直しでチェックボックスを画面の下端（block: 'end'）までしかスクロールしないので、中の欄が
//    画面の外で待ち続け、「参照」が出なかった（trace を取る CI の設定だと遅くなって起きやすい。手元では
//    CMS_E2E_CPU_THROTTLE=6 で 12 回中 6 回）。人はスクロールして見るので、テストでもチェックボックスを画面の上に寄せる。
const uploadPng = async (page: Page) => {
  const toggle = page.getByRole('checkbox', { name: /アイキャッチ画像/ });
  await expect(async () => {
    if ((await toggle.count()) === 0) {
      await page
        .getByRole('group', { name: /」フィールド$/ })
        .last()
        .evaluate((field) => field.scrollIntoView({ block: 'start' }));
    }
    await expect(toggle).toBeAttached({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  await toggle.check();
  await toggle.evaluate((element) => element.scrollIntoView({ block: 'start' }));
  // 画像欄（「参照」ボタン）が出てから、その隠れた file input にファイルを渡す。
  await expect(page.getByRole('button', { name: '参照', exact: true })).toBeVisible();
  const png = await sharp({
    create: { width: 64, height: 48, channels: 3, background: { r: 200, g: 60, b: 60 } },
  })
    .png()
    .toBuffer();
  await page
    .locator('input[type=file]')
    .first()
    .setInputFiles({ name: 'upload-test.png', mimeType: 'image/png', buffer: png });
};

test('ログイン画面: 本番と同じヘッダーで日本語表示され、CSP 違反が 0 件', async ({
  page,
  request,
}) => {
  const response = await request.get('/');
  const headers = response.headers();
  expect(headers['content-security-policy']).toBe(CSP);
  expect(CSP).toContain("frame-ancestors 'none'");
  expect(headers['cross-origin-opener-policy']).toBe('same-origin-allow-popups');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['referrer-policy']).toBe('same-origin');
  expect(headers['x-robots-tag']).toContain('noindex');
  expect(headers['cache-control']).toBe('no-cache');
  expect((await request.get('/config.yml')).headers()['cache-control']).toBe('no-cache');

  const html = await response.text();
  expect(html).toMatch(/<meta\b(?=[^>]*\bname=["']?robots\b)[^>]*\bcontent=["']?noindex/);
  expect(html).toMatch(/<link\b(?=[^>]*\brel=["']?cms-config-url\b)[^>]*\bhref=["']?\/config\.yml/);

  const origin = new URL(response.url()).origin;
  const violations = await watchCsp(page);
  const cache: string[] = [];
  const offOrigin: string[] = [];
  page.on('response', (res) => {
    const url = new URL(res.url());
    if (!url.protocol.startsWith('http') || url.origin !== origin) return;
    const expected = url.pathname.startsWith('/assets/') ? /immutable/ : /^no-cache$/;
    const actual = res.headers()['cache-control'] ?? '';
    if (!expected.test(actual)) cache.push(`${url.pathname} ${actual}`);
  });
  page.on('request', (req) => {
    const type = req.resourceType();
    if (!['script', 'stylesheet', 'font'].includes(type) || !req.url().startsWith('http')) return;
    if (new URL(req.url()).origin !== origin) offOrigin.push(req.url());
  });

  await page.goto('/');
  await expect(page.getByRole('button', { name: /GitHub\S* にログイン/ })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText('Cor.inc コンテンツ管理', { exact: true })).toBeVisible();
  expect(offOrigin, 'CMS の JS・CSS・フォントは CDN ではなく自オリジンから読む').toEqual([]);
  expect(cache, 'assets/ は immutable、それ以外は no-cache').toEqual([]);
  expect(await violations()).toEqual([]);
});

// HEIC の変換（Web Worker）と、Chrome 以外での WebP 変換は WebAssembly を使う（'wasm-unsafe-eval' が要る）。
// Chromium の PNG → WebP は canvas で変換され WebAssembly を通らないため、最小の WebAssembly モジュールで確かめる。
const compileWasm = (page: Page) =>
  page.evaluate(async () => {
    try {
      await WebAssembly.compile(new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]));
      return 'compiled';
    } catch {
      return 'blocked';
    }
  });

test('編集画面と画像のアップロード（WebP 変換）: CSP 違反が 0 件', async ({ page }) => {
  const violations = await watchCsp(page);
  await openEditorWithTestBackend(page);
  await uploadPng(page);
  await expect(page.getByText('/images/blog/upload-test.webp')).toBeVisible({ timeout: 30_000 });
  expect(await compileWasm(page)).toBe('compiled');
  expect(await violations()).toEqual([]);
});

// 陰性対照: 検出の仕組みが働くことを毎回確かめる。CSP から必要な許可元を 1 つ外すと違反が出る。
const withCsp = async (page: Page, csp: string) => {
  await page.route('**/', async (route) => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const response = await route.fetch();
    return route.fulfill({
      response,
      headers: { ...response.headers(), 'content-security-policy': csp },
    });
  });
};

test('陰性対照: img-src から blob: を外すと、ログイン画面で CSP 違反が検出される', async ({
  page,
}) => {
  const mutated = CSP.replace("img-src 'self' blob: data:", "img-src 'self' data:");
  expect(mutated).not.toBe(CSP);
  await withCsp(page, mutated);
  const violations = await watchCsp(page);
  await page.goto('/');
  await expect
    .poll(async () => (await violations()).join('\n'), { timeout: 30_000 })
    .toMatch(/img-src/);
});

test("陰性対照: script-src から 'wasm-unsafe-eval' を外すと、WebAssembly が止まり CSP 違反が検出される", async ({
  page,
}) => {
  const mutated = CSP.replace(" 'wasm-unsafe-eval'", '');
  expect(mutated).not.toBe(CSP);
  await withCsp(page, mutated);
  const violations = await watchCsp(page);
  await page.goto('/');
  expect(await compileWasm(page)).toBe('blocked');
  await expect
    .poll(async () => (await violations()).join('\n'), { timeout: 30_000 })
    .toMatch(/script-src|wasm/i);
});
