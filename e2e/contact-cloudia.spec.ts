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

  // fallback リンクの intent/source 引き回しは /contact 以外でこそ効く仕様。
  // /contact では自己リンクになるため導線を消している（CloudiaLauncher の同一ページ判定）ので、
  // 検証は別ページで行う。ロケール別ルートも同時に確認する。
  test('carries LP intent and source into the launcher fallback link off /contact', async ({
    page,
  }) => {
    await page.goto(`/about/${query}`);
    const fallbackUrl = new URL(
      (await page.locator('[data-cloudia-fallback-link]').getAttribute('href')) ?? '',
      page.url()
    );
    expect(fallbackUrl.pathname).toBe('/contact/');
    expect(fallbackUrl.searchParams.get('intent')).toBe('grift-team-beta');
    expect(fallbackUrl.searchParams.get('source')).toBe('grift-lp-hero');
    expect(fallbackUrl.searchParams.get('locale')).toBe('ja');

    await page.goto(`/en/about/${query}`);
    const localizedUrl = new URL(
      (await page.locator('[data-cloudia-fallback-link]').getAttribute('href')) ?? '',
      page.url()
    );
    expect(localizedUrl.pathname).toBe('/en/contact/');
  });

  // 「お問い合わせページから開き直して」は、すでにそのページにいる利用者には従えない指示。
  // 導線を消して終端文言に切り替える挙動を固定する（黙って自己リンクに戻らないように）。
  // 直接 /contact/ を開くケースだけだと偽 green になる。サイト内リンクの大半は末尾スラッシュ無しの
  // /contact で、ViewTransitions 遷移では location.pathname も /contact になるため、その経路も固定する。
  for (const path of ['/contact/', '/contact']) {
    test(`terminates instead of self-linking when already on the contact page (${path})`, async ({
      page,
    }) => {
      await page.goto(path);
      await expect(page.locator('[data-cloudia-fallback-link]')).toHaveCount(0);
      await expect(page.locator('#cloudia-launcher-fallback p')).toContainText(
        '時間をおいて再度お試しください'
      );
    });
  }

  test('terminates on /contact after a ViewTransitions navigation from another page', async ({
    page,
  }) => {
    await page.goto('/about/');
    // 遷移前（/about）では通常の案内とリンクがある。
    await expect(page.locator('[data-cloudia-fallback-link]')).toHaveCount(1);
    // クライアント遷移だったことを証明する目印。フルリロードなら window が作り直されて消える。
    // これが無いと、将来 data-astro-reload が付くなどして通常遷移になってもテストは緑のままになる。
    const sentinel = `vt-${Date.now()}-${Math.random()}`;
    await page.evaluate((value) => {
      (window as unknown as { __vtSentinel?: string }).__vtSentinel = value;
    }, sentinel);
    // サイト内の実リンク（末尾スラッシュ無し /contact）をクリックしてクライアント遷移させる。
    await page.locator('footer a[href="/contact"]').first().click();
    await expect(page).toHaveURL(/\/contact\/?$/);
    expect(
      await page.evaluate(() => (window as unknown as { __vtSentinel?: string }).__vtSentinel)
    ).toBe(sentinel);
    // astro:page-load で再初期化され、/contact では導線が消えていること。
    await expect(page.locator('[data-cloudia-fallback-link]')).toHaveCount(0);
    await expect(page.locator('#cloudia-launcher-fallback p')).toContainText(
      '時間をおいて再度お試しください'
    );
  });

  test('terminates in English on the localized contact page', async ({ page }) => {
    await page.goto('/en/contact/');
    await expect(page.locator('[data-cloudia-fallback-link]')).toHaveCount(0);
    await expect(page.locator('#cloudia-launcher-fallback p')).toContainText(
      'try again in a little while'
    );
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

    await openButton.click();
    await page.keyboard.press('Escape');
    await expect(panel).toHaveAttribute('aria-hidden', 'true');
    await expect(openButton).toBeFocused();
  });

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
