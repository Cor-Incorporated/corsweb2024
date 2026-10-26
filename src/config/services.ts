/**
 * サービスのページの正本（ADR-0024）。
 *
 * ヘッダーの「サービス」（パソコン・スマホ）、フッター、トップの事業の柱、OG 画像、llms.txt と
 * テストは、ここに並べた 3 つのページを読む。ページの URL（slug）と、最後の CTA が Cloudia へ渡す
 * 相談の種類（intent。ADR-0014 の 7 キー。キーの改名はしない）を、この 1 か所で結ぶ。
 *
 * key は locale の `nav.<key>`（ページ名）・`meta.<key>`（title と description）・
 * `servicePages.<key>`（本文）の 3 か所で同じ名前を使う。
 * 本文は、サイトにすでに載せている事実だけで書く（ADR-0007・ADR-0022）。価格はこのページに載せない（判断待ち、ADR-0024）。
 */
import type { ContactIntent } from './site';
import { getLocalizedUrl, type Locale } from '../utils/i18n';

export const SERVICE_KEYS = ['serviceAssessment', 'serviceLocalLlm', 'serviceAiDev'] as const;
export type ServiceKey = (typeof SERVICE_KEYS)[number];

export type ServicePage = {
  key: ServiceKey;
  /** `/services/<slug>`。ja はロケールの接頭辞なし、ほかは `/<lang>/services/<slug>` */
  slug: string;
  /** 最後の CTA が /contact（Cloudia）へ渡す相談の種類 */
  intent: ContactIntent;
  /** 「関係する実績・事例」に出す cases コレクションの slug（言語ディレクトリを除いた名前）。並びのとおりに出す */
  relatedCaseSlugs: readonly string[];
};

export const SERVICE_PAGES: readonly ServicePage[] = [
  {
    key: 'serviceAssessment',
    slug: 'confidential-ai-assessment',
    intent: 'confidential-ai-assessment',
    relatedCaseSlugs: ['confidential-data-ai-assessment', 'local-llm-poc'],
  },
  {
    key: 'serviceLocalLlm',
    slug: 'local-llm-poc',
    intent: 'local-llm-poc',
    relatedCaseSlugs: ['local-llm-poc', 'confidential-data-ai-assessment'],
  },
  {
    key: 'serviceAiDev',
    slug: 'ai-development',
    intent: 'contract-dev',
    relatedCaseSlugs: ['engineer-cafe-navigator', 'legacy-core-system-cloud-migration', 'survey-platform-renewal'],
  },
];

export function getServicePage(key: ServiceKey): ServicePage {
  const page = SERVICE_PAGES.find((p) => p.key === key);
  if (!page) throw new Error(`Unknown service page: ${key}`);
  return page;
}

/** ロケールの接頭辞を除いたパス（例: `/services/local-llm-poc`）。OG 画像の対応表と hreflang の基準に使う */
export function getServiceBasePath(page: ServicePage): string {
  return `/services/${page.slug}`;
}

/** 現在のロケールのページへのパス */
export function getServiceUrl(page: ServicePage, locale: Locale): string {
  return getLocalizedUrl(getServiceBasePath(page), locale);
}

/** 最後の CTA の `source`（どのページから相談に来たか）。workers/contact-chat の MAX_SOURCE_LEN（100）に収まる */
export function getServiceContactSource(page: ServicePage): string {
  return `service-${page.slug}`;
}

/** OG 画像（/og/page/<slug>.png）の slug。src/utils/og-svg.ts の OG_PAGES に同じ名前で並ぶ */
export function getServiceOgSlug(page: ServicePage): string {
  return `service-${page.slug}`;
}
