// 最初の画面（scroll 0）に、5 業種の入口が 5 つとも見えるかを、14 の画面の大きさ × 5 言語で測る。
//
// 見える = 要素の上端が 0 以上・下端が画面の高さ以下・左右が画面の幅の中・display が none でない・visibility が hidden でない・
// 親まで掛けた opacity が 0.9 以上・要素の中の 9 点（縦横 25%・50%・75%）がどれもその要素に届く（浮きボタンなどに隠れていない）。
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

// よくある画面の大きさ。スマホの 664・667・635・640 は、ブラウザの上下の枠を引いた表示の高さ。
// 320×568 は対象にしない（ja でも 5 つは入らない）。
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
      const fractions = [0.25, 0.5, 0.75];
      const hitSelf = fractions.every((fx) =>
        fractions.every((fy) => {
          const hit = document.elementFromPoint(rect.left + rect.width * fx, rect.top + rect.height * fy);
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

for (const viewport of VIEWPORTS) {
  for (const locale of LOCALES) {
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
          await page.waitForURL(industryPath(locale, slug), { timeout: 10_000 }).catch(() => undefined);
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
        for (const click of clicks) {
          expect.soft(click.ok, `${click.id} を押した先: ${click.pathname}`).toBe(true);
        }
      } finally {
        await context.close();
      }
    });
  }
}
