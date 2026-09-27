// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseDocument } from '../frontmatter.mjs';
import { computeSourceHash, SOURCE_HASH_RE } from '../hash.mjs';
import { JA_BLOG, JA_NEWS } from './helpers.mjs';

const blog = parseDocument(JA_BLOG);
const hashOf = (collection, text) => {
  const doc = parseDocument(text);
  return computeSourceHash(collection, doc.data, doc.body);
};

describe('computeSourceHash', () => {
  it('returns a stable lowercase 64-hex SHA-256 for the same input', () => {
    const first = computeSourceHash('blog', blog.data, blog.body);
    expect(first).toMatch(SOURCE_HASH_RE);
    expect(computeSourceHash('blog', blog.data, blog.body)).toBe(first);
    expect(hashOf('blog', JA_BLOG)).toBe(first);
  });

  it('ignores YAML formatting: quotes, key order, CRLF, BOM, surrounding blank lines', () => {
    const reformatted = JA_BLOG.replace(
      'title: "テスト記事：翻訳パイプライン"',
      "title: 'テスト記事：翻訳パイプライン'"
    )
      .replace('featured: true\n', '')
      .replace('lang: "ja"\n', 'lang: "ja"\nfeatured: true\n');
    const crlf = `\uFEFF${JA_BLOG.replace(/\n/g, '\r\n')}\r\n\r\n`;
    const base = hashOf('blog', JA_BLOG);
    expect(hashOf('blog', reformatted)).toBe(base);
    expect(hashOf('blog', crlf)).toBe(base);
  });

  it('does not change when only copied fields change (pubDate, featured, category, image.url)', () => {
    const copiedOnly = JA_BLOG.replace('pubDate: 2025-01-21', 'pubDate: 2026-01-01')
      .replace('featured: true', 'featured: false')
      .replace('category: "lab"', 'category: "ai"')
      .replace('/images/blog/テスト.avif', '/images/blog/other.avif');
    expect(hashOf('blog', copiedOnly)).toBe(hashOf('blog', JA_BLOG));
  });

  it.each([
    ['title', JA_BLOG.replace('テスト記事：翻訳パイプライン', 'テスト記事：改訂')],
    ['description', JA_BLOG.replace('説明文です。', '説明文を変えました。')],
    ['image.alt', JA_BLOG.replace('alt: "テスト画像"', 'alt: "別の画像"')],
    ['body', JA_BLOG.replace('## はじめに', '## はじめに（改訂）')],
    ['body whitespace inside', JA_BLOG.replace('を参照。', 'を参照。 ')],
  ])('changes when a translatable part changes: %s', (_label, changed) => {
    expect(hashOf('blog', changed)).not.toBe(hashOf('blog', JA_BLOG));
  });

  it('treats tags per collection: blog copies tags (hash stable), news translates tags (hash changes)', () => {
    expect(hashOf('blog', JA_BLOG.replace('["テスト", "AI"]', '["テスト"]'))).toBe(
      hashOf('blog', JA_BLOG)
    );
    expect(hashOf('news', JA_NEWS.replace('"サイト更新"', '"更新"'))).not.toBe(
      hashOf('news', JA_NEWS)
    );
  });

  it('includes news.source (translated) but not news.category (copied)', () => {
    expect(hashOf('news', JA_NEWS.replace('Cor.株式会社', 'Grift'))).not.toBe(
      hashOf('news', JA_NEWS)
    );
    expect(hashOf('news', JA_NEWS.replace('category: "info"', 'category: "media"'))).toBe(
      hashOf('news', JA_NEWS)
    );
  });
});
