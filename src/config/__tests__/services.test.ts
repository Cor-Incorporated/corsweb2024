// サービスのページの正本（config/services.ts）と、5 言語の文言（locale の nav・meta・servicePages）の検査。ADR-0024。
// ビルド結果（ページ・ヘッダー・フッター・トップ・sitemap・llms.txt）の検査は tests/build-output/service-pages.test.ts。
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  SERVICE_KEYS,
  SERVICE_PAGES,
  findServiceByCaseCategory,
  findServiceByIntent,
  formatServiceLinkLabel,
  getServiceBasePath,
  getServiceContactSource,
  getServiceOgSlug,
  getServiceUrl,
} from '../services';
import { CONTACT_INTENTS } from '../site';
import { OG_PAGES } from '../../utils/og-svg';
import { getTranslations, type Locale } from '../../utils/i18n';

const LOCALES: readonly Locale[] = ['ja', 'en', 'zh', 'ko', 'es'];
// workers/contact-chat/src/validate.ts の MAX_SOURCE_LEN（これより長い source は切り詰められる）
const MAX_SOURCE_LEN = 100;

describe('SERVICE_PAGES（正本）', () => {
  it('3 つのサービスが SERVICE_KEYS の順に 1 つずつある', () => {
    expect(SERVICE_PAGES.map((p) => p.key)).toEqual([...SERVICE_KEYS]);
    expect(new Set(SERVICE_PAGES.map((p) => p.slug)).size).toBe(SERVICE_PAGES.length);
  });

  it('CTA の intent は ADR-0014 の 7 キーのどれか（改名した値を渡さない）', () => {
    const unknown = SERVICE_PAGES.filter((p) => !(CONTACT_INTENTS as readonly string[]).includes(p.intent));
    expect(unknown.map((p) => `${p.key}=${p.intent}`)).toEqual([]);
  });

  it('ヘッダーにあったときと同じ相談の種類を受け持つ（診断・PoC・受託）', () => {
    expect(Object.fromEntries(SERVICE_PAGES.map((p) => [p.key, p.intent]))).toEqual({
      serviceAssessment: 'confidential-ai-assessment',
      serviceLocalLlm: 'local-llm-poc',
      serviceAiDev: 'contract-dev',
    });
  });

  it('ブログの相談の種類と実績のカテゴリから、対応するサービスのページを引ける（Grift などは引かない）', () => {
    expect(findServiceByIntent('local-llm-poc')?.key).toBe('serviceLocalLlm');
    expect(findServiceByIntent('contract-dev')?.key).toBe('serviceAiDev');
    expect(findServiceByIntent('grift-team-beta')).toBeUndefined();
    expect(findServiceByIntent('press-speaking-other')).toBeUndefined();
    expect(findServiceByCaseCategory('confidential-ai')?.key).toBe('serviceAssessment');
    expect(findServiceByCaseCategory('ai-contract')?.key).toBe('serviceAiDev');
    expect(findServiceByCaseCategory('grift')).toBeUndefined();
    expect(findServiceByCaseCategory('tech-culture')).toBeUndefined();
  });

  it('実績のカテゴリは src/content/config.ts の caseCategories にある', () => {
    const config = readFileSync(path.resolve('src/content/config.ts'), 'utf8');
    const categories = config.match(/const caseCategories = \[([\s\S]*?)\]/)?.[1] ?? '';
    for (const page of SERVICE_PAGES) expect(categories, page.key).toContain(`'${page.caseCategory}'`);
  });

  it('リンクの文言はサービス名を埋めて作る（5 言語とも {service} を 1 つ持つ）', () => {
    for (const locale of LOCALES) {
      const template = getTranslations(locale).servicePages.common.serviceLinkLabel;
      expect(template.split('{service}').length - 1, `${locale}: ${template}`).toBe(1);
    }
    expect(formatServiceLinkLabel('{service}について詳しく見る', '機密データAI活用診断')).toBe('機密データAI活用診断について詳しく見る');
  });

  it('URL は ja が接頭辞なし、ほかの言語は /<lang>/services/<slug>', () => {
    const page = SERVICE_PAGES[0];
    expect(getServiceBasePath(page)).toBe(`/services/${page.slug}`);
    expect(getServiceUrl(page, 'ja')).toBe(`/services/${page.slug}`);
    expect(getServiceUrl(page, 'ko')).toBe(`/ko/services/${page.slug}`);
  });

  it('CTA の source は contact-chat が切り詰めない長さ', () => {
    for (const page of SERVICE_PAGES) {
      expect(getServiceContactSource(page).length, getServiceContactSource(page)).toBeLessThanOrEqual(MAX_SOURCE_LEN);
    }
  });

  it('「関係する実績・事例」の slug は ja の実績記事として実在する', () => {
    const missing = SERVICE_PAGES.flatMap((p) =>
      p.relatedCaseSlugs
        .filter((slug) => !existsSync(path.resolve('src/content/cases/ja', `${slug}.md`)))
        .map((slug) => `${p.key}: ${slug}`),
    );
    expect(missing).toEqual([]);
  });

  it('OG 画像の対応表（OG_PAGES）に、各サービスのページ名と一言（ja）が並ぶ', () => {
    const ja = getTranslations('ja');
    for (const page of SERVICE_PAGES) {
      const og = OG_PAGES.find((p) => p.slug === getServiceOgSlug(page));
      expect(og, getServiceOgSlug(page)).toEqual({
        slug: getServiceOgSlug(page),
        title: ja.nav[page.key],
        subtitle: ja.servicePages[page.key].catch,
      });
    }
  });
});

describe('5 言語の文言', () => {
  const ja = getTranslations('ja');

  for (const locale of LOCALES) {
    const t = getTranslations(locale);

    it(`${locale}: ページ名・title・description・本文がそろっている`, () => {
      for (const key of SERVICE_KEYS) {
        expect(t.nav[key], `nav.${key}`).toBeTruthy();
        expect(t.meta[key].title, `meta.${key}.title`).toBeTruthy();
        expect(t.meta[key].description, `meta.${key}.description`).toBeTruthy();
        expect(t.servicePages[key].catch, `servicePages.${key}.catch`).toBeTruthy();
        expect(t.servicePages[key].ctaLabel, `servicePages.${key}.ctaLabel`).toBeTruthy();
      }
    });

    it(`${locale}: 項目の数と、ある節・ない節が ja と同じ（訳し漏れ・訳し足しがない）`, () => {
      const shape = (copy: (typeof ja.servicePages)[(typeof SERVICE_KEYS)[number]]) => {
        const c = copy as typeof copy & {
          results?: { items?: unknown[] };
          next?: { items: unknown[] };
        };
        return {
          terms: c.terms.length,
          situations: c.situations.items.length,
          steps: c.steps.items.length,
          results: c.results ? (c.results.items?.length ?? 'lead-only') : 'none',
          next: c.next ? c.next.items.length : 'none',
        };
      };
      for (const key of SERVICE_KEYS) {
        expect(shape(t.servicePages[key]), key).toEqual(shape(ja.servicePages[key]));
      }
    });

    it(`${locale}: 価格を載せていない（ADR-0024: サービスのページの価格は代表の判断待ち）`, () => {
      // 通貨の記号（¥100k など）と、数字のあとの通貨（30万円・300万日元・30만 엔・100 yen など）。FAQ の書き方を拾う
      const PRICE = /[¥￥$€₩]|\d[\d,.]*\s*(?:万|千|만|천|k|M)?\s*(?:円|日元|엔|yen|JPY)/i;
      const text = JSON.stringify([t.servicePages, SERVICE_KEYS.map((key) => t.meta[key])]);
      expect(text.match(PRICE)?.[0] ?? null).toBeNull();
    });
  }
});

describe('締めの一文（docs/story-spine.md）', () => {
  it('ja の CTA の見出しは、物語の背骨が全ページの最後にそろえると決めた問いかけと同じ', () => {
    const spine = readFileSync(path.resolve('docs/story-spine.md'), 'utf8');
    const closing = spine.match(/全部のページで「([^」]+)」にそろえます/)?.[1];
    expect(closing, 'docs/story-spine.md から締めの一文を読めない').toBeTruthy();
    expect(getTranslations('ja').servicePages.common.ctaTitle).toBe(closing);
  });
});
