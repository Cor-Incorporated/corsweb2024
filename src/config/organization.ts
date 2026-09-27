/**
 * 会社（Organization）の事実の正本。JSON-LD・フッター・RSS・ブログの <title> がここを読む。
 * 同じ事実を複数箇所に書かない（片方だけ直して社名の表記が 4 種類、@id が 2 通りに割れた経緯がある。
 * ADR-0017: 会社と著者は 1 か所で定義し、@id で参照する）。
 */
import type { Locale } from '../utils/i18n';

export const SITE_ORIGIN = 'https://cor-jp.com';
export const ORGANIZATION_ID = `${SITE_ORIGIN}/#organization`;
export const WEBSITE_ID = `${SITE_ORIGIN}/#website`;
export const ORGANIZATION_LOGO = `${SITE_ORIGIN}/logo.png`;

/** 正式社名（ADR-0007: 社名は「Cor.株式会社」に統一）。JSON-LD の legalName は全ロケールでこれ。 */
export const LEGAL_NAME = 'Cor.株式会社';

/**
 * ロケール別の社名表記（#306 で決めた <title> の表記と同じ）。ja / zh は正式名、ko はハングル表記、
 * en / es はラテン文字表記。Record にして全ロケールの網羅を型で強制する。
 */
export const ORGANIZATION_NAMES: Record<Locale, string> = {
  ja: LEGAL_NAME,
  zh: LEGAL_NAME,
  ko: 'Cor.주식회사',
  en: 'Cor.Inc.',
  es: 'Cor.Inc.',
};

export type SocialLink = {
  name: string;
  href: string;
  /** company: 会社の公式アカウント（Organization.sameAs に入る）/ founder: 代表個人のアカウント */
  owner: 'company' | 'founder';
};

/**
 * フッター「Social」に並べるアカウント（表示順）。owner が company のものだけが Organization.sameAs に入る。
 * x.com/cor_terisuke は代表個人のアカウント（CEO 判断 2026-09-27）。表示は続けるが会社の sameAs には入れない
 * （Person 側で扱う）。代表の LinkedIn / Facebook / Qiita 等もフッターと会社の sameAs には載せない。
 */
export const SOCIAL_LINKS: readonly SocialLink[] = [
  { name: 'Github', href: 'https://github.com/Cor-Incorporated', owner: 'company' },
  { name: 'X(Twitter)', href: 'https://x.com/cor_terisuke', owner: 'founder' },
  { name: 'YouTube', href: 'https://www.youtube.com/@Cor.Incorporated', owner: 'company' },
];

/** Organization.sameAs（会社の公式アカウントだけ）。 */
export const ORGANIZATION_SAME_AS: readonly string[] = SOCIAL_LINKS.filter((link) => link.owner === 'company').map(
  (link) => link.href,
);
