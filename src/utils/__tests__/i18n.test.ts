import { describe, it, expect } from 'vitest';
import {
  getCurrentLocale,
  getLocalizedUrl,
  getOtherLocale,
  emphasizeKyousou,
  getTranslations,
  getJaTranslations,
  type Locale,
} from '../i18n';
import jaJson from '../../i18n/locales/ja.json';
import enJson from '../../i18n/locales/en.json';
import zhJson from '../../i18n/locales/zh.json';
import koJson from '../../i18n/locales/ko.json';
import esJson from '../../i18n/locales/es.json';

const makeUrl = (pathname: string): URL => new URL(`https://example.com${pathname}`);

describe('getCurrentLocale', () => {
  it('returns "ja" for the root path', () => {
    expect(getCurrentLocale(makeUrl('/'))).toBe('ja');
  });

  it('returns "ja" for a non-prefixed path', () => {
    expect(getCurrentLocale(makeUrl('/about'))).toBe('ja');
    expect(getCurrentLocale(makeUrl('/blog/post'))).toBe('ja');
  });

  it.each([
    ['/en', 'en'],
    ['/zh', 'zh'],
    ['/ko', 'ko'],
    ['/es', 'es'],
  ] as const)('detects bare prefix %s as %s', (pathname, expected) => {
    expect(getCurrentLocale(makeUrl(pathname))).toBe(expected);
  });

  it.each([
    ['/en/', 'en'],
    ['/en/blog', 'en'],
    ['/zh/about', 'zh'],
    ['/ko/contact', 'ko'],
    ['/es/blog/post', 'es'],
  ] as const)('detects prefixed sub-path %s as %s', (pathname, expected) => {
    expect(getCurrentLocale(makeUrl(pathname))).toBe(expected);
  });

  it('treats a false prefix like /english as "ja" (word boundary required)', () => {
    expect(getCurrentLocale(makeUrl('/english'))).toBe('ja');
    expect(getCurrentLocale(makeUrl('/endpoint'))).toBe('ja');
    expect(getCurrentLocale(makeUrl('/esperanto'))).toBe('ja');
    expect(getCurrentLocale(makeUrl('/korean'))).toBe('ja');
  });

  it('does not match a locale that appears mid-path', () => {
    expect(getCurrentLocale(makeUrl('/blog/en'))).toBe('ja');
    expect(getCurrentLocale(makeUrl('/blog/en/post'))).toBe('ja');
    expect(getCurrentLocale(makeUrl('/docs/es/guide'))).toBe('ja');
  });
});

describe('getLocalizedUrl', () => {
  it('returns the path unchanged for "ja"', () => {
    expect(getLocalizedUrl('/about', 'ja')).toBe('/about');
    expect(getLocalizedUrl('/', 'ja')).toBe('/');
  });

  it.each([
    ['/about', 'en', '/en/about'],
    ['/blog/post', 'zh', '/zh/blog/post'],
    ['/contact', 'ko', '/ko/contact'],
    ['/services', 'es', '/es/services'],
  ] as const)('prefixes %s for locale %s', (path, locale, expected) => {
    expect(getLocalizedUrl(path, locale)).toBe(expected);
  });

  it('maps root "/" to the bare locale prefix (no trailing slash)', () => {
    expect(getLocalizedUrl('/', 'en')).toBe('/en');
    expect(getLocalizedUrl('/', 'zh')).toBe('/zh');
    expect(getLocalizedUrl('/', 'ko')).toBe('/ko');
    expect(getLocalizedUrl('/', 'es')).toBe('/es');
  });

  it('round-trips with getCurrentLocale for root and non-root paths', () => {
    for (const locale of ['en', 'zh', 'ko', 'es'] as const) {
      for (const path of ['/', '/blog']) {
        const localized = getLocalizedUrl(path, locale);
        expect(getCurrentLocale(makeUrl(localized))).toBe(locale);
      }
    }
  });
});

describe('getOtherLocale', () => {
  it('cycles through the locale order ja -> en -> zh -> ko -> es -> ja', () => {
    expect(getOtherLocale('ja')).toBe('en');
    expect(getOtherLocale('en')).toBe('zh');
    expect(getOtherLocale('zh')).toBe('ko');
    expect(getOtherLocale('ko')).toBe('es');
    expect(getOtherLocale('es')).toBe('ja');
  });

  it('visits every locale exactly once over a full cycle', () => {
    const visited: Locale[] = [];
    let current: Locale = 'ja';
    for (let i = 0; i < 5; i++) {
      current = getOtherLocale(current);
      visited.push(current);
    }
    expect([...visited].sort()).toEqual([...LOCALES].sort());
    expect(current).toBe('ja'); // returns to the start
  });
});

describe('emphasizeKyousou', () => {
  const WRAPPED = '<span class="nowrap">「きょうそう」</span>';

  it('wraps a bracketed occurrence in a nowrap span', () => {
    expect(emphasizeKyousou('「きょうそう」')).toBe(WRAPPED);
  });

  it('leaves text without the bracketed term untouched', () => {
    expect(emphasizeKyousou('きょうそう')).toBe('きょうそう');
    expect(emphasizeKyousou('普通のテキスト')).toBe('普通のテキスト');
    expect(emphasizeKyousou('')).toBe('');
  });

  it('wraps every occurrence when the term appears multiple times', () => {
    const input = '「きょうそう」と「きょうそう」';
    expect(emphasizeKyousou(input)).toBe(`${WRAPPED}と${WRAPPED}`);
  });

  it('wraps the term even when followed by a definition parenthesis', () => {
    // Current behaviour: the regex matches the bracketed term regardless of
    // the following character, so the definition form is also wrapped.
    expect(emphasizeKyousou('「きょうそう」（共創）')).toBe(`${WRAPPED}（共創）`);
  });

  it('does not mutate the original input string', () => {
    const input = '「きょうそう」';
    const copy = input;
    emphasizeKyousou(input);
    expect(input).toBe(copy);
  });
});

const LOCALES: Locale[] = ['ja', 'en', 'zh', 'ko', 'es'];

describe('getTranslations / getJaTranslations', () => {
  it.each(LOCALES)('returns a non-empty object for locale %s', (locale) => {
    const t = getTranslations(locale);
    expect(t).toBeTypeOf('object');
    expect(t).not.toBeNull();
    expect(Object.keys(t).length).toBeGreaterThan(0);
  });

  it('returns identical top-level keys across all five locales', () => {
    const reference = Object.keys(getTranslations('ja')).sort();
    for (const locale of LOCALES) {
      expect(Object.keys(getTranslations(locale)).sort()).toEqual(reference);
    }
  });

  it('getJaTranslations() is the same object as getTranslations("ja")', () => {
    expect(getJaTranslations()).toBe(getTranslations('ja'));
  });

  it('wires each locale to its own JSON module (no cross-wiring)', () => {
    // Assert identity against the directly-imported JSON so that a mistake like
    // returning en for zh/ko in the translations map is caught. Object identity
    // (toBe) fails if a locale is pointed at the wrong module.
    expect(getTranslations('ja')).toBe(jaJson);
    expect(getTranslations('en')).toBe(enJson);
    expect(getTranslations('zh')).toBe(zhJson);
    expect(getTranslations('ko')).toBe(koJson);
    expect(getTranslations('es')).toBe(esJson);
    expect(getJaTranslations()).toBe(jaJson);
  });
});

// Index-aware recursive key set: objects contribute dotted paths, arrays
// descend into each element with a concrete "[i]" index segment. Using the
// index (rather than a union "[]") means a per-index divergence — e.g. a `link`
// key that moves to a different array position, or a locale gaining/losing an
// array element — surfaces as a distinct path and fails the comparison.
function collectKeys(value: unknown, prefix: string, acc: Set<string>): void {
  if (Array.isArray(value)) {
    value.forEach((el, i) => collectKeys(el, `${prefix}[${i}]`, acc));
  } else if (value !== null && typeof value === 'object') {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      const path = prefix ? `${prefix}.${key}` : key;
      acc.add(path);
      collectKeys((value as Record<string, unknown>)[key], path, acc);
    }
  }
}

function keySet(locale: Locale): Set<string> {
  const acc = new Set<string>();
  collectKeys(getTranslations(locale), '', acc);
  return acc;
}

// Collect the length of every array reachable in the tree, keyed by its
// index-preserving path (e.g. privacy.sections[0].body). Keeping the concrete
// index means a length change in a nested array at ONE position produces a
// distinct Map key, so it cannot be masked by a same-named sibling at another
// index (which a normalized "[]" key would overwrite).
function collectArrayLengths(
  value: unknown,
  prefix: string,
  acc: Map<string, number>,
): void {
  if (Array.isArray(value)) {
    acc.set(prefix, value.length);
    value.forEach((el, i) => collectArrayLengths(el, `${prefix}[${i}]`, acc));
  } else if (value !== null && typeof value === 'object') {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      const path = prefix ? `${prefix}.${key}` : key;
      collectArrayLengths((value as Record<string, unknown>)[key], path, acc);
    }
  }
}

function arrayLengths(locale: Locale): Map<string, number> {
  const acc = new Map<string, number>();
  collectArrayLengths(getTranslations(locale), '', acc);
  return acc;
}

describe('locale JSON key-structure consistency (regression guard M-2)', () => {
  // Compare the translated locales AGAINST en as the reference. en itself is
  // excluded to avoid an en-vs-en self-comparison tautology.
  const TRANSLATED: Locale[] = ['zh', 'ko', 'es'];

  it.each(TRANSLATED)(
    'locale %s has the exact same index-aware key set as en',
    (locale) => {
      const en = keySet('en');
      const target = keySet(locale);
      const missing = [...en].filter((k) => !target.has(k));
      const extra = [...target].filter((k) => !en.has(k));
      expect(missing).toEqual([]);
      expect(extra).toEqual([]);
    },
  );

  it.each(TRANSLATED)(
    'locale %s has the same array lengths as en at every path',
    (locale) => {
      const en = arrayLengths('en');
      const target = arrayLengths(locale);
      expect([...target.keys()].sort()).toEqual([...en.keys()].sort());
      for (const [path, length] of en) {
        expect(target.get(path)).toBe(length);
      }
    },
  );

  it('has no index-aware key that en carries but ja lacks', () => {
    const en = keySet('en');
    const ja = keySet('ja');
    // かつて works.items は ja が `href`・非ja が `link` で、さらに非ja だけ7件目を持つという
    // 食い違いがあった。#313 で全ロケールを `href` / 6件に統一したため、差分はゼロが正。
    const enNotJa = [...en].filter((k) => !ja.has(k)).sort();
    expect(enNotJa).toEqual([]);
  });

  it('gives works.items the same length in every locale', () => {
    const jaLength = arrayLengths('ja').get('works.items');
    expect(jaLength).toBe(6);
    for (const locale of LOCALES) {
      expect(arrayLengths(locale).get('works.items')).toBe(jaLength);
    }
  });

  it('uses the href key (not link) for every works.items entry in every locale', () => {
    // `link` が残っていると WorksIndex のフォールバック頼みになり、ロケール毎に挙動がぶれる。
    for (const locale of LOCALES) {
      const keys = keySet(locale);
      expect([...keys].filter((k) => /^works\.items\[\d+\]\.link$/.test(k))).toEqual([]);
      expect([...keys].filter((k) => /^works\.items\[\d+\]\.href$/.test(k))).toHaveLength(6);
    }
  });
});

// #313: /works・/news・/news/press を全言語で出すために、これらのキーが全ロケールに
// 揃っていることを保証する。1つでも欠けると当該言語のページが undefined を描画する。
describe('works / news / press keys required by every locale (#313)', () => {
  const REQUIRED_PATHS = [
    'nav.press',
    'works.title',
    'works.intro',
    'works.note',
    'works.moreLabel',
    'works.moreHref',
    'works.ndaNote',
    'meta.works.title',
    'meta.works.description',
    'meta.news.title',
    'meta.news.description',
    'meta.press.title',
    'meta.press.description',
    'news.title',
    'news.intro',
    'news.rssLabel',
    'news.empty',
    'news.pressLink',
    'news.prev',
    'news.next',
    'news.countTemplate',
    'news.externalLabel',
    'news.titleSuffix',
    'news.backToList',
    'news.updatedLabel',
    'press.title',
    'press.intro',
    'press.newsListLabel',
    'press.rssLabel',
    'press.empty',
    'press.contactLabel',
    'caseStudy.titleSuffix',
    'caseStudy.breadcrumbWorks',
    'caseStudy.ndaHeading',
    'caseStudy.updatedLabel',
    'caseStudy.nextHeading',
    'caseStudy.nextLead',
    'caseStudy.relatedHeading',
    'caseStudy.categories.grift',
    'caseStudy.categories.confidential-ai',
    'caseStudy.categories.local-llm',
    'caseStudy.categories.ai-contract',
    'caseStudy.categories.tech-culture',
    'caseStudy.ctas.grift',
    'caseStudy.ctas.confidential-ai',
    'caseStudy.ctas.local-llm',
    'caseStudy.ctas.ai-contract',
    'caseStudy.ctas.techCultureAbout',
    'caseStudy.ctas.techCultureContact',
    'nextStep.works.heading',
    'nextStep.works.lead',
    'nextStep.works.ctaLabel',
  ];

  const read = (locale: Locale, path: string): unknown =>
    path
      .split('.')
      .reduce<unknown>(
        (node, key) =>
          node !== null && typeof node === 'object'
            ? (node as Record<string, unknown>)[key]
            : undefined,
        getTranslations(locale),
      );

  it.each(LOCALES)('locale %s defines every required key as a non-empty string', (locale) => {
    const missing = REQUIRED_PATHS.filter((path) => {
      const value = read(locale, path);
      return typeof value !== 'string' || value.trim() === '';
    });
    expect(missing).toEqual([]);
  });

  it.each(LOCALES)('locale %s keeps every placeholder in news.countTemplate', (locale) => {
    // プレースホルダが欠けると「N件中 …」の数字が黙って消える。
    const template = read(locale, 'news.countTemplate') as string;
    for (const placeholder of ['{total}', '{start}', '{end}', '{current}', '{last}']) {
      expect(template).toContain(placeholder);
    }
  });

  it.each(LOCALES)('locale %s uses a site-relative works.moreHref', (locale) => {
    // ページ側で getLocalizedUrl を掛けるため、ja 基準のサイト内パスであることが前提。
    expect(read(locale, 'works.moreHref')).toBe('/blog');
  });

  it('translates nav.press away from the ja wording in every other locale', () => {
    // 「全言語にキーはあるが中身が ja のコピー」という未翻訳の取りこぼしを検出する。
    const ja = read('ja', 'nav.press');
    for (const locale of LOCALES.filter((l) => l !== 'ja')) {
      expect(read(locale, 'nav.press')).not.toBe(ja);
    }
  });
});

// ADR-0022: 事業の柱は5本。トップ（services2026）・会社概要・FAQ・meta で同じ並び・同じ言い回しにする。
// 柱の名前の正本は companyPage.business[].name。文中では小文字になる言語があるため大小は区別しない。
describe('business pillars keep one order and wording (ADR-0022)', () => {
  const pillarNames = (locale: Locale) =>
    getTranslations(locale).companyPage.business.map((pillar) => pillar.name);

  it.each(LOCALES)('locale %s names the services2026 items after the pillars, in order', (locale) => {
    const names = getTranslations(locale).services2026.items.map((item) => item.name.split(/\s*[｜|]\s*/)[0]);
    expect(names).toEqual(pillarNames(locale));
  });

  it.each(LOCALES)('locale %s lists every pillar in order in the FAQ, meta and company profile', (locale) => {
    const t = getTranslations(locale);
    const names = pillarNames(locale).map((name) => name.toLowerCase());
    const texts = {
      'faq.questions[0].answer': t.faq.questions[0].answer,
      'meta.company.description': t.meta.company.description,
      'companyPage.profile[4].value': t.companyPage.profile[4].value,
    };
    for (const [path, text] of Object.entries(texts)) {
      // 文中に出てくる順に並べ直した柱の名前。抜け・言い換え・並びの違いは、正本との差として出る。
      const lower = text.toLowerCase();
      const inTextOrder = names
        .filter((name) => lower.includes(name))
        .sort((a, b) => lower.indexOf(a) - lower.indexOf(b));
      expect(inTextOrder, `${locale} ${path}`).toEqual(names);
    }
  });
});

// Epic #104: 業種別ページの「02」の欄の見出しは、どの業種でも「Cor.は、こう伴走します。」。
// 医療だけ「こうお手伝いします。」になっていたのを 2026-10-26 のレビューで直した（#421）。
// 同じ日に、欄の導入文（support.intro）も医療の文にそろえた。ほかの 4 業種は Grift を
// 組み合わせる例に挙げていたが、ADR-0022 で業種別ページから Grift の導線を外している。
// 5 つの業種で見出しと導入文がそろっていることを、言語ごとに確かめる。
describe('industry pages share one support heading (Epic #104)', () => {
  const INDUSTRIES = [
    'industryMedical',
    'industryShigyo',
    'industryConstruction',
    'industryManufacturing',
    'industryEducation',
  ] as const;

  it.each(LOCALES)('locale %s uses the same support.eyebrow, title and intro on every industry page', (locale) => {
    const t = getTranslations(locale);
    for (const field of ['eyebrow', 'title', 'intro'] as const) {
      const observed = Object.fromEntries(INDUSTRIES.map((key) => [key, t[key].support[field]]));
      const expected = Object.fromEntries(INDUSTRIES.map((key) => [key, t.industryShigyo.support[field]]));
      expect(observed, `${locale} support.${field}`).toEqual(expected);
    }
  });

  it.each(LOCALES)('locale %s does not offer Grift in any industry support.intro (ADR-0022)', (locale) => {
    const t = getTranslations(locale);
    const observed = Object.fromEntries(INDUSTRIES.map((key) => [key, t[key].support.intro]));
    for (const [key, intro] of Object.entries(observed)) {
      expect(intro, `${locale} ${key}.support.intro`).not.toMatch(/grift/i);
    }
  });

  it('uses the 伴走 wording in ja', () => {
    const ja = getJaTranslations();
    expect(ja.industryMedical.support.title).toBe('Cor.は、こう伴走します。');
    // hero.subtitle の結びも、5 業種とも「伴走」で言う（士業だけ「お手伝いします」だった）。
    const subtitles = Object.fromEntries(INDUSTRIES.map((key) => [key, ja[key].hero.subtitle]));
    for (const [key, subtitle] of Object.entries(subtitles)) {
      expect(subtitle, `ja ${key}.hero.subtitle`).toContain('伴走します。');
      expect(subtitle, `ja ${key}.hero.subtitle`).not.toContain('お手伝いします');
    }
  });
});
