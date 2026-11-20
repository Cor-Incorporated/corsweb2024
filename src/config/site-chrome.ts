import data from './site-chrome.json';
import type { Locale } from '../utils/i18n';

export type SiteChromeSiteId = 'cor' | 'grift' | 'cloudia';

export interface CommonLink {
  id: string;
  label: Record<Locale, string>;
  href: Record<Locale, string>;
}

export interface SiteLink {
  id: SiteChromeSiteId;
  label: string;
  href: string;
}

export interface SiteChrome {
  version: number;
  organization: Record<Locale, string>;
  commonLinks: CommonLink[];
  sites: SiteLink[];
}

/**
 * 下の帯（footer の一番下の行）の中身の正本は site-chrome.json。ここはその型付きの取り出し。
 * 会社名は organization.ts（ORGANIZATION_NAMES）と同じ値を JSON にも持ち、
 * src/config/__tests__/site-chrome.test.ts が機械で結ぶ（食い違えば落ちる）。
 * URL を Footer.astro に直書きしない（JSON だけが正本）。
 */
export const SITE_CHROME = data as SiteChrome;

/** この repo が公開しているサイト（帯のサイト切替で aria-current を付ける側）。 */
export const CURRENT_SITE: SiteChromeSiteId = 'cor';

/** 帯の「© <年>」の年。SSG なので build 時に焼き込まれる（試験では時計を固定する）。 */
export function siteChromeYear(now: Date = new Date()): number {
  return now.getFullYear();
}

/** 今の言語の共通 link（プライバシー・特定商取引法表記・セキュリティ）。並びは JSON のまま。 */
export function commonLinksFor(locale: Locale): Array<{ id: string; label: string; href: string }> {
  return SITE_CHROME.commonLinks.map((link) => ({
    id: link.id,
    label: link.label[locale],
    href: link.href[locale],
  }));
}

/** 今の言語の会社名（organization.ts と同じ値である事を試験が確かめる）。 */
export function organizationNameFor(locale: Locale): string {
  return SITE_CHROME.organization[locale];
}

/** サイト切替の一覧。並びは JSON のまま。 */
export function siteLinks(): ReadonlyArray<SiteLink> {
  return SITE_CHROME.sites;
}
