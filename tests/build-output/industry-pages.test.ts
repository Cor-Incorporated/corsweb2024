// ビルド済み dist の業種のページ（5 業種 × 5 言語 = 25 ページ）の検査（設定: vitest.dist.config.ts）。
// `npm run build` の後に `npm run test:dist`。本文は issue #525 の本文（ja）とその訳で、
// 文言は locale の industry<Name>、リンク先は src/components/industry/proposal-links.ts。
// 確かめること:
// - H1 は 1 つで、その言語の industry<Name>.title と同じ
// - 署名の区画は 1 つ。肩書と名前の行が 1 つあり、会社の提供の条件（ISMS の欄・問い合わせ）を含まない
// - 出典の表示が、参考資料の数だけある（本文の [n] と、CTA の後の参考資料の欄。教育は本文の近くのリンク）
// - 問い合わせの入口が業種の source を持つ。本文の中に問い合わせページ（/contact）への link が無い
// - Markdown の記号やコメントが本文に出ていない。業種のページから Grift へ誘っていない
// - サイト内の link はその言語のページを指し、dist に在る
// - 資料ダウンロードの段落と副ボタンは、資料の受け取りの入口（DOCUMENT_DOWNLOAD_HREF）があるときだけ出る
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
const CASES = (Object.keys(LOCALES) as LocaleKey[]).flatMap((locale) =>
  (Object.keys(PAGE_KEYS) as Slug[]).map((slug) => ({ locale, slug, name: `${locale}/${slug}` })),
);

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

describe.each(CASES)('業種のページ $name', ({ locale, slug }) => {
  const page = LOCALES[locale][PAGE_KEYS[slug]];
  const links = PROPOSAL_LINKS[slug];

  it('H1 は 1 つで、その言語の本文の題と同じ', () => {
    const h1s = [...load(locale, slug).querySelectorAll('h1')].map((h) => squash(h.textContent));
    expect(h1s).toEqual([page.title]);
  });

  it('署名の区画は 1 つで、肩書と名前の行が 1 つ。会社の提供の条件を含まない', () => {
    const doc = load(locale, slug);
    const voices = doc.querySelectorAll('[data-founder-voice]');
    expect(voices.length).toBe(1);
    const voice = voices[0];
    expect(voice.querySelectorAll('[data-founder-byline]').length).toBe(1);
    expect(voice.querySelector('[data-company-note], [data-proposal-cta], [data-industry-inquiry]')).toBeNull();
    expect(voice.textContent ?? '').not.toContain('27001');
  });

  it('出典の表示が参考資料の数だけあり、リンク先がそろう', () => {
    const doc = load(locale, slug);
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
        const expected = links.sources[index].startsWith('/') ? `${prefix(locale)}${links.sources[index]}` : links.sources[index];
        expect(href, `参考資料 ${index + 1}`).toBe(expected);
      });
    }
  });

  it('問い合わせの入口が業種の source を持ち、本文に問い合わせページへの link が無い', () => {
    const doc = load(locale, slug);
    const inquiry = doc.querySelectorAll(`[data-industry-inquiry="industry-${slug}"]`);
    expect(inquiry.length).toBe(1);
    const url = new URL(inquiry[0].getAttribute('href') ?? '', 'https://cor-jp.com');
    expect(url.searchParams.get('source')).toBe(`industry-${slug}`);
    const contactPage = new RegExp(`^(?:/(?:en|zh|ko|es))?/contact/?(?:[?#]|$)`);
    const viaContact = [...main(doc).querySelectorAll(PROPOSAL_PARTS)]
      .flatMap((part) => [...part.querySelectorAll('a[href]')])
      .map((a) => a.getAttribute('href') ?? '')
      .filter((href) => contactPage.test(href));
    expect(viaContact).toEqual([]);
  });

  it('資料ダウンロードの段落と副ボタンは、資料の受け取りの入口があるときだけ出る', () => {
    const cta = load(locale, slug).querySelector('[data-proposal-cta]');
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

  it('本文に Markdown の記号・コメントが出ず、Grift へ誘わない', () => {
    const doc = load(locale, slug);
    const parts = [...main(doc).querySelectorAll(PROPOSAL_PARTS)];
    expect(parts.length).toBeGreaterThanOrEqual(3);
    for (const part of parts) {
      const text = part.textContent ?? '';
      expect(text).not.toMatch(/\*\*|##|<!--|\]\(/);
      expect(text, '本文が Grift に触れている').not.toMatch(/grift/i);
      expect(part.innerHTML).not.toContain('<!--');
      const hrefs = [...part.querySelectorAll('a[href]')].map((a) => a.getAttribute('href') ?? '');
      expect(hrefs.filter((href) => /grift/i.test(href))).toEqual([]);
    }
  });

  it('サイト内の link はその言語のページを指し、dist に在る', () => {
    const doc = load(locale, slug);
    const internal = [...main(doc).querySelectorAll(PROPOSAL_PARTS)]
      .flatMap((part) => [...part.querySelectorAll('a[href^="/"]')])
      .map((a) => a.getAttribute('href') ?? '')
      .filter((href) => !href.startsWith('/contact/chat/'));
    for (const href of internal) {
      const pathname = href.split(/[?#]/)[0];
      if (locale !== 'ja') expect(pathname, href).toMatch(new RegExp(`^/${locale}(?:/|$)`));
      expect(distHas(pathname), `${href} が dist に無い`).toBe(true);
    }
  });
});
