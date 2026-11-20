// ビルド済み dist の下の帯と header の形の検査（設定: vitest.dist.config.ts。`npm run build` の後に `npm run test:dist`）。
// 帯の中身の正本は src/config/site-chrome.json（単体試験は src/config/__tests__/site-chrome.test.ts）。
// 圧縮後の HTML は属性値の引用符を外す事がある（aria-label=主要ページ）ので、値の判定は 3 通り全部受ける。
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CURRENT_SITE, SITE_CHROME, commonLinksFor } from '../../src/config/site-chrome';
import { getTranslations } from '../../src/utils/i18n';
import type { Locale } from '../../src/utils/i18n';

const DIST_DIR = path.resolve(process.env.CONTACT_GUARD_DIST_DIR || 'dist');
const LOCALES: readonly Locale[] = ['ja', 'en', 'zh', 'ko', 'es'];

function read(relative: string): string {
  const file = path.join(DIST_DIR, relative);
  expect(existsSync(file), `${file} が無い。先に npm run build を実行する`).toBe(true);
  return readFileSync(file, 'utf8');
}

function homeFile(locale: Locale): string {
  return locale === 'ja' ? 'index.html' : path.join(locale, 'index.html');
}

const ATTR_VALUE = String.raw`(?:"([^"]*)"|'([^']*)'|([^\s>]+))`;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 開き tag 1 個の中の属性の値（引用符 3 通り）。無ければ null。 */
function attrOf(tag: string, attr: string): string | null {
  const m = tag.match(new RegExp(String.raw`\s${attr}=${ATTR_VALUE}`));
  return m ? (m[1] ?? m[2] ?? m[3] ?? null) : null;
}

/** html の中に attr=value（引用符 3 通り）があるか。 */
function hasAttr(where: string, attr: string, value: string): boolean {
  return new RegExp(String.raw`\s${attr}=(?:"${esc(value)}"|'${esc(value)}'|${esc(value)}(?=[\s>]))`).test(
    where,
  );
}

/** href が value（query の & は実体参照化されている事がある）の <a …> の開き tag。 */
function anchorTag(html: string, href: string): string {
  const candidates = new Set([href, href.replace(/&/g, '&amp;'), href.replace(/&/g, '&#38;')]);
  for (const tag of html.matchAll(/<a\b[^>]*>/g)) {
    const actual = attrOf(tag[0], 'href');
    if (actual && candidates.has(actual)) return tag[0];
  }
  return '';
}

/** html から <footer …> … </footer> を取り出す（contentinfo は 1 つだけである事を先に確かめる）。 */
function footerBlock(html: string): string {
  const tags = html.match(/<footer\b[\s\S]*?<\/footer>/g) ?? [];
  expect(tags.length, '<footer>（contentinfo）は 1 つだけ').toBe(1);
  return tags[0] ?? '';
}

/** built CSS（dist/_astro/*.css）を全部つなげた物。utility の生成の有無に使う。 */
const builtCss = existsSync(path.join(DIST_DIR, '_astro'))
  ? readdirSync(path.join(DIST_DIR, '_astro'))
      .filter((name) => name.endsWith('.css'))
      .map((name) => readFileSync(path.join(DIST_DIR, '_astro', name), 'utf8'))
      .join('\n')
  : '';

/** utility が built CSS に生成されているか。Tailwind は selector の特殊文字を \ で escape する
 * （min-h-[1.5rem] → .min-h-\[1\.5rem\]、lg:h-16 → .lg\:h-16）。variant 付きは中間の \: を含むので同じ作りで当たる。 */
const cssHasUtility = (utility: string) => builtCss.includes(utility.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`));

/** html から <header …> … </header> を取り出す。 */
function headerBlock(html: string): string {
  const match = html.match(/<header\b[\s\S]*?<\/header>/);
  expect(match, '<header> が無い').toBeTruthy();
  return match?.[0] ?? '';
}

const desktopNav = (html: string) =>
  html.match(/<nav\b[^>]*aria-label=(?:"主要ページ"|'主要ページ'|主要ページ(?=[\s>]))[^>]*>[\s\S]*?<\/nav>/)?.[0] ?? '';

describe('下の帯（5 言語のトップ）', () => {
  for (const locale of LOCALES) {
    it(`${locale}: 共通 link がこの言語の label と href で 3 本・rel=noopener`, () => {
      const footer = footerBlock(read(homeFile(locale)));
      for (const link of commonLinksFor(locale)) {
        const tag = anchorTag(footer, link.href);
        expect(tag, `${locale}: 帯に ${link.href} が無い`).not.toBe('');
        expect(tagHasRelNoopener(tag), `${locale}: ${link.href} に rel="noopener" が無い`).toBe(true);
        expect(
          new RegExp(`>${esc(link.label)}</a>|>${esc(link.label)}\\s*</a>`).test(footer),
          `${locale}: 帯に「${link.label}」が無い`,
        ).toBe(true);
      }
    });

    it(`${locale}: aria-current="page" は今のサイト（${CURRENT_SITE}）だけ`, () => {
      const footer = footerBlock(read(homeFile(locale)));
      const currentHref = SITE_CHROME.sites.find((site) => site.id === CURRENT_SITE)?.href ?? '';
      const currentTag = anchorTag(footer, currentHref);
      expect(currentTag, `${locale}: 帯に ${currentHref} が無い`).not.toBe('');
      expect(hasAttr(currentTag, 'aria-current', 'page'), '今のサイトに aria-current="page"').toBe(true);
      expect(tagHasRelNoopener(currentTag), '今のサイトの link に rel="noopener"').toBe(true);
      for (const site of SITE_CHROME.sites.filter((site) => site.id !== CURRENT_SITE)) {
        const tag = anchorTag(footer, site.href);
        expect(tag, `${locale}: 帯に ${site.href} が無い`).not.toBe('');
        expect(tag.includes('aria-current'), `${locale}: ${site.href} に aria-current が付いている`).toBe(false);
        expect(tagHasRelNoopener(tag), `${site.href} に rel="noopener" が無い`).toBe(true);
      }
    });

    it(`${locale}: contentinfo（<footer>）は 1 つ・帯の nav に aria-label が付く`, () => {
      const html = read(homeFile(locale));
      footerBlock(html); // <footer> が 2 つ以上なら赤
      const t = getTranslations(locale);
      expect(hasAttr(html, 'aria-label', t.footer.commonLinksLabel), '共通 link の nav の aria-label').toBe(true);
      expect(hasAttr(html, 'aria-label', t.footer.sitesLabel), 'サイト切替の nav の aria-label').toBe(true);
    });

    it(`${locale}: <footer> の中の © の行はちょうど 1 つ（旧い © 行の二重表示がない）`, () => {
      const footer = footerBlock(read(homeFile(locale)));
      // © は build の圧縮で &#169; に置き換わる事があるので両方受け、出現回数で数える
      const count = (footer.match(/©|&#169;/g) ?? []).length;
      expect(count, `${locale}: © が ${count} 個（帯に移した © の他に旧い © 行が残っている）`).toBe(1);
    });
  }
});

describe('built CSS の生成（この repo の Tailwind 3.3.3）', () => {
  it('帯の link の min-h-[1.5rem] と CTA の min-w-[2.75rem] の selector が在る（min-h-6・min-w-11 は 3.4 からで 3.3.3 では生成されない）', () => {
    expect(builtCss, 'dist/_astro/*.css が無い。先に npm run build を実行する').not.toBe('');
    expect(cssHasUtility('min-h-[1.5rem]'), '.min-h-\\[1\\.5rem\\] が built CSS に無い（帯の link の高さ 24px が効かない）').toBe(true);
    expect(cssHasUtility('min-w-[2.75rem]'), '.min-w-\\[2\\.75rem\\] が built CSS に無い（CTA の最小幅 44px が効かない）').toBe(true);
  });
});

describe('header の形（5 言語のトップ）', () => {
  for (const locale of LOCALES) {
    it(`${locale}: sticky・1 段（h-14/lg:h-16）・brand に社名`, () => {
      const html = read(homeFile(locale));
      const header = headerBlock(html);
      const headerTag = header.match(/<header\b[^>]*>/)?.[0] ?? '';
      expect(headerTag, 'header が sticky top-0').toMatch(/\bsticky top-0\b/);
      // bar の高さ: 1024px 未満 56px・以上 64px（下の border 1px を含む。border-box）
      expect(header, 'bar の高さ 56px').toMatch(/\bh-\[calc\(3\.5rem-1px\)\]/);
      expect(header, 'bar の高さ 64px').toMatch(/\blg:h-\[calc\(4rem-1px\)\]/);
      const brand = header.match(/<a\b[^>]*>\s*<span\b[^>]*sr-only[^>]*>/);
      expect(brand, `${locale}: brand の link と sr-only の社名`).toBeTruthy();
    });

    it(`${locale}: お問い合わせの CTA が nav の外（右の組）にある`, () => {
      const html = read(homeFile(locale));
      const header = headerBlock(html);
      const nav = desktopNav(header);
      expect(nav, 'aria-label="主要ページ" の nav').not.toBe('');
      // href の組み立ては env で変わるので、dist に焼かれた source で探す（& は実体参照化されている）
      expect(nav, 'nav の中に CTA は置かない').not.toContain('source=header-quick');
      const cta = header.match(/<a\b(?=[^>]*source=header-quick)[^>]*>/)?.[0] ?? '';
      expect(cta, `${locale}: header の右の組に CTA（source=header-quick）が無い`).not.toBe('');
      expect(cta, 'CTA は pill（rounded-full + bg-[#2d4a6b]）').toMatch(/bg-\[#2d4a6b\]/);
      expect(cta).toMatch(/rounded-full/);
    });

    it(`${locale}: menu button は 1024px 未満だけ（lg:hidden）・言語 pill に短い名前`, () => {
      const header = headerBlock(read(homeFile(locale)));
      const menuButton = header.match(/<button\b[^>]*aria-controls=(?:"website-menu"|'website-menu'|website-menu(?=[\s>]))[^>]*>/)?.[0] ?? '';
      expect(menuButton, 'menu button').not.toBe('');
      expect(menuButton).toMatch(/lg:hidden/);
      const short = { ja: 'JA', en: 'EN', zh: 'ZH', ko: 'KO', es: 'ES' }[locale];
      expect(header, `${locale}: 言語 pill に ${short}`).toContain(`>${short}<`);
    });
  }
});

function tagHasRelNoopener(tag: string): boolean {
  return hasAttr(tag, 'rel', 'noopener');
}
