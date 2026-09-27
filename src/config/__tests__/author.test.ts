// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { describe, expect, it } from 'vitest';
import { buildBlogArticleJsonLd } from '../../utils/blog-structured-data';
import type { Locale } from '../../utils/i18n';
import { buildOrganizationJsonLd } from '../../utils/structured-data';
import { authorBio, authorProfileUrl, buildPersonJsonLd, findAuthor, KOUSUKE_TERADA } from '../author';

const LOCALES: Locale[] = ['ja', 'en', 'zh', 'ko', 'es'];

describe('findAuthor', () => {
  it.each(['Terisuke', 'terisuke', ' TERISUKE '])('resolves the frontmatter handle %j', (handle) => {
    expect(findAuthor(handle)).toBe(KOUSUKE_TERADA);
  });

  it('returns undefined for unknown authors (no author box, name-only JSON-LD)', () => {
    expect(findAuthor('Someone Else')).toBeUndefined();
    expect(findAuthor(undefined)).toBeUndefined();
  });

  // 宣言（記事の frontmatter）と実体（著者レジストリ）を結ぶ: 未登録の著者名で記事を書くと落ちる
  it('covers every author used in src/content/blog', () => {
    const root = path.resolve('src/content/blog');
    const authors = new Set<string>();
    for (const lang of readdirSync(root)) {
      const dir = path.join(root, lang);
      for (const file of readdirSync(dir).filter((name) => name.endsWith('.md'))) {
        authors.add(String(matter(readFileSync(path.join(dir, file), 'utf8')).data.author ?? 'Terisuke'));
      }
    }
    expect([...authors].filter((author) => !findAuthor(author))).toEqual([]);
  });
});

describe('buildPersonJsonLd', () => {
  it.each(LOCALES)('%s: stable @id, localized name/title/profile URL and a bio from teamData', (locale) => {
    const person = buildPersonJsonLd(KOUSUKE_TERADA, locale);
    expect(person['@id']).toBe('https://cor-jp.com/#person-kousuke-terada');
    expect(person.name).toBe(KOUSUKE_TERADA.names[locale]);
    expect(person.jobTitle).toBe(KOUSUKE_TERADA.jobTitles[locale]);
    expect(person.url).toBe(authorProfileUrl(KOUSUKE_TERADA, locale));
    expect(person.url).toMatch(locale === 'ja' ? /^https:\/\/cor-jp\.com\/about\/#founder-story$/ : new RegExp(`^https://cor-jp\\.com/${locale}/about/#founder-story$`));
    expect(authorBio(KOUSUKE_TERADA, locale)).toBeTruthy();
    expect(person.description).toBe(authorBio(KOUSUKE_TERADA, locale));
    expect(person.worksFor).toEqual({ '@id': 'https://cor-jp.com/#organization' });
  });

  it('points to an existing photo and a single LinkedIn profile', () => {
    expect(existsSync(path.resolve('public', `.${KOUSUKE_TERADA.image}`))).toBe(true);
    const linkedIn = KOUSUKE_TERADA.sameAs.filter((url) => url.includes('linkedin.com'));
    expect(linkedIn).toEqual(['https://www.linkedin.com/in/kousuketerada/']);
  });
});

describe('author references', () => {
  it('Article.author and Organization.founder reference the same Person @id', () => {
    const article = buildBlogArticleJsonLd({
      title: 'T',
      description: 'D',
      keywords: 'k',
      author: 'Terisuke',
      pubDate: new Date('2025-01-01T00:00:00Z'),
      category: 'ai',
      tags: [],
      locale: 'en',
      pageUrl: 'https://cor-jp.com/en/blog/a/',
    });
    expect(article.author).toMatchObject({ '@id': KOUSUKE_TERADA.personId, name: 'Kousuke Terada' });
    expect(buildOrganizationJsonLd('en').founder).toMatchObject({ '@id': KOUSUKE_TERADA.personId });
  });

  it('keeps an unknown author as a name-only Person', () => {
    const article = buildBlogArticleJsonLd({
      title: 'T',
      description: 'D',
      keywords: 'k',
      author: 'Guest Writer',
      pubDate: new Date('2025-01-01T00:00:00Z'),
      category: 'ai',
      tags: [],
      locale: 'ja',
      pageUrl: 'https://cor-jp.com/blog/a/',
    });
    expect(article.author).toEqual({ '@type': 'Person', name: 'Guest Writer' });
  });

  // ローマ字表記の統一（Kousuke）。旧表記 "Kosuke" が公開文言に戻ったら落ちる
  it('uses the unified romanization in every locale file', () => {
    for (const locale of LOCALES) {
      const text = readFileSync(path.resolve('src/i18n/locales', `${locale}.json`), 'utf8');
      expect(text).not.toMatch(/Kosuke/);
    }
  });
});
