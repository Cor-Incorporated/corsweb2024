// ビルド済み dist の代表のプロフィールと物語の検査（設定: vitest.dist.config.ts。`npm run build` の後に `npm run test:dist`）。
// 2026-10-25: About の代表の欄が短い説明と「準備中」だけで、プロフィールもなかった（代表の指摘）。
// About にはプロフィールと物語の冒頭、全文はブログの founder の記事に置く（ADR-0011 の「About 代表の改訂」、
// docs/story-spine.md）。トップの「代表ストーリーを読む」も全文の記事へつなぐ。
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const DIST_DIR = path.resolve(process.env.CONTACT_GUARD_DIST_DIR || 'dist');
const LOCALES = ['ja', 'en', 'zh', 'ko', 'es'] as const;
const prefix = (locale: string) => (locale === 'ja' ? '' : locale);

function read(...parts: string[]): string {
  const file = path.join(DIST_DIR, ...parts, 'index.html');
  expect(existsSync(file), `${file} が無い。先に npm run build を実行する`).toBe(true);
  return readFileSync(file, 'utf8');
}

// data-testid の付いた要素の開始タグと、その要素の中身（同じタグ名の入れ子は考えない簡易版）
function block(html: string, testid: string): string {
  const match = html.match(new RegExp(`<(\\w+)\\b[^>]*data-testid=["']?${testid}["'\\s>][\\s\\S]*?</\\1>`));
  return match?.[0] ?? '';
}

function hrefOf(fragment: string): string {
  return fragment.match(/\bhref=["']?([^"'\s>]+)/)?.[1] ?? '';
}

// サイト内のパス（/en/blog/founder-story/）が dist に実在するか
function existsInDist(href: string): boolean {
  const clean = href.split('#')[0].split('?')[0].replace(/^\/+|\/+$/g, '');
  return existsSync(path.join(DIST_DIR, clean, 'index.html'));
}

describe('About の代表の欄', () => {
  for (const locale of LOCALES) {
    it(`${locale}: プロフィール・年表・物語の冒頭があり、続きのリンク先が実在する`, () => {
      const html = read(prefix(locale), 'about');
      expect(block(html, 'founder-profile'), 'プロフィールが無い').not.toBe('');
      const timeline = block(html, 'founder-timeline');
      expect((timeline.match(/<li\b/g) ?? []).length, '年表の行が少ない').toBeGreaterThanOrEqual(10);
      expect(block(html, 'founder-story-excerpt'), '物語の冒頭が無い').not.toBe('');
      const href = hrefOf(block(html, 'founder-story-link'));
      expect(href, '「続きを読む」のリンクが無い').toMatch(/\/blog\/founder-story\/?$/);
      expect(existsInDist(href), `${href} が dist に無い`).toBe(true);
    });
  }
});

describe('トップの「代表ストーリーを読む」', () => {
  for (const locale of LOCALES) {
    it(`${locale}: 物語の全文の記事を指し、リンク先が実在する`, () => {
      const href = hrefOf(block(read(prefix(locale)), 'founder-story-link'));
      expect(href, 'About の欄ではなく、物語の記事を指す').toMatch(/\/blog\/founder-story\/?$/);
      expect(existsInDist(href), `${href} が dist に無い`).toBe(true);
    });
  }
});

describe('物語の全文の記事', () => {
  it('ja の記事に、代表の note の記事を並べた参考資料の欄がある', () => {
    const html = read('blog', 'founder-story');
    expect(html).toMatch(/<[a-z0-9]+\s[^>]*data-article-sources[\s>=]/);
    expect((html.match(/https:\/\/note\.com\/cor_instrument\/n\//g) ?? []).length).toBeGreaterThanOrEqual(4);
  });
});
