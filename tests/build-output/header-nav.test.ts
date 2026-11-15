// ビルド済み dist のヘッダーの検査（設定: vitest.dist.config.ts。`npm run build` の後に `npm run test:dist`）。
// 2026-10-24: パソコンのヘッダーにブログと About がなく、スマホのメニューからしか行けなかった（代表の指摘）。
// 並びは ADR-0011 の「Header IA の改訂」: サービス ▾ / 業種別 ▾ / 実績 / ブログ / Cor.について ▾ / お問い合わせ。
// 5 業種は src/config/industry-context.ts の INDUSTRY_SLUGS から導く（一覧を 1 か所にする）。
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { INDUSTRY_SLUGS, industryPagePath } from '../../src/config/industry-context';

const DIST_DIR = path.resolve(process.env.CONTACT_GUARD_DIST_DIR || 'dist');
const LOCALES = ['ja', 'en', 'zh', 'ko', 'es'] as const;
type Locale = (typeof LOCALES)[number];
// パソコンのヘッダーから行けるはずの、業種以外のページ（ロケールの接頭辞を除いたパス）
const REQUIRED_PAGES = ['/works', '/blog', '/about', '/company', '/security', '/news'];
const INDUSTRY_PAGES = INDUSTRY_SLUGS.map(industryPagePath);

function readHome(locale: Locale): string {
  const file = path.join(DIST_DIR, locale === 'ja' ? '' : locale, 'index.html');
  expect(existsSync(file), `${file} が無い。先に npm run build を実行する`).toBe(true);
  return readFileSync(file, 'utf8');
}

function desktopNav(html: string): string {
  const match = html.match(/<nav\b[^>]*aria-label=["']?主要ページ["']?[^>]*>([\s\S]*?)<\/nav>/);
  return match?.[1] ?? '';
}

function menu(html: string, name: string): string {
  return html.match(new RegExp(`<ul\\b[^>]*data-menu=["']?${name}["'\\s>][^>]*>([\\s\\S]*?)<\\/ul>`))?.[1] ?? '';
}

function hrefs(fragment: string): string[] {
  return [...fragment.matchAll(/\bhref=["']?([^"'\s>]+)/g)].map((m) => m[1].replace(/\/+$/, '') || '/');
}

const prefixed = (locale: Locale, paths: readonly string[]) => paths.map((p) => `${locale === 'ja' ? '' : `/${locale}`}${p}`);

describe('パソコンのヘッダー', () => {
  for (const locale of LOCALES) {
    it(`${locale}: ブログ・About・会社概要・実績・セキュリティ・ニュースへ行ける`, () => {
      const nav = desktopNav(readHome(locale));
      expect(nav, `aria-label="主要ページ" の nav が無い（${locale}）`).not.toBe('');
      const found = hrefs(nav);
      const missing = prefixed(locale, REQUIRED_PAGES).filter((p) => !found.includes(p));
      expect(missing, `ヘッダーにあるリンク: ${found.join(', ')}`).toEqual([]);
    });

    it(`${locale}: 業種別のメニューに 5 業種が INDUSTRY_SLUGS の順で並ぶ`, () => {
      const industries = menu(readHome(locale), 'industries');
      expect(industries, `パソコンの業種別のメニュー（data-menu="industries"）が無い（${locale}）`).not.toBe('');
      expect(hrefs(industries)).toEqual(prefixed(locale, INDUSTRY_PAGES));
    });
  }
});

describe('スマホのメニュー', () => {
  for (const locale of LOCALES) {
    it(`${locale}: 業種の一覧に 5 業種が INDUSTRY_SLUGS の順で並ぶ`, () => {
      const industries = menu(readHome(locale), 'industries-mobile');
      expect(industries, `スマホの業種の一覧（data-menu="industries-mobile"）が無い（${locale}）`).not.toBe('');
      expect(hrefs(industries)).toEqual(prefixed(locale, INDUSTRY_PAGES));
    });
  }
});
