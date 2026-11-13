// ビルド済み dist のヘッダーの検査（設定: vitest.dist.config.ts。`npm run build` の後に `npm run test:dist`）。
// 2026-10-24: パソコンのヘッダーにブログと About がなく、スマホのメニューからしか行けなかった（代表の指摘）。
// 並びは ADR-0011 の「Header IA の改訂」: サービス ▾ / 実績 / ブログ / Cor.について ▾ / お問い合わせ。
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const DIST_DIR = path.resolve(process.env.CONTACT_GUARD_DIST_DIR || 'dist');
const LOCALES = ['ja', 'en', 'zh', 'ko', 'es'] as const;
// パソコンのヘッダーから行けるはずのページ（ロケールの接頭辞を除いたパス）
const REQUIRED = [
  '/works',
  '/blog',
  '/about',
  '/company',
  '/security',
  '/news',
  '/industries/medical',
  '/industries/shigyo',
  '/industries/construction',
  '/industries/manufacturing',
  '/industries/education',
];

function desktopNav(html: string): string {
  const match = html.match(/<nav\b[^>]*aria-label=["']?主要ページ["']?[^>]*>([\s\S]*?)<\/nav>/);
  return match?.[1] ?? '';
}

function hrefs(fragment: string): string[] {
  return [...fragment.matchAll(/\bhref=["']?([^"'\s>]+)/g)].map((m) => m[1].replace(/\/+$/, '') || '/');
}

describe('パソコンのヘッダー', () => {
  for (const locale of LOCALES) {
    it(`${locale}: ブログ・About・会社概要・実績・セキュリティ・ニュースへ行ける`, () => {
      const file = path.join(DIST_DIR, locale === 'ja' ? '' : locale, 'index.html');
      expect(existsSync(file), `${file} が無い。先に npm run build を実行する`).toBe(true);
      const html = readFileSync(file, 'utf8');
      const nav = desktopNav(html);
      expect(nav, `${file} に aria-label="主要ページ" の nav が無い`).not.toBe('');
      const prefix = locale === 'ja' ? '' : `/${locale}`;
      const found = hrefs(nav);
      const missing = REQUIRED.map((p) => `${prefix}${p}`).filter((p) => !found.includes(p));
      expect(missing, `ヘッダーにあるリンク: ${found.join(', ')}`).toEqual([]);
      const mobile = html.match(/<ul\b[^>]*data-menu=["']?industries-mobile["'\s>][^>]*>([\s\S]*?)<\/ul>/)?.[1] ?? '';
      expect(mobile, 'スマホの業種メニューが無い').not.toBe('');
      const mobileHrefs = hrefs(mobile);
      const mobileMissing = REQUIRED.filter((p) => p.startsWith('/industries/')).map((p) => `${prefix}${p}`).filter((p) => !mobileHrefs.includes(p));
      expect(mobileMissing).toEqual([]);
    });
  }
});
