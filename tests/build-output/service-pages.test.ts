// ビルド済み dist のサービスのページの検査（設定: vitest.dist.config.ts。`npm run build` の後に `npm run test:dist`）。ADR-0024。
// 2026-10-26: ヘッダーの「サービス」は Grift 以外の 3 つがすべて intent 付きの /contact（Cloudia）へ直行していた（代表の指摘）。
// 3 つの説明のページを 5 言語で作り、ヘッダー（パソコン・スマホ）・フッター・トップからそこへつなぐ。相談はページの最後の CTA から。
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  SERVICE_PAGES,
  getServiceContactSource,
  getServiceOgSlug,
  getServiceUrl,
} from '../../src/config/services';
import type { Locale } from '../../src/utils/i18n';

const DIST_DIR = path.resolve(process.env.CONTACT_GUARD_DIST_DIR || 'dist');
const LOCALES: readonly Locale[] = ['ja', 'en', 'zh', 'ko', 'es'];

function read(relative: string): string {
  const file = path.join(DIST_DIR, relative);
  expect(existsSync(file), `${file} が無い。先に npm run build を実行する`).toBe(true);
  return readFileSync(file, 'utf8');
}

function pageFile(urlPath: string): string {
  return path.join(urlPath.replace(/^\//, ''), 'index.html');
}

function homeFile(locale: Locale): string {
  return locale === 'ja' ? 'index.html' : path.join(locale, 'index.html');
}

/**
 * href の値（クエリ付き）。圧縮後の HTML はクエリの & を &#38; や &amp; で書くので戻す。
 * 末尾のスラッシュは比べやすいように外す（クエリの前のものも）
 */
function hrefs(fragment: string): string[] {
  return [...fragment.matchAll(/\bhref=["']?([^"'\s>]+)/g)].map((m) =>
    m[1].replace(/&(?:amp|#38|#x26);/gi, '&').replace(/\/+(?=\?|$)/, '') || '/',
  );
}

function element(html: string, pattern: RegExp, label: string): string {
  const fragment = html.match(pattern)?.[1];
  expect(fragment, `${label} が見つからない`).toBeTruthy();
  return fragment ?? '';
}

const desktopServiceMenu = (html: string) =>
  element(html, /<ul\b[^>]*data-menu=["']?services["'\s>][^>]*>([\s\S]*?)<\/ul>/, 'パソコンのヘッダーのサービスのメニュー（data-menu="services"）');
const mobileServiceMenu = (html: string) =>
  element(html, /<ul\b[^>]*data-menu=["']?services-mobile["'\s>][^>]*>([\s\S]*?)<\/ul>/, 'スマホのメニューのサービス（data-menu="services-mobile"）');
const footer = (html: string) => element(html, /<footer\b[^>]*>([\s\S]*?)<\/footer>/, 'フッター');
const main = (html: string) => html.replace(/<header\b[\s\S]*?<\/header>/, '').replace(/<footer\b[\s\S]*?<\/footer>/, '');

describe('サービスのページ（5 言語 × 3）', () => {
  for (const locale of LOCALES) {
    for (const service of SERVICE_PAGES) {
      const url = getServiceUrl(service, locale);

      it(`${url}: 最後の CTA が intent 付きで /contact（Cloudia）へつながる`, () => {
        const html = read(pageFile(url));
        const cta = element(html, /<a\b([^>]*data-service-cta[^>]*)>/, 'CTA（data-service-cta）');
        const contact = locale === 'ja' ? '/contact' : `/${locale}/contact`;
        expect(hrefs(cta)).toEqual([
          `${contact}?intent=${service.intent}&source=${getServiceContactSource(service)}`,
        ]);
      });

      it(`${url}: canonical・5 言語の hreflang・Service の構造化データ・専用の OG 画像がある`, () => {
        const html = read(pageFile(url));
        // 圧縮後の HTML は属性の順番と引用符が変わるので、canonical の link 要素を取り出してから href を見る
        const canonical = html.match(/<link\b[^>]*\brel=["']?canonical\b[^>]*>/)?.[0] ?? '';
        expect(hrefs(canonical)).toEqual([`https://cor-jp.com${url}`]);
        for (const loc of LOCALES) {
          expect(html, `hreflang=${loc}`).toMatch(new RegExp(`hreflang=["']?${loc}["'\\s>]`));
        }
        expect(html).toMatch(/"@type":"Service"/);
        const og = `/og/page/${getServiceOgSlug(service)}.png`;
        expect(html).toContain(`https://cor-jp.com${og}`);
        expect(existsSync(path.join(DIST_DIR, og)), `${og} が生成されていない`).toBe(true);
      });
    }
  }
});

describe('サービスのページへの入口', () => {
  for (const locale of LOCALES) {
    const expected = SERVICE_PAGES.map((service) => getServiceUrl(service, locale));

    it(`${locale}: パソコンのヘッダーのサービスは説明のページへ行き、/contact へ直行しない`, () => {
      const links = hrefs(desktopServiceMenu(read(homeFile(locale))));
      expect(links.filter((href) => href.includes('/contact'))).toEqual([]);
      expect(links.slice(0, expected.length)).toEqual(expected);
    });

    it(`${locale}: スマホのメニューのサービスも説明のページへ行き、/contact へ直行しない`, () => {
      const links = hrefs(mobileServiceMenu(read(homeFile(locale))));
      expect(links.filter((href) => href.includes('/contact'))).toEqual([]);
      expect(links.slice(0, expected.length)).toEqual(expected);
    });

    it(`${locale}: トップの本文とフッターから 3 つのページへ行ける`, () => {
      const html = read(homeFile(locale));
      const inMain = hrefs(main(html));
      const inFooter = hrefs(footer(html));
      expect(expected.filter((href) => !inMain.includes(href)), 'トップの本文にないリンク').toEqual([]);
      expect(expected.filter((href) => !inFooter.includes(href)), 'フッターにないリンク').toEqual([]);
    });
  }
});

describe('サイトの案内', () => {
  const urls = LOCALES.flatMap((locale) =>
    SERVICE_PAGES.map((service) => `https://cor-jp.com${getServiceUrl(service, locale)}/`),
  );

  it('sitemap に 15 ページすべてが載っている', () => {
    const sitemap = read('sitemap-0.xml');
    expect(urls.filter((url) => !sitemap.includes(`<loc>${url}</loc>`))).toEqual([]);
  });

  it('llms.txt の「サービス」に 3 つのページ（ja）が載っている', () => {
    const llms = read('llms.txt');
    const section = llms.match(/## サービス\n([\s\S]*?)\n## /)?.[1] ?? '';
    for (const service of SERVICE_PAGES) {
      expect(section).toContain(`https://cor-jp.com${getServiceUrl(service, 'ja')}/`);
    }
  });
});
