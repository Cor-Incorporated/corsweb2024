// 下の帯の中身（src/config/site-chrome.json）の検査。
// ・共通 link の href は cor-jp.com の実在する page に当たる（page が消えたら赤）
// ・会社名は organization.ts（ORGANIZATION_NAMES）と同じ（二重に持つ値を機械で結ぶ）
// ・「利用規約」(terms) は置かない（この site に page が無い）
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CURRENT_SITE,
  SITE_CHROME,
  commonLinksFor,
  organizationNameFor,
  siteChromeYear,
} from '../site-chrome';
import { ORGANIZATION_NAMES } from '../organization';
import type { Locale } from '../../utils/i18n';

const LOCALES: readonly Locale[] = ['ja', 'en', 'zh', 'ko', 'es'];
const PAGES_DIR = path.resolve(__dirname, '../../pages');
const LAYOUT_DIR = path.resolve(__dirname, '../../components/layout');

/** `https://cor-jp.com/<path>/` が src/pages のどの file に当たるか。動的 route は対象外（この帯には無い）。 */
function pageFileExists(href: string): boolean {
  const pagePath = new URL(href).pathname.replace(/^\/+|\/+$/g, '');
  const base = pagePath === '' ? 'index' : pagePath;
  return (
    existsSync(path.join(PAGES_DIR, `${base}.astro`)) ||
    existsSync(path.join(PAGES_DIR, pagePath, 'index.astro'))
  );
}

describe('site-chrome.json（下の帯の中身）', () => {
  it('version 2', () => {
    expect(SITE_CHROME.version).toBe(2);
  });

  it('サイト切替は cor・grift・cloudia の 3 つ（今のサイトは cor）', () => {
    expect(SITE_CHROME.sites.map((site) => site.id)).toEqual(['cor', 'grift', 'cloudia']);
    expect(CURRENT_SITE).toBe('cor');
    for (const site of SITE_CHROME.sites) {
      expect(site.label, site.id).not.toBe('');
      expect(site.href, site.id).toMatch(/^https:\/\/.+\/$/);
    }
  });

  for (const locale of LOCALES) {
    describe(locale, () => {
      const links = commonLinksFor(locale);

      it('共通 link が 3 本（プライバシー・特定商取引法表記・セキュリティ）で、label が空ではない', () => {
        expect(links.map((link) => link.id)).toEqual(['privacy', 'tokushoho', 'security']);
        for (const link of links) {
          expect(link.label, `${locale}/${link.id} label`).not.toBe('');
        }
      });

      it('href は https:// 始まり・末尾スラッシュ・terms を含まない', () => {
        for (const link of links) {
          expect(link.href, `${locale}/${link.id}`).toMatch(/^https:\/\//);
          expect(link.href.endsWith('/'), `${locale}/${link.id} 末尾スラッシュ`).toBe(true);
          expect(link.href.toLowerCase(), `${locale}/${link.id} に terms を置かない`).not.toContain('terms');
        }
      });

      it('href は src/pages に実在する page に当たる', () => {
        for (const link of links) {
          expect(pageFileExists(link.href), `${locale}/${link.id} → ${link.href}`).toBe(true);
        }
      });

      it(`会社名は ORGANIZATION_NAMES と同じ（${ORGANIZATION_NAMES[locale]}）`, () => {
        expect(organizationNameFor(locale)).toBe(ORGANIZATION_NAMES[locale]);
      });
    });
  }

  it('年は渡した時計の年（試験で固定できる）', () => {
    expect(siteChromeYear(new Date('2026-01-02T03:04:05Z'))).toBe(2026);
  });
});

describe('Header.astro・Footer.astro の source（URL の直書きを機械で見つける）', () => {
  /** Astro のコメント（テンプレートのコメントと HTML のコメント）を除いた source。コメントの中の URL は直書きではない。 */
  const stripComments = (source: string): string =>
    source
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/<!--[\s\S]*?-->/g, '');

  it('link の href に https://… の直書きは 0 件（URL の正本は site-chrome.json と config 系。xmlns は http なので最初から当たらない）', () => {
    for (const file of ['Header.astro', 'Footer.astro']) {
      const source = stripComments(readFileSync(path.join(LAYOUT_DIR, file), 'utf8'));
      const found = [...source.matchAll(/\bhref\s*=\s*(['"])https:\/\/[^'"]*\1/g)].map((match) => match[0]);
      expect(found, `${file}: ${found.join(' ')}`).toEqual([]);
    }
  });
});
