// ビルド済み dist の、サイト内の問い合わせの link の検査（設定: vitest.dist.config.ts。`npm run build` の後に `npm run test:dist`）。
// サイト内の問い合わせの入口は、問い合わせページ（/contact、/<lang>/contact）を通さず、Cloudia のチャット（/contact/chat/）へ
// 直接向ける。行き先は src/config/site.ts の getContactUrl が作る（intent・source・locale を link 自身が運ぶ）。
// 見るもの:
// 1. 5 言語の全ページで、問い合わせページへの link（a・area・form・button と input の formaction・meta refresh）が 0。
//    www の host も同じ site として数える。言語つきのチャットの path（/<lang>/contact/chat/。そのページは無い）も落とす。
//    除くのは、フッターから問い合わせページのカレンダーの区画へ向ける 1 本だけ（source と hash で名指しする）
// 1b. その 1 本は、カレンダーの区画が在る build では各ページに 1 本、無い build では 0 本
// 2. チャットへの link は、どれも source を持ち、locale がそのページの言語
// 3. 主な入口が、決まった source（と intent）でチャットへ向く
// 4. 記事の本文（Markdown）に書かれた問い合わせページへの link も、そのページの言語のチャットへ向く
//    （本文と訳は `/contact?…` のまま。build の時に src/utils/rehype-contact-links.ts が書き換える）
// 5. hash を持つサイト内の link は、path を末尾の / まで書く（本番は / 付きへ転送し、ページ遷移の間に hash が落ちる）
// 問い合わせページ自身は残している（自分と、言語の切り替えで他の言語の問い合わせページを指す）ので、1 の対象から外す。
// script の中の文字（location.href = '/contact' など）は HTML の属性ではないので、この試験の範囲の外。
// 切り戻し（PUBLIC_CLOUDIA_CONTACT_PRIMARY_ENABLED=false）の build では、入口が問い合わせページを指すので 1〜3 は落ちる作り。
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { CLOUDIA_CHAT_PATH, hasCalendarEmbed, isContactPagePath, normalizeSitePath } from '../../src/config/contact-guards';
import jaJson from '../../src/i18n/locales/ja.json';
import enJson from '../../src/i18n/locales/en.json';

const DIST_DIR = path.resolve(process.env.CONTACT_GUARD_DIST_DIR || 'dist');
const BLOG_JA_DIR = path.resolve('src/content/blog/ja');
const ORIGIN = 'https://cor-jp.com';
const SAME_SITE_ORIGINS = new Set([ORIGIN, 'https://www.cor-jp.com']);
// host の末尾にドットが付いた URL（cor-jp.com.）は同じ site として数えない（今の dist には無い。在れば外への link として素通りする）
const NON_JA = ['en', 'zh', 'ko', 'es'] as const;
type Locale = 'ja' | (typeof NON_JA)[number];

// フッターから、問い合わせページのカレンダーの区画（代表の公開スケジュール）へ直接向ける 1 本
// （src/config/site.ts の getContactCalendarUrl、src/components/contact/Calendar.astro の id）。
// サイト内で問い合わせページを指してよいのはこの 1 本だけ。文言ではなく source と hash で名指しする。
const CALENDAR_SOURCE = 'footer-calendar';
const CALENDAR_ANCHOR = 'contact-calendar';
// その dist を作った build の条件（ci.yml が渡す）。'0' = カレンダーなし、'1' = カレンダーあり（ダミーの ID）
const EXPECT_CALENDAR = process.env.CONTACT_GUARD_EXPECT_CALENDAR;

interface Link {
  kind: string;
  raw: string;
  url: URL;
}

function htmlFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(full);
    return entry.name.endsWith('.html') ? [full] : [];
  });
}

/** dist の file から、そのページの path（/en/company/ など。404.html はそのまま） */
function pagePathOf(file: string): string {
  const relative = path.relative(DIST_DIR, file).split(path.sep).join('/');
  return relative.endsWith('index.html') ? `/${relative.slice(0, -'index.html'.length)}` : `/${relative}`;
}

function localeOf(pagePath: string): Locale {
  const first = pagePath.split('/')[1];
  return (NON_JA as readonly string[]).includes(first) ? (first as Locale) : 'ja';
}

function decode(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

const ATTRIBUTE = String.raw`(?:"([^"]*)"|'([^']*)'|([^\s>]+))`;
const LINK_PATTERNS: ReadonlyArray<{ kind: string; pattern: RegExp }> = [
  { kind: 'a', pattern: new RegExp(String.raw`<a\b[^>]*?\shref=${ATTRIBUTE}`, 'gi') },
  { kind: 'area', pattern: new RegExp(String.raw`<area\b[^>]*?\shref=${ATTRIBUTE}`, 'gi') },
  { kind: 'form', pattern: new RegExp(String.raw`<form\b[^>]*?\saction=${ATTRIBUTE}`, 'gi') },
  { kind: 'formaction', pattern: new RegExp(String.raw`<(?:button|input)\b[^>]*?\sformaction=${ATTRIBUTE}`, 'gi') },
];
const META_REFRESH = new RegExp(String.raw`<meta\b(?=[^>]*http-equiv=["']?refresh)[^>]*?\scontent=${ATTRIBUTE}`, 'gi');

/** ページの中の、同じ origin へ向く link（a・area・form と meta refresh の URL） */
function sameOriginLinks(html: string, pagePath: string): Link[] {
  const base = new URL(pagePath, ORIGIN);
  const links: Link[] = [];
  const push = (kind: string, raw: string) => {
    const value = decode(raw).trim();
    if (!value || /^(?:mailto|tel|javascript|data):/i.test(value) || value.startsWith('#')) return;
    let url: URL;
    try {
      url = new URL(value, base);
    } catch {
      return;
    }
    if (SAME_SITE_ORIGINS.has(url.origin)) links.push({ kind, raw: value, url });
  };
  for (const { kind, pattern } of LINK_PATTERNS) {
    for (const match of html.matchAll(pattern)) push(kind, match[1] ?? match[2] ?? match[3] ?? '');
  }
  for (const match of html.matchAll(META_REFRESH)) {
    const target = decode(match[1] ?? match[2] ?? match[3] ?? '').match(/url\s*=\s*['"]?([^'"]+)/i)?.[1];
    if (target) push('meta', target);
  }
  return links;
}

/** 記事の本文（frontmatter と code を除く）に書かれた、同じ site の問い合わせページへの link の intent（無ければ null） */
function bodyContactIntents(markdown: string): Array<string | null> {
  const body = markdown
    .replace(/^---\n[\s\S]*?\n---\n/, '')
    .replace(/^(```+|~~~+)[^\n]*\n[\s\S]*?^\1[ \t]*$/gm, '')
    .replace(/`[^`\n]*`/g, '');
  return [...body.matchAll(/\]\(\s*<?([^)\s>]+)/g)]
    .flatMap((match) => {
      try {
        return [new URL(match[1], ORIGIN)];
      } catch {
        return [];
      }
    })
    .filter((url) => url.origin === ORIGIN && isContactPagePath(url.pathname))
    .map((url) => url.searchParams.get('intent'));
}

/** 言語つきのチャットの path（/en/contact/chat/ など）。チャットは 1 つの path なので、このページは無い */
const isLocalizedChatPath = (pathname: string) => /^\/(?:en|zh|ko|es)\/contact\/chat(?:\/|$)/.test(pathname);

const isChatLink = (link: Link) => normalizeSitePath(link.url.pathname) === normalizeSitePath(CLOUDIA_CHAT_PATH);

const files = existsSync(DIST_DIR) ? htmlFiles(DIST_DIR) : [];
const pages = files.map((file) => {
  const pagePath = pagePathOf(file);
  const html = readFileSync(file, 'utf8');
  return {
    pagePath,
    locale: localeOf(pagePath),
    links: sameOriginLinks(html, pagePath),
    // 圧縮の後の HTML は属性の引用符を外す（id=footer-heading）ので、どちらの書き方でも見る
    hasSiteFooter: /\sid=["']?footer-heading["'\s>]/.test(html),
  };
});

const contactPathOf = (locale: Locale) => (locale === 'ja' ? '/contact/' : `/${locale}/contact/`);

/**
 * そのページの言語の問い合わせページの、カレンダーの区画へ向く 1 本か。path は末尾の / まで同じであること
 * （/contact は本番で /contact/ へ転送され、ページ遷移の間に hash が落ちて区画に着かない）。
 */
const isCalendarLinkFor = (locale: Locale) => (link: Link) =>
  link.kind === 'a' &&
  link.url.pathname === contactPathOf(locale) &&
  link.url.searchParams.get('source') === CALENDAR_SOURCE &&
  link.url.hash === `#${CALENDAR_ANCHOR}`;

/** その言語の問い合わせページに、id の区画が在り、その中にカレンダーの埋め込みが在るか（link の着く先が実在するか） */
function calendarSectionExists(locale: Locale): boolean {
  const file = path.join(DIST_DIR, ...contactPathOf(locale).split('/').filter(Boolean), 'index.html');
  if (!existsSync(file)) return false;
  const section = new JSDOM(readFileSync(file, 'utf8')).window.document.getElementById(CALENDAR_ANCHOR);
  return section !== null && hasCalendarEmbed(section);
}
const byPath = new Map(pages.map((page) => [page.pagePath, page]));

function chatLinksOn(pagePath: string): Link[] {
  const page = byPath.get(pagePath);
  expect(page, `${pagePath} が dist に無い`).toBeTruthy();
  return (page?.links ?? []).filter(isChatLink);
}

const describeLink = (link: Link) => {
  const { searchParams } = link.url;
  return { source: searchParams.get('source'), intent: searchParams.get('intent'), locale: searchParams.get('locale') };
};

describe('サイト内の問い合わせの link（Cloudia のチャットへ直接）', () => {
  it('dist がある', () => {
    expect(existsSync(DIST_DIR), `${DIST_DIR} が無い。先に npm run build を実行する`).toBe(true);
    expect(pages.length, 'dist の HTML が少なすぎる').toBeGreaterThan(500);
  });

  it('5 言語の全ページで、問い合わせページと無いチャットの path への link が 0（問い合わせページ自身と、カレンダーの区画への 1 本を除く。記事の本文の link も含む）', () => {
    const found = pages
      .filter((page) => !isContactPagePath(page.pagePath))
      .flatMap((page) =>
        page.links
          .filter((link) => !isCalendarLinkFor(page.locale)(link))
          .filter((link) => isContactPagePath(link.url.pathname) || isLocalizedChatPath(link.url.pathname))
          .map((link) => `${page.pagePath} → ${link.kind} ${link.raw}`),
      );
    expect(found).toEqual([]);
  });

  // ja の記事の本文（code の外）に、問い合わせページへの link を書いた記事。記事の名前は持たず、本文から数える。
  const articlesWithBodyLinks = existsSync(BLOG_JA_DIR)
    ? readdirSync(BLOG_JA_DIR)
        .filter((name) => /\.mdx?$/.test(name))
        .map((name) => ({
          slug: name.replace(/\.mdx?$/, ''),
          intents: bodyContactIntents(readFileSync(path.join(BLOG_JA_DIR, name), 'utf8')),
        }))
        .filter((article) => article.intents.length > 0)
    : [];

  it('本文に問い合わせページへの link を書いた記事が在る（下の試験が空振りしない）', () => {
    expect(articlesWithBodyLinks.length).toBeGreaterThan(0);
  });

  it.each(articlesWithBodyLinks)('記事の本文の link: $slug（5 言語のページで、その言語のチャットへ・元の intent を保つ）', ({ slug, intents }) => {
    const localized = ['ja', ...NON_JA].map((locale) => (locale === 'ja' ? `/blog/${slug}/` : `/${locale}/blog/${slug}/`));
    const problems = localized
      .filter((pagePath) => byPath.has(pagePath))
      .flatMap((pagePath) => {
        const page = byPath.get(pagePath)!;
        const fromArticle = page.links.filter(isChatLink).filter((link) => link.url.searchParams.get('source') === `blog/${slug}`);
        const count = (intent: string | null) =>
          fromArticle.filter((link) => link.url.searchParams.get('intent') === intent).length;
        const wanted = new Map<string | null, number>();
        for (const intent of intents) wanted.set(intent, (wanted.get(intent) ?? 0) + 1);
        return [
          // 本文の link と、本文の下の相談の箱（BlogCta）の 1 本
          ...(fromArticle.length === intents.length + 1 ? [] : [`${pagePath}: blog/${slug} の link が ${fromArticle.length} 本（本文 ${intents.length} + 箱 1 のはず）`]),
          ...fromArticle.filter((link) => link.url.searchParams.get('locale') !== page.locale).map((link) => `${pagePath}: locale が違う ${link.raw}`),
          ...[...wanted].filter(([intent, n]) => count(intent) < n).map(([intent, n]) => `${pagePath}: intent=${intent} が ${count(intent)} 本（本文に ${n} 本）`),
        ];
      });
    expect(problems).toEqual([]);
  });

  // カレンダーは PUBLIC_GCAL_ID がある build にだけ在る（CI はカレンダーなしと、ダミーの ID のカレンダーありの 2 回 build する）。
  // 区画が在る言語では、フッターの在る全ページに 1 本。無ければ 0 本（無いのに打ち合わせの時間を言わない）。
  // 2 本以上・言語の違う問い合わせページ・hash の無い link も、この数か上の試験で落ちる。
  it('カレンダーの区画への link は、区画が在る build では各ページに 1 本、無い build では 0 本', () => {
    const locales: readonly Locale[] = ['ja', ...NON_JA];
    const sections = Object.fromEntries(locales.map((locale) => [locale, calendarSectionExists(locale)])) as Record<Locale, boolean>;
    if (EXPECT_CALENDAR !== undefined) {
      expect(sections, 'build の条件（CONTACT_GUARD_EXPECT_CALENDAR）とカレンダーの区画が合わない').toEqual(
        Object.fromEntries(locales.map((locale) => [locale, EXPECT_CALENDAR === '1'])),
      );
    }
    const withFooter = pages.filter((page) => page.hasSiteFooter);
    expect(withFooter.length, 'フッターの在るページが少なすぎる').toBeGreaterThan(500);
    const wrong = withFooter.flatMap((page) => {
      const want = sections[page.locale] ? 1 : 0;
      const have = page.links.filter(isCalendarLinkFor(page.locale)).length;
      const strays = page.links
        .filter((link) => link.url.searchParams.get('source') === CALENDAR_SOURCE && !isCalendarLinkFor(page.locale)(link))
        .map((link) => link.raw);
      return have === want && strays.length === 0
        ? []
        : [`${page.pagePath}（${page.locale}）: ${have} 本（期待 ${want} 本）${strays.length ? ` / 行き先の違う link ${strays.join(' ')}` : ''}`];
    });
    expect(wrong).toEqual([]);
  });

  it('チャットへの link は、どれも source を持ち、locale がそのページの言語', () => {
    const wrong = pages
      .filter((page) => !page.pagePath.startsWith(CLOUDIA_CHAT_PATH))
      .flatMap((page) =>
        page.links
          .filter(isChatLink)
          .filter((link) => !link.url.searchParams.get('source') || link.url.searchParams.get('locale') !== page.locale)
          .map((link) => `${page.pagePath}（${page.locale}）→ ${link.raw}`),
      );
    expect(wrong).toEqual([]);
  });

  // 主な入口と、そこから出る source（と intent）。問い合わせページを通していた頃は、source の無い入口は
  // ページの主ボタンの corsweb-contact-primary になっていた。今は入口ごとに付ける。
  const ENTRIES: ReadonlyArray<{ name: string; pagePath: string; expected: ReadonlyArray<Partial<ReturnType<typeof describeLink>>> }> = [
    {
      name: 'ja のトップ（ヘッダー・最初の画面・締め・フッター）',
      pagePath: '/',
      expected: [
        { source: 'header', locale: 'ja' },
        { source: 'header-quick', locale: 'ja' },
        { source: 'home-hero', intent: 'confidential-ai-assessment', locale: 'ja' },
        ...jaJson.finalCta.items
          .filter((item) => !item.intent.startsWith('grift'))
          .map((item) => ({ source: 'final-cta', intent: item.intent, locale: 'ja' })),
        { source: 'footer', locale: 'ja' },
      ],
    },
    {
      name: 'en のトップ',
      pagePath: '/en/',
      expected: [
        { source: 'header', locale: 'en' },
        { source: 'home-hero', intent: 'confidential-ai-assessment', locale: 'en' },
        ...enJson.finalCta.items
          .filter((item) => !item.intent.startsWith('grift'))
          .map((item) => ({ source: 'final-cta', intent: item.intent, locale: 'en' })),
        { source: 'footer', locale: 'en' },
      ],
    },
    { name: 'ja の会社概要', pagePath: '/company/', expected: [{ source: 'company', locale: 'ja' }] },
    { name: 'zh の会社概要', pagePath: '/zh/company/', expected: [{ source: 'company', locale: 'zh' }] },
    { name: 'en の About', pagePath: '/en/about/', expected: [{ source: 'about', locale: 'en' }] },
    { name: 'ja のセキュリティ', pagePath: '/security/', expected: [{ source: 'security', locale: 'ja' }] },
    { name: 'ko のセキュリティ', pagePath: '/ko/security/', expected: [{ source: 'security', locale: 'ko' }] },
    { name: 'ja の投げ銭の取り消し', pagePath: '/tip-cancelled/', expected: [{ source: 'tip-cancelled', locale: 'ja' }] },
    { name: 'es の投げ銭の取り消し', pagePath: '/es/tip-cancelled/', expected: [{ source: 'tip-cancelled', locale: 'es' }] },
    { name: 'ja の実績の一覧', pagePath: '/works/', expected: [{ source: 'works-next', intent: 'confidential-ai-assessment', locale: 'ja' }] },
    { name: 'ja の実績の記事', pagePath: '/works/grift/', expected: [{ source: 'works/grift', locale: 'ja' }] },
    { name: 'ja の取材のページ', pagePath: '/news/press/', expected: [{ source: 'press-page', intent: 'press-speaking-other', locale: 'ja' }] },
    {
      name: 'ja のブログの記事',
      pagePath: '/blog/complete-markdown-guide/',
      expected: [{ source: 'blog/complete-markdown-guide', locale: 'ja' }],
    },
  ];

  it.each(ENTRIES)('主な入口: $name', ({ pagePath, expected }) => {
    const found = chatLinksOn(pagePath).map(describeLink);
    const missing = expected.filter(
      (want) => !found.some((have) => Object.entries(want).every(([key, value]) => have[key as keyof typeof have] === value)),
    );
    expect(missing, `${pagePath} のチャットへの link: ${JSON.stringify(found)}`).toEqual([]);
  });
});

// 本番（Firebase Hosting）は、末尾の / が無い path（/en、/contact）を / 付きへ転送する。ページ遷移（ViewTransitions）は
// 転送の後の URL を使うので、hash が落ちて、その区画に着かない。hash を持つサイト内の link は、path を末尾の / まで書く。
// file（.xml・.pdf など）への link は転送されないので除く。
// 下の表は、この形のまま残っている link（業種のページから、その言語のトップの業種の入口へ）。直す変更で表から外す
// （下の「まだ在る」の試験が、外し忘れを落とす）。
const HASH_LINKS_OUTSIDE_THIS_CHANGE = [
  '/en#home-industry-entry',
  '/zh#home-industry-entry',
  '/ko#home-industry-entry',
  '/es#home-industry-entry',
] as const;
const hashLinkRaw = (link: Link) => `${link.url.pathname}${link.url.search}${link.url.hash}`;
const isFilePath = (pathname: string) => /\.[a-z0-9]{2,5}$/i.test(pathname);
const isRedirectedHashLink = (link: Link) =>
  (link.kind === 'a' || link.kind === 'area') &&
  link.url.hash !== '' &&
  !link.url.pathname.endsWith('/') &&
  !isFilePath(link.url.pathname);

describe('サイト内の hash を持つ link（本番の転送で hash が落ちない形）', () => {
  it('hash を持つサイト内の link は、path を末尾の / まで書く（表の link を除く）', () => {
    const allowed = new Set<string>(HASH_LINKS_OUTSIDE_THIS_CHANGE);
    const found = pages.flatMap((page) =>
      page.links
        .filter(isRedirectedHashLink)
        .filter((link) => !allowed.has(hashLinkRaw(link)))
        .map((link) => `${page.pagePath} → ${link.raw}`),
    );
    expect(found).toEqual([]);
  });

  it('表の link は、まだ dist に在る（直したら、表から外す）', () => {
    const seen = new Set(pages.flatMap((page) => page.links.filter(isRedirectedHashLink).map(hashLinkRaw)));
    expect(HASH_LINKS_OUTSIDE_THIS_CHANGE.filter((raw) => !seen.has(raw))).toEqual([]);
  });
});
