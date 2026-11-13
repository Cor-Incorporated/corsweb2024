import { expect, test } from '@playwright/test';

const query = '?intent=grift-team-beta&source=grift-lp-hero&utm_source=grift&utm_medium=cta';

test.describe('Cloudia contact routing', () => {
  test('keeps LP intent and source in the primary link and launcher iframe', async ({ page }) => {
    await page.goto(`/contact/${query}`);

    const primaryLink = page.locator(
      'section[aria-labelledby="cloudia-contact-entry-title"] [data-cloudia-query-link]'
    );
    await expect(primaryLink).toHaveAttribute('href', /\/contact\/chat\/\?/);

    const primaryUrl = new URL((await primaryLink.getAttribute('href')) ?? '', page.url());
    expect(primaryUrl.searchParams.get('intent')).toBe('grift-team-beta');
    expect(primaryUrl.searchParams.get('source')).toBe('grift-lp-hero');
    expect(primaryUrl.searchParams.get('locale')).toBe('ja');

    const frame = page.locator('#cloudia-launcher-frame');
    await expect(frame).toHaveAttribute('src', /embed=1/);
    const frameUrl = new URL((await frame.getAttribute('src')) ?? '', page.url());
    expect(frameUrl.searchParams.get('intent')).toBe('grift-team-beta');
    expect(frameUrl.searchParams.get('source')).toBe('grift-lp-hero');
    expect(frameUrl.searchParams.get('locale')).toBe('ja');
    expect(frameUrl.searchParams.get('embed')).toBe('1');
  });

  // 枠の中だけ開けないときの逃げ道は、単独の /contact/chat/（embed なし）。/contact/ へは戻さない
  // （/contact/ の主ボタンも同じチャットを開くので、戻すと同じ所を回る。#352）。intent と source は引き回す。
  test('carries LP intent and source into the launcher fallback link to the separate chat page', async ({
    page,
  }) => {
    await page.goto(`/about/${query}`);
    const fallbackUrl = new URL(
      (await page.locator('[data-cloudia-fallback-link]').getAttribute('href')) ?? '',
      page.url()
    );
    expect(fallbackUrl.pathname).toBe('/contact/chat/');
    expect(fallbackUrl.searchParams.get('intent')).toBe('grift-team-beta');
    expect(fallbackUrl.searchParams.get('source')).toBe('grift-lp-hero');
    expect(fallbackUrl.searchParams.get('locale')).toBe('ja');
    expect(fallbackUrl.searchParams.get('embed')).toBeNull();

    await page.goto(`/en/about/${query}`);
    const localizedUrl = new URL(
      (await page.locator('[data-cloudia-fallback-link]').getAttribute('href')) ?? '',
      page.url()
    );
    expect(localizedUrl.pathname).toBe('/contact/chat/');
    expect(localizedUrl.searchParams.get('locale')).toBe('en');
  });

  // お問い合わせページの上でも、逃げ道は自分のページ（/contact/）を指さない。
  // 直接 /contact/ を開くケースだけだと偽 green になる。サイト内リンクの大半は末尾スラッシュ無しの
  // /contact で、ViewTransitions 遷移では location.pathname も /contact になるため、その経路も固定する。
  for (const path of ['/contact/', '/contact']) {
    test(`does not link back to the contact page from the contact page (${path})`, async ({ page }) => {
      await page.goto(path);
      const link = page.locator('[data-cloudia-fallback-link]');
      await expect(link).toHaveCount(1);
      expect(new URL((await link.getAttribute('href')) ?? '', page.url()).pathname).toBe('/contact/chat/');
      await expect(page.locator('#cloudia-launcher-fallback a[href^="/contact/?"], #cloudia-launcher-fallback a[href="/contact/"]')).toHaveCount(0);
    });
  }

  test('keeps the separate chat link on /contact after a ViewTransitions navigation from another page', async ({
    page,
  }) => {
    await page.goto('/about/');
    await expect(page.locator('[data-cloudia-fallback-link]')).toHaveCount(1);
    // クライアント遷移だったことを証明する目印。フルリロードなら window が作り直されて消える。
    const sentinel = `vt-${Date.now()}-${Math.random()}`;
    await page.evaluate((value) => {
      (window as unknown as { __vtSentinel?: string }).__vtSentinel = value;
    }, sentinel);
    await page.locator('footer a[href="/contact"]').first().click();
    await expect(page).toHaveURL(/\/contact\/?$/);
    expect(
      await page.evaluate(() => (window as unknown as { __vtSentinel?: string }).__vtSentinel)
    ).toBe(sentinel);
    // astro:page-load で再初期化され、/contact でも逃げ道は単独のチャットを指す。
    const link = page.locator('[data-cloudia-fallback-link]');
    await expect(link).toHaveCount(1);
    expect(new URL((await link.getAttribute('href')) ?? '', page.url()).pathname).toBe('/contact/chat/');
  });

  test('uses the localized copy for the separate chat link on the localized contact page', async ({ page }) => {
    await page.goto('/en/contact/');
    const link = page.locator('[data-cloudia-fallback-link]');
    await expect(link).toHaveText('Open the chat on a separate page');
    expect(new URL((await link.getAttribute('href')) ?? '', page.url()).searchParams.get('locale')).toBe('en');
  });

  test('opens and closes accessibly and restores focus', async ({ page }) => {
    await page.goto('/contact/');

    const openButton = page.locator('#cloudia-launcher-open');
    const closeButton = page.locator('#cloudia-launcher-close');
    const panel = page.locator('#cloudia-launcher-panel');

    await openButton.click();
    await expect(openButton).toHaveAttribute('aria-expanded', 'true');
    await expect(panel).toHaveAttribute('aria-hidden', 'false');
    await expect(closeButton).toBeFocused();

    await closeButton.click();
    await expect(openButton).toHaveAttribute('aria-expanded', 'false');
    await expect(panel).toHaveAttribute('aria-hidden', 'true');
    await expect(openButton).toBeFocused();
    await expect(openButton).toHaveText('Cloudiaに相談する');

    await openButton.click();
    await page.keyboard.press('Escape');
    await expect(panel).toHaveAttribute('aria-hidden', 'true');
    await expect(openButton).toBeFocused();
    await expect(openButton).toHaveText('Cloudiaに相談する');
  });

  // 開いている間もボタンが「Cloudiaに相談する」のままだと、もう一度押すと何が起きるか分からない。
  // 開いている間は「Cloudiaを閉じる」と表示し（× ボタンの「閉じる」とは名前を分ける）、押せば閉じてラベルが戻ることを固定する。
  test('turns the launcher button into a close button while the panel is open', async ({ page }) => {
    await page.goto('/contact/');

    const openButton = page.locator('#cloudia-launcher-open');
    const panel = page.locator('#cloudia-launcher-panel');
    await expect(openButton).toHaveText('Cloudiaに相談する');

    await openButton.click();
    await expect(panel).toHaveAttribute('aria-hidden', 'false');
    await expect(openButton).toHaveText('Cloudiaを閉じる');
    await expect(openButton).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('button', { name: '閉じる', exact: true })).toHaveCount(1);

    await openButton.click();
    await expect(panel).toHaveAttribute('aria-hidden', 'true');
    await expect(openButton).toHaveText('Cloudiaに相談する');
    await expect(openButton).toHaveAttribute('aria-expanded', 'false');
    await expect(openButton).toBeFocused();
  });

  // zh・ko・es のページには、以前は英語の案内とボタンが出ていた。各言語で出ることを固定する。
  for (const { lang, title, cta, launcher, close, closeLauncher } of [
    { lang: 'zh', title: '请先与 Cloudia 沟通', cta: '打开 Cloudia', launcher: '咨询 Cloudia', close: '关闭', closeLauncher: '关闭 Cloudia' },
    { lang: 'ko', title: '먼저 Cloudia에게 상담해 주세요', cta: 'Cloudia 열기', launcher: 'Cloudia에게 상담하기', close: '닫기', closeLauncher: 'Cloudia 닫기' },
    { lang: 'es', title: 'Empiece con una conversación con Cloudia', cta: 'Abrir Cloudia', launcher: 'Consultar con Cloudia', close: 'Cerrar', closeLauncher: 'Cerrar Cloudia' },
  ]) {
    test(`shows the Cloudia entry and launcher in the page language (${lang})`, async ({ page }) => {
      await page.goto(`/${lang}/contact/`);

      const entry = page.locator('section[aria-labelledby="cloudia-contact-entry-title"]');
      await expect(entry.locator('#cloudia-contact-entry-title')).toHaveText(title);
      await expect(entry.locator('[data-cloudia-query-link]')).toHaveText(cta);
      await expect(entry).not.toContainText('Start with a conversation');

      const openButton = page.locator('#cloudia-launcher-open');
      await expect(openButton).toHaveText(launcher);
      await openButton.click();
      await expect(openButton).toHaveText(closeLauncher);
      await expect(page.locator('#cloudia-launcher-close')).toHaveAttribute('aria-label', close);
    });
  }

  test('fits a mobile safe-area viewport without horizontal scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/contact/${query}`);
    await page.locator('#cloudia-launcher-open').click();

    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      panel: document.getElementById('cloudia-launcher-panel')?.getBoundingClientRect(),
    }));

    expect(dimensions.scrollWidth).toBe(dimensions.clientWidth);
    expect(dimensions.panel?.left).toBeGreaterThanOrEqual(0);
    expect(dimensions.panel?.right).toBeLessThanOrEqual(390);
    expect(dimensions.panel?.bottom).toBeLessThanOrEqual(844);
  });

  test('uses the localized route locale for Cloudia', async ({ page }) => {
    await page.goto('/en/contact/?intent=estimate-audit&source=grift-lp-estimate');
    const primaryUrl = new URL(
      (await page
        .locator('section[aria-labelledby="cloudia-contact-entry-title"] [data-cloudia-query-link]')
        .getAttribute('href')) ?? '',
      page.url()
    );

    expect(primaryUrl.searchParams.get('intent')).toBe('estimate-audit');
    expect(primaryUrl.searchParams.get('source')).toBe('grift-lp-estimate');
    expect(primaryUrl.searchParams.get('locale')).toBe('en');
  });

  test('navigates only for an unexpired, exact Grift portal handoff from its iframe', async ({
    page,
  }) => {
    const handoffUrl = 'https://app.griftai.org/chat/portal/opaque-token_123.~';
    await page.route('https://app.griftai.org/**', async (route) => {
      await route.fulfill({ contentType: 'text/html', body: '<title>Grift portal</title>' });
    });
    await page.goto('/contact/');

    await Promise.all([
      page.waitForURL(handoffUrl),
      page.evaluate(
        ({ url, expiresAt }) => {
          const frame = document.getElementById('cloudia-launcher-frame');
          if (!(frame instanceof HTMLIFrameElement) || !frame.contentWindow) {
            throw new Error('Cloudia iframe is unavailable');
          }
          window.dispatchEvent(
            new MessageEvent('message', {
              data: { type: 'cloudia:grift-handoff-ready', url, expiresAt },
              origin: window.location.origin,
              source: frame.contentWindow,
            })
          );
        },
        { url: handoffUrl, expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() }
      ),
    ]);

    await expect(page).toHaveTitle('Grift portal');
  });

  test('rejects forged sources, origins, URL variants, and invalid handoff TTLs', async ({
    page,
  }) => {
    await page.goto('/contact/');
    const originalUrl = page.url();
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const cases: Array<{
      url: string;
      expiresAt: string;
      origin?: string;
      useFrameSource?: boolean;
    }> = [
      {
        url: 'https://app.griftai.org/chat/portal/token',
        expiresAt: future,
        origin: 'https://evil.example',
      },
      {
        url: 'https://app.griftai.org/chat/portal/token',
        expiresAt: future,
        useFrameSource: false,
      },
      { url: 'https://user:password@app.griftai.org/chat/portal/token', expiresAt: future },
      {
        url: 'https://app.griftai.org/chat/portal/token?next=https://evil.example',
        expiresAt: future,
      },
      { url: 'https://app.griftai.org/chat/portal/token#next', expiresAt: future },
      { url: 'https://app.griftai.org/chat/portal/token%2Fadmin', expiresAt: future },
      { url: 'https://app.griftai.org/admin/token', expiresAt: future },
      { url: 'https://evil.example/chat/portal/token', expiresAt: future },
      {
        url: 'https://app.griftai.org/chat/portal/token',
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      },
      {
        url: 'https://app.griftai.org/chat/portal/token',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000 + 60_000).toISOString(),
      },
      { url: 'https://app.griftai.org/chat/portal/token', expiresAt: 'not-a-date' },
    ];

    for (const invalid of cases) {
      await page.evaluate(({ url, expiresAt, origin, useFrameSource }) => {
        const frame = document.getElementById('cloudia-launcher-frame');
        if (!(frame instanceof HTMLIFrameElement) || !frame.contentWindow) {
          throw new Error('Cloudia iframe is unavailable');
        }
        window.dispatchEvent(
          new MessageEvent('message', {
            data: { type: 'cloudia:grift-handoff-ready', url, expiresAt },
            origin: origin || window.location.origin,
            source: useFrameSource === false ? window : frame.contentWindow,
          })
        );
      }, invalid);
    }

    await page.waitForTimeout(50);
    await expect(page).toHaveURL(originalUrl);
  });

  test('keeps the existing cloudia:ready message contract with same-origin checks', async ({
    page,
  }) => {
    await page.goto('/contact/');
    const fallback = page.locator('#cloudia-launcher-fallback');
    await fallback.evaluate((element) => element.classList.remove('hidden'));

    await page.evaluate(() => {
      const frame = document.getElementById('cloudia-launcher-frame');
      if (!(frame instanceof HTMLIFrameElement) || !frame.contentWindow) {
        throw new Error('Cloudia iframe is unavailable');
      }
      window.dispatchEvent(
        new MessageEvent('message', {
          data: 'cloudia:ready',
          origin: window.location.origin,
          source: frame.contentWindow,
        })
      );
    });

    await expect(fallback).toHaveClass(/hidden/);
  });
});

// Cloudia が開けないときに、業種のページから来た人が行き止まりにならないこと（#352）。
// 型ごとに終わり方を数える。合格は「別の経路で受付が成立する（単独のチャットへの link）」か
// 「受け付けられないと分かる形で止まる（link を出さない終わりの文）」。黙って何も起きない・
// 同じ壊れた画面へ戻るだけ、は不合格。電話の行は定数の後ろで、既定では出さない。
const INDUSTRY_SLUGS = ['medical', 'shigyo', 'construction', 'manufacturing', 'education'] as const;
const FRAME_FAILED_JA = 'この枠ではチャットを開けませんでした。別の画面で開き直してください。';
const UNAVAILABLE_JA = '現在AIチャットをご利用いただけません。お手数ですが、時間をおいて再度お試しください。';

type ChatStub = 'abort' | 'redirect-contact' | 'empty-root' | 'drawn-root' | 'ready-message';

async function stubChat(page: import('@playwright/test').Page, stub: ChatStub) {
  await page.route(
    (url) => url.pathname.startsWith('/contact/chat'),
    async (route) => {
      if (stub === 'abort') return route.abort('failed');
      if (stub === 'redirect-contact') {
        return route.fulfill({ status: 302, headers: { location: '/contact/' } });
      }
      const body = {
        // Cloudia の HTML は来たが、script が落ちて何も描かれない。
        'empty-root': '<!doctype html><html><body><div id="root"></div></body></html>',
        // cloudia:ready を送らない版の Cloudia（今の本番）。描けば #root に子の要素ができる。
        'drawn-root': '<!doctype html><html><body><div id="root"><main>Cloudia</main></div></body></html>',
        // 描いた後に cloudia:ready を送る版の Cloudia。
        'ready-message':
          '<!doctype html><html><body><div id="root"></div><script>parent.postMessage("cloudia:ready", location.origin)</script></body></html>',
      }[stub];
      return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body });
    }
  );
}

async function openLauncher(page: import('@playwright/test').Page, slug: string) {
  await page.clock.install();
  await page.goto(`/industries/${slug}/`);
  await page.locator('#cloudia-launcher-open').click();
}

async function expectStopped(page: import('@playwright/test').Page) {
  const fallback = page.locator('#cloudia-launcher-fallback');
  await expect(fallback).toBeVisible();
  await expect(fallback.locator('[data-cloudia-fallback-message]')).toHaveText(UNAVAILABLE_JA);
  await expect(fallback.locator('a')).toHaveCount(0);
  await expect(fallback.locator('a[href^="tel:"]')).toHaveCount(0);
}

test.describe('Cloudia が開けないときの終わり方（業種のページの浮きボタン）', () => {
  for (const slug of INDUSTRY_SLUGS) {
    test(`(a) 枠の中だけ開けない: 単独のチャットへの link で受付が成立する (${slug})`, async ({ page }) => {
      await stubChat(page, 'abort');
      await openLauncher(page, slug);
      await page.clock.runFor(8000);
      const fallback = page.locator('#cloudia-launcher-fallback');
      await expect(fallback).toBeVisible();
      await expect(fallback.locator('[data-cloudia-fallback-message]')).toHaveText(FRAME_FAILED_JA);
      const href = (await fallback.locator('[data-cloudia-fallback-link]').getAttribute('href')) ?? '';
      const url = new URL(href, page.url());
      expect(url.pathname).toBe('/contact/chat/');
      expect(url.searchParams.get('source')).toBe(`industry-${slug}`);
      expect(url.searchParams.get('locale')).toBe('ja');
      expect(url.searchParams.get('embed')).toBeNull();
      await expect(fallback.locator('a[href^="tel:"]')).toHaveCount(0);
    });

    test(`(b1) Cloudia が配られない（代わりのページ）: 受け付けられないと分かる形で止まる (${slug})`, async ({
      page,
    }) => {
      await openLauncher(page, slug);
      await expectStopped(page);
    });

    test(`(b2) 代わりのページも配れず /contact/ へ戻される: 止まり、/contact/ へは戻さない (${slug})`, async ({
      page,
    }) => {
      await stubChat(page, 'redirect-contact');
      await openLauncher(page, slug);
      await expectStopped(page);
    });

    test(`(b3) HTML は来たが描かれない: 時間切れで止まる (${slug})`, async ({ page }) => {
      await stubChat(page, 'empty-root');
      await openLauncher(page, slug);
      await expect(page.locator('#cloudia-launcher-fallback')).toBeHidden();
      await page.clock.runFor(8000);
      await expectStopped(page);
    });
  }

  for (const stub of ['drawn-root', 'ready-message'] as const) {
    test(`Cloudia が描けたら逃げ道を出さない（${stub === 'drawn-root' ? '合図を送らない版' : '合図を送る版'}）`, async ({
      page,
    }) => {
      await stubChat(page, stub);
      await openLauncher(page, 'medical');
      await page.clock.runFor(8000);
      await expect(page.locator('#cloudia-launcher-fallback')).toBeHidden();
    });
  }
});
