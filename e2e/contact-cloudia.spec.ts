import { expect, test } from '@playwright/test';
import { CLOUDIA_UNAVAILABLE_COPY } from '../src/components/contact/chat/cloudiaUnavailableCopy';

const query = '?intent=grift-team-beta&source=grift-lp-hero&utm_source=grift&utm_medium=cta';

test.describe('Cloudia contact routing', () => {
  for (const locale of ['ja', 'en', 'zh', 'ko', 'es']) {
    for (const width of [320, 1280]) {
      test(`retires the general contact screen and keeps dedicated links (${locale}, ${width}px)`, async ({ page }) => {
        const prefix = locale === 'ja' ? '' : `/${locale}`;
        await page.setViewportSize({ width, height: 800 });
        await page.route('https://calendar.google.com/**', (route) => route.abort());
        await page.goto(`${prefix}/contact/`);
        await expect(page).toHaveURL(`/contact/chat/?source=contact-legacy&locale=${locale}`);
        await page.goto(`${prefix}/`);
        await expect(page.locator('[data-home-industry-entry] a')).toHaveCount(5);
        await expect(page.locator('[data-legacy-chat-link]')).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
        const contact = page.locator('footer a[href*="source=footer&"]');
        await expect(page.locator('footer a[href*="source=corsweb-contact-primary"]')).toHaveCount(0);
        await expect(page.locator(`footer a[href="${prefix}/contact/materials/"]`)).toBeVisible();
        await expect(contact).toBeVisible();
        const supportUrl = new URL((await contact.getAttribute('href')) ?? '', page.url());
        expect(supportUrl.pathname).toBe('/contact/chat/');
        expect(supportUrl.searchParams.get('locale')).toBe(locale);
        for (const path of ['/privacy', '/legal/tokushoho']) {
          await expect(page.locator(`footer a[href="${prefix}${path}"]`).first()).toBeVisible();
        }

        await page.goto(`${prefix}/contact/?source=footer-calendar#contact-calendar`);
        if (process.env.PUBLIC_GCAL_ID) {
          await expect(page).toHaveURL(`${prefix}/company/?source=footer-calendar#contact-calendar`);
          const frame = page.locator('#contact-calendar iframe:visible');
          const embed = new URL((await frame.getAttribute('src')) ?? '');
          expect(embed.hostname).toBe('calendar.google.com');
          expect(embed.searchParams.get('src')).toBe(process.env.PUBLIC_GCAL_ID);
          expect(embed.searchParams.get('mode')).toBe(width < 768 ? 'AGENDA' : 'MONTH');
          const standalone = page.locator('#contact-calendar a');
          const standaloneUrl = new URL((await standalone.getAttribute('href')) ?? '');
          expect(standaloneUrl.hostname).toBe(embed.hostname);
          expect(standaloneUrl.searchParams.get('src')).toBe(embed.searchParams.get('src'));
          await page.keyboard.press('Tab');
          await expect(standalone).toBeFocused();
        } else {
          await expect(page).toHaveURL(`${prefix}/company/#company-profile`);
          await expect(page.locator('#company-profile')).toBeVisible();
        }
      });
    }
  }

  for (const [locale, label] of [
    ['ja', 'AIチャットで問い合わせる'],
    ['en', 'Contact via AI chat'],
    ['zh', '通过 AI 聊天联系我们'],
    ['ko', 'AI 채팅으로 문의하기'],
    ['es', 'Contacto por chat con IA'],
  ]) {
    test(`opens the general chat launcher on the initial page load (${locale})`, async ({ page }) => {
      const prefix = locale === 'ja' ? '' : `/${locale}`;
      await page.route('**/contact/chat/**', (route) => route.fulfill({ body: '<title>Cloudia fixture</title>' }));
      await page.goto(`${prefix}/about/`, { waitUntil: 'domcontentloaded' });
      const trigger = page.locator('#cloudia-launcher').getByRole('button', { name: label, exact: true });
      await trigger.focus();
      await page.keyboard.press('Enter');
      await expect(trigger).toHaveCount(0);
      await expect(page.locator('#cloudia-launcher-open')).toHaveAttribute('aria-expanded', 'true');
      const frame = new URL((await page.locator('#cloudia-launcher-frame').getAttribute('src')) ?? '', page.url());
      expect(Object.fromEntries(frame.searchParams)).toEqual({ source: 'corsweb-launcher', locale, embed: '1' });
      await page.keyboard.press('Escape');
      await expect(trigger).toBeFocused();
    });
  }

  test('opens the approved Grift launcher with context and a separate-chat fallback', async ({ page }) => {
    await page.route('**/contact/chat/**', (route) => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    await page.goto(`/${query}`);
    await page.locator('#cloudia-launcher-open').click();
    await expect(page.locator('#cloudia-launcher-panel')).toBeVisible();
    const frame = new URL((await page.locator('#cloudia-launcher-frame').getAttribute('src')) ?? '', page.url());
    const fallback = new URL((await page.locator('[data-cloudia-fallback-link]').getAttribute('href')) ?? '', page.url());
    expect(frame.searchParams.get('embed')).toBe('1');
    expect(fallback.searchParams.has('embed')).toBe(false);
    for (const destination of [frame, fallback]) {
      expect(destination.pathname).toBe('/contact/chat/');
      expect(destination.searchParams.get('intent')).toBe('grift-team-beta');
      expect(destination.searchParams.get('source')).toBe('grift-lp-hero');
      expect(destination.searchParams.get('locale')).toBe('ja');
    }
  });

  test('redirects a previous Grift link directly and keeps its allowed identifiers', async ({ page }) => {
    await page.route('**/contact/chat/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<title>Cloudia fixture</title>' })
    );
    await page.goto(`/contact/${query}`);
    await expect(page).toHaveURL((url) => url.pathname === '/contact/chat/');
    await expect(page).toHaveTitle('Cloudia fixture');
    const target = new URL(page.url());
    expect(Object.fromEntries(target.searchParams)).toEqual({
      locale: 'ja', intent: 'grift-team-beta', source: 'grift-lp-hero', utm_source: 'grift', utm_medium: 'cta',
    });
  });

  test('drops duplicate and unknown tracking data on the direct route', async ({ page }) => {
    await page.route('**/contact/chat/**', (route) => route.fulfill({ body: 'Cloudia fixture' }));
    await page.goto('/contact/?intent=grift-team-beta&source=grift-lp-hero&source=other&utm_source=grift&utm_source=other&utm_medium=wrong&utm_campaign=private&embed=1&locale=en');
    await expect(page).toHaveURL((url) => url.pathname === '/contact/chat/');
    expect(Object.fromEntries(new URL(page.url()).searchParams)).toEqual({ locale: 'ja', intent: 'grift-team-beta' });
    await page.goto('/contact/?intent=grift-team-beta&intent=contract-dev');
    await expect(page).toHaveURL('/contact/chat/?source=contact-legacy&locale=ja');
  });

  test('offers localized chat when JavaScript is unavailable', async ({ browser, baseURL }) => {
    const noJs = await browser.newPage({ javaScriptEnabled: false });
    try {
      await noJs.goto(new URL('/es/contact/?intent=grift-team-beta', baseURL).href);
      const chat = noJs.getByRole('link', { name: 'Contacto por chat con IA', exact: true }).first();
      await expect(chat).toHaveAttribute('href', '/contact/chat/?source=contact-legacy&locale=es');
      await chat.click();
      await expect(noJs).toHaveURL(/\/contact\/chat\/\?source=contact-legacy&locale=es$/);
    } finally {
      await noJs.close();
    }
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

  // 旧URLの両表記から直接受付へ進み、受付が開けない場合にも旧URLへ戻さない。
  for (const path of ['/contact/', '/contact']) {
    test(`does not link back to a legacy contact URL when reception is unavailable (${path})`, async ({ page }) => {
      await page.goto(`${path}${query}`);
      await expect(page).toHaveURL((url) => url.pathname === '/contact/chat/');
      await expect(page.locator('[data-cloudia-unavailable-page]')).toBeVisible();
      await expect(page.locator('main a[href="/contact"], main a[href="/contact/"], main a[href^="/contact/?"], main a[href^="/contact?"]')).toHaveCount(0);
    });
  }

  // 既知の目的を持つページの浮きボタンを、別ページから戻ったときにも使えるようにする。
  test('keeps the separate chat link on the home page after a ViewTransitions back navigation', async ({ page }) => {
    await page.goto(`/${query}`);
    await expect(page.locator('[data-cloudia-fallback-link]')).toHaveCount(1);
    // クライアント遷移だったことを証明する目印。フルリロードなら window が作り直されて消える。
    const sentinel = `vt-${Date.now()}-${Math.random()}`;
    await page.evaluate((value) => {
      (window as unknown as { __vtSentinel?: string }).__vtSentinel = value;
    }, sentinel);
    await page.locator('footer a[href="/about"]').first().click();
    await expect(page).toHaveURL(/\/about\/?$/);
    await page.goBack();
    await expect(page).toHaveURL(`/${query}`);
    expect(
      await page.evaluate(() => (window as unknown as { __vtSentinel?: string }).__vtSentinel)
    ).toBe(sentinel);
    // astro:page-load で再初期化され、逃げ道は単独のチャットを指す。
    const link = page.locator('[data-cloudia-fallback-link]');
    await expect(link).toHaveCount(1);
    expect(new URL((await link.getAttribute('href')) ?? '', page.url()).pathname).toBe('/contact/chat/');
  });

  test('uses the localized copy for the separate chat link on the localized home page', async ({ page }) => {
    await page.goto(`/en/${query}`);
    const link = page.locator('[data-cloudia-fallback-link]');
    await expect(link).toHaveText('Open the chat on a separate page');
    expect(new URL((await link.getAttribute('href')) ?? '', page.url()).searchParams.get('locale')).toBe('en');
  });

  test('opens and closes accessibly and restores focus', async ({ page }) => {
    await page.goto('/industries/medical/');

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
    await expect(openButton).toHaveText('AIチャットで問い合わせる');

    await openButton.click();
    await page.keyboard.press('Escape');
    await expect(panel).toHaveAttribute('aria-hidden', 'true');
    await expect(openButton).toBeFocused();
    await expect(openButton).toHaveText('AIチャットで問い合わせる');
  });

  test('keeps the embedded draft and launcher title accessible at 200% text size', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.route('**/contact/chat/**', (route) => route.fulfill({
      contentType: 'text/html',
      body: '<div id="root"><input aria-label="相談の下書き"></div>',
    }));
    await page.goto('/industries/medical/');

    const launcher = page.locator('#cloudia-launcher');
    await launcher.locator('h2, button, button span').evaluateAll((elements) => {
      const sizes = elements.map((element) => parseFloat(getComputedStyle(element).fontSize));
      elements.forEach((element, index) => {
        (element as HTMLElement).style.fontSize = `${sizes[index] * 2}px`;
      });
    });
    const openButton = page.locator('#cloudia-launcher-open');
    await openButton.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'AIチャットで問い合わせる' });
    await expect(dialog).toBeInViewport({ ratio: 1 });

    const titleLine = await dialog.locator('h2').evaluate((title) => {
      const style = getComputedStyle(title);
      return { font: parseFloat(style.fontSize), line: parseFloat(style.lineHeight) };
    });
    expect(titleLine.font).toBe(28);
    expect(titleLine.line).toBeGreaterThanOrEqual(titleLine.font);

    const draft = page.frameLocator('#cloudia-launcher-frame').getByRole('textbox', { name: '相談の下書き' });
    await draft.fill('合成の下書き');
    await draft.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(openButton).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(draft).toHaveValue('合成の下書き');
    await draft.evaluate((input) => input.addEventListener('keydown', (event) => {
      if (event instanceof KeyboardEvent && event.key === 'Escape') event.preventDefault();
    }, { once: true }));
    await draft.press('Escape');
    await expect(dialog).toBeVisible();
    await expect(draft).toHaveValue('合成の下書き');
  });

  // 開いている間もボタンの文字が開く前のままだと、もう一度押すと何が起きるか分からない。
  // 開いている間は問い合わせを閉じる旨の文字を表示し（× ボタンの「閉じる」とは名前を分ける）、押せば閉じてラベルが戻ることを固定する。
  test('turns the launcher button into a close button while the panel is open', async ({ page }) => {
    await page.goto('/industries/medical/');

    const openButton = page.locator('#cloudia-launcher-open');
    const panel = page.locator('#cloudia-launcher-panel');
    await expect(openButton).toHaveText('AIチャットで問い合わせる');

    await openButton.click();
    await expect(panel).toHaveAttribute('aria-hidden', 'false');
    await expect(openButton).toHaveText('お問い合わせを閉じる');
    await expect(openButton).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('button', { name: '閉じる', exact: true })).toHaveCount(1);

    await openButton.click();
    await expect(panel).toHaveAttribute('aria-hidden', 'true');
    await expect(openButton).toHaveText('AIチャットで問い合わせる');
    await expect(openButton).toHaveAttribute('aria-expanded', 'false');
    await expect(openButton).toBeFocused();
  });

  // zh・ko・es のページには、以前は英語の案内とボタンが出ていた。各言語で出ることを固定する。
  for (const { lang, launcher, close, closeLauncher } of [
    { lang: 'zh', launcher: '通过 AI 聊天联系我们', close: '关闭', closeLauncher: '关闭联系窗口' },
    { lang: 'ko', launcher: 'AI 채팅으로 문의하기', close: '닫기', closeLauncher: '문의 닫기' },
    { lang: 'es', launcher: 'Contacto por chat con IA', close: 'Cerrar', closeLauncher: 'Cerrar contacto' },
  ]) {
    test(`shows the launcher in the page language (${lang})`, async ({ page }) => {
      await page.goto(`/${lang}/${query}`);

      const openButton = page.locator('#cloudia-launcher-open');
      await expect(openButton).toHaveText(launcher);
      await openButton.click();
      await expect(openButton).toHaveText(closeLauncher);
      await expect(page.locator('#cloudia-launcher-close')).toHaveAttribute('aria-label', close);
    });
  }

  test('fits a mobile safe-area viewport without horizontal scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/${query}`);
    const openButton = page.locator('#cloudia-launcher-open');
    await openButton.click();
    await expect(openButton).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#cloudia-launcher-panel')).toBeVisible();

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

  for (const width of [320, 390]) {
    test(`keeps the first industry action reachable at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 700 });
      await page.goto('/#home-industry-entry');
      const medical = page.locator('[data-industry-entry="medical"]');
      await expect(medical).toBeInViewport({ ratio: 1 });
      await medical.focus();
      await expect(medical).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/\/industries\/medical\/?$/);
    });
  }

  test('uses the localized route locale for Cloudia', async ({ page }) => {
    await page.goto('/en/contact/?intent=estimate-audit&source=grift-lp-estimate&locale=ja');
    await expect(page).toHaveURL((url) => url.pathname === '/contact/chat/');
    const primaryUrl = new URL(page.url());

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
    await page.goto(`/${query}`);

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
    await page.goto(`/${query}`);
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
    await page.goto(`/${query}`);
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

type ChatStub = 'frame-denied' | 'redirect-contact' | 'empty-root' | 'drawn-root' | 'ready-message';

// cloudia:ready を送らない版の Cloudia（今の本番）。描けば #root に子の要素ができる。
const DRAWN_CLOUDIA = '<!doctype html><html><body><div id="root"><main>Cloudia</main></div></body></html>';

async function stubChat(page: import('@playwright/test').Page, stub: ChatStub) {
  await page.route(
    (url) => url.pathname.startsWith('/contact/chat'),
    async (route) => {
      if (stub === 'frame-denied') {
        // 枠の中（embed=1）だけを、埋め込みを拒む応答にする。単独で開けば Cloudia が描かれる。
        const embedded = new URL(route.request().url()).searchParams.get('embed') === '1';
        return route.fulfill({
          status: 200,
          contentType: 'text/html; charset=utf-8',
          headers: embedded ? { 'x-frame-options': 'DENY' } : {},
          body: DRAWN_CLOUDIA,
        });
      }
      if (stub === 'redirect-contact') {
        return route.fulfill({ status: 302, headers: { location: '/contact/' } });
      }
      const body = {
        // Cloudia の HTML は来たが、script が落ちて何も描かれない。
        'empty-root': '<!doctype html><html><body><div id="root"></div></body></html>',
        'drawn-root': DRAWN_CLOUDIA,
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
    // 通信そのものが途絶えているときも、枠は同じく読めない。そのときは link の先も開けず、ブラウザの誤りの画面で
    // 終わる（ブラウザの戻るで戻れる）。この試験は、枠だけが拒まれる形で、link の先で受付が成立することを見る。
    test(`(a) 枠の中だけ開けない: 単独のチャットへの link を押すと Cloudia が描かれる (${slug})`, async ({ page }) => {
      await stubChat(page, 'frame-denied');
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

      await fallback.locator('[data-cloudia-fallback-link]').click();
      await expect(page).toHaveURL((current) => current.pathname === '/contact/chat/');
      expect(new URL(page.url()).searchParams.get('source')).toBe(`industry-${slug}`);
      await expect(page.locator('#root > main')).toHaveText('Cloudia');
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

// 逃げ道は初め display:none で、見えない間に入った文は、画面読み上げによっては読まれない。パネルが閉じている間も同じ。
// 見せた後に文を入れ直していることを、文の変化が「逃げ道とパネルの両方が見えている間」に起きたかで確かめる。
// MutationObserver の知らせは後でまとめて届くので、届いた時の class ではなく、記録の順にパネルと逃げ道の class の
// 変化を追って、文が変わった時点で見えていたかを決める。class の記録は変わる前の値だけを持つので、変わった後の値は、
// 同じ要素の次の class の記録の前の値（最後の記録なら今の値）から読む（hidden を外さない書き直しでも記録は出る）。
async function recordFallbackMessageChanges(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const panel = document.getElementById('cloudia-launcher-panel');
    const fallback = document.getElementById('cloudia-launcher-fallback');
    const message = fallback?.querySelector('[data-cloudia-fallback-message]');
    const seen: boolean[] = [];
    (window as unknown as { __fallbackChanges?: boolean[] }).__fallbackChanges = seen;
    if (!panel || !fallback || !message || !panel.contains(fallback)) return;
    const isHidden = (classValue: string | null) => (classValue ?? '').split(/\s+/).includes('hidden');
    const hidden = new Map<Node, boolean>([
      [panel, isHidden(panel.getAttribute('class'))],
      [fallback, isHidden(fallback.getAttribute('class'))],
    ]);
    new MutationObserver((records) => {
      records.forEach((record, index) => {
        if (record.type === 'attributes' && hidden.has(record.target)) {
          const next = records
            .slice(index + 1)
            .find((later) => later.type === 'attributes' && later.target === record.target);
          hidden.set(record.target, isHidden(next ? next.oldValue : (record.target as Element).getAttribute('class')));
        } else if (message.contains(record.target)) {
          seen.push(!hidden.get(panel) && !hidden.get(fallback));
        }
      });
    }).observe(panel, {
      attributes: true,
      attributeFilter: ['class'],
      attributeOldValue: true,
      childList: true,
      characterData: true,
      subtree: true,
    });
  });
}

function fallbackMessageChanges(page: import('@playwright/test').Page) {
  return page.evaluate(() => [...((window as unknown as { __fallbackChanges?: boolean[] }).__fallbackChanges ?? [])]);
}

test.describe('Cloudia が開けないときの文を読み上げに届ける', () => {
  // 枠を読めないときは 8 秒の時間切れで、Cloudia でないと分かったときはすぐに見せる。
  // 後者は 8 秒を進めない（時間切れでもう一度文を差し込む道を通ると、入れ直しの有無を見分けられない）。
  for (const [stub, text, waitMs] of [
    ['frame-denied', FRAME_FAILED_JA, 8000],
    ['redirect-contact', UNAVAILABLE_JA, 0],
  ] as const) {
    test(`逃げ道を見せた後に文を入れ直す（${stub}）`, async ({ page }) => {
      await stubChat(page, stub);
      await page.clock.install();
      await page.goto('/industries/medical/');
      await recordFallbackMessageChanges(page);
      await page.locator('#cloudia-launcher-open').click();
      if (waitMs > 0) await page.clock.runFor(waitMs);
      const fallback = page.locator('#cloudia-launcher-fallback');
      await expect(fallback).toBeVisible();
      await expect(fallback).toHaveAttribute('role', 'status');
      await expect(fallback).toHaveAttribute('aria-live', 'polite');
      await page.clock.runFor(100);
      await expect(fallback.locator('[data-cloudia-fallback-message]')).toHaveText(text);
      const visibleChanges = () =>
        page.evaluate(
          () =>
            ((window as unknown as { __fallbackChanges?: boolean[] }).__fallbackChanges ?? []).filter(Boolean).length
        );
      await expect.poll(visibleChanges).toBe(1);
      // その後の確かめ（250ms ごと）や時間切れで、同じ文を見えている間に書き直さない（読み上げをくり返さない）。
      await page.clock.runFor(8000);
      await page.clock.runFor(100);
      expect(await visibleChanges()).toBe(1);
    });
  }

  // 時間切れの timer はパネルを閉じても止まらない。閉じている間に逃げ道が出ても、そのときは入れ直さず
  // （読まれない）、開いた次の描画で 1 回だけ入れ直す。
  test('閉じている間に時間切れが来ても、開いたときに文を入れ直す（枠だけ開けない）', async ({ page }) => {
    await stubChat(page, 'frame-denied');
    await page.clock.install();
    await page.goto('/industries/medical/');
    await recordFallbackMessageChanges(page);
    await page.locator('#cloudia-launcher-open').click();
    await page.clock.runFor(2000);
    await page.locator('#cloudia-launcher-close').click();
    await expect(page.locator('#cloudia-launcher-panel')).toBeHidden();
    await page.clock.runFor(6500);
    await page.clock.runFor(100);
    expect(await fallbackMessageChanges(page)).toEqual([]);

    await page.locator('#cloudia-launcher-open').click();
    const fallback = page.locator('#cloudia-launcher-fallback');
    await expect(fallback).toBeVisible();
    await expect(fallback.locator('[data-cloudia-fallback-message]')).toHaveText(FRAME_FAILED_JA);
    await page.clock.runFor(100);
    await expect.poll(() => fallbackMessageChanges(page)).toEqual([true]);
    await page.clock.runFor(8000);
    await page.clock.runFor(100);
    expect(await fallbackMessageChanges(page)).toEqual([true]);
  });
});

// 浮きボタンの逃げ道は locale の query を付けて、単独の /contact/chat/ を開く。Cloudia が配られていないときに出る
// 代わりのページも、その言語の終わりの文を出す（静的な build では query を読めないので、ページの script が替える）。
test.describe('/contact/chat/ の代わりのページの言語', () => {
  for (const locale of ['en', 'zh', 'ko', 'es'] as const) {
    test(`locale=${locale} で、その言語の終わりの文を出す`, async ({ page }) => {
      await page.goto(`/contact/chat/?source=industry-medical&locale=${locale}`);
      const unavailablePage = page.locator('[data-cloudia-unavailable-page]');
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(unavailablePage.locator('[data-cloudia-unavailable-message]')).toHaveText(
        CLOUDIA_UNAVAILABLE_COPY[locale].unavailable
      );
      // 見出しは ja と en だけ（合成監視の判定と同じ文）。zh・ko・es は終わりの文だけ。
      await expect(unavailablePage.locator('h1')).toHaveCount(locale === 'en' ? 1 : 0);
      await expect(unavailablePage.locator('a')).toHaveCount(0);
    });
  }

  for (const search of ['?locale=fr', '?locale=en&locale=zh', `?locale=${encodeURIComponent('zh"><img src=x>')}`]) {
    test(`知らない・重なった locale（${search}）は ja のまま`, async ({ page }) => {
      await page.goto(`/contact/chat/${search}`);
      await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
      await expect(page.locator('[data-cloudia-unavailable-page] h1')).toHaveText('AIチャットを準備しています');
      await expect(page.locator('[data-cloudia-unavailable-message]')).toHaveText(UNAVAILABLE_JA);
      await expect(page.locator('[data-cloudia-unavailable-page] img')).toHaveCount(0);
    });
  }
});
