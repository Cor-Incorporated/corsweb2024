// ビルド済み dist の業種のページ（5 業種 × 5 言語 = 25 ページ）の検査（設定: vitest.dist.config.ts）。
// `npm run build` の後に `npm run test:dist`。
// ja の 5 ページは issue #525 の本文（ja.json の industry<Name>.proposal、ProposalPage が描く）。
// en・zh・ko・es の 20 ページは、旧い本文（industry<Name> の hero・challenges・support・cta、*Body.astro）のまま。
// ja の 5 ページで確かめること:
// - H1 は 1 つで、industry<Name>.proposal.title と同じ
// - 署名の区画は 1 つ。肩書と名前の行が 1 つあり、会社の提供の条件（ISMS の欄・問い合わせ）を含まない
// - 出典の表示が、参考資料の数だけある（本文の [n] と、CTA の後の参考資料の欄。教育は本文の近くのリンク）
// - 問い合わせの入口が業種の source を持つ。本文の中に問い合わせページ（/contact）への link が無い
// - 資料ダウンロードの段落と副ボタンは、資料の受け取りの入口（DOCUMENT_DOWNLOAD_HREF）があるときだけ出る
// - Markdown の記号やコメントが本文に出ていない。サイト内の link はその言語のページを指し、dist に在る
// 25 ページで確かめること:
// - 本文（<main>）が Grift に触れず、Grift へ誘わない
// - 浮きボタンの相談の link が業種の source を持つ
// en・zh・ko・es の 20 ページで確かめること:
// - H1 は 1 つで、その言語の industry<Name>.hero.title と同じ。サービスへの道（IndustryPaths）がある
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { DOCUMENT_DOWNLOAD_HREF, PROPOSAL_LINKS } from '../../src/components/industry/proposal-links';
import en from '../../src/i18n/locales/en.json';
import es from '../../src/i18n/locales/es.json';
import ja from '../../src/i18n/locales/ja.json';
import ko from '../../src/i18n/locales/ko.json';
import zh from '../../src/i18n/locales/zh.json';

const DIST_DIR = path.resolve(process.env.CONTACT_GUARD_DIST_DIR || 'dist');
const LOCALES = { ja, en, zh, ko, es } as const;
type LocaleKey = keyof typeof LOCALES;
const PAGE_KEYS = {
  medical: 'industryMedical',
  shigyo: 'industryShigyo',
  construction: 'industryConstruction',
  manufacturing: 'industryManufacturing',
  education: 'industryEducation',
} as const;
type Slug = keyof typeof PAGE_KEYS;
const SLUGS = Object.keys(PAGE_KEYS) as Slug[];
const ALL_CASES = (Object.keys(LOCALES) as LocaleKey[]).flatMap((locale) =>
  SLUGS.map((slug) => ({ locale, slug, name: `${locale}/${slug}` })),
);
const JA_CASES = SLUGS.map((slug) => ({ slug, name: `ja/${slug}` }));
const OTHER_CASES = ALL_CASES.filter(({ locale }) => locale !== 'ja') as {
  locale: Exclude<LocaleKey, 'ja'>;
  slug: Slug;
  name: string;
}[];

function prefix(locale: LocaleKey): string {
  return locale === 'ja' ? '' : `/${locale}`;
}

function load(locale: LocaleKey, slug: Slug): Document {
  const file = path.join(DIST_DIR, prefix(locale), 'industries', slug, 'index.html');
  expect(existsSync(file), `${file} が無い。先に npm run build を実行する`).toBe(true);
  return new JSDOM(readFileSync(file, 'utf8')).window.document;
}

function main(doc: Document): Element {
  const element = doc.querySelector('main');
  expect(element, '<main> が無い').not.toBeNull();
  return element as Element;
}

function squash(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

function distHas(pathname: string): boolean {
  const clean = pathname.replace(/\/+$/, '');
  return [path.join(DIST_DIR, clean, 'index.html'), path.join(DIST_DIR, `${clean}.html`)].some((f) => existsSync(f));
}

const PROPOSAL_PARTS = '[data-proposal-hero], [data-proposal-body], [data-proposal-cta], [data-proposal-sources]';

describe.each(JA_CASES)('ja の業種のページ $name', ({ slug }) => {
  const page = ja[PAGE_KEYS[slug]].proposal;
  const links = PROPOSAL_LINKS[slug];

  it('H1 は 1 つで、本文の題と同じ', () => {
    const h1s = [...load('ja', slug).querySelectorAll('h1')].map((h) => squash(h.textContent));
    expect(h1s).toEqual([page.title]);
  });

  it('署名の区画は 1 つで、肩書と名前の行が 1 つ。会社の提供の条件を含まない', () => {
    const voices = load('ja', slug).querySelectorAll('[data-founder-voice]');
    expect(voices.length).toBe(1);
    const voice = voices[0];
    expect(voice.querySelectorAll('[data-founder-byline]').length).toBe(1);
    expect(voice.querySelector('[data-company-note], [data-proposal-cta], [data-industry-inquiry]')).toBeNull();
    expect(voice.textContent ?? '').not.toContain('27001');
  });

  it('出典の表示が参考資料の数だけあり、リンク先がそろう', () => {
    const doc = load('ja', slug);
    const count = links.sources.length;
    const cites = [...doc.querySelectorAll('[data-source-cite]')].map((a) => Number(a.getAttribute('data-source-cite')));
    const nearLinks = [...doc.querySelectorAll('[data-source-link]')].map((a) => Number(a.getAttribute('data-source-link')));
    const cards = doc.querySelectorAll('[data-source-card]');
    const numbers = Array.from({ length: count }, (_, i) => i + 1);
    if (page.sources.length === 0) {
      expect(nearLinks.sort((a, b) => a - b)).toEqual(numbers);
      expect(cards.length).toBe(0);
    } else {
      expect([...new Set(cites)].sort((a, b) => a - b)).toEqual(numbers);
      expect(cards.length).toBe(count);
      [...cards].forEach((card, index) => {
        const href = card.querySelector('a')?.getAttribute('href') ?? '';
        expect(href, `参考資料 ${index + 1}`).toBe(links.sources[index]);
      });
    }
  });

  it('問い合わせの入口が業種の source を持ち、本文に問い合わせページへの link が無い', () => {
    const doc = load('ja', slug);
    const inquiry = doc.querySelectorAll(`[data-industry-inquiry="industry-${slug}"]`);
    expect(inquiry.length).toBe(1);
    const url = new URL(inquiry[0].getAttribute('href') ?? '', 'https://cor-jp.com');
    expect(url.searchParams.get('source')).toBe(`industry-${slug}`);
    const viaContact = [...main(doc).querySelectorAll(PROPOSAL_PARTS)]
      .flatMap((part) => [...part.querySelectorAll('a[href]')])
      .map((a) => a.getAttribute('href') ?? '')
      .filter((href) => /^\/contact\/?(?:[?#]|$)/.test(href));
    expect(viaContact).toEqual([]);
  });

  it('資料ダウンロードの段落と副ボタンは、資料の受け取りの入口があるときだけ出る', () => {
    const cta = load('ja', slug).querySelector('[data-proposal-cta]');
    expect(cta).not.toBeNull();
    const note = page.cta.body.find((block) => 'downloadNote' in block) as { downloadNote: string } | undefined;
    expect(note, 'locale に資料ダウンロードの段落が無い').toBeDefined();
    const buttons = [...(cta as Element).querySelectorAll('[data-document-download]')];
    const text = squash(cta?.textContent);
    if (DOCUMENT_DOWNLOAD_HREF === null) {
      expect(buttons.length).toBe(0);
      expect(text).not.toContain(squash(note?.downloadNote));
      expect(text).not.toContain(page.cta.downloadButton);
    } else {
      expect(buttons.map((a) => a.getAttribute('href'))).toEqual([DOCUMENT_DOWNLOAD_HREF]);
      expect(text).toContain(squash(note?.downloadNote));
    }
  });

  it('本文に Markdown の記号・コメントが出ず、サイト内の link は dist に在る', () => {
    const parts = [...main(load('ja', slug)).querySelectorAll(PROPOSAL_PARTS)];
    expect(parts.length).toBeGreaterThanOrEqual(3);
    for (const part of parts) {
      expect(part.textContent ?? '').not.toMatch(/\*\*|##|<!--|\]\(/);
      expect(part.innerHTML).not.toContain('<!--');
      const internal = [...part.querySelectorAll('a[href^="/"]')]
        .map((a) => a.getAttribute('href') ?? '')
        .filter((href) => !href.startsWith('/contact/chat/'));
      for (const href of internal) expect(distHas(href.split(/[?#]/)[0]), `${href} が dist に無い`).toBe(true);
    }
  });
});

describe.each(ALL_CASES)('業種のページ $name', ({ locale, slug }) => {
  it('本文が Grift に触れず、Grift へ誘わない', () => {
    const body = main(load(locale, slug));
    expect(body.textContent ?? '', '本文が Grift に触れている').not.toMatch(/grift/i);
    const hrefs = [...body.querySelectorAll('a[href]')].map((a) => a.getAttribute('href') ?? '');
    expect(hrefs.filter((href) => /grift/i.test(href))).toEqual([]);
  });

  it('浮きボタンの相談の link が業種の source を持つ', () => {
    const launcher = load(locale, slug).querySelector('#cloudia-launcher');
    expect(launcher, '浮きボタンが無い').not.toBeNull();
    const chatPath = launcher?.getAttribute('data-chat-path') ?? '';
    const url = new URL(chatPath, 'https://cor-jp.com');
    expect(url.searchParams.get('source')).toBe(`industry-${slug}`);
    expect(url.searchParams.get('locale')).toBe(locale);
  });
});

describe.each(OTHER_CASES)('旧い本文のままの業種のページ $name', ({ locale, slug }) => {
  it('H1 は 1 つで、その言語の hero.title と同じ。サービスへの道がある', () => {
    const doc = load(locale, slug);
    const h1s = [...doc.querySelectorAll('h1')].map((h) => squash(h.textContent));
    expect(h1s).toEqual([squash(LOCALES[locale][PAGE_KEYS[slug]].hero.title)]);
    expect(doc.querySelector(`[data-industry-paths="industry-${slug}"]`)).not.toBeNull();
  });
});
