import { describe, expect, it } from 'vitest';
import { ORGANIZATION_ID } from '../../config/organization';
import {
  BLOG_LOCALE_ORDER,
  buildBlogArticleJsonLd,
  buildBlogBreadcrumbJsonLd,
  buildBlogHreflang,
  countContentWords,
} from '../blog-structured-data';
import type { Locale } from '../i18n';

const url = (locale: Locale, slug = 'post') =>
  locale === 'ja' ? `https://cor-jp.com/blog/${slug}/` : `https://cor-jp.com/${locale}/blog/${slug}/`;

// 5 言語それぞれの「翻訳あり / なし」の全組み合わせ（空集合を除く 31 通り）
const subsets: Locale[][] = [];
for (let mask = 1; mask < 1 << BLOG_LOCALE_ORDER.length; mask += 1) {
  subsets.push(BLOG_LOCALE_ORDER.filter((_, i) => mask & (1 << i)));
}

describe('buildBlogHreflang: 真理値表（言語 × 翻訳の有無）', () => {
  it.each(subsets.map((subset) => [subset.join('+'), subset] as const))('available = %s', (_, available) => {
    const links = buildBlogHreflang('post', available);
    // 実在する言語版だけ（ロケール順）+ x-default。存在しない言語版（404）を指さない
    expect(links.map((link) => link.hreflang)).toEqual([...available, 'x-default']);
    for (const link of links.slice(0, -1)) expect(link.href).toBe(url(link.hreflang as Locale));
    // x-default は ja 版。ja が無ければ最初に実在する言語版
    expect(links.at(-1)?.href).toBe(url(available.includes('ja') ? 'ja' : available[0]));
  });

  it('is independent of which language version renders it (reciprocal alternates)', () => {
    const shuffled: Locale[] = ['es', 'ja', 'ko'];
    expect(buildBlogHreflang('post', shuffled)).toEqual(buildBlogHreflang('post', ['ja', 'ko', 'es']));
  });

  it('returns nothing when no language version exists', () => {
    expect(buildBlogHreflang('post', [])).toEqual([]);
  });
});

describe('buildBlogBreadcrumbJsonLd', () => {
  it.each([
    ['ja', 'ホーム', 'https://cor-jp.com/', 'ブログ', 'https://cor-jp.com/blog/'],
    ['en', 'Home', 'https://cor-jp.com/en/', 'Blog', 'https://cor-jp.com/en/blog/'],
    ['zh', '首页', 'https://cor-jp.com/zh/', '博客', 'https://cor-jp.com/zh/blog/'],
    ['ko', '홈', 'https://cor-jp.com/ko/', '블로그', 'https://cor-jp.com/ko/blog/'],
    ['es', 'Inicio', 'https://cor-jp.com/es/', 'Blog', 'https://cor-jp.com/es/blog/'],
  ] as const)('%s uses locale URLs and labels', (locale, home, homeUrl, blog, blogUrl) => {
    const items = buildBlogBreadcrumbJsonLd(locale, 'T').itemListElement as Record<string, unknown>[];
    expect(items.map((item) => [item.name, item.item])).toEqual([
      [home, homeUrl],
      [blog, blogUrl],
      ['T', undefined],
    ]);
  });
});

describe('countContentWords', () => {
  it('counts characters for Japanese and Chinese, ignoring code, URLs and markup', () => {
    const markdown = '# 見出し\n\n本文です。**強調**と[リンク](https://example.com)。\n\n```js\nconst x = 1;\n```\n\nhttps://cor-jp.com/\n\n`inline`';
    // 見出し(3) + 本文です(4) + 強調(2) + と(1) + リンク(3) = 13
    expect(countContentWords(markdown, 'ja')).toBe(13);
    expect(countContentWords('你好，世界', 'zh')).toBe(4);
  });

  it('counts space-separated words for en / es / ko', () => {
    expect(countContentWords('## Title here\n\nThis is *a* test — with [a link](https://x.y).', 'en')).toBe(9);
    expect(countContentWords('안녕하세요 세계 여러분', 'ko')).toBe(3);
  });
});

describe('buildBlogArticleJsonLd', () => {
  const base = {
    title: 'T',
    description: 'D',
    keywords: 'k',
    author: 'Terisuke',
    pubDate: new Date('2025-01-21T00:00:00Z'),
    category: 'ai',
    tags: ['a'],
    locale: 'zh' as const,
    pageUrl: 'https://cor-jp.com/zh/blog/post/',
  };

  it('references the Organization by @id and drops articleBody', () => {
    const article = buildBlogArticleJsonLd({ ...base, wordCount: 1234 });
    expect(article.publisher).toEqual({ '@id': ORGANIZATION_ID });
    expect(article.copyrightHolder).toEqual({ '@id': ORGANIZATION_ID });
    expect(article).not.toHaveProperty('articleBody');
    expect(article.wordCount).toBe(1234);
    expect(article['@type']).toBe('TechArticle');
    expect(article.dateModified).toBe('2025-01-21T00:00:00.000Z');
  });

  it('omits wordCount when there is no body to count', () => {
    expect(buildBlogArticleJsonLd({ ...base, category: 'founder' })).not.toHaveProperty('wordCount');
    expect(buildBlogArticleJsonLd({ ...base, category: 'founder' })['@type']).toBe('BlogPosting');
  });
});
