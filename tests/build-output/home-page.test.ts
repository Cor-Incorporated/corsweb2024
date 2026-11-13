// ビルド済み dist のトップページの検査（設定: vitest.dist.config.ts。`npm run build` の後に `npm run test:dist`）。
// 2026-10-26: トップが長く、最初の画面に技術の言葉が先に来て、信頼の材料が下にあった（社内のレビュー、#414）。
// 並びは「課題 → 実証 → 柱 → セキュリティ → 業種 → Grift → FAQ → 締め」（docs/story-spine.md）。
// locale と index.astro の検査は src/utils/__tests__/home-page.test.ts。
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import jaJson from '../../src/i18n/locales/ja.json';
import enJson from '../../src/i18n/locales/en.json';
import zhJson from '../../src/i18n/locales/zh.json';
import koJson from '../../src/i18n/locales/ko.json';
import esJson from '../../src/i18n/locales/es.json';
import { INDUSTRY_SLUGS, industryPagePath } from '../../src/config/industry-context';

const DIST_DIR = path.resolve(process.env.CONTACT_GUARD_DIST_DIR || 'dist');
const LOCALES = { ja: jaJson, en: enJson, zh: zhJson, ko: koJson, es: esJson } as const;
type LocaleKey = keyof typeof LOCALES;
const LOCALE_KEYS = Object.keys(LOCALES) as LocaleKey[];
const FIRST_SCREEN_JARGON = /LLM|PoC|RAG|Grift/;

const prefix = (locale: LocaleKey) => (locale === 'ja' ? '' : locale);

function readHome(locale: LocaleKey): string {
  const file = path.join(DIST_DIR, prefix(locale), 'index.html');
  expect(existsSync(file), `${file} が無い。先に npm run build を実行する`).toBe(true);
  return readFileSync(file, 'utf8');
}

function decode(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

function textOf(fragment: string): string {
  const withoutCode = fragment.replace(/<(script|style)\b[\s\S]*?<\/\1>/g, '');
  return decode(withoutCode.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

function mainOf(html: string): string {
  const match = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/);
  expect(match, '<main> が無い').not.toBeNull();
  return match![1];
}

describe('トップの見出しの並び (#414)', () => {
  it.each(LOCALE_KEYS)('%s: 本文の h2 が決めた並びのとおりで、外した欄が残っていない', (locale) => {
    const t = LOCALES[locale];
    const expected = [
      t.homeChallenges.title,
      t.proof.title,
      t.services2026.title,
      t.securityTrust.title,
      t.homeIndustries.title,
      t.griftBridge.title,
      t.faq.title,
      t.finalCta.title,
    ];
    const headings = [...mainOf(readHome(locale)).matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => textOf(m[1]));
    expect(headings).toEqual(expected);
  });

  it.each(LOCALE_KEYS)('%s: 業種の入口が最初の h2 より前にあり、既存のラベルとリンクが一致する', (locale) => {
    const t = LOCALES[locale];
    const main = mainOf(readHome(locale));
    const markerAt = main.indexOf('data-home-industry-entry');
    expect(markerAt, '業種の入口が無い').toBeGreaterThanOrEqual(0);
    const h2At = main.search(/<h2\b/);
    expect(h2At, 'h2 が無い').toBeGreaterThanOrEqual(0);
    expect(markerAt).toBeLessThan(h2At);

    const navStart = main.lastIndexOf('<nav', markerAt);
    const navEnd = main.indexOf('</nav>', markerAt);
    expect(navStart).toBeGreaterThanOrEqual(0);
    expect(navEnd).toBeGreaterThan(navStart);
    const entry = main.slice(navStart, navEnd);
    expect(entry).not.toMatch(/<h[12]\b/);

    const text = textOf(entry);
    expect(text).toContain(t.homeIndustries.eyebrow);
    // 見出しの文は業種の欄の h2 にだけ出す（トップに同じ文を 2 回出さない）
    expect(text).not.toContain(t.homeIndustries.title);
    const hrefs = [...entry.matchAll(/\bhref=["']?([^"'\s>]+)/g)].map((m) => decode(m[1]).split(/[?#]/)[0].replace(/\/+$/, ''));
    expect(hrefs).toEqual(INDUSTRY_SLUGS.map((slug) => `${locale === 'ja' ? '' : `/${locale}`}${industryPagePath(slug)}`));
    const marks = [...entry.matchAll(/\bdata-industry-entry=["']?([\w-]+)/g)].map((m) => m[1]);
    expect(marks).toEqual([...INDUSTRY_SLUGS]);
    for (const row of t.homeIndustries.rows) {
      expect(text).toContain(row.industry);
    }
  });

  it.each(LOCALE_KEYS)('%s: 業種の入口はヒーローの中、診断の主ボタンより後にある', (locale) => {
    const hero = mainOf(readHome(locale)).match(/<section\b[\s\S]*?<\/section>/)?.[0] ?? '';
    expect(hero, 'ヒーローの section が無い').not.toBe('');
    const entryAt = hero.indexOf('data-home-industry-entry');
    expect(entryAt, 'ヒーローの中に業種の入口が無い').toBeGreaterThanOrEqual(0);
    expect(hero.search(/intent=confidential-ai-assessment/)).toBeLessThan(entryAt);
  });
});

describe('最初の画面 (#414)', () => {
  it.each(LOCALE_KEYS)('%s: ヒーローに技術・製品の名前がなく、診断の入口と実績へのリンクがある', (locale) => {
    const hero = mainOf(readHome(locale)).match(/<section\b[\s\S]*?<\/section>/)?.[0] ?? '';
    expect(hero, 'ヒーローの section が無い').not.toBe('');
    expect(textOf(hero)).not.toMatch(FIRST_SCREEN_JARGON);
    expect(hero).toMatch(/href=["']?[^"'\s>]*intent=confidential-ai-assessment/);
    const works = locale === 'ja' ? '/works' : `/${locale}/works`;
    expect(hero).toMatch(new RegExp(`href=["']?${works}/?["'\\s>]`));
  });

  it.each(LOCALE_KEYS)('%s: 業種の入口の a が 5 つあり、a にも祖先にも、隠す class・属性・style が無い', (locale) => {
    const entries = elementsWithAncestors(mainOf(readHome(locale)), /\bdata-industry-entry=/);
    expect(entries.map((entry) => entry.attrs.match(/data-industry-entry=["']?([\w-]+)/)?.[1]), '入口の a の行き先').toEqual([...INDUSTRY_SLUGS]);
    const hidden = entries.flatMap((entry) =>
      [entry, ...entry.ancestors].filter((el) => hidesElement(el.attrs)).map((el) => `${entry.attrs.match(/data-industry-entry=["']?([\w-]+)/)?.[1]}: <${el.tag} ${el.attrs.trim().slice(0, 120)}>`),
    );
    expect(hidden, '入口を隠している要素').toEqual([]);
  });

});

// 要素の開きタグと、その祖先の開きタグ（main の中だけ。script と style の中身は見ない）
interface OpenTag {
  tag: string;
  attrs: string;
}
const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
function elementsWithAncestors(html: string, match: RegExp): (OpenTag & { ancestors: OpenTag[] })[] {
  const body = html.replace(/<(script|style)\b[\s\S]*?<\/\1>/g, '').replace(/<!--[\s\S]*?-->/g, '');
  const stack: OpenTag[] = [];
  const found: (OpenTag & { ancestors: OpenTag[] })[] = [];
  for (const m of body.matchAll(/<(\/?)([a-zA-Z][\w-]*)([^>]*)>/g)) {
    const [, closing, rawTag, attrs] = m;
    const tag = rawTag.toLowerCase();
    if (closing) {
      const at = stack.map((el) => el.tag).lastIndexOf(tag);
      if (at >= 0) stack.length = at;
      continue;
    }
    if (match.test(attrs)) found.push({ tag, attrs, ancestors: [...stack].reverse() });
    if (!VOID_TAGS.has(tag) && !attrs.trim().endsWith('/')) stack.push({ tag, attrs });
  }
  return found;
}

// 見えなくする印: Tailwind の hidden・invisible・sr-only（画面の幅の接頭辞つきを含む）、hidden 属性、x-cloak、x-show、display:none
function hidesElement(attrs: string): boolean {
  const cls = attrs.match(/\bclass=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/)?.slice(1).find((v) => v !== undefined) ?? '';
  const classHides = cls.split(/\s+/).some((name) => /^(?:[\w-]+:)*(hidden|invisible|sr-only)$/.test(name));
  const attrHides = /(^|\s)(hidden|x-cloak|x-show)(=|\s|$)/.test(attrs);
  const styleHides = /style=["']?[^"'>]*display\s*:\s*none/i.test(attrs);
  return classHides || attrHides || styleHides;
}

// 本文に描画されたサイト内リンク（クエリと # を除いたパス）
function internalHrefs(html: string): string[] {
  const hrefs = [...mainOf(html).matchAll(/\bhref=["']?([^"'\s>]+)/g)].map((m) => decode(m[1]));
  return [...new Set(hrefs.filter((href) => href.startsWith('/')).map((href) => href.split(/[?#]/)[0]))];
}

function existsInDist(href: string): boolean {
  return existsSync(path.join(DIST_DIR, href.replace(/^\/+|\/+$/g, ''), 'index.html'));
}

describe('トップからのリンク先 (#414)', () => {
  it.each(LOCALE_KEYS)('%s: 本文のサイト内リンクが、その言語のページを指し、dist にある', (locale) => {
    const hrefs = internalHrefs(readHome(locale));
    expect(hrefs.length, '本文にサイト内リンクが無い').toBeGreaterThan(0);
    expect(hrefs.filter((href) => !existsInDist(href)), 'dist に無いリンク先').toEqual([]);
    if (locale !== 'ja') {
      // 代表の物語は、訳がまだない言語では ja の記事へ戻す決まり（src/utils/founder-story.ts）なので除く
      const otherLocale = hrefs.filter((href) => !href.startsWith(`/${locale}/`) && href !== `/${locale}` && !href.includes('/blog/founder-story'));
      expect(otherLocale, `/${locale}/ で始まらないリンク`).toEqual([]);
    }
  });

  it.each(LOCALE_KEYS)('%s: 課題・業種のカードが locale のリンク先どおりに描画されている', (locale) => {
    const t = LOCALES[locale];
    const hrefs = internalHrefs(readHome(locale)).map((href) => href.replace(/\/+$/, ''));
    const expected = [...t.homeChallenges.items.map((item) => item.link), ...t.homeIndustries.rows.map((row) => row.link)].map(
      (link) => (locale === 'ja' ? link : `/${locale}${link}`),
    );
    expect(expected.filter((link) => !hrefs.includes(link)), '本文に無いリンク').toEqual([]);
  });

  it.each(LOCALE_KEYS)('%s: FAQ の構造化データが残っている（AIO）', (locale) => {
    expect(readHome(locale)).toMatch(/"@type":\s*"FAQPage"/);
  });
});
