// ビルド済み dist の、業種のページ 25 枚（5 業種 × 5 言語）の検索向けの値の検査。
// 設定: vitest.dist.config.ts。`npm run build` の後に `npm run test:dist`。
// 見るもの: <title> と description が locale の meta の値どおりに出て、同じ言語の中で 5 業種とも別の文で、
// title に業種が分かる語を含むこと。トップの入口とヘッダーの業種メニューの名前が、行き先の業種の語を含むこと。canonical が自分の URL で、hreflang が 5 言語と x-default でそろい、
// sitemap に 25 の URL が載っていること。title と description の値そのものは、値を入れる側の試験が確かめる。
// 業種の一覧は src/config/industry-context.ts の INDUSTRY_SLUGS。
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { INDUSTRY_META_KEYS, INDUSTRY_SLUGS, industryPagePath, type IndustrySlug } from '../../src/config/industry-context';
import jaJson from '../../src/i18n/locales/ja.json';
import enJson from '../../src/i18n/locales/en.json';
import zhJson from '../../src/i18n/locales/zh.json';
import koJson from '../../src/i18n/locales/ko.json';
import esJson from '../../src/i18n/locales/es.json';

const DIST_DIR = path.resolve(process.env.CONTACT_GUARD_DIST_DIR || 'dist');
const SITE = 'https://cor-jp.com';
const LOCALES = { ja: jaJson, en: enJson, zh: zhJson, ko: koJson, es: esJson } as const;
type Locale = keyof typeof LOCALES;
const LOCALE_KEYS = Object.keys(LOCALES) as Locale[];

// 入っていれば「どの業種か」が分かる語（大文字・小文字は区別しない）。業種のページの title と、
// トップの入口・ヘッダーの業種メニューの名前の両方に使う。「Cor.株式会社｜1」のような業種の分からない
// title と、名前と行き先の食い違い（「医療」の行き先に「教育」と書く）を落とすため。
const INDUSTRY_TERMS: Record<Locale, Record<IndustrySlug, readonly string[]>> = {
  ja: { medical: ['医療'], shigyo: ['士業'], construction: ['建設'], manufacturing: ['製造'], education: ['学校', '教育'] },
  en: {
    medical: ['healthcare', 'hospital', 'medical', 'clinic'],
    shigyo: ['professional', 'law', 'tax', 'accounting'],
    construction: ['construction'],
    manufacturing: ['manufactur'],
    education: ['school', 'education', 'universit'],
  },
  zh: { medical: ['医疗', '医院'], shigyo: ['士业', '律师', '税理'], construction: ['建设', '建筑'], manufacturing: ['制造'], education: ['学校', '教育'] },
  ko: { medical: ['의료', '병원'], shigyo: ['士業', '전문직', '세무', '법률'], construction: ['건설'], manufacturing: ['제조'], education: ['학교', '교육'] },
  es: {
    medical: ['sanidad', 'sanitari', 'salud', 'médic', 'medicin', 'hospital'],
    shigyo: ['profesion', 'despacho', 'abogad', 'asesor'],
    construction: ['construcción'],
    manufacturing: ['manufactur', 'industria', 'fabricación'],
    education: ['educa', 'escuela', 'colegio', 'universidad'],
  },
};

const pagePath = (locale: Locale, slug: IndustrySlug) => `${locale === 'ja' ? '' : `/${locale}`}${industryPagePath(slug)}`;

function decode(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

// 圧縮後の HTML は属性の順番と引用符が変わるので、タグごとに属性を読む
function attrs(tag: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const m of tag.replace(/^<\w+|\/?>$/g, '').matchAll(/([\w:-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
    result[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return result;
}

interface PageMeta {
  title: string;
  description: string;
  canonical: string;
  alternates: Record<string, string>;
}

const noSlash = (url: string) => url.replace(/\/+$/, '');

function readMeta(locale: Locale, slug: IndustrySlug): PageMeta {
  const file = path.join(DIST_DIR, pagePath(locale, slug).replace(/^\//, ''), 'index.html');
  expect(existsSync(file), `${file} が無い。先に npm run build を実行する`).toBe(true);
  const html = readFileSync(file, 'utf8');
  const head = html.match(/<head\b[\s\S]*?<\/head>/)?.[0] ?? '';
  const metas = [...head.matchAll(/<meta\b[^>]*>/g)].map((m) => attrs(m[0]));
  const links = [...head.matchAll(/<link\b[^>]*>/g)].map((m) => attrs(m[0]));
  return {
    title: decode(head.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '').trim(),
    description: metas.find((m) => m.name === 'description')?.content ?? '',
    canonical: noSlash(links.find((l) => l.rel === 'canonical')?.href ?? ''),
    alternates: Object.fromEntries(links.filter((l) => l.rel === 'alternate' && l.hreflang).map((l) => [l.hreflang, noSlash(l.href)])),
  };
}

// トップ（dist）の、data-industry-entry の付いた入口と、ヘッダーの業種メニューの a の行き先と文字
function homeIndustryLinks(locale: Locale): { place: string; slug: string; text: string }[] {
  const file = path.join(DIST_DIR, locale === 'ja' ? '' : locale, 'index.html');
  expect(existsSync(file), `${file} が無い。先に npm run build を実行する`).toBe(true);
  const html = readFileSync(file, 'utf8');
  const text = (fragment: string) => decode(fragment.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').replace(/→/g, '').trim();
  const entry = [...html.matchAll(/<a\b([^>]*\bdata-industry-entry=["']?([\w-]+)[^>]*)>([\s\S]*?)<\/a>/g)].map((m) => ({
    place: 'トップの入口',
    slug: m[2],
    text: text(m[3]),
  }));
  const menu = html.match(/<ul\b[^>]*data-menu=["']?industries["'\s>][^>]*>([\s\S]*?)<\/ul>/)?.[1] ?? '';
  const header = [...menu.matchAll(/<a\b[^>]*\bhref=["']?([^"'\s>]+)[^>]*>([\s\S]*?)<\/a>/g)].map((m) => ({
    place: 'ヘッダーの業種メニュー',
    slug: decode(m[1]).replace(/\/+$/, '').split('/').pop() ?? '',
    text: text(m[2]),
  }));
  return [...entry, ...header];
}

const metaOf = (locale: Locale) => Object.fromEntries(INDUSTRY_SLUGS.map((slug) => [slug, readMeta(locale, slug)])) as Record<IndustrySlug, PageMeta>;

function duplicates(values: Record<string, string>): string[] {
  const seen = new Map<string, string[]>();
  for (const [key, value] of Object.entries(values)) seen.set(value, [...(seen.get(value) ?? []), key]);
  return [...seen.entries()].filter(([, keys]) => keys.length > 1).map(([value, keys]) => `${keys.join(' と ')}: ${value}`);
}

describe('業種のページの title と description（5 業種 × 5 言語）', () => {
  it.each(LOCALE_KEYS)('%s: dist の title と description が locale の meta の値どおり', (locale) => {
    const meta = metaOf(locale);
    const t = LOCALES[locale].meta as Record<string, { title: string; description: string }>;
    const wrong = INDUSTRY_SLUGS.filter(
      (slug) => meta[slug].title !== t[INDUSTRY_META_KEYS[slug]].title || meta[slug].description !== t[INDUSTRY_META_KEYS[slug]].description,
    ).map((slug) => `${slug}: dist=${JSON.stringify([meta[slug].title, meta[slug].description])} / locale=${JSON.stringify(t[INDUSTRY_META_KEYS[slug]])}`);
    expect(wrong).toEqual([]);
  });

  it.each(LOCALE_KEYS)('%s: title が 5 業種とも別の文で、業種の分かる語を含む', (locale) => {
    const meta = metaOf(locale);
    const titles = Object.fromEntries(INDUSTRY_SLUGS.map((slug) => [slug, meta[slug].title]));
    expect(duplicates(titles), '同じ title の業種').toEqual([]);
    const missingTerm = INDUSTRY_SLUGS.filter(
      (slug) => !INDUSTRY_TERMS[locale][slug].some((term) => meta[slug].title.toLowerCase().includes(term.toLowerCase())),
    ).map((slug) => `${slug}: "${meta[slug].title}" に ${JSON.stringify(INDUSTRY_TERMS[locale][slug])} のどれも無い`);
    expect(missingTerm).toEqual([]);
  });

  it.each(LOCALE_KEYS)('%s: description が 5 業種とも別の文', (locale) => {
    const meta = metaOf(locale);
    const descriptions = Object.fromEntries(INDUSTRY_SLUGS.map((slug) => [slug, meta[slug].description]));
    expect(Object.values(descriptions).filter((d) => d === ''), '空の description').toEqual([]);
    expect(duplicates(descriptions), '同じ description の業種').toEqual([]);
  });
});

describe('トップの入口とヘッダーの業種メニューの名前と行き先', () => {
  it.each(LOCALE_KEYS)('%s: 名前がその行き先の業種の語を含み、ほかの業種の語を含まない', (locale) => {
    const links = homeIndustryLinks(locale);
    expect(links.filter((link) => link.place === 'トップの入口').map((link) => link.slug), 'トップの入口の行き先').toEqual([...INDUSTRY_SLUGS]);
    expect(links.filter((link) => link.place === 'ヘッダーの業種メニュー').map((link) => link.slug), 'ヘッダーの業種メニューの行き先').toEqual([
      ...INDUSTRY_SLUGS,
    ]);
    const hasTerm = (text: string, slug: IndustrySlug) => INDUSTRY_TERMS[locale][slug].some((term) => text.toLowerCase().includes(term.toLowerCase()));
    const wrong = links.flatMap((link) => {
      const slug = link.slug as IndustrySlug;
      const others = INDUSTRY_SLUGS.filter((other) => other !== slug && hasTerm(link.text, other));
      if (hasTerm(link.text, slug) && others.length === 0) return [];
      return [
        `${link.place}: 名前「${link.text}」 / 行き先 ${slug} の語 ${JSON.stringify(INDUSTRY_TERMS[locale][slug])}` +
          (others.length > 0 ? ` / 名前に入っている別の業種 ${others.join(', ')}` : ''),
      ];
    });
    expect(wrong).toEqual([]);
  });
});

describe('業種のページの canonical・hreflang・sitemap', () => {
  it.each(LOCALE_KEYS)('%s: canonical が自分の URL で、hreflang が 5 言語と x-default の同じ業種を指す', (locale) => {
    const wrong: string[] = [];
    for (const slug of INDUSTRY_SLUGS) {
      const meta = readMeta(locale, slug);
      const own = `${SITE}${pagePath(locale, slug)}`;
      if (meta.canonical !== own) wrong.push(`${slug}: canonical=${meta.canonical} / 期待=${own}`);
      const expected = {
        ...Object.fromEntries(LOCALE_KEYS.map((loc) => [loc, `${SITE}${pagePath(loc, slug)}`])),
        'x-default': `${SITE}${pagePath('ja', slug)}`,
      };
      if (JSON.stringify(meta.alternates, Object.keys(expected)) !== JSON.stringify(expected, Object.keys(expected)) || Object.keys(meta.alternates).length !== 6) {
        wrong.push(`${slug}: hreflang=${JSON.stringify(meta.alternates)} / 期待=${JSON.stringify(expected)}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('sitemap に 25 の URL がすべて載っている', () => {
    const files = readdirSync(DIST_DIR).filter((name) => /^sitemap-\d+\.xml$/.test(name));
    expect(files.length, 'sitemap-*.xml が無い').toBeGreaterThan(0);
    const sitemap = files.map((name) => readFileSync(path.join(DIST_DIR, name), 'utf8')).join('\n');
    const urls = LOCALE_KEYS.flatMap((locale) => INDUSTRY_SLUGS.map((slug) => `${SITE}${pagePath(locale, slug)}/`));
    expect(urls).toHaveLength(25);
    expect(urls.filter((url) => !sitemap.includes(`<loc>${url}</loc>`))).toEqual([]);
  });
});
