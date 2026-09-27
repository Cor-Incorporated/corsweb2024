/**
 * サイト共通の JSON-LD（Organization / WebSite / FAQPage）。M1 の是正:
 * - Organization に固定の @id を付け、ブログ記事の publisher / copyrightHolder から参照で解決できるようにする
 * - 社名はロケール別表記 + legalName は正式名（ADR-0007）。sameAs は会社アカウントのみ
 * - FAQPage は本文に Q&A を表示しているページ（Faq.astro）だけで、表示と同じデータから出す
 * - SearchAction（Google は 2024-11 に sitelinks search box を廃止）は出さない
 */
import {
  COMPANY_SOCIAL_LINKS,
  LEGAL_NAME,
  ORGANIZATION_ID,
  ORGANIZATION_NAMES,
  SITE_ORIGIN,
  WEBSITE_ID,
} from '../config/organization';
import { KOUSUKE_TERADA } from '../config/author';
import { getTranslations, type Locale } from './i18n';

export type JsonLd = Record<string, unknown>;

const SITE_LOCALES: readonly Locale[] = ['ja', 'en', 'zh', 'ko', 'es'];

/** 他ロケールの正式表記（name 以外）。同一エンティティの別名として示す。 */
function alternateNames(locale: Locale): string[] {
  return [...new Set(Object.values(ORGANIZATION_NAMES))].filter((name) => name !== ORGANIZATION_NAMES[locale]);
}

export function buildOrganizationJsonLd(locale: Locale): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: ORGANIZATION_NAMES[locale],
    legalName: LEGAL_NAME,
    alternateName: alternateNames(locale),
    url: `${SITE_ORIGIN}/`,
    logo: `${SITE_ORIGIN}/logo.png`,
    description: getTranslations(locale).meta.home.description,
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      availableLanguage: ['Japanese', 'English'],
    },
    address: {
      '@type': 'PostalAddress',
      streetAddress: '福岡県福岡市中央区天神',
      addressLocality: '福岡市',
      addressRegion: '福岡県',
      postalCode: '810-0001',
      addressCountry: 'JP',
    },
    sameAs: COMPANY_SOCIAL_LINKS.map((link) => link.href),
    // 代表者の事実は config/author.ts が正本（記事ページの Person ノードと同じ @id）
    founder: {
      '@type': 'Person',
      '@id': KOUSUKE_TERADA.personId,
      name: KOUSUKE_TERADA.names[locale],
      jobTitle: KOUSUKE_TERADA.jobTitles[locale],
    },
  };
}

export function buildWebSiteJsonLd(locale: Locale): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: ORGANIZATION_NAMES[locale],
    alternateName: alternateNames(locale),
    url: `${SITE_ORIGIN}/`,
    inLanguage: [...SITE_LOCALES],
    publisher: { '@id': ORGANIZATION_ID },
  };
}

export type FaqItem = { question: string; answer: string };

/** 本文に表示している Q&A と同じデータから FAQPage を作る（表示していない Q&A を載せない）。 */
export function buildFaqPageJsonLd(items: readonly FaqItem[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}
