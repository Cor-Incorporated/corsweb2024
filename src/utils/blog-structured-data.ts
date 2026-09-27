/**
 * ブログ記事の SEO 出力（hreflang / BreadcrumbList / Article JSON-LD）の生成。ADR-0017（構造化データは
 * 本文に表示している内容だけ・hreflang は実在する言語版だけ・会社は @id で参照）に沿って:
 * - hreflang は実在する翻訳（articleLocales）から 5 言語 + x-default を出す。どの言語版から見ても
 *   同じ集合になるよう「現在の言語」に依存させない（相互参照が崩れないように）
 * - BreadcrumbList はロケール別の URL / ラベル
 * - Article は publisher / copyrightHolder を Organization の @id 参照にし、articleBody（中身は
 *   description だった）を出さない。wordCount は本文から数える（日本語・中国語は文字数）
 */
import { authorProfileUrl, findAuthor } from '../config/author';
import { ORGANIZATION_ID, SITE_ORIGIN } from '../config/organization';
import { blogPostPath } from './blog-paths';
import type { Locale } from './i18n';
import type { JsonLd } from './structured-data';

export const BLOG_LOCALE_ORDER: readonly Locale[] = ['ja', 'en', 'zh', 'ko', 'es'];

export type HreflangLink = { hreflang: string; href: string };

/** 実在する翻訳だけの hreflang。x-default は ja 版（無ければ最初に実在する言語版）。 */
export function buildBlogHreflang(slug: string, availableLocales: readonly Locale[]): HreflangLink[] {
  const links = BLOG_LOCALE_ORDER.filter((locale) => availableLocales.includes(locale)).map((locale) => ({
    hreflang: locale,
    href: `${SITE_ORIGIN}${blogPostPath(locale, slug)}`,
  }));
  if (links.length === 0) return [];
  const xDefault = links.find((link) => link.hreflang === 'ja') ?? links[0];
  return [...links, { hreflang: 'x-default', href: xDefault.href }];
}

const BREADCRUMB_LABELS: Record<Locale, { home: string; blog: string }> = {
  ja: { home: 'ホーム', blog: 'ブログ' },
  en: { home: 'Home', blog: 'Blog' },
  zh: { home: '首页', blog: '博客' },
  ko: { home: '홈', blog: '블로그' },
  es: { home: 'Inicio', blog: 'Blog' },
};

export function buildBlogBreadcrumbJsonLd(locale: Locale, title: string): JsonLd {
  const home = locale === 'ja' ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}/${locale}/`;
  const labels = BREADCRUMB_LABELS[locale];
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: labels.home, item: home },
      { '@type': 'ListItem', position: 2, name: labels.blog, item: `${home}blog/` },
      { '@type': 'ListItem', position: 3, name: title },
    ],
  };
}

/** 本文 Markdown の語数。コード・URL・記法を除き、ja / zh は文字数、それ以外は空白区切りの語数。 */
export function countContentWords(markdown: string, locale: Locale): number {
  const text = markdown
    .replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/^\s{0,3}(?:#{1,6}|>|[-*+]|\d+\.)\s+/gm, ' ')
    .replace(/[*_~|]/g, ' ');
  if (locale === 'ja' || locale === 'zh') {
    return (text.match(/[\p{L}\p{N}]/gu) ?? []).length;
  }
  return text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

export type BlogArticleInput = {
  title: string;
  description: string;
  keywords: string;
  author: string;
  pubDate: Date;
  updatedDate?: Date;
  category: string;
  tags: readonly string[];
  image?: { url?: string; alt?: string };
  locale: Locale;
  pageUrl: string;
  /** 本文から数えた語数。本文が無い（テスト用ページ等）場合は出さない。 */
  wordCount?: number;
};

export function buildBlogArticleJsonLd(input: BlogArticleInput): JsonLd {
  const { title, description, keywords, author, pubDate, updatedDate, category, tags, image, locale, pageUrl } = input;
  // 登録済みの著者は、同じページに出す Person ノード（config/author.ts）を @id で参照する（ADR-0017）
  const profile = findAuthor(author);
  return {
    '@context': 'https://schema.org',
    '@type': category === 'ai' || category === 'engineering' ? 'TechArticle' : 'BlogPosting',
    headline: title,
    description,
    keywords,
    inLanguage: locale,
    author: profile
      ? {
          '@type': 'Person',
          '@id': profile.personId,
          name: profile.names[locale],
          url: authorProfileUrl(profile, locale),
        }
      : { '@type': 'Person', name: author },
    datePublished: pubDate.toISOString(),
    dateModified: (updatedDate ?? pubDate).toISOString(),
    publisher: { '@id': ORGANIZATION_ID },
    mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl },
    url: pageUrl,
    articleSection: category,
    ...(input.wordCount !== undefined && { wordCount: input.wordCount }),
    commentCount: 0,
    isAccessibleForFree: true,
    isFamilyFriendly: true,
    copyrightHolder: { '@id': ORGANIZATION_ID },
    copyrightYear: pubDate.getFullYear(),
    genre: locale === 'ja' ? '技術ブログ' : 'Technology Blog',
    about: tags.map((tag) => ({ '@type': 'Thing', name: tag })),
    ...(image?.url && {
      image: {
        '@type': 'ImageObject',
        url: new URL(image.url, SITE_ORIGIN).toString(),
        caption: image.alt,
        width: 1200,
        height: 630,
      },
    }),
    speakable: { '@type': 'SpeakableSpecification', cssSelector: ['h1', 'h2', 'h3'] },
  };
}
