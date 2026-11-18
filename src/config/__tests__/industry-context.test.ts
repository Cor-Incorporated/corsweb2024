// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import jaJson from '../../i18n/locales/ja.json';
import enJson from '../../i18n/locales/en.json';
import zhJson from '../../i18n/locales/zh.json';
import koJson from '../../i18n/locales/ko.json';
import esJson from '../../i18n/locales/es.json';
import {
  INDUSTRY_META_KEYS,
  INDUSTRY_NAMED_CASE,
  INDUSTRY_SLUGS,
  industryContactSource,
  industryPagePath,
  industryRowsInOrder,
  industrySlugFromPath,
  isIndustrySlug,
} from '../industry-context';

const ROOT = path.resolve(__dirname, '../../..');
const LOCALES = { ja: jaJson, en: enJson, zh: zhJson, ko: koJson, es: esJson } as const;
type LocaleKey = keyof typeof LOCALES;
const LOCALE_KEYS = Object.keys(LOCALES) as LocaleKey[];
// 正本を書き換えても、この試験の件数が一緒に減らないようにする（一覧から 1 つ消すと落ちる）
const EXPECTED_INDUSTRY_COUNT = 5;

const slugOfLink = (link: string) => link.replace(/\/+$/, '').split('/').pop() ?? link;
const show = (values: readonly string[]) => `[${values.join(', ')}]`;

// src/pages/[lang]/industries/[industry].astro に書かれた業種の並び（`const <name> = [...]` と `const <name> = { ... }` のキー）
function listedInLocalizedRoute(): { industries: string[]; bodies: string[]; metaKeys: Record<string, string> } {
  const source = readFileSync(path.join(ROOT, 'src/pages/[lang]/industries/[industry].astro'), 'utf8');
  const array = source.match(/const industries = \[([^\]]*)\]/)?.[1] ?? '';
  const objectBody = (name: string) => source.match(new RegExp(`const ${name} = \\{([\\s\\S]*?)\\}`))?.[1] ?? '';
  const keysOf = (body: string) => [...body.matchAll(/^\s*(\w+):/gm)].map((m) => m[1]);
  const metaKeys = Object.fromEntries([...objectBody('metaKeys').matchAll(/^\s*(\w+):\s*'(\w+)'/gm)].map((m) => [m[1], m[2]]));
  return {
    industries: [...array.matchAll(/'([\w-]+)'/g)].map((m) => m[1]),
    bodies: keysOf(objectBody('bodies')),
    metaKeys,
  };
}

describe('業種ページの source', () => {
  it.each(INDUSTRY_SLUGS)('%s のパスから industry-* を返す', (slug) => {
    expect(industrySlugFromPath(`/industries/${slug}`)).toBe(slug);
    expect(industrySlugFromPath(`/industries/${slug}/`)).toBe(slug);
    expect(industrySlugFromPath(`/en/industries/${slug}`)).toBe(slug);
    expect(industryContactSource(slug)).toBe(`industry-${slug}`);
    expect(industryPagePath(slug)).toBe(`/industries/${slug}`);
    expect(isIndustrySlug(slug)).toBe(true);
  });

  it('業種ページ以外は null', () => {
    expect(industrySlugFromPath('/')).toBeNull();
    expect(industrySlugFromPath('/contact')).toBeNull();
    expect(industrySlugFromPath('/industries/medical/extra')).toBeNull();
    expect(industrySlugFromPath('/industries/retail')).toBeNull();
    expect(isIndustrySlug('retail')).toBe(false);
  });

  it('公開本文が業種を名指しする実績は教育だけ', () => {
    expect(INDUSTRY_NAMED_CASE).toEqual({ education: 'legacy-core-system-cloud-migration' });
  });
});

describe('5 業種の一覧が、使っている場所のどれとも食い違わない', () => {
  it('正本の業種の数', () => {
    expect(INDUSTRY_SLUGS, `INDUSTRY_SLUGS=${show(INDUSTRY_SLUGS)}`).toHaveLength(EXPECTED_INDUSTRY_COUNT);
    expect(Object.keys(INDUSTRY_META_KEYS)).toEqual([...INDUSTRY_SLUGS]);
  });

  it.each(LOCALE_KEYS)('%s: homeIndustries.rows の業種と並びが INDUSTRY_SLUGS と同じ', (locale) => {
    const rows = LOCALES[locale].homeIndustries.rows;
    const fromLocale = rows.map((row) => slugOfLink(row.link));
    expect(fromLocale, `${locale}.homeIndustries.rows=${show(fromLocale)} / INDUSTRY_SLUGS=${show(INDUSTRY_SLUGS)}`).toEqual([
      ...INDUSTRY_SLUGS,
    ]);
    expect(rows.map((row) => row.link)).toEqual(INDUSTRY_SLUGS.map(industryPagePath));
  });

  it.each(LOCALE_KEYS)('%s: 業種ページの title と description の key が 5 業種ともある', (locale) => {
    const meta = LOCALES[locale].meta as Record<string, { title?: string; description?: string } | undefined>;
    const missing = INDUSTRY_SLUGS.filter((slug) => !meta[INDUSTRY_META_KEYS[slug]]?.title || !meta[INDUSTRY_META_KEYS[slug]]?.description);
    expect(missing, `${locale}.meta に title か description が無い業種`).toEqual([]);
  });

  it('ja の業種ページの file（src/pages/industries/*.astro）が INDUSTRY_SLUGS と同じ', () => {
    const files = readdirSync(path.join(ROOT, 'src/pages/industries'))
      .filter((name) => name.endsWith('.astro'))
      .map((name) => name.replace(/\.astro$/, ''))
      .sort();
    const expected = [...INDUSTRY_SLUGS].sort();
    expect(files, `src/pages/industries=${show(files)} / INDUSTRY_SLUGS=${show(expected)}`).toEqual(expected);
  });

  it('ja の業種ページが、正本と同じ meta の key を読む', () => {
    const wrong = INDUSTRY_SLUGS.filter((slug) => {
      const source = readFileSync(path.join(ROOT, 'src/pages/industries', `${slug}.astro`), 'utf8');
      return !source.includes(`t.meta.${INDUSTRY_META_KEYS[slug]}.title`) || !source.includes(`t.meta.${INDUSTRY_META_KEYS[slug]}.description`);
    });
    expect(wrong, '別の meta の key を読んでいる ja の業種ページ').toEqual([]);
  });

  it('他の言語の業種ページ（[lang]/industries/[industry].astro）の一覧が INDUSTRY_SLUGS と同じ', () => {
    const route = listedInLocalizedRoute();
    expect(route.industries, `getStaticPaths の industries=${show(route.industries)} / INDUSTRY_SLUGS=${show(INDUSTRY_SLUGS)}`).toEqual([
      ...INDUSTRY_SLUGS,
    ]);
    expect(route.bodies, `bodies=${show(route.bodies)} / INDUSTRY_SLUGS=${show(INDUSTRY_SLUGS)}`).toEqual([...INDUSTRY_SLUGS]);
    expect(route.metaKeys, 'metaKeys が INDUSTRY_META_KEYS と違う').toEqual(INDUSTRY_META_KEYS);
  });
});

describe('industryRowsInOrder', () => {
  const rows = INDUSTRY_SLUGS.map((slug) => ({ link: industryPagePath(slug), name: slug }));

  it('正本と同じ行は、slug を付けてそのまま返す', () => {
    expect(industryRowsInOrder(rows, 'ja').map((row) => row.slug)).toEqual([...INDUSTRY_SLUGS]);
  });

  it('行が足りないと、両方の値を挙げて止める', () => {
    expect(() => industryRowsInOrder(rows.slice(0, 4), 'ja')).toThrow(
      /\[medical, shigyo, construction, manufacturing\].*\[medical, shigyo, construction, manufacturing, education\]/,
    );
  });

  it('並びが違うと止める', () => {
    expect(() => industryRowsInOrder([...rows].reverse(), 'en')).toThrow(/^en: /);
  });
});
