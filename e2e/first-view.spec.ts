// 最初の画面（scroll 0）に、5 業種の入口が 5 つとも見えるかを、14 の画面の大きさ × 5 言語と、パソコンの窓 5 つ
// （入口が入る言語だけ）で測る。
//
// 見える = 要素の上端が 0 以上・下端が画面の高さ以下・左右が画面の幅の中・display が none でない・visibility が hidden でない・
// 親まで掛けた opacity が 0.9 以上・要素の中の 9 点（横 25%・50%・75% × 縦 上の端から 2px・真ん中・下の端から 2px）が
// どれもその要素に届く（浮きボタンなどに、一部でも隠れていない）。
// ヒーローの h1 と主ボタンも同じ条件で数える（入口を入れた代わりに、ヒーローが押し出されていないか）。
// 各入口を押して、同じ言語の業種ページへ 1 回で進むことも確かめる。
// ヒーローの中のリンクとボタンは、Tab の順（DOM の順）が見た目の順（上から、同じ行は左から）と同じであること。
//
// 動かし方（ビルド結果で測る）:
//   npm run build
//   npx astro preview --host 127.0.0.1 --port 4392 &
//   FIRST_VIEW_BASE_URL=http://127.0.0.1:4392 npx playwright test e2e/first-view.spec.ts --project=chromium
// FIRST_VIEW_BASE_URL が無いときは、設定ファイルの baseURL（開発サーバー）で測る。
// 測った値は FIRST_VIEW_OUT_DIR（既定 test-results/first-view）に、画面と言語ごとの JSON と画像で残る。
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { INDUSTRY_SLUGS } from '../src/config/industry-context';

// よくある画面の大きさ。パソコンとタブレットは画面の解像度そのままで、ブラウザの枠とタスクバーを引いていない。
// 実際の窓はこれより 111〜135px ほど低い。その窓は下の WINDOWS で測る。
// スマホの 664・667・635・640 は、ブラウザの上下の枠を引いた表示の高さ。320×568 は対象にしない（ja でも 5 つは入らない）。
const VIEWPORTS = [
  { name: 'pc-1920x1080', width: 1920, height: 1080, mobile: false },
  { name: 'pc-1440x900', width: 1440, height: 900, mobile: false },
  { name: 'pc-1366x768', width: 1366, height: 768, mobile: false },
  { name: 'pc-1280x800', width: 1280, height: 800, mobile: false },
  { name: 'pc-1280x720', width: 1280, height: 720, mobile: false },
  { name: 'pc-1024x768', width: 1024, height: 768, mobile: false },
  { name: 'tab-768x1024', width: 768, height: 1024, mobile: false },
  { name: 'sp-414x896', width: 414, height: 896, mobile: true },
  { name: 'sp-390x844', width: 390, height: 844, mobile: true },
  { name: 'sp-390x664', width: 390, height: 664, mobile: true },
  { name: 'sp-375x812', width: 375, height: 812, mobile: true },
  { name: 'sp-375x667', width: 375, height: 667, mobile: true },
  { name: 'sp-375x635', width: 375, height: 635, mobile: true },
  { name: 'sp-360x640', width: 360, height: 640, mobile: true },
] as const;
const LOCALES = ['ja', 'en', 'zh', 'ko', 'es'] as const;
type Locale = (typeof LOCALES)[number];

// ブラウザの枠とタスクバーを引いたパソコンの窓（画面の解像度から 111〜135px 引いた高さ）。入口が 5 つとも入る
// 言語だけを見る。en・es は説明の文と主ボタンの文が長く、1366×657・1280×665 では入らない。1280×609（1280×720 の
// 画面の窓）は、どの言語も入らないので対象にしない。
const WINDOWS = [
  { name: 'win-1920x953', width: 1920, height: 953, mobile: false, locales: LOCALES },
  { name: 'win-1536x730', width: 1536, height: 730, mobile: false, locales: LOCALES },
  { name: 'win-1440x789', width: 1440, height: 789, mobile: false, locales: LOCALES },
  { name: 'win-1366x657', width: 1366, height: 657, mobile: false, locales: ['ja', 'zh', 'ko'] },
  { name: 'win-1280x665', width: 1280, height: 665, mobile: false, locales: ['ja', 'zh', 'ko'] },
] as const;

const OUT_DIR = path.resolve(process.env.FIRST_VIEW_OUT_DIR ?? 'test-results/first-view');
const ENTRY_SELECTOR = '[data-industry-entry]';
const H1_SELECTOR = 'main h1';
const PRIMARY_CTA_SELECTOR = '[data-hero-primary-cta]';
// ヒーローの演出（data-reveal）は最大 0.5s 遅れて 0.6s かけて出る。出終わってから測る。
const REVEAL_SETTLE_MS = 1500;

const homePath = (locale: Locale) => (locale === 'ja' ? '/' : `/${locale}/`);
const industryPath = (locale: Locale, slug: string) =>
  new RegExp(`^${locale === 'ja' ? '' : `/${locale}`}/industries/${slug}/?$`);

interface Box {
  id: string | null;
  href: string | null;
  top: number;
  bottom: number;
  left: number;
  right: number;
  display: string;
  visibility: string;
  opacity: number;
  hitSelf: boolean;
  inFold: boolean;
}

async function measure(page: Page, selector: string): Promise<Box[]> {
  return page.evaluate((sel) => {
    return Array.from(document.querySelectorAll<HTMLElement>(sel)).map((el) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      let opacity = 1;
      for (let node: HTMLElement | null = el; node; node = node.parentElement) {
        opacity *= Number(getComputedStyle(node).opacity);
      }
      // 横は 25%・50%・75%、縦は上の端から 2px・真ん中・下の端から 2px（下の端だけが浮きボタンに隠れるのも落とす）
      const xs = [0.25, 0.5, 0.75].map((fx) => rect.left + rect.width * fx);
      const ys = [rect.top + 2, rect.top + rect.height / 2, rect.bottom - 2];
      const hitSelf = xs.every((x) =>
        ys.every((y) => {
          const hit = document.elementFromPoint(x, y);
          return !!hit && (hit === el || el.contains(hit));
        }),
      );
      const inFold =
        rect.width > 0 &&
        rect.height > 0 &&
        rect.top >= 0 &&
        rect.bottom <= window.innerHeight &&
        rect.left >= 0 &&
        rect.right <= window.innerWidth &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        opacity >= 0.9 &&
        hitSelf;
      return {
        id: el.getAttribute('data-industry-entry'),
        href: el.getAttribute('href'),
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        display: style.display,
        visibility: style.visibility,
        opacity: Math.round(opacity * 100) / 100,
        hitSelf,
        inFold,
      };
    });
  }, selector);
}

async function openHome(page: Page, baseURL: string, locale: Locale, { settle }: { settle: boolean }) {
  await page.goto(new URL(homePath(locale), baseURL).toString(), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  // 押すだけのときは待たない（Playwright の click が、動きが止まるのを待つ）
  if (settle) await page.waitForTimeout(REVEAL_SETTLE_MS);
}

for (const viewport of [...VIEWPORTS, ...WINDOWS]) {
  for (const locale of LOCALES) {
    if ('locales' in viewport && !(viewport.locales as readonly Locale[]).includes(locale)) continue;
    test(`${viewport.name} ${locale}: 最初の画面に 5 業種の入口とヒーローの h1・主ボタンが見え、押すと業種ページへ進む`, async ({
      browser,
      browserName,
    }, testInfo) => {
      // トップを 6 回開く（測る 1 回と、押す 5 回）
      test.setTimeout(120_000);
      const baseURL = process.env.FIRST_VIEW_BASE_URL ?? testInfo.project.use.baseURL;
      expect(baseURL, 'FIRST_VIEW_BASE_URL か設定の baseURL が要る').toBeTruthy();
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        // isMobile は Chromium だけが受け付ける
        ...(viewport.mobile && browserName === 'chromium' ? { isMobile: true, hasTouch: true } : {}),
      });
      const page = await context.newPage();
      try {
        await openHome(page, baseURL!, locale, { settle: true });

        const entries = await measure(page, ENTRY_SELECTOR);
        const [h1] = await measure(page, H1_SELECTOR);
        const [primaryCta] = await measure(page, PRIMARY_CTA_SELECTOR);
        // ヒーローの中の、見えているリンクとボタンを DOM の順に並べ、見た目の順と比べる
        const heroFocusOrder = await page.evaluate(() => {
          const hero = document.querySelector('main section');
          if (!hero) return [];
          return Array.from(hero.querySelectorAll<HTMLElement>('a[href], button'))
            .filter((el) => getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0)
            .map((el) => {
              const rect = el.getBoundingClientRect();
              return { text: (el.textContent ?? '').trim().slice(0, 24), top: Math.round(rect.top), left: Math.round(rect.left) };
            });
        });
        const outOfOrder = heroFocusOrder.filter((cur, i) => {
          const prev = heroFocusOrder[i - 1];
          if (!prev) return false;
          const sameRow = Math.abs(cur.top - prev.top) < 12;
          return sameRow ? cur.left < prev.left : cur.top < prev.top;
        });
        // ヒーローの実績へのリンクは、パソコン用とスマホ用の 2 本。どの大きさでも、見えているのはちょうど 1 本
        const visibleWorksLinks = await page.evaluate((loc) => {
          const works = loc === 'ja' ? '/works' : `/${loc}/works`;
          const hero = document.querySelector('main section');
          return Array.from(hero?.querySelectorAll<HTMLAnchorElement>('a[href]') ?? []).filter(
            (a) => a.pathname.replace(/\/+$/, '') === works && a.getClientRects().length > 0 && getComputedStyle(a).visibility !== 'hidden',
          ).length;
        }, locale);
        const metrics = await page.evaluate(() => ({
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          scrollHeight: document.documentElement.scrollHeight,
          scrollWidth: document.documentElement.scrollWidth,
        }));

        mkdirSync(OUT_DIR, { recursive: true });
        const base = `${viewport.name}-${locale}`;
        await page.screenshot({ path: path.join(OUT_DIR, `${base}.png`) });

        // 押した先。毎回トップから押す（同じ言語の業種ページへ 1 回で進むか）
        const clicks: { id: string; pathname: string; ok: boolean }[] = [];
        for (const slug of INDUSTRY_SLUGS) {
          await openHome(page, baseURL!, locale, { settle: false });
          const target = page.locator(`[data-industry-entry="${slug}"]`);
          if ((await target.count()) !== 1) {
            clicks.push({ id: slug, pathname: '(入口が無い)', ok: false });
            continue;
          }
          await target.click();
          // waitForURL に正規表現を渡すと URL 全体（scheme と host を含む）に当たるので、path で判定する関数を渡す
          await page.waitForURL((url) => industryPath(locale, slug).test(url.pathname), { timeout: 10_000 }).catch(() => undefined);
          const pathname = new URL(page.url()).pathname;
          clicks.push({ id: slug, pathname, ok: industryPath(locale, slug).test(pathname) });
        }

        const result = {
          viewport: viewport.name,
          locale,
          baseURL,
          measuredAt: new Date().toISOString(),
          metrics: { ...metrics, heightRatio: Math.round((metrics.scrollHeight / metrics.innerHeight) * 10) / 10 },
          entriesInFold: entries.filter((entry) => entry.inFold).length,
          entries,
          h1,
          primaryCta,
          clicks,
          heroFocusOrder,
          visibleWorksLinks,
        };
        writeFileSync(path.join(OUT_DIR, `${base}.json`), `${JSON.stringify(result, null, 2)}\n`);

        expect(entries.map((entry) => entry.id), '入口の並びが INDUSTRY_SLUGS と違う').toEqual([...INDUSTRY_SLUGS]);
        for (const entry of entries) {
          expect.soft(entry.inFold, `${entry.id}: top=${entry.top} bottom=${entry.bottom} 画面の高さ=${metrics.innerHeight} opacity=${entry.opacity} hitSelf=${entry.hitSelf}`).toBe(true);
        }
        expect.soft(h1?.inFold, `h1: ${JSON.stringify(h1)}`).toBe(true);
        expect.soft(primaryCta?.inFold, `主ボタン: ${JSON.stringify(primaryCta)}`).toBe(true);
        expect.soft(metrics.scrollWidth, '横にはみ出している').toBeLessThanOrEqual(metrics.innerWidth);
        expect.soft(outOfOrder, `ヒーローの Tab の順が見た目の順と違う: ${JSON.stringify(heroFocusOrder)}`).toEqual([]);
        expect.soft(visibleWorksLinks, 'ヒーローで見えている「実績を見る」の本数').toBe(1);
        for (const click of clicks) {
          expect.soft(click.ok, `${click.id} を押した先: ${click.pathname}`).toBe(true);
        }
      } finally {
        await context.close();
      }
    });
  }
}

// ヘッダーのプルダウン（サービス・業種別・Cor.について・言語）を、キーボードで開いて中へ入り、Escape で閉じると、
// focus が開いたボタンへ戻ること（body へ落ちない）。
test('ヘッダーのプルダウンを Escape で閉じると、focus が開いたボタンへ戻る', async ({ browser }, testInfo) => {
  const baseURL = process.env.FIRST_VIEW_BASE_URL ?? testInfo.project.use.baseURL;
  expect(baseURL, 'FIRST_VIEW_BASE_URL か設定の baseURL が要る').toBeTruthy();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  try {
    await page.goto(new URL('/', baseURL!).toString(), { waitUntil: 'load' });
    const desktopMenus = ['services', 'industries', 'about'].map((menu) => {
      const list = page.locator(`nav[aria-label="主要ページ"] ul[data-menu="${menu}"]`);
      return { name: menu, list, button: list.locator('xpath=preceding-sibling::button') };
    });
    const langButton = page.locator('button', { has: page.locator('span.sr-only', { hasText: '言語を切り替え' }) });
    const menus = [...desktopMenus, { name: 'lang', list: langButton.locator('xpath=following-sibling::ul'), button: langButton }];
    for (const menu of menus) {
      await menu.button.focus();
      await page.keyboard.press('Enter');
      await expect(menu.button, `${menu.name}: Enter で開く`).toHaveAttribute('aria-expanded', 'true');
      await expect(menu.list.locator('a').first(), `${menu.name}: 最初のリンクが見える`).toBeVisible();
      await page.keyboard.press('Tab');
      await expect(menu.list.locator('a').first(), `${menu.name}: Tab でメニューの中へ入る`).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(menu.button, `${menu.name}: Escape で閉じる`).toHaveAttribute('aria-expanded', 'false');
      await expect(menu.button, `${menu.name}: focus が開いたボタンへ戻る`).toBeFocused();
    }
  } finally {
    await context.close();
  }
});

// 演出が働き始めてから（reveal-ready が付いてから）1 秒以内に、窓の中に在るヒーローの主ボタンが、スクロールを
// 待たずに見えること。演出（data-reveal）は窓の下 12% を除いて見え始めを決めるので、窓が低いと主ボタンが透明の
// まま残っていた。ブラウザの枠とタスクバーを引いたパソコンの窓（1366×657・1280×609・1536×730）と、上の 14 の
// 大きさで測る。初期化が load からどれだけ遅れるかは、この試験では測らない（最長 10 秒まで待つ）。
const LOAD_VISIBLE_SIZES = [
  { name: 'win-1366x657', width: 1366, height: 657, mobile: false },
  { name: 'win-1280x609', width: 1280, height: 609, mobile: false },
  { name: 'win-1536x730', width: 1536, height: 730, mobile: false },
  ...VIEWPORTS,
];
const LOAD_VISIBLE_MS = 1000;

for (const size of LOAD_VISIBLE_SIZES) {
  for (const locale of ['ja', 'en'] as const) {
    test(`${size.name} ${locale}: 演出が働き始めてから 1 秒以内に、窓の中のヒーローの主ボタンが見える`, async ({ browser, browserName }, testInfo) => {
      const baseURL = process.env.FIRST_VIEW_BASE_URL ?? testInfo.project.use.baseURL;
      expect(baseURL, 'FIRST_VIEW_BASE_URL か設定の baseURL が要る').toBeTruthy();
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        ...(size.mobile && browserName === 'chromium' ? { isMobile: true, hasTouch: true } : {}),
      });
      const page = await context.newPage();
      try {
        await page.goto(new URL(homePath(locale), baseURL!).toString(), { waitUntil: 'load' });
        // 演出の初期化（astro:page-load の後に reveal-ready を付ける）は、手元の負荷が高いと、load から 1〜1.5 秒で
        // 済まないことがある。付くまで（最長 10 秒）待ってから 1 秒数え、その時点で読む。付かないまま 10 秒たったら、
        // 下の「演出が働いていない」で落ちる
        await page
          .waitForFunction(() => document.querySelectorAll('[data-reveal].reveal-ready').length > 0, null, { timeout: 10_000 })
          .catch(() => undefined);
        await page.waitForTimeout(LOAD_VISIBLE_MS);
        const last = await page.evaluate((sel) => {
          const el = document.querySelector<HTMLElement>(sel);
          if (!el) return { found: false, revealActive: false, opacity: 0, top: 0, innerHeight: window.innerHeight };
          let opacity = 1;
          for (let node: HTMLElement | null = el; node; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
          return {
            found: true,
            // 演出が働いている（主ボタンの枠に reveal-ready が付いている）ことを確かめ、空振りを防ぐ
            revealActive: !!el.closest('[data-reveal].reveal-ready'),
            opacity: Math.round(opacity * 100) / 100,
            top: Math.round(el.getBoundingClientRect().top),
            innerHeight: window.innerHeight,
          };
        }, PRIMARY_CTA_SELECTOR);
        expect(last.found, '主ボタンが無い').toBe(true);
        expect(last.revealActive, `演出が働いていない（${JSON.stringify(last)}）`).toBe(true);
        // 隠れている間は 40px 下にずれるので、見えていることを先に確かめてから位置を見る
        expect(last.opacity, `読み込みの 1 秒後の主ボタンの opacity（${JSON.stringify(last)}）`).toBeGreaterThanOrEqual(0.99);
        expect(last.top, `主ボタンが窓の中に無い（${JSON.stringify(last)}）`).toBeLessThan(last.innerHeight);
      } finally {
        await context.close();
      }
    });
  }
}

test('390px 日本語: 文字を200%にしても見出しと説明が欠けない', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const baseURL = process.env.FIRST_VIEW_BASE_URL ?? testInfo.project.use.baseURL;
  expect(baseURL).toBeTruthy();
  await page.route('**/*', route => route.request().method() === 'GET' ? route.continue() : route.abort());
  await page.goto(new URL('/', baseURL!).toString());
  await page.evaluate(() => document.fonts.ready);
  const title = page.locator('[data-hero-content] h1');
  await expect(title).toBeVisible();

  const textBounds = await title.evaluate((heading) => {
    const description = heading.nextElementSibling!;
    const textElements = [heading, description].flatMap(element => [element, ...element.querySelectorAll('*')])
      .filter(element => [...element.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()));
    const sizes = textElements.map(element => ({ element, px: parseFloat(getComputedStyle(element).fontSize) }));
    for (const { element, px } of sizes) {
      (element as HTMLElement).style.setProperty('font-size', `${px * 2}px`, 'important');
    }
    const clip = heading.closest('section')!.getBoundingClientRect();
    return [heading, description].map(element => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const rects = [...range.getClientRects()].filter(rect => rect.width > 1);
      return {
        tag: element.tagName,
        count: rects.length,
        clipped: rects.some(rect => rect.left < Math.max(0, clip.left) - 1 ||
          rect.right > Math.min(innerWidth, clip.right) + 1),
      };
    });
  });
  expect(textBounds).toEqual([
    { tag: 'H1', count: expect.any(Number), clipped: false },
    { tag: 'P', count: expect.any(Number), clipped: false },
  ]);
  expect(textBounds.every(({ count }) => count > 0)).toBe(true);
});
